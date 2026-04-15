#!/usr/bin/env pwsh
# quick-deploy.ps1 - Deploy rápido em 3 passos

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  🚀 DEPLOY RÁPIDO: UI + Backend Separados" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Passo 1
Write-Host "📍 PASSO 1: Commitando mudanças locais..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "git add ." -ForegroundColor Magenta
git add .

Write-Host ""
Write-Host "git commit -m 'fix: UI em GitHub Pages + CORS no GAS'" -ForegroundColor Magenta
git commit -m "fix: UI em GitHub Pages + CORS no GAS"

Write-Host ""
Write-Host "✅ Mudanças comitadas!" -ForegroundColor Green
Write-Host ""

# Passo 2
Write-Host "📍 PASSO 2: Push para GitHub..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "git push origin main" -ForegroundColor Magenta
git push origin main

Write-Host ""
Write-Host "✅ Enviado para GitHub!" -ForegroundColor Green
Write-Host ""

# Passo 3
Write-Host "📍 PASSO 3: Deploy do GAS (Seu Apps Script)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host ""
Write-Host "⚠️  MANUAL: Abra o Google Apps Script e:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Abra: https://script.google.com/home" -ForegroundColor Cyan
Write-Host "2. Clique no projeto 'RRT-faMga'" -ForegroundColor Cyan
Write-Host "3. Clique 'Deploy' (ícone no topo)" -ForegroundColor Cyan
Write-Host "4. Escolha 'New Deployment'" -ForegroundColor Cyan
Write-Host "5. Type: 'Web app'" -ForegroundColor Cyan
Write-Host "6. Execute as: seu email" -ForegroundColor Cyan
Write-Host "7. Quem tem acesso: 'Anyone, even anonymous'" -ForegroundColor Cyan
Write-Host "8. Clique 'Deploy'" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 OU pelo terminal (se tiver clasp):" -ForegroundColor Cyan
Write-Host ""
Write-Host "clasp version 'CORS headers para GitHub Pages UI'" -ForegroundColor Magenta
Write-Host "clasp deployments" -ForegroundColor Magenta
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✨ APÓS TUDO ISSO, TESTE:" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 URL: https://luccafamga.github.io/RRT-faMga/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deve:" -ForegroundColor White
Write-Host "  ✅ Redirecionar para /ui/index.html" -ForegroundColor Green
Write-Host "  ✅ Carregar a página sem erros" -ForegroundColor Green
Write-Host "  ✅ F12 → Console → nenhum erro CORS" -ForegroundColor Green
Write-Host "  ✅ Tentar uma ação que chame backend" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 Pronto!" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
