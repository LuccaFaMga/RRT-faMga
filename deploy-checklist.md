# ✅ Checklist Deploy GitHub Pages

## 📋 Estrutura Corrigida

### ✅ Arquivos Prontos
- [x] `index-redirect.html` - Redirecionamento principal
- [x] `ui/index.html` - App principal (caminhos corrigidos)
- [x] `ui/estoque.html` - Gestão de estoque
- [x] `ui/reviewer.html` - Revisão de tecidos
- [x] `ui/backend-shim.js` - Conexão com GAS
- [x] `ui/manifest.json` - PWA manifest
- [x] `ui/service-worker.js` - Cache offline
- [x] `.claspignore` - Excluindo `/ui` do deploy GAS

### 🔧 Configurações Aplicadas
- [x] Caminhos relativos corrigidos (`./` em vez de `../`)
- [x] Service Worker com cache offline
- [x] PWA manifest para instalação no celular
- [x] CORS test script pronto

## 🚀 Passos para Deploy

### 1. Commit das Mudanças
```bash
git add .
git commit -m "feat: corrigir estrutura para GitHub Pages"
git push origin main
```

### 2. Configurar GitHub Pages
1. Ir em: **GitHub > Settings > Pages**
2. Source: `Deploy from a branch`
3. Branch: `main`
4. Folder: `/ (root)`
5. Salvar

### 3. URL Final
```
https://luccafamga.github.io/RRT-faMga/
```

## 🧪 Testes Necessários

### Teste 1: Redirecionamento
- Acessar: `https://luccafamga.github.io/RRT-faMga/`
- ✅ Deve redirecionar para `/ui/index.html`

### Teste 2: CORS Backend
- Abrir: `https://luccafamga.github.io/RRT-faMga/test-cors-simple.html`
- ✅ Deve conectar com GAS sem erros

### Teste 3: Funcionalidades
- Testar criação de RRT
- Testar gestão de estoque
- Verificar console para erros

## 📱 PWA Features

### Instalação no Celular
- ✅ Manifest configurado
- ✅ Service Worker ativo
- ✅ Ícones PWA prontos
- ✅ Theme color definido

## 🔍 Troubleshooting

### Se CORS falhar:
1. Verificar se GAS está publicado como "Anyone, even anonymous"
2. Confirmar headers CORS em `App.js`
3. Testar com `test-cors-simple.html`

### Se páginas não carregarem:
1. Verificar caminhos dos assets
2. Confirmar que todos os arquivos estão em `/ui`
3. Checar console para 404s

### Se PWA não instalar:
1. Verificar `manifest.json`
2. Confirmar service worker registration
3. Testar em HTTPS (GitHub Pages já é)
