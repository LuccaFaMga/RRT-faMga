/** 001-T05 — a cópia de servidor gerada precisa estar igual à fonte única. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { PARES, gerar } = require('../../tools/gerar.js');

test('cópias geradas estão atualizadas (rode `npm run gerar`)', () => {
  for (const [fonte, destino] of PARES) {
    const atual = fs.readFileSync(path.resolve(__dirname, '..', '..', destino), 'utf8');
    assert.strictEqual(atual, gerar(fonte), `${destino} desatualizado em relação a ${fonte}`);
  }
});
