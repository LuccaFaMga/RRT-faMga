/************************************************************
 * ESTOQUE ROUTER — API CENTRAL
 * 
 * NOTA: Este arquivo apenas roteia requisições para o
 * EstoqueController em controllers/EstoqueController.js
 * A lógica de negócio está centralizada no controller.
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
 * WRAPPERS GLOBAIS (COMPATIBILIDADE COM HTML)
 * 
 * NOTA: getRollsByStatus_Web é GLOBAL em App.js
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
