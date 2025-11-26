/*******************************************************************
 * RRT_Config.gs — Módulo Oficial de Configurações e Logs (v1.4)
 * - LogApp otimizado
 * - CONFIG congelado e validado
 * - Estrutura de URLs reorganizada
 *******************************************************************/

// ----------------------------------------------------------
// LOG SYSTEM — Melhorado
// ----------------------------------------------------------
const LogApp = (() => {
  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4 };
  const LEVEL_NAMES = Object.keys(LEVELS).reduce((acc, k) => {
    acc[LEVELS[k]] = k;
    return acc;
  }, {});

  const CURRENT_LEVEL = 1; // INFO

  function log(message, level = LEVELS.INFO) {
    try {
      if (level < CURRENT_LEVEL) return;

      const now = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm:ss"
      );

      const prefix = LEVEL_NAMES[level] || "INFO";

      Logger.log(`[${now}][${prefix}] ${message}`);

      // Envia e-mail automático se CRITICAL (quando configurado)
      if (level === LEVELS.CRITICAL) {
        const errorEmail =
          (CONFIG && CONFIG.EMAIL && CONFIG.EMAIL.ERROS) ||
          CONFIG.EMAIL_ERROS;

        if (errorEmail) {
          MailApp.sendEmail({
            to: errorEmail,
            subject: "⚠️ ERRO CRÍTICO – Sistema RRT",
            htmlBody: `<p><b>Nível:</b> CRITICAL</p><p><b>Mensagem:</b> ${message}</p>`
          });
        } else {
          Logger.log("⚠️ ERRO CRÍTICO sem destinatário configurado.");
        }
      }

    } catch (e) {
      Logger.log("LogApp internal error: " + e);
    }
  }

  return { LEVELS, log };
})();


// ----------------------------------------------------------
// CONFIGURAÇÕES GERAIS DO SISTEMA
// ----------------------------------------------------------
const CONFIG_VALUES = {
  // Planilhas e pastas
  IDS: {
    RRT_SPREADSHEET: "1OgUSZSCBh54DUfuy8nvUYB2QZ2IR2o3UjUdnU2Gwj3E",
    TEMPLATE_RELATORIO: "1yYOJC8yHLXaLGb8xhH-CiRjoc1NsFHZ7nP4fuifByZw",
    TEMPLATE_FOTOS: "1aWOouZVyxxJxcbNLyA8H-THMNGe9bq6j7T4KhIi-Ig8",
    OUTPUT_FOLDER: "1kFYjgACWaHMchJfIidz-0Jl05nYC4t7E",
    PASTA_PDFS:    "1kFYjgACWaHMchJfIidz-0Jl05nYC4t7E", // mesma pasta de saída
    LOGO_FILE:     "1zsumH2NZQzm-Hb3VtJfWm2Kr5bSov2xz"
  },

  // E-mails
  EMAIL: {
    SUPERVISOR: "luccafa01@outlook.com",
    ERROS:      "rrtlogsfa@outlook.com",
    COMPRAS:    "luccafa01@outlook.com",
    SENDER_NAME: "Sistema de Revisão de Tecidos - 3W Lamfer",
    SUPERVISOR_NOME: "Mateus Camargo Pereira da Silva"
  },

  // URLs centrais
  URL: {
    SUPERVISOR_APP: "https://script.google.com/macros/s/AKfycbxGQ1Ubm0dDY0D56cZLsbvOVg3fpuV138haKP3P3f0CXFcBlbcgW3wegMW-63Q86Fgh/exec",
    APPROVAL_FORM_BASE: "https://docs.google.com/forms/d/e/1FAIpQLScZZX.../viewform?usp=pp_url"
  },

  // Prefill do Google Forms
  FORMS: {
    ENTRY_ROLO: "entry.817202283",
    ENTRY_SUP:  "entry.445468771",
    ENTRY_DEC:  "entry.2142081778"
  },

  GENERATE_ID: true
};

// ----------------------------------------------------------
// Alias para manter compatibilidade com código legado
// ----------------------------------------------------------
CONFIG_VALUES.RRT_SPREADSHEET_ID = CONFIG_VALUES.IDS.RRT_SPREADSHEET;
CONFIG_VALUES.TEMPLATE_RELATORIO_ID = CONFIG_VALUES.IDS.TEMPLATE_RELATORIO;
CONFIG_VALUES.TEMPLATE_FOTOS_ID = CONFIG_VALUES.IDS.TEMPLATE_FOTOS;
CONFIG_VALUES.OUTPUT_FOLDER_ID = CONFIG_VALUES.IDS.OUTPUT_FOLDER;
CONFIG_VALUES.LOGO_FILE_ID = CONFIG_VALUES.IDS.LOGO_FILE;

CONFIG_VALUES.EMAIL_SUPERVISOR = CONFIG_VALUES.EMAIL.SUPERVISOR;
CONFIG_VALUES.EMAIL_ERROS = CONFIG_VALUES.EMAIL.ERROS;
CONFIG_VALUES.EMAIL_COMPRAS = CONFIG_VALUES.EMAIL.COMPRAS;
CONFIG_VALUES.SUPERVISOR_NOME = CONFIG_VALUES.EMAIL.SUPERVISOR_NOME;
CONFIG_VALUES.SENDER_NAME = CONFIG_VALUES.EMAIL.SENDER_NAME;

const CONFIG = Object.freeze(CONFIG_VALUES);


// ----------------------------------------------------------
// VALIDADOR OPCIONAL DE CONFIG
// ----------------------------------------------------------
function validateConfig() {
  try {
    const required = [
      CONFIG.IDS.RRT_SPREADSHEET,
      CONFIG.EMAIL.ERROS,
      CONFIG.URL.SUPERVISOR_APP
    ];

    required.forEach((item, i) => {
      if (!item || typeof item !== "string") {
        throw new Error("CONFIG inválido na chave index " + i);
      }
    });

    LogApp.log("CONFIG validado com sucesso.", LogApp.LEVELS.INFO);
  } catch (e) {
    LogApp.log("ERRO ao validar CONFIG: " + e.message, LogApp.LEVELS.CRITICAL);
  }
}
