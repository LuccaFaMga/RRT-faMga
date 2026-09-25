if (typeof require !== 'undefined') {
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const rolls = {};
const transitions = [];

const context = {
  Logger: { log() {} },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { sleep() {} },
  DatabaseService: {
    rolls: {
      get: (id) => rolls[id] || null,
      update: (id, patch) => Object.assign(rolls[id], patch)
    },
    audit: { add() {} }
  },
  WorkflowService: {
    transition: (id, next, options) => {
      const roll = rolls[id];
      const previous = roll.fase_atual;
      roll.fase_atual = next;
      transitions.push({ id, from: previous, to: next, options });
      return { de: previous, para: next };
    }
  },
  Session: { getActiveUser: () => ({ getEmail: () => 'compras@test' }) }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('controllers/SupervisorController.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('controllers/ComprasController.js', 'utf8'), context);

rolls.ROLO_TESTE = { id_do_rolo: 'ROLO_TESTE', fase_atual: 'aguardando_supervisor' };

const supervisorResult = context.SupervisorController.processSupervisorDecision({
  id_rolo: 'ROLO_TESTE',
  decision: 'REPROVADO',
  supervisorName: 'supervisor@test',
  observacoes: 'Defeito confirmado'
});

assert.strictEqual(supervisorResult.status, 'SUCESSO');
assert.strictEqual(rolls.ROLO_TESTE.fase_atual, 'enviado_compras');
assert.strictEqual(rolls.ROLO_TESTE.compras_status_case, 'pendente');
assert.strictEqual(rolls.ROLO_TESTE.motivo_reprovacao_supervisor, 'Defeito confirmado');

const comprasResult = context.ComprasController.processarDecisaoCompras({
  idRolo: 'ROLO_TESTE',
  statusFinal: 'APROVADO_COMPRAS',
  comprador: 'compras@test',
  observacoes: 'Aprovado com ressalvas',
  tipoDecisao: 'uso_com_ressalvas',
  motivoRessalvas: 'Usar somente em produtos internos',
  voltarEstoque: true
});

assert.strictEqual(comprasResult.status, 'OK');
assert.strictEqual(rolls.ROLO_TESTE.fase_atual, 'em_estoque');
assert.strictEqual(rolls.ROLO_TESTE.disponivel_com_ressalvas, true);
assert.deepStrictEqual(
  transitions.map((item) => item.to),
  ['reprovado_supervisor', 'enviado_compras', 'aprovado_compras', 'em_estoque']
);

console.log('workflow-compras.test.js: fluxo Supervisor -> Compras validado');
}
