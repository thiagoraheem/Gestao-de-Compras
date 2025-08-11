#!/usr/bin/env node

/**
 * 🔍 Script de Verificação do Ambiente Playwright
 * 
 * Este script verifica se o ambiente está configurado corretamente
 * para executar o Playwright em produção.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verificando ambiente para Playwright...\n');

const checks = [];
let allPassed = true;

// Função para executar comandos e capturar saída
function runCommand(command, description) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    checks.push({ status: '✅', description, details: output.trim() });
    return true;
  } catch (error) {
    checks.push({ status: '❌', description, details: error.message });
    allPassed = false;
    return false;
  }
}

// Função para verificar se arquivo/diretório existe
function checkPath(filePath, description) {
  const exists = fs.existsSync(filePath);
  checks.push({
    status: exists ? '✅' : '❌',
    description,
    details: exists ? `Encontrado: ${filePath}` : `Não encontrado: ${filePath}`
  });
  if (!exists) allPassed = false;
  return exists;
}

console.log('📋 Executando verificações...\n');

// 1. Verificar Node.js
runCommand('node --version', 'Node.js instalado');

// 2. Verificar npm
runCommand('npm --version', 'npm instalado');

// 3. Verificar se Playwright está instalado
const hasPlaywright = runCommand('npx playwright --version', 'Playwright instalado');

// 4. Verificar dependências do projeto
checkPath('./package.json', 'package.json existe');
checkPath('./node_modules', 'node_modules existe');

// 5. Verificar se browsers estão instalados (apenas se Playwright estiver instalado)
if (hasPlaywright) {
  // Verificar cache do Playwright
  const playwrightCache = process.env.PLAYWRIGHT_BROWSERS_PATH || 
    path.join(require('os').homedir(), '.cache', 'ms-playwright');
  
  checkPath(playwrightCache, 'Cache do Playwright existe');
  
  // Verificar browsers específicos
  const chromiumPath = path.join(playwrightCache, 'chromium-*');
  try {
    const chromiumDirs = execSync(`ls -d ${chromiumPath} 2>/dev/null || echo ""`, { encoding: 'utf8' });
    if (chromiumDirs.trim()) {
      checks.push({ status: '✅', description: 'Chromium instalado', details: chromiumDirs.trim() });
    } else {
      checks.push({ status: '❌', description: 'Chromium instalado', details: 'Não encontrado' });
      allPassed = false;
    }
  } catch (error) {
    // Para Windows, verificar de forma diferente
    try {
      const result = execSync('npx playwright install --dry-run chromium', { encoding: 'utf8' });
      if (result.includes('is already installed')) {
        checks.push({ status: '✅', description: 'Chromium instalado', details: 'Já instalado' });
      } else {
        checks.push({ status: '❌', description: 'Chromium instalado', details: 'Precisa ser instalado' });
        allPassed = false;
      }
    } catch (e) {
      checks.push({ status: '⚠️', description: 'Chromium instalado', details: 'Não foi possível verificar' });
    }
  }
}

// 6. Verificar memória disponível
try {
  const os = require('os');
  const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
  const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
  
  if (totalMem >= 2) {
    checks.push({ 
      status: '✅', 
      description: 'Memória suficiente', 
      details: `Total: ${totalMem}GB, Livre: ${freeMem}GB` 
    });
  } else {
    checks.push({ 
      status: '⚠️', 
      description: 'Memória limitada', 
      details: `Total: ${totalMem}GB (recomendado: 2GB+)` 
    });
  }
} catch (error) {
  checks.push({ status: '⚠️', description: 'Verificação de memória', details: 'Não foi possível verificar' });
}

// 7. Teste básico do Playwright (se instalado)
if (hasPlaywright) {
  console.log('🧪 Executando teste básico do Playwright...');
  try {
    const testScript = `
      const { chromium } = require('playwright');
      (async () => {
        try {
          const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          const page = await browser.newPage();
          await page.setContent('<h1>Teste de Verificação</h1><p>Playwright funcionando!</p>');
          const pdf = await page.pdf({ format: 'A4' });
          await browser.close();
          console.log('SUCCESS: PDF gerado com sucesso (' + pdf.length + ' bytes)');
        } catch (error) {
          console.error('ERROR:', error.message);
          process.exit(1);
        }
      })();
    `;
    
    const result = execSync(`node -e "${testScript.replace(/"/g, '\\"')}"`, { 
      encoding: 'utf8',
      timeout: 30000 
    });
    
    if (result.includes('SUCCESS')) {
      checks.push({ 
        status: '✅', 
        description: 'Teste de geração de PDF', 
        details: result.trim() 
      });
    } else {
      checks.push({ 
        status: '❌', 
        description: 'Teste de geração de PDF', 
        details: 'Falhou sem erro específico' 
      });
      allPassed = false;
    }
  } catch (error) {
    checks.push({ 
      status: '❌', 
      description: 'Teste de geração de PDF', 
      details: error.message 
    });
    allPassed = false;
  }
}

// 8. Verificar variáveis de ambiente importantes
const envVars = [
  'NODE_ENV',
  'PLAYWRIGHT_BROWSERS_PATH',
  'NODE_OPTIONS'
];

envVars.forEach(envVar => {
  const value = process.env[envVar];
  checks.push({
    status: value ? '✅' : '⚠️',
    description: `Variável ${envVar}`,
    details: value ? `${envVar}=${value}` : 'Não definida (opcional)'
  });
});

// Exibir resultados
console.log('\n📊 Resultados da Verificação:\n');
console.log('═'.repeat(80));

checks.forEach(check => {
  console.log(`${check.status} ${check.description}`);
  if (check.details) {
    console.log(`   ${check.details}`);
  }
  console.log('');
});

console.log('═'.repeat(80));

// Resumo final
if (allPassed) {
  console.log('🎉 SUCESSO: Ambiente está pronto para o Playwright!');
  console.log('✅ Todas as verificações passaram.');
} else {
  console.log('⚠️  ATENÇÃO: Algumas verificações falharam.');
  console.log('❌ Corrija os problemas antes de usar o Playwright em produção.');
}

// Comandos de correção
console.log('\n🔧 Comandos para corrigir problemas comuns:\n');
console.log('# Instalar Playwright:');
console.log('npm install playwright');
console.log('');
console.log('# Instalar browsers:');
console.log('npx playwright install chromium');
console.log('');
console.log('# Instalar dependências do sistema (Linux):');
console.log('sudo npx playwright install-deps chromium');
console.log('');
console.log('# Configurar memória (se necessário):');
console.log('export NODE_OPTIONS="--max-old-space-size=4096"');

console.log('\n📚 Para mais informações, consulte: PLAYWRIGHT-DEPLOYMENT-GUIDE.md');

process.exit(allPassed ? 0 : 1);