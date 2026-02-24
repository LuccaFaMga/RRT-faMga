# RRT - Sistema de Revisão de Rolos de Tecido

Solução completa para automação do processo de inspeção, gerenciamento de qualidade e fluxo de aprovação de rolos de tecido, implementada em **Google Apps Script** com arquitetura moderna baseada em **Controllers, Services e Routers**.

## 📋 Visão Geral

O RRT automatiza o pipeline completo de revisão de tecidos:

- **Coleta**: Entrada de dados técnicos e defeitos estruturados
- **Análise**: Dashboard com cálculos de pontuação e métricas em tempo real
- **Aprovação**: Workflow multi-stage (Revisor → Supervisor → Compras)
- **Armazenamento**: Integração nativa com Google Sheets e Cloud Storage
- **Offline**: Suporte a modo offline com sincronização automática

## 🚀 Funcionalidades Principais

| Recurso                          | Descrição                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| **Dashboard Estoque**      | Visualização em tempo real com gráficos, filtros avançados e cálculos de performance |
| **Revisor de Dados**       | Interface para revisão, invalidação e atualização de registros com histórico        |
| **Sistema de Pontuação** | Cálculo automático baseado em tipo de tecido (PLANO/MALHA), material e defeitos         |
| **Canonização de Dados** | Pipeline de normalização robusta com 3 níveis de transformação                       |
| **Service Worker**         | Caching inteligente (LRU), offline-first e sincronização em background                  |
| **Lazy-Loading**           | Otimização de Chart.js e recursos pesados para máxima velocidade inicial               |
| **Memoização**           | Cache de cálculos complexos (50x speedup em operações repetidas)                       |

## 📂 Estrutura do Projeto

```
RRT/
├── appsscript.json              # Manifesto do Google Apps Script
├── service-worker.js            # Service Worker v3 (caching LRU, offline-sync)
├── offline-manager.js           # Gerenciador de fila offline e sincronização
│
├── App/
│   └── App.js                   # Orquestrador principal (canonização, processamento)
│
├── ui/
│   ├── index.html               # Landing page / Login
│   ├── estoque.html             # Dashboard com gráficos, filtros e métricas
│   └── reviewer.html            # Interface de revisão e invalidação
│
├── controllers/
│   ├── ComprasController.js     # Lógica do fluxo Compras
│   ├── EstoqueController.js     # Lógica do estoque e dashboards
│   └── SupervisorController.js  # Lógica de supervisão e aprovações
│
├── services/
│   ├── CoreService.js           # Serviço central de dados e regras
│   ├── DatabaseService.js       # Acesso a Google Sheets (índices, caching)
│   ├── DocumentService.js       # Geração de relatórios e documentos
│   ├── EmailService.js          # Notificações por email
│   ├── EstoqueService.js        # Cálculos de estoque e pontuação
│   ├── SheetsService.js         # Wrappers de leitura/escrita em Sheets
│   ├── ValidationService.js     # Validação de dados e regras de negócio
│   └── WorkflowService.js       # Orquestração de fluxos de aprovação
│
├── routers/
│   ├── ComprasRouter.js         # Endpoints do setor Compras
│   ├── EstoqueRouter.js         # Endpoints de estoque e dashboards
│   └── SupervisorRouter.js      # Endpoints de supervisão
│
├── core/
│   ├── Config.js                # Configurações e constantes
│   ├── ArithmeticUtils.js       # Utilitários matemáticos
│   └── KeyNormalizer.js         # Normalização de nomes de campos (snake_case)
│
└── 00services/
    └── DatabaseService.js       # Serviço de base de dados (espelho para compatibilidade)
```

## ⚙️ Arquitetura

### Pipeline de Canonização (3 Níveis)

```javascript
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 1: buildStructuredPayload()                       │
│ • Maps raw form data → structured canonical schema      │
│ • ID fallback chain: review_id || revision_id           │
│ • Dimension normalization: len→largura_cm, wid→metros   │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 2: normalizeQrPayload()                           │
│ • QR code data → internal field names                   │
│ • Structure validation (est_tc for PLANO/MALHA)         │
│ • Material code resolution                              │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 3: normalizeMainData()                            │
│ • Pipeline: normalizeKeysToSnakeCase() →                │
│   mapMetersAndWidth() → resolveFallbacks()              │
│ • Timestamp resolution with history (criado_em, etc)    │
│ • Type coercion and sanitization                        │
└─────────────────────────────────────────────────────────┘
```

### Caching Inteligente (Service Worker v3)

```javascript
CACHE_ASSETS        // Recursos estáticos (HTML, CSS, fonts)
CACHE_DYNAMIC       // Dados dinâmicos e respostas API
CACHE_IMAGES        // Imagens (cache separado)
└─ MAX_CACHE_ITEMS: 100 (LRU cleanup automático)
```

**Estratégias**:

- `cacheFirst`: Assets estáticos (app shell, fonts)
- `networkFirst`: Dados dinâmicos com fallback offline
- `cleanupCache()`: LRU automático, limite 100 itens por cache

### Otimizações de Performance

| Otimização              | Ganho          | Implementação                         |
| ------------------------- | -------------- | --------------------------------------- |
| Lazy-load Chart.js        | -150KB inicial | Injeção dinâmica de script on-demand |
| Score memoization         | 50x speedup    | Cache com TTL (8h) via timestamp        |
| IndexedDB + roloIndex Map | 64% faster     | Promise.all() parallelização          |
| LRU cache bounds          | Stável        | 300 max entries (3 stores × 100)       |

## 🔧 Configuração

Configure o arquivo `core/Config.js`:

```javascript
const CONFIG = {
  // Google Sheets
  SPREADSHEET_ID: "xxx",
  ESTOQUE_SHEET: "Dados",
  
  // Serviço
  SUPERVISOR_EMAIL: "supervisor@dominio.com",
  COMPRAS_EMAIL: "compras@dominio.com",
  
  // Aplicação
  APP_VERSION: "3.0.0-optimized",
  CACHE_VERSION: "fa-rrt-v3.0.0-optimized",
  LOG_LEVEL: "INFO"
};
```

## 🚀 Implantação

### Desenvolvimento Local

```bash
# Instalar clasp
npm install -g @google/clasp

# Clonar projeto
git clone <repo>
cd RRT

# Deploy
clasp push
```

### Publicação como Web App

1. Abra o projeto no Google Apps Script
2. **Novo deploy** → Execute como "seu-email@dominio.com"
3. Tipo: "Web App"
4. Acesso: "Qualquer pessoa"
5. Configure triggers de formulário se necessário

## 📊 Métricas de Performance

*Medições com Sprint 4 - Otimizações Implementadas*

| Métrica                     | Antes            | Depois      | Melhoria     |
| ---------------------------- | ---------------- | ----------- | ------------ |
| Carregamento dashboard       | 1800ms           | 500ms       | ⬇️ 72%     |
| Cálculo pontuação (1x)    | ~5ms             | ~5ms        | —           |
| Cálculo pontuação (cache) | ~5ms             | ~0.1ms      | ⬆️ 50x     |
| Tamanho cache inicial        | Ilimitado        | ~10-15MB    | LRU bounds   |
| Chart.js overhead            | 150KB bloqueante | Lazy-loaded | 0ms blocante |

## 🧪 Testes

### Casos Críticos

- Fluxo completo: Revisor → Supervisor → Compras
- Carregamento offline e sincronização on-demand
- Cálculos de pontuação (PLANO vs MALHA)
- Geração de relatórios formais
- Lazy-loading de gráficos em dashboards

### Validação

```javascript
// Verificar canonização
console.log("[CANONIZAÇÃO] Validando pipeline...");

// Verificar cache
console.log("[CACHE] Tamanho atual:", Object.keys(scoreCache).length);

// Verificar Service Worker
caches.keys().then(names => console.log("[SW] Caches:", names));
```

## 📚 Documentação Técnica

- **Canonização**: Veja comments em `App.js` linhas 594, 769, 845
- **Service Worker**: Veja `service-worker.js` linhas 57-130
- **Controllers**: Padrão MVC em `controllers/`
- **Serviços**: Camada de negócio em `services/`

## 🔐 Segurança

- ✅ XSS protection (Sprint 1)
- ✅ Validação de entrada (ValidationService)
- ✅ Sanitização de dados (KeyNormalizer)
- ✅ CORS headers em routers
- ✅ Offline queue com verificação de integridade

## 📦 Dependências

- **Google Apps Script**: Plataforma nativa
- **Chart.js**: Lazy-loaded (v4.4.0)
- **Google Sheets API**: Integrada via DatabaseService
- **IndexedDB**: Offline-first storage

## 📝 Histórico de Releases

### v3.0.0-optimized (Fevereiro 2026)

- ✅ Canonização documentada (3 níveis)
- ✅ Lazy-load Chart.js (-150KB inicial)
- ✅ Score memoization cache (50x speedup)
- ✅ Service Worker v3 com LRU (bounded memory)

### v2.0.0 (Sprint 1-3)

- Security hardening (XSS fixes)
- Code quality improvements (deduplication)
- Performance optimization (64% load time improvement)

## 👥 Equipe & Contato

**Desenvolvido pela equipe de Qualidade**
Fa Maringa 

---

**Status**: ✅ Produção | **Versão**: 3.0.0 | **Última atualização**: Fevereiro 2026
