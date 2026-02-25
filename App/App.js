/*******************************************************************
 * MainApp.gs v2.5 - FULL SYNC COM DatabaseService v9.2
 *
 *******************************************************************/
/* ============================================================
 *   ⚙️ CONFIG & GLOBAL HELPERS
 * ============================================================ */
function getConfigSafe() {
    const CACHE = CacheService.getScriptCache();
    const c = CACHE.get("CONFIG_CACHE_V2");
    if (c) return JSON.parse(c);
    const cfg = (typeof CONFIG !== "undefined") ? CONFIG : {};
    CACHE.put("CONFIG_CACHE_V2", JSON.stringify(cfg), 600);
    return cfg;
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function _hmac(data) {
    const key = getConfigSafe().SECRET_KEY || "DEFAULT_RRT_KEY";
    const signature = Utilities.computeHmacSha256Signature(data, key);
    return Utilities.base64EncodeWebSafe(signature);
}

function buildSupervisorApprovalLink(idRolo, decision, expiresMinutes) {
    const base = ScriptApp.getService().getUrl();
    const exp = Date.now() + (expiresMinutes || 15) * 60000;
    const payload = JSON.stringify({ id: idRolo, decision, exp });
    const signature = _hmac(payload);
    return `${base}?page=supervisor&action=decide&data=${encodeURIComponent(payload)}&sig=${encodeURIComponent(signature)}`;
}

// ✅ REMOVED: normalizeKeysToSnakeCase() — Use KeyNormalizer.normalizeKeysToSnakeCase() instead
// The complete recursive version is in core/KeyNormalizer.js

function sanitizeFilename(name) {
    return String(name || "").replace(/[^\w.\-]+/g, "_").substring(0, 80);
}

function ensureNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const num = Number(String(value).replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

const BACKEND_DEBUG = false;

function appLog(message, force) {
  if (force || BACKEND_DEBUG) Logger.log(message);
}

// Helper de logs de fluxo (isolado, pequeno)
function logFlowMain(id, etapa, obj) {
    try {
        const idPart = id ? String(id) : '->';
        Logger.log("[FLOW][MAIN] " + idPart + " | " + String(etapa) + " | " + JSON.stringify(obj));
    } catch (e) {
        Logger.log("[FLOW][MAIN] -> | LOG_ERROR | " + e.message);
    }
}

/* ============================================================
 *   🧭 WEB APP ROUTER: doGet(e) — COM LOGS DETALHADOS (FIXED)
 * ============================================================ */
function doGet(e) {
    const traceId = Utilities.getUuid().slice(0, 8); // ID curto p/ rastrear requisição
    Logger.log(`[DOGET][${traceId}] START`);

    try {
        Logger.log(`[DOGET][${traceId}] RAW EVENT: ${JSON.stringify(e)}`);

        const p = e && e.parameter ? e.parameter : {};
        Logger.log(`[DOGET][${traceId}] PARAMS: ${JSON.stringify(p)}`);

        const page = p.page || "index";
        Logger.log(`[DOGET][${traceId}] PAGE RESOLVED: "${page}"`);

        const appUrl = ScriptApp.getService().getUrl(); // 🔑 FUNDAMENTAL

        let template;

        switch (page) {

            case "index":
                Logger.log(`[DOGET][${traceId}] ROUTE → index`);
                template = HtmlService.createTemplateFromFile("ui/index");
                break;

            case "supervisor":
                Logger.log(`[DOGET][${traceId}] ROUTE → supervisor`);
                template = handleSupervisorPage(p);
                break;

            case "estoque":
                Logger.log(`[DOGET][${traceId}] ROUTE → estoque`);
                template = handleEstoquePage(p);
                break;

            case "compras":
                Logger.log(`[DOGET][${traceId}] ROUTE → compras`);
                template = handleComprasPage(p);
                break;

            case "export":
                Logger.log(`[DOGET][${traceId}] ROUTE → export`);
                return handlePowerBIExport(p);

            case "reviewer":
                Logger.log(`[DOGET][${traceId}] ROUTE → reviewer`);
                template = handleReviewerPage(p);
                break;

            default:
                Logger.log(`[DOGET][${traceId}] ROUTE → default (reviewer)`);
                template = handleReviewerPage(p);
        }

        if (!template) {
            throw new Error(`Template não definido para page="${page}"`);
        }

        // Se o retorno já é um HtmlOutput (não precisa de evaluate), retorna direto
        if (template.getContent) {
            Logger.log(`[DOGET][${traceId}] HtmlOutput detectado → retorno direto`);
            return template.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }

        // 🔑 INJEÇÃO OBRIGATÓRIA DA URL BASE (apenas para templates)
        template.APP_URL = appUrl;

        Logger.log(`[DOGET][${traceId}] TEMPLATE OK → evaluate()`);

        const output = template.evaluate()
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
            .setTitle(`RRT - ${page.charAt(0).toUpperCase() + page.slice(1)}`);

        Logger.log(`[DOGET][${traceId}] END OK`);
        return output;

    } catch (err) {
        Logger.log(`[DOGET][${traceId}] ❌ ERROR: ${err.message}`);
        Logger.log(err.stack);

        return HtmlService.createHtmlOutput(`
            <h3>Erro crítico no carregamento</h3>
            <p><strong>${err.message}</strong></p>
            <pre style="white-space:pre-wrap">${err.stack || ""}</pre>
        `);
    }
}

/* ============================================================
 *   ⚡️ HTTP POST HANDLER: doPost(e)
 * ============================================================ */
function doPost(e) {
    let response;

    try {
        const payload = JSON.parse(e.postData.contents);
        const action = payload.action || "processar_revisao";

        try { logFlowMain(payload.id_do_rolo || payload.id || '-', 'DOPOST_START', { action: action, payload: payload }); } catch (e) { }

        switch (action) {
            case "processar_revisao": response = processarRRT_Web(payload); break;
            case "supervisor_update": response = handleSupervisorUpdate(payload); break;
            case "supervisor_decision": response = handleSupervisorDecision(payload); break;
            
            // Ações dos Controllers existentes
            case "handleWithdrawal": response = handleWithdrawal(payload); break;
            case "getRollsByStatus": response = getRollsByStatus_Web(payload); break;
            case "processSupervisorDecision": response = processSupervisorDecision_Web(payload); break;
            case "generateRevisionPDF": response = generateRevisionPDF_Web(payload.idRolo); break;
            case "processarDecisaoCompras": response = processarDecisaoComprasV2_Web(payload); break;

            case "stock_create":
            case "stock_update":
            case "stock_delete":
                response = handleStockAction(payload); break;

            case "initialize_roll":
                response = initializeRollAndGetId(payload.revisorNome, payload.qrData || null); break;

            case "upload_photo":
                response = uploadDefectPhoto(payload); break;

            default:
                throw new Error(`Ação desconhecida: ${action}`);
        }
    } catch (err) {
        response = { status: "FALHA", message: err.message };
    }

    return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
 *   PAGE HANDLERS (doGet) — Versão Corrigida
 * ============================================================ */
function handleSupervisorPage(params) {
    const template = HtmlService.createTemplateFromFile("supervisor");

    template.error = null;
    template.idRolo = "";
    template.prefillDecision = "";
    template.rollData = null; 
    template.SUPERVISOR_NOME = params.user || Session.getActiveUser().getEmail(); 

    if (params.action === "decide") {
        try {
            const decoded = JSON.parse(decodeURIComponent(params.data));
            const expected = _hmac(JSON.stringify(decoded));
            if (expected !== params.sig) throw new Error("Assinatura inválida.");
            if (Date.now() > decoded.exp) throw new Error("Link expirado.");
            const roll = DatabaseService.rolls.get(decoded.id);
            template.idRolo = decoded.id; 
            template.prefillDecision = decoded.decision;
            template.rollData = roll;
        } catch (err) {
            template.error = err.message;
        }
    } else if (params.id) {
        template.idRolo = params.id;
        template.rollData = DatabaseService.rolls.get(params.id);
    }

    if (template.rollData) {
        template.statusSupervisor = template.rollData.status_supervisor?.toString().trim().toUpperCase() || '';
        template.statusDoRolo     = template.rollData.fase_atual || template.rollData.status_do_rolo || '';
    } else {
        template.statusSupervisor = '';
        template.statusDoRolo = '';
    }

    return template;
}

function handleEstoquePage(params) {
    // Como estoque.html não usa variáveis do servidor (<?= ?>), 
    // usamos createHtmlOutputFromFile para evitar processamento de template
    const output = HtmlService.createHtmlOutputFromFile("ui/estoque");
    output.setTitle("FA-RRT | Controle de Estoque");
    return output;
}

function handleReviewerPage(params) {
    const template = HtmlService.createTemplateFromFile("ui/reviewer");
    template.idRolo = params.idRolo || "";
    return template;
}

function handleComprasPage(params) {
    if (!params.id) throw new Error("ID obrigatório.");
    const roll = DatabaseService.rolls.get(params.id);
    if (!roll) throw new Error(`Rolo ${params.id} não encontrado ou acesso negado.`);
    const template = HtmlService.createTemplateFromFile("compras");
    template.idRolo = params.id;
    template.COMPRADOR_NOME = Session.getActiveUser().getEmail();
    template.roll = roll;
    template.statusSupervisor = roll.status_supervisor || '';
    template.defeitosEncontrados = roll.defeitos?.length || 0;
    template.localizador = roll.localizacao || '';
    return template;
}

/* ============================================================
 *   SUPERVISOR ACTIONS
 * ============================================================ */
function handleSupervisorUpdate(payload) {
    const { id, updates, user } = payload;
    for (const [key, value] of Object.entries(updates)) {
        switch (key) {
            case "fase_atual":
                try { logFlowMain(id, 'WORKFLOW_TRANSITION_BEFORE', { to: value, user: user }); } catch (e) { }
                WorkflowService.transition(id, value, { usuario: user });
                try { logFlowMain(id, 'WORKFLOW_TRANSITION_AFTER', { to: value }); } catch (e) { }
                break;
            case "localizacao_atual": DatabaseService.rolls.updateLocation(id, value); break;
            case "notas_fiscais": DatabaseService.rolls.updateFiscalNotes(id, value); break;
            case "fotos": DatabaseService.rolls.addPhotos(id, value); break;
            default: DatabaseService.rolls.update(id, { [key]: value }); break;
        }
    }
    return { status: "SUCESSO", message: `Rolo ${id} atualizado.` };
}

function handleSupervisorDecision(payload) {
    const { id, decision, user, observacoes } = payload;
    try { logFlowMain(id, 'SUPERVISOR_DECISION_START', payload); } catch (e) { }
    const next = decision === "APROVADO" ? "aprovado_supervisor" : "reprovado_supervisor";
    try { logFlowMain(id, 'WORKFLOW_TRANSITION_BEFORE', { to: next }); } catch (e) { }
    const wf = WorkflowService.transition(id, next, { usuario: user, notas: observacoes || "" });
    try { logFlowMain(id, 'WORKFLOW_TRANSITION_AFTER', wf); } catch (e) { }
    return { status: "SUCESSO", id, fase_atual: wf.para };
}

/* ============================================================
 *   STOCK ACTIONS
 * ============================================================ */
function handleStockAction(payload) {
    const { action, id, data } = payload;
  if (action === "stock_update") {
    if (data && (data.fase_atual || data.FASE_ATUAL)) {
      const nextPhase = data.fase_atual || data.FASE_ATUAL;
      WorkflowService.transition(id, nextPhase, {
        usuario: Session.getActiveUser().getEmail()
      });
      delete data.fase_atual;
      delete data.FASE_ATUAL;
    }
    return DatabaseService.rolls.update(id, data);
  }
    if (action === "stock_delete") return DatabaseService.rolls.delete(id);
    throw new Error(`Ação desconhecida: ${action}`);
}

function registrarSolicitacaoCorte_Web(payload) {
  try {
    const id = String(payload?.id || '').trim();
    const opSolicitada = String(payload?.op_solicitada || '').trim();
    const quantidadeSolicitada = Number(payload?.quantidade_solicitada || 0);
    const dataCorte = String(payload?.data_corte || '').trim();

    if (!id) throw new Error('ID do tecido é obrigatório');
    if (!opSolicitada) throw new Error('OP solicitada é obrigatória');
    if (!quantidadeSolicitada || isNaN(quantidadeSolicitada) || quantidadeSolicitada <= 0) {
      throw new Error('Quantidade solicitada inválida');
    }
    if (!dataCorte) throw new Error('Data de corte é obrigatória');

    const rolo = DatabaseService.rolls.get(id);
    if (!rolo) throw new Error('Tecido não encontrado em estoque');

    const produtoId =
      rolo.PRODUTO_ID ||
      rolo.produto_id ||
      rolo.PRODUCT_ID ||
      rolo.product_id ||
      rolo.ID_ROLO ||
      rolo.id_do_rolo ||
      '';

    const fornecedor =
      rolo.FORNECEDOR ||
      rolo.fornecedor ||
      rolo.fornecedor_nome ||
      rolo.supplier_nm ||
      rolo.supplier_name ||
      '';

    const usuario = Session.getActiveUser().getEmail() || 'sistema';

    const detalhes = {
      id: id,
      produto_id: String(produtoId || '').trim(),
      fornecedor: String(fornecedor || '').trim(),
      op_solicitada: opSolicitada,
      quantidade_solicitada: quantidadeSolicitada,
      data_corte: dataCorte
    };

    DatabaseService.audit.add({
      acao: 'corte_tecido_solicitado',
      usuario: usuario,
      detalhes: detalhes
    });

    return {
      status: 'SUCESSO',
      id,
      op_solicitada: opSolicitada,
      quantidade_solicitada: quantidadeSolicitada,
      data_corte: dataCorte
    };
  } catch (error) {
    Logger.log('[APP] ❌ Erro em registrarSolicitacaoCorte_Web: ' + error.message);
    return { status: 'ERRO', message: error.message };
  }
}

function parseDateOnly_(value, endOfDay) {
  const str = String(value || '').trim();
  if (!str) return null;

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str + (endOfDay ? 'T23:59:59' : 'T00:00:00'));
    return isNaN(d.getTime()) ? null : d;
  }

  // dd/mm/yyyy
  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  if (endOfDay) parsed.setHours(23, 59, 59, 999); else parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function getSolicitacoesCorte_Web(filtersOrLimit) {
  try {
    const params = (filtersOrLimit && typeof filtersOrLimit === 'object')
      ? filtersOrLimit
      : { limit: filtersOrLimit };

    const max = Math.max(1, Math.min(Number(params.limit || 50), 200));
    const opFiltro = String(params.op || '').trim().toLowerCase();
    const dataInicio = parseDateOnly_(params.data_inicio, false);
    const dataFim = parseDateOnly_(params.data_fim, true);

    const logs = DatabaseService.databaseQuery({
      collection: 'AUDIT',
      where: [{ field: 'acao', op: '==', value: 'corte_tecido_solicitado' }],
      orderBy: [{ field: 'timestamp', direction: 'desc' }],
      limit: max
    });

    const result = (Array.isArray(logs) ? logs : []).map((row) => {
      const detalhesRaw = row.detalhes || row.DETALHES || {};
      let detalhes = {};
      if (typeof detalhesRaw === 'string') {
        try {
          detalhes = JSON.parse(detalhesRaw);
        } catch (e) {
          detalhes = {};
        }
      } else if (detalhesRaw && typeof detalhesRaw === 'object') {
        detalhes = detalhesRaw;
      }

      return {
        id: String(detalhes.id || detalhes.id_rolo || '').trim(),
        produto_id: String(detalhes.produto_id || '').trim(),
        fornecedor: String(detalhes.fornecedor || '').trim(),
        op_solicitada: String(detalhes.op_solicitada || '').trim(),
        quantidade_solicitada: Number(detalhes.quantidade_solicitada || 0),
        data_corte: String(detalhes.data_corte || '').trim(),
        usuario: String(row.usuario || row.USUARIO || '').trim(),
        timestamp: String(row.timestamp || row.TIMESTAMP || '').trim()
      };
    });

    const filtered = result.filter((item) => {
      if (opFiltro) {
        const opValue = String(item.op_solicitada || '').toLowerCase();
        if (opValue.indexOf(opFiltro) === -1) return false;
      }

      if (dataInicio || dataFim) {
        const corteDate = parseDateOnly_(item.data_corte, false);
        if (!corteDate) return false;
        if (dataInicio && corteDate < dataInicio) return false;
        if (dataFim && corteDate > dataFim) return false;
      }

      return true;
    });

    return filtered;
  } catch (error) {
    Logger.log('[APP] ❌ Erro em getSolicitacoesCorte_Web: ' + error.message);
    return [];
  }
}

/* ============================================================
 *   📸 UPLOAD DE FOTOS
 * ============================================================ */
function uploadDefectPhoto(payload) {
    try {
        const p = normalizeKeysToSnakeCase(payload);
        const id = p.id_rolo;
        let base64 = p.foto_base64 || p.data_url;
        if (!id || !base64) throw new Error("ID do rolo e foto são obrigatórios.");
        let mime = "image/jpeg";
        if (String(base64).startsWith("data:")) {
            const match = base64.match(/^data:(image\/[^;]+);base64,(.*)$/);
            if (!match) throw new Error("Formato de imagem inválido.");
            mime = match[1];
            base64 = match[2];
        }
        const ext = mime.includes("png") ? ".png" : ".jpg";
        const filename = sanitizeFilename(`${p.nome_defeito || "defeito"}_${Date.now()}${ext}`);
        const bytes = Utilities.base64Decode(base64);
        const blob = Utilities.newBlob(bytes, mime, filename);
        const folder = getOrCreateRollFolder(id).fotos;
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        return { status: "SUCESSO", file_id: file.getId(), file_url: file.getDownloadUrl(), filename: file.getName() };
    } catch (err) {
        Logger.log(`[UPLOAD FOTO] ${err.message}`);
        return { status: "FALHA", message: err.message };
    }
}

/* ============================================================
 * 🧮 PROCESSAMENTO DO REVISOR — WORKFLOW v7 (DESACOPLADO)
 * ============================================================ */
function processarRRT_Web(rawMainData) {
  const idRolo = String(rawMainData?.id_do_rolo || "").trim();
  if (!idRolo) throw new Error("ID do rolo ausente.");

  try {
    logFlowMain?.(idRolo, "PROCESSAR_START", rawMainData);

    const ts = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
    const previous = DatabaseService.rolls.get(idRolo) || {};

    const mainData = normalizeMainData(rawMainData, previous, ts);
    const scoreInfo = calculateScoreAndDecision(mainData);
    const revisionId = resolveRevisionId(idRolo, mainData);

    // Monta registros
    const roloRecord = buildRoloRecord(idRolo, revisionId, mainData, scoreInfo, ts);
    const defects = buildDefectsRecords(mainData, revisionId, ts);
    const photos = buildPhotosRecords(mainData, defects, revisionId, ts);

    const structuredPayload = buildStructuredPayload(roloRecord, defects, photos);
    const insertResult = persistStructuredData(structuredPayload);

    // ================================
    // ✅ WORKFLOW OFICIAL
    // ================================
    // status_rolo do form: aprovado_revisor | em_analise
    // workflow aceita: aprovado_revisor | aguardando_supervisor (em_analise -> aguardando_supervisor)
    const statusForm = String(mainData.status_rolo || "").trim().toLowerCase();
    let nextPhase = scoreInfo?.nextPhase ? String(scoreInfo.nextPhase).trim().toLowerCase() : "";

    // fallback por status do form
    if (!nextPhase) {
      nextPhase = (statusForm === "aprovado_revisor") ? "aprovado_revisor" : "aguardando_supervisor";
    }

    // Se veio "em_analise", mapeia para o termo oficial do workflow
    if (nextPhase === "em_analise") nextPhase = "aguardando_supervisor";

    const usuario = mainData.revisor_nome || mainData.revisor || "sistema";
    const notas = mainData.observacoes || null;

    if (!previous.fase_atual) {
      try {
        WorkflowService.transition(idRolo, "em_revisao", {
          usuario,
          notas: "Inicio da revisao"
        });
      } catch (initErr) {
        Logger.log(`[WORKFLOW] ⚠️ Falha ao iniciar em_revisao (${idRolo}): ${initErr.message}`);
      }
    }

    // Executa a transição (preenche FASE_ATUAL, HISTORICO_STATUS, TIMESTAMPS)
    let wfResult = null;
    try {
      wfResult = WorkflowService.transition(idRolo, nextPhase, {
        usuario,
        motivo: scoreInfo?.motivo || null,
        notas
      });
    } catch (wfErr) {
      // Se a transição falhar, grava erro na linha mas mantém a persistência dos dados técnicos
      Logger.log(`[WORKFLOW] ❌ Falha na transição (${idRolo}): ${wfErr.message}`);
      try {
        DatabaseService.rolls.update(idRolo, { erro_workflow: wfErr.message });
      } catch (_) {}
    }

    return {
      status: "SUCESSO",
      id: idRolo,
      revision_id: revisionId,
      next_phase_aplicada: wfResult?.para || null,
      next_phase_suggestion: scoreInfo?.nextPhase || null,
      inserted_count: insertResult.inserted_rows
    };

  } catch (e) {
    Logger.log("[PROCESSAR RRT] ❌ ERRO: " + e.message);
    try {
      WorkflowService.transition(idRolo, "erro_processamento", { force: true, usuario: "sistema", motivo: e.message });
    } catch (_) {}
    return { status: "FALHA", message: e.message };
  }
}

/**
 * 🔄 CANONIZAÇÃO NÍVEL 3: normalizeMainData()
 * ================================================
 * Converte dados formulário para campos canônicos com fallbacks.
 * Pipeline:
 * 1) normalizeKeysToSnakeCase() - camelCase → snake_case
 * 2) mapMetersAndWidth() - converte unidades (wid, len)
 * 3) Resolve metros_revisado com fallback para metros_fornecedor
 * 4) Timestamps com história (criado_em, atualizado_em)
 * 5) Arrays (defeitos, fotos) normalizadas
 * 
 * Resultado: {metros_revisado, tipo_tecido, timestamps, defeitos[], fotos[]}
 */
function normalizeMainData(raw, previous, ts) {
  const data = normalizeKeysToSnakeCase(raw);

  // wid -> metros fornecedor; len -> largura (pode vir em m)
  mapMetersAndWidth(data);

  // ✅ metros revisado: usa valor real informado; fallback para metros_fornecedor
  // IMPORTANTE: se revised_meters ou metros_revisado vem com valor 0, precisa usar fallback
  let mr = Number(data.revised_meters || data.metros_revisado || 0);
  
  // Se vieram zerados, tenta fallback
  if (!mr || mr === 0) {
    mr = Number(data.metros_fornecedor || data.wid || 0);
  }

  data.metros_revisado = mr;
  data.revised_meters = mr;

  // ✅ timestamps (mantém criado_em se já existir)
  data.timestamps = {
    criado_em: previous.timestamps?.criado_em || ts,
    atualizado_em: ts,
    fase_entrada: previous.timestamps?.fase_entrada || ts
  };

  // ✅ arrays
  data.defeitos = Array.isArray(data.defeitos)
    ? data.defeitos
    : Array.isArray(data.defects) ? data.defects : [];

  data.fotos = Array.isArray(data.fotos)
    ? data.fotos
    : Array.isArray(data.photos) ? data.photos : [];

  return data;
}


function mapMetersAndWidth(data) {
  // wid → metros fornecedor
  data.metros_fornecedor = Number(
    data.wid || data.meters_supplier || data.metros_fornecedor || 0
  );

  // len → largura (se vier em metros, converte para cm)
  let w = Number(data.len || data.width || data.largura_cm || 0);

  // Heurística simples: se for < 10, provavelmente está em METROS (ex.: 1.55)
  if (w > 0 && w < 10) w = w * 100;

  data.largura_cm = w;
}


function calculateScoreAndDecision(mainData) {
  const score = RRTServices.RRT.calcularPontuacao(mainData);

  const decisao = String(
    mainData.decisao_revisor || mainData.status_rolo || ""
  ).toLowerCase();

  let nextPhase;
  let motivo;

  if (decisao === "aprovado" || decisao === "aprovado_revisor") {
    if (score.pontosPor100m2 < 35) {
      nextPhase = "em_estoque";
      motivo = "Aprovação automática — pontuação < 35";
    } else {
      nextPhase = "aguardando_supervisor";
      motivo = "Pontuação ≥ 35";
    }
  } else {
    nextPhase = "aguardando_supervisor";
    motivo = "Decisão do revisor";
  }

  return {
    pontosPor100m2: score.pontosPor100m2,
    statusQualidadePontos: score.statusQualidadePontos,
    nextPhase,
    motivo
  };
}

function resolveRevisionId(idRolo, mainData) {
  // Prioridade 1: Se já tem revision_id, usa
  if (mainData.revision_id) return mainData.revision_id;
  
  try {
    // Prioridade 2: Usar novo schema (DatabaseService v9.2)
    // Passa OBJETO com supplier_id e product_id para gerar [S]-[P]-[T]
    const revisionPayload = {
      supplier_id: mainData.supplier_id || mainData.fornecedor_id || String(idRolo).substring(0, 6),
      product_id: mainData.product_id || mainData.produto_id || idRolo
    };
    
    // Verifica se DatabaseService tem método novo
    if (DatabaseService?.generateShortRevisionId) {
      return DatabaseService.generateShortRevisionId(revisionPayload);
    } else {
      // Fallback: Se função não existir, gera manualmente
      return revisionPayload.supplier_id + "-" + revisionPayload.product_id + "-" + Date.now().toString().slice(-5);
    }
  } catch (e) {
    Logger.log("[resolveRevisionId] ⚠️ Erro ao gerar: " + e.message);
    // Fallback final
    return idRolo + "-" + Date.now().toString().slice(-6);
  }
}


function buildRoloRecord(idRolo, revisionId, data, score, ts) {
  return {
    roll_id: idRolo,
    review_id: revisionId,
    revisor: data.revisor_nome || data.revisor || "",
    fornecedor: data.supplier_nm || data.fornecedor || "",
    nf: data.nf || data.nota_fiscal || "",
    metros_fornecedor: data.metros_fornecedor,
    metros_revisado: data.metros_revisado,
    largura_cm: data.largura_cm,
    data_revisao: ts,
    status_final: data.status_rolo || "aprovado_revisor",
    parecer_final: data.observacoes || "",
    pontos: score.pontosPor100m2,
    next_phase_suggestion: score.nextPhase
  };
}


function buildDefectsRecords(data, revisionId, ts) {
  return (data.defeitos || []).map(d => ({
    revision_id: revisionId,
    tipo: d.tipo || d.tipo_defeito || "Desconhecido",
    metro_inicial: Number(d.metro_inicial || 0),
    metro_final: Number(d.metro_final || 0),
    gravidade: d.gravidade || "",
    zona: Array.isArray(d.posicao_largura)
      ? d.posicao_largura.join(',')
      : d.zona || "",
    observacoes: d.observacoes || "",
    criado_em: ts
  }));
}


function buildPhotosRecords(data, defects, revisionId, ts) {
  const photos = [];

  (data.fotos || []).forEach(p => {
    const url = p.url || p.url_foto || p.file_url;
    if (url) photos.push({
      revision_id: revisionId,
      url,
      tipo_foto: p.tipo_foto || "Geral",
      uploaded_at: ts
    });
  });

  defects.forEach(d => {
    if (d.foto_url) {
      photos.push({
        revision_id: revisionId,
        url: d.foto_url,
        tipo_foto: "Defeito",
        uploaded_at: ts
      });
    }
  });

  return photos;
}


/**
 * 🔄 CANONIZAÇÃO NÍVEL 1: buildStructuredPayload()
 * ================================================
 * Mapeia dados brutos para schema estruturado canônico.
 * - IDs: Tenta fallback chain (review_id || revision_id)
 * - Supplier: fallback para supplier_nm, supplier_name, fornecedor
 * - Produto: fallback para product_id, produto_id, roll_id
 * - Dimensões: len→largura_cm, wid→metros_fornecedor
 * - Tipo Tecido: determina se cálculos usam M2 ou KG
 * 
 * Resultado: Garantir entrada para persistStructuredData()
 */
function buildStructuredPayload(rolo, defeitos, fotos) {
  // ✅ CRÍTICO: Mapear TODOS os campos obrigatórios para novo schema
  return {
    rolo: {
      // IDs (CRÍTICO)
      roll_id: rolo.roll_id || rolo.id_do_rolo || "",
      review_id: rolo.review_id || rolo.revision_id || "",
      
      // QR Fields (supplier, produto, NF)
      supplier_id: rolo.supplier_id || rolo.fornecedor_id || "",
      supplier_nm: rolo.supplier_nm || rolo.fornecedor || rolo.supplier_name || "",
      nf: rolo.nf || rolo.nota_fiscal || "",
      product_id: rolo.product_id || rolo.produto_id || rolo.roll_id || "",
      lot: rolo.lot || rolo.lote || "",
      sup_product_id: rolo.sup_product_id || rolo.produto_sup_id || "",
      color_id: rolo.color_id || rolo.cor || "",
      fabric_pattern: rolo.fabric_pattern || rolo.padronagem || "",
      loc: rolo.loc || rolo.localizacao || "",
      
      // Dimensões
      len: rolo.len || rolo.largura_cm || 0,
      wid: rolo.wid || rolo.metros_fornecedor || 0,
      
      // Composição
      comp: rolo.comp || rolo.composicao || "",
      
      // Revisor (CRÍTICO)
      revisor_nome: rolo.revisor || rolo.revisor_nome || "",
      
      // Tipo de tecido e metragem (NOVO SCHEMA)
      tipo_tecido: rolo.tipo_tecido || "PLANO",
      metros_revisado: ensureNumber(rolo.metros_revisado || rolo.revised_meters || 0),
      peso_kg: ensureNumber(rolo.peso_kg || 0),
      
      // Pontos e tempo
      total_pontos: ensureNumber(rolo.pontos || rolo.total_pontos || 0),
      tempo_total_seg: ensureNumber(rolo.tempo_total_seg || 0),
      
      // Status
      status: rolo.status_final || rolo.status_rolo || "aprovado_revisor"
    },
    defeitos: Array.isArray(defeitos) ? defeitos : [],
    fotos: Array.isArray(fotos) ? fotos : []
  };
}

function persistStructuredData(payload) {
  if (!DatabaseService?.insertStructuredData) {
    throw new Error("DatabaseService.insertStructuredData indisponível");
  }
  return DatabaseService.insertStructuredData(payload);
}

/**
 * Client-accessible wrapper to request a workflow transition for a given roll.
 * Payload expected: { id: <rollId>, next: <next_phase>, options: { usuario, notas, ... } }
 * 🆕 ALTERADO: Agora valida estado atual antes de transicionar para evitar conflitos.
 */
function transitionRoll(payload) {
    try {
        const id = payload && (payload.id || payload.rollId || payload.roll_id);
        const next = payload && (payload.next || payload.next_phase || payload.nextPhase || 'aprovado_revisor');
        const options = payload && (payload.options || {});
        
        const current = DatabaseService.rolls.get(id);
        if (!current) throw new Error(`Rolo ${id} não encontrado`);
        
        const currentPhase = (current.fase_atual || 'criado').toLowerCase();
        Logger.log(`[transitionRoll] Solicitação: ${currentPhase} → ${next}`);
        
        const result = WorkflowService.transition(id, next, options);
        return { status: 'SUCESSO', data: result };
    } catch (err) {
        return { status: 'FALHA', message: err && err.message };
    }
}

/**
 * 🔄 CANONIZAÇÃO NÍVEL 2: normalizeQrPayload()
 * ================================================
 * Normaliza dados do QR code/escannings para campos padrão.
 * - Supplier: supplier_name || supplier_nm (entrada)
 * - Produto: product_id (entrada)
 * - Largura: len (entrada em cm)
 * - Metragem: meters_supplier || wid (entrada)
 * - Estrutura: est_tc usado para diferenciar PLANO vs MALHA
 * 
 * Resultado: {supplier_id, supplier_nm, product_id, wid, len, ...}
 */
function normalizeQrPayload(qr) {
  if (!qr || typeof qr !== 'object') return {};

  return {
    supplier_id: qr.supplier_id || null,
    supplier_nm: qr.supplier_name || qr.supplier_nm || null,

    nf: qr.nf || null,
    product_id: qr.product_id || null,
    lot: qr.lot || null,
    sup_product_id: qr.sup_product_id || null,

    color_id: qr.color_id || null,
    fabric_pattern: qr.fabric_pattern || null,
    loc: qr.loc || null,

    // 📏 metros / largura — padrão interno
    wid:
      qr.meters_supplier ??
      qr.wid ??
      null,

    len:
      qr.len ??
      null,

    comp: qr.comp || null,
    
    // 🧵 estrutura do tecido — importante para diferenciar malha vs plano
    est_tc: qr.est_tc || null
  };
}

/* ============================================================
 * 🆕 CREATE ROLL (VERSÃO FINAL / ALINHADA AO FRONTEND) — FIX
 * ============================================================ */
function initializeRollAndGetId(revisorNome, qrData = null) {
  try {
    // 🔄 Compatibilidade com payload objeto
    if (revisorNome && typeof revisorNome === "object" && qrData === null) {
      const payload = revisorNome;
      revisorNome = payload.revisorNome || payload.revisor || payload.revisor_nome || "";
      qrData = payload.qrData || payload.qr_data || null;
    }

    // 🚨 VALIDAÇÃO CRÍTICA DE RESPONSÁVEL
    if (!revisorNome || String(revisorNome).trim() === "" || revisorNome === "Selecionar") {
      throw new Error("Revisor inválido para iniciar a revisão");
    }

    const ts = new Date().toISOString();

    let parsedQr = null;
    if (typeof qrData === "string") {
      parsedQr = normalizeQrPayload(parseQrCodeData(qrData));
    } else if (qrData && typeof qrData === "object") {
      parsedQr = normalizeQrPayload(qrData);
    }

    // 🔹 ID DO ROLO FÍSICO (só existe se veio de QR)
    const productId = String(parsedQr?.product_id || parsedQr?.produto_id || "").trim() || null;

    // 🔹 ID DA REVISÃO (sessão de trabalho)
    const revisionId = DatabaseService.generateShortRevisionId(parsedQr);

    Logger.log("[SERVER] Nova revisão criada: " + revisionId +
               " | Rolo físico: " + (productId || "N/A") +
               " | Revisor: " + revisorNome);

    return {
      status: "SUCESSO",
      review_id: revisionId,
      roll_id: productId,   // null no modo manual = CORRETO
      started_at: ts,
      elapsed_seconds: 0
    };

  } catch (e) {
    Logger.log("[SERVER] ❌ Erro initializeRollAndGetId: " + e.message);
    return { status: "FALHA", message: e.message };
  }
}


/* ============================================================
 * 🔍 CHECK ACTIVE ROLL (VERSÃO FINAL / TIMER-SAFE)
 * ============================================================ */
function checkActiveRoll(responsavel) {
  try {
    const reviewer = String(responsavel || '').trim();
    if (!reviewer) return { has_active_roll: false };

    const cache = CacheService.getScriptCache();
    const cacheKey = 'ACTIVE_ROLL_' + reviewer;
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }

    appLog('[SERVER] Verificando rolo ativo para: ' + reviewer);

    // ✅ CORRIGIDO: Usar 'INSPECOES' ao invés de 'rolos'
    const rows = DatabaseService.databaseQuery({
      collection: 'INSPECOES',
      where: [
        { field: 'REVISOR', op: '==', value: reviewer },
        { field: 'STATUS_FINAL', op: '==', value: 'EM_REVISAO' }
      ]
    });

    if (rows && rows.length > 0) {
      const active = rows[0];

      const startedAt = active.started_at || active.DATA_REGISTRO
        ? new Date(active.started_at || active.DATA_REGISTRO)
        : null;

      let elapsedSeconds = 0;
      if (startedAt && !isNaN(startedAt)) {
        elapsedSeconds = Math.floor(
          (Date.now() - startedAt.getTime()) / 1000
        );
      }

      appLog(
        '[SERVER] Rolo ativo encontrado: ' +
          (active.REVISION_ID || active.ID_ROLO) +
          ' | elapsed=' +
          elapsedSeconds +
          's'
      );

      const result = {
        has_active_roll: true,
        roll_id: active.roll_id || active.ID_ROLO,
        review_id: active.review_id || active.REVISION_ID,
        roll_phase: active.STATUS_FINAL,

        // ⏱️ TIMER
        started_at: active.started_at || active.DATA_REGISTRO || null,
        elapsed_seconds: elapsedSeconds,

        // Dados completos para repopular formulário
        data: active
      };

      cache.put(cacheKey, JSON.stringify(result), 8);
      return result;
    }

    appLog('[SERVER] Nenhum rolo ativo para este revisor');
    const emptyResult = { has_active_roll: false };
    cache.put(cacheKey, JSON.stringify(emptyResult), 8);
    return emptyResult;
  } catch (e) {
    Logger.log('[SERVER] ERRO checkActiveRoll: ' + e.message);

    if (
      e.message &&
      (e.message.includes('intervalo') ||
        e.message.includes('getLastRow'))
    ) {
      appLog('[SERVER] ⚠️ Planilha vazia detectada. Retornando seguro.', true);
      return { has_active_roll: false, error: 'empty_sheet' };
    }

    return { has_active_roll: false, error: e.message };
  }
}

function parseQrCodeData(qrRaw) {
  if (!qrRaw || typeof qrRaw !== 'string') {
    throw new Error("Nenhum conteúdo fornecido");
  }

  const p = qrRaw.split(';').map(v => v.trim());

  if (p.length < 12) {
    throw new Error("QR inválido: quantidade de campos incorreta");
  }

  return {
    supplier_id: p[0],
    supplier_nm: p[1],
    nf: p[2],
    product_id: p[3],
    lot: p[4],
    sup_product_id: p[5],
    color_id: p[6],
    fabric_pattern: p[7],
    loc: p[8],
    wid: Number(p[10].replace(',', '.')),  // METROS (p[10])
    len: Number(p[9].replace(',', '.')),   // LARGURA EM CM (p[9])
    comp: p[11]
  };
}

// testeDebugServico() — DELETED (dead code, never called)

/* ============================================================
 *   📦 FUNÇÕES DE ESTOQUE - INTEGRADAS COM CONTROLLERS
 * ============================================================ */

/**
 * Processa decisão do supervisor usando WorkflowService
 * @param {Object} payload - Dados da decisão {id_do_rolo, decisao, observacoes}
 * @returns {Object} - Resultado da operação
 */
function processSupervisorDecision_Web(payload) {
  const startTime = new Date().getTime();
  try {
    const { id_do_rolo, decision, observacoes, categoria_defeito, acao_recomendada } = payload;
    const decisao = decision || payload.decisao;
    
    Logger.log(`
    ╔════════════════════════════════════════╗
    ║ [SUPERVISOR] Processando Decisão       ║
    ╚════════════════════════════════════════╝
    Rolo ID: ${id_do_rolo}
    Decisão: ${decisao}
    Observações: ${observacoes || 'N/A'}
    Categoria: ${categoria_defeito || 'N/A'}
    Ação: ${acao_recomendada || 'N/A'}
    Timestamp: ${new Date().toISOString()}
    `);
    
    // Determina próximo status baseado na decisão (WorkflowService v6)
    let nextStatus;
    if (decisao.toLowerCase() === 'aprovado') {
      nextStatus = 'aprovado_supervisor';
      Logger.log(`[SUPERVISOR] ✅ Mapeamento: aprovado → aprovado_supervisor → em_estoque`);
    } else if (decisao.toLowerCase() === 'reprovado') {
      nextStatus = 'reprovado_supervisor';
      Logger.log(`[SUPERVISOR] ❌ Mapeamento: reprovado → reprovado_supervisor → enviado_compras`);
    } else {
      throw new Error('Decisão inválida. Use "aprovado" ou "reprovado"');
    }
    
    // Usa WorkflowService para transição
    const user = Session.getActiveUser().getEmail();
    Logger.log(`[SUPERVISOR] 👤 Usuário: ${user}`);
    
    Logger.log(`[SUPERVISOR] 🔄 Executando transição via WorkflowService...`);
    let result = WorkflowService.transition(id_do_rolo, nextStatus, {
      usuario: user,
      notas: observacoes || `Decisão do supervisor: ${decisao}`,
      categoria_defeito: categoria_defeito || 'N/A',
      acao_recomendada: acao_recomendada || 'N/A'
    });
    
    Logger.log(`[SUPERVISOR] ✅ Transição concluída:`);
    Logger.log(`  De: ${result.de || 'N/A'}`);
    Logger.log(`  Para: ${result.para || 'N/A'}`);
    
    // ✅ Transição automática para estado final (conforme WorkflowService v6)
    if (result?.para === 'aprovado_supervisor') {
      Logger.log(`[SUPERVISOR] 🔄 Transição automática: aprovado_supervisor → em_estoque`);
      result = WorkflowService.transition(id_do_rolo, 'em_estoque', { usuario: user });
      Logger.log(`[SUPERVISOR] ✅ Agora em: ${result.para}`);
    }
    
    if (result?.para === 'reprovado_supervisor') {
      Logger.log(`[SUPERVISOR] 🔄 Transição automática: reprovado_supervisor → enviado_compras`);
      result = WorkflowService.transition(id_do_rolo, 'enviado_compras', { usuario: user });
      Logger.log(`[SUPERVISOR] ✅ Agora em: ${result.para}`);
    }
    
    // Se reprovado, marca caso em compras + gera PDF + envia email
    let pdfUrl = null;
    if (decisao.toLowerCase() === 'reprovado') {
      try {
        DatabaseService.rolls.update(id_do_rolo, {
          compras_status_case: 'pendente',
          motivo_reprovacao_supervisor: observacoes || '',
          categoria_defeito_supervisor: categoria_defeito || '',
          acao_recomendada_supervisor: acao_recomendada || ''
        });
      } catch (markErr) {
        Logger.log(`[SUPERVISOR] ⚠️ Falha ao marcar caso de compras: ${markErr.message}`);
      }

      Logger.log(`[SUPERVISOR] 📄 Gerando PDF de reprovação...`);
      pdfUrl = generateReprovePDF_Web(id_do_rolo, observacoes);
      Logger.log(`[SUPERVISOR] ✅ PDF gerado: ${pdfUrl}`);

      try {
        if (pdfUrl) {
          DatabaseService.rolls.update(id_do_rolo, {
            pdf_reprovacao_url: String(pdfUrl),
            pdf_reprovacao_status: 'pronto',
            pdf_reprovacao_updated_at: new Date().toISOString()
          });
        } else {
          DatabaseService.rolls.update(id_do_rolo, {
            pdf_reprovacao_status: 'pendente',
            pdf_reprovacao_updated_at: new Date().toISOString()
          });
        }
      } catch (pdfMarkErr) {
        Logger.log(`[SUPERVISOR] ⚠️ Falha ao persistir status do PDF: ${pdfMarkErr.message}`);
      }
      
      // Busca dados do rolo para enviar email
      Logger.log(`[SUPERVISOR] 📧 Preparando email para Compras...`);
      try {
        const roll = DatabaseService.rolls.get(id_do_rolo);
        if (roll) {
          const defeitosRaw = roll.defeitos || roll.DEFEITOS || [];
          const defeitos = Array.isArray(defeitosRaw)
            ? defeitosRaw
            : (typeof defeitosRaw === 'string' ? (JSON.parse(defeitosRaw || '[]') || []) : []);

          const relatorioFileId = (function (url) {
            const raw = String(url || '');
            if (!raw) return null;
            const m1 = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (m1 && m1[1]) return m1[1];
            const m2 = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            return m2 && m2[1] ? m2[1] : null;
          })(pdfUrl);

          const emailOk = sendComprasEmail(roll, defeitos, {
            relatorioFileId,
            pdfUrl: pdfUrl,
            pdfBlob: null
          });
          Logger.log(`[SUPERVISOR] ${emailOk ? "✅" : "⚠️"} Email compras ${emailOk ? "enviado" : "falhou"}`);
        }
      } catch (emailErr) {
        Logger.log(`[SUPERVISOR] ⚠️ Erro ao enviar email: ${emailErr.message}`);
        // Não falha a operação, continua mesmo sem email
      }
    }
    
    const elapsed = new Date().getTime() - startTime;
    Logger.log(`[SUPERVISOR] ⏱️ Tempo total: ${elapsed}ms`);
    
    return {
      status: 'SUCESSO',
      message: `Revisão ${decisao.toLowerCase()} com sucesso. Status: ${result.para}`,
      fase_atual: result.para,
      transicao: result,
      pdfUrl: pdfUrl
    };
    
  } catch (error) {
    const elapsed = new Date().getTime() - startTime;
    Logger.log(`
    ╔════════════════════════════════════════╗
    ║ [SUPERVISOR] ❌ ERRO                   ║
    ╚════════════════════════════════════════╝
    Erro: ${error.message}
    Stack: ${error.stack || 'N/A'}
    Tempo: ${elapsed}ms
    `);
    return {
      status: 'ERRO',
      message: error.message
    };
  }
}

/**
 * Gera PDF de reprovação para o setor de Compras
 * @param {string} idRolo - ID do rolo
 * @param {string} motivo - Motivo da reprovação
 * @returns {string} - URL do PDF
 */
function generateReprovePDF_Web(idRolo, motivo) {
  const startTime = new Date().getTime();
  try {
    Logger.log(`
    ╔════════════════════════════════════════╗
    ║ [PDF] Gerando Reprovação               ║
    ╚════════════════════════════════════════╝
    Rolo ID: ${idRolo}
    Motivo: ${motivo || 'Não especificado'}
    `);
    
    // Busca dados do rolo (aceita REVISION_ID ou ID_ROLO)
    Logger.log(`[PDF] 🔍 Buscando dados do rolo: ${idRolo}`);
    const roll = DatabaseService.rolls.get(idRolo);
    if (!roll) {
      throw new Error(`Rolo ${idRolo} não encontrado na planilha`);
    }

    Logger.log(`[PDF] ✅ Dados do rolo carregados`);

    const defeitosRaw = roll.defeitos || roll.DEFEITOS || [];
    const defeitos = Array.isArray(defeitosRaw)
      ? defeitosRaw
      : (typeof defeitosRaw === 'string' ? (JSON.parse(defeitosRaw || '[]') || []) : []);

    // Tentativa preferencial: gerar PDF usando template oficial (DocumentService)
    try {
      if (typeof DocumentService !== 'undefined' && DocumentService.generateAllDocs) {
        const docs = DocumentService.generateAllDocs(
          { ...roll, id_do_rolo: String(roll.id_do_rolo || roll.ID_ROLO || idRolo) },
          defeitos,
          [],
          'compras'
        );

        if (docs && docs.relatorioFileId) {
          const file = DriveApp.getFileById(docs.relatorioFileId);
          const templatePdfUrl = file.getUrl();
          Logger.log('[PDF] ✅ PDF gerado via template oficial (compras)');
          return templatePdfUrl;
        }
      }
    } catch (templateErr) {
      Logger.log('[PDF] ⚠️ Falha no template oficial, aplicando fallback: ' + templateErr.message);
    }
    
    try {
      Logger.log(`[PDF] 📁 Preparando pastas do Drive...`);
      const folders = DocumentService.getOrCreateRollFolder(idRolo);
      
      // Cria documento de reprovação
      const docName = `REPROVAÇÃO_${idRolo}_${Date.now()}`;
      Logger.log(`[PDF] 📄 Criando documento: ${docName}`);
      const doc = DocumentApp.create(docName);
      doc.moveToFolder(folders.relatorio);
      
      const body = doc.getBody();
      body.clear();
      
      // Cabeçalho
      body.appendParagraph("RELATÓRIO DE REPROVAÇÃO DE TECIDO")
        .setHeading(DocumentApp.ParagraphHeading.HEADING1)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      
      body.appendParagraph("Setor de Compras - FA Maringá")
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setItalic(true);
      
      body.appendParagraph("");
      
      const rollIdView = String(roll.id_do_rolo || roll.ID_ROLO || roll.roll_id || idRolo || "N/A");
      const reviewIdView = String(roll.revision_id || roll.REVISION_ID || roll.review_id || "N/A");
      const fornecedorView = String(roll.fornecedor || roll.FORNECEDOR || roll.supplier_nm || "N/A");
      const produtoView = String(roll.produto_id || roll.PRODUTO_ID || roll.product_id || "N/A");
      const loteView = String(roll.lote || roll.LOTE || roll.lot || "N/A");
      const localizacaoView = String(roll.localizacao || roll.LOCALIZACAO || roll.loc || "N/A");
      const tipoTecidoView = String(roll.tipo_tecido || roll.TIPO_TECIDO || "N/A");
      const larguraView = String(roll.largura_cm || roll.LARGURA_CM || roll.len || "N/A");
      const metrosFornecedorView = String(roll.metros_fornecedor || roll.METROS_FORNECEDOR || roll.metros_maquina || roll.METROS_MAQUINA || roll.wid || "N/A");
      const corView = String(roll.cor || roll.COR || roll.color_id || roll.COLOR_ID || "N/A");

      // Informações do rolo
      body.appendParagraph("INFORMAÇÕES DO ROLO")
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      
      const table1 = body.appendTable([
        ["Campo", "Valor"],
        ["ID do Rolo", rollIdView],
        ["Revision ID", reviewIdView],
        ["Fornecedor", fornecedorView],
        ["Produto ID", produtoView],
        ["Lote", loteView],
        ["Localização", localizacaoView],
        ["Tipo de Tecido", tipoTecidoView],
        ["Largura (cm)", larguraView],
        ["Metros Fornecedor", metrosFornecedorView],
        ["Cor", corView]
      ]);
      
      // Formatação da tabela
      for (let i = 0; i < table1.getNumRows(); i++) {
        const row = table1.getRow(i);
        if (i === 0) {
          row.getCell(0).getChild(0).asParagraph().setBold(true);
          row.getCell(1).getChild(0).asParagraph().setBold(true);
        }
      }
      
      body.appendParagraph("");
      
      // Motivo da reprovação
      body.appendParagraph("MOTIVO DA REPROVAÇÃO")
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      
      body.appendParagraph(String(motivo || "Não informado"))
        .setForegroundColor("#e02424")
        .setBold(true);
      
      body.appendParagraph("");
      
      // Defeitos encontrados
      if (defeitos.length > 0) {
        body.appendParagraph("DEFEITOS ENCONTRADOS")
          .setHeading(DocumentApp.ParagraphHeading.HEADING2);
        
        const defectsTable = [["Tipo", "Metragem", "Gravidade", "Observações"]];
        defeitos.forEach(d => {
          const tipo = String(d.tipo || d.tipo_defeito || d.TIPO || 'N/A');
          const metroInicial = String(d.metro_inicial || d.metragem_inicial || d.METRO_INICIAL || 0);
          const metroFinal = String(d.metro_final || d.metragem_final || d.METRO_FINAL || 0);
          const gravidade = String(d.gravidade || d.GRAVIDADE || 'N/A');
          const obs = String(d.observacoes || d.OBSERVACOES || '-');
          defectsTable.push([
            tipo,
            `${metroInicial} - ${metroFinal}m`,
            gravidade,
            obs
          ]);
        });
        
        const table2 = body.appendTable(defectsTable);
        for (let i = 0; i < table2.getNumRows(); i++) {
          if (i === 0) {
            table2.getRow(i).getCell(0).getChild(0).asParagraph().setBold(true);
            table2.getRow(i).getCell(1).getChild(0).asParagraph().setBold(true);
            table2.getRow(i).getCell(2).getChild(0).asParagraph().setBold(true);
            table2.getRow(i).getCell(3).getChild(0).asParagraph().setBold(true);
          }
        }
        
        body.appendParagraph("");
      }
      
      // Ação requerida
      body.appendParagraph("AÇÃO REQUERIDA")
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      
      body.appendParagraph("Por favor, entre em contato com o fornecedor para resolver os problemas identificados acima.")
        .setBold(true);
      
      body.appendParagraph("Data: " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"))
        .setItalic(true);
      
      // Exporta como PDF
      const docId = doc.getId();
      const blob = DriveApp.getFileById(docId).getAs("application/pdf");
      const pdfFile = folders.relatorio.createFile(blob);
      pdfFile.setName(`REPROVAÇÃO_${idRolo}_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm")}.pdf`);
      
      // Remove o documento temporário (mantém apenas o PDF)
      DriveApp.getFileById(docId).setTrashed(true);
      
      // Retorna URL do PDF
      const pdfUrl = "https://drive.google.com/file/d/" + pdfFile.getId();
      
      const elapsed = new Date().getTime() - startTime;
      Logger.log(`
      ╔════════════════════════════════════════╗
      ║ [PDF] ✅ Sucesso                       ║
      ╚════════════════════════════════════════╝
      URL: ${pdfUrl}
      Arquivo: ${pdfFile.getName()}
      Tempo: ${elapsed}ms
      `);
      
      return pdfUrl;
      
    } catch (docError) {
      const elapsed = new Date().getTime() - startTime;
      Logger.log(`
      ╔════════════════════════════════════════╗
      ║ [PDF] ⚠️ Erro ao criar documento       ║
      ╚════════════════════════════════════════╝
      Erro: ${docError.message}
      Fallback: Google Drive Search
      Tempo: ${elapsed}ms
      `);
      return `https://drive.google.com/drive/search?q=${encodeURIComponent(idRolo)}`;
    }
    
  } catch (error) {
    const elapsed = new Date().getTime() - startTime;
    Logger.log(`
    ╔════════════════════════════════════════╗
    ║ [PDF] ❌ ERRO CRÍTICO                  ║
    ╚════════════════════════════════════════╝
    Erro: ${error.message}
    Stack: ${error.stack || 'N/A'}
    Tempo: ${elapsed}ms
    `);
    return null;
  }
}

/**
 * Gera PDF da revisão usando DocumentService
 * @param {string} idRolo - ID do rolo
 * @returns {Object} - URL do PDF e informações
 */
function generateRevisionPDF_Web(idRolo) {
  try {
    Logger.log(`[PDF] Gerando PDF para rolo: ${idRolo}`);
    
    // Busca dados completos do rolo
    const roll = DatabaseService._get('INSPECOES', idRolo);
    if (!roll) {
      throw new Error('Rolo não encontrado');
    }
    
    // Usa DocumentService para gerar PDF
    const pdfUrl = DocumentService.generateRevisionPDFLink(idRolo, 'supervisor');
    
    return {
      status: 'SUCESSO',
      pdfUrl: pdfUrl,
      rollData: roll
    };
    
  } catch (error) {
    Logger.log(`[PDF] Erro ao gerar PDF: ${error.message}`);
    return {
      status: 'ERRO',
      message: error.message
    };
  }
}

/**
 * FUNÇÃO PRINCIPAL: Retorna rolos filtrados por status
 * Esta é a ÚNICA fonte de verdade para esta operação
 */
function getRollsByStatus_Web(payload) {
  try {
    if (!payload || typeof payload !== 'object') return [];

    const status = String(payload.status || '').trim().toLowerCase();
    if (!status) return [];

    const queryParams = {
      collection: 'INSPECOES',
      where: [{ field: 'FASE_ATUAL', op: '==', value: status }]
    };

    const rolos = DatabaseService.databaseQuery(queryParams);
    if (Array.isArray(rolos)) return JSON.parse(JSON.stringify(rolos));
    if (rolos && typeof rolos === 'object') return [JSON.parse(JSON.stringify(rolos))];
    return [];
  } catch (error) {
    Logger.log('[APP] ❌ Erro getRollsByStatus_Web: ' + error.message);
    return [];
  }
}

/* ============================================================
 *   🛒 PROCESSAMENTO DE DECISÕES DE COMPRAS
 * ============================================================ */

function processarDecisaoComprasV2_Web(payload) {
  const startTime = new Date().getTime();
  try {
    const { 
      idRolo, 
      statusFinal, 
      comprador, 
      observacoes,
      tipoDecisao,        // 'desconto', 'devolucao', 'uso_com_ressalvas', 'reprovado_definitivo'
      respostaCompras,    // Resposta detalhada do setor
      voltarEstoque,      // boolean
      motivoRessalvas     // Motivo se volta com ressalvas
    } = payload;
    
    Logger.log(`
    ╔════════════════════════════════════════╗
    ║ [COMPRAS] Processando Decisão           ║
    ╚════════════════════════════════════════╝
    Rolo ID: ${idRolo}
    Status Final: ${statusFinal}
    Tipo Decisão: ${tipoDecisao || 'N/A'}
    Comprador: ${comprador}
    Observações: ${observacoes || 'N/A'}
    Resposta: ${respostaCompras || 'N/A'}
    Volta Estoque: ${voltarEstoque ? 'SIM' : 'NÃO'}
    Timestamp: ${new Date().toISOString()}
    `);
    
    // Determina próximo status baseado na decisão
    let nextStatus;
    if (statusFinal.toUpperCase() === 'APROVADO_COMPRAS') {
      nextStatus = 'aprovado_compras';
      Logger.log(`[COMPRAS] ✅ Mapeamento: APROVADO_COMPRAS → aprovado_compras`);
    } else if (statusFinal.toUpperCase() === 'REPROVADO_COMPRAS') {
      nextStatus = 'reprovado_compras';
      Logger.log(`[COMPRAS] ❌ Mapeamento: REPROVADO_COMPRAS → reprovado_compras`);
    } else {
      throw new Error('Status final inválido. Use "APROVADO_COMPRAS" ou "REPROVADO_COMPRAS"');
    }
    
    // Usa WorkflowService para transição
    const user = comprador || Session.getActiveUser().getEmail();
    Logger.log(`[COMPRAS] 👤 Usuário: ${user}`);
    
    Logger.log(`[COMPRAS] 🔄 Executando transição via WorkflowService...`);
    const result = WorkflowService.transition(idRolo, nextStatus, {
      usuario: user,
      notas: observacoes || `Decisão do compras: ${statusFinal}`
    });
    
    Logger.log(`[COMPRAS] ✅ Transição concluída:`);
    Logger.log(`  De: ${result.de || 'N/A'}`);
    Logger.log(`  Para: ${result.para || 'N/A'}`);
    
    // Atualiza campos específicos de compras no rolo
    const comprasData = {
      compras_tipo_decisao: tipoDecisao || '',
      compras_resposta: respostaCompras || observacoes || '',
      compras_responsavel: user,
      compras_data_decisao: new Date().toISOString(),
      compras_status_case: 'resolvido',
      compras_volta_estoque: voltarEstoque === false ? false : true,
      disponivel_com_ressalvas: false,
      motivo_ressalvas: ''
    };
    
    // Se aprovado E deve voltar ao estoque
    if (statusFinal.toUpperCase() === 'APROVADO_COMPRAS' && voltarEstoque !== false) {
      Logger.log(`[COMPRAS] 📦 Movendo para estoque...`);
      
      // Se tipo de decisão for 'uso_com_ressalvas', marca flag
      if (tipoDecisao === 'uso_com_ressalvas' || motivoRessalvas) {
        comprasData.disponivel_com_ressalvas = true;
        comprasData.motivo_ressalvas = motivoRessalvas || respostaCompras || 'Tecido reprovado pelo supervisor, mas aprovado para uso com ressalvas pelo setor de compras';
        comprasData.compras_destino = 'estoque_com_ressalvas';
        Logger.log(`[COMPRAS] ⚠️ Marcado como DISPONÍVEL COM RESSALVAS`);
      } else {
        comprasData.compras_destino = 'estoque';
      }
      
      // Atualiza dados de compras ANTES de mover para estoque
      DatabaseService.rolls.update(idRolo, comprasData);
      
      WorkflowService.transition(idRolo, 'em_estoque', {
        usuario: user,
        notas: comprasData.disponivel_com_ressalvas 
          ? 'Movido para estoque com ressalvas após análise de compras'
          : 'Movido para estoque após aprovação de compras'
      });
      
      Logger.log(`[COMPRAS] ✅ Movido para estoque${comprasData.disponivel_com_ressalvas ? ' (COM RESSALVAS)' : ''}`);
    } else if (statusFinal.toUpperCase() === 'REPROVADO_COMPRAS') {
      // Se reprovado definitivamente, atualiza dados
      comprasData.compras_destino = (tipoDecisao || '').toLowerCase() || 'devolucao';
      DatabaseService.rolls.update(idRolo, comprasData);
      WorkflowService.transition(idRolo, 'finalizado_reprovado', {
        usuario: user,
        notas: 'Reprovado definitivamente pelo setor de compras'
      });
      Logger.log(`[COMPRAS] ❌ Reprovado definitivamente - NÃO voltará ao estoque`);
    } else {
      // Só atualiza dados sem mover
      DatabaseService.rolls.update(idRolo, comprasData);
    }
    
    const elapsed = new Date().getTime() - startTime;
    Logger.log(`[COMPRAS] ⏱️ Tempo total: ${elapsed}ms`);
    
    return {
      status: 'SUCESSO',
      message: `Decisão de compras processada. Status: ${result.para}`,
      fase_atual: result.para,
      transicao: result,
      disponivel_com_ressalvas: comprasData.disponivel_com_ressalvas
    };
    
  } catch (error) {
    const elapsed = new Date().getTime() - startTime;
    Logger.log(`
    ╔════════════════════════════════════════╗
    ║ [COMPRAS] ❌ ERRO                       ║
    ╚════════════════════════════════════════╝
    Erro: ${error.message}
    Stack: ${error.stack || 'N/A'}
    Tempo: ${elapsed}ms
    `);
    return {
      status: 'ERRO',
      message: error.message
    };
  }
}

function atualizarPendenciaCompras_Web(payload) {
  try {
    const idRolo = String(payload?.idRolo || '').trim();
    const observacoes = String(payload?.observacoes || '').trim();
    const tipoDecisao = String(payload?.tipoDecisao || 'em_negociacao').trim().toLowerCase();
    const user = Session.getActiveUser().getEmail() || 'sistema';

    if (!idRolo) throw new Error('idRolo é obrigatório');
    if (!observacoes) throw new Error('Observação é obrigatória para pendência de compras');

    const update = {
      compras_status_case: 'em_negociacao',
      compras_tipo_decisao: tipoDecisao,
      compras_resposta: observacoes,
      compras_responsavel: user,
      compras_data_decisao: new Date().toISOString()
    };

    DatabaseService.rolls.update(idRolo, update);
    return { status: 'SUCESSO', message: 'Pendência de compras atualizada', idRolo };
  } catch (error) {
    Logger.log('[COMPRAS] ❌ Erro em atualizarPendenciaCompras_Web: ' + error.message);
    return { status: 'ERRO', message: error.message };
  }
}

function parseHistoryField_(rawValue) {
  if (Array.isArray(rawValue)) return rawValue;
  if (!rawValue) return [];
  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function hasSupervisorReproval_(roll) {
  const faseAtual = String(roll.fase_atual || roll.FASE_ATUAL || '').toLowerCase();
  if (['enviado_compras', 'aprovado_compras', 'reprovado_compras', 'finalizado_reprovado'].includes(faseAtual)) {
    return true;
  }

  const historico = parseHistoryField_(roll.historico_status || roll.HISTORICO_STATUS);
  return historico.some((entry) => {
    const fase = String(entry?.fase || '').toLowerCase();
    const para = String(entry?.transicao?.para || '').toLowerCase();
    return fase === 'reprovado_supervisor' || para === 'reprovado_supervisor';
  });
}

function getComprasCases_Web() {
  try {
    const allRolls = DatabaseService.databaseQuery({
      collection: 'INSPECOES',
      orderBy: [{ field: 'DATA_ATUALIZACAO', direction: 'desc' }]
    }) || [];

    const filtered = allRolls.filter((roll) => hasSupervisorReproval_(roll));

    const mapped = filtered.map((roll) => {
      const relatorioFileId = String(
        roll.relatorio_file_id || roll.RELATORIO_FILE_ID || ''
      ).trim();

      const fromRelatorio = relatorioFileId
        ? ('https://drive.google.com/file/d/' + relatorioFileId + '/view')
        : '';

      const fromPdfReprovacao = String(
        roll.pdf_reprovacao_url || roll.PDF_REPROVACAO_URL || ''
      ).trim();

      const fromLegacyUrl = String(
        roll.pdf_url || roll.PDF_URL || roll.relatorio_url || roll.RELATORIO_URL || ''
      ).trim();

      const comprasPdfUrl = fromPdfReprovacao || fromRelatorio || fromLegacyUrl || '';
      const comprasPdfStatus = comprasPdfUrl ? 'pronto' : 'pendente';

      return Object.assign({}, roll, {
        compras_pdf_url: comprasPdfUrl,
        compras_pdf_status: comprasPdfStatus
      });
    });

    return JSON.parse(JSON.stringify(mapped));
  } catch (error) {
    Logger.log('[COMPRAS] ❌ Erro em getComprasCases_Web: ' + error.message);
    return [];
  }
}

/* ============================================================
 *   📸 BUSCAR FOTOS DO ROLO
 * ============================================================ */
function getFotosByRevisionId_Web(revisionId) {
  try {
    Logger.log('[APP] 📸 Buscando fotos para revisionId: ' + revisionId);
    
    if (!revisionId) {
      Logger.log('[APP] ⚠️ revisionId vazio');
      return [];
    }
    
    // Query na tabela FOTOS para buscar todas as URLs deste rolo
    const query = {
      collection: 'FOTOS',
      where: [{ field: 'REVISION_ID', op: '==', value: String(revisionId).trim() }]
    };
    
    const fotos = DatabaseService.databaseQuery(query);
    
    if (!Array.isArray(fotos)) {
      Logger.log('[APP] ⚠️ Retorno não é array: ' + typeof fotos);
      return [];
    }
    
    Logger.log('[APP] ✅ ' + fotos.length + ' fotos encontradas');
    
    // Retorna array com as URLs
    return fotos.map(f => ({
      url: f.URL_FOTO || f.url_foto || '',
      tipo: f.TIPO_FOTO || f.tipo_foto || 'GERAL',
      timestamp: f.TIMESTAMP || f.timestamp || ''
    })).filter(f => f.url);
    
  } catch (error) {
    Logger.log('[APP] ❌ Erro ao buscar fotos: ' + error.message);
    return [];
  }
}

function getImageAsBase64_Web(driveUrl) {
  try {
    Logger.log('[APP] 🖼️ Convertendo imagem para base64: ' + driveUrl);
    
    if (!driveUrl) {
      Logger.log('[APP] ⚠️ URL vazia');
      return null;
    }
    
    // Faz o fetch da imagem
    const response = UrlFetchApp.fetch(driveUrl, {
      muteHttpExceptions: true,
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log('[APP] ⚠️ Erro ao buscar imagem: ' + response.getResponseCode());
      return null;
    }
    
    // Converte para base64
    const blob = response.getBlob();
    const contentType = blob.getContentType();
    const base64 = Utilities.base64Encode(blob.getBytes());
    
    // Retorna como data URI
    const dataUri = 'data:' + contentType + ';base64,' + base64;
    Logger.log('[APP] ✅ Imagem convertida para base64 (~' + Math.round(base64.length / 1024) + 'KB)');
    
    return dataUri;
    
  } catch (error) {
    Logger.log('[APP] ❌ Erro ao converter imagem: ' + error.message);
    return null;
  }
}

function getReviewerMetrics_Web(periodos_dias) {
  try {
    const dias = periodos_dias || 30;
    Logger.log('[APP] 👥 Buscando métricas de revisores para os últimos ' + dias + ' dias');
    
    const metrics = DatabaseService.getReviewerMetrics(dias);
    
    Logger.log('[APP] ✅ Métricas de revisores recuperadas');
    return metrics;
    
  } catch (error) {
    Logger.log('[APP] ❌ Erro ao buscar métricas de revisores: ' + error.message);
    return {
      status: 'erro',
      mensagem: error.message,
      ranking: [],
      resumo: {}
    };
  }
}

function getReviewerMetricsRange_Web(startDate, endDate) {
  try {
    Logger.log('[APP] 👥 Buscando métricas de revisores por período');
    const metrics = DatabaseService.getReviewerMetricsRange(startDate, endDate);
    Logger.log('[APP] ✅ Métricas de revisores recuperadas (range)');
    return metrics;
  } catch (error) {
    Logger.log('[APP] ❌ Erro ao buscar métricas de revisores (range): ' + error.message);
    return {
      status: 'erro',
      mensagem: error.message,
      ranking: [],
      resumo: {}
    };
  }
}

function sendProactiveNotifications_Web(payload) {
  try {
    const list = Array.isArray(payload?.notifications) ? payload.notifications : [];
    const notifications = list
      .filter((n) => n && n.titulo && n.descricao)
      .slice(0, 10);

    if (!notifications.length) {
      return {
        status: 'SUCESSO',
        message: 'Nenhuma notificação pendente para envio.',
        sentCount: 0,
        sentIds: [],
        sentAt: new Date().toISOString()
      };
    }

    if (typeof sendProactiveInternalDigestEmail === 'function') {
      const digestResp = sendProactiveInternalDigestEmail({
        notifications,
        origin: payload?.origin || 'dashboard_estoque'
      });

      if (digestResp && digestResp.status === 'SUCESSO') {
        return {
          status: 'SUCESSO',
          message: digestResp.message || 'Notificações enviadas via digest interno.',
          sentCount: notifications.length,
          sentIds: notifications.map((n) => n.id).filter(Boolean),
          sentAt: new Date().toISOString()
        };
      }
    }

    const recipients = Array.from(new Set([
      CONFIG?.EMAIL?.ADMIN,
      CONFIG?.EMAIL?.SUPERVISOR,
      CONFIG?.EMAIL?.COMPRAS
    ].filter(Boolean)));

    if (!recipients.length) {
      throw new Error('Destinatários internos não configurados.');
    }

    const rows = notifications.map((item, idx) => {
      const ordem = idx + 1;
      return '<li><b>#' + ordem + ' [' + String(item.severidade || '').toUpperCase() + ']</b> ' +
        String(item.titulo || '') +
        '<br><span style="color:#555;">' + String(item.descricao || '') + '</span>' +
        '<br><span style="color:#111;"><b>Ação:</b> ' + String(item.acaoRecomendada || '') + '</span></li>';
    }).join('');

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: '🚨 RRT | Alertas Proativos (' + notifications.length + ')',
      htmlBody:
        '<div style="font-family:Arial,sans-serif;line-height:1.5;">' +
          '<h3>Notificações proativas do Dashboard RRT</h3>' +
          '<p>Origem: ' + String(payload?.origin || 'dashboard_estoque') + '</p>' +
          '<ol>' + rows + '</ol>' +
          '<p style="font-size:12px;color:#666;">Mensagem automática para acionamento interno.</p>' +
        '</div>',
      name: CONFIG?.EMAIL?.SENDER_NAME || 'Sistema RRT'
    });

    return {
      status: 'SUCESSO',
      message: 'Notificações enviadas com fallback de endpoint.',
      sentCount: notifications.length,
      sentIds: notifications.map((n) => n.id).filter(Boolean),
      sentAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.log('[APP] ❌ Erro em sendProactiveNotifications_Web: ' + error.message);
    return {
      status: 'ERRO',
      message: error.message,
      sentCount: 0,
      sentIds: []
    };
  }
}

/**
 * =========================================================
 * 📊 KPI DASHBOARD - Métricas em Tempo Real
 * =========================================================
 * Retorna dados reais para o Dashboard KPI (gestores):
 * - Taxa de Reprovacao: reprovados / (aprovados + reprovados)
 * - Defeitos/100m: defeitos / metros * 100
 * - Pendencias: % de pendentes no periodo
 * - Tempo medio de analise: dias entre registro e decisao
 */
function getKPIDashboardData() {
  try {
    appLog('[APP] 📊 [KPI] Iniciando coleta consolidada de KPI Dashboard');

    // 1️⃣ BUSCAR UMA VEZ TODA A COLEÇÃO (mais rápido que N consultas por fase)
    const rawRows = DatabaseService.databaseQuery({ collection: 'INSPECOES' }) || [];
    const allRollosConsolidados = Array.isArray(rawRows) ? rawRows : (rawRows ? [rawRows] : []);
    
    // 2️⃣ DATAS PARA FILTRO MENSAL
    const now = new Date();
    const dataAtual = Utilities.formatDate(now, 'GMT-3', 'yyyy-MM-dd');
    const inicioMes = Utilities.formatDate(
      new Date(now.getFullYear(), now.getMonth(), 1),
      'GMT-3',
      'yyyy-MM-dd'
    );
    
    appLog('[APP] 📅 [KPI] Periodo: ' + inicioMes + ' ate ' + dataAtual);
    
    // 3️⃣ CONTAR POR FASE_ATUAL
    let aprovados = 0;
    let reprovados = 0;
    let pendentes = 0;
    let total_periodo = 0;
    let total_defeitos = 0;
    let total_metros = 0;
    let soma_tempo_dias = 0;
    let tempo_count = 0;

    function normalizeStatus(rolo) {
      return String(
        rolo.FASE_ATUAL || rolo.fase_atual || rolo.STATUS_FINAL || rolo.status_final ||
        rolo.STATUS_COMPRAS || rolo.status_compras || ''
      ).toLowerCase().trim();
    }

    function isAprovado(status) {
      return status.indexOf('aprovado') !== -1 || status === 'em_estoque';
    }

    function isReprovado(status) {
      return status.indexOf('reprovado') !== -1;
    }

    function isPendente(status) {
      return status.indexOf('aguardando') !== -1 || status.indexOf('revisao') !== -1 ||
        status.indexOf('pendente') !== -1 || status === 'em_revisao';
    }

    function getDateValue(rolo) {
      const raw = rolo.DATA_ATUALIZACAO || rolo.data_atualizacao ||
        rolo.DATA_REGISTRO || rolo.created_at || rolo.DATA_REVISAO || rolo.data_revisao || null;
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }

    function getMetros(rolo) {
      return Number(rolo.METROS_REVISADO || rolo.metros_revisado || rolo.METROS_FORNECEDOR || rolo.metros_fornecedor || 0) || 0;
    }

    function getDefeitosCount(rolo) {
      const raw = rolo.DEFEITOS || rolo.defeitos || [];
      if (Array.isArray(raw)) return raw.length;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch (e) {
          return 0;
        }
      }
      return 0;
    }
    
    allRollosConsolidados.forEach(function(rolo) {
      if (!rolo) return;
      
      // Campo de fase (pode vir em diferentes formatos)
      const faseAtual = normalizeStatus(rolo);
      const data = getDateValue(rolo);
      if (!data) return;

      const dataStr = Utilities.formatDate(data, 'GMT-3', 'yyyy-MM-dd');
      if (dataStr < inicioMes || dataStr > dataAtual) return;

      total_periodo++;

      if (isAprovado(faseAtual)) aprovados++;
      if (isReprovado(faseAtual)) reprovados++;
      if (isPendente(faseAtual)) pendentes++;

      total_defeitos += getDefeitosCount(rolo);
      total_metros += getMetros(rolo);

      if (isAprovado(faseAtual) || isReprovado(faseAtual)) {
        const dataRegistro = rolo.DATA_REGISTRO || rolo.created_at || null;
        if (dataRegistro) {
          const dRegistro = new Date(dataRegistro);
          if (!isNaN(dRegistro.getTime())) {
            const diffDias = (data.getTime() - dRegistro.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDias >= 0) {
              soma_tempo_dias += diffDias;
              tempo_count++;
            }
          }
        }
      }
    });

    const total_decisoes = aprovados + reprovados;
    const taxa_reprovacao = total_decisoes > 0
      ? Math.round((reprovados / total_decisoes) * 1000) / 10
      : 0;
    const defeitos_100m = total_metros > 0
      ? Math.round(((total_defeitos / total_metros) * 100) * 100) / 100
      : 0;
    const pendencias_pct = total_periodo > 0
      ? Math.round((pendentes / total_periodo) * 1000) / 10
      : 0;
    const tempo_medio_dias = tempo_count > 0
      ? Math.round((soma_tempo_dias / tempo_count) * 10) / 10
      : 0;

    appLog('[APP] ✅ [KPI] Periodo total: ' + total_periodo);
    
    // 5️⃣ RETORNAR DADOS ESTRUTURADOS
    const resultado = {
      status: 'sucesso',
      timestamp: dataAtual,
      kpi: {
        reprovacao: taxa_reprovacao,
        defeitos_100m: defeitos_100m,
        pendencias_pct: pendencias_pct,
        tempo_medio_dias: tempo_medio_dias,
        total_periodo: total_periodo,
        aprovados_periodo: aprovados,
        reprovados_periodo: reprovados,
        pendentes_periodo: pendentes
      }
    };
    
    appLog('[APP] 📊 [KPI] Resultado final: ' + JSON.stringify(resultado));
    return resultado;
    
  } catch (error) {
    Logger.log('[APP] ❌ [KPI] Erro geral: ' + error.message);
    Logger.log('[APP] STACK: ' + error.stack);
    
    return {
      status: 'erro',
      mensagem: error.message,
      kpi: {
        reprovacao: 0,
        defeitos_100m: 0,
        pendencias_pct: 0,
        tempo_medio_dias: 0,
        total_periodo: 0,
        aprovados_periodo: 0,
        reprovados_periodo: 0,
        pendentes_periodo: 0
      }
    };
  }
}