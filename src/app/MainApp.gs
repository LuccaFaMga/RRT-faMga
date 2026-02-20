/*******************************************************************
 * RRT_Main.gs — FACADE PRINCIPAL DO PROCESSO RRT (versão REVISADA)
 *******************************************************************/


// ----------------------------
// HELPERS
// ----------------------------
function gerarIdCurto() {
  const d = new Date();
  const dd = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMMdd");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RRT-${dd}-${rand}`;
}

function extractFileId(s) {
  if (!s) return "";
  const m = String(s).match(/[-\w]{25,}/);
  return m ? m[0] : "";
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getActiveUserEmail() {
  try {
    return Session.getActiveUser().getEmail();
  } catch (e) {
    LogApp.log("getActiveUserEmail: " + (e.message || e), LogApp.LEVELS.WARN);
    return "";
  }
}

// buildApprovalLink — usa CONFIG.URL.SUPERVISOR_APP quando disponível,
// senão tenta ScriptApp.getService().getUrl() como fallback.
function buildApprovalLink(idRolo, decision) {
  try {
    const base = (CONFIG && CONFIG.URL && CONFIG.URL.SUPERVISOR_APP) ?
      CONFIG.URL.SUPERVISOR_APP :
      (ScriptApp.getService && ScriptApp.getService().getUrl ? ScriptApp.getService().getUrl() : "");

    const nomeSupervisor = encodeURIComponent((CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.SUPERVISOR_NOME) || CONFIG.SUPERVISOR_NOME || "Supervisor");

    return base +
      "?supervisor=1" +
      "&idRolo=" + encodeURIComponent(idRolo) +
      "&decision=" + encodeURIComponent(decision || "") +
      "&nome=" + nomeSupervisor +
      "&fromEmail=1";
  } catch (e) {
    LogApp.log("buildApprovalLink error: " + (e.message || e), LogApp.LEVELS.ERROR);
    return "";
  }
}

// ----------------------------
// parseDateFromString
// ----------------------------
function parseDateFromString(dateString) {
  if (!dateString || typeof dateString !== "string") return null;

  const parts = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (!parts) return null;

  const dt = new Date(
    parseInt(parts[3], 10),
    parseInt(parts[2], 10) - 1,
    parseInt(parts[1], 10),
    parseInt(parts[4], 10),
    parseInt(parts[5], 10),
    parseInt(parts[6], 10)
  );

  return isNaN(dt.getTime()) ? null : dt;
}

// ----------------------------
// UPLOAD IMG → DRIVE
// ----------------------------
function saveBase64ImageToDrive(base64orDataUrl, mimeType, filename) {
  try {
    let b64 = base64orDataUrl;

    if (String(base64orDataUrl).startsWith("data:")) {
      const m = String(base64orDataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
      if (m) {
        mimeType = mimeType || m[1];
        b64 = m[2];
      }
    }

    const bytes = Utilities.base64Decode(String(b64));
    const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", filename);

    const folderId = (CONFIG && CONFIG.IDS && CONFIG.IDS.OUTPUT_FOLDER) ? CONFIG.IDS.OUTPUT_FOLDER : (CONFIG && CONFIG.OUTPUT_FOLDER_ID);
    if (!folderId) throw new Error("OUTPUT_FOLDER não configurada.");

    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);

    LogApp.log(`saveBase64ImageToDrive: arquivo criado ${file.getId()}`, LogApp.LEVELS.DEBUG);

    return { status: "SUCESSO", id: file.getId(), url: file.getUrl() };
  } catch (err) {
    LogApp.log("saveBase64ImageToDrive error: " + (err.message || err), LogApp.LEVELS.ERROR);
    return { status: "FALHA", message: err && err.message ? err.message : String(err) };
  }
}

// ----------------------------
// DEFECTS → SERIALIZE FOR SHEET
// ----------------------------
function serializeDefectsForSheet(defects) {
  try {
    const safe = (defects || []).map((d) => ({
      id: d.id || null,
      tipo: d.tipo || d.nome || "",
      descricao: d.descricao || d.obs || "",
      metroIni: d.metroIni || d.inicio || null,
      metroFim: d.metroFim || d.fim || null,
      fotoId: d.fotoId || extractFileId(d.fotoRaw || d.fotoBase64 || ""),
      filename: d.filename || "",
      criadoEm: d.criadoEm || ""
    }));

    let json = JSON.stringify(safe);
    const limit = 40000;

    if (json.length > limit) {
      LogApp.log("serializeDefectsForSheet: payload grande, aplicando redução", LogApp.LEVELS.WARN);
      const reduced = safe.map((s) => ({
        id: s.id,
        tipo: s.tipo,
        metroIni: s.metroIni,
        metroFim: s.metroFim,
        fotoId: s.fotoId
      }));
      json = JSON.stringify(reduced);
      if (json.length > limit) {
        json = json.substring(0, limit - 50) + "...(truncado)";
      }
    }

    return json;
  } catch (e) {
    LogApp.log("serializeDefectsForSheet error: " + (e.message || e), LogApp.LEVELS.ERROR);
    return "[]";
  }
}

// ----------------------------
// UPLOAD FOTO (client)
// ----------------------------
function uploadDefectPhoto(payload) {
  try {
    if (!payload || (!payload.data && !payload.defectFile)) {
      throw new Error("Dados incompletos para upload.");
    }

    const folderId = (CONFIG && CONFIG.IDS && CONFIG.IDS.OUTPUT_FOLDER) ? CONFIG.IDS.OUTPUT_FOLDER : (CONFIG && CONFIG.OUTPUT_FOLDER_ID);
    if (!folderId) throw new Error("OUTPUT_FOLDER não configurada.");

    const folder = DriveApp.getFolderById(folderId);
    let file;

    if (payload.defectFile) {
      file = folder.createFile(payload.defectFile);
    } else {
      let b64 = String(payload.data || "");
      const m = b64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);

      if (m) {
        payload.mimeType = payload.mimeType || m[1];
        b64 = m[2];
      }

      const bytes = Utilities.base64Decode(b64);
      const ext = (payload.mimeType && payload.mimeType.split("/")[1]) || "jpg";
      const name = payload.filename || `Foto_${payload.defectIndex || Date.now()}.${ext}`;

      const blob = Utilities.newBlob(bytes, payload.mimeType || "image/jpeg", name);
      file = folder.createFile(blob);
    }

    LogApp.log(`uploadDefectPhoto: arquivo ${file.getId()} criado.`, LogApp.LEVELS.DEBUG);

    return {
      status: "SUCESSO",
      id: file.getId(),
      url: file.getUrl()
    };
  } catch (e) {
    LogApp.log("uploadDefectPhoto error: " + (e.message || e), LogApp.LEVELS.ERROR);
    return { status: "FALHA", message: e && e.message ? e.message : String(e) };
  }
}

// ----------------------------
// UI
// ----------------------------
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("⚙️ RRT WEB")
      .addItem("Abrir Formulário", "showWebInterface")
      .addToUi();
  } catch (e) {
    LogApp.log("onOpen error: " + (e.message || e), LogApp.LEVELS.WARN);
  }
}

function showWebInterface() {
  try {
    const html = HtmlService.createTemplateFromFile("ui/reviewer")
      .evaluate()
      .setTitle("RRT - Revisão de Tecidos")
      .setWidth(420);

    SpreadsheetApp.getUi().showSidebar(html);
  } catch (e) {
    LogApp.log("showWebInterface error: " + (e.message || e), LogApp.LEVELS.ERROR);
  }
}

// ----------------------------
// doGet
// ----------------------------
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const supervisorMode = p.supervisor === "1";
    const idRolo = p.idRolo || "";
    const decision = p.decision || "";

    if (supervisorMode && !idRolo) {
      return HtmlService.createHtmlOutput(
        "<h3>❌ Erro: ID do rolo não informado.</h3><p>O link recebido está incompleto. Peça um novo link ao revisor.</p>"
      );
    }

    if (supervisorMode) {
      const t = HtmlService.createTemplateFromFile("ui/supervisor");
      t.idRolo = idRolo;
      t.prefillDecision = decision;
      t.SUPERVISOR_NOME = (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.SUPERVISOR_NOME) || CONFIG.SUPERVISOR_NOME || "Supervisor";

      return t.evaluate()
        .setTitle("RRT — Supervisor")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    const t = HtmlService.createTemplateFromFile("ui/reviewer");
    return t.evaluate()
      .setTitle("RRT — Revisão")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    LogApp.log("doGet error: " + (err.message || err), LogApp.LEVELS.ERROR);
    return HtmlService.createHtmlOutput("<h3>❌ Erro interno:</h3><pre>" + (err.message || err) + "</pre>");
  }
}

// ----------------------------
// PROCESSAR RRT (REVISOR)
// ----------------------------
function processarRRT_Web(rawMainData) {
  try {
    const mainData = Object.assign({}, rawMainData);

    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    const statusRevisor = (rawMainData.status_rolo || "PENDENTE").toString().toUpperCase();
    const statusFinal = (statusRevisor === "REPROVADO" || statusRevisor === "EM ANÁLISE") ? "EM ANÁLISE" : statusRevisor;
    const requiresSupervisor = statusFinal === "EM ANÁLISE";

    mainData["Carimbo de data/hora"] = ts;
    mainData["data_envio"] = ts;
    mainData["Status do Rolo (Revisor)"] = statusRevisor;
    mainData["Status do Rolo"] = statusFinal;

    mainData["ID do Rolo"] = (CONFIG && CONFIG.GENERATE_ID) ? gerarIdCurto() : (rawMainData.numero_peca || "ID-" + Date.now());

    if (mainData.peso_fornecedor && !mainData.peso_fabrica) {
      mainData.peso_fabrica = mainData.peso_fornecedor;
    }

    let defects = Array.isArray(rawMainData.defects) ? rawMainData.defects : [];

    // Upload fotos dos defeitos (quando fornecidas em base64/raw)
    for (let i = 0; i < defects.length; i++) {
      const d = defects[i];
      try {
        if (!d.fotoId && (d.fotoBase64 || d.fotoRaw)) {
          const data = d.fotoBase64 || d.fotoRaw;
          let mime = "image/jpeg";
          const m = String(data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
          if (m) mime = m[1];
          const filename = d.filename || `def_${mainData["ID do Rolo"]}_${i + 1}.jpg`;
          const res = saveBase64ImageToDrive(data, mime, filename);
          if (res.status === "SUCESSO") d.fotoId = res.id;
          else LogApp.log(`Upload foto falhou para defeito ${i}: ${res.message}`, LogApp.LEVELS.WARN);
        }
      } catch (uploadErr) {
        LogApp.log("Erro no upload de foto: " + (uploadErr.message || uploadErr), LogApp.LEVELS.WARN);
      }
    }

    const photoIds = defects.map(d => d.fotoId).filter(Boolean);

    // Formatadores — padronizado para nome RRT_*
    try {
      if (typeof RRT_FormatarDefeitos === "function") {
        mainData.DEFEITOS_FORMATADOS = RRT_FormatarDefeitos(defects);
      } else {
        mainData.DEFEITOS_FORMATADOS = "Formatador de defeitos não disponível.";
        LogApp.log("RRT_FormatarDefeitos não encontrado.", LogApp.LEVELS.WARN);
      }
    } catch (err) {
      mainData.DEFEITOS_FORMATADOS = "Erro ao formatar defeitos: " + (err.message || err);
      LogApp.log("Erro em RRT_FormatarDefeitos: " + (err.message || err), LogApp.LEVELS.ERROR);
    }

    try {
      if (typeof RRT_FormatarFotos === "function") {
        mainData.FOTOS_LISTAGEM = RRT_FormatarFotos(defects);
      } else {
        mainData.FOTOS_LISTAGEM = "Formatador de fotos não disponível.";
        LogApp.log("RRT_FormatarFotos não encontrado.", LogApp.LEVELS.WARN);
      }
    } catch (err) {
      mainData.FOTOS_LISTAGEM = "Erro ao formatar fotos: " + (err.message || err);
      LogApp.log("Erro em RRT_FormatarFotos: " + (err.message || err), LogApp.LEVELS.ERROR);
    }

    // Geração de PDFs — exige função externa generateAllDocs
    if (typeof generateAllDocs !== "function") {
      throw new Error("generateAllDocs não encontrado.");
    }

    const docs = generateAllDocs(mainData, defects, photoIds);
    const relUrl = docs && docs.relatorioFile ? docs.relatorioFile.getUrl() : "";
    const anexUrl = docs && docs.anexoFotosFile ? docs.anexoFotosFile.getUrl() : "";

    const safeJsonString = serializeDefectsForSheet(defects);

    if (typeof updateRRTLog !== "function") {
      throw new Error("updateRRTLog não encontrado.");
    }

    // updateRRTLog espera objeto para defects? seu serviço lida com JSON; manter compat.
    try {
      const defectsObj = JSON.parse(safeJsonString || "[]");
      updateRRTLog(mainData, defectsObj, relUrl, anexUrl);
    } catch (e) {
      // fallback: passa string caso parse falhe
      LogApp.log("Falha ao parsear defects JSON antes de updateRRTLog: " + (e.message || e), LogApp.LEVELS.WARN);
      updateRRTLog(mainData, [], relUrl, anexUrl);
    }

    // Email supervisor quando necessário
    if (requiresSupervisor) {
      if (typeof sendCompletionEmail === "function") {
        const linkA = buildApprovalLink(mainData["ID do Rolo"], "APROVADO");
        const linkR = buildApprovalLink(mainData["ID do Rolo"], "REPROVADO");
        try {
          sendCompletionEmail(mainData, defects, docs, linkA, linkR);
        } catch (mailErr) {
          LogApp.log("sendCompletionEmail error: " + (mailErr.message || mailErr), LogApp.LEVELS.ERROR);
        }
      } else {
        LogApp.log("sendCompletionEmail não encontrado; e-mail não enviado.", LogApp.LEVELS.WARN);
      }
    }

    return { status: "SUCESSO", id: mainData["ID do Rolo"], relUrl, anexUrl };
  } catch (e) {
    LogApp.log("processarRRT_Web error: " + (e.message || e), LogApp.LEVELS.CRITICAL);
    return { status: "FALHA", message: e && e.message ? e.message : String(e) };
  }
}

// ----------------------------
// DECISÃO SUPERVISOR
// ----------------------------
function processarDecisaoSupervisor(payload) {
  try {
    if (typeof SupervisorFlows !== "undefined" && typeof SupervisorFlows.processarDecisao === "function") {
      return SupervisorFlows.processarDecisao(payload);
    }
    LogApp.log("SupervisorFlows.processarDecisao não disponível.", LogApp.LEVELS.WARN);
    return { status: "FALHA", message: "SupervisorFlows não encontrado" };
  } catch (e) {
    LogApp.log("processarDecisaoSupervisor error: " + (e.message || e), LogApp.LEVELS.ERROR);
    return { status: "FALHA", message: e.message };
  }
}
