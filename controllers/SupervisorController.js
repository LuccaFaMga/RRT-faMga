/*******************************************************************
 * SupervisorController v6 — compatível com WorkflowService v6
 * COM TRACKING DE FLUXO E E-MAIL
 *
 * Regras oficiais:
 * - Supervisor recebe apenas rolos em "aguardando_supervisor"
 * - Decisão = APROVADO → fase: aprovado_supervisor → em_estoque
 * - Decisão = REPROVADO → fase: reprovado_supervisor → enviado_compras
 * - Transições validadas por WorkflowService.transition()
 * - Suporte a override backend { force: true }
 * - Audit automático é feito pelo WorkflowService
 *******************************************************************/

var SupervisorController = (function () {
  "use strict";

  /* ============================================================
   * TRACKING DE FLUXO (NÃO BLOQUEANTE)
   * ========================================================== */
  function _track(id, event, payload) {
    try {
      if (typeof trackFlow === "function") {
        trackFlow(id, event, payload);
      } else if (typeof DatabaseService !== "undefined" && DatabaseService.rolls?.appendEvent) {
        DatabaseService.rolls.appendEvent(id, event, payload);
      } else {
        Logger.log(`[FLOW][FALLBACK] ${id} | ${event} | ${JSON.stringify(payload || {})}`);
      }
    } catch (e) {
      Logger.log(`[FLOW][ERROR] ${id} | ${event} | ${e.message}`);
    }
  }

  /* ============================================================
   * UTIL
   * ========================================================== */
  function normalizeDecision(raw) {
    if (!raw) return null;
    raw = String(raw).trim().toUpperCase();
    if (raw === "APROVAR" || raw === "APROVADO" || raw === "OK") return "aprovado_supervisor";
    if (raw === "REPROVAR" || raw === "REPROVADO" || raw === "NOK") return "reprovado_supervisor";
    return null;
  }

  function _getDb() {
    return (typeof RRTServices !== "undefined" && RRTServices.DatabaseService)
      ? RRTServices.DatabaseService
      : (typeof DatabaseService !== "undefined" ? DatabaseService : null);
  }

  function _getWorkflow() {
    return (typeof RRTServices !== "undefined" && RRTServices.WorkflowService)
      ? RRTServices.WorkflowService
      : (typeof WorkflowService !== "undefined" ? WorkflowService : null);
  }

  function _getStockService() {
    return (typeof RRTServices !== "undefined" && RRTServices.RRTStockService)
      ? RRTServices.RRTStockService
      : (typeof RRTStockService !== "undefined" ? RRTStockService : null);
  }

  function _getRepository() {
    const db = _getDb();
    if (db && db.rolls && db.rolls.update) {
      return {
        update: (id, payload) => db.rolls.update(id, payload),
        get: (id) => db.rolls.get(id)
      };
    }
    return null;
  }

  function getRolo(id) {
    const db = _getDb();
    if (!db || !db.rolls || typeof db.rolls.get !== "function") {
      throw new Error("DatabaseService.rolls não disponível.");
    }

    Utilities.sleep(200);

    let attempts = 0;
    let doc = null;
    while (attempts < 3) {
      try {
        doc = db.rolls.get(id);
      } catch (e) {
        Logger.log(`[Supervisor][getRolo] erro DB (${attempts + 1}): ${e.message}`);
      }
      if (doc) return doc;
      Utilities.sleep(200 * (attempts + 1));
      attempts++;
    }

    throw new Error(`Rolo ${id} não encontrado.`);
  }

  /* ============================================================
   * FUNÇÃO PRINCIPAL
   * ========================================================== */
  function processDecision(payload) {
    const lock = LockService.getScriptLock();

    try {
      lock.waitLock(5000);

      if (!payload || typeof payload !== "object") {
        throw new Error("Payload inválido.");
      }

      const id = String(payload.id_rolo || payload.idRolo || payload.id || "").trim();
      if (!id) throw new Error("ID do rolo ausente.");

      const usuario = payload.supervisorName || payload.usuario || "supervisor";
      const nextPhase = normalizeDecision(payload.decision || payload.decisao);

      if (!nextPhase) {
        throw new Error("Decisão inválida. Use APROVADO ou REPROVADO.");
      }

      _track(id, "SUPERVISOR_DECISION_RECEIVED", {
        decision: payload.decision || payload.decisao,
        usuario
      });

      const rolo = getRolo(id);

      if (rolo.fase_atual !== "aguardando_supervisor") {
        return {
          status: "IGNORADO",
          id,
          fase_atual: rolo.fase_atual,
          message: "Rolo fora da fase do supervisor."
        };
      }

      const workflow = _getWorkflow();
      const stockService = _getStockService();
      const repo = _getRepository();

      let result;

      try {
        _track(id, "WORKFLOW_TRANSITION_ATTEMPT", {
          from: rolo.fase_atual,
          to: nextPhase
        });

        result = workflow.transition(id, nextPhase, {
          usuario,
          notas: payload.observacoes || null,
          force: payload.force === true
        });

        _track(id, "WORKFLOW_TRANSITION_SUCCESS", {
          para: result?.para,
          override: result?.override_usado || false
        });

        if (result?.para === "aprovado_supervisor") {
          result = workflow.transition(id, "em_estoque", { usuario });
        }

        if (result?.para === "reprovado_supervisor") {
          result = workflow.transition(id, "enviado_compras", { usuario });
        }

      } catch (e) {
        _track(id, "WORKFLOW_TRANSITION_FAILED", { error: e.message });

        if (nextPhase === "aprovado_supervisor") {
          _track(id, "WORKFLOW_FALLBACK_STOCK", { usuario });
          const metros = Number(rolo.medidas?.metragem_final || rolo.metros_maquina || 0);
          const local = rolo.localizacao_atual || "ESTOQUE";
          stockService.recordIn(id, metros, "Fallback supervisor", local, { usuario });
          result = workflow.transition(id, "em_estoque", {
            usuario,
            notas: "Fallback supervisor",
            force: true
          });
        }

        if (nextPhase === "reprovado_supervisor") {
          _track(id, "WORKFLOW_FALLBACK_COMPRAS", { usuario });
          result = workflow.transition(id, "enviado_compras", {
            usuario,
            notas: "Fallback supervisor",
            force: true
          });
        }
      }

      const roloAtualizado = getRolo(id);
      const faseFinal = result?.para;

      try {
        _track(id, "EMAIL_SHOULD_SEND", { faseFinal });

        if (faseFinal === "em_estoque" && typeof sendSupervisorApprovalEmail === "function") {
          _track(id, "EMAIL_ESTOQUE_ATTEMPT");
          if (!roloAtualizado?.responsavel?.email && !roloAtualizado?.supervisor_email) {
            _track(id, "EMAIL_ABORT_NO_RECIPIENT", {
              responsavel: roloAtualizado?.responsavel,
              supervisor_email: roloAtualizado?.supervisor_email
            });
          } else {
            sendSupervisorApprovalEmail(roloAtualizado);
            _track(id, "EMAIL_ESTOQUE_SENT");
          }
        }

        if (faseFinal === "enviado_compras" && typeof sendComprasEmail === "function") {
          _track(id, "EMAIL_COMPRAS_ATTEMPT");
          const linkAcompanhamento =
            (typeof CONFIG !== 'undefined' && CONFIG.URL?.GARANTIA_APP)
              ? `${CONFIG.URL.GARANTIA_APP}?action=garantia&idRolo=${encodeURIComponent(id)}`
              : null;

          const emailOk = sendComprasEmail(roloAtualizado, null, linkAcompanhamento);
          _track(id, emailOk ? "EMAIL_COMPRAS_SENT" : "EMAIL_COMPRAS_FAILED");
        }

        if (
          (faseFinal === "em_estoque" && typeof sendSupervisorApprovalEmail !== "function") ||
          (faseFinal === "enviado_compras" && typeof sendComprasEmail !== "function")
        ) {
          _track(id, "EMAIL_FUNCTION_MISSING", { faseFinal });
        }

      } catch (mailErr) {
        _track(id, "EMAIL_FAILED", { error: mailErr.message });
      }

      return {
        status: "SUCESSO",
        id,
        fase_atual: faseFinal,
        override_usado: result?.override_usado || false
      };

    } catch (e) {
      Logger.log("Supervisor ERROR: " + (e.stack || e.message));
      return { status: "FALHA", message: e.message };
    } finally {
      try { lock.releaseLock(); } catch (e) {}
    }
  }

  /* ============================================================
   * EXPORT
   * ========================================================== */
  return {
    processSupervisorDecision: processDecision
  };

})();

/* ============================================================
 * WRAPPER GLOBAL (WebApp)
 * ========================================================== */
function process_supervisor_decision(payload) {
  return SupervisorController.processSupervisorDecision(payload);
}

globalThis.SupervisorController = SupervisorController;
