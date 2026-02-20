/**
 * SheetsDatabaseService v1.3 - COMPLETO
 * Mantém todas as 250 linhas de lógica original, corrigindo apenas as referências e nomes de abas.
 */

var SheetsDatabaseService = (function () {
  "use strict";

  /* ============================
   * ⚙️ CONFIGURAÇÃO
   * ============================ */
  const PROPS = PropertiesService.getScriptProperties();
  const SPREADSHEET_ID = PROPS.getProperty("RRT_DATABASE_SHEET_ID");

  const SHEETS = {
    ROLOS: "INSPECOES", // Sincronizado com setup
    DEFEITOS: "DEFEITOS",
    FOTOS: "FOTOS",
    AUDIT: "AUDIT",
    TELEMETRIA: "TELEMETRIA",
    TEMPOS: "TEMPOS_LOG"
  };

  /* ============================
   * 🔧 UTILITÁRIOS INTERNOS
   * ============================ */
  function nowBrasilia() {
    return Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
  }

  function getSS() {
    if (!SPREADSHEET_ID) throw new Error("RRT_DATABASE_SHEET_ID não configurado");
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  function getSheet(name) {
    const sh = getSS().getSheetByName(name);
    if (!sh) throw new Error(`Aba ${name} não encontrada. Execute setupDatabaseStructure().`);
    return sh;
  }

  function getHeaders(sheet) {
    const lastCol = sheet.getLastColumn();
    return lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  }

  function rowToObject(headers, row) {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  }

  function objectToRow(headers, obj) {
    return headers.map(h => {
      const key = Object.keys(obj).find(k => k.toLowerCase() === h.toLowerCase());
      const v = key ? obj[key] : "";
      if (v === null || v === undefined) return "";
      if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) {
        try { return JSON.stringify(v); } catch (e) { return String(v); }
      }
      return v;
    });
  }

  function findRowById(sheet, idField, idValue) {
    const headers = getHeaders(sheet);
    const idCol = headers.findIndex(h => h.toLowerCase() === idField.toLowerCase());
    if (idCol === -1) return null;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][idCol]) === String(idValue)) {
        return { rowIndex: i + 2, headers, row: values[i] };
      }
    }
    return null;
  }

  /* ============================
   * 📦 DEFINIÇÃO DOS MÓDULOS (Ordem corrigida)
   * ============================ */
  
  const Audit = {
    add(log) {
      const sh = getSheet(SHEETS.AUDIT);
      sh.appendRow(objectToRow(getHeaders(sh), { ...log, timestamp: nowBrasilia() }));
    }
  };

  const Telemetry = {
    add(event) {
      const sh = getSheet(SHEETS.TELEMETRIA);
      sh.appendRow(objectToRow(getHeaders(sh), { ...event, timestamp: nowBrasilia() }));
    }
  };

  const Rolls = {
    get(id) {
      const sh = getSheet(SHEETS.ROLOS);
      const found = findRowById(sh, "REVISION_ID", id) || findRowById(sh, "ID_ROLO", id);
      return found ? rowToObject(found.headers, found.row) : null;
    },
    create(id, data) {
      const sh = getSheet(SHEETS.ROLOS);
      const headers = getHeaders(sh);
      const payload = { ...data, REVISION_ID: id, DATA_REGISTRO: nowBrasilia() };
      sh.appendRow(objectToRow(headers, payload));
      return { id };
    },
    update(id, data) {
      const sh = getSheet(SHEETS.ROLOS);
      const found = findRowById(sh, "REVISION_ID", id) || findRowById(sh, "ID_ROLO", id);
      if (!found) return this.create(id, data);
      const updated = { ...rowToObject(found.headers, found.row), ...data };
      sh.getRange(found.rowIndex, 1, 1, found.headers.length).setValues([objectToRow(found.headers, updated)]);
      return { id };
    }
  };

  /* ============================
   * 🔍 CONSULTAS E LEGADO
   * ============================ */
  function databaseQuery(q) {
    const startTime = new Date().getTime();
    Logger.log('\n╔═════════════════════════════════════════════════╗');
    Logger.log('║ [SHEETS-DB] databaseQuery INICIADA             ║');
    Logger.log('╚═════════════════════════════════════════════════╝');
    
    try {
      // Análise do parâmetro
      Logger.log('[SHEETS-DB] 📥 Parâmetro recebido:');
      Logger.log('[SHEETS-DB]   - Tipo: ' + typeof q);
      Logger.log('[SHEETS-DB]   - JSON: ' + JSON.stringify(q));
      
      // Resolução do nome da aba
      const tabName = SHEETS[q.collection.toUpperCase()] || q.collection;
      Logger.log('[SHEETS-DB] 📋 Resolução da aba:');
      Logger.log('[SHEETS-DB]   - Input: "' + q.collection + '"');
      Logger.log('[SHEETS-DB]   - Após normalize: "' + (q.collection || '').toUpperCase() + '"');
      Logger.log('[SHEETS-DB]   - Resultado: "' + tabName + '"');
      
      // Carregamento da planilha
      Logger.log('[SHEETS-DB] 📂 Abrindo planilha...');
      const sh = getSheet(tabName);
      Logger.log('[SHEETS-DB] ✅ Planilha aberta');
      
      // Leitura dos headers
      Logger.log('[SHEETS-DB] 🔤 Lendo headers...');
      const headers = getHeaders(sh);
      Logger.log('[SHEETS-DB] Headers encontrados: ' + JSON.stringify(headers.slice(0, 5)) + '...');
      Logger.log('[SHEETS-DB] Total de colunas: ' + headers.length);
      
      // Carregamento das linhas
      Logger.log('[SHEETS-DB] 📊 Carregando dados...');
      const lastRow = sh.getLastRow();
      Logger.log('[SHEETS-DB] Última linha: ' + lastRow);
      
      if (lastRow < 2) {
        Logger.log('[SHEETS-DB] ⚠️ Nenhum dado encontrado (lastRow < 2)');
        return [];
      }
      
      const rowRange = sh.getRange(2, 1, lastRow - 1, headers.length);
      const values = rowRange.getValues();
      Logger.log('[SHEETS-DB] Linhas carregadas: ' + values.length);
      
      // Conversão para objetos
      Logger.log('[SHEETS-DB] 🔄 Convertendo linhas para objetos...');
      const rows = values.map(function(r) {
        return rowToObject(headers, r);
      });
      Logger.log('[SHEETS-DB] ✅ ' + rows.length + ' objetos criados');
      
      // Aplicação dos filtros WHERE
      if (!q.where) {
        Logger.log('[SHEETS-DB] ℹ️ Nenhum filtro WHERE, retornando todos os ' + rows.length + ' registros');
        return rows;
      }
      
      Logger.log('[SHEETS-DB] 🔍 Aplicando filtros WHERE...');
      Logger.log('[SHEETS-DB] Filtros: ' + JSON.stringify(q.where));
      
      const filtered = rows.filter(function(row) {
        return q.where.every(function(w) {
          const fieldValue = row[w.field];
          let match = false;
          
          if (w.op === '==') {
            match = fieldValue == w.value;
          } else if (w.op === 'in') {
            match = w.value.includes(fieldValue);
          }
          
          Logger.log('[SHEETS-DB]   Campo "' + w.field + '": ' + fieldValue + ' ' + w.op + ' ' + JSON.stringify(w.value) + ' = ' + match);
          return match;
        });
      });
      
      const elapsed = new Date().getTime() - startTime;
      Logger.log('\n╔═════════════════════════════════════════════════╗');
      Logger.log('║ [SHEETS-DB] ✅ RESULTADO                       ║');
      Logger.log('╚═════════════════════════════════════════════════╝');
      Logger.log('[SHEETS-DB] Registros encontrados: ' + filtered.length);
      Logger.log('[SHEETS-DB] Tempo total: ' + elapsed + 'ms');
      
      if (filtered.length > 0) {
        Logger.log('[SHEETS-DB] Primeiro registro:');
        const first = filtered[0];
        Logger.log('[SHEETS-DB]   - FORNECEDOR: ' + (first.FORNECEDOR || 'N/A'));
        Logger.log('[SHEETS-DB]   - ID_ROLO: ' + (first.ID_ROLO || 'N/A'));
        Logger.log('[SHEETS-DB]   - FASE_ATUAL: ' + (first.FASE_ATUAL || 'N/A'));
      }
      
      return filtered;
      
    } catch (error) {
      Logger.log('\n╔═════════════════════════════════════════════════╗');
      Logger.log('║ [SHEETS-DB] ❌ ERRO                            ║');
      Logger.log('╚═════════════════════════════════════════════════╝');
      Logger.log('[SHEETS-DB] Erro: ' + error.message);
      Logger.log('[SHEETS-DB] Stack: ' + error.stack);
      throw error;
    }
  }

  /* ============================
   * 🚀 API PÚBLICA (O que o App enxerga)
   * ============================ */
  return {
    rolls: Rolls,
    audit: Audit,
    telemetry: Telemetry,
    SHEET_TABS: SHEETS,
    databaseQuery,
    saveReport(report) {
      const id = report.REVISION_ID || report.id_do_rolo;
      return Rolls.update(id, report);
    },
    getReportById(id) { return Rolls.get(id); }
  };

})();