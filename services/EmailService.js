/*******************************************************************
 * RRT_EmailService_v6 — SERVIÇO PREMIUM DE E-MAILS (OTIMIZADO)
 * Compatível com:
 * ✔ MainApp v1
 * ✔ SupervisorController v2.1
 * ✔ DocumentService v4/v5 (com novo retorno de ID)
 * ✔ Firestore v2
 *******************************************************************/

/* ============================================================
    🧩 UTIL — QR CODE
   ============================================================ */
/**
 * Gera URL para QR Code de um link.
 * @param {string} url
 * @param {number} size
 * @returns {string} URL do QR Code
 */
function _qrCode(url, size) {
    if (!url) return "";
    size = size || 220;

    return (
        "https://api.qrserver.com/v1/create-qr-code/?" +
        "size=" + size + "x" + size +
        "&data=" + encodeURIComponent(url)
    );
}

/* ============================================================
    🎨 TEMPLATE UNIVERSAL — EMAIL PREMIUM
   ============================================================ */
/**
 * Template HTML premium para emails de notificação.
 */
function _emailTemplate({ title, subtitle, idRolo, status, color, body, qr }) {
    const logo = `https://drive.google.com/uc?id=${CONFIG.IDS.LOGO_FILE}`;

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;
                max-width:650px;margin:auto;
                border:1px solid #ddd;border-radius:12px;overflow:hidden;
                box-shadow:0 4px 10px rgba(0,0,0,0.1);">

        <div style="background:${color};padding:25px 20px;color:white;text-align:center;">
            <img src="${logo}" style="height:60px;margin-bottom:8px">
            <h2 style="margin:0;font-size:24px;">${title}</h2>
            <p style="margin-top:6px;font-size:14px;opacity:.85;">${subtitle}</p>
        </div>

        <div style="padding:16px;text-align:center;">
            <span style="
                padding:8px 20px;background:${color};
                border-radius:25px;color:white;
                font-weight:bold;text-transform:uppercase;
                font-size:13px;letter-spacing:1px;">
                ${status}
            </span>
        </div>

        <div style="display:flex;justify-content:space-between;
                    padding:20px;align-items:center;flex-wrap:wrap;">
            <div style="font-size:15px;color:#333;min-width:240px;">
                <p><b>ID do Rolo:</b> ${idRolo}</p>
                <p><b>Data:</b> ${Utilities.formatDate(
                    new Date(),
                    Session.getScriptTimeZone(),
                    "dd/MM/yyyy HH:mm"
                )}</p>
            </div>

            ${
              qr
                ? `<div style="text-align:center;">
                    <img src="${qr}" style="width:130px;height:130px;border:1px solid #ddd;border-radius:8px;">
                   </div>`
                : ""
            }
        </div>

        <div style="padding:22px;color:#333;font-size:15px;line-height:1.55;">
            ${body}
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:0">

        <div style="padding:15px;text-align:center;font-size:12px;color:#666;">
            Sistema Digital de Revisão — FA Maringá<br>
            <b>FA Maringá</b><br>
            <span style="color:#aaa;">Mensagem automática — não responder</span>
        </div>
    </div>`;
}

/* ============================================================
   🔺 1️⃣ EMAIL → SUPERVISOR (APÓS REVISOR)
   ============================================================ */
function sendRevisaoConcluidaEmail(mainData, pdfBlob) {
    const fn = "sendRevisaoConcluidaEmail_v7";

    try {
        const id = mainData.id_do_rolo;
        const to = CONFIG.EMAIL.SUPERVISOR;
        if (!to) throw new Error("Email do Supervisor não configurado.");

        // Links corretos usando MainApp.buildSupervisorApprovalLink
        const linkA = buildSupervisorApprovalLink(id, "APROVADO", 60); // Aprovar
        const linkR = buildSupervisorApprovalLink(id, "REPROVADO", 60); // Reprovar

        // Defeitos
        const defects = mainData.defects || [];
        let defeitosHtml = `<table style="width:100%; border-collapse: collapse; margin-top: 15px; font-size:14px;">
                <tr>
                    <th style="border:1px solid #ddd; padding:8px; background:#f8f8f8;">Tipo</th>
                    <th style="border:1px solid #ddd; padding:8px; background:#f8f8f8;">Metragem</th>
                    <th style="border:1px solid #ddd; padding:8px; background:#f8f8f8;">Gravidade</th>
                </tr>`;
        if (!defects.length) {
            defeitosHtml += '<tr><td colspan="3" style="border:1px solid #ddd; padding:8px;">Sem defeitos reprovativos.</td></tr>';
        } else {
            defects.slice(0,5).forEach(d => {
                const gravidadeStyle = d.gravidade === "CRÍTICA" ? "color:#dc3545;font-weight:bold;" : "";
                defeitosHtml += `<tr>
                    <td style="border:1px solid #ddd; padding:8px;">${d.tipo}</td>
                    <td style="border:1px solid #ddd; padding:8px;">${d.metro_inicial || d.metroInicial}m - ${d.metro_final || d.metroFinal}m</td>
                    <td style="border:1px solid #ddd; padding:8px; ${gravidadeStyle}">${d.gravidade || "N/A"}</td>
                </tr>`;
            });
            if (defects.length > 5) {
                defeitosHtml += '<tr><td colspan="3" style="border:1px solid #ddd; padding:8px; text-align:center; color:#666;">Mais defeitos listados no Relatório Técnico.</td></tr>';
            }
        }
        defeitosHtml += "</table>";

        const body = `
            <p>Um novo rolo foi revisado e está <b>aguardando decisão do supervisor</b>.</p>
            <h3>Resumo de Defeitos</h3>
            ${defeitosHtml}
            <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">
            <div style="text-align:center;">
                <a href="${linkA}" style="background:#28a745;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:15px;">
                    ✔ APROVAR
                </a>
                <a href="${linkR}" style="background:#dc3545;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
                    ❌ REPROVAR
                </a>
            </div>
        `;

        const html = _emailTemplate({
            title: "NOVO ROLO REVISADO",
            subtitle: "Supervisor deve tomar uma decisão",
            idRolo: id,
            status: "AGUARDANDO SUPERVISOR",
            color: "#ff9800",
            body,
            qr: _qrCode(linkA)
        });

        const attachments = pdfBlob ? [pdfBlob.setName(`RRT_Relatorio_${id}.pdf`)] : [];

        MailApp.sendEmail({
            to,
            subject: `🔴 AÇÃO NECESSÁRIA: RRT ${id} aguardando decisão do supervisor`,
            htmlBody: html,
            attachments,
            name: CONFIG.EMAIL.SENDER_NAME
        });

        LogApp.log(`[${fn}] Email enviado ao supervisor.`, LogApp.LEVELS.INFO);
        return true;

    } catch (err) {
        LogApp.log(`[${fn}] ERRO: ${err.stack}`, LogApp.LEVELS.ERROR);
        return false;
    }
}

/* ============================================================
   🔺 2️⃣ EMAIL → SUPERVISOR APROVOU
   ============================================================ */
function sendSupervisorApprovalEmail(updated) {
    const fn = "sendSupervisorApprovalEmail_v7";

    try {
        const id = updated.id_do_rolo;
        const to = CONFIG.EMAIL.SUPERVISOR;
        if (!to) throw new Error("Email do Supervisor não configurado.");

        const defects = updated.defeitos || [];
        let defeitosHtml = "<ul>";
        if (!defects.length) defeitosHtml += "<li>Sem defeitos registrados.</li>";
        else defects.forEach(d => {
            defeitosHtml += `<li><b>${d.tipo}</b> — ${d.metro_inicial || d.metroInicial}m → ${d.metro_final || d.metroFinal}m</li>`;
        });
        defeitosHtml += "</ul>";

        const body = `
            <p>O rolo <b>${id}</b> foi <span style="color:#28a745;"><b>APROVADO</b></span> pelo supervisor.</p>
            <h3>Defeitos Registrados</h3>
            ${defeitosHtml}
        `;

        const html = _emailTemplate({
            title: "ROLO APROVADO",
            subtitle: "Supervisor aprovou o rolo",
            idRolo: id,
            status: "APROVADO",
            color: "#28a745",
            body,
            qr: ""
        });

        MailApp.sendEmail({
            to,
            subject: `RRT — Rolo ${id} APROVADO`,
            htmlBody: html,
            name: CONFIG.EMAIL.SENDER_NAME
        });

        LogApp.log(`[${fn}] Email enviado (Aprovado).`, LogApp.LEVELS.INFO);
        return true;

    } catch (err) {
        LogApp.log(`[${fn}] ERRO: ${err}`, LogApp.LEVELS.ERROR);
        return false;
    }
}

/* ============================================================
   🔺 3️⃣ EMAIL → COMPRAS (GARANTIA)
   ============================================================ */
function sendComprasEmail(mainData, defects, docs) {
    const fn = "sendComprasEmail_v7";

    try {
        const textValue = (value, fallback = "Não informado") => {
            const text = String(value == null ? "" : value).trim();
            return text || fallback;
        };
        const to = CONFIG.EMAIL.COMPRAS;
        // ✅ CORRIGIDO: Usa revision_id优先, depois id_do_rolo
        const id = textValue(mainData.id_do_rolo || mainData.ID_ROLO || mainData.roll_id || mainData.produto_id || mainData.PRODUTO_ID, "Não informado");
        if (!to) throw new Error("Email de Compras não configurado.");

        LogApp.log(`[${fn}] Enviando email para Compras: ${to} (rolo ${id}).`, LogApp.LEVELS.INFO);

        let relatorioFile = null, relUrl = "";
        if (docs?.relatorioFileId) {
            try {
                relatorioFile = DriveApp.getFileById(docs.relatorioFileId);
                relUrl = relatorioFile.getUrl();
            } catch (e) { LogApp.log(`[${fn}] Falha ao buscar PDF: ${e.message}`, LogApp.LEVELS.WARN); }
        }
        if (!relUrl && docs?.pdfUrl) relUrl = String(docs.pdfUrl);

                // ✅ GARANTIA_APP fallback: usa SUPERVISOR_APP se não configurada (intencional)
                const garantiaBase =
                    CONFIG?.URL?.GARANTIA_APP ||
                    CONFIG?.URL?.SUPERVISOR_APP ||
                    ScriptApp.getService().getUrl();
                const linkAcompanhamento = `${garantiaBase}?page=compras&id=${encodeURIComponent(id)}`;
                const fornecedorEmail = textValue(mainData.fornecedor || mainData.FORNECEDOR || mainData.fornecedor_nome);
                const nfEmail = textValue(mainData.nf || mainData.NF || mainData.nota_fiscal);
                const produtoEmail = textValue(mainData.produto_id || mainData.PRODUTO_ID || mainData.product_id);
                const metrosEmail = textValue(mainData.metros_revisado || mainData.METROS_REVISADO || mainData.metros_fornecedor || mainData.METROS_FORNECEDOR);
                const pontosEmail = textValue(mainData.pontos || mainData.PONTOS || mainData.pontos_totais, "0");

        let defeitosHtml = "<ul>";
        if (!defects?.length) defeitosHtml += "<li>Nenhum defeito registrado.</li>";
        else defects.forEach(d => {
            // ✅ FORMATAÇÃO EM PORTUGUÊS
            const tipoFormatado = formatDefeitoTipoEmail(d.tipo || d.tipo_defeito || d.nome_defeito || 'Desconhecido');
            const metrosInicio = d.metro_inicial || d.metroInicial || d.metragem_inicial || 'N/A';
            const metrosFim = d.metro_final || d.metroFinal || d.metragem_final || 'N/A';
            const gravidade = d.gravidade || d.severidade || 'N/A';
            
            defeitosHtml += `<li><b>${tipoFormatado}</b> — ${metrosInicio}m → ${metrosFim}m (${gravidade})</li>`;
        });
        defeitosHtml += "</ul>";

        // ✅ FUNÇÃO AUXILIAR PARA FORMATAR DEFEITOS EM PORTUGUÊS
        function formatDefeitoTipoEmail(tipoRaw) {
            const raw = String(tipoRaw || '').trim().toLowerCase();
            const map = {
                'appearance_shade': 'Variação de cor',
                'appearance shade': 'Variação de cor',
                'physical_damage': 'Dano físico',
                'physical damage': 'Dano físico',
                'hole': 'Furo',
                'furo': 'Furo',
                'stain': 'Mancha',
                'mancha': 'Mancha',
                'dirty_stain': 'Mancha de sujeira',
                'dirty stain': 'Mancha de sujeira',
                'crease': 'Vinco',
                'vinco': 'Vinco',
                'thickness': 'Espessura',
                'snag': 'Enroscado',
                'enroscado': 'Enroscado',
                'print_pattern': 'Defeito na estampa',
                'print pattern': 'Defeito na estampa',
                'estampa': 'Defeito na estampa',
                'bolha': 'Bolha',
                'fio_puxado': 'Fio puxado',
                'rasgo': 'Rasgo',
                'desfiado': 'Desfiado',
                'ponto_solt': 'Ponto solto',
                'tingimento': 'Defeito de tingimento',
                'textura': 'Defeito de textura',
                'deformacao': 'Deformação',
                'marcacao': 'Marcação',
                'queimado': 'Queimado',
                'leve': 'Leve',
                'medio': 'Médio',
                'grave': 'Grave',
                'critico': 'Crítico'
            };
            if (!raw) return 'Desconhecido';
            if (map[raw]) return map[raw];
            return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }

        const attachments = relatorioFile
            ? [relatorioFile.getBlob()]
            : (docs?.pdfBlob ? [docs.pdfBlob] : []);

        const body = `
            <p>O rolo <b>${id}</b> foi <b style="color:#dc3545;">REPROVADO</b> pelo Supervisor. Solicitação de GARANTIA/DEVOLUÇÃO necessária.</p>
            
            <h3>📋 Dados do Tecido</h3>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
                <tr style="background: #f8f9fa;">
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">ID Original:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Fornecedor:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${fornecedorEmail}</td>
                </tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">NF:</td><td style="padding: 8px; border: 1px solid #ddd;">${nfEmail}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Produto:</td><td style="padding: 8px; border: 1px solid #ddd;">${produtoEmail}</td></tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tipo:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${textValue(mainData.tipo_tecido || mainData.TIPO_TECIDO)}</td>
                </tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Metragem:</td><td style="padding: 8px; border: 1px solid #ddd;">${metrosEmail} m</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pontuação:</td><td style="padding: 8px; border: 1px solid #ddd;">${pontosEmail}</td></tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cor:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${textValue(mainData.cor || mainData.COR)}</td>
                </tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Lote:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${textValue(mainData.lote || mainData.LOTE)}</td>
                </tr>
            </table>
            
            <h3>🔍 Defeitos Identificados</h3>
            ${defeitosHtml}
            
            ${mainData.observacoes ? `
            <h3>📝 Observações do Supervisor</h3>
            <div style="background: #fff3cd; border-left: 4px solid #ff9500; padding: 12px; margin-bottom: 20px;">
                ${mainData.observacoes}
            </div>
            ` : ''}
            
            <div style="text-align:center; margin-top:25px;">
                <a href="${linkAcompanhamento}" style="background:#3498db;color:white;padding:14px 25px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">
                    📊 Acompanhar Status da Garantia
                </a>
            </div>
            
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
                📄 <b>${attachments.length ? 'PDF completo anexado' : 'PDF não anexado'}</b> para análise detalhada.
            </p>
        `;

        const html = _emailTemplate({
            title: "ROLO REPROVADO - AÇÃO GARANTIA",
            subtitle: "Notificação para Solicitação de Devolução/Garantia",
            idRolo: id,
            status: "AGUARDANDO GARANTIA",
            color: "#3498db",
            body,
            qr: relUrl ? _qrCode(relUrl) : _qrCode(linkAcompanhamento)
        });

        MailApp.sendEmail({
            to,
            subject: `🚨 GARANTIA: Rolo Reprovado (${id}) exige abertura de processo`,
            htmlBody: html,
            attachments
        });

        LogApp.log(`[${fn}] Email enviado para Compras (Garantia).`, LogApp.LEVELS.INFO);
        return true;

    } catch (err) {
        LogApp.log(`[${fn}] ERRO: ${err}`, LogApp.LEVELS.ERROR);
        return false;
    }
}

function sendProactiveInternalDigestEmail(payload) {
    const fn = "sendProactiveInternalDigestEmail_v1";

    try {
        const notifications = Array.isArray(payload?.notifications) ? payload.notifications : [];
        if (!notifications.length) {
            return { status: "SUCESSO", message: "Sem notificações para envio." };
        }

        const recipients = Array.from(new Set([
            CONFIG?.EMAIL?.ADMIN,
            CONFIG?.EMAIL?.SUPERVISOR,
            CONFIG?.EMAIL?.COMPRAS
        ].filter(Boolean)));

        if (!recipients.length) {
            throw new Error("Nenhum destinatário interno configurado para digest proativo.");
        }

        const rows = notifications.map((item, index) => {
            const ordem = index + 1;
            const sev = String(item?.severidade || "media").toUpperCase();
            const title = String(item?.titulo || "Alerta sem título");
            const desc = String(item?.descricao || "Sem descrição.");
            const action = String(item?.acaoRecomendada || "Sem ação recomendada.");
            const itemId = item?.id ? String(item.id) : "";

            return `
                <tr>
                    <td style="padding:8px;border:1px solid #ddd;">${ordem}</td>
                    <td style="padding:8px;border:1px solid #ddd;"><b>${sev}</b></td>
                    <td style="padding:8px;border:1px solid #ddd;">${title}${itemId ? `<br><small>ID: ${itemId}</small>` : ""}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${desc}</td>
                    <td style="padding:8px;border:1px solid #ddd;">${action}</td>
                </tr>
            `;
        }).join("");

        const subject = `🚨 RRT | Digest Proativo (${notifications.length})`;
        const htmlBody = `
            <div style="font-family:Arial,sans-serif;color:#1f2937;">
                <h3 style="margin:0 0 12px 0;">Notificações Proativas de Estoque</h3>
                <p style="margin:0 0 10px 0;">Origem: <b>${String(payload?.origin || "dashboard_estoque")}</b></p>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:8px;border:1px solid #ddd;">#</th>
                            <th style="padding:8px;border:1px solid #ddd;">Severidade</th>
                            <th style="padding:8px;border:1px solid #ddd;">Título</th>
                            <th style="padding:8px;border:1px solid #ddd;">Descrição</th>
                            <th style="padding:8px;border:1px solid #ddd;">Ação Recomendada</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p style="margin-top:12px;font-size:12px;color:#6b7280;">Envio automático para acompanhamento interno.</p>
            </div>
        `;

        MailApp.sendEmail({
            to: recipients.join(","),
            subject,
            htmlBody,
            name: CONFIG?.EMAIL?.SENDER_NAME || "Sistema RRT"
        });

        LogApp.log(`[${fn}] Digest proativo enviado para ${recipients.join(",")}.`, LogApp.LEVELS.INFO);
        return {
            status: "SUCESSO",
            message: "Digest proativo enviado com sucesso.",
            recipients,
            total: notifications.length
        };
    } catch (error) {
        LogApp.log(`[${fn}] ERRO: ${error}`, LogApp.LEVELS.ERROR);
        return {
            status: "ERRO",
            message: error.message
        };
    }
}

/* ============================================================
    EXPORTAÇÃO GLOBAL
   ============================================================ */
var sendRevisaoConcluidaEmail = sendRevisaoConcluidaEmail;
var sendSupervisorApprovalEmail = sendSupervisorApprovalEmail;
var sendComprasEmail = sendComprasEmail;
var sendProactiveInternalDigestEmail = sendProactiveInternalDigestEmail;
