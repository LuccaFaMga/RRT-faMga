/*******************************************************************
* RRT_ComprasRouter.gs — Router do Setor de Compras (v1.0)
*******************************************************************/

// Assumindo que a função principal do ComprasController é processarDecisaoCompras_Web
// e que existe uma função de busca (ex: getRowForSupervisor adaptada)

/**
 * Busca dados brutos do rolo para exibição na tela de Compras.
 * @param {string} idRolo ID do Rolo
 * @returns {Object} Dados do rolo
 */
function getRowForCompras(idRolo) {
    LogApp.log(`[COMPRAS_ROUTER] getRowForCompras(id=${idRolo})`, LogApp.LEVELS.INFO);
    try {
        const doc = databaseGetReportById(idRolo);
        return doc ? doc.data : null;
    } catch (err) {
        LogApp.log(`Erro em getRowForCompras: ${err}`, LogApp.LEVELS.ERROR);
        throw err;
    }
}

/**
 * Wrapper Global exposto ao front-end para processar a decisão de Compras.
 * É chamado pelo doPost(e) ou diretamente pelo frontend (com google.script.run).
 * @param {Object} payload Dados da decisão.
 */
function processComprasDecision(payload) {
    LogApp.log(
        `[GLOBAL] processComprasDecision payload=${JSON.stringify(payload)}`,
        LogApp.LEVELS.INFO
    );
    // Assumindo que 'processarDecisaoCompras_Web' (implementado antes) é o Controller
    try {
        return processarDecisaoCompras_Web(payload);
    } catch (err) {
        LogApp.log(`Erro em processComprasDecision: ${err}`, LogApp.LEVELS.ERROR);
        // Garante que o frontend receba um objeto de falha
        return { status: "FALHA", message: err.message };
    }
}


/**
 * Renderiza a página de Decisão de Compras.
 * É chamado pelo MAIN.doGet.
 * @param {string} id ID do Rolo
 * @param {string} compradorNome Nome do comprador
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function renderComprasPage(id, compradorNome) {
    LogApp.log(
        `[ROUTER] renderComprasPage(id=${id})`,
        LogApp.LEVELS.DEBUG
    );

    const t = HtmlService.createTemplateFromFile('ui/compras');

    t.idRolo = id;
    t.COMPRADOR_NOME = compradorNome;

    try {
        const row = getRowForCompras(id); // Usa a função de busca local
        
        if (!row) {
             LogApp.log(`[ROUTER] Nenhum registro encontrado para ID '${id}'.`, LogApp.LEVELS.WARN);
        }
        
        // Dados adicionais que você pode querer mostrar na tela de Compras
        t.statusSupervisor = row?.status_supervisor || '';
        t.defeitosEncontrados = row?.defeitos?.length || 0;
        t.localizador = row?.localizacao || '';

    } catch (err) {
        LogApp.log(`Erro ao buscar dados para compras page: ${err}`, LogApp.LEVELS.ERROR);
        t.statusSupervisor = 'ERRO';
        t.defeitosEncontrados = 0;
        t.localizador = 'N/A';
    }

    return t.evaluate()
        .setTitle('RRT — Decisão Compras')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}