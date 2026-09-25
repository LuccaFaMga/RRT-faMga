#!/usr/bin/env node
/**
 * Gera cópias de servidor a partir das fontes únicas em src/client/.
 * O HtmlService só inclui .html e o Apps Script só executa .js, então o mesmo código
 * precisa existir nos dois formatos. Edite SEMPRE a fonte; o teste
 * tests/dominio/etiqueta-copia.test.js falha se a cópia estiver desatualizada.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PARES = [
  ['src/client/comum/etiqueta.html', 'src/server/dominio/Etiqueta.js'],
];

function conteudoDoScript(html) {
  const m = html.match(/<script>\n?([\s\S]*?)<\/script>\s*$/);
  if (!m) throw new Error('arquivo sem bloco <script> único');
  return m[1];
}

function gerar(fonte) {
  const aviso = `// GERADO por tools/gerar.js a partir de ${fonte}. NÃO EDITE ESTE ARQUIVO.\n`;
  return aviso + conteudoDoScript(fs.readFileSync(path.join(RAIZ, fonte), 'utf8'));
}

module.exports = { PARES, gerar };

if (require.main === module) {
  for (const [fonte, destino] of PARES) {
    fs.mkdirSync(path.dirname(path.join(RAIZ, destino)), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, destino), gerar(fonte));
    console.log(`${fonte} → ${destino}`);
  }
}
