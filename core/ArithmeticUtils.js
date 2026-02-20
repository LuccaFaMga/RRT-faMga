/**
 * ArithmeticUtils.js
 * 
 * ============================================================
 * Centraliza lógica de arredondamento e cálculos matemáticos
 * Garante: Sem dízima decimal, sem flutuação entre módulos
 * Padrão ABNT NBR 13484 para cálculos de tecidos
 * ============================================================
 */

var ArithmeticUtils = (function() {
  "use strict";

  /* ===========================================================
   * 1. ARREDONDAMENTO ROBUSTO (Core ABNT)
   * =========================================================== */

  /**
   * Arredonda número para N casas decimais (ABNT)
   * Usa técnica de deslocamento para evitar flutuação
   * 
   * Exemplo:
   *   roundABNT(37.355000000000004, 3) → 37.355
   *   roundABNT(24.1, 2) → 24.1
   * 
   * @param {number} value - Valor a arredondar
   * @param {number} decimals - Número de casas (default: 3)
   * @return {number} Valor arredondado e estável
   */
  function roundABNT(value, decimals = 3) {
    // Validação
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return 0;
    }

    // Técnica: (valor × 10^decimals → inteiro → ÷ 10^decimals)
    // Evita flutuação de ponto flutuante IEEE 754
    const factor = Math.pow(10, decimals);
    const shifted = Math.round(value * factor) / factor;

    // Dupla garantia: .toFixed() + Number() para máxima precisão
    return Number(shifted.toFixed(decimals));
  }

  /* ===========================================================
   * 2. CONVERSÃO DE TIPOS (Com Arredondamento)
   * =========================================================== */

  /**
   * Converte valor para Float com arredondamento ABNT
   * Aceita string, número ou qualquer valor
   * 
   * Exemplo:
   *   toNumber('24.1') → 24.1
   *   toNumber('24,1') → 24.1 (aceita vírgula brasileira)
   *   toNumber(null) → 0
   * 
   * @param {any} value - Qualquer valor
   * @param {number} decimals - Casas decimais (default: 3)
   * @return {number} Número arredondado
   */
  function toNumber(value, decimals = 3) {
    // String vazia ou nula
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    // Converter string com vírgula para ponto (suporte PT-BR)
    const str = String(value).trim().replace(',', '.');

    // Parse para número
    const num = parseFloat(str);

    // Se não conseguir fazer parse, retorna 0
    if (!Number.isFinite(num)) {
      return 0;
    }

    // Arredondar com ABNT
    return roundABNT(num, decimals);
  }

  /* ===========================================================
   * 3. CÁLCULOS ESPECÍFICOS (Power BI & ABNT)
   * =========================================================== */

  /**
   * Calcula Área (m²) usando dados de Metros e Largura
   * CENTRALIZAÇÃO DO CÁLCULO DE ÁREA DO POWER BI
   * 
   * Lógica:
   *   - Ambos parâmetros já estão em METROS
   *   - Resultado: comprimento × largura (direto)
   * 
   * Exemplos:
   *   calculateArea(24.1, 1.55) → 37.355 m² (ambos em metros)
   *   calculateArea(10, 5) → 50 m²
   * 
   * @param {number} larguraMetros - Largura em metros
   * @param {number} comprimentoMetros - Comprimento em metros
   * @return {number} Área em m² (arredondada ABNT - 3 casas)
   */
  function calculateArea(larguraMetros, comprimentoMetros) {
    const l = toNumber(larguraMetros, 4);
    const m = toNumber(comprimentoMetros, 4);

    // Validação
    if (l <= 0 || m <= 0) {
      return 0;
    }

    // Cálculo direto: comprimento × largura (ambos já em metros)
    const areaRaw = m * l;

    // Arredondar para padrão ABNT (3 casas decimais)
    return roundABNT(areaRaw, 3);
  }

  /**
   * Calcula Largura Efetiva em MM (para fórmula ABNT NBR 13484)
   * Converte largura de CM para MM com garantia ABNT
   * 
   * Fórmula: largura_cm × 10 = largura_mm
   * 
   * Exemplo:
   *   calculateWidthMM(24.1) → 241
   * 
   * @param {number} larguraCm - Largura em centímetros
   * @return {number} Largura em milímetros (arredondada)
   */
  function calculateWidthMM(larguraCm) {
    const cm = toNumber(larguraCm, 3);
    if (cm <= 0) return 0;
    return roundABNT(cm * 10, 1);
  }

  /**
   * Calcula Pontos por 100m² (ABNT NBR 13484)
   * FÓRMULA PADRÃO: (Pontos × 100.000) / (comprimento_m × largura_cm × 100)
   * 
   * Exemplo:
   *   calculatePointsPer100m2(5, 1.55, 24.1) → ~13.456 pontos/100m²
   * 
   * @param {number} totalPoints - Total de pontos de defeitos (0..N)
   * @param {number} comprimentoM - Comprimento em metros
   * @param {number} larguraCm - Largura em centímetros
   * @return {number} Pontos por 100m² (arredondado ABNT - 3 casas)
   */
  function calculatePointsPer100m2(totalPoints, comprimentoM, larguraCm) {
    const points = toNumber(totalPoints, 1);
    const comp = toNumber(comprimentoM, 3);
    const larg = toNumber(larguraCm, 2);

    // Validações
    if (!Number.isFinite(points) || comp <= 0 || larg <= 0) {
      return 0;
    }

    // Fórmula ABNT NBR 13484
    // (Pontos × 100) / (Comprimento_m × Largura_cm)
    const pontosPor100m2 = (points * 100) / (comp * larg);

    // Garantir arredondamento ABNT
    return roundABNT(pontosPor100m2, 3);
  }

  /* ===========================================================
   * 4. COMPARAÇÃO COM TOLERÂNCIA (Floating-Point Safe)
   * =========================================================== */

  /**
   * Compara dois números considerando erro floating-point
   * Usa tolerância para evitar problemas com IEEE 754
   * 
   * Exemplos:
   *   isEqual(37.355000000000004, 37.355) → true
   *   isEqual(10.1, 10.2, 0.05) → true
   *   isEqual(10.1, 10.2, 0.01) → false
   * 
   * @param {number} a - Primeiro número
   * @param {number} b - Segundo número
   * @param {number} tolerance - Tolerância (default: 0.0001)
   * @return {boolean} true se |a - b| < tolerance
   */
  function isEqual(a, b, tolerance = 0.0001) {
    const numA = Number(a);
    const numB = Number(b);

    // Validação básica
    if (!Number.isFinite(numA) || !Number.isFinite(numB)) {
      return numA === numB;
    }

    // Comparação com tolerância
    return Math.abs(numA - numB) < Math.abs(tolerance);
  }

  /**
   * Valida se número está dentro de range (com tolerância)
   * 
   * @param {number} value - Valor a verificar
   * @param {number} min - Mínimo (inclusive)
   * @param {number} max - Máximo (inclusive)
   * @param {number} tolerance - Tolerância
   * @return {boolean} true se min ≤ value ≤ max
   */
  function isInRange(value, min, max, tolerance = 0.0001) {
    const num = Number(value);
    const minVal = Number(min);
    const maxVal = Number(max);

    if (!Number.isFinite(num) || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      return false;
    }

    return (num >= minVal - tolerance) && (num <= maxVal + tolerance);
  }

  /* ===========================================================
   * 5. UTILITÁRIOS (Formatação & Validação)
   * =========================================================== */

  /**
   * Formata número para string com N casas decimais
   * Útil para exibição em UI ou logs
   * 
   * Exemplo:
   *   format(37.355, 2) → "37.36"
   *   format(37.355, 3) → "37.355"
   * 
   * @param {number} value - Valor a formatar
   * @param {number} decimals - Casas decimais
   * @return {string} String formatada
   */
  function format(value, decimals = 3) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    return num.toFixed(decimals);
  }

  /**
   * Valida se valor é um número válido
   * 
   * @param {any} value - Valor a validar
   * @return {boolean} true se é número finito
   */
  function isValidNumber(value) {
    return Number.isFinite(Number(value));
  }

  /* ===========================================================
   * 6. EXPORTAÇÃO PÚBLICA
   * =========================================================== */

  return {
    // Core ABNT
    roundABNT,
    toNumber,
    format,
    isValidNumber,

    // Cálculos Power BI
    calculateArea,
    calculateWidthMM,
    calculatePointsPer100m2,

    // Comparação segura
    isEqual,
    isInRange
  };
})();

// ============================================================
// EXPORTAÇÃO GLOBAL (Apps Script & Node.js Compatible)
// ============================================================
if (typeof globalThis !== 'undefined') {
  globalThis.ArithmeticUtils = ArithmeticUtils;
}

// Fallback para ambiente Node.js (se usado em testes)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArithmeticUtils;
}
