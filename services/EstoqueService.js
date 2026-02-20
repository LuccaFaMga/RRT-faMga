/*******************************************************************
 * RRT_Stock
 * ---------------------------------------------------------------
 * Gerenciamento de estoque baseado no modelo oficial Firestore v6
 *******************************************************************/

var RRTStockService = (function () {
    "use strict";

    const MOVEMENTS_COLLECTION = "movements";

    /* ============================================================
     * CONTEXTO
     * ========================================================== */
    function ctx() {
      // Nota: Session.getActiveUser() só funciona em contextos de WebApp ou Execução Manual. 
      // Em google.script.run, o e-mail deve ser passado do cliente.
      return {
        usuario: Session.getActiveUser().getEmail() || "sistema",
        ts: new Date().toISOString()
      };
    }

    /* ============================================================
     * BUSCAR DOCUMENTO OFICIAL
     * ========================================================== */
    function getRolo(id) {
      const roll = DatabaseService.rolls.get(id);
      if (!roll) throw new Error(`Rolo ${id} não encontrado.`);
      return roll;
    }

    /* ============================================================
     * CONSULTAR SALDO
     * ========================================================== */
    function getCurrentBalance(id) {
      const roll = getRolo(id);
      return Number(roll.saldo_atual || 0);
    }

    /* ============================================================
     * REGISTRAR MOVIMENTO
     * ========================================================== */
    function recordMovement(idRolo, type, qty, reason, location, meta) {
      const { usuario, ts } = ctx();
      const doc = {
        rolo_id: idRolo,
        type, 					 // "IN" ou "OUT"
        qty,
        motivo: reason,
        location,
        meta: meta || {},
        usuario,
        timestamp: ts
      };
      // Assume-se que DatabaseService está disponível globalmente.
      // 🔄 CORREÇÃO: usar API pública existente para telemetria/auditoria
      // DatabaseService.insertDocument pode não estar disponível em tempo de execução
      // dependendo da ordem de carregamento; usar `telemetry.add` garante compatibilidade.
      try {
        DatabaseService.telemetry.add(doc);
      } catch (e) {
        // Fallback para inserir diretamente se API não expuser telemetry
        if (typeof DatabaseService.insertDocument === 'function') {
          DatabaseService.insertDocument(MOVEMENTS_COLLECTION, null, doc);
        } else {
          throw e;
        }
      }
    }

    /* ============================================================
     * AJUSTAR SALDO + GRAVAR MOVIMENTO
     * ========================================================== */
function recordMovementAndAdjust(idRolo, type, qty, reason, location, meta) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // tenta obter lock por até 10s

  try {
    const { usuario, ts } = ctx();
    const roll = getRolo(idRolo);

    // Inicializa saldo atual corretamente
    const atual = roll.saldo_atual != null 
      ? Number(roll.saldo_atual) 
      : Number(roll.metros_maquina || 0);

    const q = Number(qty);
    const novo = type === "IN" ? atual + q : atual - q;

    if (novo < 0) {
      throw new Error(
        `Saldo insuficiente. Atual: ${atual}m, retirada solicitada: ${q}m.`
      );
    }

    // 1) Registrar movimento
    recordMovement(idRolo, type, q, reason, location, meta);

    // 2) Atualizar rolo
    DatabaseService.rolls.update(idRolo, {
      saldo_atual: novo,
      localizacao_atual: location || roll.localizacao_atual,
      "timestamps.atualizado_em": ts
    });

    // 3) Auditoria
    DatabaseService.audit.add({
      acao: type === "IN" ? "entrada_estoque" : "saida_estoque",
      rolo_id: idRolo,
      qty: q,
      saldo_anterior: atual,
      saldo_novo: novo,
      motivo: reason,
      usuario,
      timestamp: ts
    });

    // 4) Workflow → estoque_zerado
    if (novo <= 0) {
      WorkflowService.transition(idRolo, "estoque_zerado", {
        usuario,
        notas: "Saldo chegou a zero automaticamente"
      });
    }

    return { saldo_anterior: atual, saldo_novo: novo };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Entrada de estoque
 */
function recordIn(idRolo, qty, reason, location, meta) {
  return recordMovementAndAdjust(
    idRolo,
    "IN",
    qty,
    reason || "Entrada de estoque",
    location,
    meta
  );
}

/**
 * Saída simples de estoque
 */
function recordOut(idRolo, qty, reason, location, meta) {
  return recordMovementAndAdjust(
    idRolo,
    "OUT",
    qty,
    reason || "Saída de estoque",
    location,
    meta
  );
}

/**
 * Retirada usada pelo WebApp (corte / amostra / perda)
 */
function processWithdrawal(payload) {
  if (!payload || !payload.id_do_rolo) {
    throw new Error("Payload inválido para retirada.");
  }

  const result = recordMovementAndAdjust(
    payload.id_do_rolo,
    "OUT",
    payload.qty,
    payload.reason,
    payload.location,
    payload.meta
  );

  return {
    status: "SUCESSO",
    novoSaldo: result.saldo_novo
  };
}

/**
 * Histórico de movimentações do rolo
 */
function getMovements(idRolo) {
  return DatabaseService.query(MOVEMENTS_COLLECTION, {
    where: { rolo_id: idRolo },
    orderBy: { field: "timestamp", direction: "desc" }
  });
}

    /* EXPORT */
    return {
      getCurrentBalance,
      recordIn,
      recordOut,
      processWithdrawal,
      getMovements
    };

})();

globalThis.RRTStockService = RRTStockService;
// ✅ CORREÇÃO: Criação do alias APÓS a definição do módulo funcional
var RRTDataService = RRTStockService;