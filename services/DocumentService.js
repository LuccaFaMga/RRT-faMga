/*******************************************************************
 * SISTEMA COMPLETO — RRT DOCUMENT SERVICE (FINAL)
 * CORREÇÃO: ADIÇÃO DE CAMADA ASSÍNCRONA para evitar gargalos (Jobs/Triggers).
 * ASSUMIDO: Objeto global 'CONFIG' carregado corretamente.
 *******************************************************************/
'use strict';
// ✅ CORREÇÃO MimeType: Necessário para a conversão de Docs para PDF
const MimeType = DocumentApp.MimeType; 
// Define o tamanho do bloco para o Mapa 2D
const BLOCK_SIZE_2D = 2;
/* ============================================================
 * 📁 DRIVE — PASTAS
 * ============================================================ */
function getOrCreateRollFolderSimple(rollId) {
  if (!rollId) throw new Error("ID do rolo inválido.");
  // 🛡️ Uso de Optional Chaining para evitar o erro 'CONFIG is undefined'
  const rootId = CONFIG?.IDS?.PASTA_RRT || CONFIG?.IDS?.OUTPUT_FOLDER;
  const root = rootId ? DriveApp.getFolderById(rootId) : DriveApp.getRootFolder();
  const it = root.getFoldersByName(String(rollId));
  return it.hasNext() ? it.next() : root.createFolder(String(rollId));
}

function getOrCreateRollFolder(id) {
  const roll = getOrCreateRollFolderSimple(id);
  return {
    roll,
    relatorio: ensureSubfolder(roll, "RELATORIO"),
    fotos: ensureSubfolder(roll, "FOTOS")
  };
}

function ensureSubfolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
/* ============================================================
 * ⚙️ ASYNC API — AGENDAMENTO
 * ============================================================ */
function generateAllDocsAsync(mainData, defects, photoIds, reportType, links = {}) {
  const id = mainData?.id_do_rolo;
  if (!id) throw new Error("ID do rolo ausente.");

  const jobKey = `RRT_JOB_${id}_${Date.now()}`;
  const payload = JSON.stringify({
    mainData,
    defects,
    photoIds,
    reportType,
    // ✅ CORRIGIDO: Propriedades 'links' dentro do payload
    links 
  });

  PropertiesService.getScriptProperties().setProperty(jobKey, payload);

  ScriptApp.newTrigger('processRRTAsyncJob') // ✅ CORRIGIDO
    .timeBased()
    .at(new Date(Date.now() + 30 * 1000))
    .create();

  return { status: "AGENDADO", jobKey };
}
/* ============================================================
 * 🧠 WORKER
 * ============================================================ */
function processRRTAsyncJob() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const jobKey = Object.keys(props).find(k => k.startsWith("RRT_JOB_"));
  if (!jobKey) return;

  let payload;
  let idRolo = "DESCONHECIDO";

  try {
    payload = JSON.parse(props[jobKey]);
    // ✅ MUDANÇA: Extraindo o objeto links do payload
    const { mainData, defects, reportType, links = {} } = payload; 
    idRolo = mainData.id_do_rolo;

    // 1) Pontuação
    // 🛡️ Verificação de serviço (para evitar erro se RRT não estiver carregado)
    if (!RRTServices?.RRT?.calcularPontuacao) {
      throw new Error("Serviço de cálculo de pontuação (RRTServices.RRT) ausente.");
    }
    const pontuacao = RRTServices.RRT.calcularPontuacao({
      ...mainData,
      defects
    });

    Object.assign(mainData, pontuacao);

    // 2) Gera PDF
    const docs = generateAllDocs(
      mainData,
      defects,
      payload.photoIds || [],
      reportType
    );

    // 🛡️ Verificação de serviço (para evitar erro se DatabaseService não estiver carregado)
    if (!DatabaseService?.rolls?.update) {
      throw new Error("Serviço de Banco de Dados (DatabaseService.rolls.update) ausente.");
    }

    DatabaseService.rolls.update(idRolo, {
      relatorio_file_id: docs.relatorioFileId,
      pontos_por_100m2: pontuacao.pontosPor100m2,
      status_pontuacao: pontuacao.statusQualidadePontos
    });

    // 3) Emails
    if (reportType === "supervisor") {
      // ✅ FLUXO DE EMAIL: Passando BLOB e LINK de revisão (linkR)
      if (typeof sendRevisaoConcluidaEmail === "function") {
        sendRevisaoConcluidaEmail(
                    { ...mainData, defects },
          docs.pdfBlob, 
          links.linkR 
        );
      } else {
        Logger.log("⚠️ sendRevisaoConcluidaEmail não definida.");
      }
    }

        if (reportType === "compras") {
            // ✅ FLUXO DE EMAIL: Passa dados completos (mainData, defects, docs)
            if (typeof sendComprasEmail === "function") {
                sendComprasEmail(
                    mainData,
                    defects,
                    docs
                );
            } else {
                Logger.log("⚠️ sendComprasEmail não definida.");
            }
        }

    // ✅ STATUS FINAL — CORRIGIDO
    DatabaseService.rolls.updateStatus(
      idRolo,
      "COMPLETED",
      "Sistema"
    );

  } catch (err) {
    Logger.log("🔥 ERRO ASYNC RRT: " + err.stack);

    // Tenta registrar o erro no DB
    try {
      DatabaseService.rolls.updateStatus(
        idRolo,
        "ERROR_ASYNC",
        "Sistema"
      );
    } catch (dbErr) {
      Logger.log("🔥 ERRO FATAL: Falha ao registrar erro no DB: " + dbErr.message);
    }

  } finally {
    // Tenta deletar a propriedade mesmo após o erro, para que o job não rode infinitamente.
    try { PropertiesService.getScriptProperties().deleteProperty(jobKey); } catch(e) {}
  }
}
/* ============================================================
 * 📄 ORQUESTRADOR PRINCIPAL
 * ============================================================ */
function generateAllDocs(mainData, defects, photoIds, reportType) {
  const id = mainData?.id_do_rolo;
  if (!id) throw new Error("ID ausente.");

  // 🛑 CORREÇÃO DE VULNERABILIDADE: Adiciona Optional Chaining
  const templateId =
    reportType === 'compras'
      ? CONFIG?.IDS?.TEMPLATE_FOTOS
      : CONFIG?.IDS?.TEMPLATE_RELATORIO;

  if (!templateId) {
    throw new Error(`Template não configurado para o tipo de relatório: ${reportType}. Verifique CONFIG.IDS.`);
  }

  const { roll, relatorio, fotos } = getOrCreateRollFolder(id);
  const inlinePhotos = saveInlinePhotos(defects, fotos);
  const finalPhotos = [...new Set([...(photoIds || []), ...inlinePhotos])];

  // A função generateReport agora retorna o File do PDF
  const pdfFile = generateReport(
    templateId,
    mainData,
    defects,
    finalPhotos,
    relatorio,
    reportType
  );

  // ✅ MUDANÇA: Obter o Blob do PDF para anexar ao e-mail
  const pdfBlob = pdfFile.getBlob(); 

  return {
    pastaRolo: roll.getId(),
    relatorioFileId: pdfFile.getId(),
    pdfBlob: pdfBlob, // <<< RETORNA O BLOB PARA ANEXO NO EMAIL
    savedPhotoIds: inlinePhotos
  };
}
// ============================================================
// 4) GERAÇÃO DO RELATÓRIO (DOC → PDF) - FINAL REVISADO
// ============================================================
function generateReport(templateId, mainData, defects, photoIds, targetFolder, reportType) {
    const fn = "generateReport";
    let docsCopy = null; // Arquivo Docs temporário

    try {
        // -------------------------------
        // 0) Valida parâmetros essenciais
        // -------------------------------
        if (!templateId) throw new Error("templateId inválido ou indefinido");
        if (!targetFolder || !targetFolder.getId) throw new Error("targetFolder inválido ou indefinido");

        Logger.log(`${fn} | templateId: ${templateId}, targetFolderId: ${targetFolder.getId()}, reportType: ${reportType}`);

        // -------------------------------
        // 1) Cria cópia do template
        // -------------------------------
        const tpl = DriveApp.getFileById(templateId);
        const safeReportType = String(reportType || '').toUpperCase();
        const docsCopyName = `RRT_DOCS_TEMP_${safeReportType}_${mainData.id_do_rolo}_${Date.now()}`;
        docsCopy = tpl.makeCopy(docsCopyName, targetFolder);
        Logger.log("docsCopy criado? " + (docsCopy ? docsCopy.getName() : "NÃO"));
        if (!docsCopy) throw new Error("Falha ao criar a cópia do template. Verifique permissões na pasta targetFolder.");

        const doc = DocumentApp.openById(docsCopy.getId());
        const body = doc.getBody();

        // -------------------------------
        // 2) Inserção da LOGO
        // -------------------------------
        const logoId = CONFIG?.IDS?.LOGO_FILE || "10fbU-7wBE7dlu-1RzdIbendCaCMEgltf"; 
        const LOGO_MARCADOR = "{{LOGO_EMPRESA}}";
        const MAX_WIDTH = 150; 

        if (logoId) {
            try {
                const logoBlob = DriveApp.getFileById(logoId).getBlob();
                [body, doc.getHeader(), doc.getFooter()].forEach(element => {
                    if (!element) return;

                    let searchResult = element.findText(LOGO_MARCADOR);
                    while (searchResult) {
                        const textElement = searchResult.getElement();
                        const container = textElement.getParent();
                        let insertionTarget = null;
                        let indexInTarget = -1;

                        if (container.getType() === DocumentApp.ElementType.PARAGRAPH) {
                            insertionTarget = container.asParagraph();
                            indexInTarget = insertionTarget.getChildIndex(textElement);
                        } else if (container.getType() === DocumentApp.ElementType.LIST_ITEM) {
                            insertionTarget = container.asListItem().getParagraph();
                            indexInTarget = insertionTarget.getChildIndex(textElement);
                        } else if (container.getParagraphs && container.getParagraphs().length > 0) {
                            insertionTarget = container.getParagraphs()[0];
                            indexInTarget = insertionTarget.getChildIndex(textElement);
                        }

                        if (!insertionTarget || insertionTarget.getType() !== DocumentApp.ElementType.PARAGRAPH) {
                            try {
                                const parent = textElement.getParent(); 
                                const parentContainer = parent.getParent(); 
                                if (parentContainer && parentContainer.insertParagraph) {
                                    const index = parentContainer.getChildIndex(parent);
                                    insertionTarget = parentContainer.insertParagraph(index, "");
                                    indexInTarget = 0;
                                    textElement.removeFromParent(); 
                                } else {
                                    textElement.removeFromParent();
                                }
                            } catch(e) {
                                Logger.log(`⚠️ ERRO no Fallback da Logo: ${e.message}`);
                                textElement.removeFromParent();
                            }
                        }

                        if (insertionTarget && insertionTarget.getType() === DocumentApp.ElementType.PARAGRAPH) {
                            const img = insertionTarget.insertImage(indexInTarget, logoBlob); 
                            if (!textElement.isSurrogate()) { 
                                textElement.removeFromParent(); 
                            } else {
                                try { insertionTarget.replaceText(LOGO_MARCADOR, ""); } catch(e) {}
                            }
                            const aspectRatio = img.getWidth() / img.getHeight();
                            img.setWidth(MAX_WIDTH);
                            img.setHeight(MAX_WIDTH / aspectRatio);
                            try { insertionTarget.setAlignment(DocumentApp.HorizontalAlignment.CENTER); } catch(e) {}
                        }

                        searchResult = element.findText(LOGO_MARCADOR, searchResult);
                    }
                });
            } catch (e) {
                Logger.log(`⚠️ ERRO ao carregar ou inserir a Logo: ${e.message}`);
            }
        }

        // -------------------------------
        // 3) Substituições de texto e fotos
        // -------------------------------
        const map = buildReplaceMapUnified(mainData, defects);
        applyTemplateReplacements(body, map);
        const fotosList = buildFotoList(defects, photoIds);

        const getInsertPosAndClear = (primaryMarker, fallbackMarkers) => {
            const regexEscape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            let foundPrimary = body.findText(primaryMarker);
            let pos = foundPrimary ? body.getChildIndex(foundPrimary.getElement().getParent()) : null;

            if (pos === null && Array.isArray(fallbackMarkers)) {
                for (let i = 0; i < fallbackMarkers.length; i++) {
                    const fm = fallbackMarkers[i];
                    const foundFallback = body.findText(fm);
                    if (foundFallback) {
                        pos = body.getChildIndex(foundFallback.getElement().getParent());
                        break;
                    }
                }
            }

            const allMarkers = [primaryMarker].concat(fallbackMarkers || []);
            allMarkers.forEach((m) => {
                const rx = regexEscape(m);
                body.replaceText(rx, "");
            });

            return pos === null ? body.getNumChildren() : pos;
        };

        const insertionPosCoordenadas = getInsertPosAndClear(
            "{{INSERCAO_COORDENADAS}}",
            ["{{INSERCAO_INICIO}}"]
        );
        const insertionPosProvas = getInsertPosAndClear(
            "{{INSERCAO_PROVAS}}",
            ["{{INSERCAO_INICIO}}"]
        );

        if (reportType === 'compras') {
            body.insertParagraph(insertionPosCoordenadas, "DETALHAMENTO E COORDENADAS DOS DEFEITOS").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertFormattedTable(body, insertionPosCoordenadas + 1, buildDefectDetailTableNative(defects));

            body.insertParagraph(insertionPosCoordenadas + 2, "DIAGRAMA DE LARGURA (Zonas A-E) - Áreas Afetadas").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertFormattedTable(body, insertionPosCoordenadas + 3, buildWidthMapTableNative(defects));

            body.insertParagraph(insertionPosCoordenadas + 4, "MAPA VISUAL DO ROLO (Localização 2D dos Defeitos)").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            body.insertParagraph(insertionPosCoordenadas + 5, `O rolo é dividido em blocos de ${BLOCK_SIZE_2D} metros de comprimento (Eixo X) e 5 Zonas de Largura (Eixo Y). Células destacadas indicam a presença de defeitos.`).setItalic(true);
            insertFormattedTable(body, insertionPosCoordenadas + 6, build2DRollMapGridNative(mainData, defects));

            body.insertParagraph(insertionPosProvas, "GALERIA DE FOTOS DO ROLO").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertPhotosGridAt(body, insertionPosProvas + 1, fotosList);

        } else if (reportType === 'supervisor') {
            body.insertParagraph(insertionPosCoordenadas, "MAPA VISUAL DO ROLO (Localização 2D dos Defeitos)").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            body.insertParagraph(insertionPosCoordenadas + 1, `O rolo é dividido em blocos de ${BLOCK_SIZE_2D} metros de comprimento (Eixo X) e 5 Zonas de Largura (Eixo Y). Células destacadas indicam a presença de defeitos.`).setItalic(true);
            insertFormattedTable(body, insertionPosCoordenadas + 2, build2DRollMapGridNative(mainData, defects));

            body.insertParagraph(insertionPosCoordenadas + 3, "DIAGRAMA DE LARGURA (Zonas A-E) - Áreas Afetadas").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertFormattedTable(body, insertionPosCoordenadas + 4, buildWidthMapTableNative(defects));

            body.insertParagraph(insertionPosProvas, "GALERIA DE FOTOS DO ROLO").setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertPhotosGridAt(body, insertionPosProvas + 1, fotosList);
        }

        // -------------------------------
        // 4) Salva e converte para PDF
        // -------------------------------
        doc.saveAndClose();

        if (!docsCopy) throw new Error("docsCopy não criado antes da conversão para PDF");

        let pdfBlob;
        try {
            pdfBlob = docsCopy.getAs('application/pdf'); // ✅ correção crítica
        } catch(err) {
            throw new Error("Falha ao converter Docs para PDF: " + err.message);
        }

        if (!pdfBlob) throw new Error("PDF Blob inválido após conversão do Docs.");

        const pdfFileName = `RRT_RELATORIO_${safeReportType}_${mainData.id_do_rolo}.pdf`;
        const pdfFile = targetFolder.createFile(pdfBlob).setName(pdfFileName);

        try { docsCopy.setTrashed(true); } catch(err) { Logger.log("Erro ao deletar cópia Docs: " + err); }

        return pdfFile;

    } catch (e) {
        Logger.log(`🔥 ERRO ${fn}: ${e.stack}`);
        if (docsCopy) {
            try { docsCopy.setTrashed(true); } catch(err) { Logger.log("Erro ao deletar cópia Docs: " + err); }
        }
        throw e;
    }
}
// -------------------------------------------------------------
/* ============================================================
 * 5) MAP & TEMPLATE (FINAL - GOOGLE DOCS) - INCLUSÃO CRÍTICA (Mantido)
 * ============================================================ */
function buildReplaceMapUnified(d, defects) {
    const safe = (v) => (v == null ? "" : String(v));
    const safeNum = (v, dp = 2) => {
        const num = parseFloat(v);
        return isNaN(num) ? "" : num.toFixed(dp);
    };

    const pick = (...values) => values.find(v => v !== undefined && v !== null && String(v) !== "");

        // --- LÓGICA DE STATUS DO REVISOR ---
        const normalizedStatus = String(
            d.status_rolo || d.status || d.status_final || d.fase_atual || ""
        ).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        let finalStatus = "";
        if (
            normalizedStatus === 'aprovado' ||
            normalizedStatus === 'aprovado_revisor' ||
            normalizedStatus === 'aprovado_supervisor' ||
            normalizedStatus === 'em_estoque'
        ) {
                finalStatus = '✅ APROVADO';
        } else if (
            normalizedStatus === 'em analise' ||
            normalizedStatus === 'em_analise' ||
            normalizedStatus === 'aguardando_supervisor'
        ) {
                finalStatus = '🔍 EM ANÁLISE PELO SUPERVISOR';
        } else if (
            normalizedStatus === 'reprovado_supervisor' ||
            normalizedStatus === 'enviado_compras' ||
            normalizedStatus === 'reprovado_compras' ||
            normalizedStatus === 'finalizado_reprovado'
        ) {
                finalStatus = '❌ REPROVADO';
        } else {
                finalStatus = 'ℹ️ STATUS EM PROCESSAMENTO';
        }

    // --- CONTAGEM DE DEFESOS POR GRAVIDADE ---
    let criticosCount = 0;
    let gravesCount = 0;
    let levesCount = 0;
    let maxGravidade = 'Nenhuma';

    (defects || []).forEach(def => {
        // Pontos 4 são "GRAVES"
        const pontos = parseFloat(def.pontos_totais || def.pontos || 0);
        if (pontos === 4) {
            gravesCount++;
            if (maxGravidade !== 'CRÍTICA') maxGravidade = 'GRAVE (4 Pontos)';
        } else if (pontos > 0) {
            levesCount++;
            if (maxGravidade === 'Nenhuma' || maxGravidade === 'LEVE (1-3 Pontos)') maxGravidade = 'LEVE (1-3 Pontos)';
        }
        // Adicionando Criticos (com base na regra de negócio que você pode ter omitido ou ser 4 pontos)
        if (def.critico) { // Assumindo que o defeito pode ter uma flag 'critico'
          criticosCount++;
          maxGravidade = 'CRÍTICA (Descarte)';
        }
    });

    const isReprovadoPorGravidade = criticosCount > 0;
    const isReprovadoPorGravidadeText = isReprovadoPorGravidade ? 'SIM (Descarte Imediato)' : 'NÃO';

    const rollId = pick(d.id_do_rolo, d.ID_ROLO, d.roll_id, d.product_id);
    const fornecedor = pick(d.fornecedor, d.FORNECEDOR, d.supplier_nm, d.supplier_name);
    const numeroPeca = pick(d.numero_peca, d.NF, d.nf, d.lot, d.LOTE);
    const referencia = pick(d.referencia, d.produto_id, d.PRODUTO_ID, d.product_id, d.PRODUCT_ID);
    const cor = pick(d.cor, d.COR, d.color_id, d.COLOR_ID);
    const metrosMaquina = pick(d.metros_maquina, d.METROS_MAQUINA, d.metros_revisado, d.METROS_REVISADO);
    const metrosFornecedor = pick(d.metros_fornecedor, d.METROS_FORNECEDOR, d.wid, d.WID);
    const larguraCm = pick(d.largura_cm, d.LARGURA_CM, d.len, d.LEN);
    const observacoes = pick(d.observacoes, d.OBSERVACOES, d.parecer_final, d.PARECER_FINAL, d.compras_resposta);
    const pontosTotais = pick(d.pontos_totais, d.PONTOS_TOTAIS, d.total_pontos, d.TOTAL_PONTOS, d.pontos, d.PONTOS);
    const pontosPor100m2 = pick(d.pontos_por_100m2, d.PONTOS_POR_100M2);
    const statusPontuacao = pick(d.status_pontuacao, d.STATUS_PONTUACAO, d.status_qualidade_pontos, d.STATUS_QUALIDADE_PONTOS);

    return {
        // Dados do Rolo
        "{{id_do_rolo}}": safe(rollId),
        "{{fornecedor}}": safe(fornecedor),
        "{{numero_peca}}": safe(numeroPeca),
        "{{referencia}}": safe(referencia),
        "{{cor}}": safe(cor),
        "{{metros_maquina}}": safe(metrosMaquina),
        "{{metros_fornecedor}}": safe(metrosFornecedor),
        "{{largura_cm}}": safe(larguraCm),
        "{{observacoes}}": safe(observacoes),

        // Métricas de Qualidade
        "{{pontos_totais}}": safeNum(pontosTotais, 0),
        "{{pontos_por_100m2}}": safeNum(pontosPor100m2),
        "{{status_pontuacao}}": safe(statusPontuacao),

        // Campos de Status/Gravidade
        "{{status_final_consolidado}}": finalStatus,
        "{{is_reprovado_por_gravidade_text}}": isReprovadoPorGravidadeText,
        "{{max_gravidade}}": maxGravidade,

        // Contagem por Gravidade
        "{{defeitos_criticos_count}}": safeNum(criticosCount, 0),
        "{{defeitos_graves_count}}": safeNum(gravesCount, 0),
        "{{defeitos_leves_count}}": safeNum(levesCount, 0),

        // Contagem Total
        "{{cont_total_defeitos}}": safeNum(d.contagem_defeitos?.TOTAL || (criticosCount + gravesCount + levesCount), 0)
    };
}

/**
 * Aplica substituições {{campo}} → valor no corpo do Google Docs
 * Compatível com textos, cabeçalho e rodapé
 */
function applyTemplateReplacements(body, replaceMap) {
  if (!body || !replaceMap) return;

  Object.keys(replaceMap).forEach(marker => {
    const value = replaceMap[marker];

    // Corpo
    try {
      body.replaceText(marker, value);
    } catch (e) {}

    // Header
    try {
      const header = body.getParent().getHeader();
      if (header) header.replaceText(marker, value);
    } catch (e) {}

    // Footer
    try {
      const footer = body.getParent().getFooter();
      if (footer) footer.replaceText(marker, value);
    } catch (e) {}
  });
}

// -------------------------------------------------------------
/* ============================================================
 * 6) FOTOS — GRID (I/O OTIMIZADO) (Mantido)
 * ============================================================ */

function buildFotoList(defects, ids) {
    const list = [];
    ids?.forEach((id) => list.push({ fileId: id, caption: "" }));
    
    defects?.forEach((d) => {
      const saved = d.saved_photo_id || d.savedPhotoId;
      if (saved) {
        list.push({
          fileId: saved,
          caption: `${d.tipo} (${d.metro_inicial || d.metroInicial}–${d.metro_final || d.metroFinal}m)`
        });
      }
    });

    return list;
}

function insertPhotosGridAt(body, index, fotos) {
    if (!fotos?.length) {
      body.insertParagraph(index, "Nenhuma foto registrada.");
      return;
    }

    // 🚨 OTIMIZAÇÃO: Pré-carregar os Blobs fora do loop
    const fotosComBlob = [];
    fotos.forEach((f) => {
        try {
            const blob = DriveApp.getFileById(f.fileId).getBlob(); 
            fotosComBlob.push({ ...f, blob: blob, error: false });
        } catch (err) {
            Logger.log(`⚠️ Erro ao carregar Blob da foto ${f.fileId}: ${err.message}`);
            fotosComBlob.push({ ...f, error: true });
        }
    });

    const rows = Math.ceil(fotosComBlob.length / 2);
    const table = body.insertTable(index, Array.from({ length: rows }, () => ["", ""]));
    
    // Configura a largura das colunas (opcional, mas recomendado)
    table.setColumnWidth(0, 300); // 300 pontos
    table.setColumnWidth(1, 300);

    fotosComBlob.forEach((f, i) => {
      const r = Math.floor(i / 2);
      const c = i % 2;
      const cell = table.getCell(r, c);
      cell.clear();

      if (f.error) {
          cell.appendParagraph("Erro ao carregar foto: " + f.fileId);
          return;
      }

      try {
          // Garante que a imagem é inserida no centro
          const p = cell.appendParagraph("");
          p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          const img = p.appendImage(f.blob); 
          
          // Redimensionamento inteligente
          const MAX_WIDTH = 280; // Largura máxima para caber na célula
          const aspectRatio = img.getWidth() / img.getHeight();
          img.setWidth(MAX_WIDTH);
          img.setHeight(MAX_WIDTH / aspectRatio);
          
          // Adiciona a legenda
          cell.appendParagraph(`Figura ${i + 1} — ${f.caption || "Sem descrição"}`)
            .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
            .setSpacingBefore(5); // Pequeno espaçamento após a imagem

      } catch (err) {
          cell.appendParagraph("Erro na inserção da imagem: " + f.fileId);
      }
    });
}
// -------------------------------------------------------------
/* ============================================================
 * 7) FUNÇÕES DE INSERÇÃO NATIVA DO DOCS (NOVO/ADAPTADO) (Mantido)
 * ============================================================ */

/**
 * Insere uma tabela nativa no Google Docs, formatando células com base na estrutura de dados.
 * @param {GoogleAppsScript.Document.Body} body O corpo do documento.
 * @param {number} index A posição de inserção.
 * @param {Array<Array<string|object>>} tableData Dados estruturados.
 */
function insertFormattedTable(body, index, tableData) {
    if (!tableData || tableData.length === 0) return;

    // 1. Converte a estrutura de dados complexa em um array 2D simples de strings
    const tableArray = tableData.map(row => 
        row.map(cellData => (typeof cellData === 'object' ? cellData.text : cellData))
    );

    // 2. Cria a Tabela nativa do Google Docs
    const table = body.insertTable(index, tableArray);
    
    // 3. Aplica formatação de célula (cores/negrito/alinhamento)
    for (let r = 0; r < table.getNumRows(); r++) {
        const isOddRow = r % 2 !== 0; // True para linhas de dados ímpares (1, 3, 5...)

        for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
            const cell = table.getCell(r, c);
            const style = {};
            
            // --- 1. CORES BASE ---

            if (r === 0) { // Cabeçalho
                style[DocumentApp.Attribute.BACKGROUND_COLOR] = '#DDDDDD'; // Cinza Escuro
            } 
            else if (isOddRow) { 
                // Linhas de dados ímpares (Striping)
                style[DocumentApp.Attribute.BACKGROUND_COLOR] = '#F3F3F3'; // Cinza muito claro
            }
            // Linhas de dados pares (r=2, 4, 6...) ficam brancas por padrão.
            
            // --- 2. CORES DE AFETAÇÃO (Sobrescrevem o Striping) ---
            if (r < tableData.length && c < tableData[r].length) { 
                const cellData = tableData[r][c];
                
                if (typeof cellData === 'object' && cellData.isAffected) {
                    // Células "X" (Afetadas) - Laranja Crítico
                    style[DocumentApp.Attribute.BACKGROUND_COLOR] = '#FFCCAA'; 
                    style[DocumentApp.Attribute.BOLD] = true;
                } 
                else if (r > 0 && tableArray[r][c] === 'OK') {
                    // Células "OK" - Verde Claro
                    style[DocumentApp.Attribute.BACKGROUND_COLOR] = '#C9EAD9'; 
                }
            }
            
            // Aplica os estilos de cor e negrito
            cell.setAttributes(style);
            
            // --- 3. ALINHAMENTO ---
            // Aplica o alinhamento ao PRIMEIRO PARÁGRAFO da célula
            if (cell.getNumChildren() > 0 && cell.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
                cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            }
        }
    }
}

/**
 * Retorna os dados estruturados para o Mapa Visual 2D (Metragem x Largura) para inserção nativa.
 */
function build2DRollMapGridNative(mainData, defects) {
    const fn = "build2DRollMapGridNative";
    const BLOCK_SIZE = BLOCK_SIZE_2D; // 2 metros
    const ZONES = ['A', 'B', 'C', 'D', 'E'];

    try {
        const metragemTotal = parseFloat(mainData.metros_maquina || mainData.metros_fornecedor);
        if (isNaN(metragemTotal) || metragemTotal <= 0) {
            return [['Metragem (m)', 'Zona A', 'Zona B', 'Zona C', 'Zona D', 'Zona E'], 
                        ['---', {text: 'Metragem insuficiente ou inválida.', isAffected: true}, '---', '---', '---', '---']];
        }

        const numBlocks = Math.ceil(metragemTotal / BLOCK_SIZE);
        const affectedBlocks = {}; 
        const finalTableData = [];

        // --- POPULAR MAPA DE AFETAÇÃO ---
        (defects || []).forEach((d) => {
            const metroStart = parseFloat(d.metro_inicial || d.metroInicial);
            const zonesAffected = String(d.posicao_largura || d.posicaoLargura || 'C').toUpperCase().split(',').map(z => z.trim());
            
            if (isNaN(metroStart)) return;

            // O defeito pode se estender por mais de um bloco
            const metroEnd = parseFloat(d.metro_final || d.metroFinal || metroStart);
            const startBlock = Math.floor(Math.min(metroStart, metroEnd) / BLOCK_SIZE);
            const endBlock = Math.floor(Math.max(metroStart, metroEnd) / BLOCK_SIZE);
            

            for (let blockIndex = startBlock; blockIndex <= endBlock; blockIndex++) {
                if (blockIndex < numBlocks) { // Limita aos blocos válidos
                    zonesAffected.forEach(zone => {
                        if (ZONES.includes(zone)) {
                            const key = `${blockIndex}_${zone}`;
                            affectedBlocks[key] = true;
                        }
                    });
                }
            }
        });

        // --- CONSTRUIR DADOS ESTRUTURADOS ---
        finalTableData.push(['Metragem (m)', ...ZONES.map(z => `Zona ${z}`)]); // Cabeçalho

        for (let r = 0; r < numBlocks; r++) {
            const startMetro = r * BLOCK_SIZE;
            const endMetro = Math.min((r + 1) * BLOCK_SIZE, metragemTotal);
            
            const row = [];
            row.push(`${startMetro}m a ${endMetro.toFixed(2)}m`); // Coluna 0: Metragem

            ZONES.forEach((zone) => {
                const key = `${r}_${zone}`;
                const defectsInBlock = affectedBlocks[key];
                
                // Objeto para indicar formatação no insertFormattedTable
                row.push({
                    text: defectsInBlock ? "X" : "OK",
                    isAffected: defectsInBlock
                });
            });
            finalTableData.push(row);
        }

        return finalTableData;

    } catch (e) {
        Logger.log(`🔥 ERRO ${fn}: ${e.stack}`);
        return [['Metragem (m)', 'Zona A', 'Zona B', 'Zona C', 'Zona D', 'Zona E'], 
                        ['---', {text: 'ERRO ao gerar Mapa Visual 2D.', isAffected: true}, '---', '---', '---', '---']];
    }
}


/**
 * Retorna os dados estruturados para o Mapa Tátil de Largura para inserção nativa.
 */
function buildWidthMapTableNative(defects) {
    const ZONES = ['A', 'B', 'C', 'D', 'E'];
    const affectedZones = new Set(); 

    (defects || []).forEach(d => {
        const pos = d.posicao_largura || d.posicaoLargura;
        if (pos) {
            pos.toUpperCase().split(',').forEach(zone => {
                const trimmedZone = zone.trim();
                if (ZONES.includes(trimmedZone)) {
                    affectedZones.add(trimmedZone); // Esta é a linha que deve estar aqui
                }
            });
        }
    });

    const header = ZONES.map(zone => `Zona ${zone}`);
    const statusRow = ZONES.map(zone => {
        const isAffected = affectedZones.has(zone);
        return {
            text: isAffected ? "X" : "OK",
            isAffected: isAffected
        };
    });

    return [
        header, 
        statusRow
    ];
}
/* ============================================================
 * 8) TABELA DE DETALHE DOS DEFEITOS (NOVO - NATIVO) (Mantido)
 * ============================================================ */
function buildDefectDetailTableNative(defects) {
    if (!defects || defects.length === 0) {
        // Retorna um array 2D para ser inserido como tabela
        return [['DETALHAMENTO', 'Nenhum defeito registrado.']]; 
    }

    const HEADER = ['ID', 'Tipo', 'Metragem (Início)', 'Metragem (Fim)', 'Posição', 'Pontos'];
    const data = [HEADER];
    
    // 2. Linhas de Dados
    defects.forEach((d, r) => {
        const safe = (v) => (v == null ? "" : String(v));
        data.push([
            safe(r + 1),
            safe(d.tipo),
            safe(d.metro_inicial || d.metroInicial),
            safe(d.metro_final || d.metroFinal),
            safe(String(d.posicao_largura || d.posicaoLargura || '').toUpperCase()), // ✅ CORRIGIDO
            safe(d.pontos_totais || d.pontos)
        ]);
    });
    
    return data;
}


/* ============================================================
 * 9) SALVAMENTO DE FOTOS INLINE (BASE64) (Mantido)
 * ============================================================ */
function saveInlinePhotos(defects, fotosFolder) {
    const out = [];

    (defects || []).forEach((d, i) => {
      if (d.saved_photo_id) {
        out.push(d.saved_photo_id);
        return;
      }
      try {
        const b64 = (!d.foto_id) ? d.foto_base64 : null;
        if (!b64) return;

        const match = b64.match(/^data:(image\/[^;]+);base64,(.*)$/);
        if (!match) return;

        const mime = match[1];
        const data = match[2];
        const ext = mime.split("/")[1];
        const name = `DEF_${d.tipo}_${Date.now()}_${i}.${ext}`;

        const blob = Utilities.newBlob(Utilities.base64Decode(data), mime, name);
        const file = fotosFolder.createFile(blob);

        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        d.saved_photo_id = file.getId();
        out.push(file.getId());

      } catch (_err) {
        // Ignora erros de salvamento de foto se Base64 for inválido ou ausente
      }
    });

    return out;
}

/* ============================================================
 * 🧩 NORMALIZAÇÃO (PDF + EMAIL)
 * ============================================================ */
function normalizeDefects(defects = []) {
  return defects.map(d => {
    const pontos = Number(d.pontos_totais || d.pontos || 0);
    return {
      ...d,
      gravidade_texto:
        pontos === 4 ? "GRAVE" :
        pontos > 0 ? "LEVE" : "NENHUMA"
    };
  });
}