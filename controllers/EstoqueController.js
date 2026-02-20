/*******************************************************************
 * EstoqueController v7 — INTEGRAL
 * ---------------------------------------------------------------
 * Preserva toda a lógica original de validação e telemetria.
 * Adicionado: Integração com Fotos do Drive.
 *******************************************************************/

var EstoqueController = (function () {
  "use strict";

  /* ============================================================
   * UTILITÁRIOS ORIGINAIS
   * ========================================================== */
  function now() {
    return new Date().toISOString();
  }

  function getUser() {
    return Session.getActiveUser().getEmail() || "sistema";
  }

  /* ============================================================
   * NOVO: BUSCA DE FOTOS (Sem alterar o fluxo original)
   * ========================================================== */
  function getPhotosByRollId(rollId) {
    try {
      const parentFolderName = "Relatorios de Revisao de Tecidos";
      const parentFolders = DriveApp.getFoldersByName(parentFolderName);
      if (!parentFolders.hasNext()) return [];
      
      const parentFolder = parentFolders.next();
      const rollFolders = parentFolder.getFoldersByName(rollId);
      if (!rollFolders.hasNext()) return [];
      
      const rollFolder = rollFolders.next();
      const photoSubFolders = rollFolder.getFoldersByName("FOTOS");
      if (!photoSubFolders.hasNext()) return [];
      
      const photoFolder = photoSubFolders.next();
      const files = photoFolder.getFiles();
      const photos = [];
      
      while (files.hasNext()) {
        const file = files.next();
        if (file.getMimeType().startsWith("image/")) {
          photos.push({
            url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w800",
            name: file.getName(),
            fullUrl: file.getDownloadUrl()
          });
        }
      }
      return photos;
    } catch (e) {
      Logger.log("Erro ao buscar fotos: " + e.message);
      return [];
    }
  }

  /* ============================================================
   * VALIDAR PAYLOAD (Preservado conforme sua V6)
   * ========================================================== */
  function validateWithdrawalPayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload inválido.");
    }

    const id = String(payload.id_do_rolo || "").trim();
    const qty = Number(payload.qty || 0);
    const reason = String(payload.reason || "").trim();
    const location = String(payload.location || "PRODUCAO").trim().toUpperCase();

    if (!id) throw new Error("ID do rolo ausente.");
    if (!(qty > 0)) throw new Error("Quantidade deve ser maior que zero.");
    if (!reason) throw new Error("Motivo é obrigatório.");

    return { id, qty, reason, location };
  }

  /* ============================================================
   * OPERAÇÃO: RETIRADA (Preservado com Services)
   * ========================================================== */
  function handleWithdrawal(payload) {
    try {
      const { id, qty, reason, location } = validateWithdrawalPayload(payload);
      const usuario = getUser();

      // Chamada obrigatória aos seus Services existentes
      const result = RRTStockService.recordOut(
        id,
        qty,
        reason,
        location,
        { usuario }
      );

      // Registro de telemetria original
      DatabaseService.telemetry.add({
        evento: "withdrawal",
        rolo_id: id,
        qty,
        motivo: reason,
        usuario,
        timestamp: now()
      });

      return {
        status: "SUCESSO",
        message: "Retirada de " + qty + "m registrada com sucesso.",
        saldo_novo: result.saldo_novo
      };

    } catch (err) {
      Logger.log("handleWithdrawal error: " + err);
      return { status: "ERRO", message: err.message };
    }
  }

  /* ============================================================
   * OPERAÇÃO: ENTRADA (Preservado)
   * ========================================================== */
  function handleEntry(payload) {
    try {
      const id = String(payload.id_do_rolo || "").trim();
      const qty = Number(payload.qty || 0);
      const reason = String(payload.reason || "").trim();
      const location = String(payload.location || "ESTOQUE").trim();
      const usuario = getUser();

      if (!id) throw new Error("ID ausente.");
      if (!(qty > 0)) throw new Error("Quantidade inválida.");
      if (!reason) throw new Error("Motivo obrigatório.");

      const result = RRTStockService.recordIn(id, qty, reason, location, { usuario });

      DatabaseService.telemetry.add({
        evento: "entrada_estoque",
        rolo_id: id,
        qty,
        motivo: reason,
        usuario,
        timestamp: now()
      });

      return {
        status: "SUCESSO",
        message: "Entrada de " + qty + "m registrada.",
        saldo_novo: result.saldo_novo
      };

    } catch (err) {
      return { status: "ERRO", message: err.message };
    }
  }

  /* ============================================================
   * CONSULTAR ROLLOS POR FASE (Fallback - use App.getRollsByStatus_Web)
   * ========================================================== */
  function getRollsByStatus_Web(payload) {
    Logger.log('[ESTOQUE-CONTROLLER] getRollsByStatus_Web chamado');
    Logger.log('[ESTOQUE-CONTROLLER] ⚠️ Esta é a versão LEGACY do controller');
    Logger.log('[ESTOQUE-CONTROLLER] Use App.getRollsByStatus_Web() ao invés disso');
    Logger.log('[ESTOQUE-CONTROLLER] Payload: ' + JSON.stringify(payload));
    
    try {
      // Normalizar status para lowercase
      const statusRaw = payload?.status || '';
      const status = String(statusRaw).trim().toLowerCase();
      
      Logger.log('[ESTOQUE-CONTROLLER] Status normalizado: "' + status + '"');
      
      // Query diretamente sem MAP complicado
      const rolls = DatabaseService.databaseQuery({
        collection: "INSPECOES",
        where: [{ field: "FASE_ATUAL", op: "==", value: status }]
      });
      
      Logger.log('[ESTOQUE-CONTROLLER] Resultado: ' + (Array.isArray(rolls) ? rolls.length : 'não-array') + ' rolos');
      
      return Array.isArray(rolls) ? rolls : [];
    } catch (e) {
      Logger.log("[ESTOQUE-CONTROLLER] ❌ ERRO: " + e.message);
      return [];
    }
  }

  function getRollMovementHistory(payload) {
    try {
      return DatabaseService.databaseQuery({
        collection: "movimentacoes",
        where: [{ field: "rolo_id", op: "==", value: payload.id_do_rolo }]
      }) || [];
    } catch(e) { return []; }
  }

  /* EXPORTS DO MÓDULO */
  return {
    handleWithdrawal,
    handleEntry,
    getRollsByStatus_Web,
    getPhotosByRollId,
    getRollMovementHistory
  };
})();

/* ============================================================
 * WRAPPERS GLOBAIS (Apenas para suporte interno)
 * ========================================================== */
// NOTA: getRollsByStatus_Web é GLOBAL em App.js (single source of truth)
function handleWithdrawal(payload) { return EstoqueController.handleWithdrawal(payload); }
function handleEntry(payload) { return EstoqueController.handleEntry(payload); }
function getPhotosByRollId(id) { return EstoqueController.getPhotosByRollId(id); }
function getRollMovementHistory(p) { return EstoqueController.getRollMovementHistory(p); }