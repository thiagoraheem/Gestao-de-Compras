import puppeteer from 'puppeteer';
import htmlPdf from 'html-pdf-node';
import { storage } from './storage';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

interface PurchaseOrderData {
  purchaseRequest: any;
  items: any[];
  supplier: any;
  approvalHistory: any[];
  selectedSupplierQuotation?: any;
  deliveryLocation?: any;
  company?: any;
  buyer?: any;
}

export class PDFService {
  // Detecta o sistema operacional
  private static isWindows(): boolean {
    return process.platform === 'win32';
  }

  // Cria e verifica diretórios temporários necessários
  private static async ensureTempDirectories(): Promise<string> {
    const tempBase = this.isWindows() ? 
      path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp') :
      '/tmp';

    // Criar diretórios específicos para Puppeteer
    const puppeteerTempDir = path.join(tempBase, 'puppeteer_pdf_service');
    
    try {
      // Criar diretório base se não existir
      if (!fs.existsSync(tempBase)) {
        fs.mkdirSync(tempBase, { recursive: true });
      }
      
      // Criar diretório para Puppeteer se não existir
      if (!fs.existsSync(puppeteerTempDir)) {
        fs.mkdirSync(puppeteerTempDir, { recursive: true });
      }
      
      // No Windows, também criar os diretórios comuns que o Puppeteer usa
      if (this.isWindows()) {
        const commonTempDirs = [
          path.join(tempBase, '1'),
          path.join(tempBase, '2'), 
          path.join(tempBase, '3'),
          path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local', 'Temp'),
          path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local', 'Temp', '1'),
          path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local', 'Temp', '2')
        ];
        
        for (const dir of commonTempDirs) {
          try {
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
          } catch (error) {
            // Silently ignore directory creation errors
          }
        }
      }
      
      return puppeteerTempDir;
    } catch (error) {
      console.error('❌ Erro ao criar diretórios temporários:', error instanceof Error ? error.message : String(error));
      // Fallback para diretório padrão
      return tempBase;
    }
  }

  // Detecta o caminho do browser automaticamente
  private static async findBrowserPath(): Promise<string | undefined> {
    
    // Possíveis caminhos de browsers em diferentes sistemas
    const possiblePaths = [
      // Windows (incluindo Windows Server)
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      // Windows Server caminhos específicos
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\chrome.exe',
      'C:\\ProgramData\\chocolatey\\lib\\GoogleChrome\\tools\\GoogleChromePortable.exe',
      // Caminhos comuns em servidores Windows
      'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'D:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      // Linux/Unix
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      // Nix store (comum em ambientes como Replit)
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      // Variáveis de ambiente
      process.env.CHROMIUM_PATH,
      process.env.CHROME_PATH,
      process.env.GOOGLE_CHROME_BIN
    ];

    for (const browserPath of possiblePaths) {
      if (browserPath && fs.existsSync(browserPath)) {
        return browserPath;
      }
    }

    return undefined;
  }

  // Método auxiliar para lançar browser com retry e fallback
  private static async launchBrowserWithRetry(retries: number = 3): Promise<any> {
    // Garantir que os diretórios temporários existem
    const tempDir = await this.ensureTempDirectories();
    // Argumentos específicos para Windows Server
    const windowsArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-translate',
      '--disable-notifications',
      '--disable-permissions-api',
      '--disable-background-mode',
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      // Configurações de diretórios temporários
      `--user-data-dir=${tempDir}`,
      `--data-path=${tempDir}`,
      `--temp-dir=${tempDir}`
    ];

    // Argumentos para Linux/Unix
    const linuxArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      // Configurações de diretórios temporários
      `--user-data-dir=${tempDir}`,
      `--data-path=${tempDir}`
    ];

    const baseArgs = this.isWindows() ? windowsArgs : linuxArgs;

    // Detectar caminho do browser automaticamente
    const detectedBrowserPath = await this.findBrowserPath();

    const configurations = [
      // Configuração 1: Browser detectado automaticamente
      ...(detectedBrowserPath ? [{
        executablePath: detectedBrowserPath,
        args: baseArgs,
        headless: true,
        timeout: 60000,
        ignoreDefaultArgs: false
      }] : []),
      // Configuração 2: Sem path específico (usa browser padrão do sistema)
      {
        args: baseArgs,
        headless: true,
        timeout: 60000,
        ignoreDefaultArgs: false
      },
      // Configuração 3: Windows Server minimal
      ...(this.isWindows() ? [{
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-plugins',
          `--user-data-dir=${tempDir}`,
          `--data-path=${tempDir}`,
          `--temp-dir=${tempDir}`
        ],
        headless: true,
        timeout: 60000,
        ignoreDefaultArgs: true
      }] : []),
      // Configuração 4: Minimal fallback com menos argumentos
      {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--disable-gpu',
          `--user-data-dir=${tempDir}`
        ],
        headless: true,
        timeout: 60000
      },
      // Configuração 5: Ultra minimal para ambientes muito restritivos
      {
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          `--user-data-dir=${tempDir}`
        ],
        headless: true,
        timeout: 60000
      }
    ];

    let lastError;
    for (let i = 0; i < configurations.length; i++) {
      for (let retry = 0; retry < retries; retry++) {
        try {
          const browser = await puppeteer.launch(configurations[i]);
          return browser;
        } catch (error) {
          lastError = error;
          console.error(`  ✗ Erro na tentativa ${retry + 1}:`, error instanceof Error ? error.message : String(error));
          if (retry < retries - 1) {
            const delay = 1000 * (retry + 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }
    
    console.error('❌ Todas as configurações e tentativas falharam');
    throw new Error(`Falha ao lançar browser após todas as tentativas. Último erro: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  // Método de fallback que retorna o HTML quando PDF falha
  private static async generatePDFWithFallback(html: string, pdfType: string): Promise<Buffer> {
    try {
      const pdfBuffer = await this.generatePDFWithPuppeteer(html);
      return pdfBuffer;
    } catch (puppeteerError) {
      console.error(`❌ Puppeteer falhou para ${pdfType}:`, puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError));
      
      try {
        const options = {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm', 
            left: '15mm'
          },
          printBackground: true,
          timeout: 30000
        };

        const file = { content: html };
        const pdfBuffer = await htmlPdf.generatePdf(file, options);
        // PDF generated successfully
        return pdfBuffer;
      } catch (fallbackError) {
        console.error(`❌ html-pdf-node também falhou para ${pdfType}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        // Returning HTML as fallback
        
        // Como último recurso, retorna o HTML como um "PDF" (o browser pode imprimir/salvar como PDF)
        const htmlDocument = `<!-- HTML_FALLBACK_MARKER -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pedido de Compra</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        body { font-family: Arial, sans-serif; margin: 20px; }
    </style>
</head>
<body>
    <div class="no-print" style="background: #f0f0f0; padding: 10px; margin-bottom: 20px; border-radius: 5px;">
        <strong>📄 Documento HTML</strong><br>
        Use Ctrl+P (Cmd+P no Mac) para imprimir ou salvar como PDF
    </div>
    ${html}
</body>
</html>`;
        
        return Buffer.from(htmlDocument, 'utf8');
      }
    }
  }

  // Geração de PDF usando Puppeteer (método original melhorado)
  private static async generatePDFWithPuppeteer(html: string): Promise<Buffer> {
    const browser = await this.launchBrowserWithRetry();
    let page = null;
    
    try {
      page = await browser.newPage();
      await page.setDefaultTimeout(30000);
      
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      
      // Aguardar um pouco para garantir que CSS foi processado
      await page.waitForTimeout(1000);
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        timeout: 60000,
        preferCSSPageSize: false
      });

      return pdfBuffer;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('Error closing page:', err);
        }
      }
      try {
        await browser.close();
      } catch (err) {
        console.error('Error closing browser:', err);
      }
    }
  }

  static async generateCompletionSummaryPDF(purchaseRequestId: number): Promise<Buffer> {
    try {
      // Buscar dados da solicitação
      const { storage } = await import('./storage');
      const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
      if (!purchaseRequest) {
        throw new Error('Purchase request not found');
      }

      const items = await storage.getPurchaseRequestItems(purchaseRequestId);
      const completeTimeline = await storage.getCompleteTimeline(purchaseRequestId);
      
      // Buscar dados do solicitante
      let requester = null;
      if (purchaseRequest.requesterId) {
        requester = await storage.getUser(purchaseRequest.requesterId);
      }

      // Buscar dados do centro de custo e departamento
      let costCenter: any = null;
      let department = null;
      if (purchaseRequest.costCenterId) {
        const allCostCenters = await storage.getAllCostCenters();
        costCenter = allCostCenters.find((cc: any) => cc.id === purchaseRequest.costCenterId);
        
        if (costCenter && costCenter.departmentId) {
          const allDepartments = await storage.getAllDepartments();
          department = allDepartments.find((d: any) => d.id === costCenter.departmentId);
        }
      }
      
      // Buscar cotação e fornecedor selecionado
      let selectedSupplier = null;
      let selectedSupplierQuotation = null;
      let supplierQuotationItems: any[] = [];
      
      try {
        const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
        if (quotation) {
          const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
          selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen);
          
          if (selectedSupplierQuotation) {
            selectedSupplier = await storage.getSupplierById(selectedSupplierQuotation.supplierId);
            supplierQuotationItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
          }
        }
      } catch (error) {
        // Could not fetch quotation data for completion summary
      }

      const html = this.generateCompletionSummaryHTML({
        purchaseRequest,
        items,
        completeTimeline,
        requester,
        department,
        costCenter,
        selectedSupplier,
        selectedSupplierQuotation,
        supplierQuotationItems
      });

      return await this.generatePDFWithFallback(html, 'completion-summary');
    } catch (error) {
      console.error('Error in generateCompletionSummaryPDF:', error);
      throw error;
    }
  }

  static async generateDashboardPDF(dashboardData: any): Promise<Buffer> {
    try {
      return await this.generatePDFWithFallback(this.generateDashboardHTML(dashboardData), 'dashboard');
    } catch (error) {
      console.error('Error in generateDashboardPDF:', error);
      throw error;
    }
  }

  private static generateDashboardHTML(data: any): string {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('pt-BR');
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Dashboard Executivo - Sistema de Compras</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .header p {
              margin: 5px 0 0 0;
              font-size: 14px;
              opacity: 0.9;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .kpi-card {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              border-left: 4px solid #667eea;
            }
            .kpi-card h3 {
              margin: 0 0 10px 0;
              color: #333;
              font-size: 14px;
              font-weight: 500;
            }
            .kpi-card .value {
              font-size: 24px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 5px;
            }
            .kpi-card .subtitle {
              font-size: 12px;
              color: #666;
            }
            .charts-section {
              margin-bottom: 30px;
            }
            .chart-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 20px;
            }
            .chart-card {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .chart-card h3 {
              margin: 0 0 15px 0;
              color: #333;
              font-size: 16px;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .data-table th,
            .data-table td {
              padding: 8px 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            .data-table th {
              background-color: #f8f9fa;
              font-weight: 600;
              color: #333;
            }
            .data-table tr:hover {
              background-color: #f8f9fa;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Dashboard Executivo</h1>
            <p>Sistema de Gestão de Compras - Relatório gerado em ${formatDate(new Date())}</p>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <h3>Solicitações Ativas</h3>
              <div class="value">${data.totalActiveRequests || 0}</div>
              <div class="subtitle">Total de solicitações em andamento</div>
            </div>
            
            <div class="kpi-card">
              <h3>Valor Total em Processamento</h3>
              <div class="value">${formatCurrency(data.totalProcessingValue || 0)}</div>
              <div class="subtitle">Valor total das solicitações ativas</div>
            </div>
            
            <div class="kpi-card">
              <h3>Tempo Médio de Aprovação</h3>
              <div class="value">${data.averageApprovalTime || 0} dias</div>
              <div class="subtitle">Média de tempo para aprovação</div>
            </div>
            
            <div class="kpi-card">
              <h3>Taxa de Aprovação</h3>
              <div class="value">${data.approvalRate || 0}%</div>
              <div class="subtitle">Percentual de aprovações</div>
            </div>
          </div>

          <div class="charts-section">
            <div class="chart-grid">
              <div class="chart-card">
                <h3>Solicitações por Departamento</h3>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Departamento</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.requestsByDepartment || []).map((item: any) => `
                      <tr>
                        <td>${item.name}</td>
                        <td>${item.value}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              
              <div class="chart-card">
                <h3>Distribuição por Urgência</h3>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Urgência</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.urgencyDistribution || []).map((item: any) => `
                      <tr>
                        <td>${item.name}</td>
                        <td>${item.value}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="chart-card">
              <h3>Top Departamentos por Valor</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Departamento</th>
                    <th>Valor Total</th>
                    <th>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  ${(data.topDepartments || []).map((item: any) => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${formatCurrency(item.totalValue)}</td>
                      <td>${item.requestCount}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="footer">
            <p>Relatório gerado automaticamente pelo Sistema de Gestão de Compras</p>
          </div>
        </body>
      </html>
    `;
  }

  private static async generateApprovalA2HTML(data: any): Promise<string> {
    const { purchaseRequest, items, supplier, approvalHistory, selectedSupplierQuotation, deliveryLocation, company, requester } = data;
    
    // Função para formatar data brasileira
    const formatBrazilianDate = (dateString: string | null | undefined): string => {
      if (!dateString) return 'Não informado';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
      } catch {
        return 'Não informado';
      }
    };

    // Função para formatar moeda
    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value || 0);
    };

    // Generate QR Code for tracking
    let qrCodeDataURL = '';
    try {
      const frontendUrl = process.env.FRONTEND_URL || 
                         (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
      const trackingUrl = `${frontendUrl}/public/request/${purchaseRequest.id}`;
      qrCodeDataURL = await QRCode.toDataURL(trackingUrl, {
        width: 100,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      // QR code generation failed - continue without QR code
    }

    // Carregar logo da empresa como base64
    let companyLogoBase64 = null;
    if (company?.logoBase64) {
      companyLogoBase64 = company.logoBase64;
    }
    
    // Calcular totais
    const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.totalPrice) || 0), 0);
    const itemDiscountTotal = items.reduce((sum: number, item: any) => sum + (Number(item.itemDiscount) || 0), 0);
    
    // Calcular desconto da proposta
    let proposalDiscount = 0;
    if (selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) {
      const discountValue = Number(selectedSupplierQuotation.discountValue) || 0;
      
      if (selectedSupplierQuotation.discountType === 'percentage') {
        proposalDiscount = (subtotal * discountValue) / 100;
      } else if (selectedSupplierQuotation.discountType === 'fixed') {
        proposalDiscount = discountValue;
      }
    }
    
    const desconto = itemDiscountTotal + proposalDiscount;
    const freightValue = Number(selectedSupplierQuotation?.freightValue) || 0;
    const valorFinal = subtotal - desconto + freightValue;
    
    // Encontrar aprovações
    const aprovacaoA1 = approvalHistory.find((h: any) => h.approverType === 'A1');
    const aprovacaoA2 = approvalHistory.find((h: any) => h.approverType === 'A2');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Aprovação A2 - ${purchaseRequest.requestNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      margin: 10px;
      color: #000;
    }
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
      position: relative;
    }
    .qr-code-container {
      position: absolute;
      top: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
    }
    .qr-code-container img {
      width: 100px;
      height: 100px;
      display: block;
      margin-bottom: 5px;
    }
    .qr-code-text {
      font-size: 9px;
      color: #666;
      font-weight: normal;
    }
    .header-logo {
      flex: 0 0 150px;
      margin-right: 20px;
    }
    .header-logo img {
      max-width: 150px;
      max-height: 100px;
      object-fit: contain;
    }
    .header-info {
      flex: 1;
      text-align: center;
    }
    .header-info h1 {
      font-size: 16px;
      font-weight: bold;
      margin: 5px 0;
    }
    .header-info h2 {
      font-size: 14px;
      font-weight: bold;
      margin: 5px 0;
      color: #333;
    }
    .header-info p {
      margin: 2px 0;
      font-size: 11px;
    }
    .section {
      margin: 10px 0;
    }
    .section-title {
      background-color: #f0f0f0;
      padding: 5px;
      font-weight: bold;
      border: 1px solid #ccc;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 10px 0;
    }
    .info-item {
      margin: 3px 0;
    }
    .info-label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .total-row {
      font-weight: bold;
      background-color: #f9f9f9;
    }
    .discount-row {
      font-weight: bold;
      background-color: #fff3cd;
      color: #856404;
    }
    .subtotal-row {
      font-weight: bold;
      background-color: #f8f9fa;
    }
    .footer {
      margin-top: 15px;
      font-size: 10px;
    }
    .approval-status {
      background-color: #d4edda;
      color: #155724;
      padding: 5px;
      border-radius: 3px;
      font-weight: bold;
    }
    .approval-pending {
      background-color: #fff3cd;
      color: #856404;
    }
    .approval-rejected {
      background-color: #f8d7da;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="header">
    ${companyLogoBase64 ? `
    <div class="header-logo">
      <img src="data:image/png;base64,${companyLogoBase64}" alt="Logo da Empresa">
    </div>
    ` : ''}
    <div class="header-info">
      <h1>APROVAÇÃO A2</h1>
      <h2>Solicitação de Compra Nº ${purchaseRequest.requestNumber}</h2>
      <p>Data de Geração: ${formatBrazilianDate(new Date().toISOString())}</p>
      ${company ? `<p>${company.name}</p>` : ''}
    </div>
    ${qrCodeDataURL ? `
    <div class="qr-code-container">
      <img src="${qrCodeDataURL}" alt="QR Code">
      <div class="qr-code-text">Acompanhe online</div>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">Informações da Solicitação</div>
    <div class="info-grid">
      <div>
        <div class="info-item">
          <span class="info-label">Número:</span> ${purchaseRequest.requestNumber}
        </div>
        <div class="info-item">
          <span class="info-label">Solicitante:</span> ${requester?.name || 'Não informado'}
        </div>
        <div class="info-item">
          <span class="info-label">Departamento:</span> ${purchaseRequest.departmentName}
        </div>
        <div class="info-item">
          <span class="info-label">Centro de Custo:</span> ${purchaseRequest.costCenterName}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">Data Solicitação:</span> ${formatBrazilianDate(purchaseRequest.createdAt)}
        </div>
        <div class="info-item">
          <span class="info-label">Data Entrega:</span> ${formatBrazilianDate(purchaseRequest.deliveryDate)}
        </div>
        <div class="info-item">
          <span class="info-label">Urgência:</span> ${purchaseRequest.urgency || 'Normal'}
        </div>
        <div class="info-item">
          <span class="info-label">Valor Total:</span> ${formatCurrency(valorFinal)}
        </div>
      </div>
    </div>
    ${purchaseRequest.justification ? `
    <div class="info-item">
      <span class="info-label">Justificativa:</span><br>
      ${purchaseRequest.justification}
    </div>
    ` : ''}
  </div>

  ${supplier ? `
  <div class="section">
    <div class="section-title">Fornecedor Selecionado</div>
    <div class="info-grid">
      <div>
        <div class="info-item">
          <span class="info-label">Nome:</span> ${supplier.name}
        </div>
        <div class="info-item">
          <span class="info-label">CNPJ:</span> ${supplier.cnpj || 'Não informado'}
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span> ${supplier.email || 'Não informado'}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">Telefone:</span> ${supplier.phone || 'Não informado'}
        </div>
        <div class="info-item">
          <span class="info-label">Cidade:</span> ${supplier.city || 'Não informado'}
        </div>
        <div class="info-item">
          <span class="info-label">Estado:</span> ${supplier.state || 'Não informado'}
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Itens da Solicitação</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Descrição</th>
          <th>Qtd</th>
          <th>Unidade</th>
          <th>Marca</th>
          <th>Valor Unit.</th>
          <th>Valor Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item: any, index: number) => `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${item.description}</td>
          <td class="text-center">${parseInt(item.quantity) || 0}</td>
          <td class="text-center">${item.unit || 'UN'}</td>
          <td>${item.brand || 'N/A'}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.totalPrice)}</td>
        </tr>
        `).join('')}
        <tr class="subtotal-row">
          <td colspan="6" class="text-right">Subtotal:</td>
          <td class="text-right">${formatCurrency(subtotal)}</td>
        </tr>
        ${desconto > 0 ? `
        <tr class="discount-row">
          <td colspan="6" class="text-right">Desconto:</td>
          <td class="text-right">-${formatCurrency(desconto)}</td>
        </tr>
        ` : ''}
        ${freightValue > 0 ? `
        <tr>
          <td colspan="6" class="text-right">Frete:</td>
          <td class="text-right">${formatCurrency(freightValue)}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td colspan="6" class="text-right">VALOR TOTAL:</td>
          <td class="text-right">${formatCurrency(valorFinal)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${deliveryLocation ? `
  <div class="section">
    <div class="section-title">Local de Entrega</div>
    <div class="info-grid">
      <div>
        <div class="info-item">
          <span class="info-label">Nome:</span> ${deliveryLocation.name}
        </div>
        <div class="info-item">
          <span class="info-label">Endereço:</span> ${deliveryLocation.address}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">Cidade:</span> ${deliveryLocation.city}
        </div>
        <div class="info-item">
          <span class="info-label">CEP:</span> ${deliveryLocation.zipCode}
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Histórico de Aprovações</div>
    <table>
      <thead>
        <tr>
          <th>Nível</th>
          <th>Aprovador</th>
          <th>Data</th>
          <th>Status</th>
          <th>Observações</th>
        </tr>
      </thead>
      <tbody>
        ${approvalHistory.map((approval: any) => `
        <tr>
          <td>${approval.approverType}</td>
          <td>${approval.approverName || 'N/A'}</td>
          <td>${formatBrazilianDate(approval.createdAt)}</td>
          <td>
            <span class="approval-status ${approval.action === 'approved' ? '' : approval.action === 'rejected' ? 'approval-rejected' : 'approval-pending'}">
              ${approval.action === 'approved' ? 'Aprovado' : approval.action === 'rejected' ? 'Rejeitado' : 'Pendente'}
            </span>
          </td>
          <td>${approval.comments || '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p><strong>Documento gerado automaticamente pelo Sistema de Gestão de Compras</strong></p>
    <p>Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>
    `;
  }

  private static async generatePurchaseOrderHTML(data: PurchaseOrderData): Promise<string> {
    const { purchaseRequest, items, supplier, approvalHistory, selectedSupplierQuotation, deliveryLocation, company, buyer } = data;
    
    // Função para formatar data brasileira
    const formatBrazilianDate = (dateString: string | null | undefined): string => {
      if (!dateString) return 'Não informado';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
      } catch {
        return 'Não informado';
      }
    };

    // Note: getImageAsBase64 function removed - logos now stored as base64 in database

    // Generate QR Code for tracking
    let qrCodeDataURL = '';
    try {
      const frontendUrl = process.env.FRONTEND_URL || 
                         (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
      const trackingUrl = `${frontendUrl}/public/request/${purchaseRequest.id}`;
      qrCodeDataURL = await QRCode.toDataURL(trackingUrl, {
        width: 100,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      // QR code generation failed - continue without QR code
    }

    // Carregar logo da empresa como base64
    let companyLogoBase64 = null;
    if (company?.logoBase64) {
      companyLogoBase64 = company.logoBase64;
    }
    
    // Calcular totais usando preços originais para evitar desconto duplicado
    const subtotal = items.reduce((sum, item) => sum + (Number(item.originalTotalPrice) || Number(item.totalPrice) || 0), 0);
    
    // Calcular desconto total dos itens
    const itemDiscountTotal = items.reduce((sum, item) => 
      sum + (Number(item.itemDiscount) || 0), 0
    );
    
    // Calcular desconto da proposta (aplicado sobre o subtotal original)
    let proposalDiscount = 0;
    if (selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) {
      const discountValue = Number(selectedSupplierQuotation.discountValue) || 0;
      
      if (selectedSupplierQuotation.discountType === 'percentage') {
        proposalDiscount = (subtotal * discountValue) / 100;
      } else if (selectedSupplierQuotation.discountType === 'fixed') {
        proposalDiscount = discountValue;
      }
    }
    
    const desconto = itemDiscountTotal + proposalDiscount;
    const freightValue = Number(selectedSupplierQuotation?.freightValue) || 0;
    const valorFinal = subtotal - desconto + freightValue;
    
    // Encontrar aprovações - usando approverType em vez de phase
    const aprovacaoA1 = approvalHistory.find(h => h.approverType === 'A1');
    const aprovacaoA2 = approvalHistory.find(h => h.approverType === 'A2');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pedido de Compras - ${purchaseRequest.requestNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      margin: 10px;
      color: #000;
    }
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
      position: relative;
    }
    .qr-code-container {
      position: absolute;
      top: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
    }
    .qr-code-container img {
      width: 100px;
      height: 100px;
      display: block;
      margin-bottom: 5px;
    }
    .qr-code-text {
      font-size: 9px;
      color: #666;
      font-weight: normal;
    }
    .header-logo {
      flex: 0 0 150px;
      margin-right: 20px;
    }
    .header-logo img {
      max-width: 150px;
      max-height: 100px;
      object-fit: contain;
    }
    .header-info {
      flex: 1;
      text-align: center;
    }
    .header-info h1 {
      font-size: 16px;
      font-weight: bold;
      margin: 5px 0;
    }
    .header-info h2 {
      font-size: 14px;
      font-weight: bold;
      margin: 5px 0;
      color: #333;
    }
    .header-info p {
      margin: 2px 0;
      font-size: 11px;
    }
    .section {
      margin: 10px 0;
    }
    .section-title {
      background-color: #f0f0f0;
      padding: 5px;
      font-weight: bold;
      border: 1px solid #ccc;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 10px 0;
    }
    .info-item {
      margin: 3px 0;
    }
    .info-label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .total-row {
      font-weight: bold;
      background-color: #f9f9f9;
    }
    .discount-row {
      font-weight: bold;
      background-color: #fff3cd;
      color: #856404;
    }
    .subtotal-row {
      font-weight: bold;
      background-color: #f8f9fa;
    }
    .footer {
      margin-top: 15px;
      font-size: 10px;
    }
    .electronic-signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 20px;
    }
    .electronic-signature-grid-three {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .signature-electronic {
      border: 1px solid #000;
      padding: 15px;
      text-align: center;
      background-color: #f9f9f9;
    }
    .signature-header {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .signature-name {
      font-weight: bold;
      font-size: 12px;
      margin: 8px 0;
      text-decoration: underline;
    }
    .signature-role {
      font-size: 11px;
      margin: 5px 0;
      font-style: italic;
    }
    .signature-date {
      font-size: 10px;
      margin-top: 8px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    ${companyLogoBase64 ? `
    <div class="header-logo">
      <img src="${companyLogoBase64}" alt="Logo da Empresa" />
    </div>
    ` : ''}
    <div class="header-info">
      <h1>PEDIDO DE COMPRAS - ${purchaseRequest.requestNumber}</h1>
      <h2>${company?.name || company?.tradingName || 'EMPRESA NÃO INFORMADA'}</h2>
      ${company?.address ? `<p>Endereço: ${company.address}</p>` : ''}
      ${company?.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
      ${company?.phone ? `<p>Telefone: ${company.phone}</p>` : ''}
      ${company?.email ? `<p>Email: ${company.email}</p>` : ''}
    </div>
    ${qrCodeDataURL ? `
    <div class="qr-code-container">
      <img src="${qrCodeDataURL}" alt="QR Code para acompanhamento" />
      <div class="qr-code-text">Escaneie para acompanhar</div>
    </div>
    ` : ''}
  </div>

  <div class="info-grid">
    <div class="section">
      <div class="section-title">DADOS FORNECEDOR</div>
      <div class="info-item">
        <span class="info-label">FORNECEDOR:</span> ${supplier?.name || 'Não informado'}
      </div>
      <div class="info-item">
        <span class="info-label">CNPJ:</span> ${supplier?.cnpj || 'Não informado'}
      </div>
      <div class="info-item">
        <span class="info-label">ENDEREÇO:</span> ${supplier?.address || 'Não informado'}
      </div>
      <div class="info-item">
        <span class="info-label">CONTATO:</span> ${supplier?.contactPerson || 'Não informado'}
      </div>
      <div class="info-item">
        <span class="info-label">TELEFONE:</span> ${supplier?.phone || 'Não informado'}
      </div>
      ${(selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) ? `
      <div class="info-item">
        <span class="info-label">DESCONTO:</span> ${selectedSupplierQuotation.discountType === 'percentage' 
          ? `${selectedSupplierQuotation.discountValue}%` 
          : `R$ ${Number(selectedSupplierQuotation.discountValue).toFixed(2).replace('.', ',')}`}
      </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-title">LOCAL DE ENTREGA</div>
      <div class="info-item">
        <span class="info-label">LOCAL:</span> ${deliveryLocation?.name || 'Sede da empresa'}
      </div>
      <div class="info-item">
        <span class="info-label">ENDEREÇO:</span> ${deliveryLocation?.address || 'Av. Nathan Lemos Xavier de Albuquerque, 1.328, Novo Aleixo, Manaus-AM, 69098-145'}
      </div>
      ${deliveryLocation?.contactPerson ? `
      <div class="info-item">
        <span class="info-label">RESPONSÁVEL:</span> ${deliveryLocation.contactPerson}
      </div>
      ` : ''}
      ${deliveryLocation?.phone ? `
      <div class="info-item">
        <span class="info-label">TELEFONE:</span> ${deliveryLocation.phone}
      </div>
      ` : ''}
      ${deliveryLocation?.email ? `
      <div class="info-item">
        <span class="info-label">EMAIL:</span> ${deliveryLocation.email}
      </div>
      ` : ''}
    </div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div>
        <div class="info-item">
          <span class="info-label">SOLICITAÇÃO:</span> ${purchaseRequest.requestNumber}
        </div>
        <div class="info-item">
          <span class="info-label">SOLICITANTE:</span> ${purchaseRequest.requesterName || (purchaseRequest.requester ? `${purchaseRequest.requester.firstName || ''} ${purchaseRequest.requester.lastName || ''}`.trim() : 'Não informado')}
        </div>
        <div class="info-item">
          <span class="info-label">DEPARTAMENTO:</span> ${purchaseRequest.departmentName || 'Não informado'}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">DATA PEDIDO:</span> ${new Date().toLocaleDateString('pt-BR')}
        </div>
        <div class="info-item">
          <span class="info-label">PRAZO ENTREGA:</span> ${selectedSupplierQuotation?.deliveryDate ? formatBrazilianDate(selectedSupplierQuotation.deliveryDate) : (selectedSupplierQuotation?.deliveryTerms || formatBrazilianDate(purchaseRequest.idealDeliveryDate))}
        </div>
        <div class="info-item">
          <span class="info-label">COND. PAGAMENTO:</span> ${selectedSupplierQuotation?.paymentTerms || supplier?.paymentTerms || 'A definir'}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <table>
      <thead>
        <tr>
          <th class="text-center">QUANT.</th>
          <th class="text-center">UND</th>
          <th>ITEM</th>
          <th class="text-center">MARCA</th>
          <th class="text-center">VL. UNITÁRIO</th>
          <th class="text-center">VL. TOTAL</th>
          <th>OBSERVAÇÃO</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const hasDiscount = Number(item.itemDiscount) > 0;
          const originalUnitPrice = Number(item.originalUnitPrice) || Number(item.unitPrice) || 0;
          const originalTotalPrice = Number(item.originalTotalPrice) || Number(item.totalPrice) || 0;
          const finalTotalPrice = Number(item.totalPrice) || 0;
          
          return `
          <tr>
            <td class="text-center">${parseInt(item.quantity) || 0}</td>
            <td class="text-center">${item.unit || 'UND'}</td>
            <td>${item.itemCode || ''} ${item.itemCode ? '-' : ''} ${item.description}</td>
            <td class="text-center">${item.brand || 'Não informado'}</td>
            <td class="text-right">
              ${hasDiscount ? 
                `<span style="text-decoration: line-through; color: #999;">R$ ${originalUnitPrice.toFixed(2).replace('.', ',')}</span><br>
                 <span style="color: #28a745; font-weight: bold;">R$ ${(finalTotalPrice / Number(item.quantity || 1)).toFixed(2).replace('.', ',')}</span>` :
                `R$ ${originalUnitPrice.toFixed(2).replace('.', ',')}`
              }
            </td>
            <td class="text-right">
              ${hasDiscount ? 
                `<span style="text-decoration: line-through; color: #999;">R$ ${originalTotalPrice.toFixed(2).replace('.', ',')}</span><br>
                 <span style="color: #28a745; font-weight: bold;">R$ ${finalTotalPrice.toFixed(2).replace('.', ',')}</span>` :
                `R$ ${originalTotalPrice.toFixed(2).replace('.', ',')}`
              }
            </td>
            <td>${item.specifications || ''}</td>
          </tr>
          `;
        }).join('')}
        
        <!-- Linhas vazias para completar o template -->
        ${Array(Math.max(0, 8 - items.length)).fill(0).map(() => `
          <tr>
            <td class="text-center">&nbsp;</td>
            <td class="text-center">&nbsp;</td>
            <td>&nbsp;</td>
            <td class="text-center">&nbsp;</td>
            <td class="text-right">&nbsp;</td>
            <td class="text-right">&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        `).join('')}
        
        ${desconto > 0 || freightValue > 0 ? `
         <tr class="subtotal-row">
           <td colspan="5" class="text-right"><strong>SUBTOTAL:</strong></td>
           <td class="text-right"><strong>R$ ${subtotal.toFixed(2).replace('.', ',')}</strong></td>
           <td>&nbsp;</td>
         </tr>
         ${desconto > 0 ? `
         <tr class="discount-row">
           <td colspan="5" class="text-right"><strong>DESCONTO ${selectedSupplierQuotation.discountType === 'percentage' ? `(${selectedSupplierQuotation.discountValue}%)` : ''}:</strong></td>
           <td class="text-right"><strong>- R$ ${desconto.toFixed(2).replace('.', ',')}</strong></td>
           <td>&nbsp;</td>
         </tr>
         ` : ''}
         ${freightValue > 0 ? `
         <tr class="subtotal-row">
           <td colspan="5" class="text-right"><strong>FRETE:</strong></td>
           <td class="text-right"><strong>R$ ${freightValue.toFixed(2).replace('.', ',')}</strong></td>
           <td>&nbsp;</td>
         </tr>
         ` : ''}
         <tr class="total-row">
           <td colspan="5" class="text-right"><strong>TOTAL FINAL:</strong></td>
           <td class="text-right"><strong>R$ ${valorFinal.toFixed(2).replace('.', ',')}</strong></td>
           <td>&nbsp;</td>
         </tr>
         ` : `
        <tr class="total-row">
          <td colspan="5" class="text-right"><strong>TOTAL GERAL:</strong></td>
          <td class="text-right"><strong>R$ ${(subtotal + freightValue).toFixed(2).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>
        `}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">OBSERVAÇÕES GERAIS</div>
    <p>${purchaseRequest.description || 'Nenhuma observação adicional.'}</p>
    ${purchaseRequest.urgencyLevel ? `<p><strong>Urgência:</strong> ${purchaseRequest.urgencyLevel}</p>` : ''}
    ${purchaseRequest.budgetCenter ? `<p><strong>Centro de Custo:</strong> ${purchaseRequest.budgetCenter}</p>` : ''}
  </div>

  <div class="section">
    <div class="section-title">ASSINADO ELETRONICAMENTE POR:</div>
    <div class="electronic-signature-grid-three">
      <div class="signature-electronic">
        <div class="signature-header">ASSINADO ELETRONICAMENTE POR:</div>
        <div class="signature-name">${buyer ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || buyer.username || 'Não informado' : 'Comprador não definido'}</div>
        <div class="signature-role">Comprador</div>
        <div class="signature-date">${new Date(purchaseRequest.createdAt || new Date()).toLocaleDateString('pt-BR')} às ${new Date(purchaseRequest.createdAt || new Date()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>
      </div>
      
      <div class="signature-electronic">
        <div class="signature-header">ASSINADO ELETRONICAMENTE POR:</div>
        <div class="signature-name">${aprovacaoA1?.approver?.firstName && aprovacaoA1?.approver?.lastName ? `${aprovacaoA1.approver.firstName} ${aprovacaoA1.approver.lastName}` : (aprovacaoA1?.approver?.username || 'Não informado')}</div>
        <div class="signature-role">Aprovador A1</div>
        <div class="signature-date">${aprovacaoA1 ? new Date(aprovacaoA1.createdAt).toLocaleDateString('pt-BR') + ' às ' + new Date(aprovacaoA1.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : 'Não assinado'}</div>
      </div>
      
      <div class="signature-electronic">
        <div class="signature-header">ASSINADO ELETRONICAMENTE POR:</div>
        <div class="signature-name">${aprovacaoA2?.approver?.firstName && aprovacaoA2?.approver?.lastName ? `${aprovacaoA2.approver.firstName} ${aprovacaoA2.approver.lastName}` : (aprovacaoA2?.approver?.username || 'Não informado')}</div>
        <div class="signature-role">Aprovador A2 (Liberador)</div>
        <div class="signature-date">${aprovacaoA2 ? new Date(aprovacaoA2.createdAt).toLocaleDateString('pt-BR') + ' às ' + new Date(aprovacaoA2.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : 'Não assinado'}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p><strong>Documento gerado automaticamente em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>
    `;
  }

  static async generateApprovalA2PDF(purchaseRequestId: number): Promise<Buffer> {
    // Buscar dados da solicitação
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
    if (!purchaseRequest) {
      throw new Error('Solicitação de compra não encontrada');
    }

    // Buscar itens da solicitação
    const items = await storage.getPurchaseRequestItems(purchaseRequestId);
    
    // Buscar dados da empresa através da solicitação
    let company = null;
    const requester = await storage.getUser(purchaseRequest.requesterId!);
    
    if (purchaseRequest.companyId) {
      company = await storage.getCompanyById(purchaseRequest.companyId);
    }
    
    // Buscar departamento através do cost center
    let department = null;
    let costCenter = null;
    if (purchaseRequest.costCenterId) {
      const allCostCenters = await storage.getAllCostCenters();
      costCenter = allCostCenters.find(cc => cc.id === purchaseRequest.costCenterId);
      if (costCenter && costCenter.departmentId) {
        department = await storage.getDepartmentById(costCenter.departmentId);
      }
    }
    
    // Buscar fornecedor e valores dos itens do fornecedor selecionado
    let supplier = null;
    let selectedSupplierQuotation = null;
    let itemsWithPrices = items;
    let deliveryLocation = null;
    
    const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
    
    // Buscar local de entrega se a cotação existir
    if (quotation && quotation.deliveryLocationId) {
      deliveryLocation = await storage.getDeliveryLocationById(quotation.deliveryLocationId);
    }
    
    if (quotation) {
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      selectedSupplierQuotation = supplierQuotations.find(sq => sq.isChosen) || supplierQuotations[0];
      
      if (selectedSupplierQuotation) {
        supplier = await storage.getSupplierById(selectedSupplierQuotation.supplierId);
        
        // Buscar os itens do fornecedor selecionado com preços
        const supplierItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
        const quotationItems = await storage.getQuotationItems(quotation.id);
        
        // Combinar os itens da solicitação com os preços do fornecedor
        itemsWithPrices = items.map(item => {
          let quotationItem = quotationItems.find(qi => 
            qi.purchaseRequestItemId && qi.purchaseRequestItemId === item.id
          );
          
          if (!quotationItem && item.description) {
            quotationItem = quotationItems.find(qi => 
              qi.description && 
              qi.description.trim().toLowerCase() === item.description.trim().toLowerCase()
            );
          }
          
          if (quotationItem) {
            const supplierItem = supplierItems.find(si => si.quotationItemId === quotationItem.id);
            
            if (supplierItem) {
              const unitPrice = Number(supplierItem.unitPrice) || 0;
              const quantity = Number(item.quantity) || 1;
              const originalTotal = unitPrice * quantity;
              let discountedTotal = originalTotal;
              let itemDiscount = 0;
              
              if (supplierItem.discountPercentage && Number(supplierItem.discountPercentage) > 0) {
                const discountPercent = Number(supplierItem.discountPercentage);
                itemDiscount = (originalTotal * discountPercent) / 100;
                discountedTotal = originalTotal - itemDiscount;
              } else if (supplierItem.discountValue && Number(supplierItem.discountValue) > 0) {
                itemDiscount = Number(supplierItem.discountValue);
                discountedTotal = Math.max(0, originalTotal - itemDiscount);
              }
              
              return {
                ...item,
                unitPrice: unitPrice,
                originalUnitPrice: unitPrice,
                itemDiscount: itemDiscount,
                brand: supplierItem.brand || '',
                deliveryTime: supplierItem.deliveryDays ? `${supplierItem.deliveryDays} dias` : '',
                totalPrice: discountedTotal,
                originalTotalPrice: originalTotal
              };
            }
          }
          
          return {
            ...item,
            unitPrice: 0,
            originalUnitPrice: 0,
            itemDiscount: 0,
            brand: '',
            deliveryTime: '',
            totalPrice: 0,
            originalTotalPrice: 0
          };
        });
      }
    }

    // Buscar histórico de aprovações
    const approvalHistory = await storage.getApprovalHistory(purchaseRequestId);

    const data = {
      purchaseRequest: {
        ...purchaseRequest,
        departmentName: department?.name || 'Não informado',
        costCenterName: costCenter?.name || 'Não informado'
      },
      items: itemsWithPrices,
      supplier,
      approvalHistory,
      selectedSupplierQuotation,
      deliveryLocation,
      company,
      requester
    };

    // Gerar HTML
    const html = await this.generateApprovalA2HTML(data);

    // Gerar PDF usando sistema de fallback robusto
    return await this.generatePDFWithFallback(html, 'approval-a2');
  }

  static async generatePurchaseOrderPDF(purchaseRequestId: number): Promise<Buffer> {
    // Buscar dados da solicitação
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
    if (!purchaseRequest) {
      throw new Error('Solicitação de compra não encontrada');
    }

    // Buscar pedido de compra associado
    const purchaseOrder = await storage.getPurchaseOrderByRequestId(purchaseRequestId);
    if (!purchaseOrder) {
      throw new Error('Pedido de compra não encontrado para esta solicitação');
    }

    // Buscar itens do pedido de compra (não da solicitação)
    const items = await storage.getPurchaseOrderItems(purchaseOrder.id);
    
    // Buscar dados da empresa através da solicitação
    let company = null;
    const requester = await storage.getUser(purchaseRequest.requesterId!);
    
    if (purchaseRequest.companyId) {
      company = await storage.getCompanyById(purchaseRequest.companyId);
    }
    
    // Buscar departamento através do cost center
    let department = null;
    if (purchaseRequest.costCenterId) {
      // Buscar todos os cost centers e encontrar o específico
      const allCostCenters = await storage.getAllCostCenters();
      const costCenter = allCostCenters.find(cc => cc.id === purchaseRequest.costCenterId);
      if (costCenter && costCenter.departmentId) {
        department = await storage.getDepartmentById(costCenter.departmentId);
      }
    }
    
    // Buscar fornecedor do pedido de compra
    let supplier = null;
    let selectedSupplierQuotation = null;
    let deliveryLocation = null;
    
    // Buscar fornecedor diretamente do pedido de compra
    if (purchaseOrder.supplierId) {
      supplier = await storage.getSupplierById(purchaseOrder.supplierId);
    }
    
    const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
    
    // Buscar local de entrega se a cotação existir
    if (quotation && quotation.deliveryLocationId) {
      deliveryLocation = await storage.getDeliveryLocationById(quotation.deliveryLocationId);
    }
    
    // Buscar cotação do fornecedor selecionado para informações adicionais
    if (quotation) {
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      selectedSupplierQuotation = supplierQuotations.find(sq => sq.isChosen) || supplierQuotations[0];
    }
    
    // Os itens do pedido de compra já têm os preços corretos, apenas formatá-los
    const itemsWithPrices = items.map(item => ({
      ...item,
      // Garantir que os campos estejam no formato esperado
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.totalPrice) || 0,
      brand: '', // Campo não disponível nos itens do pedido de compra
      deliveryTime: '', // Campo não disponível nos itens do pedido de compra
      originalUnitPrice: Number(item.unitPrice) || 0,
      originalTotalPrice: Number(item.totalPrice) || 0,
      itemDiscount: 0 // Desconto já aplicado no preço final
    }));

    // Buscar histórico de aprovações
    const approvalHistory = await storage.getApprovalHistory(purchaseRequestId);

    // Buscar dados do comprador (buyer)
    let buyer = null;
    if (purchaseRequest.buyerId) {
      buyer = await storage.getUser(purchaseRequest.buyerId);
    }

    const data: PurchaseOrderData = {
      purchaseRequest: {
        ...purchaseRequest,
        departmentName: department?.name || 'Não informado'
      },
      items: itemsWithPrices,
      supplier,
      approvalHistory,
      selectedSupplierQuotation,
      deliveryLocation,
      company,
      buyer
    };

    // Gerar HTML
    const html = await this.generatePurchaseOrderHTML(data);

    // Gerar PDF usando sistema de fallback robusto
    return await this.generatePDFWithFallback(html, 'purchase-order');
  }

  private static generateCompletionSummaryHTML(data: any): string {
    const { 
      purchaseRequest, 
      items, 
      completeTimeline, 
      requester, 
      department, 
      costCenter, 
      selectedSupplier, 
      selectedSupplierQuotation,
      supplierQuotationItems 
    } = data;
    
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    // Calcular valor total usando os itens de cotação do fornecedor selecionado
    let totalValue = 0;
    let itemsWithPrices = items.map((item: any) => {
      const quotationItem = supplierQuotationItems.find((qi: any) => 
        qi.itemDescription === item.description
      );
      const unitPrice = quotationItem ? Number(quotationItem.unitPrice) : 0;
      const totalPrice = Number(item.quantity) * unitPrice;
      totalValue += totalPrice;
      
      return {
        ...item,
        unitPrice,
        totalPrice
      };
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Conclusão - ${purchaseRequest.requestNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 16px;
            color: #666;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
          }
          .info-item {
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          .info-value {
            color: #333;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .table th, .table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .table th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .total-row {
            background-color: #f9f9f9;
            font-weight: bold;
          }
          .timeline {
            margin-top: 15px;
          }
          .timeline-item {
            margin-bottom: 10px;
            padding: 10px;
            border-left: 3px solid #007bff;
            background-color: #f8f9fa;
          }
          .timeline-date {
            font-weight: bold;
            color: #007bff;
          }
          .timeline-action {
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Relatório de Conclusão de Compra</div>
          <div class="subtitle">Solicitação: ${purchaseRequest.requestNumber}</div>
        </div>

        <div class="section">
          <div class="section-title">Informações Gerais</div>
          <div class="info-grid">
            <div>
              <div class="info-item">
                <span class="info-label">Solicitante:</span>
                <span class="info-value">${requester ? `${requester.firstName} ${requester.lastName}` : 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Departamento:</span>
                <span class="info-value">${department?.name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Centro de Custo:</span>
                <span class="info-value">${costCenter?.name || 'N/A'}</span>
              </div>
            </div>
            <div>
              <div class="info-item">
                <span class="info-label">Data da Solicitação:</span>
                <span class="info-value">${formatDate(purchaseRequest.createdAt)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Data de Conclusão:</span>
                <span class="info-value">${purchaseRequest.receivedDate ? formatDate(purchaseRequest.receivedDate) : 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Urgência:</span>
                <span class="info-value">${purchaseRequest.urgency || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        ${selectedSupplier ? `
        <div class="section">
          <div class="section-title">Fornecedor Selecionado</div>
          <div class="info-grid">
            <div>
              <div class="info-item">
                <span class="info-label">Nome:</span>
                <span class="info-value">${selectedSupplier.name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">CNPJ:</span>
                <span class="info-value">${selectedSupplier.cnpj || 'N/A'}</span>
              </div>
            </div>
            <div>
              <div class="info-item">
                <span class="info-label">E-mail:</span>
                <span class="info-value">${selectedSupplier.email || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Telefone:</span>
                <span class="info-value">${selectedSupplier.phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Itens Adquiridos</div>
          <table class="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Unidade</th>
                <th>Quantidade</th>
                <th>Valor Unitário</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsWithPrices.map((item: any) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.unit}</td>
                  <td>${parseInt(item.quantity) || 0}</td>
                  <td>${formatCurrency(item.unitPrice)}</td>
                  <td>${formatCurrency(item.totalPrice)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4"><strong>TOTAL GERAL</strong></td>
                <td><strong>${formatCurrency(totalValue)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        ${completeTimeline && completeTimeline.length > 0 ? `
        <div class="section">
          <div class="section-title">Histórico do Processo de Compra</div>
          <div class="timeline">
            ${completeTimeline.map((event: any) => {
              // Mapeamento de fases para português
              const phaseLabels: Record<string, string> = {
                'solicitacao': 'Solicitação',
                'aprovacao_a1': 'Aprovação A1',
                'cotacao': 'Cotação (RFQ)',
                'aprovacao_a2': 'Aprovação A2',
                'pedido_compra': 'Pedido de Compra',
                'recebimento': 'Recebimento',
                'conclusao_compra': 'Conclusão',
                'arquivado': 'Arquivado'
              };
              
              const phaseLabel = phaseLabels[event.phase] || event.phase;
              const eventDate = event.timestamp ? formatDate(new Date(event.timestamp)) : 'N/A';
              const userName = event.userName || 'Sistema';
              
              return `
              <div class="timeline-item">
                <div class="timeline-date">${eventDate}</div>
                <div class="timeline-action">
                  <strong>${phaseLabel}</strong><br>
                  Por: <strong>${userName}</strong>
                  ${event.description ? `<br>${event.description}` : ''}
                  ${event.reason ? `<br>Motivo: ${event.reason}` : ''}
                </div>
              </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${selectedSupplierQuotation ? `
        <div class="section">
          <div class="section-title">Dados da Cotação Vencedora</div>
          <div class="info-grid">
            <div>
              <div class="info-item">
                <span class="info-label">Valor Total da Cotação:</span>
                <span class="info-value">${formatCurrency(Number(selectedSupplierQuotation.totalValue || 0))}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Prazo de Entrega:</span>
                <span class="info-value">${selectedSupplierQuotation.deliveryTime || 'N/A'}</span>
              </div>
            </div>
            <div>
              <div class="info-item">
                <span class="info-label">Condições de Pagamento:</span>
                <span class="info-value">${selectedSupplierQuotation.paymentTerms || selectedSupplier?.paymentTerms || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Observações:</span>
                <span class="info-value">${selectedSupplierQuotation.observations || 'N/A'}</span>
              </div>
            </div>
          </div>
          ${(selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) ? `
          <div class="info-item" style="margin-top: 15px;">
            <span class="info-label">Desconto da Proposta:</span>
            <span class="info-value">${selectedSupplierQuotation.discountType === 'percentage' 
              ? `${selectedSupplierQuotation.discountValue}%` 
              : formatCurrency(Number(selectedSupplierQuotation.discountValue))}</span>
          </div>
          ` : ''}
          ${selectedSupplierQuotation.justification ? `
          <div class="info-item" style="margin-top: 15px;">
            <span class="info-label">Justificativa da Escolha:</span><br>
            <span class="info-value">${selectedSupplierQuotation.justification}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}

      </body>
      </html>
    `;
  }
}