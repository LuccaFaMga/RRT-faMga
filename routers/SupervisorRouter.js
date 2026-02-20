/*******************************************************************
* RRT_SupervisorRouter.gs — Router do Supervisor (v1.6 revisado)
* ATENÇÃO: doGet removido. Quem roteia é apenas o MAIN.doGet.
*******************************************************************/

// Wrappers globais expostos ao front-end
function getRowForSupervisor(idRolo) {
  LogApp.log(`[GLOBAL] getRowForSupervisor(id=${idRolo})`, LogApp.LEVELS.INFO);
  try {
    return SupervisorController.getRowForSupervisor(idRolo);
  } catch (err) {
    LogApp.log(`Erro em getRowForSupervisor: ${err}`, LogApp.LEVELS.ERROR);
    throw err;
  }
}

function processSupervisorDecision(payload) {
  LogApp.log(
    `[GLOBAL] processSupervisorDecision payload=${JSON.stringify(payload)}`,
    LogApp.LEVELS.INFO
  );
  try {
    return SupervisorController.processSupervisorDecision(payload);
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
    return SupervisorController.processarDecisao.apply(null, arguments);
  } catch (err) {
    LogApp.log(`Erro em processarDecisao: ${err}`, LogApp.LEVELS.ERROR);
    throw err;
  }
}

function renderSupervisorPage(id, prefillDecision, supervisorNome) {
  LogApp.log(
    `[ROUTER] renderSupervisorPage(id=${id}, decision=${prefillDecision})`,
    LogApp.LEVELS.DEBUG
  );

  const t = HtmlService.createTemplateFromFile('ui/supervisor');

  t.idRolo          = id;
  t.prefillDecision = prefillDecision;
  t.SUPERVISOR_NOME = supervisorNome;

  try {
    const row = SupervisorController.getRowForSupervisor(id);

    if (!row) {
      LogApp.log(
        `[ROUTER] Nenhum registro encontrado para ID '${id}'.`,
        LogApp.LEVELS.WARN
      );
    }

    t.statusSupervisor = row?.status_supervisor?.toString().trim().toUpperCase() || '';
    t.statusDoRolo     = row?.status_rolo || row?.status_do_rolo || '';
    t.localizador      = row?.localizador || row?.localizacao || '';
    t.destino          = row?.destino_do_rolo || row?.destino || '';

  } catch (err) {
    LogApp.log(
      `Erro ao buscar dados do supervisor page: ${err}`,
      LogApp.LEVELS.ERROR
    );

    t.statusSupervisor = '';
    t.statusDoRolo     = '';
    t.localizador      = '';
    t.destino          = '';
  }

  return t.evaluate()
    .setTitle('RRT — Decisão Supervisor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
