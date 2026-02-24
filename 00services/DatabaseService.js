/**
 * DatabaseService v9.1 - POWER BI READY 
 * * 📊 MIGRAÇÃO: Google Sheets (ID: 1OgUSZSCBh54DUfuy8nvUYB2QZ2IR2o3UjUdnU2Gwj3E)
 */

var DatabaseService = (function () {
    "use strict";

    /* ============================
     * CONFIGURAÇÃO
     * ============================ */
    // 🆕 ADICIONADO: ID da planilha Google Sheets (substitui Firestore)
    const SHEET_ID = "1OgUSZSCBh54DUfuy8nvUYB2QZ2IR2o3UjUdnU2Gwj3E";
    const SHEET_TABS = {
        INSPECOES: "INSPECOES",
        DEFEITOS: "DEFEITOS",
        TEMPOS_LOG: "TEMPOS_LOG",
        HISTORICO: "HISTORICO",
        FOTOS: "FOTOS",
        AUDIT: "AUDIT",
        TELEMETRIA: "TELEMETRIA"
    };

    const SHEET_SCHEMAS = {
        INSPECOES: {
            LARGURA_CM: "number",
            METROS_FORNECEDOR: "number",
            METROS_REVISADO: "number",
            AREA_M2: "number",
            PONTOS: "number",
            DEFEITOS_TOTAIS: "number",
            TEMPO_TOTAL_SEG: "number"
        },
        DEFEITOS: {
            METRO_INICIAL: "number",
            METRO_FINAL: "number"
        },
        TEMPOS_LOG: {
            DURACAO_SEG: "number"
        },
        FOTOS: {}
    };

    const DB_DEBUG = false;

    function dbLog(message, force) {
        if (force || DB_DEBUG) Logger.log(message);
    }

    function coerceToCorrectType(value, header, schema) {
        if (!schema || !header || !schema[header]) return value;
        const type = schema[header];
        if (type === "number") return ensureNumber(value);
        if (type === "boolean") return value ? true : false;
        return value;
    }

    function getSpreadsheet() {
        const props = PropertiesService.getScriptProperties();
        const dynamicId = props ? props.getProperty("RRT_DATABASE_SHEET_ID") : "";
        const targetId = dynamicId || SHEET_ID;
        return SpreadsheetApp.openById(targetId);
    }

    function nowBrasilia() {
        return Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
    }

    function getSheetByName(sheetName) {
        dbLog(`[DB] getSheetByName chamada com: "${sheetName}"`);
        const ss = getSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            throw new Error(`Aba '${sheetName}' não encontrada na planilha.`);
        }
        return sheet;
    }

    /* ============================
     * FUNÇÃO DE INSERÇÃO ÚNICA (CORRIGIDA)
     * ============================ */
    function _insert(collection, docId, payload) {
        validateEssentialFields(payload, collection);
        const lock = LockService.getScriptLock();
        try {
            lock.waitLock(10000);
            
            const sheetName = SHEET_TABS[collection] || collection;
            const sheet = getSheetByName(sheetName);
            const headers = getCachedHeaders(sheetName);
            const schema = SHEET_SCHEMAS[sheetName];
            
            const data = { ...payload };

            // 1. Tratamento de IDs e Revision (Apenas para Inspeções)
            if (collection === "INSPECOES") {
                if (data.revisor_nome) data.REVISOR = data.revisor_nome;
                if (!data.REVISION_ID) data.REVISION_ID = generateShortRevisionId(data);            }

            // 2. Mapeamento QR Data (Se existir)
            if (data.qrData) {
                data.FORNECEDOR = data.qrData.supplier_name;
                data.NF = data.qrData.nf;
            }

            // 3. Preparar a linha respeitando a ordem das colunas
            const newRow = headers.map(header => {
                let val = data[header] !== undefined ? data[header] : "";
                return coerceToCorrectType(val, header, schema);
            });

            // 4. Adicionar Timestamps se as colunas existirem
            const headerMap = {};
            headers.forEach((h, i) => { headerMap[h] = i; });
            const now = nowBrasilia();
            if ("DATA_CRIACAO" in headerMap) newRow[headerMap["DATA_CRIACAO"]] = now;
            if ("DATA_ATUALIZACAO" in headerMap) newRow[headerMap["DATA_ATUALIZACAO"]] = now;

            // 5. Salvar na Planilha
            sheet.appendRow(newRow);
            SpreadsheetApp.flush();
            
            dbLog(`[DB] ✅ Sucesso: ${sheetName} | ID: ${data.REVISION_ID || docId}`);
            return { id: data.REVISION_ID || docId, ...data };

        } catch (error) {
            Logger.log(`[DB] ❌ Erro em _insert: ${error.message}`);
            throw error;
        } finally {
            lock.releaseLock();
        }
    }

    /* ============================
     * 🆕 ADICIONADO: UTILITÁRIOS JSON PARA LISTAS
     * ============================ */
    function serializeField(value) {
    if (value === null || value === undefined) return "";
    // Força a conversão de Arrays ou Objetos para String JSON
    if (Array.isArray(value) || (typeof value === "object")) {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return String(value);
        }
    }
    return value;
    }

    function extractLastNote(value) {
        if (value === null || value === undefined) return "";

        let history = value;
        if (typeof value === "string") {
            try {
                history = JSON.parse(value);
            } catch (e) {
                return String(value).substring(0, 255).trim();
            }
        }

        if (!Array.isArray(history) || history.length === 0) return "";

        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i] || {};
            const note = entry.notas || entry.observacoes || entry.obs || "";
            const trimmed = String(note || "").trim();
            if (trimmed) return trimmed.substring(0, 255);
        }

        const last = history[history.length - 1] || {};
        if (last.fase) return `Fase: ${String(last.fase).substring(0, 240)}`;
        if (last.transicao && (last.transicao.de || last.transicao.para)) {
            const de = String(last.transicao.de || "").trim();
            const para = String(last.transicao.para || "").trim();
            const label = de || para ? `Transicao: ${de || "?"} -> ${para || "?"}` : "";
            return label.substring(0, 255);
        }

        return "";
    }

    function deserializeField(value, isJsonField = false) {
        if (!isJsonField) return value;
        if (!value || typeof value !== "string") return value;
        try {
            return JSON.parse(value);
        } catch (e) {
            Logger.log("[DB] Falha ao desserializar: " + e.message);
            return value;
        }
    }

    /* ============================
     * 🆕 MAPEAMENTO DE COLUNAS ORDENADAS (ESTRUTURA HUMANA)
     * ============================ */
    function getOrderedColumnStructure() {
        return [
            "id_do_rolo",              // 1. ID do Rolo (Limpo)
            "revision_id",             // 2. ID da Revisão (Curto: -R1, -R2...)
            "created_at",              // 3. Data/Hora (Formatada)
            "revisor",                 // 4. Revisor (Nome)
            "supplier_nm",             // 5. Fornecedor
            "nota_fiscal",             // 6. Nota Fiscal
            "metros_fornecedor",       // 7. Metros Fornecedor
            "revised_meters",          // 8. Metros Revisados (Número real)
            "status_final",            // 9. Status Final (Aprovado/Reprovado)
            "defeitos_totais",         // 10. Defeitos Totais (Contagem)
            "ultima_nota",             // 11. Última Nota / Parecer do Revisor
            "historico_status",        // 12. Histórico (oculto para dashboard, visível em expansão)
            "fase_atual",              // 13. Fase Atual
            "updated_at",              // 14. Data Atualização
            "defeitos",                // 15. Defeitos (JSON - oculto)
            "fotos"                    // 16. Fotos (JSON - oculto)
        ];
    }

    /* ============================
     * 🆕 ADICIONADO: LEITURA EFICIENTE (UMA VEZ)
     * ============================ */
    function getAllRowsFromSheet(sheetName) {
    const sheet = getSheetByName(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    // Se a última linha for 1 ou menos, significa que só tem cabeçalho ou está vazia
    if (lastRow <= 1) return []; 
    
    // Garante que temos colunas para evitar erro de intervalo
    if (lastCol < 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return data;
    }

    function getHeadersFromSheet(sheetName) {
        const sheet = getSheetByName(sheetName);
        return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    function normalizeFieldName(field, headers) {
        if (!field) return field;
        const normalize = (value) => {
            const str = String(value || "").trim();
            if (!str) return "";
            if (str.normalize) {
                return str
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9]+/g, "")
                    .toLowerCase();
            }
            return str.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
        };

        const target = normalize(field);
        if (!headers || !headers.length) return field;

        for (let i = 0; i < headers.length; i++) {
            if (normalize(headers[i]) === target) return headers[i];
        }

        return field;
    }

    function normalizeForCompare(value) {
        if (value === null || value === undefined) return value;
        if (Object.prototype.toString.call(value) === "[object Date]") return value.getTime();

        if (typeof value === "number") return value;
        if (typeof value === "boolean") return value ? 1 : 0;

        const str = String(value).trim();
        if (!str) return str;

        const num = Number(str.replace(",", "."));
        if (!isNaN(num) && str.match(/^\d+(?:[\.,]\d+)?$/)) return num;

        const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (brMatch) {
            const d = new Date(
                Number(brMatch[3]),
                Number(brMatch[2]) - 1,
                Number(brMatch[1]),
                Number(brMatch[4] || 0),
                Number(brMatch[5] || 0),
                Number(brMatch[6] || 0)
            );
            if (!isNaN(d.getTime())) return d.getTime();
        }

        const iso = new Date(str.replace(" ", "T"));
        if (!isNaN(iso.getTime())) return iso.getTime();

        return str.toLowerCase();
    }

    /* ============================
     * 🆕 OTIMIZAÇÕES: CACHE DE HEADERS, SCHEMA MAPPER E BATCH APPEND
     * - _batchAppend utiliza setValues() para performance em lote
     * - getCachedHeaders minimiza chamadas a getRange
     * - SchemaMapper normaliza chaves do payload para as colunas
     */
    const HEADER_CACHE = {};

    function getCachedHeaders(sheetName) {
        if (HEADER_CACHE[sheetName]) return HEADER_CACHE[sheetName];
        try {
            const headers = getHeadersFromSheet(sheetName);
            HEADER_CACHE[sheetName] = headers;
            return headers;
        } catch (e) {
            Logger.log('[DB] ⚠️ Falha ao obter headers cache para ' + sheetName + ': ' + e.message);
            return [];
        }
    }

    const SchemaMapper = {
        // Normaliza chaves e produz uma row compatível com a aba (respecting headers order)
        mapToRow: function (sheetName, obj) {
            const headers = getCachedHeaders(sheetName);
            const row = new Array(headers.length).fill("");

            if (!obj) return row;

            // Build normalized map from payload keys
            const payloadMap = {};
            Object.keys(obj).forEach(k => {
                const nk = String(k).toLowerCase().replace(/[_\s-]/g, '');
                payloadMap[nk] = obj[k];
            });

            headers.forEach((h, i) => {
                if (!h) return;
                const normalizedHeader = String(h).toLowerCase().replace(/[_\s-]/g, '');
                if (payloadMap.hasOwnProperty(normalizedHeader)) {
                    let v = payloadMap[normalizedHeader];
                    // Coerce numbers according to schema if available
                    try {
                        if (SHEET_SCHEMAS[sheetName] && SHEET_SCHEMAS[sheetName][h]) {
                            v = coerceToCorrectType(v, h, SHEET_SCHEMAS[sheetName]);
                        }
                    } catch (e) {
                        // ignore coercion error, keep original
                    }
                    row[i] = v;
                } else {
                    // try loose matching: header contains keywords
                    // ex: header 'REVISION_ID' matches payload 'revisionId' already normalized; fallback not needed
                }
            });

            return row;
        }
    };

    function _batchAppend(sheetName, rows) {
        if (!rows || rows.length === 0) return { inserted: 0 };
        const sheet = getSheetByName(sheetName);
        const headers = getCachedHeaders(sheetName);
        const cols = headers.length || (rows[0] ? rows[0].length : 0);
        // Normalize each row length to cols
        const normalized = rows.map(r => {
            const row = new Array(cols).fill("");
            for (let j = 0; j < cols && j < r.length; j++) row[j] = r[j];
            return row;
        });

        const lastRow = Math.max( sheet.getLastRow(), 1 );
        const startRow = lastRow + 1;
        try {
            sheet.getRange(startRow, 1, normalized.length, cols).setValues(normalized);
            return { inserted: normalized.length };
        } catch (e) {
            Logger.log('[DB] ❌ _batchAppend falhou para ' + sheetName + ': ' + e.message);
            throw e;
        }
    }

    function generateUniqueRevisionId(idRolo) {
        // Usa UUID + timestamp para garantir unicidade sem ler a planilha
        const base = idRolo ? String(idRolo) : 'ROLO';
        const uuid = (typeof Utilities !== 'undefined' && Utilities.getUuid) ? Utilities.getUuid() : (Date.now() + '-' + Math.floor(Math.random()*100000));
        return base + '-U' + uuid;
    }

    function generateShortRevisionId(payload) {
        const safe = (value, fallback) => {
            const raw = String(value || "").trim();
            if (!raw) return fallback;
            return raw.replace(/\s+/g, "");
        };

        const supplierId = safe(payload?.supplier_id || payload?.fornecedor_id, "SUP");
        const productId = safe(payload?.product_id || payload?.produto_id || payload?.ID_ROLO || payload?.id_do_rolo, "PROD");
        const timeSuffix = Date.now().toString().slice(-5);
        return supplierId + "-" + productId + "-" + timeSuffix;
    }

    function makeServiceResponse(success, data, error, metrics) {
        return { success: !!success, data: data || null, error: error || null, metrics: metrics || {} };
    }

    /* ============================
     * 🆕 VALIDAÇÃO DE CAMPOS ESSENCIAIS
     * ============================ */
    function validateEssentialFields(payload, collection = "rolos") {
    const essentialFields = {
        "INSPECOES_INIT": [
            "id_do_rolo",
            "revisor",
            "revisor_nome"
        ],

        "INSPECOES_FINAL": [
            "REVISION_ID",
            "ID_ROLO", 
            "DATA_REGISTRO",
            "REVISOR",
            "FORNECEDOR",
            "NF",
            "METROS_FORNECEDOR",
            "METROS_REVISADO",
            "LARGURA_CM",
            "AREA_M2",
            "PONTOS",
            "STATUS_FINAL"
        ],

        "defeitos": ["revision_id", "tipo_defeito"],
        "fotos": ["revision_id", "url_foto"]
    };

    // 🔑 PATCH CRÍTICO — declaração correta no escopo local
    let validationKey = collection;

    if (collection === "INSPECOES") {
        // Se tem STATUS_FINAL, é finalização. Senão, é inicialização.
        validationKey = payload.STATUS_FINAL
            ? "INSPECOES_FINAL"
            : "INSPECOES_INIT";
    }

    const requiredFields = essentialFields[validationKey] || [];
    const errors = [];

    requiredFields.forEach(field => {
        if (!payload[field] || payload[field] === "") {
            errors.push(`Campo obrigatório ausente: '${field}'`);
        }
    });

    if (errors.length > 0) {
        throw new Error("Validação falhou: " + errors.join("; "));
    }

    return true;
}

    
    function _get(collection, docId) {
  if (!docId) return null;
  const target = String(docId).trim();
        dbLog(`[DB] GET: ${collection}/${target}`);

  const sheetName = SHEET_TABS[collection] || collection;
  if (!sheetName) throw new Error(`Coleção '${collection}' não mapeada.`);

    const headers = getCachedHeaders(sheetName);
  const data = getAllRowsFromSheet(sheetName);

  const revIdx  = headers.indexOf("REVISION_ID");
  const roloIdx = headers.indexOf("ID_ROLO");

  // 1) PRIORIDADE: se existir REVISION_ID igual, retorna imediatamente (exato)
  if (revIdx >= 0) {
    for (let i = data.length - 1; i >= 0; i--) { // tanto faz aqui, mas deixo reverso
      const row = data[i];
      const rowRevisionId = row[revIdx];
      if (rowRevisionId === target) {
                dbLog(`[DB] GET encontrado por REVISION_ID: ${target}`);
        return _rowToObject(row, headers, sheetName);
      }
    }
  }

  // 2) FALLBACK: procurar por ID_ROLO e retornar A ÚLTIMA OCORRÊNCIA
  if (roloIdx >= 0) {
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const rowRoloId = row[roloIdx];
      if (rowRoloId === target) {
                dbLog(`[DB] GET encontrado por ID_ROLO (último): ${target}`);
        return _rowToObject(row, headers, sheetName);
      }
    }
  }

    dbLog(`[DB] GET não encontrado: ${target}`);
  return null;
}

    function _update(collection, docId, payload) {
  if (!docId) throw new Error("_update requires docId");
  const target = String(docId).trim();

    dbLog(`[DB] UPDATE: ${collection}/${target} com ${Object.keys(payload || {}).length} campos`);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const sheetName = SHEET_TABS[collection] || collection;
    if (!sheetName) throw new Error(`Coleção '${collection}' não mapeada.`);

    const sheet = getSheetByName(sheetName);
    const headers = getCachedHeaders(sheetName);
    const data = getAllRowsFromSheet(sheetName);

    const headerIndexMap = {};
    headers.forEach((h, j) => headerIndexMap[h] = j);

    const revIdx  = headers.indexOf("REVISION_ID");
    const roloIdx = headers.indexOf("ID_ROLO");

    let rowFound = null;
    let rowIndex = -1;

    // ✅ REGRA:
    // - Se target bater em algum REVISION_ID: atualiza esse exato
    // - Senão: trata como ID_ROLO e atualiza a ÚLTIMA ocorrência do rolo
    // (na prática, buscamos do fim e aceitamos match em REVISION_ID ou ID_ROLO)
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const rowRevisionId = revIdx  >= 0 ? String(row[revIdx]  || "").trim() : "";
      const rowRoloId     = roloIdx >= 0 ? String(row[roloIdx] || "").trim() : "";

      if (rowRevisionId === target || rowRoloId === target) {
        rowFound = row;
        rowIndex = i;
        break;
      }
    }

    if (!rowFound) throw new Error(`Documento não encontrado: ${target}`);

    // aplicar updates
    const input = payload || {};
    for (const [rawKey, value] of Object.entries(input)) {
      const normalizedKey = normalizeFieldName(rawKey, headers) || rawKey;
      if (!(normalizedKey in headerIndexMap)) continue;

      if (normalizedKey === "HISTORICO_STATUS" && value != null) {
        rowFound[headerIndexMap[normalizedKey]] = serializeField(value);
        if ("ULTIMA_NOTA" in headerIndexMap) {
          rowFound[headerIndexMap["ULTIMA_NOTA"]] = extractLastNote(value);
        }
        continue;
      }

      if (normalizedKey === "DEFEITOS" && value != null) {
        rowFound[headerIndexMap[normalizedKey]] = serializeField(value);
        if ("DEFEITOS_TOTAIS" in headerIndexMap) {
          rowFound[headerIndexMap["DEFEITOS_TOTAIS"]] = countDefects(value);
        }
        continue;
      }

      rowFound[headerIndexMap[normalizedKey]] = serializeField(value);
    }

    // timestamps
    const now = nowBrasilia();
    if ("DATA_ATUALIZACAO" in headerIndexMap) {
      rowFound[headerIndexMap["DATA_ATUALIZACAO"]] = now;
    } else if ("UPDATED_AT" in headerIndexMap) {
      rowFound[headerIndexMap["UPDATED_AT"]] = now;
    }

    // persistir
    sheet.getRange(rowIndex + 2, 1, 1, rowFound.length).setValues([rowFound]);
    SpreadsheetApp.flush();

    dbLog(`[DB] ✅ UPDATE sucesso: ${target}`);
    return _rowToObject(rowFound, headers, sheetName);

  } catch (error) {
    Logger.log("[DB] ❌ ERRO EM _UPDATE: " + error.message);
    throw error;
  } finally {
    lock.releaseLock();
  }
}


    function _delete(collection, docId) {
  if (!docId) throw new Error("_delete requires docId");
        dbLog(`[DB] DELETE: ${collection}/${docId}`);

  const sheetName = SHEET_TABS[collection] || collection;
  if (!sheetName) throw new Error(`Coleção '${collection}' não mapeada.`);

  const sheet = getSheetByName(sheetName);
    const headers = getCachedHeaders(sheetName);
  const data = getAllRowsFromSheet(sheetName);

  const revisionIdIdx = headers.indexOf("REVISION_ID");
  const idDoRoloIdx   = headers.indexOf("ID_ROLO");

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowRevisionId = revisionIdIdx >= 0 ? row[revisionIdIdx] : null;
    const rowRoloId     = idDoRoloIdx   >= 0 ? row[idDoRoloIdx]   : null;

    if (rowRevisionId === docId || rowRoloId === docId) {
      sheet.deleteRow(i + 2);
            dbLog(`[DB] DELETE sucesso: ${docId}`);
      return { id: docId, status: "DELETED" };
    }
  }

  throw new Error(`Documento não encontrado: ${docId}`);
}



/* ============================
     * 🆕 ADICIONADO: CONVERSOR LINHA → OBJETO
     * ============================ */
    function _rowToObject(row, headers, sheetName) {
  const obj = {};
  const jsonFields = getJsonFieldsForSheet(sheetName);

  // helper: HEADER_DO_SHEETS -> header_do_sheets
  const toSnake = (s) => String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

  headers.forEach((header, idx) => {
    if (!header || idx >= row.length) return;

    const rawValue = row[idx];
    const value = jsonFields.includes(header)
      ? deserializeField(rawValue, true)
      : rawValue;

    // 1) mantém chave original (compatibilidade/debug)
    obj[header] = value;

    // 2) cria alias snake_case (o WorkflowService depende disso)
    const snakeKey = toSnake(header);
    if (snakeKey) obj[snakeKey] = value;

    // 3) aliases explícitos (para evitar qualquer ambiguidade)
    // IDs
    if (header === "ID_ROLO") obj.id_do_rolo = value;
    if (header === "REVISION_ID") obj.revision_id = value;

    // Workflow (CRÍTICO)
    if (header === "FASE_ATUAL") obj.fase_atual = value;
    if (header === "HISTORICO_STATUS") obj.historico_status = value;
    if (header === "TIMESTAMPS") obj.timestamps = value;

    // Campos comuns do seu payload
    if (header === "REVISOR") obj.revisor_nome = value;
    if (header === "FORNECEDOR_ID") obj.fornecedor_id = value;
    if (header === "FORNECEDOR") obj.fornecedor_nome = value;
    if (header === "NOTA_FISCAL" || header === "NF") obj.nota_fiscal = value;
  });

  return obj;
}

    function getJsonFieldsForSheet(sheetName) {
        // 🆕 Campos que devem ser JSON: defeitos, fotos, historico_status, zonas, etc.
        const jsonFieldsBySheet = {
            "INSPECOES": ["DEFEITOS", "FOTOS", "HISTORICO_STATUS", "TIMESTAMPS"],
            "AUDIT": ["dados_anteriores", "dados_novos"],
            "TELEMETRIA": ["metadados"]
        };
        return jsonFieldsBySheet[sheetName] || [];
    }

/* ============================
     * 🔄 ALTERADO: QUERY COM JAVASCRIPT + SHEETS
     * ============================ */
    function _query(q) {
        if (!q || !q.collection) return [];
        
        dbLog(`[DB] QUERY: ${q.collection} com ${(q.where || []).length} filtros`);
        // Suporta tanto chave de SHEET_TABS quanto nome da aba diretamente
        const sheetName = SHEET_TABS[q.collection] || q.collection;
        if (!sheetName) throw new Error(`Coleção '${q.collection}' não mapeada.`);

        const sheet = getSheetByName(sheetName);
        const headers = getCachedHeaders(sheetName);
        const data = getAllRowsFromSheet(sheetName);

        // Aplicar filtros onde (JavaScript-based filtering)
        let filtered = data;
        if (q.where && q.where.length > 0) {
            filtered = data.filter(row => {
                return q.where.every(clause => {
                    const normalizedField = normalizeFieldName(clause.field, headers);
                    const headerIdx = headers.indexOf(normalizedField);
                    if (headerIdx === -1) return false;
                    
                    const cellValue = row[headerIdx];
                    const compareValue = clause.value;

                    switch (String(clause.op).toLowerCase()) {
                        case "==":
                            return cellValue === compareValue;
                        case "<":
                            return cellValue < compareValue;
                        case "<=":
                            return cellValue <= compareValue;
                        case ">":
                            return normalizeForCompare(cellValue) > normalizeForCompare(compareValue);
                        case ">=":
                            return cellValue >= compareValue;
                        case "in":
                            return Array.isArray(compareValue) && compareValue.includes(cellValue);
                        case "array-contains":
                            try {
                                const arr = JSON.parse(cellValue);
                                return Array.isArray(arr) && arr.includes(compareValue);
                            } catch (e) {
                                return cellValue === compareValue;
                            }
                        default:
                            return false;
                    }
                });
            });
        }

        // Aplicar ordenação (orderBy)
        if (q.orderBy && q.orderBy.length > 0) {
            filtered.sort((a, b) => {
                for (const order of q.orderBy) {
                    const idx = headers.indexOf(order.field);
                    if (idx === -1) continue;
                    const aVal = a[idx];
                    const bVal = b[idx];
                    const dir = (order.direction || "asc") === "desc" ? -1 : 1;
                    if (aVal < bVal) return -1 * dir;
                    if (aVal > bVal) return 1 * dir;
                }
                return 0;
            });
        }

        // Aplicar limite (limit)
        if (q.limit) {
            filtered = filtered.slice(0, q.limit);
        }

        const results = filtered.map(row => _rowToObject(row, headers, sheetName));
        dbLog(`[DB] QUERY retornou ${results.length} resultados`);
        return results;
    }

    /* ============================
     * SERVIÇOS DE DOMÍNIO (API)
     * ============================ */
    const Rolls = {
    get: (id) => _get("INSPECOES", id),
    create: (id, data) => _insert("INSPECOES", id, data),
    update: (id, data) => _update("INSPECOES", id, data),
    delete: (id) => _delete("INSPECOES", id),
    
    updateStatus: function (id, newStatus, user) {
        const roll = this.get(id);
        if (!roll) throw new Error(`Rolo ${id} não encontrado.`);
        if (typeof WorkflowService !== "undefined" && WorkflowService.transition) {
            return WorkflowService.transition(id, newStatus, {
                usuario: user || "Sistema"
            });
        }
        throw new Error("WorkflowService indisponivel para updateStatus");
    },

    updateLocation: (id, newLocation) => _update("INSPECOES", id, { localizacao_atual: newLocation, updated_at: nowBrasilia() }),
    
    updateFiscalNotes: function (id, fiscalNotesUrls) { 
        const roll = this.get(id); 
        return _update("INSPECOES", id, { notas_fiscais: [...(roll.notas_fiscais || []), ...fiscalNotesUrls] }); 
    },
    
    addPhotos: function (id, photos) { 
        const roll = this.get(id); 
        return _update("INSPECOES", id, { fotos: [...(roll.fotos || []), ...photos] }); 
    }
};

// API pública compatível com controllers existentes
const databaseQuery = _query;
const rolls = Rolls;

// Serviços de auditoria e telemetria simplificados
const Audit = {
    add: (logData) => {
        try {
            // Garantir que tem estrutura correta
            const acao = logData?.acao || logData?.action || logData?.evento || 'desconhecida';
            const usuario = logData?.usuario || logData?.user || logData?.revisor_nome || "sistema";
            const detalhes = logData?.detalhes || logData?.details || logData?.data || {};
            
            const fullRecord = {
                timestamp: nowBrasilia(),
                usuario: String(usuario).trim() || "sistema",
                acao: String(acao).trim() || "sem_ação",
                detalhes: JSON.stringify(detalhes)
            };
            Logger.log(`[AUDIT] Registrando: ${fullRecord.acao} | usuário: ${fullRecord.usuario}`);
            return _insert("AUDIT", null, fullRecord);
        } catch (e) { 
            Logger.log("[AUDIT] Erro: " + e.message);
            return null; 
        }
    }
};

const Telemetry = {
    add: (eventData) => {
        try {
            // Garantir que tem estrutura correta
            const evento = eventData?.evento || eventData?.event || eventData?.tipo || 'desconhecida';
            const rolo = eventData?.rolo || eventData?.roll_id || eventData?.id_do_rolo || "";
            const erro = eventData?.erro || eventData?.error || "";
            const detalhes = eventData?.detalhes || eventData?.details || eventData?.data || {};
            
            const fullRecord = {
                timestamp: nowBrasilia(),
                evento: String(evento).trim() || "evento_desconhecido",
                rolo: String(rolo).trim() || "",
                erro: String(erro).trim() || "",
                detalhes: JSON.stringify(detalhes)
            };
            Logger.log(`[TELEMETRY] Evento: ${fullRecord.evento} | Rolo: ${fullRecord.rolo}`);
            return _insert("TELEMETRIA", null, fullRecord);
        } catch (e) { 
            Logger.log("[TELEMETRY] Erro: " + e.message);
            return null; 
        }
    }
};

const audit = Audit;
const telemetry = Telemetry;

function insertStructuredData(payload) {
    const start = new Date().getTime();
    
    if (!payload || !payload.rolo) {
        return makeServiceResponse(false, null, '[STRUCTURED] payload.rolo é obrigatório', { time: 0 });
    }

    const rolo = payload.rolo;
    const lock = LockService.getScriptLock();

    try {
        lock.waitLock(20000);
        
        // 🔍 DEBUG opcional (desligado em produção)
        if (DB_DEBUG) {
            Logger.log('[STRUCTURED] 🔵 PAYLOAD RECEBIDO NA BACKEND:');
            Logger.log('[STRUCTURED] - rolo.localizacao: ' + rolo.localizacao);
            Logger.log('[STRUCTURED] - rolo.loc: ' + rolo.loc);
            Logger.log('[STRUCTURED] - rolo.metros_revisado: ' + rolo.metros_revisado);
            Logger.log('[STRUCTURED] - rolo.revised_meters: ' + rolo.revised_meters);
            Logger.log('[STRUCTURED] - rolo.tipo_tecido: ' + rolo.tipo_tecido);
            Logger.log('[STRUCTURED] - rolo.est_tc: ' + rolo.est_tc);
        }
        
        // ============================================================
        // 🔑 NORMALIZAÇÃO E VALIDAÇÃO DE CAMPOS ESSENCIAIS
        // ============================================================
        const supplierId = String(rolo.supplier_id || rolo.fornecedor_id || "").trim();
        const supplierName = String(rolo.supplier_nm || rolo.supplier_name || rolo.fornecedor_nome || rolo.fornecedor || "").trim();
        const nf = String(rolo.nf || rolo.nota_fiscal || "").trim();
        const productId = String(rolo.product_id || rolo.produto_id || "").trim();
        const revisorName = String(rolo.revisor_nome || rolo.revisor || "").trim();
        
        dbLog(`[STRUCTURED] 📋 VALIDANDO PAYLOAD:`);
        dbLog(`  supplier_id: ${supplierId}`);
        dbLog(`  supplier_name: ${supplierName}`);
        dbLog(`  product_id: ${productId}`);
        dbLog(`  nf: ${nf}`);
        dbLog(`  revisor: ${revisorName}`);
        
        // Validações críticas
        if (!supplierId) throw new Error("supplier_id (fornecedor_id) é obrigatório");
        if (!productId) throw new Error("product_id (produto_id) é obrigatório");
        if (!nf) throw new Error("nf (nota_fiscal) é obrigatório");
        if (!revisorName) throw new Error("revisor_nome é obrigatório");
        
        // ============================================================
        // 🆔 GERAÇÃO DO REVISION_ID (único e consistente)
        // ============================================================
        const revisionId = generateShortRevisionId(rolo);
        dbLog(`[STRUCTURED] 🆔 Revision ID: ${revisionId}`);
        
        // ============================================================
        // 📦 MAPEAMENTO EXPLÍCITO COLUNA ➜ VALOR (ROBUSTEZ MÁXIMA)
        // ============================================================
        const headers = getCachedHeaders(SHEET_TABS.INSPECOES);
        const row = new Array(headers.length).fill("");
        
        // Processamento dinâmico com fallback
        headers.forEach((columnName, idx) => {
            let value = "";
            
            switch (columnName) {
                // 🔑 IDs E IDENTIFICADORES
                case "REVISION_ID":
                    value = revisionId;
                    break;
                case "ID_ROLO":
                    value = rolo.id_do_rolo || rolo.roll_id || rolo.review_id || "";
                    break;
                    
                // 👤 RESPONSÁVEL E DATA
                case "REVISOR":
                    value = revisorName;
                    break;
                case "DATA_REGISTRO":
                    value = nowBrasilia();
                    break;
                    
                // 🏭 DADOS DO FORNECEDOR (QR CAMPOS 0-2)
                case "FORNECEDOR_ID":
                    value = supplierId;
                    break;
                case "FORNECEDOR":
                    value = supplierName;
                    break;
                case "NF":
                    value = nf;
                    break;
                    
                // 📦 DADOS DO PRODUTO (QR CAMPOS 3-8)
                case "PRODUTO_ID":
                    value = productId;
                    break;
                case "LOTE":
                    value = String(rolo.lot || rolo.lote || "").trim();
                    break;
                case "PRODUTO_SUP_ID":
                    // CRÍTICO: não deixar vazio! Se vazio, usa product_id como fallback
                    let supProd = String(rolo.sup_product_id || rolo.produto_sup_id || "").trim();
                    if (!supProd && rolo.product_id) {
                        supProd = String(rolo.product_id).trim();
                        Logger.log(`[STRUCTURED] ⚠️ PRODUTO_SUP_ID estava vazio, usando PRODUCT_ID: ${supProd}`);
                    }
                    value = supProd;
                    break;
                case "COR":
                    value = String(rolo.color_id || rolo.cor || "").trim();
                    break;
                case "PADRONAGEM":
                    value = String(rolo.fabric_pattern || rolo.padronagem || "").trim();
                    break;
                case "LOCALIZACAO":
                    value = String(rolo.loc || rolo.localizacao || "").trim();
                    dbLog(`[STRUCTURED] LOCALIZACAO CASE: rolo.loc='${rolo.loc}' | rolo.localizacao='${rolo.localizacao}' | FINAL VALUE='${value}'`);
                    break;
                    
                // 📏 DIMENSÕES DO TECIDO (QR CAMPOS 9-10)
                case "LARGURA_CM":
                    let w = ensureNumber(rolo.len || rolo.largura_cm || 0);
                    if (w > 0 && w < 10) w = w * 100;  // 1.55m -> 155cm
                    value = w;
                    break;
                case "METROS_FORNECEDOR":
                    value = ensureNumber(rolo.wid || rolo.metros_fornecedor || 0);
                    break;
                    
                // 🧵 COMPOSIÇÃO (QR CAMPO 11)
                case "COMPOSICAO":
                    value = String(rolo.comp || rolo.composicao || "").trim();
                    break;
                    
                // 🔄 TIPO E METRAGEM REVISADA (seleção revisor: MALHA vs PLANO)
                case "TIPO_TECIDO":
                    value = String(rolo.tipo_tecido || rolo.tipo || "PLANO").toUpperCase();
                    break;
                case "METROS_REVISADO":
                    // CRÍTICO: não deixar vazio para PLANO! Se vazio, usa metros_fornecedor como fallback
                    const tipoTecido = String(rolo.tipo_tecido || rolo.tipo || "PLANO").toUpperCase();
                    let metrosRev = 0;
                    
                    if (tipoTecido === "MALHA") {
                        metrosRev = 0;  // Malha não tem metros_revisado
                    } else {
                        // Para PLANO: tenta valores
                        metrosRev = ensureNumber(rolo.metros_revisado || rolo.revised_meters || 0);
                        // Se ainda está zero, usa metros_fornecedor como fallback
                        if (!metrosRev || metrosRev === 0) {
                            metrosRev = ensureNumber(rolo.wid || rolo.metros_fornecedor || 0);
                            if (metrosRev > 0) {
                                dbLog(`[STRUCTURED] ⚠️ METROS_REVISADO estava zero, usando METROS_FORNECEDOR: ${metrosRev}`);
                            }
                        }
                    }
                    dbLog(`[STRUCTURED] METROS_REVISADO CASE: tipo='${tipoTecido}' | metros_revisado='${rolo.metros_revisado}' | revised_meters='${rolo.revised_meters}' | FINAL VALUE=${metrosRev}`);
                    value = metrosRev;
                    break;
                case "PESO_KG":
                    // Se MALHA: usa peso_kg. Se PLANO: zero
                    const tipoTec = String(rolo.tipo_tecido || rolo.tipo || "PLANO").toUpperCase();
                    value = tipoTec === "MALHA" ? ensureNumber(rolo.peso_kg || 0) : 0;
                    break;
                    
                // 📊 CÁLCULOS DERIVADOS
                case "AREA_M2":
                    let larguraCmCalc = ensureNumber(rolo.len || rolo.largura_cm || 0);
                    if (larguraCmCalc > 0 && larguraCmCalc < 10) larguraCmCalc = larguraCmCalc * 100; // 1.55m -> 155cm

                    const tipoTecidoCalc = String(rolo.tipo_tecido || rolo.tipo || "PLANO").toUpperCase();
                    const metrosRevCalc = tipoTecidoCalc === "MALHA"
                        ? ensureNumber(rolo.wid || rolo.metros_fornecedor || 0) // se for malha e você não mede "metros revisado", usa fornecedor
                        : ensureNumber(rolo.metros_revisado || 0);

                        value = (larguraCmCalc && metrosRevCalc)
                          ? Number(((larguraCmCalc / 100) * metrosRevCalc).toFixed(2))
                          : 0;
                    break;
                case "PONTOS":
                    value = ensureNumber(rolo.total_pontos || rolo.pontos || 0);
                    break;
                case "DEFEITOS_TOTAIS":
                    value = payload.defeitos ? (Array.isArray(payload.defeitos) ? payload.defeitos.length : 0) : 0;
                    break;
                    
                // 📝 STATUS E NOTAS
                case "STATUS_FINAL":
                    const raw = rolo.status_final || rolo.status_rolo || rolo.status || "EM_REVISAO";
                    value = String(raw).toUpperCase();
                    break;
                case "ULTIMA_NOTA":
                    value = String(rolo.observacoes || rolo.ultima_nota || rolo.notas || "").substring(0, 255).trim();
                    break;
                case "TEMPO_TOTAL_SEG":
                    value = ensureNumber(rolo.tempo_total_seg || rolo.tempo_total || 0);
                    break;
                case "DATA_ATUALIZACAO":
                    value = nowBrasilia();
                    break;
                    
                // 📦 DADOS JSON (ocultos em dashboard, visíveis em expandir)
                case "DEFEITOS":
                    value = serializeField(payload.defeitos || []);
                    break;
                case "FOTOS":
                    value = serializeField(payload.fotos || []);
                    break;
                    
                // 🔄 FALLBACK: tenta correspondência dinâmica
                default:
                    const normalizedName = columnName.toLowerCase().replace(/[_\s-]/g, '');
                    const matchingKey = Object.keys(rolo).find(k => 
                        k.toLowerCase().replace(/[_\s-]/g, '') === normalizedName
                    );
                    value = matchingKey ? rolo[matchingKey] : "";
                    break;
            }
            
            row[idx] = coerceToCorrectType(value, columnName, SHEET_SCHEMAS[SHEET_TABS.INSPECOES]);
        });

        // ============================================================
        // 🔐 VERIFICAÇÃO DE DUPLICAÇÃO (REVISION_ID)
        // ============================================================
        const existingRevision = _query({
            collection: "INSPECOES",
            where: [{ field: "REVISION_ID", op: "==", value: revisionId }]
        });
        
        if (existingRevision && existingRevision.length > 0) {
            dbLog(`[STRUCTURED] ⚠️ Revisão ${revisionId} já existe. Ignorando duplicação.`, true);
            return makeServiceResponse(true, { revision_id: revisionId, duplicate: true }, null, { time: new Date().getTime() - start });
        }

        // ============================================================
        // 💾 GRAVAÇÃO: INSPEÇÃO + DEFEITOS + FOTOS + TEMPOS
        // ============================================================
        const metrics = { written: { INSPECOES: 0, defeitos: 0, fotos: 0, tempos: 0 } };
        
        // 1️⃣ INSPEÇÃO (linha principal)
        _batchAppend(SHEET_TABS.INSPECOES, [row]);
        metrics.written.INSPECOES = 1;
        dbLog(`[STRUCTURED] ✅ INSPEÇÃO gravada: ${revisionId}`);
        
        // 2️⃣ DEFEITOS (uma linha por item)
        if (payload.defeitos && Array.isArray(payload.defeitos)) {
            const defeitosValidos = payload.defeitos.filter(d => d.tipo || d.tipo_defeito);

            const defectRows = defeitosValidos.map(defeito => [
                    revisionId,
                    String(defeito.tipo || defeito.tipo_defeito || "").trim(),
                    ensureNumber(defeito.metro_inicial || defeito.metragem_inicial || 0),
                    ensureNumber(defeito.metro_final || defeito.metragem_final || 0),
                    String(defeito.gravidade || "").trim(),
                    String(defeito.zona || defeito.posicao_largura || "").trim(),
                    String(defeito.observacoes || "").trim(),
                    nowBrasilia()
                ]);

            if (defectRows.length > 0) {
                _batchAppend(SHEET_TABS.DEFEITOS, defectRows);
                metrics.written.defeitos = defectRows.length;
            }
            dbLog(`[STRUCTURED] ✅ ${metrics.written.defeitos} DEFEITOS gravados`);
        }
        
        // 3️⃣ FOTOS (uma linha por URL)
        if (payload.fotos && Array.isArray(payload.fotos)) {
            const photoRows = [];

            payload.fotos.forEach(foto => {
                const url = String(foto.url || foto.foto_url || foto.url_foto || "").trim();
                if (url && url.length > 0) {
                    photoRows.push([
                        revisionId,
                        url,
                        String(foto.tipo || foto.tipo_foto || "GERAL").trim(),
                        nowBrasilia()
                    ]);
                }
            });

            if (photoRows.length > 0) {
                _batchAppend(SHEET_TABS.FOTOS, photoRows);
                metrics.written.fotos = photoRows.length;
            }
            dbLog(`[STRUCTURED] ✅ ${metrics.written.fotos} FOTOS gravadas`);
        }
        
        // 4️⃣ TEMPOS (se disponível)
        if (payload.tempos && Array.isArray(payload.tempos)) {
            dbLog(`[STRUCTURED] 📋 TEMPOS RECEBIDOS: ${payload.tempos.length} registros`);
            const tempoRows = payload.tempos.map((tempo) => [
                    revisionId,
                    String(tempo.event || "").trim(),
                    String(tempo.timestamp || nowBrasilia()).trim(),
                    ensureNumber(tempo.duracao_seg || tempo.duration || 0)
                ]);

            if (tempoRows.length > 0) {
                _batchAppend(SHEET_TABS.TEMPOS_LOG, tempoRows);
                metrics.written.tempos = tempoRows.length;
            }
            dbLog(`[STRUCTURED] ✅ ${metrics.written.tempos} TEMPOS gravados`);
        } else {
            dbLog(`[STRUCTURED] ⚠️ TEMPOS NÃO RECEBIDO ou não é array: ${typeof payload.tempos}`);
        }
        
        // 5️⃣ AUDITORIA - Log de criação da revisão
        try {
            Audit.add({
                acao: 'revisao_criada',
                usuario: revisorName,
                detalhes: {
                    revision_id: revisionId,
                    roll_id: rolo.id_do_rolo || rolo.roll_id,
                    produto: productId,
                    fornecedor: supplierName
                }
            });
        } catch (auditErr) {
            Logger.log('[STRUCTURED] ⚠️ Erro ao log auditoria: ' + auditErr.message);
        }
        
        // 6️⃣ TELEMETRIA - Log de evento
        try {
            Telemetry.add({
                evento: 'revisao_iniciada',
                rolo: rolo.id_do_rolo || rolo.roll_id,
                usuario: revisorName,
                detalhes: {
                    tipo_tecido: rolo.tipo_tecido,
                    metros_revisado: rolo.metros_revisado,
                    num_defeitos: (payload.defeitos || []).length
                }
            });
        } catch (telemetryErr) {
            Logger.log('[STRUCTURED] ⚠️ Erro ao log telemetria: ' + telemetryErr.message);
        }
        
        SpreadsheetApp.flush();
        
        dbLog(`[STRUCTURED] ✨ SUCESSO COMPLETO: ${revisionId}`, true);
        dbLog(`  INSPECOES: ${metrics.written.INSPECOES} | DEFEITOS: ${metrics.written.defeitos} | FOTOS: ${metrics.written.fotos} | TEMPOS: ${metrics.written.tempos}`, true);
        
        return makeServiceResponse(true, { 
            revision_id: revisionId, 
            inserted_rows: metrics.written 
        }, null, { 
            time: new Date().getTime() - start,
            summary: `Revisão ${revisionId} processada com sucesso`
        });

    } catch (error) {
        Logger.log('[STRUCTURED] ❌ ERRO CRÍTICO: ' + error.message);
        Logger.log('[STRUCTURED] Stack: ' + (error.stack || "N/A"));
        return makeServiceResponse(false, null, error.message, { time: new Date().getTime() - start });
    } finally {
        lock.releaseLock();
    }
}

    /* ============================
     * � NOVAS MÉTRICAS: ANALYTICA DE REVISORES
     * ============================ */
    function getReviewerMetrics(periodo_dias = 30) {
        try {
            const hoje = new Date();
            const dataLimite = new Date(hoje.getTime() - periodo_dias * 24 * 60 * 60 * 1000);
            
            // 🔍 Buscar todas as inspeções do período
            const inspecoes = _query({
                collection: "INSPECOES",
                orderBy: [{ field: "DATA_REGISTRO", direction: "desc" }]
            });
            
            if (!inspecoes || inspecoes.length === 0) {
                return {
                    status: "sucesso",
                    periodo_dias: periodo_dias,
                    ranking: [],
                    resumo: {}
                };
            }
            
            // 📊 Aggregação por revisor
            const headerIndices = {};
            const headers = getHeadersFromSheet("INSPECOES");
            headers.forEach((h, idx) => {
                headerIndices[h] = idx;
            });
            
            const metricas = {};
            const dataIdx = headerIndices["DATA_REGISTRO"];
            const revisorIdx = headerIndices["REVISOR"];
            const tempoIdx = headerIndices["TEMPO_TOTAL_SEG"];
            const statusIdx = headerIndices["STATUS_FINAL"];
            const defeitosIdx = headerIndices["DEFEITOS_TOTAIS"];
            const tipoIdx = headerIndices["TIPO_TECIDO"];

            function getRowValue(row, header, idx) {
                if (!row) return null;
                if (Array.isArray(row)) return row[idx];
                if (typeof row !== "object") return null;
                if (row[header] !== undefined) return row[header];
                const lower = String(header || "").toLowerCase();
                if (row[lower] !== undefined) return row[lower];
                const snake = lower.replace(/[^\w]+/g, "_");
                if (row[snake] !== undefined) return row[snake];
                return null;
            }

            let totalTempoSeg = 0;
            let totalInspecoes = 0;
            let totalTempoSegMalha = 0;
            let totalInspecoesMalha = 0;
            let totalTempoSegPlano = 0;
            let totalInspecoesPlano = 0;
            
            inspecoes.forEach(row => {
                try {
                    const dataStr = getRowValue(row, "DATA_REGISTRO", dataIdx);
                    if (!dataStr) return;
                    
                    const rowDate = new Date(dataStr);
                    if (rowDate < dataLimite) return;
                    
                    const revisor = String(getRowValue(row, "REVISOR", revisorIdx) || "Não identificado").trim();
                    if (!revisor || revisor.length === 0) return;
                    
                    if (!metricas[revisor]) {
                        metricas[revisor] = {
                            nome: revisor,
                            total_inspecoes: 0,
                            tempo_total_seg: 0,
                            tempo_minimo_seg: Infinity,
                            tempo_maximo_seg: 0,
                            aprovadas: 0,
                            rejeitadas: 0,
                            supervisor: 0,
                            defeitos_total: 0,
                            area_total_m2: 0
                        };
                    }
                    
                    const m = metricas[revisor];
                    m.total_inspecoes++;
                    const tempoSeg = ensureNumber(getRowValue(row, "TEMPO_TOTAL_SEG", tempoIdx));
                    m.tempo_total_seg += tempoSeg;
                    totalInspecoes++;
                    if (tempoSeg > 0) totalTempoSeg += tempoSeg;
                    if (tempoSeg > 0) {
                        m.tempo_minimo_seg = Math.min(m.tempo_minimo_seg, tempoSeg);
                        m.tempo_maximo_seg = Math.max(m.tempo_maximo_seg, tempoSeg);
                    }
                    
                    const status = String(getRowValue(row, "STATUS_FINAL", statusIdx) || "").toUpperCase().trim();
                    if (status.includes("APROVAD")) {
                        m.aprovadas++;
                    } else if (status.includes("REJEIT")) {
                        m.rejeitadas++;
                    } else if (status.includes("SUPERVISOR")) {
                        m.supervisor++;
                    }
                    
                    m.defeitos_total += ensureNumber(getRowValue(row, "DEFEITOS_TOTAIS", defeitosIdx));
                    
                    const areaIdx = headerIndices["AREA_M2"];
                    if (areaIdx !== undefined) {
                        m.area_total_m2 += ensureNumber(getRowValue(row, "AREA_M2", areaIdx));
                    }

                    const tipoRaw = getRowValue(row, "TIPO_TECIDO", tipoIdx);
                    const tipo = String(tipoRaw || "").toUpperCase().trim();
                    if (tipo === "MALHA") {
                        totalInspecoesMalha++;
                        if (tempoSeg > 0) totalTempoSegMalha += tempoSeg;
                    } else if (tipo === "PLANO") {
                        totalInspecoesPlano++;
                        if (tempoSeg > 0) totalTempoSegPlano += tempoSeg;
                    }
                } catch (e) {
                    Logger.log(`[REVIEWER_METRICS] Erro ao processar linha: ${e.message}`);
                }
            });
            
            // 📈 Cálculos de eficiência
            const ranking = Object.values(metricas).map(m => {
                const tempo_medio_min = m.total_inspecoes > 0 ? Number((m.tempo_total_seg / m.total_inspecoes / 60).toFixed(1)) : 0;
                const taxa_aprovacao = m.total_inspecoes > 0 ? Number(((m.aprovadas / m.total_inspecoes) * 100).toFixed(1)) : 0;
                const defeitos_media = m.total_inspecoes > 0 ? Number((m.defeitos_total / m.total_inspecoes).toFixed(2)) : 0;
                
                // 🎯 Score de eficiência (0-100)
                // 40% velocidade, 40% qualidade (taxa aprovação), 20% defect rate
                const velocidadeScore = Math.max(0, Math.min(100, 100 - (tempo_medio_min / 30 * 100))); // Ideal: 15 min
                const qualidadeScore = taxa_aprovacao; // Direto
                const defectScore = Math.max(0, 100 - (defeitos_media / 5 * 100)); // Ideal: <3 defeitos
                
                const efficiency_score = Number((velocidadeScore * 0.4 + qualidadeScore * 0.4 + defectScore * 0.2).toFixed(0));
                
                return {
                    nome: m.nome,
                    total_inspecoes: m.total_inspecoes,
                    tempo_medio_min: tempo_medio_min,
                    tempo_minimo_min: Number((m.tempo_minimo_seg / 60).toFixed(1)),
                    tempo_maximo_min: Number((m.tempo_maximo_seg / 60).toFixed(1)),
                    taxa_aprovacao: taxa_aprovacao,
                    aprovadas: m.aprovadas,
                    rejeitadas: m.rejeitadas,
                    supervisor: m.supervisor,
                    defeitos_total: m.defeitos_total,
                    defeitos_media: defeitos_media,
                    area_total_m2: Number(m.area_total_m2.toFixed(2)),
                    area_media_m2: m.total_inspecoes > 0 ? Number((m.area_total_m2 / m.total_inspecoes).toFixed(2)) : 0,
                    efficiency_score: efficiency_score,
                    producao_m2_dia: m.total_inspecoes > 0 ? Number((m.area_total_m2 / periodo_dias).toFixed(2)) : 0
                };
            });
            
            // 🏆 Ordenar por efficiency_score descending
            ranking.sort((a, b) => b.efficiency_score - a.efficiency_score);
            
            // 📊 Resumo geral
            const totalInspecoesResumo = ranking.reduce((sum, r) => sum + r.total_inspecoes, 0);
            const mediaEficiencia = ranking.length > 0 ? Number((ranking.reduce((sum, r) => sum + r.efficiency_score, 0) / ranking.length).toFixed(0)) : 0;
            const taxaAprovaçãoGeral = totalInspecoesResumo > 0 ? Number(((ranking.reduce((sum, r) => sum + r.aprovadas, 0) / totalInspecoesResumo) * 100).toFixed(1)) : 0;
            
            const tempoMedioGeral = totalInspecoesResumo > 0 ? Number((totalTempoSeg / totalInspecoesResumo / 60).toFixed(1)) : 0;
            const tempoMedioMalha = totalInspecoesMalha > 0 ? Number((totalTempoSegMalha / totalInspecoesMalha / 60).toFixed(1)) : 0;
            const tempoMedioPlano = totalInspecoesPlano > 0 ? Number((totalTempoSegPlano / totalInspecoesPlano / 60).toFixed(1)) : 0;

            return {
                status: "sucesso",
                periodo_dias: periodo_dias,
                data_consultada: Utilities.formatDate(hoje, "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss"),
                ranking: ranking,
                resumo: {
                    total_revisores: ranking.length,
                    total_inspecoes: totalInspecoesResumo,
                    total_tempo_seg: totalTempoSeg,
                    tempo_medio_min: tempoMedioGeral,
                    total_inspecoes_malha: totalInspecoesMalha,
                    total_tempo_seg_malha: totalTempoSegMalha,
                    tempo_medio_min_malha: tempoMedioMalha,
                    total_inspecoes_plano: totalInspecoesPlano,
                    total_tempo_seg_plano: totalTempoSegPlano,
                    tempo_medio_min_plano: tempoMedioPlano,
                    eficiencia_media: mediaEficiencia,
                    taxa_aprovacao_geral: taxaAprovaçãoGeral,
                    revisor_top: ranking.length > 0 ? ranking[0].nome : null,
                    eficiencia_top: ranking.length > 0 ? ranking[0].efficiency_score : 0
                }
            };
        } catch (error) {
            Logger.log("[REVIEWER_METRICS] ❌ ERRO: " + error.message);
            Logger.log("[REVIEWER_METRICS] Stack: " + (error.stack || "N/A"));
            return {
                status: "erro",
                mensagem: error.message,
                ranking: [],
                resumo: {}
            };
        }
    }

    function normalizeDateInput(value) {
        if (!value) return null;
        if (Object.prototype.toString.call(value) === "[object Date]") return value;
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) return null;
        return parsed;
    }

    function getReviewerMetricsRange(startDate, endDate) {
        try {
            const start = normalizeDateInput(startDate);
            const end = normalizeDateInput(endDate);
            if (!start || !end) {
                throw new Error("Periodo invalido para metrics range");
            }

            const startDay = new Date(start);
            startDay.setHours(0, 0, 0, 0);
            const endDay = new Date(end);
            endDay.setHours(23, 59, 59, 999);

            const inspecoes = _query({
                collection: "INSPECOES",
                orderBy: [{ field: "DATA_REGISTRO", direction: "desc" }]
            });

            if (!inspecoes || inspecoes.length === 0) {
                return {
                    status: "sucesso",
                    periodo_inicio: Utilities.formatDate(startDay, "America/Sao_Paulo", "yyyy-MM-dd"),
                    periodo_fim: Utilities.formatDate(endDay, "America/Sao_Paulo", "yyyy-MM-dd"),
                    ranking: [],
                    resumo: {}
                };
            }

            const headerIndices = {};
            const headers = getHeadersFromSheet("INSPECOES");
            headers.forEach((h, idx) => {
                headerIndices[h] = idx;
            });

            const metricas = {};
            const dataIdx = headerIndices["DATA_REGISTRO"];
            const revisorIdx = headerIndices["REVISOR"];
            const tempoIdx = headerIndices["TEMPO_TOTAL_SEG"];
            const statusIdx = headerIndices["STATUS_FINAL"];
            const defeitosIdx = headerIndices["DEFEITOS_TOTAIS"];
            const tipoIdx = headerIndices["TIPO_TECIDO"];

            function getRowValue(row, header, idx) {
                if (!row) return null;
                if (Array.isArray(row)) return row[idx];
                if (typeof row !== "object") return null;
                if (row[header] !== undefined) return row[header];
                const lower = String(header || "").toLowerCase();
                if (row[lower] !== undefined) return row[lower];
                const snake = lower.replace(/[^\w]+/g, "_");
                if (row[snake] !== undefined) return row[snake];
                return null;
            }

            let totalTempoSeg = 0;
            let totalInspecoes = 0;
            let totalTempoSegMalha = 0;
            let totalInspecoesMalha = 0;
            let totalTempoSegPlano = 0;
            let totalInspecoesPlano = 0;

            inspecoes.forEach(row => {
                try {
                    const dataStr = getRowValue(row, "DATA_REGISTRO", dataIdx);
                    if (!dataStr) return;

                    const rowDate = new Date(dataStr);
                    if (rowDate < startDay || rowDate > endDay) return;

                    const revisor = String(getRowValue(row, "REVISOR", revisorIdx) || "Nao identificado").trim();
                    if (!revisor || revisor.length === 0) return;

                    if (!metricas[revisor]) {
                        metricas[revisor] = {
                            nome: revisor,
                            total_inspecoes: 0,
                            tempo_total_seg: 0,
                            tempo_minimo_seg: Infinity,
                            tempo_maximo_seg: 0,
                            aprovadas: 0,
                            rejeitadas: 0,
                            supervisor: 0,
                            defeitos_total: 0,
                            area_total_m2: 0
                        };
                    }

                    const m = metricas[revisor];
                    m.total_inspecoes++;
                    const tempoSeg = ensureNumber(getRowValue(row, "TEMPO_TOTAL_SEG", tempoIdx));
                    m.tempo_total_seg += tempoSeg;
                    totalInspecoes++;
                    if (tempoSeg > 0) totalTempoSeg += tempoSeg;
                    if (tempoSeg > 0) {
                        m.tempo_minimo_seg = Math.min(m.tempo_minimo_seg, tempoSeg);
                        m.tempo_maximo_seg = Math.max(m.tempo_maximo_seg, tempoSeg);
                    }

                    const status = String(getRowValue(row, "STATUS_FINAL", statusIdx) || "").toUpperCase().trim();
                    if (status.includes("APROVAD")) {
                        m.aprovadas++;
                    } else if (status.includes("REJEIT")) {
                        m.rejeitadas++;
                    } else if (status.includes("SUPERVISOR")) {
                        m.supervisor++;
                    }

                    m.defeitos_total += ensureNumber(getRowValue(row, "DEFEITOS_TOTAIS", defeitosIdx));

                    const areaIdx = headerIndices["AREA_M2"];
                    if (areaIdx !== undefined) {
                        m.area_total_m2 += ensureNumber(getRowValue(row, "AREA_M2", areaIdx));
                    }

                    const tipoRaw = getRowValue(row, "TIPO_TECIDO", tipoIdx);
                    const tipo = String(tipoRaw || "").toUpperCase().trim();
                    if (tipo === "MALHA") {
                        totalInspecoesMalha++;
                        if (tempoSeg > 0) totalTempoSegMalha += tempoSeg;
                    } else if (tipo === "PLANO") {
                        totalInspecoesPlano++;
                        if (tempoSeg > 0) totalTempoSegPlano += tempoSeg;
                    }
                } catch (e) {
                    Logger.log(`[REVIEWER_METRICS_RANGE] Erro ao processar linha: ${e.message}`);
                }
            });

            const periodoDias = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000)) + 1);

            const ranking = Object.values(metricas).map(m => {
                const tempo_medio_min = m.total_inspecoes > 0 ? Number((m.tempo_total_seg / m.total_inspecoes / 60).toFixed(1)) : 0;
                const taxa_aprovacao = m.total_inspecoes > 0 ? Number(((m.aprovadas / m.total_inspecoes) * 100).toFixed(1)) : 0;
                const defeitos_media = m.total_inspecoes > 0 ? Number((m.defeitos_total / m.total_inspecoes).toFixed(2)) : 0;

                const velocidadeScore = Math.max(0, Math.min(100, 100 - (tempo_medio_min / 30 * 100)));
                const qualidadeScore = taxa_aprovacao;
                const defectScore = Math.max(0, 100 - (defeitos_media / 5 * 100));

                const efficiency_score = Number((velocidadeScore * 0.4 + qualidadeScore * 0.4 + defectScore * 0.2).toFixed(0));

                return {
                    nome: m.nome,
                    total_inspecoes: m.total_inspecoes,
                    tempo_medio_min: tempo_medio_min,
                    tempo_minimo_min: Number((m.tempo_minimo_seg / 60).toFixed(1)),
                    tempo_maximo_min: Number((m.tempo_maximo_seg / 60).toFixed(1)),
                    taxa_aprovacao: taxa_aprovacao,
                    aprovadas: m.aprovadas,
                    rejeitadas: m.rejeitadas,
                    supervisor: m.supervisor,
                    defeitos_total: m.defeitos_total,
                    defeitos_media: defeitos_media,
                    area_total_m2: Number(m.area_total_m2.toFixed(2)),
                    area_media_m2: m.total_inspecoes > 0 ? Number((m.area_total_m2 / m.total_inspecoes).toFixed(2)) : 0,
                    efficiency_score: efficiency_score,
                    producao_m2_dia: m.total_inspecoes > 0 ? Number((m.area_total_m2 / periodoDias).toFixed(2)) : 0
                };
            });

            ranking.sort((a, b) => b.efficiency_score - a.efficiency_score);

            const totalInspecoesResumo = ranking.reduce((sum, r) => sum + r.total_inspecoes, 0);
            const mediaEficiencia = ranking.length > 0 ? Number((ranking.reduce((sum, r) => sum + r.efficiency_score, 0) / ranking.length).toFixed(0)) : 0;
            const taxaAprovacaoGeral = totalInspecoesResumo > 0 ? Number(((ranking.reduce((sum, r) => sum + r.aprovadas, 0) / totalInspecoesResumo) * 100).toFixed(1)) : 0;

            const tempoMedioGeral = totalInspecoesResumo > 0 ? Number((totalTempoSeg / totalInspecoesResumo / 60).toFixed(1)) : 0;
            const tempoMedioMalha = totalInspecoesMalha > 0 ? Number((totalTempoSegMalha / totalInspecoesMalha / 60).toFixed(1)) : 0;
            const tempoMedioPlano = totalInspecoesPlano > 0 ? Number((totalTempoSegPlano / totalInspecoesPlano / 60).toFixed(1)) : 0;

            return {
                status: "sucesso",
                periodo_inicio: Utilities.formatDate(startDay, "America/Sao_Paulo", "yyyy-MM-dd"),
                periodo_fim: Utilities.formatDate(endDay, "America/Sao_Paulo", "yyyy-MM-dd"),
                periodo_dias: periodoDias,
                data_consultada: Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss"),
                ranking: ranking,
                resumo: {
                    total_revisores: ranking.length,
                    total_inspecoes: totalInspecoesResumo,
                    total_tempo_seg: totalTempoSeg,
                    tempo_medio_min: tempoMedioGeral,
                    total_inspecoes_malha: totalInspecoesMalha,
                    total_tempo_seg_malha: totalTempoSegMalha,
                    tempo_medio_min_malha: tempoMedioMalha,
                    total_inspecoes_plano: totalInspecoesPlano,
                    total_tempo_seg_plano: totalTempoSegPlano,
                    tempo_medio_min_plano: tempoMedioPlano,
                    eficiencia_media: mediaEficiencia,
                    taxa_aprovacao_geral: taxaAprovacaoGeral,
                    revisor_top: ranking.length > 0 ? ranking[0].nome : null,
                    eficiencia_top: ranking.length > 0 ? ranking[0].efficiency_score : 0
                }
            };
        } catch (error) {
            Logger.log("[REVIEWER_METRICS_RANGE] ❌ ERRO: " + error.message);
            Logger.log("[REVIEWER_METRICS_RANGE] Stack: " + (error.stack || "N/A"));
            return {
                status: "erro",
                mensagem: error.message,
                ranking: [],
                resumo: {}
            };
        }
    }

    /* ============================
     * �🔄 ALTERADO: API PÚBLICA (POWER BI VERSION v9)
     * ============================ */
    return {
        // 🔧 CRUD PRINCIPAL
        rolls: Rolls,
        audit: Audit,
        telemetry: Telemetry,

        // 📝 FUNÇÕES DE CONSULTA
        getReportById(id) {
  try {
    const doc = Rolls.get(id);
    if (!doc) return null;

    // Preferir colunas da INSPECOES
    const created = doc.DATA_REGISTRO || doc.timestamps?.criado_em;
    const updated = doc.DATA_ATUALIZACAO || doc.timestamps?.atualizado_em;

    if (created) doc.created_at_display = formatDateBrazil(created);
    if (updated) doc.updated_at_display = formatDateBrazil(updated);

    return { ...doc };
  } catch (error) {
    Logger.log("[DB] ⚠️ Erro ao buscar report: " + error.message);
    return null;
  }
},

        getDefectsByRevisionId(revisionId) {
            try {
                return _query({
                    collection: "defeitos",
                    where: [{ field: "revision_id", op: "==", value: revisionId }],
                    orderBy: [{ field: "timestamp", direction: "desc" }]
                });
            } catch (error) {
                Logger.log("[DB] ⚠️ Erro ao buscar defeitos: " + error.message);
                return [];
            }
        },

        getPhotosByRevisionId(revisionId) {
            try {
                return _query({
                    collection: "fotos",
                    where: [{ field: "revision_id", op: "==", value: revisionId }],
                    orderBy: [{ field: "timestamp", direction: "desc" }]
                });
            } catch (error) {
                Logger.log("[DB] ⚠️ Erro ao buscar fotos: " + error.message);
                return [];
            }
        },

        // 💾 OPERAÇÕES GENÉRICAS
        insertDocument: _insert,
        getDocument: _get,
        patchDocument: _update,
        deleteDocument: _delete,
        databaseQuery: _query,

        // 🆕 POWER BI: PONTO ÚNICO DE PERSISTÊNCIA
        insertStructuredData,

        // 📊 MÉTRICAS DE REVISOR
        getReviewerMetrics,
        getReviewerMetricsRange,

        // 🆕 UTILITÁRIOS EXPOSTOS
        generateShortRevisionId
    };

})();

function insertStructuredData(payload) {
  try {
    Logger.log("[GLOBAL_WRAPPER] insertStructuredData chamada via google.script.run");
    Logger.log("[GLOBAL_WRAPPER] Payload recebido: " + JSON.stringify(payload));

    if (!payload) {
      Logger.log("[GLOBAL_WRAPPER] ERRO: Payload é nulo/undefined");
      return { status: "FALHA", message: "Payload é obrigatório" };
    }
    if (!payload.rolo) {
      Logger.log("[GLOBAL_WRAPPER] ERRO: Payload.rolo é nulo/undefined");
      return { status: "FALHA", message: "Payload.rolo é obrigatório" };
    }

    Logger.log("[GLOBAL_WRAPPER] Payload.rolo keys: " + Object.keys(payload.rolo));
    Logger.log("[GLOBAL_WRAPPER] Payload.rolo: " + JSON.stringify(payload.rolo));

    // 1) Persistência
    const result = DatabaseService.insertStructuredData(payload);

    // Se falhou, retorna erro
        if (!result || !result.success) {
            const errMsg = result?.message || result?.error || "Falha na persistencia";
            Logger.log("[GLOBAL_WRAPPER] ERRO: Falha na persistência: " + errMsg);
            return {
                ...result,
                status: "FALHA",
                message: errMsg
            };
        }

    // 2) Workflow pós-persistência
    const rolo = payload.rolo || {};
    const revisionId = result.data?.revision_id;
    if (!revisionId) {
      Logger.log("[GLOBAL_WRAPPER] ⚠️ Sem revision_id para workflow; pulando transição.");
      return result;
    }

    const usuario = String(rolo.revisor_nome || rolo.revisor || "sistema").trim();
    const notas = String(rolo.observacoes || "").trim();

    // ------------------------------------------------------------
    // ✅ PASSO CRÍTICO: garantir "em_revisao" antes de qualquer decisão
    // ------------------------------------------------------------
    try {
      const docAtual = DatabaseService.rolls.get(revisionId);
      const faseAtual = String(docAtual?.fase_atual || "criado").trim().toLowerCase();

      Logger.log(`[GLOBAL_WRAPPER] Workflow: fase_atual(${revisionId}) = ${faseAtual}`);

      if (faseAtual === "criado" || !docAtual?.fase_atual) {
        WorkflowService.transition(revisionId, "em_revisao", {
          usuario,
          motivo: "Início da revisão (auto)",
          notas: null
        });
        Logger.log(`[GLOBAL_WRAPPER] ✅ Transição automática: criado → em_revisao (${revisionId})`);
      }
    } catch (e) {
      Logger.log("[GLOBAL_WRAPPER] ⚠️ Falha ao garantir em_revisao: " + e.message);
      // não aborta aqui, mas é bem raro falhar se o GET estiver ok
    }

    // status vindo do form
    let statusForm = String(rolo.status_rolo || "").trim().toLowerCase();
    if (statusForm === "em_analise") statusForm = "aguardando_supervisor";

    let nextPhase = "";
    let motivo = null;

    // Regra: se mandou para análise, é supervisor (sem score)
    if (statusForm === "aguardando_supervisor") {
      nextPhase = "aguardando_supervisor";
      motivo = "Encaminhado para análise do supervisor (decisão do revisor).";
    } else {
      // statusForm = aprovado_revisor -> precisa olhar score/decisão
      try {
        if (typeof calculateScoreAndDecision === "function") {
          const scoreInfo = calculateScoreAndDecision(rolo);
          nextPhase = String(scoreInfo?.nextPhase || "").trim().toLowerCase();
          motivo = scoreInfo?.motivo || null;
        }
      } catch (e) {
        Logger.log("[GLOBAL_WRAPPER] ⚠️ Falha ao calcular score/decisão: " + e.message);
      }

      // Fallback seguro: sem score, não manda para estoque
      if (!nextPhase) {
        nextPhase = "aguardando_supervisor";
        motivo = motivo || "Fallback: não foi possível calcular decisão; enviado ao supervisor.";
      }
    }

    if (nextPhase === "em_analise") nextPhase = "aguardando_supervisor";

    // ------------------------------------------------------------
    // ✅ Aplicar transições conforme ALLOWED
    // ------------------------------------------------------------
        function safeTransition(id, phase, opts) {
            try {
                return WorkflowService.transition(id, phase, opts);
            } catch (e) {
                const msg = String(e && e.message ? e.message : e);
                if (msg.indexOf("Transição inválida") >= 0) {
                    Logger.log("[GLOBAL_WRAPPER] ⚠️ Forcando transicao: " + msg);
                    return WorkflowService.transition(id, phase, {
                        ...opts,
                        force: true,
                        motivo: (opts && opts.motivo ? opts.motivo + " (force)" : "force")
                    });
                }
                throw e;
            }
        }

        if (nextPhase === "em_estoque") {
            // precisa passar por aprovado_revisor
            safeTransition(revisionId, "aprovado_revisor", {
                usuario,
                motivo: motivo || "Aprovado pelo revisor",
                notas
            });
            safeTransition(revisionId, "em_estoque", {
                usuario,
                motivo: motivo || "Encaminhado ao estoque",
                notas
            });
        } else {
            // supervisor
            safeTransition(revisionId, "aguardando_supervisor", {
                usuario,
                motivo: motivo || "Encaminhado ao supervisor",
                notas
            });
        }

    return {
      ...result,
      workflow: { id: revisionId, next_phase: nextPhase }
    };

  } catch (e) {
    Logger.log("[GLOBAL_WRAPPER] Erro: " + e.message);
    Logger.log("[GLOBAL_WRAPPER] Stack: " + (e.stack || "N/A"));
    return { status: "FALHA", message: e.message };
  }
}

// ✅ EXPOSIÇÃO GLOBAL ADICIONAL
globalThis.DatabaseService = DatabaseService;
globalThis.insertStructuredData = insertStructuredData;
globalThis.getReviewerMetrics = function(periodos_dias = 30) {
    try {
        return DatabaseService.getReviewerMetrics(periodos_dias);
    } catch (error) {
        Logger.log("[GLOBAL_WRAPPER] Erro ao obter métricas de revisor: " + error.message);
        return {
            status: "erro",
            mensagem: error.message,
            ranking: [],
            resumo: {}
        };
    }
};

globalThis.getReviewerMetricsRange = function(startDate, endDate) {
    try {
        return DatabaseService.getReviewerMetricsRange(startDate, endDate);
    } catch (error) {
        Logger.log("[GLOBAL_WRAPPER] Erro ao obter métricas de revisor (range): " + error.message);
        return {
            status: "erro",
            mensagem: error.message,
            ranking: [],
            resumo: {}
        };
    }
};

Logger.log("[DB] ✅ DatabaseService, insertStructuredData e getReviewerMetrics expostos globalmente");