#!/bin/bash
# validate-setup.sh - Validar configuração Opção A

echo "🔍 Validando configuração Opção A (UI + Backend separados)..."
echo ""

# 1. Verificar .claspignore
echo "1️⃣  Checando .claspignore..."
if grep -q "ui/\*\*" .claspignore; then
  echo "✅ ui/** está excluído do GAS"
else
  echo "❌ ui/** NÃO está excluído"
fi

# 2. Verificar index.html
echo ""
echo "2️⃣  Checando index.html..."
if grep -q "ui/index.html" index.html; then
  echo "✅ index.html redireciona para ui/index.html"
else
  echo "❌ Redirecionamento não encontrado"
fi

# 3. Verificar CORS em App.js
echo ""
echo "3️⃣  Checando CORS em App.js..."
if grep -q "Access-Control-Allow-Origin" App/App.js; then
  echo "✅ CORS headers detectados em App.js"
  grep -c "Access-Control-Allow-Origin" App/App.js | xargs echo "   Encontradas N ocorrências:"
else
  echo "❌ CORS headers NÃO encontrados"
fi

# 4. Verificar backend-shim.js
echo ""
echo "4️⃣  Checando backend-shim.js na UI..."
if [ -f "ui/backend-shim.js" ]; then
  echo "✅ backend-shim.js existe"
  if grep -q "BACKEND_API_URL" ui/backend-shim.js; then
    echo "✅ BACKEND_API_URL configurada"
  fi
else
  echo "❌ backend-shim.js não encontrado"
fi

# 5. Arquivos UI
echo ""
echo "5️⃣  Checando arquivos da UI..."
ui_files=("ui/index.html" "ui/estoque.html" "ui/reviewer.html")
for file in "${ui_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file FALTANDO"
  fi
done

# 6. Resumo
echo ""
echo "=================="
echo "Próximos passos:"
echo "=================="
echo "1. Em Google Apps Script (clasp):"
echo "   → Criar nova versão"
echo "   → Publicar como novo deploy"
echo ""
echo "2. Em GitHub:"
echo "   git push origin main"
echo ""
echo "3. Em GitHub Pages Settings:"
echo "   → Source: main branch, / (root)"
echo ""
echo "4. Testar:"
echo "   → https://luccafamga.github.io/RRT-faMga/"
echo ""
echo "✨ Pronto para deploy!"
