/*******************************************************************
 * RRT_EmailService_Compras.gs — Envio para Compras (v2.0 LOG HARDCORE)
 *******************************************************************/

function sendComprasEmail(mainData, defects, docsResult) {
  LogApp.log("▶️ [sendComprasEmail] Início da função", LogApp.LEVELS.INFO);

  try {
      //-----------------------------------------------------------
      // Validações iniciais
      //-----------------------------------------------------------
      if (!mainData) {
          LogApp.log("❌ [sendComprasEmail] mainData está NULL!", LogApp.LEVELS.ERROR);
          return;
      }

      const emailCompras = CONFIG.EMAIL_COMPRAS;
      const id = mainData["ID do Rolo"];

      LogApp.log(
        `ℹ️ [sendComprasEmail] Preparando email para compras=${emailCompras}, ID=${id}`,
        LogApp.LEVELS.INFO
      );

      //-----------------------------------------------------------
      // Lista de Defeitos
      //-----------------------------------------------------------
      LogApp.log("📌 [sendComprasEmail] Montando lista de defeitos", LogApp.LEVELS.DEBUG);

      let defeitosHtml = "<ul>";

      if (!defects || defects.length === 0) {
          defeitosHtml += "<li>Sem defeitos registrados.</li>";
          LogApp.log("ℹ️ [sendComprasEmail] Nenhum defeito registrado", LogApp.LEVELS.INFO);
      } else {
          defects.forEach((d, i) => {
              LogApp.log(`   ✔️ Defeito #${i+1}: ${JSON.stringify(d)}`, LogApp.LEVELS.DEBUG);
              const tipo = d.tipo || d.nome || "(sem tipo)";
              const mi = d.mi || d.metroInicial || "-";
              const mf = d.mf || d.metroFinal || "-";
              defeitosHtml += `<li><b>${tipo}</b> – ${mi} → ${mf}</li>`;
          });
      }

      defeitosHtml += "</ul>";

      //-----------------------------------------------------------
      // Proteção contra arquivos nulos (Drive pode falhar)
      //-----------------------------------------------------------
      LogApp.log("📄 [sendComprasEmail] Validando arquivos (relatório e anexo)", LogApp.LEVELS.DEBUG);

      const relUrl = docsResult?.relatorioFile ? docsResult.relatorioFile.getUrl() : "";
      const anexUrl = docsResult?.anexoFotosFile ? docsResult.anexoFotosFile.getUrl() : "";

      LogApp.log(`   Relatório URL = ${relUrl}`, LogApp.LEVELS.DEBUG);
      LogApp.log(`   Anexo URL     = ${anexUrl}`, LogApp.LEVELS.DEBUG);

      //-----------------------------------------------------------
      // HTML do e-mail
      //-----------------------------------------------------------
      LogApp.log("🧱 [sendComprasEmail] Construindo HTML do email", LogApp.LEVELS.DEBUG);

      const html = `
          <p><b>ROLO REPROVADO PELO SUPERVISOR</b></p>

          <p><b>ID:</b> ${id}</p>
          <p><b>Fornecedor:</b> ${mainData["Fornecedor"] || "-"}</p>
          <p><b>Nota Fiscal:</b> ${mainData["Nº da Nota Fiscal"] || "-"}</p>
          <p><b>Peça / Lote:</b> ${mainData["Nº da Peça"] || "-"} / ${mainData["Lote"] || "-"}</p>
          <p><b>Cor / Referência:</b> ${mainData["Cor"] || "-"} / ${mainData["Referência"] || "-"}</p>

          <p><b>Defeitos:</b></p>
          ${defeitosHtml}

          <p><b>Documentos:</b></p>
          ${relUrl ? `<p>Relatório: <a href="${relUrl}">Abrir</a></p>` : "<p>Relatório não gerado.</p>"}
          ${anexUrl ? `<p>Anexo de Fotos: <a href="${anexUrl}">Abrir</a></p>` : "<p>Anexo não gerado.</p>"}

          <hr>
          <p>Sistema Digital 3W Lamfer</p>
      `;

      //-----------------------------------------------------------
      // Monta anexos somente se existirem
      //-----------------------------------------------------------
      LogApp.log("📎 [sendComprasEmail] Processando anexos", LogApp.LEVELS.DEBUG);

      const attachments = [];
      if (docsResult?.relatorioFile) {
          attachments.push(docsResult.relatorioFile.getBlob());
          LogApp.log("   ✔️ Anexando relatório", LogApp.LEVELS.DEBUG);
      }
      if (docsResult?.anexoFotosFile) {
          attachments.push(docsResult.anexoFotosFile.getBlob());
          LogApp.log("   ✔️ Anexando anexo de fotos", LogApp.LEVELS.DEBUG);
      }

      //-----------------------------------------------------------
      // Envio do Email
      //-----------------------------------------------------------
      LogApp.log("📤 [sendComprasEmail] Enviando email…", LogApp.LEVELS.INFO);

      MailApp.sendEmail({
          to: emailCompras,
          subject: `AÇÃO – Rolo reprovado (${id})`,
          htmlBody: html,
          attachments: attachments
      });

      LogApp.log(
          `✅ [sendComprasEmail] Email enviado para compras (${emailCompras}) — ID=${id}`,
          LogApp.LEVELS.INFO
      );

  } catch (e) {
      LogApp.log(`🔥 [sendComprasEmail] ERRO CRÍTICO: ${e.message}`, LogApp.LEVELS.CRITICAL);
  }

  LogApp.log("🏁 [sendComprasEmail] Fim da função", LogApp.LEVELS.INFO);
}
