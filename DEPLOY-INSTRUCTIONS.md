# 🚀 Instruções de Deploy - Playwright

## ⚡ Resumo Rápido

**SIM**, você precisa fazer configurações no servidor para usar o Playwright após o deploy. Aqui está o que fazer:

## 🔧 Passos Obrigatórios no Servidor

### **1. Instalar Dependências do Sistema**

#### **Ubuntu/Debian (mais comum):**
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y wget curl unzip fontconfig fonts-liberation \
  libasound2 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxrandr2 \
  libxss1 libgtk-3-0 libgbm1

# Instalar dependências específicas do Playwright
sudo npx playwright install-deps chromium
```

#### **CentOS/RHEL/Amazon Linux:**
```bash
sudo yum update -y
sudo yum install -y wget curl unzip fontconfig liberation-fonts \
  alsa-lib atk gtk3 libdrm libxkbcommon libxrandr libXScrnSaver
```

### **2. Instalar Playwright no Servidor**

```bash
# No diretório do seu projeto
cd /caminho/para/seu/projeto

# Instalar dependências
npm install

# Instalar Playwright e browsers
npm run playwright:install

# Instalar dependências do sistema (Linux)
sudo npm run playwright:install-deps
```

### **3. Verificar se Está Funcionando**

```bash
# Executar verificação completa
npm run playwright:check

# Ou teste simples
npm run playwright:test
```

## 🐳 Opção Recomendada: Docker

Se você usar Docker, crie este `Dockerfile`:

```dockerfile
FROM node:18-bullseye

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    wget curl unzip fontconfig fonts-liberation \
    libasound2 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libxrandr2 libxss1 libgtk-3-0 libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Instalar Playwright
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

COPY . .
RUN npm run build

EXPOSE 5201
CMD ["npm", "start"]
```

## ⚙️ Configurações Importantes

### **Variáveis de Ambiente (.env):**
```bash
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096"
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
PDF_TIMEOUT=45000
```

### **Configurações de Segurança:**
```bash
# Criar usuário específico (recomendado)
sudo useradd -m -s /bin/bash appuser
sudo chown -R appuser:appuser /caminho/para/projeto

# Executar como usuário não-root
sudo -u appuser npm start
```

## 🔄 Script de Deploy Automatizado

Crie um script `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploy com Playwright..."

# Atualizar código
git pull origin main

# Instalar dependências
npm ci --only=production

# Setup Playwright
npm run deploy:setup

# Build e verificação
npm run deploy:full

# Reiniciar aplicação
pm2 restart app || npm start

echo "✅ Deploy concluído!"
```

## 📊 Verificação Rápida

Execute este comando para verificar se tudo está OK:

```bash
npm run deploy:check
```

## ⚠️ Problemas Comuns

### **"Browser not found"**
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium
```

### **"Permission denied"**
```bash
sudo chown -R $USER:$USER ~/.cache/ms-playwright/
```

### **Timeout/Memória**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

## 🎯 Checklist Final

- [ ] ✅ Dependências do sistema instaladas
- [ ] ✅ Playwright e Chromium instalados  
- [ ] ✅ Teste de PDF executado com sucesso
- [ ] ✅ Variáveis de ambiente configuradas
- [ ] ✅ Aplicação funcionando

## 📞 Suporte

Se algo der errado:

1. Execute: `npm run playwright:check`
2. Verifique os logs de erro
3. Consulte: `PLAYWRIGHT-DEPLOYMENT-GUIDE.md`

---

**💡 Dica**: Use Docker para evitar problemas de dependências!