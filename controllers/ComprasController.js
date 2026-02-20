/*******************************************************************
 * ComprasController v6 — Workflow Oficial
 *
 * Fluxo Compras:
 *   enviado_compras →
 *       ├─ APROVADO_COMPRAS → em_estoque
 *       └─ REPROVADO_COMPRAS → finalizado_reprovado
 *
 * Compatível com:
 *  - DatabaseService v5
 *  - Histórico estruturado
 *  - Auditoria estruturada
 *******************************************************************/

var ComprasController = (function () {
  "use strict";

  /* ============================================================
      CONSTANTES OFICIAIS DO WORKFLOW
     ============================================================ */

  const VALID_DECISIONS = ["APROVADO_COMPRAS", "REPROVADO_COMPRAS"];

  const NEXT_PHASE = {
    "APROVADO_COMPRAS": "em_estoque",
    "REPROVADO_COMPRAS": "finalizado_reprovado"
  };

  const ALLOWED_FROM = "enviado_compras";

  /* ============================================================
      HELPERS
     ============================================================ */

  function nowIso() {
    return new Date().toISOString();
  }

  function appendHistory(roll, novoEstado, usuario, evento, notas) {
    const last = roll.historico_status?.length
      ? roll.historico_status[roll.historico_status.length - 1]
      : null;

    // encerra a fase anterior se existir
    if (last && !last.timestamp_saida) {
      last.timestamp_saida = nowIso();
      if (last.timestamp_entrada) {
        last.duracao_segundos = Math.floor(
          (new Date(last.timestamp_saida) - new Date(last.timestamp_entrada)) / 1000
        );
      }
    }

    const entry = {
      fase: novoEstado,
      timestamp_entrada: nowIso(),
      timestamp_saida: null,
      duracao_segundos: null,
      responsavel: usuario || "compras",
      evento: evento,
      notas: notas || null
    };

    return [...(roll.historico_status || []), entry];
  }

  function auditLog(data) {
    try {
      DatabaseService.audit.add({
        ...data,
        timestamp: nowIso(),
        source: "ComprasController"
      });
    } catch (e) {
      Logger.log("AuditLog failure: " + e);
    }
  }

  /* ============================================================
      FUNÇÃO PRINCIPAL
     ============================================================ */

  function processarDecisaoCompras(payload) {
    const lock = LockService.getScriptLock();

    try {
      lock.waitLock(5000);

      if (!payload || typeof payload !== "object") {
        throw new Error("Payload inválido.");
      }

      const id = String(payload.idRolo || payload.id_rolo || "").trim();
      const statusFinal = String(payload.statusFinal || "").toUpperCase().trim();
      const comprador = String(payload.comprador || "Compras").trim();
      const observacoes = String(payload.observacoes || "").trim();
      const tipoDecisao = String(payload.tipoDecisao || "").trim();
      const respostaCompras = String(payload.respostaCompras || "").trim();
      const voltarEstoque = payload.voltarEstoque !== false;
      const motivoRessalvas = String(payload.motivoRessalvas || "").trim();
      const force = payload.force === true;
      const motivoForce = payload.motivo_force || null;

      if (!id) throw new Error("ID do rolo ausente.");
      if (!VALID_DECISIONS.includes(statusFinal))
        throw new Error("Status inválido. Use APROVADO_COMPRAS ou REPROVADO_COMPRAS.");

      const roll = DatabaseService.rolls.get(id);
      if (!roll) return error404(id);

      const nextPhase = NEXT_PHASE[statusFinal];

      /* ============================================================
          VALIDAÇÃO DE WORKFLOW (rigorosa)
         ============================================================ */

      const faseAtual = roll.fase_atual;

      if (faseAtual !== ALLOWED_FROM && !force) {
        return {
          status: "IGNORADO",
          code: 409,
          message: `Transição proibida: ${faseAtual} → ${nextPhase}`,
          fase_atual: faseAtual
        };
      }

      /* ============================================================
          OVERRIDE (force: true)
         ============================================================ */

      if (force) {
        auditLog({
          acao: "override_transition",
          de: faseAtual,
          para: nextPhase,
          usuario: comprador,
          motivo: motivoForce || "não informado"
        });
      }

      /* ============================================================
          CRIAR HISTÓRICO
         ============================================================ */

      appendHistory(
        roll,
        nextPhase,
        comprador,
        `Decisão Compras: ${statusFinal}`,
        observacoes || null
      );

      /* ============================================================
          PATCH DO ROLLO
         ============================================================ */

      const transicao = WorkflowService.transition(id, nextPhase, {
        usuario: comprador,
        notas: observacoes || `Decisão Compras: ${statusFinal}`,
        force
      });

      const comprasData = {
        status_rolo: statusFinal,
        status: `COMPRAS — ${statusFinal}`,
        comprador_decisor: comprador,
        observacoes_compras: observacoes || null,
        data_decisao_compras: nowIso(),
        compras_tipo_decisao: tipoDecisao,
        compras_resposta: respostaCompras || observacoes || null,
        compras_responsavel: comprador,
        compras_data_decisao: nowIso(),
        disponivel_com_ressalvas: false,
        motivo_ressalvas: ""
      };

      if (nextPhase === "aprovado_compras" && voltarEstoque) {
        if (tipoDecisao === "uso_com_ressalvas" || motivoRessalvas) {
          comprasData.disponivel_com_ressalvas = true;
          comprasData.motivo_ressalvas = motivoRessalvas || respostaCompras || "Aprovado para uso com ressalvas";
        }
        DatabaseService.rolls.update(id, comprasData);
        WorkflowService.transition(id, "em_estoque", {
          usuario: comprador,
          notas: comprasData.disponivel_com_ressalvas
            ? "Movido para estoque com ressalvas"
            : "Movido para estoque após decisão de compras",
          force
        });
      } else if (nextPhase === "reprovado_compras") {
        DatabaseService.rolls.update(id, comprasData);
        WorkflowService.transition(id, "finalizado_reprovado", {
          usuario: comprador,
          notas: "Reprovado definitivamente pelo setor de compras",
          force
        });
      } else {
        DatabaseService.rolls.update(id, comprasData);
      }

      auditLog({
        acao: "decisao_compras",
        id_rolo: id,
        resultado: statusFinal,
        usuario: comprador
      });

      return {
        status: "OK",
        id: id,
        fase_final: transicao?.para || nextPhase
      };

    } catch (e) {
      Logger.log("Erro ComprasController v6: " + e);
      return {
        status: "ERROR",
        code: 500,
        message: e.message
      };

    } finally {
      try { lock.releaseLock(); } catch (e) {}
    }
  }

  /* ============================================================
      HELPERS DE RETORNO
     ============================================================ */

  function error404(id) {
    return {
      status: "ERROR",
      code: 404,
      message: `Rolo ${id} não encontrado`
    };
  }

  /* ============================================================
      EXPORTAÇÃO PÚBLICA
     ============================================================ */

  return {
    processarDecisaoCompras
  };
})();

/* ============================================================
   WRAPPER GLOBAL (frontend)
   ============================================================ */
function processarDecisaoCompras_Web(payload) {
  const data = payload || {};
  return ComprasController.processarDecisaoCompras({
    id_rolo: data.id_rolo || data.idRolo,
    statusFinal: data.statusFinal || data.decision,
    comprador: data.comprador || data.comprador_nome,
    observacoes: data.observacoes || data.respostaCompras,
    tipoDecisao: data.tipoDecisao,
    respostaCompras: data.respostaCompras,
    voltarEstoque: data.voltarEstoque,
    motivoRessalvas: data.motivoRessalvas
  });
}
