# 🚀 Guia de Deploy: UI + Backend Separados

## ✅ Estrutura de Deploy (Opção A)

```
GitHub Pages (UI)
  https://luccafamga.github.io/RRT-faMga/
  └─ Arquivos do `/ui` + `/App/App.html` se necessário

Google Apps Script (Backend/API)
  https://script.google.com/macros/s/.../exec
  └─ Apenas funções serverless
```

---

## 📋 Checklist de Deployment

### 1. ✅ Backend (GAS) - JÁ CONFIGURADO
- [x] `App.js` com CORS headers adicionados
- [x] `doGet()`, `doPost()`, `doOptions()` com suporte CORS
- [x] GAS publicado como "Anyone, even anonymous"
- [x] Backend URL: `https://script.google.com/macros/s/AKfycbyUvvuE7vBILSUPl-pWoRO95KAa5wJ6ln0E_tboRxqBE3xeYDnVNC4lNj00PXPu5-VH/exec`

**TODO:** Deploy as mudanças no GAS:
```bash
clasp push
```

### 2. 🔄 Frontend (GitHub Pages) - EM PROGRESSO

#### Passo 1: Preparar arquivos para GitHub Pages
A pasta `/ui` já tem tudo pronto:
- [x] `ui/index.html` - Página Principal
- [x] `ui/estoque.html` - Estoque
- [x] `ui/reviewer.html` - Revisor
- [x] `ui/backend-shim.js` - Shim do Backend

#### Passo 2: Configurar Git para publicar

**Opção A: Publicar a raiz do repo (Recomendado)**
```bash
# Seu repositório já está em main
# GitHub Pages deve estar configurado para servir da raiz do repo
```

**Opção B: Usar pasta `/docs` (Alternativa)**
```bash
# 1. Copiar arquivos para /docs
mkdir -p docs
cp -r ui/* docs/
cp index.html docs/
cp manifest.json docs/
cp service-worker.js docs/
cp -r icons docs/

# 2. Fazer commit
git add docs/
git commit -m "docs: preparar para GitHub Pages"
git push

# 3. Em GitHub > Settings > Pages > Source: `/docs`
```

#### Passo 3: Publicar em GitHub Pages
```bash
git add .
git commit -m "chore: preparar UI para GitHub Pages"
git push origin main
```

Depois vá em: **GitHub > Configurações > Pages > Source**
- Selecione: `main` branch, raiz `/` 
- Salve

#### Passo 4: Testar a URL
```
https://luccafamga.github.io/RRT-faMga/
```

---

## 🧪 Testes de Validação

### Teste 1: Redirecionamento
1. Acesse: `https://luccafamga.github.io/RRT-faMga/`
2. ✅ Deve redirecionar para `/RRT-faMga/ui/index.html`

### Teste 2: Backend CORS
1. Abra `test-gas-cors.html` em um navegador
2. Verifique se:
   - ✅ CORS Headers estão presentes
   - ✅ GAS responde com status 200
   - ✅ Consegue fazer POST requests

### Teste 3: Features Funcionais
1. Abra `https://luccafamga.github.io/RRT-faMga/`
2. Tente uma ação que chame o backend (ex: criar RRT)
3. Verifique console (F12) para erros

---

## 🔧 Troubleshooting

### Problema: "Erro 404 ao acessar outras páginas"
**Causa:** GitHub Pages não encontra os arquivos
**Solução:** 
```bash
# Verifique se todos os arquivos estão em /ui:
ls -la ui/
# Deve ter: index.html, estoque.html, reviewer.html, backend-shim.js
```

### Problema: "CORS Bloqueado"
**Causa:** GAS não está enviando headers CORS
**Solução:** Confirme que `.addHeader()` está em `App.js`:
```javascript
.addHeader('Access-Control-Allow-Origin', '*')
```

### Problema: "README.md abrindo em vez de index.html"
**Causa:** `.claspignore` está incluindo o root como home
**Solução:** ✅ Já corrigido - `.claspignore` exclui `README.md`

---

## 📊 Configuração GitHub Pages Passo a Passo

### Se está usando raiz `/`
1. Va em: **GitHub > Settings > Pages**
2. Source: `Deploy from a branch`
3. Branch: `main`, Pasta: `/` (raiz)
4. Salve e aguarde ~2 minutos

### Validar
```bash
# Checar se está publicando
curl -I https://luccafamga.github.io/RRT-faMga/index.html
# Deve retornar: 200 OK
```

---

## 📝 Comandos Rápidos

```bash
# Deploy Completo
git add .
git commit -m "feat: UI + Backend com CORS"
git push origin main

# Deploy apenas GAS
clasp push

# Teste local (se tiver Python)
python -m http.server 8000
# Depois acesse: http://localhost:8000/RRT-faMga/ui/index.html
```

---

## ✨ Resumo das Mudanças

✅ `index.html` - Redirecionamento dinâmico (funciona em qualquer contexto)
✅ `App.js` - CORS headers em `doGet()`, `doPost()` e `doOptions()`
✅ `.claspignore` - Excluindo `/ui` (não vai para GAS)
✅ `test-gas-cors.html` - Script de teste para validar CORS

**Próximo passo:** Execute `clasp push` e teste!

