/*******************************************************************
 * RRT_SupervisorService.gs — Backend Supervisor (v2.0)
 * - Logs via LogApp
 * - Busca eficiente por ID do Rolo
 * - Valida headers e garante colunas essenciais
 * - Bloqueio de decisões duplicadas
 * - Auditoria consistente em aba "AUDITORIA"
 * - Notificação a compras com logs e fallback
 *******************************************************************/

// -----------------------------
// Helpers internos
// -----------------------------
function _getSpreadsheet() {
  var id = (CONFIG && CONFIG.IDS && CONFIG.IDS.RRT_SPREADSHEET) ? CONFIG.IDS.RRT_SPREADSHEET : CONFIG.RRT_SPREADSHEET_ID;
  if (!id) throw new Error("RRT_SPREADSHEET_ID não configurado em CONFIG.");
  return SpreadsheetApp.openById(id);
}

function _findSheetByNameOrHeader(ss, nameCandidates, headerName) {
  // nameCandidates: array of possible sheet names; headerName: optional header to match
  nameCandidates = nameCandidates || [];
  headerName = headerName || null;

  // try exact names first
  for (var i = 0; i < nameCandidates.length; i++) {
    try {
      var sh = ss.getSheetByName(nameCandidates[i]);
      if (sh) return sh;
    } catch (e) { /* ignore */ }
  }

  // search by header if provided
  if (headerName) {
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      try {
        var sheet = sheets[s];
        var lastCol = Math.max(1, sheet.getLastColumn());
        var hdrRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
        for (var c = 0; c < hdrRow.length; c++) {
          if (String(hdrRow[c]).trim().toUpperCase() === String(headerName).trim().toUpperCase()) {
            return sheet;
          }
        }
      } catch (e) { /* ignore per sheet */ }
    }
  }

  return null;
}

function _findRowByIdOptimized(sh, idHeaderName, idValue) {
  // returns row number (1-based) or -1
  idHeaderName = idHeaderName || 'ID do Rolo';
  var hdrs = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function(h){ return String(h).trim(); });
  var colIndex = hdrs.indexOf(idHeaderName);
  if (colIndex === -1) return -1;
  var lastRow = Math.max(1, sh.getLastRow());
  if (lastRow < 2) return -1;
  var values = sh.getRange(2, colIndex + 1, lastRow - 1, 1).getValues().map(function(r){ return String(r[0]).trim(); });
  var idx = values.indexOf(String(idValue).trim());
  return idx >= 0 ? idx + 2 : -1;
}

function _ensureAuditSheet(ss) {
  var sh = _findSheetByNameOrHeader(ss, ['AUDITORIA', 'Auditoria', 'Audits'], 'ID do Rolo');
  if (!sh) {
    sh = ss.insertSheet('AUDITORIA');
    sh.getRange(1,1,1,6).setValues([['Data','ID do Rolo','Evento','Autor','Observação','Meta']]);
  }
  return sh;
}

function _ensureHeaders(sh, headersNeeded) {
  // ensure headers exist in first row; returns current headers array
  var curr = sh.getRange(1,1,1,Math.max(1, sh.getLastColumn())).getValues()[0].map(function(x){ return String(x).trim(); });
  var changed = false;
  headersNeeded.forEach(function(h){
    if (curr.indexOf(h) === -1) {
      sh.getRange(1, curr.length + 1).setValue(h);
      curr.push(h);
      changed = true;
    }
  });
  if (changed) curr = sh.getRange(1,1,1,Math.max(1, sh.getLastColumn())).getValues()[0].map(function(x){ return String(x).trim(); });
  return curr;
}

function _logAndReturnFail(fnName, msg, data) {
  try { LogApp.log(`[${fnName}] ${msg}`, LogApp.LEVELS.ERROR); } catch(e) {}
  return { status: 'FALHA', message: msg, data: data || null };
}

// -----------------------------
// Public: carregar rolo (busca eficiente)
// -----------------------------
function supervisorCarregarRolo(idRolo) {
  var fn = 'supervisorCarregarRolo';
  try {
    if (!idRolo) return _logAndReturnFail(fn, 'idRolo não fornecido');

    var ss = _getSpreadsheet();
    var sh = _findSheetByNameOrHeader(ss, ['Respostas','Respostas (Form)','Form Responses 1'], 'ID do Rolo');
    if (!sh) return _logAndReturnFail(fn, 'Aba de respostas não encontrada (procure "Respostas" ou header "ID do Rolo")');

    var rowNum = _findRowByIdOptimized(sh, 'ID do Rolo', idRolo);
    if (rowNum === -1) return _logAndReturnFail(fn, 'Rolo não encontrado: ' + idRolo);

    // build row object
    var headers = sh.getRange(1,1,1,Math.max(1, sh.getLastColumn())).getValues()[0].map(function(h){ return String(h).trim(); });
    var rowValues = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    var rowObj = {};
    headers.forEach(function(h,i){ rowObj[h] = rowValues[i]; });

    LogApp.log(`[${fn}] Rolo encontrado: ${idRolo} @linha ${rowNum}`, LogApp.LEVELS.INFO);

    return { status: 'SUCESSO', id: idRolo, raw: rowObj, row: rowNum, sheetName: sh.getName() };
  } catch (e) {
    return _logAndReturnFail(fn, 'Erro interno: ' + (e && e.message ? e.message : e));
  }
}

// -----------------------------
// Public: aprovar rolo
// -----------------------------
function supervisorAprovar(idRolo) {
  var fn = 'supervisorAprovar';
  try {
    if (!idRolo) return _logAndReturnFail(fn, 'idRolo não fornecido');

    var ss = _getSpreadsheet();
    var sh = _findSheetByNameOrHeader(ss, ['Respostas','Respostas (Form)','Form Responses 1'], 'ID do Rolo');
    if (!sh) return _logAndReturnFail(fn, 'Aba de respostas não encontrada');

    // ensure essential headers
    var headers = _ensureHeaders(sh, ['ID do Rolo','Status Supervisor','Data Decisão Supervisor','Status do Rolo','observacoes','Enviado Compras']);
    var idxStatusSup = headers.indexOf('Status Supervisor') + 1;
    var idxDate = headers.indexOf('Data Decisão Supervisor') + 1;
    var idxFinal = headers.indexOf('Status do Rolo') + 1;

    var rowNum = _findRowByIdOptimized(sh, 'ID do Rolo', idRolo);
    if (rowNum === -1) return _logAndReturnFail(fn, 'Rolo não encontrado: ' + idRolo);

    var currentSup = String(sh.getRange(rowNum, idxStatusSup).getDisplayValue() || '').trim().toUpperCase();
    var currentFinal = String(sh.getRange(rowNum, idxFinal).getDisplayValue() || '').trim().toUpperCase();

    // block duplicates or changes
    if (currentSup) {
      var msg = 'Decisão já existente pelo supervisor: ' + currentSup + '. Operação bloqueada.';
      LogApp.log(`[${fn}] ${msg}`, LogApp.LEVELS.WARN);
      return { status: 'AVISO', message: msg, id: idRolo, decisao_atual: currentSup };
    }
    if (currentFinal && (currentFinal.indexOf('APROVADO') !== -1 || currentFinal.indexOf('REPROVADO') !== -1)) {
      var msg2 = 'Status do rolo já final: ' + currentFinal + '. Operação bloqueada.';
      LogApp.log(`[${fn}] ${msg2}`, LogApp.LEVELS.WARN);
      return { status: 'AVISO', message: msg2, id: idRolo, status_rolo: currentFinal };
    }

    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    sh.getRange(rowNum, idxStatusSup).setValue('APROVADO');
    sh.getRange(rowNum, idxDate).setValue(ts);
    sh.getRange(rowNum, idxFinal).setValue('APROVADO');

    // audit
    _registrarAuditoria(ss, idRolo, 'APROVADO pelo supervisor', Session.getActiveUser ? (Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '') : '');

    SpreadsheetApp.flush();
    LogApp.log(`[${fn}] Rolo ${idRolo} aprovado.`, LogApp.LEVELS.INFO);
    return { status: 'SUCESSO', id: idRolo, decisao: 'APROVADO' };
  } catch (e) {
    return _logAndReturnFail(fn, 'Erro interno: ' + (e && e.message ? e.message : e));
  }
}

// -----------------------------
// Public: reprovar rolo (com motivo) -> notifica compras
// -----------------------------
function supervisorReprovar(idRolo, motivo) {
  var fn = 'supervisorReprovar';
  try {
    if (!idRolo) return _logAndReturnFail(fn, 'idRolo não fornecido');

    var ss = _getSpreadsheet();
    var sh = _findSheetByNameOrHeader(ss, ['Respostas','Respostas (Form)','Form Responses 1'], 'ID do Rolo');
    if (!sh) return _logAndReturnFail(fn, 'Aba de respostas não encontrada');

    // ensure headers
    var headers = _ensureHeaders(sh, ['ID do Rolo','Status Supervisor','Data Decisão Supervisor','Status do Rolo','observacoes','Enviado Compras']);
    var idxStatusSup = headers.indexOf('Status Supervisor') + 1;
    var idxDate = headers.indexOf('Data Decisão Supervisor') + 1;
    var idxFinal = headers.indexOf('Status do Rolo') + 1;
    var idxObs = headers.indexOf('observacoes') + 1;
    var idxEnviado = headers.indexOf('Enviado Compras') + 1;

    var rowNum = _findRowByIdOptimized(sh, 'ID do Rolo', idRolo);
    if (rowNum === -1) return _logAndReturnFail(fn, 'Rolo não encontrado: ' + idRolo);

    var currentSup = String(sh.getRange(rowNum, idxStatusSup).getDisplayValue() || '').trim().toUpperCase();
    var currentFinal = String(sh.getRange(rowNum, idxFinal).getDisplayValue() || '').trim().toUpperCase();

    // block duplicates or changes
    if (currentSup) {
      var msg = 'Decisão já existente pelo supervisor: ' + currentSup + '. Operação bloqueada.';
      LogApp.log(`[${fn}] ${msg}`, LogApp.LEVELS.WARN);
      return { status: 'AVISO', message: msg, id: idRolo, decisao_atual: currentSup };
    }
    if (currentFinal && (currentFinal.indexOf('APROVADO') !== -1 || currentFinal.indexOf('REPROVADO') !== -1)) {
      var msg2 = 'Status do rolo já final: ' + currentFinal + '. Operação bloqueada.';
      LogApp.log(`[${fn}] ${msg2}`, LogApp.LEVELS.WARN);
      return { status: 'AVISO', message: msg2, id: idRolo, status_rolo: currentFinal };
    }

    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    sh.getRange(rowNum, idxStatusSup).setValue('REPROVADO');
    sh.getRange(rowNum, idxDate).setValue(ts);
    sh.getRange(rowNum, idxFinal).setValue('REPROVADO');

    // append observation if present
    if (motivo && String(motivo).trim()) {
      var cur = String(sh.getRange(rowNum, idxObs).getValue() || '');
      var novo = (cur ? (cur + '\n') : '') + 'Supervisor: ' + motivo + ' (' + ts + ')';
      sh.getRange(rowNum, idxObs).setValue(novo);
    }

    // registrar auditoria
    _registrarAuditoria(ss, idRolo, 'REPROVADO pelo supervisor — Motivo: ' + (motivo || ''), Session.getActiveUser ? (Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '') : '');

    // prepare rowObj to send to compras
    var rowVals = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
    var rowObj = {};
    headers.forEach(function(h,i){ rowObj[h] = rowVals[i]; });

    // notify purchases (async-like: try/catch, but Apps Script is sync)
    var notifyOk = false;
    try {
      notifyOk = _notifyPurchases(rowObj);
      if (notifyOk && idxEnviado !== -1) sh.getRange(rowNum, idxEnviado).setValue('SIM');
    } catch (eNotify) {
      LogApp.log(`[${fn}] notifyPurchases falhou: ${eNotify && eNotify.message ? eNotify.message : eNotify}`, LogApp.LEVELS.ERROR);
    }

    SpreadsheetApp.flush();
    LogApp.log(`[${fn}] Rolo ${idRolo} reprovado. NotifiedPurchases: ${notifyOk}`, LogApp.LEVELS.INFO);
    return { status: 'SUCESSO', id: idRolo, decisao: 'REPROVADO', notifiedPurchases: !!notifyOk };
  } catch (e) {
    return _logAndReturnFail(fn, 'Erro interno: ' + (e && e.message ? e.message : e));
  }
}

// -----------------------------
// Internal: auditoria consolidada (usado por ambos)
// -----------------------------
function _registrarAuditoria(ssOrId, idRolo, evento, autor, obs) {
  var fn = '_registrarAuditoria';
  try {
    var ss = (typeof ssOrId === 'string') ? SpreadsheetApp.openById(ssOrId) : ssOrId;
    if (!ss) ss = _getSpreadsheet();

    var sh = _ensureAuditSheet(ss);
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    var row = [ts, idRolo || '', evento || '', autor || '', obs || '', ''];
    try { sh.appendRow(row); } catch (e) { var last = Math.max(1, sh.getLastRow()); sh.getRange(last+1, 1, 1, row.length).setValues([row]); }
    return true;
  } catch (e) {
    try { LogApp.log(`[${fn}] erro: ${e && e.message ? e.message : e}`, LogApp.LEVELS.ERROR); } catch (ee) {}
    return false;
  }
}

// -----------------------------
// Internal: notificação a compras (envia email ou delega a função externa)
// -----------------------------
function _notifyPurchases(rowObj) {
  var fn = '_notifyPurchases';
  try {
    if (!rowObj) { LogApp.log(`[${fn}] rowObj ausente`, LogApp.LEVELS.WARN); return false; }

    // prefer external dedicated function if exists (RRT_EmailService_Compras or similar)
    if (typeof RRT_EmailService_Compras_notify === 'function') {
      try {
        LogApp.log(`[${fn}] Enviando via RRT_EmailService_Compras_notify()`, LogApp.LEVELS.DEBUG);
        return !!RRT_EmailService_Compras_notify(rowObj);
      } catch (e) {
        LogApp.log(`[${fn}] erro RRT_EmailService_Compras_notify: ${e && e.message ? e.message : e}`, LogApp.LEVELS.WARN);
      }
    }

    // fallback: use CONFIG.EMAIL.COMPRAS or CONFIG.EMAIL_COMPRAS or field in rowObj
    var to = (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.COMPRAS) ? CONFIG.EMAIL.COMPRAS : (CONFIG && CONFIG.EMAIL_COMPRAS) ? CONFIG.EMAIL_COMPRAS : (rowObj.email_compras || rowObj['Email Compras'] || '');

    if (!to) { LogApp.log(`[${fn}] E-mail de Compras não configurado.`, LogApp.LEVELS.WARN); return false; }

    var id = rowObj['ID do Rolo'] || rowObj['ID'] || '??';
    var assunto = "AÇÃO: Rolo " + id + " - Reprovado pelo Supervisor";
    var corpo = "<p>Olá,</p>" +
               "<p>O rolo <b>" + id + "</b> foi <b>reprovado pelo supervisor</b>.</p>" +
               "<p>Favor providenciar tratativas.</p>";

    MailApp.sendEmail({ to: to, subject: assunto, htmlBody: corpo });
    LogApp.log(`[${fn}] Email enviado para Compras: ${to}`, LogApp.LEVELS.INFO);
    return true;
  } catch (e) {
    LogApp.log(`[${fn}] erro enviar email compras: ${e && e.message ? e.message : e}`, LogApp.LEVELS.ERROR);
    return false;
  }
}
