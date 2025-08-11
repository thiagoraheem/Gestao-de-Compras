# 🚀 Guia de Deploy - Playwright em Produção

## 📋 Checklist de Deploy

### **🔧 1. Dependências do Sistema**

#### **Ubuntu/Debian (mais comum)**
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y \
  wget \
  curl \
  unzip \
  fontconfig \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxrandr2 \
  libxss1 \
  libgtk-3-0 \
  libgbm1

# Instalar dependências específicas do Playwright
sudo npx playwright install-deps chromium
```

#### **CentOS/RHEL/Amazon Linux**
```bash
# Atualizar sistema
sudo yum update -y

# Instalar dependências
sudo yum install -y \
  wget \
  curl \
  unzip \
  fontconfig \
  liberation-fonts \
  alsa-lib \
  atk \
  gtk3 \
  libdrm \
  libxkbcommon \
  libxrandr \
  libXScrnSaver

# Para Amazon Linux 2
sudo amazon-linux-extras install -y epel
```

### **📦 2. Instalação do Playwright no Servidor**

```bash
# 1. Navegar para o diretório do projeto
cd /caminho/para/seu/projeto

# 2. Instalar dependências do Node.js
npm install

# 3. Instalar Playwright
npm install playwright

# 4. Instalar browsers (IMPORTANTE!)
npx playwright install chromium

# 5. Instalar dependências do sistema para os browsers
sudo npx playwright install-deps chromium

# 6. Verificar instalação
npx playwright --version
```

### **🐳 3. Docker (Recomendado para Produção)**

Crie um `Dockerfile` otimizado:

```dockerfile
# Dockerfile
FROM node:18-bullseye

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    fontconfig \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libgtk-3-0 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências do Node.js
RUN npm ci --only=production

# Instalar Playwright e browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copiar código da aplicação
COPY . .

# Build da aplicação (se necessário)
RUN npm run build

# Expor porta
EXPOSE 5201

# Comando para iniciar
CMD ["npm", "start"]
```

### **🔒 4. Configurações de Segurança**

#### **Usuário não-root (Recomendado)**
```bash
# Criar usuário específico para a aplicação
sudo useradd -m -s /bin/bash appuser

# Dar permissões necessárias
sudo chown -R appuser:appuser /caminho/para/projeto

# Executar aplicação como appuser
sudo -u appuser npm start
```

#### **Configurações do Playwright para Produção**
```typescript
// server/improved-pdf-service.ts - Configuração para produção
private static async generateWithPlaywrightChromium(html: string, options: PDFOptions): Promise<Buffer> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=4096',
        // Configurações específicas para produção
        '--single-process', // Para ambientes com pouca memória
        '--no-zygote',      // Para containers
        '--disable-gpu'     // Para servidores sem GPU
      ]
    });

    // ... resto do código
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}
```

### **⚙️ 5. Variáveis de Ambiente**

Adicione ao seu `.env` de produção:

```bash
# .env.production
NODE_ENV=production

# Configurações do Playwright
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false

# Configurações de PDF
PDF_TIMEOUT=45000
PDF_QUALITY=high
PDF_MAX_RETRIES=3

# Configurações de memória
NODE_OPTIONS="--max-old-space-size=4096"
```

### **📊 6. Monitoramento e Logs**

#### **Script de Monitoramento**
```bash
#!/bin/bash
# monitor-playwright.sh

echo "🔍 Verificando status do Playwright..."

# Verificar se browsers estão instalados
if npx playwright --version > /dev/null 2>&1; then
    echo "✅ Playwright instalado"
else
    echo "❌ Playwright não encontrado"
    exit 1
fi

# Verificar browsers
if ls ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome > /dev/null 2>&1; then
    echo "✅ Chromium instalado"
else
    echo "❌ Chromium não encontrado"
    echo "Execute: npx playwright install chromium"
    exit 1
fi

# Teste rápido de geração de PDF
node -e "
const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<h1>Teste</h1>');
    await page.pdf({ format: 'A4' });
    await browser.close();
    console.log('✅ Teste de PDF bem-sucedido');
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  }
})();
"

echo "🎉 Playwright está funcionando corretamente!"
```

### **🔄 7. Scripts de Deploy Automatizado**

#### **deploy.sh**
```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Iniciando deploy com Playwright..."

# 1. Backup da versão anterior
if [ -d "/opt/app-backup" ]; then
    rm -rf /opt/app-backup
fi
cp -r /opt/app /opt/app-backup

# 2. Atualizar código
cd /opt/app
git pull origin main

# 3. Instalar dependências
npm ci --only=production

# 4. Verificar/Instalar Playwright
if ! npx playwright --version > /dev/null 2>&1; then
    echo "📦 Instalando Playwright..."
    npm install playwright
    npx playwright install chromium
    sudo npx playwright install-deps chromium
fi

# 5. Build da aplicação
npm run build

# 6. Testar Playwright
echo "🧪 Testando Playwright..."
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<h1>Deploy Test</h1>');
  await page.pdf({ format: 'A4' });
  await browser.close();
  console.log('✅ Playwright funcionando');
})();
"

# 7. Reiniciar aplicação
pm2 restart app || npm start

echo "🎉 Deploy concluído com sucesso!"
```

### **🐧 8. Configurações Específicas por Ambiente**

#### **AWS EC2**
```bash
# Amazon Linux 2
sudo yum update -y
sudo yum install -y nodejs npm

# Instalar dependências do Playwright
sudo yum groupinstall -y "Development Tools"
sudo yum install -y \
    alsa-lib-devel \
    atk-devel \
    gtk3-devel \
    libdrm-devel \
    libxkbcommon-devel \
    libXrandr-devel \
    libXScrnSaver-devel
```

#### **Google Cloud Platform**
```bash
# Debian/Ubuntu
sudo apt-get update
sudo apt-get install -y nodejs npm

# Instalar dependências específicas
sudo apt-get install -y \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm-dev \
    libxkbcommon-dev \
    libgtk-3-dev
```

#### **DigitalOcean/Vultr**
```bash
# Ubuntu 20.04/22.04
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm

# Instalar Playwright
npm install playwright
npx playwright install chromium
sudo npx playwright install-deps chromium
```

### **⚠️ 9. Troubleshooting Comum**

#### **Erro: "Browser not found"**
```bash
# Solução
npx playwright install chromium
sudo npx playwright install-deps chromium
```

#### **Erro: "Permission denied"**
```bash
# Verificar permissões
ls -la ~/.cache/ms-playwright/
sudo chown -R $USER:$USER ~/.cache/ms-playwright/
```

#### **Erro: "Timeout"**
```bash
# Aumentar timeout no código
const pdfBuffer = await page.pdf({
  format: 'A4',
  timeout: 60000 // 60 segundos
});
```

#### **Alto uso de memória**
```bash
# Configurar Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Ou no package.json
"scripts": {
  "start": "node --max-old-space-size=4096 server/index.js"
}
```

### **📈 10. Otimizações de Performance**

#### **Cache de Browsers**
```bash
# Definir cache persistente
export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
```

#### **Pool de Browsers** (Para alta demanda)
```typescript
// Implementar pool de browsers para múltiplas requisições
class BrowserPool {
  private browsers: Browser[] = [];
  private maxBrowsers = 3;

  async getBrowser(): Promise<Browser> {
    if (this.browsers.length < this.maxBrowsers) {
      const browser = await chromium.launch({ headless: true });
      this.browsers.push(browser);
      return browser;
    }
    return this.browsers[Math.floor(Math.random() * this.browsers.length)];
  }
}
```

### **✅ Checklist Final de Deploy**

- [ ] Dependências do sistema instaladas
- [ ] Playwright e browsers instalados
- [ ] Teste de geração de PDF executado
- [ ] Configurações de segurança aplicadas
- [ ] Variáveis de ambiente configuradas
- [ ] Monitoramento configurado
- [ ] Scripts de deploy testados
- [ ] Backup da versão anterior criado
- [ ] Aplicação reiniciada e funcionando

---

**🎯 Resumo**: O Playwright precisa de browsers instalados no servidor e dependências específicas do sistema. Use Docker para facilitar o deploy ou siga os comandos específicos do seu ambiente de produção.