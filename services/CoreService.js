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
    
    "FURO": 4,  // ✅ Furos são considerados críticos
    "FURADO": 4,
    "PERFURADO": 4,
    
    "NENHUMA": 0,
    "SEM DEFEITO": 0,
    "OK": 0,

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
  // VALIDAÇÕES DE NORMAS ABNT
  // ============================================================
  function validateFurosLimit(defeitos, tipoTecido, pesoKg = 0, metros = 0) {
    const furos = defeitos.filter(d => 
      String(d.gravidade || '').toUpperCase() === 'FURO' || 
      String(d.tipo || '').toUpperCase().includes('FURO')
    );
    
    const furosCount = furos.length;
    let limite = 0;
    let unidade = '';
    
    if (tipoTecido === 'MALHA') {
      limite = 6; // Máximo 6 furos por 20kg
      unidade = 'por 20kg';
      // Se tiver peso, ajusta o limite proporcionalmente
      if (pesoKg > 0) {
        limite = Math.floor((pesoKg / 20) * 6);
      }
    } else {
      limite = 6; // Máximo 6 furos por 100m
      unidade = 'por 100m';
      // Se tiver metragem, ajusta o limite proporcionalmente
      if (metros > 0) {
        limite = Math.floor((metros / 100) * 6);
      }
    }
    
    return {
      furosCount,
      limite,
      unidade,
      excedido: furosCount > limite,
      mensagem: furosCount > limite 
        ? `⚠️ LIMITE DE FUROS EXCEDIDO: ${furosCount} furos (limite: ${limite} ${unidade})`
        : `✅ Furos dentro do limite: ${furosCount} (limite: ${limite} ${unidade})`
    };
  }
  
  function validatePontosPorMetro(defeitos, metros = 0) {
    if (metros <= 0) return { excedido: false, mensagem: 'Metragem insuficiente para validação' };
    
    // Conta pontos por metro linear
    const pontosPorMetro = {};
    defeitos.forEach(d => {
      const pontos = normalizeGravidade(d.gravidade);
      if (pontos > 0) {
        const metroInicio = Math.floor(parseFloat(d.metro_inicial || d.metroInicial || 0));
        const metroFim = Math.floor(parseFloat(d.metro_final || d.metroFinal || metroInicio));
        
        for (let m = metroInicio; m <= metroFim; m++) {
          pontosPorMetro[m] = (pontosPorMetro[m] || 0) + pontos;
        }
      }
    });
    
    const maxPontos = Math.max(...Object.values(pontosPorMetro), 0);
    const limite = 4; // 4 pontos por metro linear
    
    return {
      maxPontos,
      limite,
      excedido: maxPontos > limite,
      mensagem: maxPontos > limite
        ? `⚠️ LIMITE DE PONTOS/METRO EXCEDIDO: ${maxPontos} pontos (limite: ${limite} pontos/metro)`
        : `✅ Pontos por metro dentro do limite: ${maxPontos} (limite: ${limite} pontos/metro)`,
      detalhesPorMetro: pontosPorMetro
    };
  }
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
  // CÁLCULO PADRÃO (PLANO) - ATUALIZADO PARA USAR TIPO
  // ============================================================
  function calcularPontuacao(data) {
    // Usa a nova função que diferencia malha vs plano
    return calcularPontuacaoPorTipo(data);
  }

  // ============================================================
  // CÁLCULO POR TIPO DE TECIDO (NOVO — SEM QUEBRAR API)
  // ============================================================
  function calcularPontuacaoPorTipo(data) {
    const tipo = String(data?.tipo_tecido || 'PLANO').toUpperCase();
    const defeitos = Array.isArray(data?.defects)
      ? data.defects
      : (Array.isArray(data?.defeitos) ? data.defeitos : []);
    const totalPontosInformado = ArithmeticUtils.toNumber(data?.total_pontos || data?.pontos || 0, 1);
    
    if (tipo === 'MALHA') {
      // Para malha: usar peso em kg (data.peso_kg ou data.supplier_weight)
      const pesoKg = ArithmeticUtils.toNumber(data?.peso_kg || data?.supplier_weight || data?.wid || 0, 2);
      if (pesoKg <= 0) {
        return {
          totalPontos: 0,
          pontosPor100kg: 0,
          statusQualidadePontos: 'PESO INSUFICIENTE PARA CÁLCULO',
          tipo_tecido: 'MALHA',
          observacao: 'Sem peso registrado. Cálculo não possível.'
        };
      }

      const totalPontos = defeitos.length ? calculatePoints(defeitos) : totalPontosInformado;
      const pontosPor100kg = (totalPontos * 100) / pesoKg;
      const pontosPor100kgArredondado = ArithmeticUtils.roundABNT(pontosPor100kg, 3);

      // Validações específicas para malha
      const validacaoFuros = validateFurosLimit(defeitos, 'MALHA', pesoKg, 0);
      const validacaoPontosMetro = validatePontosPorMetro(defeitos, pesoKg * 10); // Estimativa: 1kg ≈ 10m de malha

      return {
        totalPontos,
        pontosPor100kg: pontosPor100kgArredondado,
        statusQualidadePontos: getQualityStatus(pontosPor100kgArredondado, 30), // Limite mais restritivo para malha
        tipo_tecido: 'MALHA',
        observacao: `Pontuação por peso: ${pontosPor100kgArredondado} pontos/100kg (Limite: 30). Decisão do supervisor.`,
        pesoKg: pesoKg,
        validacoes: {
          furos: validacaoFuros,
          pontosPorMetro: validacaoPontosMetro
        }
      };
    }

    // Para tecido plano: usar metragem em m² (padrão)
    const comprimento = ArithmeticUtils.toNumber(
      data?.metros_maquina ||
      data?.comprimento_revisado ||
      data?.metros_revisado ||
      data?.revised_meters ||
      data?.wid ||
      data?.metros_fornecedor ||
      0,
      3
    );
    const larguraCm = ArithmeticUtils.toNumber(data?.largura_cm || 0, 2);
    
    if (comprimento <= 0 || larguraCm <= 0) {
      return {
        totalPontos: 0,
        pontosPor100m2: 0,
        statusQualidadePontos: 'DIMENSÕES INSUFICIENTES PARA CÁLCULO',
        tipo_tecido: 'PLANO',
        observacao: 'Metragem ou largura não registrada. Cálculo não possível.'
      };
    }

    const totalPontos = defeitos.length ? calculatePoints(defeitos) : totalPontosInformado;
    const pontosPor100m2 = calculatePointsPer100m2(totalPontos, comprimento, larguraCm);

    // Validações específicas para plano
    const validacaoFuros = validateFurosLimit(defeitos, 'PLANO', 0, comprimento);
    const validacaoPontosMetro = validatePontosPorMetro(defeitos, comprimento);

    return {
      totalPontos,
      pontosPor100m2,
      statusQualidadePontos: getQualityStatus(pontosPor100m2, 35), // Limite padrão para plano
      tipo_tecido: 'PLANO',
      observacao: `Pontuação por área: ${pontosPor100m2} pontos/100m² (Limite: 35). Decisão do supervisor.`,
      metros: comprimento,
      larguraCm: larguraCm,
      validacoes: {
        furos: validacaoFuros,
        pontosPorMetro: validacaoPontosMetro
      }
    };
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
