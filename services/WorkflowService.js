/*******************************************************************
 * WorkflowService v6 — Núcleo Oficial do Sistema RRT
 *
 * Fluxo atualizado:
 *
 * criado → em_revisao →
 *    ├─ aprovado_revisor → em_estoque
 *    └─ aguardando_supervisor →
 *          ├─ aprovado_supervisor → em_estoque
 *          └─ reprovado_supervisor → enviado_compras →
 *                ├─ aprovado_compras → em_estoque
 *                └─ reprovado_compras → finalizado_reprovado
 *
 * em_estoque → estoque_zerado
 *******************************************************************/

WorkflowService = (function () {
  "use strict";

  /* ============================================================
   * 1) MAPA OFICIAL DE TRANSIÇÕES PERMITIDAS
   * ========================================================== */
  const ALLOWED = {
    "criado": ["em_revisao"],
    "em_revisao": ["aprovado_revisor", "aguardando_supervisor"],
    "aguardando_supervisor": ["aprovado_supervisor", "reprovado_supervisor"],
    "aprovado_revisor": ["em_estoque"],
    "aprovado_supervisor": ["em_estoque"],
    "reprovado_supervisor": ["enviado_compras"],
    "enviado_compras": ["aprovado_compras", "reprovado_compras"],
    "aprovado_compras": ["em_estoque"],
    "reprovado_compras": ["finalizado_reprovado"],
    "em_estoque": ["estoque_zerado"],
    "estoque_zerado": []
  };

  /* ============================================================
   * 2) VALIDADORES
   * ========================================================== */
  function isTransitionAllowed(current, next) {
    const list = ALLOWED[current] || [];
    return list.includes(next);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function auditTransition(doc, from, to, usuario, motivo, override) {
    DatabaseService.audit.add({
      acao: override ? `override_transition: ${from} → ${to}` : `workflow: ${from} → ${to}`,
      usuario: usuario,
      detalhes: {
        rolo_id: doc.id_do_rolo || doc.id || null,
        rolo_nome: doc.nome || null,
        tipo: override ? "override_transition" : "workflow_transition",
        de: from,
        para: to,
        motivo: motivo || null,
        timestamp: nowIso()
      }
    });
  }

  function logTelemetry(id, evento, usuario, extras = {}) {
    DatabaseService.telemetry.add({
      rolo: id,  // Changed from rolo_id to rolo
      evento,
      usuario,
      timestamp: nowIso(),
      ...extras
    });
  }

  function pushHistoryEntry(doc, currentPhase, nextPhase, usuario, notas) {
    const history = Array.isArray(doc.historico_status) ? doc.historico_status : [];

    const entrada = doc.timestamps?.fase_entrada || doc.timestamps?.criado_em;
    const saida = nowIso();

    let duracao = null;
    if (entrada) {
      duracao = Math.floor((new Date(saida) - new Date(entrada)) / 1000);
    }

    const entry = {
      fase: nextPhase,
      timestamp_entrada: saida,
      timestamp_saida: null,
      duracao_segundos: null,
      transicao: { de: currentPhase, para: nextPhase },
      responsavel: usuario,
      evento: "transicao_workflow",
      notas: notas || null
    };

    if (history.length > 0) {
      const last = history[history.length - 1];
      if (!last.timestamp_saida) {
        last.timestamp_saida = saida;
        last.duracao_segundos = duracao;
      }
    }

    return [...history, entry];
  }

  /* ============================================================
   * 3) FUNÇÃO PRINCIPAL (COM LOCK)
   * ========================================================== */
  function transition(id, next_phase, options = {}) {
    if (!id) throw new Error("transition(): id ausente.");
    if (!next_phase) throw new Error("transition(): next_phase ausente.");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      next_phase = String(next_phase).trim().toLowerCase();

      const force = options.force === true;
      const usuario = options.usuario || "sistema";
      const motivo = options.motivo || null;
      const notas = options.notas || null;

      const doc = DatabaseService.rolls.get(id);
      if (!doc) throw new Error(`Rolo ${id} não encontrado.`);

      const current = (doc.fase_atual || "criado").toLowerCase();

      const allowed = isTransitionAllowed(current, next_phase);
      if (!allowed && !force) {
        throw new Error(`Transição inválida: '${current}' → '${next_phase}'.`);
      }

      auditTransition(doc, current, next_phase, usuario, motivo, !allowed && force);
      logTelemetry(id, "transicao_workflow", usuario, { de: current, para: next_phase });

      const historico_status = pushHistoryEntry(doc, current, next_phase, usuario, notas);

      const payload = {
        fase_atual: next_phase,
        historico_status,
        timestamps: {
          criado_em: doc.timestamps?.criado_em || nowIso(),
          atualizado_em: nowIso(),
          fase_entrada: nowIso()
        }
      };

      DatabaseService.rolls.update(id, payload);

      return {
        status: "OK",
        id,
        de: current,
        para: next_phase,
        override_usado: !allowed && force,
        historico_status
      };
    } finally {
      lock.releaseLock();
    }
  }

  /* ============================================================
   * API PÚBLICA
   * ========================================================== */
  return { transition };

})();

globalThis.WorkflowService = WorkflowService;
