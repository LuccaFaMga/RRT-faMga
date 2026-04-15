#!/usr/bin/env node

/**
 * Script para gerar ícones PWA a partir da logo
 */

const fs = require('fs');
const path = require('path');

// Tentar usar sharp se disponível, senão usar solução alternativa
async function generateIcons() {
  try {
    // Tentar importar sharp
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      console.log('📦 Instalando sharp...');
      const { execSync } = require('child_process');
      execSync('npm install sharp --save', { cwd: __dirname, stdio: 'inherit' });
      sharp = require('sharp');
    }

    const iconsDir = path.join(__dirname, 'icons');
    const logoPath = path.join(iconsDir, 'logo-FA-semfundo.png');

    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo não encontrada em:', logoPath);
      process.exit(1);
    }

    console.log('🎨 Gerando ícones PWA...');

    const sizes = [
      { size: 192, name: 'icon-192x192.png' },
      { size: 512, name: 'icon-512x512.png' },
      { size: 96, name: 'icon-96x96.png' }
    ];

    for (const { size, name } of sizes) {
      const outputPath = path.join(iconsDir, name);
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(outputPath);
      console.log(`✅ Criado: ${name} (${size}x${size})`);
    }

    console.log('🎉 Ícones gerados com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error.message);
    process.exit(1);
  }
}

generateIcons();
