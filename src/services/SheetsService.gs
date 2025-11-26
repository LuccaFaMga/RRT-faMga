/*******************************************************************
 * RRT_SheetsService.gs (v2.0)
 * - findRowByValue otimizado
 * - ensureHeader agora retorna headers atualizados
 * - updateRRTLog com try/catch + logs críticos
 * - remoção de código duplicado
 * - funções auxiliares organizadas
 *******************************************************************/


// ----------------------------------------------------------
// LOCALIZA UMA LINHA PELO VALOR DE UMA COLUNA ESPECÍFICA
// ----------------------------------------------------------
function findRowByValue(sheet, headerName, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
                       .getValues()[0]
                       .map(h => String(h).trim());

  const colIndex = headers.indexOf(headerName);
  if (colIndex === -1) return -1;

  // Lê apenas a coluna necessária (muito mais rápido)
  const colValues = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1)
                         .getValues()
                         .map(r => String(r[0]).trim());

  const target = String(value).trim();
  const row = colValues.indexOf(target);

  return row >= 0 ? row + 2 : -1;
}


// ----------------------------------------------------------
// GARANTE QUE UM CABEÇALHO EXISTA, RETORNA (index, headersAtualizados)
// ----------------------------------------------------------
function ensureHeader(sheet, headers, name) {
  let idx = headers.indexOf(name);

  if (idx === -1) {
    const newColIndex = headers.length + 1;
    sheet.getRange(1, newColIndex).setValue(name);

    LogApp.log(
      `SheetsService: Cabeçalho '${name}' criado na coluna ${newColIndex}.`,
      LogApp.LEVELS.INFO
    );

    // Recarrega headers
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
                   .getValues()[0]
                   .map(h => String(h).trim());
    idx = headers.indexOf(name);
  }

  return { index: idx, headers };
}


// ----------------------------------------------------------
// FUNÇÃO AUXILIAR → ATUALIZA CAMPOS DO OBJETO mainData
// ----------------------------------------------------------
function writeMainData(sheet, rowNum, mainData, headers) {
  Object.keys(mainData).forEach(key => {
    if (key === "defects") return;

    const result = ensureHeader(sheet, headers, key);
    headers = result.headers;

    const col = result.index + 1;
    const val = mainData[key] ?? "";

    sheet.getRange(rowNum, col).setValue(val);
  });

  return headers;
}


// ----------------------------------------------------------
// ATUALIZA / INSERE LINHA DO RRT PRINCIPAL
// ----------------------------------------------------------
function updateRRTLog(mainData, defects, relatorioUrl, anexoFotosUrl) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.IDS.RRT_SPREADSHEET);
    const sheet = ss.getSheets()[0];

    const idRolo = mainData["ID do Rolo"];
    if (!idRolo) {
      throw new Error("mainData não contém 'ID do Rolo'.");
    }

    // Lê headers iniciais
    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
                       .getValues()[0]
                       .map(h => String(h).trim());

    // Encontra ou cria linha
    let rowNum = findRowByValue(sheet, "ID do Rolo", idRolo);
    const isNew = rowNum === -1;

    if (isNew) {
      rowNum = sheet.getLastRow() + 1;
      LogApp.log(`SheetsService: Inserindo nova linha em ${rowNum}.`, LogApp.LEVELS.INFO);
    }

    // Atualiza campos principais
    headers = writeMainData(sheet, rowNum, mainData, headers);

    // Campos fixos
    const extraCols = [
      { name: "Relatório PDF URL", value: relatorioUrl },
      { name: "Anexo PDF URL",     value: anexoFotosUrl },
      { name: "Defeitos (JSON)",   value: JSON.stringify(defects || []) },
      { name: "Status do Rolo (Revisor)", value: mainData["Status do Rolo (Revisor)"] || "" },
      { name: "Status do Rolo",           value: mainData["Status do Rolo"] || "" },
      { name: "Auditoria (JSON)",         value: "" }
    ];

    extraCols.forEach(entry => {
      const r = ensureHeader(sheet, headers, entry.name);
      headers = r.headers;
      sheet.getRange(rowNum, r.index + 1).setValue(entry.value);
    });

    LogApp.log(
      `SheetsService: Linha ${rowNum} atualizada com sucesso (novo: ${isNew}).`,
      LogApp.LEVELS.INFO
    );

  } catch (e) {
    LogApp.log(
      `ERRO ao atualizar planilha no updateRRTLog: ${e.stack || e}`,
      LogApp.LEVELS.CRITICAL
    );
  }
}
