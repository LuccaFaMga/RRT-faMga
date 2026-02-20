/*******************************************************************
 * RRT_Formatters.gs — formata defeitos e fotos para relatórios (v2.2)
 * - Compatível com todos os modelos do sistema
 * - Logs detalhados
 *******************************************************************/

/**
 * RRT_formatarDefeitos(defects)
 * Retorna:
 * {
 *   text: 'texto para relatório',
 *   rows: [ { index, tipo, metroInicio, metroFim, observacoes, fotoRef } ]
 * }
 */
function RRT_formatarDefeitos(defects) {
  try {
    Logger.log("➡️ RRT_formatarDefeitos iniciado. Qtde defeitos: " + (defects?.length || 0));

    if (!Array.isArray(defects) || defects.length === 0) {
      Logger.log("ℹ️ Nenhum defeito recebido.");
      return { text: 'Nenhum defeito registrado.', rows: [] };
    }

    const lines = [];
    const rows = [];

    defects.forEach(function (d, i) {
      try {
        Logger.log(`🔍 Processando defeito ${i + 1}: ` + JSON.stringify(d));

        // Normalização multi-fonte
        const tipo =
          d.tipo ||
          d.nome ||
          d.tipo_defeito ||
          d.defeito ||
          "(sem tipo)";

        const inicio =
          d.metroInicial ||
          d.metroIni ||
          d.inicio ||
          d.mi ||
          "-";

        const fim =
          d.metroFinal ||
          d.metroFim ||
          d.fim ||
          d.mf ||
          "-";

        const obs =
          d.descricao ||
          d.desc ||
          d.obs ||
          d.observacoes ||
          "";

        const foto =
          d.fotoId ||
          d.savedPhotoId ||
          (d.fotoBase64 ? "(imagem embutida)" : "");

        // Texto para relatório
        const block = [
          `Defeito ${i + 1}: ${tipo}`,
          `  Metros: ${inicio} → ${fim}`,
          obs ? `  Observações: ${obs}` : "",
          foto ? `  Foto: ${foto}` : ""
        ]
          .filter(Boolean)
          .join("\n");

        lines.push(block);

        // Estrutura tabular
        rows.push({
          index: i + 1,
          tipo: tipo,
          metroInicio: inicio,
          metroFim: fim,
          observacoes: obs,
          fotoRef: foto
        });

      } catch (errItem) {
        Logger.log(`❌ Erro ao formatar defeito #${i + 1}: ${errItem}`);
      }
    });

    Logger.log("✅ RRT_formatarDefeitos finalizado com sucesso.");
    return { text: lines.join('\n\n'), rows: rows };

  } catch (err) {
    Logger.log("❌ ERRO FATAL em RRT_formatarDefeitos: " + err);
    return { text: "Erro ao formatar defeitos.", rows: [] };
  }
}



/*******************************************************************
 * RRT_formatarFotos(defects, photoIds)
 *
 * Retorna:
 * [ { fileId, caption } ]
 *
 * Estratégia:
 * - Primeiro adiciona fotos vinculadas a defeitos (na ordem dos defeitos)
 * - Depois adiciona fotos soltas (photoIds) com legendas padrão
 * - Evita duplicações
 *******************************************************************/
function RRT_formatarFotos(defects, photoIds) {
  try {
    Logger.log("➡️ RRT_formatarFotos iniciado.");

    const out = [];
    const used = new Set();

    // 1) Fotos vinculadas aos defeitos (respeita ordem)
    if (Array.isArray(defects)) {
      defects.forEach(function (d, idx) {
        try {
          const fid =
            d.savedPhotoId ||
            d.fotoId ||
            (d.fotoBase64 ? d.savedPhotoId : null);

          if (fid) {
            Logger.log(`🖼️ Foto vinculada ao defeito ${idx + 1}: ${fid}`);

            const tipo =
              d.tipo ||
              d.nome ||
              d.defeito ||
              "(sem tipo)";

            const inicio =
              d.metroInicial ||
              d.metroIni ||
              d.mi ||
              "-";

            const fim =
              d.metroFinal ||
              d.metroFim ||
              d.mf ||
              "-";

            const caption = `${tipo} — ${inicio} → ${fim}`;

            out.push({ fileId: fid, caption: caption });
            used.add(fid);
          }
        } catch (errDef) {
          Logger.log("❌ Erro ao processar foto do defeito: " + errDef);
        }
      });
    }

    // 2) Fotos soltas enviadas pelo usuário
    if (Array.isArray(photoIds)) {
      photoIds.forEach(function (pid) {
        if (!pid) return;
        if (used.has(pid)) return;

        Logger.log(`🖼️ Foto adicional detectada: ${pid}`);
        out.push({ fileId: pid, caption: "Foto adicional" });
        used.add(pid);
      });
    }

    Logger.log("✅ RRT_formatarFotos finalizado.");
    return out;

  } catch (err) {
    Logger.log("❌ ERRO FATAL em RRT_formatarFotos: " + err);
    return [];
  }
}
