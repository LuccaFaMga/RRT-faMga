/** 
 * =================================================================
 * RRT_Core.gs - (Google Apps Script Version)
 * =================================================================
 * * Centraliza lógica de cálculo de pontuação (ABNT NBR 13484)
 * * Método baseado no sistema de 4 pontos
 * * Pontuação SEM reprovação automática
 * * Supervisor sempre decide
 * * Suporte a TECIDO PLANO e TECIDO DE MALHA (informativo)
 * @version 2.2.0
 */

(function (global) {
  'use strict';

  // ============================================================
  // MAPA DE COMPATIBILIDADE (LEGADO / TEXTO → PONTOS)
  // ============================================================
  const MAPA_GRAVIDADE_TEXTO = {
    "LEVE": 1,
    "PEQUENO": 1,

    "MEDIA": 2,
    "MÉDIA": 2,
    "MEDIO": 2,
    "MÉDIO": 2,

    "GRAVE": 3,
    "GRANDE": 3,

    "CRITICA": 4,
    "CRÍTICA": 4,
    "CRITICO": 4,
    "CRÍTICO": 4,

    "FURO": 4,
    "4_FURO": 4
  };

  // ============================================================
  // NORMALIZA GRAVIDADE → 0..4
  // ============================================================
  function normalizeGravidade(gravidade) {
    if (gravidade === null || gravidade === undefined) return 0;

    const num = Number(gravidade);
    if (!isNaN(num) && num >= 1 && num <= 4) return num;

    const txt = String(gravidade).toUpperCase().trim();
    return MAPA_GRAVIDADE_TEXTO[txt] || 0;
  }

  // ============================================================
  // PONTUAÇÃO BASE (SOMA SIMPLES)
  // ============================================================
  function calculatePoints(defeitosArray) {
    if (!Array.isArray(defeitosArray)) return 0;

    return defeitosArray.reduce((total, defeito) => {
      if (!defeito) return total;
      const pontos = normalizeGravidade(defeito.gravidade);
      return total + Math.min(pontos, 4);
    }, 0);
  }

  /**
   * ABNT NBR 13484
   * Pontos por 100 m² =
   * (Total de pontos × 1.000) / (metros × largura em cm)
   * 
   * ✅ CENTRALIZADO: Usa ArithmeticUtils para garantir arredondamento ABNT
   * Sem dízima decimal (37.355000000000004 → 37.355)
   */
  function calculatePointsPer100m2(totalPoints, comprimento_m, largura_cm) {
    // ✅ Usar ArithmeticUtils para conversão e arredondamento seguro
    const points = ArithmeticUtils.toNumber(totalPoints, 1);
    const comprimento = ArithmeticUtils.toNumber(comprimento_m, 3);
    const largura = ArithmeticUtils.toNumber(largura_cm, 2);

    if (
      !Number.isFinite(points) ||
      comprimento <= 0 ||
      largura <= 0
    ) {
      return 0;
    }

    // Fórmula ABNT NBR 13484
    // (Pontos × 100) / (Comprimento_m × Largura_cm)
    const pontos = (points * 100) / (comprimento * largura);

    // ✅ Arredondar com garantia ABNT (nunca dízima)
    return ArithmeticUtils.roundABNT(pontos, 3);
  }

  // ============================================================
  // STATUS INFORMATIVO (NUNCA DECISÓRIO)
  // ============================================================
  function getQualityStatus(pontosPor100m2, limite = 35) {
    return Number(pontosPor100m2) > limite
      ? 'ACIMA DO LIMITE DE REFERÊNCIA'
      : 'DENTRO DO LIMITE DE REFERÊNCIA';
  }

  function isRollApproved(pontosPor100m2, limite = 35) {
    // ⚠️ Função mantida apenas por compatibilidade
    // ❌ NÃO deve ser usada como decisão automática
    return Number(pontosPor100m2) <= limite;
  }

  // ============================================================
  // CÁLCULO PADRÃO (PLANO)
  // ============================================================
  function calcularPontuacao(data) {
    const defeitos = data?.defects || [];
    const comprimento = data?.metros_maquina || data?.comprimento_revisado || 0;
    const larguraCm = data?.largura_cm || 0;

    const totalPontos = calculatePoints(defeitos);
    const pontosPor100m2 = calculatePointsPer100m2(
      totalPontos,
      comprimento,
      larguraCm
    );

    return {
      totalPontos,
      pontosPor100m2,
      statusQualidadePontos: getQualityStatus(pontosPor100m2),
      tipo_tecido: 'PLANO',
      observacao: 'Pontuação informativa — decisão é do supervisor'
    };
  }

  // ============================================================
  // CÁLCULO POR TIPO DE TECIDO (NOVO — SEM QUEBRAR API)
  // ============================================================
  function calcularPontuacaoPorTipo(data) {
    const tipo = String(data?.tipo_tecido || 'PLANO').toUpperCase();
    
    if (tipo === 'MALHA') {
      // Para malha: usar peso em kg (data.peso_kg ou data.supplier_weight)
      const pesoKg = ArithmeticUtils.toNumber(data.peso_kg || data.supplier_weight || 0, 2);
      if (pesoKg <= 0) {
        return {
          totalPontos: 0,
          pontosPor100kg: 0,
          statusQualidadePontos: 'PESO INSUFICIENTE PARA CÁLCULO',
          tipo_tecido: 'MALHA',
          observacao: 'Sem peso registrado. Cálculo não possível.'
        };
      }

      const totalPontos = calculatePoints(data?.defects || []);
      const pontosPor100kg = (totalPontos * 100) / pesoKg;
      const pontosPor100kgArredondado = ArithmeticUtils.roundABNT(pontosPor100kg, 3);

      return {
        totalPontos,
        pontosPor100kg: pontosPor100kgArredondado,
        statusQualidadePontos: getQualityStatus(pontosPor100kgArredondado, 30), // Limite mais restritivo para malha
        tipo_tecido: 'MALHA',
        observacao: `Pontuação por peso: ${pontosPor100kgArredondado} pontos/100kg (Limite: 30). Decisão do supervisor.`,
        pesoKg: pesoKg
      };
    }

    // Para tecido plano: usar metragem em m² (padrão)
    return calcularPontuacao(data);
  }

  // ============================================================
  // FACHADA LEGADA (MANTIDA)
  // ============================================================
  function calcularPontuacaoFinal(defeitosArray, comprimento_m, largura_cm) {
    const total = calculatePoints(defeitosArray);
    const pontos100 = calculatePointsPer100m2(total, comprimento_m, largura_cm);

    return {
      total,
      pontosPor100m2: pontos100,
      aprovado: isRollApproved(pontos100) // ⚠️ Informativo
    };
  }

  // ============================================================
  // EXPORTAÇÃO DO CORE
  // ============================================================
  const RRT_Services_Core = {
    calculatePoints,
    calculatePointsPer100m2,
    getQualityStatus,
    isRollApproved, // compatibilidade
    calcularPontuacao,
    calcularPontuacaoPorTipo, // ⭐ NOVO
    calcularPontuacaoFinal,
    somar: (a, b) => Number(a) + Number(b)
  };

  // ============================================================
  // EXPORTAÇÃO GLOBAL
  // ============================================================
  global.RRTServices = {
    RRT: RRT_Services_Core,

    get WorkflowService() {
      const svc = global.WorkflowService;
      if (!svc) Logger.log("⚠️ WorkflowService ainda não carregado.");
      return svc;
    },

    get SupervisorController() {
      const svc = global.SupervisorController;
      if (!svc) Logger.log("⚠️ SupervisorController ainda não carregado.");
      return svc;
    },

    get ComprasController() {
      const svc = global.ComprasController;
      if (!svc) Logger.log("⚠️ ComprasController ainda não carregado.");
      return svc;
    },

    get DatabaseService() {
      const svc = global.DatabaseService;
      if (!svc) Logger.log("⚠️ DatabaseService ainda não carregado.");
      return svc;
    },

    get RRTStockService() {
      const svc = global.RRTStockService;
      if (!svc) Logger.log("⚠️ RRTStockService ainda não carregado.");
      return svc;
    },

    get processarRRT_Web() {
      const svc = global.processarRRT_Web;
      if (!svc) Logger.log("⚠️ processarRRT_Web ainda não carregado.");
      return svc;
    }
  };

})(this);
