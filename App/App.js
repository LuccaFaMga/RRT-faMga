/*******************************************************************
 * MainApp.gs v2.5 - CORS FIX VERSION
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

function sanitizeFilename(name) {
    return String(name || "").replace(/[^\w.\-]+/g, "_").substring(0, 80);
}

function ensureNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const num = Number(String(value).replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

/* ============================================================
 *   🧭 REQUEST HANDLER: processRequestPayload(payload)
 * ============================================================ */
function processRequestPayload(payload) {
    let response;

    try {
        const action = payload.action || "processar_revisao";

        switch (action) {
            case "processar_revisao": response = processarRRT_Web(payload); break;
            case "supervisor_update": response = handleSupervisorUpdate(payload); break;
            case "supervisor_decision": response = handleSupervisorDecision(payload); break;
            case "runFunction": response = runBackendFunction(payload); break;
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

    return response;
}

/* ============================================================
 *   🧭 WEB APP ROUTER: doGet(e)
 * ============================================================ */
function doGet(e) {
    const traceId = Utilities.getUuid().slice(0, 8);
    Logger.log(`[DOGET][${traceId}] START`);

    try {
        const p = e && e.parameter ? e.parameter : {};
        Logger.log(`[DOGET][${traceId}] PARAMS: ${JSON.stringify(p)}`);

        // JSONP API fallback para evitar CORS em UI estática
        if (p.callback && p.payload) {
            const callbackName = String(p.callback).replace(/[^a-zA-Z0-9_$]/g, '_') || 'callback';
            let response;
            try {
                const payload = JSON.parse(p.payload);
                response = processRequestPayload(payload);
            } catch (err) {
                response = { status: 'FALHA', message: `Payload inválido: ${err.message}` };
            }

            const js = `${callbackName}(${JSON.stringify(response)});`;
            return ContentService
                .createTextOutput(js)
                .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }

        const page = p.page || "supervisor";
        Logger.log(`[DOGET][${traceId}] PAGE RESOLVED: "${page}"`);

        const appUrl = ScriptApp.getService().getUrl();
        let template;

        switch (page) {
            case "supervisor":
                template = handleSupervisorPage(p);
                break;
            case "estoque":
                template = handleEstoquePage(p);
                break;
            case "compras":
                template = handleComprasPage(p);
                break;
            case "export":
                return handlePowerBIExport(p);
            case "reviewer":
                template = handleReviewerPage(p);
                break;
            default:
                return ContentService.createTextOutput("API endpoint - use POST para acessar funcionalidades").setMimeType(ContentService.MimeType.TEXT);
        }

        if (!template) {
            throw new Error(`Template não definido para page="${page}"`);
        }

        if (template.getContent) {
            Logger.log(`[DOGET][${traceId}] HtmlOutput detectado → retorno direto`);
            return template.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }

        template.APP_URL = appUrl;
        const output = template.evaluate()
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
            .setTitle(`RRT - ${page.charAt(0).toUpperCase() + page.slice(1)}`);

        Logger.log(`[DOGET][${traceId}] END OK`);
        return output;

    } catch (err) {
        Logger.log(`[DOGET][${traceId}] ❌ ERROR: ${err.message}`);
        const errorOutput = HtmlService.createHtmlOutput(`
            <h3>Erro crítico no carregamento</h3>
            <p><strong>${err.message}</strong></p>
        `);
        return errorOutput;
    }
}

/* ============================================================
 *   ⚡️ HTTP POST HANDLER: doPost(e) - COM CORS
 * ============================================================ */
function doPost(e) {
    let response;

    try {
        let payload;
        if (e.postData && e.postData.type === 'application/x-www-form-urlencoded' && e.parameter && e.parameter.payload) {
            payload = JSON.parse(decodeURIComponent(e.parameter.payload));
        } else if (e.postData && e.postData.contents) {
            payload = JSON.parse(e.postData.contents);
        } else {
            throw new Error('Corpo da requisição inválido');
        }

        response = processRequestPayload(payload);
    } catch (err) {
        response = { status: "FALHA", message: err.message };
    }

    return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*')
        .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ============================================================
 *   🌐 CORS HANDLER: doOptions(e)
 * ============================================================ */
function doOptions(e) {
    return ContentService
        .createTextOutput('')
        .setMimeType(ContentService.MimeType.TEXT)
        .addHeader('Access-Control-Allow-Origin', '*')
        .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ============================================================
 *   🔧 BACKEND FUNCTION RUNNER
 * ============================================================ */
function runBackendFunction(payload) {
    const functionName = String(payload?.functionName || '').trim();
    const args = Array.isArray(payload?.args) ? payload.args : (payload?.args === undefined ? [] : [payload.args]);

    const allowedFunctions = {
        processarRRT_Web,
        getKPIDashboardData,
        getKPIDashboardData_Web,
        getRollsByStatus_Web,
        getRollsByStatus,
        getComprasCases_Web,
        getComprasCases,
        getSolicitacoesCorte_Web,
        getSolicitacoesCorte,
        getReviewerMetrics_Web,
        getReviewerMetricsRange_Web,
        processSupervisorDecision_Web,
        processarDecisaoComprasV2_Web,
        atualizarPendenciaCompras_Web,
        sendProactiveNotifications_Web,
        registrarSolicitacaoCorte_Web,
        getFotosByRevisionId_Web,
        getImageAsBase64_Web
    };

    const fn = allowedFunctions[functionName];
    if (typeof fn !== 'function') {
        throw new Error(`Função de backend não permitida: ${functionName}`);
    }

    return fn.apply(null, args);
}

/* ============================================================
 *   PAGE HANDLERS
 * ============================================================ */
function handleSupervisorPage(params) {
    const template = HtmlService.createTemplateFromFile("supervisor");
    template.error = null;
    template.idRolo = "";
    template.prefillDecision = "";
    template.rollData = null; 
    template.SUPERVISOR_NOME = params.user || Session.getActiveUser().getEmail(); 
    return template;
}

function handleEstoquePage(params) {
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
    return template;
}

/* ============================================================
 *   STOCK ACTIONS
 * ============================================================ */
function handleStockAction(payload) {
    const { action, id, data } = payload;
    if (action === "stock_update") {
        return DatabaseService.rolls.update(id, data);
    }
    if (action === "stock_delete") return DatabaseService.rolls.delete(id);
    throw new Error(`Ação desconhecida: ${action}`);
}

/* ============================================================
 *   SUPERVISOR ACTIONS
 * ============================================================ */
function handleSupervisorUpdate(payload) {
    const { id, updates, user } = payload;
    for (const [key, value] of Object.entries(updates)) {
        DatabaseService.rolls.update(id, { [key]: value });
    }
    return { status: "SUCESSO", message: `Rolo ${id} atualizado.` };
}

function handleSupervisorDecision(payload) {
    const { id, decision, user, observacoes } = payload;
    const next = decision === "APROVADO" ? "aprovado_supervisor" : "reprovado_supervisor";
    WorkflowService.transition(id, next, { usuario: user, notas: observacoes || "" });
    return { status: "SUCESSO", id, fase_atual: next };
}
