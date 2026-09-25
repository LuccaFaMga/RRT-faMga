/**
 * CONGELADO — cópia exata de App.parseQrPayload de ui/reviewer_core_js.html (tag v-legado).
 * É o parser que o celular usa hoje para preencher o formulário.
 * Serve de referência para os testes de caracterização de Etiqueta. Não editar.
 */
const legado = {

  parseQrPayload(raw){
    console.log('[QR_PARSE] 📊 Iniciando parse de QR:', raw.substring(0, 100) + (raw.length > 100 ? '...' : ''));
    
    const text = String(raw || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!text) {
      console.warn('[QR_PARSE] ❌ QR vazio');
      return null;
    }

    const normalizeKey = (k) => String(k || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const aliasToCanonical = {
      supplier_id: ['supplier_id', 'fornecedor_id', 'id_fornecedor', 'idfornecedor', 'id_forn', 'forn_id'],
      supplier_name: ['supplier_name', 'supplier_nm', 'fornecedor', 'fornecedor_nome', 'nome_fornecedor', 'forn_nome'],
      nf: ['nf', 'nota_fiscal', 'nota', 'nota_fiscal_numero'],
      product_id: ['product_id', 'produto_id', 'codigo_produto', 'cod_produto', 'cod_prod', 'produto'],
      lot: ['lot', 'lote', 'lote_id'],
      sup_product_id: ['sup_product_id', 'produto_sup_id', 'supplier_product_id', 'produto_fornecedor_id'],
      color_id: ['color_id', 'cor', 'color', 'cor_id'],
      fabric_pattern: ['fabric_pattern', 'padronagem', 'pattern', 'desenho'],
      loc: ['loc', 'localizacao', 'local', 'endereco', 'rua', 'posicao'],
      meters_supplier: ['meters_supplier', 'metros_fornecedor', 'metros', 'metragem', 'wid'],
      wid: ['wid', 'largura', 'len', 'largura_cm'],
      comp: ['comp', 'composicao', 'composition']
    };

    const canonicalByAlias = Object.create(null);
    Object.keys(aliasToCanonical).forEach((canonical) => {
      aliasToCanonical[canonical].forEach((alias) => {
        canonicalByAlias[normalizeKey(alias)] = canonical;
      });
    });

    const numberFrom = (value) => {
      const normalized = String(value || '')
        .replace(/\s/g, '')
        .replace(',', '.')
        .replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const buildCanonical = (payload = {}) => {
      const normalizedPayload = {};
      Object.keys(payload || {}).forEach((k) => {
        const canonicalKey = canonicalByAlias[normalizeKey(k)] || normalizeKey(k);
        if (canonicalKey && normalizedPayload[canonicalKey] === undefined) {
          normalizedPayload[canonicalKey] = payload[k];
        }
      });

      const data = {
        supplier_id: normalizedPayload.supplier_id || '',
        supplier_name: normalizedPayload.supplier_name || '',
        nf: normalizedPayload.nf || '',
        product_id: normalizedPayload.product_id || '',
        lot: normalizedPayload.lot || '',
        sup_product_id: normalizedPayload.sup_product_id || '',
        color_id: normalizedPayload.color_id || '',
        fabric_pattern: normalizedPayload.fabric_pattern || '',
        loc: normalizedPayload.loc || '',
        meters_supplier: numberFrom(normalizedPayload.meters_supplier),
        wid: numberFrom(normalizedPayload.wid),
        comp: normalizedPayload.comp || ''
      };

      const hasMinimum = Object.values(data).some(v => String(v || '').trim() !== '' && String(v || '') !== '0');
      return hasMinimum ? data : null;
    };

    // 1) JSON
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        console.log('[QR_PARSE] 🔍 Tentando formato JSON...');
        const parsedJson = JSON.parse(text);
        if (Array.isArray(parsedJson) && parsedJson.length >= 11) {
          const parts = parsedJson.map(v => String(v || '').trim());
          const result = {
            supplier_id: parts[0] || '',
            supplier_name: parts[1] || '',
            nf: parts[2] || '',
            product_id: parts[3] || '',
            lot: parts[4] || '',
            sup_product_id: parts[5] || '',
            color_id: parts[6] || '',
            fabric_pattern: parts[7] || '',
            loc: parts[8] || '',
            meters_supplier: numberFrom(parts[9]),
            wid: numberFrom(parts[10]),
            comp: parts.slice(11).join(' ').trim()
          };
          console.log('[QR_PARSE] ✅ JSON array parseado com sucesso');
          return result;
        }

        const canonicalFromJson = buildCanonical(parsedJson || {});
        if (canonicalFromJson) {
          console.log('[QR_PARSE] ✅ JSON object parseado com sucesso');
          return canonicalFromJson;
        }
      } catch (e) {
        console.warn('[QR_PARSE] ⚠️ Falha ao parsear JSON:', e.message);
      }
    }

    // 2) URL com query params
    if (/^https?:\/\//i.test(text)) {
      try {
        console.log('[QR_PARSE] 🔍 Tentando formato URL...');
        const url = new URL(text);
        const params = Object.fromEntries(url.searchParams.entries());
        const canonicalFromUrl = buildCanonical(params);
        if (canonicalFromUrl) {
          console.log('[QR_PARSE] ✅ URL parseada com sucesso');
          return canonicalFromUrl;
        }
      } catch (e) {
        console.warn('[QR_PARSE] ⚠️ Falha ao parsear URL:', e.message);
      }
    }

    // 3) key=value / key:value em linhas
    if (/[:=]/.test(text) && /\r?\n/.test(text)) {
      console.log('[QR_PARSE] 🔍 Tentando formato key=value multilinhas...');
      const kv = {};
      text.split(/\r?\n/).forEach(line => {
        const trimmed = String(line || '').trim();
        if (!trimmed) return;
        const separatorIndex = trimmed.includes(':') ? trimmed.indexOf(':') : trimmed.indexOf('=');
        if (separatorIndex <= 0) return;
        const key = trimmed.slice(0, separatorIndex).trim().toLowerCase().replace(/\s+/g, '_');
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (key) kv[key] = value;
      });
      const canonicalFromKv = buildCanonical(kv);
      if (canonicalFromKv) {
        console.log('[QR_PARSE] ✅ Key=value parseado com sucesso');
        return canonicalFromKv;
      }
    }

    // 3.1) key=value / key:value em linha única (separado por ; | ou quebra)
    if (/[:=]/.test(text)) {
      console.log('[QR_PARSE] 🔍 Tentando formato key=value inline...');
      const kv = {};
      const chunks = text.split(/[;|\n\r]+/).map(s => String(s || '').trim()).filter(Boolean);
      chunks.forEach((chunk) => {
        const idxColon = chunk.indexOf(':');
        const idxEq = chunk.indexOf('=');
        const sep = (idxColon >= 0 && idxEq >= 0) ? Math.min(idxColon, idxEq) : Math.max(idxColon, idxEq);
        if (sep <= 0) return;
        const rawKey = chunk.slice(0, sep).trim();
        const rawValue = chunk.slice(sep + 1).trim();
        if (!rawKey || !rawValue) return;
        kv[rawKey] = rawValue;
      });

      const canonicalFromInlineKv = buildCanonical(kv);
      if (canonicalFromInlineKv) {
        console.log('[QR_PARSE] ✅ Key=value inline parseado com sucesso');
        return canonicalFromInlineKv;
      }
    }

    // 4) formato posicional legado
    console.log('[QR_PARSE] 🔍 Tentando formato posicional legado...');
    const bySemicolon = text.split(';').map(p => p.trim()).filter(Boolean);
    const byPipe = text.split('|').map(p => p.trim()).filter(Boolean);
    const byLine = text.split(/\r?\n/).map(p => p.trim()).filter(Boolean);

    let parts = bySemicolon;
    if (parts.length < 12 && byPipe.length >= 8) parts = byPipe;
    if (parts.length < 12 && byLine.length >= 8) parts = byLine;
    if (parts.length < 8) {
      console.error('[QR_PARSE] ❌ Nenhum formato reconhecido. Partes detectadas:', {
        semicolon: bySemicolon.length,
        pipe: byPipe.length,
        lines: byLine.length
      });
      return null;
    }

    const comp = parts.slice(11).join(' ').trim();

    const result = {
      supplier_id: parts[0] || '',
      supplier_name: parts[1] || '',
      nf: parts[2] || '',
      product_id: parts[3] || '',
      lot: parts[4] || '',
      sup_product_id: parts[5] || '',
      color_id: parts[6] || '',
      fabric_pattern: parts[7] || '',
      loc: parts[8] || '',
      meters_supplier: numberFrom(parts[9]),
      wid: numberFrom(parts[10]),
      comp: comp || ''
    };
    
    console.log('[QR_PARSE] ✅ Formato posicional parseado com sucesso:', result);
    return result;
  }
};
module.exports = (raw) => legado.parseQrPayload(raw);
