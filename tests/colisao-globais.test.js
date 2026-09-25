/**
 * 000-T11 — Nomes globais repetidos entre arquivos do servidor.
 *
 * No Apps Script todos os .js/.gs dividem o mesmo escopo global. Uma `function` repetida
 * é sobrescrita pela versão carregada por último (bug silencioso); um `const`/`let`/`class`
 * repetido impede o projeto inteiro de carregar.
 *
 * LEGADO_CONHECIDO lista as repetições que já existiam em 2026-09-25. Elas somem na
 * entrega 006; qualquer repetição NOVA faz o teste falhar.
 */
const test = require('node:test');
const assert = require('node:assert');
const { duplicados } = require('./ferramentas/globais');

const LEGADO_CONHECIDO = new Set([
  'insertStructuredData',       // 00services/DatabaseService.js (2x no mesmo arquivo: vale a 2ª)
  'processSupervisorDecision',  // App/App.js e routers/SupervisorRouter.js
  'handleWithdrawal',           // controllers/EstoqueController.js e routers/EstoqueRouter.js
  'getPhotosByRollId',          // idem
  'getRollMovementHistory',     // idem
]);

const FATAIS = new Set(['const', 'let', 'class']);

test('nenhum nome global novo repetido entre arquivos do servidor', () => {
  const novos = [...duplicados()]
    .filter(([nome]) => !LEGADO_CONHECIDO.has(nome))
    .map(([nome, locais]) => `${nome}: ${locais.map((l) => `${l.arquivo}:${l.linha}`).join(', ')}`);
  assert.deepStrictEqual(novos, [], 'Renomeie ou coloque dentro de um namespace:\n' + novos.join('\n'));
});

test('nenhum const/let/class global repetido (quebraria o projeto no Apps Script)', () => {
  const fatais = [...duplicados()]
    .filter(([, locais]) => locais.some((l) => FATAIS.has(l.tipo)))
    .map(([nome]) => nome);
  assert.deepStrictEqual(fatais, []);
});

test('repetições do legado já resolvidas saem da lista', () => {
  const atuais = new Set(duplicados().keys());
  const resolvidas = [...LEGADO_CONHECIDO].filter((nome) => !atuais.has(nome));
  assert.deepStrictEqual(resolvidas, [], 'Remova de LEGADO_CONHECIDO: ' + resolvidas.join(', '));
});
