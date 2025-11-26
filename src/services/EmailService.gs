/*******************************************************************
 * RRT_EmailService.gs — Notificação Supervisor (v2.0 Revisada)
 * - Logs detalhados
 * - HTML seguro e consistente
 * - Tratamento robusto de defeitos e anexos
 *******************************************************************/

function sendCompletionEmail(mainData, defects, docsResult, linkA, linkR) {
  const fn = "sendCompletionEmail";
  const idRolo = mainData?.["ID do Rolo"] || "SEM-ID";
  const ts = mainData?.["Carimbo de data/hora"] || "";
  const supervisorNome =
    (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.SUPERVISOR_NOME) ||
    CONFIG.SUPERVISOR_NOME ||
    "Supervisor";
  const destinatario =
    (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.SUPERVISOR) ||
    CONFIG.EMAIL_SUPERVISOR;
  const senderName =
    (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.SENDER_NAME) ||
    CONFIG.SENDER_NAME ||
    "Sistema RRT";
  const errorEmail =
    (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.ERROS) ||
    CONFIG.EMAIL_ERROS ||
    "";

  LogApp.log(`[${fn}] Iniciando envio de e-mail (ID=${idRolo})`, LogApp.LEVELS.INFO);

  try {
    //---------------------------------------
    // 1. NORMALIZAR LISTA DE DEFEITOS
    //---------------------------------------
    let resumoHtml = "<p><i>Sem defeitos detalhados.</i></p>";

    if (Array.isArray(defects) && defects.length > 0) {
      resumoHtml = "<ul>";
      defects.forEach((d, i) => {
        try {
          const tipo = d.tipo || d.nome || "(sem tipo)";
          const ini = d.metroIni || d.metroInicial || d.mi || "-";
          const fim = d.metroFim || d.metroFinal || d.mf || "-";
          resumoHtml += `<li><b>${tipo}</b> — ${ini} → ${fim}</li>`;
        } catch (innerErr) {
          LogApp.log(
            `[${fn}] Erro ao montar defeito #${i}: ${innerErr}`,
            LogApp.LEVELS.WARN
          );
        }
      });
      resumoHtml += "</ul>";
    }

    //---------------------------------------
    // 2. DADOS DOS ARQUIVOS PDF
    //---------------------------------------
    const relFile = docsResult?.relatorioFile || null;
    const anexFile = docsResult?.anexoFotosFile || null;

    const relUrl = relFile ? relFile.getUrl() : "";
    const anexUrl = anexFile ? anexFile.getUrl() : "";

    LogApp.log(
      `[${fn}] URLs — relatorio=${relUrl || "N/A"}, anexo=${anexUrl || "N/A"}`,
      LogApp.LEVELS.DEBUG
    );

    //---------------------------------------
    // 3. MONTAGEM DO HTML
    //---------------------------------------
    const html = `
      <p>Olá ${supervisorNome},</p>

      <p>Um rolo foi marcado como <b>${mainData["Status do Rolo (Revisor)"] || "EM ANÁLISE"}</b> e aguarda sua decisão.</p>

      <p>
        <b>ID:</b> ${idRolo}<br>
        <b>Peça:</b> ${mainData["numero_peca"] || mainData["Nº da Peça"] || "N/A"}<br>
        <b>Data/Hora:</b> ${ts}
      </p>

      <p><b>Detalhes dos Defeitos:</b></p>
      ${resumoHtml}

      <hr>
      <p><b>Ação:</b></p>
      <p>
        <a href="${linkA}" style="display:inline-block;background:#28a745;padding:10px 16px;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">✔️ APROVAR</a>
        &nbsp;&nbsp;
        <a href="${linkR}" style="display:inline-block;background:#dc3545;padding:10px 16px;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">❌ REPROVAR</a>
      </p>

      <p>
        Documentos (Drive): 
        ${relUrl ? `<a href="${relUrl}">Relatório</a>` : "—"} 
        ${anexUrl ? ` | <a href="${anexUrl}">Anexo de Fotos</a>` : ""}
      </p>

      <hr>
      <p style="font-size:0.8em;color:#666;">Sistema Digital de Revisão – 3W Lamfer</p>
    `;

    //---------------------------------------
    // 4. ANEXOS
    //---------------------------------------
    const atts = [];
    try {
      if (relFile) atts.push(relFile.getBlob());
      if (anexFile) atts.push(anexFile.getBlob());
    } catch (attErr) {
      LogApp.log(
        `[${fn}] ERRO ao preparar anexos: ${attErr}`,
        LogApp.LEVELS.ERROR
      );
    }

    //---------------------------------------
    // 5. ENVIO DO E-MAIL
    //---------------------------------------
    if (!destinatario) {
      throw new Error("Destinatário do supervisor não configurado (CONFIG.EMAIL.SUPERVISOR).");
    }

    MailApp.sendEmail({
      to: destinatario,
      subject: `ROLO EM ANÁLISE – Ação Necessária (${idRolo})`,
      htmlBody: html,
      attachments: atts,
      name: senderName
    });

    LogApp.log(
      `[${fn}] E-mail enviado com sucesso para ${destinatario} (ID=${idRolo})`,
      LogApp.LEVELS.INFO
    );

  } catch (err) {

    //---------------------------------------
    // 6. TRATAMENTO DE ERRO
    //---------------------------------------
    LogApp.log(`[${fn}] ERRO CRÍTICO: ${err}`, LogApp.LEVELS.ERROR);

    // Notificar caixa de erros, se configurada
    if (errorEmail) {
      try {
        MailApp.sendEmail(
          errorEmail,
          `Erro envio e-mail supervisor (${idRolo})`,
          String(err)
        );
      } catch (err2) {
        LogApp.log(
          `[${fn}] Falha ao enviar e-mail de erro: ${err2}`,
          LogApp.LEVELS.CRITICAL
        );
      }
    }
  }
}
