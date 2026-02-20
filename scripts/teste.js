function setupFormatsInspecoes() {
  const sheetId = (typeof CONFIG !== "undefined" && CONFIG.IDS && CONFIG.IDS.SHEET_ID)
    ? CONFIG.IDS.SHEET_ID
    : null;

  if (!sheetId) throw new Error("CONFIG.IDS.SHEET_ID não está definido.");

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName("INSPECOES");
  if (!sh) throw new Error("Aba INSPECOES não encontrada.");

  const lastCol = sh.getLastColumn();
  const lastRow = Math.max(sh.getLastRow(), 2); // garante pelo menos header+1

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  const colIndex = (name) => headers.indexOf(name) + 1;

  const setFmt = (name, pattern) => {
    const c = colIndex(name);
    if (c <= 0) {
      LogApp?.log?.(`⚠️ Coluna não encontrada: ${name}`, LogApp.LEVELS?.WARN ?? 2);
      return;
    }
    sh.getRange(2, c, lastRow - 1, 1).setNumberFormat(pattern);
  };

  // Numéricos (ajuste padrões conforme seu uso)
  setFmt("LARGURA_CM", "0.00");
  setFmt("METROS_FORNECEDOR", "0.00");
  setFmt("METROS_REVISADO", "0.00");
  setFmt("PESO_KG", "0.00");
  setFmt("AREA_M2", "0.00");
  setFmt("PONTOS", "0");            // <-- evita 1900-01-02
  setFmt("TEMPO_TOTAL_SEG", "0");

  LogApp?.log?.("✅ Formatos da aba INSPECOES aplicados.", LogApp.LEVELS?.INFO ?? 1);
}
