/*******************************************************************
 * RRT_DocumentService.gs — Serviço de Geração de Documento Único
 * - Relatório + Anexo (fotos inseridas no próprio relatório)
 * - Grid 2 fotos por linha, largura 320px, legenda com tipo + metros
 * - Mantém compatibilidade: retorna relatorioFile e anexoFotosFile (mesmo arquivo)
 *******************************************************************/

'use strict';

/*
  OBSERVAÇÃO: você carregou um logo localmente durante a sessão. Path fornecida
  pelo ambiente: /mnt/data/Image_fx (1).jpg
  No Apps Script continue usando CONFIG.LOGO_FILE_ID (Drive) para inserir logo.
*/

function generateAllDocs(mainData, defects, providedPhotoIds) {
  LogApp.log('DocumentService: Inicio generateAllDocs', LogApp.LEVELS.INFO);

  try {
    const folderId =
      (CONFIG && CONFIG.IDS && (CONFIG.IDS.OUTPUT_FOLDER || CONFIG.IDS.PASTA_PDFS)) ||
      CONFIG.OUTPUT_FOLDER_ID;
    if (!folderId) {
      throw new Error('OUTPUT_FOLDER_ID não configurado em CONFIG.');
    }

    const folder = DriveApp.getFolderById(folderId);

    // Salva fotos base64 inline (se houver) e preenche d.savedPhotoId
    const savedPhotoIds = saveInlinePhotos(defects, folder);

    // Combina providedPhotoIds com savedPhotoIds (único)
    const photoIds = Array.from(new Set([...(providedPhotoIds || []), ...savedPhotoIds]));

    // Gera único documento (relatório com fotos incorporadas)
    const relatorioFile = generateRelatorioWithPhotos(mainData, defects, photoIds, folder);

    // Para compatibilidade com código existente que espera ambos:
    return { relatorioFile: relatorioFile, anexoFotosFile: relatorioFile, savedPhotoIds: savedPhotoIds };

  } catch (err) {
    LogApp.log('DocumentService: ERRO generateAllDocs -> ' + (err && err.message ? err.message : String(err)), LogApp.LEVELS.CRITICAL);
    throw err;
  }
}

/* ================================================================
   generateRelatorioWithPhotos
   - cria a cópia do template de relatório
   - preenche campos
   - insere defeitos formatados
   - insere grid de fotos no marcador {{FOTOS_AQUI}}
=================================================================*/
function generateRelatorioWithPhotos(mainData, defects, photoIds, folder) {
  try {
    const templateId =
      (CONFIG && CONFIG.IDS && CONFIG.IDS.TEMPLATE_RELATORIO) ||
      CONFIG.TEMPLATE_RELATORIO_ID;
    if (!templateId) {
      throw new Error('TEMPLATE_RELATORIO_ID não configurado em CONFIG.');
    }

    const tpl = DriveApp.getFileById(templateId);
    const copyName = `RRT - Relatório + Fotos - ${mainData["ID do Rolo"] || 'SEM_ID'}`;
    const copy = tpl.makeCopy(copyName, folder);
    const doc = DocumentApp.openById(copy.getId());
    const body = doc.getBody();

    // Substituições simples (map)
    const map = buildReplaceMap(mainData);
    replaceAllInBody(body, map);

    // Defeitos formatados — texto (tabela textual) e array estruturado
    const defeitosTexto = RRT_formatarDefeitos(defects);
    body.replaceText('{{DEFEITOS_FORMATADOS}}', defeitosTexto.text || 'Nenhum defeito registrado.');

    // Localiza marcador de fotos
    const marker = '{{FOTOS_AQUI}}';
    const found = body.findText(marker);

    // Construir lista de fotos com legendas baseada em defects e photoIds
    const photosStructured = RRT_formatarFotos(defects, photoIds);

    if (!found) {
      // marcador não encontrado -> anexa no final
      if (photosStructured.length === 0) {
        body.appendParagraph('Nenhuma foto registrada.');
      } else {
        insertPhotosGrid(body, photosStructured);
      }
      doc.saveAndClose();
      return copy;
    }

    // elemento Text que continha o marcador
    const textEl = found.getElement().asText();

    // encontrou o ancestral que é filho direto do BODY (para inserir corretamente)
    let node = textEl.getParent();
    while (node && node.getParent && node.getParent().getType && node.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
      node = node.getParent();
    }
    const insertAncestor = node || textEl.getParent();
    const insertIndex = body.getChildIndex(insertAncestor);

    // limpa o marcador do texto
    try { textEl.setText(''); } catch (e) { /* ignore */ }

    // Inserir as fotos a partir da posição determinada
    if (photosStructured.length === 0) {
      body.insertParagraph(insertIndex + 1, 'Nenhuma foto registrada.');
    } else {
      // cria um parágrafo introdutório
      body.insertParagraph(insertIndex + 1, 'ANEXO FOTOGRÁFICO — Imagens referentes aos defeitos identificados:');
      // inserir grid logo após
      insertPhotosGridAt(body, insertIndex + 2, photosStructured);
    }

    doc.saveAndClose();
    return copy;

  } catch (e) {
    LogApp.log('DocumentService: ERRO generateRelatorioWithPhotos -> ' + (e && e.message ? e.message : String(e)), LogApp.LEVELS.ERROR);
    throw e;
  }
}

/* ================================================================
   insertPhotosGridAt(body, index, photosStructured)
   - Insere uma tabela com 2 colunas onde cada célula contém a imagem
   - largura de imagem: 320px
   - legenda centralizada com: "Figura X — <Tipo> — <inicio> → <fim>"
=================================================================*/
function insertPhotosGridAt(body, insertIndex, photosStructured) {
  try {
    if (!photosStructured || photosStructured.length === 0) return;

    // Cria tabela com N linhas (cada linha 2 colunas)
    const rows = Math.ceil(photosStructured.length / 2);
    const table = body.insertTable(insertIndex, Array(rows).fill().map(() => ['', '']));

    // Ajuste simples de estilo de tabela (Docs limita decorações; bordas finas nativas variam)
    try {
      table.setBorderWidth(1);
    } catch (e) {
      // setBorderWidth pode não existir para todas as contas; ignorar se falhar
    }

    let figIndex = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        const idx = r * 2 + c;
        const cell = table.getCell(r, c);
        cell.clear(); // limpa conteúdo do placeholder

        if (idx < photosStructured.length) {
          const p = photosStructured[idx];
          try {
            const file = DriveApp.getFileById(p.fileId);
            const blob = file.getBlob();
            // inserir imagem na célula
            const inserted = cell.appendImage(blob);
            // ajustar largura
            try { inserted.setWidth(320); } catch (e) { /* ignore */ }

            // legenda
            const caption = `Figura ${figIndex} — ${p.caption || '(sem descrição)'}`;
            const capP = cell.appendParagraph(caption);
            capP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            capP.setItalic(true);
            capP.setFontSize(10);

            // espaçamento entre imagem e legenda
            cell.appendParagraph('');

            figIndex++;
          } catch (e) {
            cell.appendParagraph('Erro ao inserir imagem: ' + (e.message || e));
          }
        } else {
          // célula vazia -> manter em branco
          cell.appendParagraph('');
        }
      }
    }

    // pequena quebra após tabela
    body.insertParagraph(insertIndex + rows + 1, '');

  } catch (e) {
    LogApp.log('DocumentService: ERRO insertPhotosGridAt -> ' + (e && e.message ? e.message : String(e)), LogApp.LEVELS.WARN);
  }
}

/* ================================================================
   insertPhotosGrid (fallback append at end)
=================================================================*/
function insertPhotosGrid(body, photosStructured) {
  const idx = body.getNumChildren();
  insertPhotosGridAt(body, idx, photosStructured);
}

/* ================================================================
   saveInlinePhotos(defects, folder)
   - salva fotos base64 encontradas em cada defect (mantido)
=================================================================*/
function saveInlinePhotos(defects, folder) {
  if (!defects || !Array.isArray(defects)) return [];

  const saved = [];
  defects.forEach((d, idx) => {
    try {
      const b64 = d.fotoBase64 || d.fotoRaw || d.foto_b64 || '';
      if (b64 && typeof b64 === 'string' && b64.indexOf('data:') === 0) {
        const match = b64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
        if (!match) throw new Error('Formato dataURL inválido no defeito idx ' + idx);

        const mime = match[1];
        const data = match[2];
        const ext = (mime.split('/')[1] || 'jpg').split('+')[0];
        const name = `RRT_Foto_${(d.id || ('X' + idx))}_${new Date().getTime()}.${ext}`;
        const blob = Utilities.newBlob(Utilities.base64Decode(data), mime, name);

        const file = folder.createFile(blob);
        const id = file.getId();

        d.savedPhotoId = id;
        saved.push(id);
        LogApp.log('DocumentService: foto inline salva id=' + id, LogApp.LEVELS.DEBUG);
      }
    } catch (e) {
      LogApp.log('DocumentService: falha ao salvar foto inline (defeito idx ' + idx + '): ' + e.message, LogApp.LEVELS.WARN);
      // não interrompe o fluxo
    }
  });

  return saved;
}

/* ================================================================
   buildReplaceMap / replaceAllInBody / escapeForReplace
   (copiado/ajustado da sua versão existente)
=================================================================*/
function buildReplaceMap(d) {
  const norm = Object.assign({}, d || {});
  const get = (k, alt) => (norm[k] !== undefined ? norm[k] : (alt !== undefined ? alt : ''));
  const pesoFornecedor =
    get('peso_fornecedor',
      get('peso_fabrica',
        get('Peso Fornecedor',
          get('Peso (Fornecedor)', ''))));
  const metrosFornecedor =
    get('metros_fornecedor',
      get('Metros Fornecedor',
        get('Metros (Fornecedor)', '')));

  const map = {
    '{{id_rolo}}': get('ID do Rolo', get('id_rolo', '')),
    '{{data_envio}}': get('data_envio', get('Carimbo de data/hora', '')),
    '{{responsavel}}': get('responsavel', get('Responsável pela revisão', '')),
    '{{fornecedor}}': get('fornecedor', ''),
    '{{nota_fiscal}}': get('nf', get('nota_fiscal', '')),
    '{{codigo_linx}}': get('codigo_linx', ''),
    '{{lote}}': get('lote', ''),
    '{{numero_peca}}': get('numero_peca', get('Nº da Peça', '')),
    '{{referencia}}': get('referencia', ''),
    '{{cor}}': get('cor', ''),
    '{{tipo_tecido}}': get('tipo_tecido', ''),
    '{{largura_cm}}': get('largura_cm', ''),
    '{{metros_maquina}}': get('metros_maquina', ''),
    '{{peso_fornecedor}}': pesoFornecedor,
    '{{peso_fabrica}}': pesoFornecedor,
    '{{metros_fornecedor}}': metrosFornecedor,
    '{{peso_fornecedor_kg}}': pesoFornecedor,
    '{{peso_123}}': pesoFornecedor,
    '{{metros_123}}': metrosFornecedor,
    '{{status_revisor}}': get('Status do Rolo (Revisor)', ''),
    '{{status_rolo}}': get('Status do Rolo', ''),
    '{{observacoes}}': get('observacoes', get('Observações', ''))
  };

  // keys adicionais (formatos comuns)
  const flat = {};
  Object.keys(map).forEach(k => {
    const bare = k.replace(/^\{\{|\}\}$/g, '');
    flat[k] = map[k];
    flat['{{ ' + bare + ' }}'] = map[k];
    flat['{{' + bare + ':}}'] = map[k];
    flat['{{' + bare + '}}'] = map[k];
    flat[bare] = map[k];
  });

  return flat;
}

function replaceAllInBody(body, map) {
  Object.keys(map).forEach(key => {
    try {
      body.replaceText(escapeForReplace(key), String(map[key] === null ? '' : map[key]));
    } catch (e) {
      LogApp.log('DocumentService: replaceAllInBody falhou para key ' + key + ' -> ' + (e && e.message ? e.message : String(e)), LogApp.LEVELS.DEBUG);
    }
  });
}

function escapeForReplace(s) {
  return s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
