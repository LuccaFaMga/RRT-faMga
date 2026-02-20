// =========================
// ValidationService.gs (Apps Script compatible)
// =========================

var ValidationService = (function () {

  function validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === "") {
      return {
        valid: false,
        error: `[VALIDATION] O campo "${fieldName}" é obrigatório.`
      };
    }
    return { valid: true, error: null };
  }

  function validatePositiveNumber(value, fieldName) {
    const n = Number(value);
    if (isNaN(n) || n <= 0) {
      return {
        valid: false,
        error: `[VALIDATION] O campo "${fieldName}" deve ser um número positivo.`
      };
    }
    return { valid: true, error: null };
  }

  function validateMaxLength(value, max, fieldName) {
    if (String(value).length > max) {
      return {
        valid: false,
        error: `[VALIDATION] O campo "${fieldName}" excede o tamanho máximo de ${max} caracteres.`
      };
    }
    return { valid: true, error: null };
  }

  function validateInSet(value, set, fieldName) {
    if (!set.includes(value)) {
      return {
        valid: false,
        error: `[VALIDATION] O campo "${fieldName}" deve estar entre: ${set.join(", ")}.`
      };
    }
    return { valid: true, error: null };
  }

  function validateRange(value, min, max, fieldName) {
    const n = Number(value);
    if (isNaN(n) || n < min || n > max) {
      return {
        valid: false,
        error: `[VALIDATION] O campo "${fieldName}" deve estar entre ${min} e ${max}.`
      };
    }
    return { valid: true, error: null };
  }

  function validateArrayNotEmpty(arr, fieldName) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return {
        valid: false,
        error: `[VALIDATION] O campo "${fieldName}" precisa ter ao menos 1 item.`
      };
    }
    return { valid: true, error: null };
  }

  function validateObjectStructure(obj, requiredKeys, fieldName) {
    if (typeof obj !== "object" || obj === null) {
      return {
        valid: false,
        error: `[VALIDATION] "${fieldName}" precisa ser um objeto válido.`
      };
    }

    for (const key of requiredKeys) {
      if (!(key in obj)) {
        return {
          valid: false,
          error: `[VALIDATION] "${fieldName}" está faltando a propriedade obrigatória "${key}".`
        };
      }
    }

    return { valid: true, error: null };
  }

  function validateFileSize(fileSizeBytes, maxSizeBytes, fieldName) {
    const size = Number(fileSizeBytes);

    if (isNaN(size) || size < 0) {
      return {
        valid: false,
        error: `[VALIDATION] "${fieldName}" tem tamanho inválido (${fileSizeBytes}).`
      };
    }

    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `[VALIDATION] "${fieldName}" excede o tamanho máximo permitido (${maxSizeBytes} bytes).`
      };
    }

    return { valid: true, error: null };
  }

  // PUBLIC API
  return {
    validateRequired,
    validatePositiveNumber,
    validateMaxLength,
    validateInSet,
    validateRange,
    validateArrayNotEmpty,
    validateObjectStructure,
    validateFileSize
  };

})();

// 🌎 Torna disponível globalmente (como Apps Script gosta)
globalThis.ValidationService = ValidationService;
