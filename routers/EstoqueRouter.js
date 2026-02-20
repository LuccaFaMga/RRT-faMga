/************************************************************
 * ESTOQUE ROUTER — API CENTRAL
 ************************************************************/
function api(request) {
  try {
    if (!request || !request.action) {
      throw new Error("Ação não informada.");
    }

    switch (request.action) {
      case "withdrawal":
        return EstoqueController.handleWithdrawal(request.payload);

      case "getRollsByStatus":
        return EstoqueController.getRollsByStatus_Web(request.payload);

      case "getPhotos":
        return EstoqueController.getPhotosByRollId(request.payload.id);

      case "getHistory":
        return EstoqueController.getRollMovementHistory(request.payload);

      default:
        throw new Error("Ação inválida: " + request.action);
    }
  } catch (e) {
    return { status: "ERRO", message: e.message };
  }
}

/************************************************************
 * ESTOQUE CONTROLLER
 ************************************************************/
var EstoqueController = (function () {
  "use strict";

  /* ================= UTIL ================= */
  function now() {
    return new Date().toISOString();
  }

  function getUser() {
    try {
      return Session.getActiveUser().getEmail() || "sistema";
    } catch (e) {
      return "sistema";
    }
  }

  /* ================= DRIVE (OTIMIZADO) ================= */
  function getPhotosByRollId(rollId) {
    try {
      const folderId = PropertiesService
        .getScriptProperties()
        .getProperty("DRIVE_REVISAO_FOLDER_ID");

      if (!folderId) return [];

      const parentFolder = DriveApp.getFolderById(folderId);
      const rollFolders = parentFolder.getFoldersByName(String(rollId));
      if (!rollFolders.hasNext()) return [];

      const rollFolder = rollFolders.next();
      const photoFolders = rollFolder.getFoldersByName("FOTOS");
      if (!photoFolders.hasNext()) return [];

      const files = photoFolders.next().getFiles();
      const photos = [];

      while (files.hasNext()) {
        const f = files.next();
        if (f.getMimeType().startsWith("image/")) {
          photos.push({
            url: "https://drive.google.com/thumbnail?id=" + f.getId() + "&sz=w800",
            name: f.getName()
          });
        }
      }
      return photos;
    } catch (e) {
      Logger.log("Erro Drive: " + e);
      return [];
    }
  }

  /* ================= VALIDATION ================= */
  function validateWithdrawalPayload(payload) {
    if (!payload) throw new Error("Payload ausente.");

    const id = String(payload.id_do_rolo || "").trim();
    const qty = Number(payload.qty);
    const reason = String(payload.reason || "").trim();
    const location = String(payload.location || "PRODUCAO").trim();

    if (!id) throw new Error("ID do rolo ausente.");
    if (!(qty > 0)) throw new Error("Quantidade inválida.");
    if (!reason) throw new Error("Motivo obrigatório.");

    return { id, qty, reason, location };
  }

  /* ================= OPERATIONS ================= */
  function handleWithdrawal(payload) {
    try {
      const { id, qty, reason, location } = validateWithdrawalPayload(payload);
      const usuario = getUser();

      // 🔐 Validação de saldo no backend
      const rolo = DatabaseService.databaseQuery({
        collection: "INSPECOES",
        where: [{ field: "ID_ROLO", op: "==", value: id }]
      })[0];

      if (!rolo) throw new Error("Rolo não encontrado.");
      if (qty > Number(rolo.saldo_atual)) {
        throw new Error("Quantidade maior que o saldo disponível.");
      }

      // 🔧 Service original (INALTERADO)
      const result = RRTStockService.recordOut(
        id,
        qty,
        reason,
        location,
        { usuario }
      );

      // 📊 Telemetria
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
        message: `Retirada de ${qty}m registrada.`,
        saldo_novo: result.saldo_novo
      };

    } catch (e) {
      Logger.log("Withdrawal ERRO: " + e);
      return { status: "ERRO", message: e.message };
    }
  }

  function getRollMovementHistory(payload) {
    try {
      return DatabaseService.databaseQuery({
        collection: "movimentacoes",
        where: [{ field: "rolo_id", op: "==", value: payload.id_do_rolo }]
      }) || [];
    } catch {
      return [];
    }
  }

  /* ================= EXPORT ================= */
  return {
    handleWithdrawal,
    getPhotosByRollId,
    getRollMovementHistory
  };
})();

/************************************************************
 * WRAPPERS GLOBAIS (COMPATIBILIDADE COM HTML)
 * 
 * NOTA: getRollsByStatus_Web é GLOBAL em App.js
 *       Este é o único ponto de entrada para a função
 ************************************************************/
function handleWithdrawal(payload) {
  return EstoqueController.handleWithdrawal(payload);
}
function getPhotosByRollId(id) {
  return EstoqueController.getPhotosByRollId(id);
}
function getRollMovementHistory(p) {
  return EstoqueController.getRollMovementHistory(p);
}
