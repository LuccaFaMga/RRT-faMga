/*******************************************************************
 * RRT_FormatarDefeitos.js — Wrappers compatíveis com novo padrão
 * Os formatadores oficiais vivem em RRT_Formatters.js (funções com
 * “f” minúsculo). Aqui expomos aliases com “F” maiúsculo para que
 * o restante do código possa chamá-los sem warnings.
 *******************************************************************/

/**
 * Retorna string pronta para o relatório principal.
 * Aproveita o objeto completo retornado por RRT_formatarDefeitos.
 */
function RRT_FormatarDefeitos(defects) {
  try {
    if (typeof RRT_formatarDefeitos === "function") {
      const result = RRT_formatarDefeitos(defects);
      if (result && typeof result === "object") {
        return result.text || "Nenhum defeito registrado.";
      }
      return result || "Nenhum defeito registrado.";
    }

    Logger.log("RRT_FormatarDefeitos: função base não encontrada.");
    return "Formatador de defeitos indisponível.";

  } catch (err) {
    Logger.log("❌ ERRO em RRT_FormatarDefeitos: " + err);
    return "Erro ao formatar defeitos.";
  }
}

/**
 * Mantém compatibilidade de chamadas que esperam RRT_FormatarFotos.
 * O resultado segue o array estruturado do módulo oficial.
 */
function RRT_FormatarFotos(defects, photoIds) {
  try {
    if (typeof RRT_formatarFotos === "function") {
      const result = RRT_formatarFotos(defects, photoIds);
      return Array.isArray(result) ? result : [];
    }

    Logger.log("RRT_FormatarFotos: função base não encontrada.");
    return [];

  } catch (err) {
    Logger.log("❌ ERRO em RRT_FormatarFotos: " + err);
    return [];
  }
}
