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
 *   🧭 WEB APP ROUTER: doGet(e) - API ONLY
 * ============================================================ */
function doGet(e) {
    const traceId = Utilities.getUuid().slice(0, 8);
    Logger.log(`[DOGET][${traceId}] START`);

    try {
        // JSONP API fallback para evitar CORS em UI estática
        if (e.parameter && e.parameter.callback && e.parameter.payload) {
            const callbackName = String(e.parameter.callback).replace(/[^a-zA-Z0-9_$]/g, '_') || 'callback';
            let response;
            try {
                const payload = JSON.parse(e.parameter.payload);
                response = processRequestPayload(payload);
            } catch (err) {
                response = { status: 'FALHA', message: `Payload inválido: ${err.message}` };
            }

            const js = `${callbackName}(${JSON.stringify(response)});`;
            return ContentService
                .createTextOutput(js)
                .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }

        // Mensagem informativa para acesso direto
        return ContentService
            .createTextOutput("RRT API - Use POST para acessar funcionalidades. Para o app completo, acesse: https://luccafamga.github.io/RRT-faMga/ui/")
            .setMimeType(ContentService.MimeType.TEXT);

    } catch (err) {
        Logger.log(`[DOGET][${traceId}] ❌ ERROR: ${err.message}`);
        return ContentService
            .createTextOutput(`Erro: ${err.message}`)
            .setMimeType(ContentService.MimeType.TEXT);
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
