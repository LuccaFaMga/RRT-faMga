/* ============================================================
 * Config.gs — Versão Produção (Ultra Clean) — v3.0 (Secure)
 * Credenciais migradas para PropertiesService para segurança.
 * ============================================================ */

/* -------------------------------------------------------------
 * CARREGAMENTO SEGURO DE CONFIGURAÇÃO
 * ----------------------------------------------------------- */
function loadConfigFromProperties() {
    const props = PropertiesService.getScriptProperties();
    
    // Valores padrão (apenas para desenvolvimento - NÃO usar em produção)
    const defaults = {
        // Email
        EMAIL_COMPRAS: "quantumindchanel@gmail.com",
        EMAIL_ADMIN: "rrtlogsfa@outlook.com",
        EMAIL_SUPERVISOR: "quantumindchanel@gmail.com",
        SENDER_NAME: "Sistema de Revisão de Tecidos - Fa Maringa",
        
        // Pessoas
        SUPERVISOR_NOME: "Mateus Camargo Pereira da Silva",
        
        // URLs
        SUPERVISOR_APP_URL: "https://script.google.com/macros/s/AKfycbxuml0qIiuRVDJKMxk0RnwgfWytor6Dz7aJ9c56Yze2sAiiHGOkjqo1MmaQJ_Fy4NG5/exec",
        APPROVAL_FORM_BASE: "https://docs.google.com/forms/d/e/1FAIpQLScZZX.../viewform?usp=pp_url",
        
        // Drive IDs
        TEMPLATE_RELATORIO_ID: "1yYOJC8yHLXaLGb8xhH-CiRjoc1NsFHZ7nP4fuifByZw",
        TEMPLATE_FOTOS_ID: "1yYOJC8yHLXaLGb8xhH-CiRjoc1NsFHZ7nP4fuifByZw",
        OUTPUT_FOLDER_ID: "1kFYjgACWaHMchJfIidz-0Jl05nYC4t7E",
        LOGO_FILE_ID: "10fbU-7wBE7dlu-1RzdIbendCaCMEgltf",
        SHEET_ID: "1OgUSZSCBh54DUfuy8nvUYB2QZ2IR2o3UjUdnU2Gwj3E",
        
        // Forms
        FORM_ENTRY_ROLO: "entry.817202283",
        FORM_ENTRY_SUP: "entry.445468771",
        FORM_ENTRY_DEC: "entry.2142081778",
        
        // Settings
        LOG_EXTREMO: "true",
        GENERATE_ID: "true",
        SECRET_KEY: Utilities.getUuid() // Gera chave única por
    };
    
    // Carrega de PropertiesService ou usa defaults
    const config = {};
    Object.keys(defaults).forEach(key => {
        const value = props.getProperty(key);
        config[key] = value !== null ? value : defaults[key];
    });
    
    // Converte strings para tipos apropriados
    config.LOG_EXTREMO = config.LOG_EXTREMO === "true";
    config.GENERATE_ID = config.GENERATE_ID === "true";
    
    return config;
}

const CONFIG_VALUES = {
    /* 2. LOGS */
    LOG_EXTREMO: loadConfigFromProperties().LOG_EXTREMO,

    /* 3. E-MAIL */
    EMAIL: {
        COMPRAS: loadConfigFromProperties().EMAIL_COMPRAS,
        ADMIN: loadConfigFromProperties().EMAIL_ADMIN,
        SUPERVISOR: loadConfigFromProperties().EMAIL_SUPERVISOR,
        SENDER_NAME: loadConfigFromProperties().SENDER_NAME
    },

    SUPERVISOR_NOME: loadConfigFromProperties().SUPERVISOR_NOME,

    /* 4. URLs da WebApp */
    URL: {
        SUPERVISOR_APP: loadConfigFromProperties().SUPERVISOR_APP_URL,
        APPROVAL_FORM_BASE: loadConfigFromProperties().APPROVAL_FORM_BASE
    },

    /* 5. Arquivos / Drive */
    IDS: {
        TEMPLATE_RELATORIO: loadConfigFromProperties().TEMPLATE_RELATORIO_ID,
        TEMPLATE_FOTOS: loadConfigFromProperties().TEMPLATE_FOTOS_ID,
        OUTPUT_FOLDER: loadConfigFromProperties().OUTPUT_FOLDER_ID,
        PASTA_PDFS: null, // alias, será definido abaixo
        PASTA_RRT: null, // alias, será definido abaixo
        LOGO_FILE: loadConfigFromProperties().LOGO_FILE_ID,
        SHEET_ID: loadConfigFromProperties().SHEET_ID
    },

    /* 6. Formulários */
    FORMS: {
        ENTRY_ROLO: loadConfigFromProperties().FORM_ENTRY_ROLO,
        ENTRY_SUP: loadConfigFromProperties().FORM_ENTRY_SUP,
        ENTRY_DEC: loadConfigFromProperties().FORM_ENTRY_DEC
    },

    GENERATE_ID: loadConfigFromProperties().GENERATE_ID,
    SECRET_KEY: loadConfigFromProperties().SECRET_KEY
};

/* -------------------------------------------------------------
 * ALIASES (Legado / Compatibilidade)
 * ----------------------------------------------------------- */
CONFIG_VALUES.IDS.PASTA_PDFS = CONFIG_VALUES.IDS.OUTPUT_FOLDER;
CONFIG_VALUES.IDS.PASTA_RRT = CONFIG_VALUES.IDS.OUTPUT_FOLDER;

CONFIG_VALUES.TEMPLATE_RELATORIO_ID = CONFIG_VALUES.IDS.TEMPLATE_RELATORIO;
CONFIG_VALUES.TEMPLATE_FOTOS_ID = CONFIG_VALUES.IDS.TEMPLATE_FOTOS;
CONFIG_VALUES.OUTPUT_FOLDER_ID = CONFIG_VALUES.IDS.OUTPUT_FOLDER;
CONFIG_VALUES.LOGO_FILE_ID = CONFIG_VALUES.IDS.LOGO_FILE;

CONFIG_VALUES.EMAIL_SUPERVISOR = CONFIG_VALUES.EMAIL.SUPERVISOR;
CONFIG_VALUES.EMAIL_ERROS = CONFIG_VALUES.EMAIL.ADMIN;
CONFIG_VALUES.EMAIL_COMPRAS = CONFIG_VALUES.EMAIL.COMPRAS;
CONFIG_VALUES.SENDER_NAME = CONFIG_VALUES.EMAIL.SENDER_NAME;

/* -------------------------------------------------------------
 * CONFIG FINAL (protegido)
 * ----------------------------------------------------------- */
const CONFIG = Object.freeze(CONFIG_VALUES);


/* -----------------------------------------------------------------------
 * LOG SYSTEM (LogApp) — SISTEMA UNIFICADO E SEGURO
 * 
 * CORREÇÃO: Consolidado em um único lugar para evitar redefinições.
 * Todas as referências a LogApp devem usar esta instância global.
 * ----------------------------------------------------------------------- */
const LogApp = (() => {
    // 🔧 Definição de níveis de log
    const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4 };
    const LEVEL_NAMES = Object.keys(LEVELS).reduce((a, k) => ((a[LEVELS[k]] = k), a), {});
    const CURRENT_LEVEL = 1; // INFO — ajuste para DEBUG (0) se precisar de logs mais verbosos

    function log(message, level = LEVELS.INFO) {
        try {
            // 🛑 FILTRO: Ignora mensagens abaixo do nível configurado
            if (level < CURRENT_LEVEL) return;
            
            // 🕐 Obtém timestamp com timezone
            let timeZone = "GMT";
            try {
                timeZone = Session.getScriptTimeZone();
            } catch (e) {
                // Fallback seguro se Session não estiver disponível
            }

            const now = Utilities.formatDate(
                new Date(),
                timeZone,
                "yyyy-MM-dd HH:mm:ss"
            );

            const levelName = LEVEL_NAMES[level] || "INFO";
            const logMessage = `[${now}][${levelName}] ${message}`;
            
            // 📋 Saída padrão para o Apps Script Logger
            Logger.log(logMessage);

            // 📧 COMPORTAMENTO ESPECIAL PARA ERROS CRÍTICOS
            // Envia email ao admin apenas para CRITICAL (atuado nível 4)
            if (level === LEVELS.CRITICAL) {
                try {
                    // Verifica se CONFIG está definido (pode não estar em alguns contextos)
                    if (typeof CONFIG !== "undefined" && CONFIG.EMAIL && CONFIG.EMAIL.ADMIN) {
                        const admin = CONFIG.EMAIL.ADMIN;
                        MailApp.sendEmail(
                            admin,
                            "⚠️ ERRO CRÍTICO – Sistema RRT",
                            logMessage
                        );
                    }
                } catch (mailError) {
                    // Se o email falhar, registra a falha mas não quebra o processo
                    Logger.log(`[AVISO] Falha ao enviar email crítico: ${mailError.message}`);
                }
            }
        } catch (e) {
            // 🛑 FALLBACK FINAL: Qualquer erro no LogApp é tratado isoladamente
            Logger.log(`[ERRO-LogApp] ${e.message}`);
        }
    }

    // 📤 Retorna interface pública do LogApp
    return { 
        LEVELS,  // Objeto com níveis: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4 }
        log      // Função log(message, level)
    };
})();

// 🔗 EXPOSIÇÃO GLOBAL (obrigatória para que todos os arquivos acessem LogApp)
globalThis.LogApp = LogApp;

/* -----------------------------------------------------------------------
 * VALIDADOR DE CONFIG
 * Verifica se todas as configurações obrigatórias estão presentes
 * ----------------------------------------------------------------------- */
function validateConfig() {
    try {
        // 🔍 Lista de campos obrigatórios
        const required = [
            { name: 'EMAIL_ADMIN', value: CONFIG.EMAIL.ADMIN },
            { name: 'EMAIL_COMPRAS', value: CONFIG.EMAIL.COMPRAS },
            { name: 'SUPERVISOR_APP_URL', value: CONFIG.URL.SUPERVISOR_APP }
        ];

        // 🚫 Detecta placeholders comuns (valores de exemplo)
        const placeholders = [
            "seu-projeto-firebase-aqui",
            "compras@suaempresa.com.br",
            "admin@suaempresa.com.br",
            "COLE_AQUI_A_URL_DO_DEPLOY_DA_WEB_APP",
            "1ph_-oJD13u-dA5pQftBm_wD4xtCtPopN9aLgvcdoVO1pNRKkZ-bU7ka8"
        ];

        // ✅ Valida cada campo
        for (const field of required) {
            if (!field.value || typeof field.value !== "string" || field.value.trim() === "") {
                throw new Error(`CONFIG INVÁLIDA: Campo obrigatório '${field.name}' está vazio.`);
            }
            
            if (placeholders.includes(field.value)) {
                LogApp.log(
                    `⚠️ AVISO: O valor '${field.name}' ainda é um placeholder. Atualize em Config.js`,
                    LogApp.LEVELS.WARN
                );
            }
        }

        LogApp.log("✅ CONFIG validado com sucesso.", LogApp.LEVELS.INFO);
        return true;
    } catch (e) {
        LogApp.log(`🔥 ERRO ao validar CONFIG: ${e.message}`, LogApp.LEVELS.CRITICAL);
        return false;
    }
}