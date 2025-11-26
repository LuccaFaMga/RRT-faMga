# Projeto RRT (Revisão de Rolos de Tecido)

Este repositório contém o código-fonte para o Sistema de Revisão de Tecidos (RRT), uma solução completa implementada em Google Apps Script para automação do processo de inspeção e gerenciamento de qualidade de rolos de tecido.

## 📘 Descrição

O RRT é um sistema de fluxo de trabalho que automatiza a coleta de dados, o processamento de imagens, a geração de documentos formais (ABNT) e o fluxo de aprovação entre os setores de Qualidade e Compras.

O sistema se integra nativamente ao ecossistema do Google (Sheets, Docs, Drive e Forms).

## 🚀 Funcionalidades Principais

- **Coleta de Dados**: Entrada de defeitos e dados técnicos via Google Forms
- **Processamento de Imagens**: Suporte a fotos Base64 e Upload. Formatação automática (320px, bordas finas, grade 2 por linha) e legendagem ABNT
- **Geração de Documentos**: Criação automática de Relatório Oficial e Anexo Fotográfico (ambos DOCX → PDF)
- **Fluxo de Aprovação**: Gestão do workflow Revisor → Supervisor → Compras com notificação por e-mail e re-edição de relatórios

## 📂 Estrutura do Projeto

O código-fonte do Google Apps Script está organizado em módulos:
```
/RRT (Arquivos .gs no ambiente Apps Script)
├── RRT_Main.gs             # Função de entrada/trigger principal
├── RRT_Config.gs           # Configurações de IDs e emails
├── RRT_DocumentService.gs  # Geração e montagem dos documentos
├── RRT_EmailService.gs     # Serviço de envio de emails
├── RRT_ApprovalFlow.gs     # Lógica do fluxo de aprovação
├── RRT_PhotoTools.gs       # Manipulação e formatação de fotos
└── RRT_Router.gs           # Direcionamento de requisições web (Supervisor)
```

### Recursos Necessários no Google Drive
```
/Templates
├── Relatorio_Template (Google Docs)
└── Fotos_Template (Google Docs)
```

## ⚙️ Configuração (Variáveis Essenciais)

O sistema deve ser configurado no arquivo `RRT_Config.gs` preenchendo as IDs e emails necessários:
```javascript
const CONFIG = {
  RRT_SPREADSHEET_ID: "...",
  TEMPLATE_RELATORIO_ID: "...",
  TEMPLATE_FOTOS_ID: "...",
  OUTPUT_FOLDER_ID: "...",
  PASTA_PDFS_ID: "...",
  LOGO_FILE_ID: "...",
  EMAIL_SUPERVISOR: "supervisor@dominio.com",
  EMAIL_COMPRAS: "compras@dominio.com",
  SUPERVISOR_APP_URL: "...",
  APPROVAL_FORM_BASE: "...",
  GENERATE_ID: true 
};
```

## 🚀 Como Implantar

1. **Configurar Arquivos**: Crie os arquivos `Planilha`, `Formulário`, `Templates` e as `Pastas` no Google Drive
2. **Copiar Código**: Copie o código de cada arquivo `.gs` para o ambiente Google Apps Script associado à Planilha de Dados
3. **Configurar IDs**: Preencha os valores na variável `CONFIG` dentro do arquivo `RRT_Config.gs`
4. **Publicar**: Publique o script como um Web App (para o `RRT_Router.gs` funcionar) e configure o `Trigger` de envio do formulário

## 🧪 Testes Recomendados

Para garantir o funcionamento correto:

- Envio com fotos via Base64 e Upload
- Fluxo completo de reprovação e atualização de dados
- Validação da formatação ABNT (fotos e tabelas)
- Verificação do envio final do PDF para o setor de Compras

## 📘 Licença

Uso interno – Fa Maringa

---

**Desenvolvido com ❤️ pela equipe de Qualidade 3W Fa Maringa**