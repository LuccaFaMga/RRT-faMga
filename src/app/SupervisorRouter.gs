/*******************************************************************
* RRT_SupervisorRouter.gs — Router do Supervisor (v1.6 revisado)
*******************************************************************/

// Wrappers globais expostos ao front-end
function getRowForSupervisor(idRolo) {
  LogApp.log(`[GLOBAL] getRowForSupervisor(id=${idRolo})`, LogApp.LEVELS.INFO);
  try {
    return SupervisorFlows.getRowForSupervisor(idRolo);
  } catch (err) {
    LogApp.log(`Erro em getRowForSupervisor: ${err}`, LogApp.LEVELS.ERROR);
    throw err;
  }
}

function processSupervisorDecision(payload) {
  LogApp.log(`[GLOBAL] processSupervisorDecision payload=${JSON.stringify(payload)}`, LogApp.LEVELS.INFO);
  try {
    return SupervisorFlows.processSupervisorDecision(payload);
  } catch (err) {
    LogApp.log(`Erro em processSupervisorDecision: ${err}`, LogApp.LEVELS.ERROR);
    throw err;
  }
}

// Legado
function processarDecisao() {
  const args = JSON.stringify(Array.prototype.slice.call(arguments));
  LogApp.log(`[GLOBAL] processarDecisao args=${args}`, LogApp.LEVELS.INFO);
  try {
    return SupervisorFlows.processarDecisao.apply(null, arguments);
  } catch (err) {
    LogApp.log(`Erro em processarDecisao: ${err}`, LogApp.LEVELS.ERROR);
    throw err;
  }
}

function doGet(e) {
  try {
    LogApp.log(`[ROUTER] doGet chamado com parametros: ${JSON.stringify(e?.parameter || {})}`, LogApp.LEVELS.INFO);

    if (e?.parameter?.supervisor) {
      const id = String(e.parameter.idRolo || "").trim();
      const decision = String(e.parameter.decision || "").trim();
      const nome = String(e.parameter.nome || "Supervisor").trim();

      if (!id) {
        LogApp.log("[ROUTER] Falha: idRolo ausente.", LogApp.LEVELS.WARN);
        return HtmlService.createHtmlOutput("ID inválido.");
      }

      return renderSupervisorPage(id, decision, nome);
    }

    return HtmlService.createTemplateFromFile("ui/reviewer")
      .evaluate()
      .setTitle("RRT Revisão de Tecidos");

  } catch (err) {
    LogApp.log(`Erro no doGet: ${err}`, LogApp.LEVELS.ERROR);
    return HtmlService.createHtmlOutput("Erro: " + err.message);
  }
}

function renderSupervisorPage(id, prefillDecision, supervisorNome) {
  LogApp.log(`[ROUTER] renderSupervisorPage(id=${id}, decision=${prefillDecision})`, LogApp.LEVELS.DEBUG);

  const t = HtmlService.createTemplateFromFile('supervisor');

  t.idRolo = id;
  t.prefillDecision = prefillDecision;
  t.SUPERVISOR_NOME = supervisorNome;

  try {
    const row = SupervisorFlows.getRowForSupervisor(id);

    if (!row) {
      LogApp.log(`[ROUTER] Nenhum registro encontrado para ID '${id}'.`, LogApp.LEVELS.WARN);
    }

    t.statusSupervisor = row?.["Status Supervisor"]?.toString().trim().toUpperCase() || "";
    t.statusDoRolo = row?.["Status do Rolo"]?.toString().trim() || "";
    t.localizador = row?.["Localizador"] || row?.["localizacao"] || "";
    t.destino = row?.["Destino do Rolo"] || "";

  } catch (err) {
    LogApp.log(`Erro ao buscar dados do supervisor page: ${err}`, LogApp.LEVELS.ERROR);

    t.statusSupervisor = "";
    t.statusDoRolo = "";
    t.localizador = "";
    t.destino = "";
  }

  return t.evaluate()
    .setTitle("RRT — Decisão Supervisor")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
