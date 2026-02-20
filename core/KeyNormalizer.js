/* ============================================================
   KeyNormalizer — Normalize object keys to snake_case
   ============================================================ */

function toSnakeCase(str) {
  if (!str && str !== 0) return str;
  try {
    let s = String(str);
    // remove diacritics (if supported)
    s = s.normalize ? s.normalize('NFD').replace(/\p{Diacritic}/gu, '') : s;
    // replace any non-letter/digit/_ with underscore
    s = s.replace(/[^\p{L}\d_]+/gu, '_');
    // camelCase -> snake_case
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
    s = s.replace(/__+/g, '_');
    s = s.replace(/^_+|_+$/g, '');
    return s.toLowerCase();
  } catch (e) {
    return String(str).toLowerCase();
  }
}

function normalizeKeysToSnakeCase(input) {
  if (Array.isArray(input)) {
    return input.map(x => normalizeKeysToSnakeCase(x));
  }
  if (!input || typeof input !== 'object') return input;

  const out = {};
  Object.keys(input).forEach(k => {
    const newKey = toSnakeCase(k);
    const v = input[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[newKey] = normalizeKeysToSnakeCase(v);
    } else if (Array.isArray(v)) {
      out[newKey] = v.map(item => normalizeKeysToSnakeCase(item));
    } else {
      out[newKey] = v;
    }
  });
  return out;
}

// Backwards compatibility exports (GLOBALS)
var toSnakeCase = toSnakeCase;
var normalizeKeysToSnakeCase = normalizeKeysToSnakeCase;
