#!/usr/bin/env node

/**
 * Script para instalar Playwright e suas dependências
 * Execute: node install-playwright.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Instalando Playwright para geração de PDF...\n');

try {
  // 1. Instalar Playwright
  console.log('📦 Instalando Playwright...');
  execSync('npm install playwright', { stdio: 'inherit' });
  
  // 2. Instalar browsers do Playwright
  console.log('\n🌐 Instalando browsers do Playwright...');
  execSync('npx playwright install chromium', { stdio: 'inherit' });
  
  // Opcional: instalar Firefox também
  try {
    execSync('npx playwright install firefox', { stdio: 'inherit' });
    console.log('✅ Firefox instalado com sucesso');
  } catch (error) {
    console.log('⚠️ Firefox não pôde ser instalado (opcional)');
  }
  
  // 3. Verificar se package.json existe e atualizar
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Adicionar script de instalação de browsers
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    packageJson.scripts['install-browsers'] = 'playwright install chromium firefox';
    packageJson.scripts['pdf-test'] = 'node -e "console.log(\'Testing PDF generation...\'); require(\'./server/improved-pdf-service.ts\')"';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Scripts adicionados ao package.json');
  }
  
  // 4. Criar arquivo de teste
  const testContent = `
// Teste rápido do Playwright
const { chromium } = require('playwright');

async function testPlaywright() {
  console.log('🧪 Testando Playwright...');
  
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent('<h1>Teste PDF</h1><p>Playwright funcionando!</p>');
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    });
    
    await browser.close();
    
    console.log('✅ Playwright está funcionando corretamente!');
    console.log(\`📄 PDF gerado com \${pdf.length} bytes\`);
    
    return true;
  } catch (error) {
    console.error('❌ Erro no teste do Playwright:', error.message);
    return false;
  }
}

if (require.main === module) {
  testPlaywright();
}

module.exports = { testPlaywright };
`;
  
  fs.writeFileSync('test-playwright.js', testContent);
  console.log('✅ Arquivo de teste criado: test-playwright.js');
  
  console.log('\n🎉 Instalação concluída com sucesso!');
  console.log('\n📋 Próximos passos:');
  console.log('1. Execute: node test-playwright.js (para testar)');
  console.log('2. Substitua PDFService por ImprovedPDFService no seu código');
  console.log('3. Reinicie o servidor');
  
} catch (error) {
  console.error('❌ Erro durante a instalação:', error.message);
  console.log('\n🔧 Soluções alternativas:');
  console.log('1. Execute manualmente: npm install playwright');
  console.log('2. Execute manualmente: npx playwright install chromium');
  console.log('3. Verifique se tem permissões de administrador');
  process.exit(1);
}