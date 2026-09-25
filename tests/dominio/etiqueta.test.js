/**
 * 001-T03 / 001-T04 — Etiqueta: caracterização contra o parser legado do celular
 * e casos específicos do formato novo.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const Etiqueta = require('../../src/server/dominio/Etiqueta.js');
const legadoBruto = require('../fixtures/legado/parseQrPayload.js');
const { casos } = require('../fixtures/etiquetas-sinteticas.json');

function silencioso(fn) {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try { return fn(); } finally { Object.assign(console, orig); }
}
const legado = (texto) => silencioso(() => legadoBruto(texto));

function casosReais() {
  const dir = path.join(__dirname, '..', 'fixtures', 'etiquetas');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))
    .map((f) => ({ nome: 'real ' + f, texto: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

test('paraFormulario dá o mesmo resultado do parser legado em todos os casos', async (t) => {
  for (const c of [...casos, ...casosReais()]) {
    await t.test(c.nome, () => {
      assert.deepStrictEqual(Etiqueta.paraFormulario(c.texto), legado(c.texto));
    });
  }
});

test('os 4 formatos são reconhecidos', () => {
  const posicional = Etiqueta.paraFormulario('F01;Tecelagem X;12345;P100;L7;SP9;C3;XADREZ;R2-P3;150,5;1,60;100% ALGODAO');
  assert.strictEqual(posicional.nf, '12345');
  assert.strictEqual(posicional.meters_supplier, 150.5);
  assert.strictEqual(posicional.wid, 1.6);

  assert.strictEqual(Etiqueta.paraFormulario('{"nf":"10","lote":"L6"}').lot, 'L6');
  assert.strictEqual(Etiqueta.paraFormulario('https://x.com/?nf=13&lote=L9').nf, '13');
  assert.strictEqual(Etiqueta.paraFormulario('nf=15\nlote=L11').lot, 'L11');
});

test('composição com ; no formato posicional é juntada com espaço (como no legado)', () => {
  const r = Etiqueta.paraFormulario('F01;T;1;P;L;S;C;LISO;R1;98;1,45;67% PES;33% VIS');
  assert.strictEqual(r.comp, '67% PES 33% VIS');
});

test('texto sem formato reconhecível devolve null', () => {
  for (const t of ['', '   ', 'ROLO 123 SEM FORMATO', 'F05;Forn;1;P5;L5;S5;BR']) {
    assert.strictEqual(Etiqueta.paraFormulario(t), null, JSON.stringify(t));
    assert.strictEqual(Etiqueta.interpretar(t, 'video'), null);
  }
});

test('interpretar devolve o formato novo com texto bruto e origem', () => {
  const texto = 'F01;Tecelagem X;12345;P100;L7;SP9;C3;XADREZ;R2-P3;150,5;1,60;100% ALGODAO';
  assert.deepStrictEqual(Etiqueta.interpretar(texto, 'foto'), {
    fornecedorId: 'F01', fornecedor: 'Tecelagem X', nf: '12345', produtoId: 'P100',
    produtoFornecedor: 'SP9', lote: 'L7', cor: 'C3', padronagem: 'XADREZ', localizacao: 'R2-P3',
    composicao: '100% ALGODAO', metrosFornecedor: 150.5, largura: 1.6, bruto: texto, origem: 'foto',
  });
});

// Diferença conhecida: com %-escape inválido (ex.: %E0%A4%A) o URLSearchParams troca por "\uFFFD" e
// parametrosDaUrl mantém o texto original. Irrelevante para etiquetas reais.
test('parametrosDaUrl equivale a URLSearchParams', () => {
  const urls = [
    'https://x.com/a?nf=1&lote=L%201&forn=Tex+Sul',
    'https://x.com/?a=1&a=2&b',
    'http://x.com/?c=%E2%9C%93#frag',
    'https://x.com/sem-query',
  ];
  for (const u of urls) {
    assert.deepStrictEqual(Etiqueta.parametrosDaUrl(u), Object.fromEntries(new URL(u).searchParams), u);
  }
});
