/*******************************************************************
 * SupervisorFlows.extremeLog.gs — Versão Premium (v2.1 - OTIMIZADA)
 * Refatoração: adiciona "log extremo" detalhado com escrita em planilha
 * Correções (v2.1): Tratamento de Circular JSON, I/O otimizado, Fallback TimeZone.
 *******************************************************************/

var SupervisorFlows = (function () {
  'use strict';

  /* -----------------------------
       CONFIGURAÇÃO DE LOG EXTREMO
       ----------------------------- */
  var EXTREME_LOG = (typeof CONFIG !== 'undefined' && typeof CONFIG.LOG_EXTREMO !== 'undefined') ? !!CONFIG.LOG_EXTREMO : false;
  // Tamanho máximo a gravar em uma célula para evitar problemas (ex: 5000 chars)
  var MAX_CELL_CHARS = 5000;

  /* -----------------------------
       UTILITIES & LOGGING EXTREMO
       ----------------------------- */
  function _time() { return new Date().getTime(); }

  /**
   * Converte um valor em string de forma segura, evitando loops circulares e truncando.
   */
  function _safeStringify(v, maxLen) {
    maxLen = maxLen || MAX_CELL_CHARS;
    try {
      if (v === null) return 'null';
      if (typeof v === 'undefined') return 'undefined';
      if (typeof v === 'string') return v.length > maxLen ? v.slice(0, maxLen) + '…[truncated]' : v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (typeof v === 'function') return '[Function: ' + (v.name || 'anonymous') + ']';

      // Lógica para JSON.stringify com tratamento de referência circular e truncamento
      var cache = [];
      var s = JSON.stringify(v, function (k, val) {
        if (typeof val === 'object' && val !== null) {
          if (val instanceof Date) return val.toISOString();
          
          // Tratamento de Referência Circular
          if (cache.indexOf(val) !== -1) {
            return '[Circular]';
          }
          cache.push(val);
        }
        return val;
      }, 2);
      
      cache = null; // Limpa o cache

      if (!s) s = String(v);
      if (s.length > maxLen) return s.slice(0, maxLen) + '…[truncated]';
      return s;
    } catch (e) {
      try { return '[unserializable: ' + String(e.message).slice(0, 100) + ']'; } catch (e2) { return '[unserializable]'; }
    }
  }

  function _consoleLog() {
    try {
      if (typeof LogApp !== 'undefined' && LogApp && LogApp.log) {
        LogApp.log.apply(null, arguments);
      } else {
        var args = Array.prototype.slice.call(arguments).map(function(a){ return _safeStringify(a, 200); });
        Logger.log(args.join(' '));
      }
    } catch (e) {
      // Falha silenciosa no console log, mas mantém o Logger para o erro
      try { Logger.log('CRITICAL LOG FAILURE: ' + String(e)); } catch (ee) {}
    }
  }

  function _findOrCreateLogSheet(ss) {
    try {
      // Tenta encontrar pelo nome exato primeiro
      var sh = ss.getSheetByName('LOG_EXTREMO');
      if (sh) return sh;

      var nameCandidates = ['LOG_EXTREMO', 'LOGEXTREMO', 'LOG_EXTREME', 'LOG'];
      var all = ss.getSheets();
      for (var i = 0; i < all.length; i++) {
        var n = String(all[i].getName()).toUpperCase();
        if (nameCandidates.indexOf(n) !== -1) return all[i];
      }
      // fallback create 'LOG_EXTREMO'
      sh = ss.insertSheet('LOG_EXTREMO');
      // header
      sh.getRange(1,1,1,6).setValues([['Timestamp','Nivel','Funcao','Mensagem','Dados','Stack']]);
      return sh;
    } catch (e) {
      _consoleLog('[findOrCreateLogSheet error]', e);
      return null;
    }
  }

  function _safeAppendLogRow(sh, rowArr) {
    try {
      sh.appendRow(rowArr);
    } catch (e) {
      try {
        var last = Math.max(1, sh.getLastRow());
        sh.getRange(last+1, 1, 1, rowArr.length).setValues([rowArr]);
      } catch (ee) {
        // if even this fails, console log
        _consoleLog('[safeAppendLogRow final error]', ee, rowArr);
      }
    }
  }

  function _extLog(level, funcName, message, data, stack) {
    // level: DEBUG|INFO|WARN|ERROR|AUDIT
    try {
      // console
      var tag = '[' + level + '] ' + (funcName ? funcName + ' - ' : '');
      _consoleLog(tag + (message || ''), data ? ' | ' + _safeStringify(data, 500) : '');

      if (!EXTREME_LOG) return;

      var ss = null;
      try { ss = SpreadsheetApp.openById(CONFIG.RRT_SPREADSHEET_ID); } catch (e) { ss = null; }
      
      // Fallback: Se não conseguiu abrir a planilha ou se CONFIG está indefinido
      if (!ss) {
        _consoleLog('[extLog no spreadsheet - check CONFIG.RRT_SPREADSHEET_ID]', message, data);
        return;
      }

      var sh = _findOrCreateLogSheet(ss);
      if (!sh) return;
      
      // Timezone fallback melhorado
      var timezone = Session.getScriptTimeZone ? Session.getScriptTimeZone() : ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : 'GMT';
      var ts = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd HH:mm:ss');
      
      var row = [ts, level, funcName || '', String(message || '').slice(0, MAX_CELL_CHARS), _safeStringify(data, MAX_CELL_CHARS), stack ? String(stack).slice(0, MAX_CELL_CHARS) : ''];
      _safeAppendLogRow(sh, row);
    } catch (e) {
      // Se _extLog falha, usamos Logger.log para garantir que o erro seja registrado
      try { 
        Logger.log('FATAL ERROR IN _extLog: ' + String(e));
        Logger.log('Log Content Failed: Level=' + level + ', Func=' + funcName + ', Msg=' + message);
      } catch (ee) {}
    }
  }

  function _logEnter(funcName, argsObj) {
    try { _extLog('DEBUG', funcName, 'ENTER', { args: argsObj }); } catch (e) {}
  }
  function _logExit(funcName, result, elapsedMs) {
    try { _extLog('DEBUG', funcName, 'EXIT', { result: result, elapsedMs: elapsedMs }); } catch (e) {}
  }

  /* -----------------------------
       EXISTING UTILITIES (mantivemos, mas com logs)
       ----------------------------- */
  function _safeGetSheetByHeader(ss, headerName) {
    var fn = '_safeGetSheetByHeader'; var st = _time(); _logEnter(fn, { headerName: headerName });
    try {
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        var sh = sheets[i];
        var lastCol = Math.max(1, sh.getLastColumn());
        var hdrRow = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
        for (var j = 0; j < hdrRow.length; j++) {
          if (String(hdrRow[j]).trim().toUpperCase() === String(headerName).trim().toUpperCase()) {
            _extLog('DEBUG', fn, 'Found sheet by header', { sheet: sh.getName(), header: headerName });
            _logExit(fn, { sheetName: sh.getName() }, _time() - st);
            return sh;
          }
        }
      }
      _logExit(fn, null, _time() - st);
      return null;
    } catch (e) {
      _extLog('ERROR', fn, 'Error in _safeGetSheetByHeader', { headerName: headerName, error: e }, e.stack || '');
      _logExit(fn, 'error', _time() - st);
      throw e;
    }
  }

  function _ensureHeader(sh, headersArr) {
    var fn = '_ensureHeader'; var st = _time(); _logEnter(fn, { sheet: sh ? sh.getName() : 'null', headers: headersArr });
    try {
      var current = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function(x){ return String(x).trim(); });
      var changed = false;
      headersArr.forEach(function(name){
        if (current.indexOf(name) === -1) {
          sh.getRange(1, current.length + 1).setValue(name);
          current.push(name);
          changed = true;
        }
      });
      if (changed) {
        // Recarregar headers após setValue e antes de retornar, para ter a versão mais recente
        SpreadsheetApp.flush(); 
        current = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function(x){ return String(x).trim(); });
      }
      _logExit(fn, { headersNow: current }, _time()-st);
      return current;
    } catch (e) {
      _extLog('ERROR', fn, 'Error ensuring header', { sheet: sh ? sh.getName() : 'null', headers: headersArr, error: e }, e.stack || '');
      _logExit(fn, 'error', _time()-st);
      throw e;
    }
  }

  function _safeAppendRow(sh, rowArr) {
    var fn = '_safeAppendRow'; var st = _time(); _logEnter(fn, { sheet: sh ? sh.getName() : 'null', rowLen: rowArr ? rowArr.length : 0 });
    try {
      try {
        sh.appendRow(rowArr);
      } catch (e) {
        var last = Math.max(1, sh.getLastRow());
        sh.getRange(last+1, 1, 1, rowArr.length).setValues([rowArr]);
      }
      _logExit(fn, 'ok', _time() - st);
    } catch (e) {
      _extLog('ERROR', fn, 'Error appending row', { error: e, row: rowArr }, e.stack || '');
      _logExit(fn, 'error', _time() - st);
      throw e;
    }
  }

  /* -----------------------------
       CORE: Busca e resumo
       ----------------------------- */
  function getRowForSupervisor(idRolo) {
    var fn = 'getRowForSupervisor'; var st = _time(); _logEnter(fn, { idRolo: idRolo });
    try {
      if (!idRolo) { _extLog('WARN', fn, 'idRolo vazio'); _logExit(fn, null, _time()-st); return null; }
      var ss = SpreadsheetApp.openById(CONFIG.RRT_SPREADSHEET_ID);
      var sh = _safeGetSheetByHeader(ss, 'ID do Rolo');
      if (!sh) { _extLog('WARN', fn, 'sheet ID do Rolo não encontrada'); _logExit(fn, null, _time()-st); return null; }

      var data = sh.getDataRange().getValues();
      if (!data || data.length < 1) { _logExit(fn, null, _time()-st); return null; }
      var headers = data[0].map(function(h){ return String(h).trim(); });
      var idxId = headers.indexOf('ID do Rolo');
      if (idxId === -1) { _extLog('ERROR', fn, 'Coluna ID do Rolo não encontrada'); _logExit(fn, null, _time()-st); return null; }

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idxId]).trim() === String(idRolo).trim()) {
          var obj = {};
          headers.forEach(function(h, i){ obj[h] = data[r][i]; });
          obj.__rowNum = r + 1;
          obj.__sheetName = sh.getName();
          _extLog('INFO', fn, 'Row found', { idRolo: idRolo, rowNum: obj.__rowNum, sheet: obj.__sheetName });
          _logExit(fn, obj, _time()-st);
          return obj;
        }
      }
      _extLog('INFO', fn, 'Rolo não encontrado', { idRolo: idRolo });
      _logExit(fn, null, _time()-st);
      return null;
    } catch (e) {
      _extLog('ERROR', fn, 'Exception', { idRolo: idRolo, error: e }, e.stack || '');
      _logExit(fn, 'error', _time()-st);
      return null;
    }
  }

  function fetchRRTSummaryForSupervisor(idRolo) {
    var fn = 'fetchRRTSummaryForSupervisor'; var st = _time(); _logEnter(fn, { idRolo: idRolo });
    try {
      var row = getRowForSupervisor(idRolo);
      if (!row) { _logExit(fn, null, _time()-st); return null; }
      var out = {
        fornecedor: row['fornecedor'] || row['Fornecedor'] || row['Fornecedor/Empresa'] || '',
        numero_peca: row['numero_peca'] || row['Nº da Peça'] || '',
        status_rolo: row['Status do Rolo'] || row['status_rolo'] || '',
        rowNum: row.__rowNum || -1,
        rowObj: row
      };
      _extLog('DEBUG', fn, 'Summary built', out);
      _logExit(fn, out, _time()-st);
      return out;
    } catch (e) {
      _extLog('ERROR', fn, 'Error building summary', { idRolo: idRolo, error: e }, e.stack || '');
      _logExit(fn, 'error', _time()-st);
      return null;
    }
  }

  /* -----------------------------
       CORE: Processamento da decisão
       ----------------------------- */
  function processarDecisao() {
    var fn = 'processarDecisao'; var st = _time(); _logEnter(fn, { args: Array.prototype.slice.call(arguments) });
    try {
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 1 && typeof args[0] === 'object') {
        var res = processSupervisorDecision(args[0]); _logExit(fn, res, _time()-st); return res;
      }
      if (args.length >= 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
        var payload = { idRolo: args[0], decision: args[1], supervisorName: args[2] || (typeof CONFIG !== 'undefined' ? CONFIG.SUPERVISOR_NOME : undefined) };
        var res2 = processSupervisorDecision(payload); _logExit(fn, res2, _time()-st); return res2;
      }
      throw new Error('Parâmetros inválidos para processarDecisao');
    } catch (e) {
      _extLog('ERROR', fn, 'Error in processarDecisao', { error: e, args: arguments }, e.stack || '');
      _logExit(fn, 'error', _time()-st);
      return { status: 'FALHA', message: String(e) };
    }
  }

  function processSupervisorDecision(payload) {
    var fn = 'processSupervisorDecision'; var st = _time(); _logEnter(fn, { payload: payload });
    try {
      if (!payload || typeof payload !== 'object') throw new Error('payload inválido');
      var id = String(payload.idRolo || payload.id || '').trim();
      var decision = String(payload.decision || payload.decisao || payload.status || '').trim().toUpperCase();
      var obs = payload.observacoes || payload.observation || payload.obs || '';

      if (!id) throw new Error('idRolo é obrigatório');
      if (!decision) throw new Error('decision é obrigatório');

      var ss = SpreadsheetApp.openById(CONFIG.RRT_SPREADSHEET_ID);
      var sh = _safeGetSheetByHeader(ss, 'ID do Rolo');
      if (!sh) throw new Error('Planilha com "ID do Rolo" não encontrada');

      var dataRange = sh.getDataRange();
      var data = dataRange.getValues();
      var headers = data[0].map(function(h){ return String(h).trim(); });
      var idxId = headers.indexOf('ID do Rolo');
      if (idxId === -1) throw new Error('Coluna "ID do Rolo" não encontrada');

      // find row
      var rowNum = -1;
      var rowIndexInArray = -1;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idxId]).trim() === id) { rowNum = r + 1; rowIndexInArray = r; break; }
      }
      if (rowNum === -1) throw new Error('Rolo não encontrado: ' + id);

      // ensure headers and indices
      headers = _ensureHeader(sh, ['Status Supervisor','Data Decisão Supervisor','Nome Supervisor','Status do Rolo','observacoes','Enviado Compras']);
      var idxStatusSupervisor = headers.indexOf('Status Supervisor');
      var idxDateDecision = headers.indexOf('Data Decisão Supervisor');
      var idxNomeSupervisor = headers.indexOf('Nome Supervisor');
      var idxStatusDoRolo = headers.indexOf('Status do Rolo');
      var idxObservacoes = headers.indexOf('observacoes');
      var idxEnviadoCompras = headers.indexOf('Enviado Compras');

      // Leitura única da linha para status atuais (melhoria de performance)
      var currentRowValues = data[rowIndexInArray]; 
      
      var currentSupervisorStatus = String(currentRowValues[idxStatusSupervisor] || '').trim().toUpperCase();
      var currentStatusDoRolo = String(currentRowValues[idxStatusDoRolo] || '').trim();
      
      var supervisorName = payload.supervisorName || payload.supervisor || (Session && Session.getActiveUser && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '') || (typeof CONFIG !== 'undefined' ? CONFIG.SUPERVISOR_NOME : '') || 'UNKNOWN';
      
      // Always log attempt
      _extLog('AUDIT', fn, 'Tentativa Decisão', { id: id, decision: decision, supervisorName: supervisorName, obs: obs });
      logAuditEvent(id, 'Tentativa Decisão: ' + decision, supervisorName, 'Observacao: ' + (obs || ''));

      // Block if already decided by supervisor
      if (currentSupervisorStatus) {
        if (currentSupervisorStatus === decision) {
          _extLog('WARN', fn, 'Tentativa duplicada', { id: id, current: currentSupervisorStatus });
          logAuditEvent(id, 'Tentativa DUPLICADA: ' + decision, supervisorName, obs);
          return { status: 'AVISO', id: id, decisao_final: currentSupervisorStatus, message: 'O rolo já possui o status de Supervisor: ' + currentSupervisorStatus + '. Nenhuma alteração foi feita.' };
        }
        _extLog('WARN', fn, 'Tentativa alterar decisão - bloqueada', { id: id, atual: currentSupervisorStatus, nova: decision });
        logAuditEvent(id, 'Tentativa ALTERAR decisão: atual=' + currentSupervisorStatus + ' nova=' + decision, supervisorName, obs);
        return { status: 'AVISO', id: id, decisao_final: currentSupervisorStatus, message: 'Decisão já tomada anteriormente como ' + currentSupervisorStatus + '. Alterações não são permitidas.' };
      }

      // Block if status_rolo already final
      if (currentStatusDoRolo && (currentStatusDoRolo.toUpperCase().indexOf('APROVADO') !== -1 || currentStatusDoRolo.toUpperCase().indexOf('REPROVADO') !== -1)) {
        _extLog('WARN', fn, 'Bloqueado por status_rolo final', { id: id, status_rolo: currentStatusDoRolo });
        logAuditEvent(id, 'Tentativa bloqueada por status_rolo: ' + currentStatusDoRolo, supervisorName, obs);
        return { status: 'AVISO', id: id, decisao_final: currentStatusDoRolo, message: 'Status do Rolo já encontra-se em "' + currentStatusDoRolo + '". Operação bloqueada.' };
      }
      
      // Timezone fallback melhorado
      var timezone = Session.getScriptTimeZone ? Session.getScriptTimeZone() : ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : 'GMT';

      // Apply decision
      var ts = Utilities.formatDate(new Date(), timezone, 'dd/MM/yyyy HH:mm:ss');
      sh.getRange(rowNum, idxStatusSupervisor + 1).setValue(decision);
      sh.getRange(rowNum, idxDateDecision + 1).setValue(ts);
      sh.getRange(rowNum, idxNomeSupervisor + 1).setValue(supervisorName);

      var finalStatus = decision === 'APROVADO' ? 'APROVADO' : 'REPROVADO - ENVIADO PARA COMPRAS';
      sh.getRange(rowNum, idxStatusDoRolo + 1).setValue(finalStatus);

      // Observations append
      if (obs && String(obs).trim()) {
        // Agora precisamos da RANGE para obter o valor atual de Observações
        var curObsRange = sh.getRange(rowNum, idxObservacoes + 1);
        var curObs = String(curObsRange.getValue() || '');
        var novo = (curObs ? curObs + '\n' : '') + 'Supervisor (' + supervisorName + '): ' + obs;
        curObsRange.setValue(novo);
      }

      // flush before notifications
      SpreadsheetApp.flush();

      // audit applied
      logAuditEvent(id, 'Decisão Supervisor: ' + decision, supervisorName, obs);
      _extLog('INFO', fn, 'Decisão aplicada', { id: id, decision: decision, finalStatus: finalStatus });

      // if rejected, notify purchases and mark column
      if (decision === 'REPROVADO') {
        // Recarrega a linha após as escritas para garantir os dados atualizados
        var rowVals = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
        var rowObj = {};
        headers.forEach(function(h,i){ rowObj[h] = rowVals[i]; });
        
        try { notifyPurchases(rowObj); } catch (eNotify) { _extLog('ERROR', fn, 'notifyPurchases error', { error: eNotify }, eNotify.stack || ''); }
        // mark Enviado Compras
        if (idxEnviadoCompras !== -1) {
          sh.getRange(rowNum, idxEnviadoCompras + 1).setValue('SIM');
        }
      }

      SpreadsheetApp.flush();
      var result = { status: 'SUCESSO', id: id, decisao_final: decision };
      _logExit(fn, result, _time()-st);
      return result;

    } catch (e) {
      _extLog('ERROR', 'processSupervisorDecision', 'Exception', { payload: payload, error: e }, e.stack || '');
      try { logAuditEvent((payload && payload.idRolo) ? payload.idRolo : '?', 'Erro processSupervisorDecision: ' + e.message, 'SYSTEM', _safeStringify(payload)); } catch (ee) {}
      _logExit('processSupervisorDecision', 'error', _time()-st);
      return { status: 'FALHA', message: String(e) };
    }
  }

  /* -----------------------------
       NOTIFY: Compras (com logs)
       ----------------------------- */
  function notifyPurchases(rowObj) {
    var fn = 'notifyPurchases';
    var st = _time();
    _logEnter(fn, { rowId: rowObj && (rowObj['ID do Rolo'] || rowObj['ID']) });

    try {
      var to = (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.COMPRAS) ? CONFIG.EMAIL.COMPRAS : CONFIG.EMAIL_COMPRAS;
      if (!to) {
        _extLog('WARN', fn, 'Email de compras não configurado', { rowObj: rowObj });
        _logExit(fn, false, _time() - st);
        return false;
      }

      if (!rowObj) {
        _extLog('WARN', fn, 'notifyPurchases sem dados da linha', {});
        _logExit(fn, false, _time() - st);
        return false;
      }

      var mainData = Object.assign({}, rowObj);
      if (!mainData['ID do Rolo']) {
        mainData['ID do Rolo'] = rowObj['ID'] || rowObj['id_rolo'] || '';
      }
      if (!mainData.peso_fabrica && mainData.peso_fornecedor) {
        mainData.peso_fabrica = mainData.peso_fornecedor;
      }

      var defectsRaw =
        rowObj['Defeitos (JSON)'] ||
        rowObj['defeitos_json'] ||
        rowObj['Defeitos'] ||
        rowObj['DEFEITOS_JSON'] ||
        '';
      var defects = [];
      if (defectsRaw) {
        try {
          defects = JSON.parse(defectsRaw);
        } catch (parseErr) {
          _extLog('WARN', fn, 'Falha ao converter Defeitos JSON', { error: parseErr });
        }
      }
      if (!Array.isArray(defects)) defects = [];

      var photoIds = [];
      defects.forEach(function (d) {
        if (!d) return;
        var pid = d.savedPhotoId || d.fotoId;
        if (pid) photoIds.push(pid);
      });
      photoIds = photoIds.length ? Array.from(new Set(photoIds)) : [];

      var docsResult = {};
      if (typeof generateAllDocs === 'function') {
        try {
          docsResult = generateAllDocs(mainData, defects, photoIds);
        } catch (docErr) {
          docsResult = {};
          _extLog('ERROR', fn, 'generateAllDocs falhou', { error: docErr }, docErr.stack || '');
        }
      } else {
        _extLog('WARN', fn, 'generateAllDocs não disponível, e-mail seguirá sem anexos', {});
      }

      if (typeof sendComprasEmail === 'function') {
        sendComprasEmail(mainData, defects, docsResult || {});
      } else {
        _extLog('WARN', fn, 'sendComprasEmail não disponível', {});
      }

      _extLog('INFO', fn, 'Notificação de compras processada', { id: mainData['ID do Rolo'], to: to });
      _logExit(fn, true, _time() - st);
      return true;

    } catch (e) {
      _extLog('ERROR', fn, 'Erro notifyPurchases', { error: e, rowObj: rowObj }, e.stack);
      _logExit(fn, false, _time() - st);
      return false;
    }
  }

  /* -----------------------------
       AUDIT (melhorado para suportar gravação extra de logs)
       ----------------------------- */
  function logAuditEvent(idRolo, evento, autor, obs) {
    var fn = 'logAuditEvent'; var st = _time(); _logEnter(fn, { idRolo: idRolo, evento: evento, autor: autor });
    try {
      var ss = SpreadsheetApp.openById(CONFIG.RRT_SPREADSHEET_ID);
      var sh = ss.getSheetByName('AUDITORIA');
      if (!sh) {
        var all = ss.getSheets();
        for (var i = 0; i < all.length; i++) {
          if (String(all[i].getName()).toUpperCase().indexOf('AUDIT') !== -1) { sh = all[i]; break; }
        }
      }
      if (!sh) {
        sh = ss.insertSheet('AUDITORIA');
        sh.getRange(1, 1, 1, 5).setValues([['ID do Rolo','Data','Evento','Autor','Observação']]);
      } else {
        var firstRow = sh.getRange(1, 1, 1, Math.max(5, sh.getLastColumn())).getValues()[0].map(function(x){ return String(x).trim(); });
        if (firstRow.length < 5 || !firstRow[0] || firstRow[0].toUpperCase() !== 'ID DO ROLO') {
          sh.getRange(1, 1, 1, 5).setValues([['ID do Rolo','Data','Evento','Autor','Observação']]);
        }
      }

      var row = [idRolo, new Date(), evento, autor || '', obs || ''];
      try { sh.appendRow(row); }
      catch (errAppend) { var last = Math.max(1, sh.getLastRow()); sh.getRange(last+1, 1, 1, row.length).setValues([row]); }
      SpreadsheetApp.flush();

      // Also write EXTREME log entry for audits
      _extLog('AUDIT', fn, evento, { idRolo: idRolo, autor: autor, obs: obs });
      _logExit(fn, true, _time()-st);
      return true;
    } catch (e) {
      _extLog('ERROR', fn, 'Erro logAuditEvent', { error: e, idRolo: idRolo }, e.stack || '');
      _logExit(fn, false, _time()-st);
      return false;
    }
  }

  /* -----------------------------
       EXPORTS
       ----------------------------- */
  return {
    fetchRRTSummaryForSupervisor: fetchRRTSummaryForSupervisor,
    getRowForSupervisor: getRowForSupervisor,
    processarDecisao: processarDecisao,
    processSupervisorDecision: processSupervisorDecision,
    notifyPurchases: notifyPurchases,
    logAuditEvent: logAuditEvent,
    // expose flag for runtime toggle if needed
    setExtremeLog: function(v) { EXTREME_LOG = !!v; _extLog('INFO', 'setExtremeLog', 'EXTREME_LOG set', { EXTREME_LOG: EXTREME_LOG }); },
    isExtremeLogEnabled: function(){ return EXTREME_LOG; }
  };

})();