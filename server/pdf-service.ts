import puppeteer from 'puppeteer';
import htmlPdf from 'html-pdf-node';
import { storage } from './storage';
import { fileStorageService } from "./services/file-storage-service";
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { templateService } from "./services/template-service";
import { formatCurrency, formatDate, formatDateTime } from "./utils/formatters";

interface PurchaseOrderData {
  purchaseRequest: any;
  items: any[];
  supplier: any;
  approvalHistory: any[];
  selectedSupplierQuotation?: any;
  deliveryLocation?: any;
  company?: any;
  buyer?: any;
  purchaseOrder?: any;
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
      process.env.GOOGLE_CHROME_BIN,
      process.env.GOOGLE_CHROME_SHIM,
      process.env.MSEDGE_PATH
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
      '--disable-print-preview',
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

    const bundledPath = (() => {
      try {
        const p = puppeteer.executablePath();
        return p && fs.existsSync(p) ? p : undefined;
      } catch {
        return undefined;
      }
    })();

    const configurations = [
      // 1) Usar Chromium/Chrome empacotado pelo Puppeteer
      ...(bundledPath ? [{
        executablePath: bundledPath,
        args: baseArgs,
        headless: 'new',
        timeout: 60000,
        ignoreDefaultArgs: false
      }] : []),
      // 2) Browser detectado automaticamente no sistema
      ...(detectedBrowserPath ? [{
        executablePath: detectedBrowserPath,
        args: baseArgs,
        headless: 'new',
        timeout: 60000,
        ignoreDefaultArgs: false
      }] : []),
      // 3) Canal do Chrome/Edge, quando disponível
      ...(this.isWindows() ? [{
        channel: 'chrome',
        args: baseArgs,
        headless: 'new',
        timeout: 60000
      },{
        channel: 'msedge',
        args: baseArgs,
        headless: 'new',
        timeout: 60000
      }] : []),
      // 4) Sem path específico (deixa Puppeteer escolher)
      {
        args: baseArgs,
        headless: 'new',
        timeout: 60000,
        ignoreDefaultArgs: false
      },
      // 5) Minimal no Windows
      ...(this.isWindows() ? [{
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          `--user-data-dir=${tempDir}`,
          `--data-path=${tempDir}`,
          `--temp-dir=${tempDir}`
        ],
        headless: true,
        timeout: 60000,
        ignoreDefaultArgs: true
      }] : []),
      // 6) Ultra minimal
      {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
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
          const cfg = configurations[i] as any;
          const browser = await puppeteer.launch(cfg);
          return browser;
        } catch (error) {
          lastError = error;
          if (retry < retries - 1) {
            const delay = 1000 * (retry + 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }
    
    throw new Error(`Falha ao lançar browser após todas as tentativas. Último erro: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  // Método de fallback que retorna o HTML quando PDF falha
  private static async generatePDFWithFallback(html: string, pdfType: string): Promise<Buffer> {
    try {
      const pdfBuffer = await this.generatePDFWithPuppeteer(html);
      return pdfBuffer;
    } catch (puppeteerError) {
      try {
        const pdfBuffer = await this.generatePDFWithPuppeteer(html);
        return pdfBuffer;
      } catch (secondError) {
        try {
          const wkhtmlBuffer = await this.generatePDFWithWkhtml(html);
          return wkhtmlBuffer;
        } catch (wkError) {}

        const htmlDocument = `<!-- HTML_FALLBACK_MARKER -->\n<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="UTF-8">\n    <title>Pedido de Compra</title>\n    <style>\n        @media print {\n            body { margin: 0; }\n            .no-print { display: none; }\n        }\n        body { font-family: Arial, sans-serif; margin: 20px; }\n    </style>\n</head>\n<body>\n    <div class="no-print" style="background: #f0f0f0; padding: 10px; margin-bottom: 20px; border-radius: 5px;">\n        <strong>Documento HTML</strong><br>\n        Use Ctrl+P para imprimir ou salvar como PDF\n    </div>\n    ${html}\n</body>\n</html>`;
        return Buffer.from(htmlDocument, 'utf8');
      }
    }
  }

  private static async generatePDFWithWkhtml(html: string): Promise<Buffer> {
    const tempDir = await this.ensureTempDirectories();
    const htmlPath = path.join(tempDir, `wk_${Date.now()}.html`);
    const pdfPath = path.join(tempDir, `wk_${Date.now()}.pdf`);

    const adjustedHtml = this.injectWkhtmlStyles(html);
    fs.writeFileSync(htmlPath, adjustedHtml, 'utf8');

    const possiblePaths = [
      process.env.WKHTMLTOPDF_PATH,
      'C\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
      'C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
      'C:\\Program Files (x86)\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
      '/usr/bin/wkhtmltopdf',
      '/usr/local/bin/wkhtmltopdf'
    ].filter(Boolean) as string[];

    let binaryPath: string | undefined;
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) { binaryPath = p; break; }
    }
    if (!binaryPath) throw new Error('wkhtmltopdf não encontrado');

    await new Promise<void>((resolve, reject) => {
      const args = [
        '--quiet',
        '--print-media-type',
        '--encoding', 'utf-8',
        '--dpi', '96',
        '--zoom', '1.0',
        '-s', 'A4',
        '-B', '20mm',
        '-L', '15mm',
        '-R', '15mm',
        '-T', '20mm',
        htmlPath,
        pdfPath
      ];
      execFile(binaryPath!, args, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (!fs.existsSync(pdfPath)) throw new Error('wkhtmltopdf não gerou o arquivo');
    const buf = fs.readFileSync(pdfPath);
    try { fs.unlinkSync(htmlPath); } catch {}
    try { fs.unlinkSync(pdfPath); } catch {}
    return buf;
  }

  private static injectWkhtmlStyles(html: string): string {
    const wkStyles = `\n<style>\n  .header{display:table;width:100%;table-layout:fixed;padding-top:10px;padding-bottom:12px;min-height:150px}\n  .header-logo{display:table-cell;width:180px;vertical-align:middle;padding-right:20px}\n  .header-logo img{max-width:170px;max-height:100px}\n  .header-info{display:table-cell;text-align:center;vertical-align:middle;padding:0 10px}\n  .header-info h1{font-size:19px;margin:10px 0 8px;line-height:1.35}\n  .header-info h2{font-size:16px;margin:8px 0;line-height:1.35;color:#333}\n  .header-info p{margin:5px 0;line-height:1.3}\n  .qr-code-container{display:table-cell;width:130px;vertical-align:middle;text-align:right;position:static;padding-left:10px}\n  .qr-code-container img{width:100px;height:100px;display:inline-block;margin:0}\n  .info-grid{display:table;width:100%;table-layout:fixed;margin-top:8px}\n  .info-grid>div{display:table-cell;width:50%;vertical-align:top;padding-right:20px}\n  .electronic-signature-grid{display:table;width:100%}\n  .electronic-signature-grid .signature-electronic{display:table-cell;width:50%;vertical-align:top}\n  .electronic-signature-grid-three{display:table;width:100%}\n  .electronic-signature-grid-three .signature-electronic{display:table-cell;width:33%;vertical-align:top}\n</style>\n`;
    if (html.includes('</head>')) {
      return html.replace('</head>', wkStyles + '</head>');
    }
    return wkStyles + html;
  }

  // Geração de PDF usando Puppeteer (método original melhorado)
  private static async generatePDFWithPuppeteer(html: string): Promise<Buffer> {
    const isValidPdf = (buffer: Buffer) => {
      try {
        const headSlice = buffer.slice(0, 16).toString('latin1');
        const hasHeader = headSlice.includes('%PDF-');
        const tailSlice = buffer.slice(Math.max(0, buffer.length - 2048)).toString('latin1');
        const hasEofNearEnd = tailSlice.includes('%%EOF');
        const hasEofAnywhere = hasEofNearEnd || buffer.toString('latin1').includes('%%EOF');
        return hasHeader && hasEofAnywhere;
      } catch {
        return false;
      }
    };

    const browser = await this.launchBrowserWithRetry();
    let page = null;
    
    try {
      page = await browser.newPage();
      await page.setDefaultTimeout(45000);
      await page.emulateMediaType('print');
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      await page.goto(dataUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForSelector('body');
      try { await page.evaluate(() => (document as any).fonts?.ready); } catch {}
      
      // Aguardar um pouco para garantir que CSS foi processado (compatível com todas as versões)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      });
      try {
      } catch {}
      if (!isValidPdf(pdfBuffer)) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.reload({ waitUntil: 'networkidle0' });
        pdfBuffer = await page.pdf({
          format: 'A4',
          margin: {
            top: '20mm', right: '15mm', bottom: '20mm', left: '15mm'
          },
          printBackground: true,
          preferCSSPageSize: true
        });
        try {
        } catch {}
        if (!isValidPdf(pdfBuffer)) {
          try {
            const stream = await (page as any).createPDFStream({
              format: 'A4',
              margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
              printBackground: true,
              preferCSSPageSize: true
            });
            pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
              const chunks: Buffer[] = [];
              stream.on('data', (c: Buffer) => chunks.push(c));
              stream.on('end', () => resolve(Buffer.concat(chunks)));
              stream.on('error', reject);
            });
            if (!isValidPdf(pdfBuffer)) {
              throw new Error('PDF gerado inválido (integridade ausente)');
            }
          } catch {
            throw new Error('PDF gerado inválido (integridade ausente)');
          }
        }
      }

      return pdfBuffer;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
        }
      }
      try {
        await browser.close();
      } catch (err) {
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

      const html = await this.generateCompletionSummaryHTML({
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
      throw error;
    }
  }

  static async generateDashboardPDF(dashboardData: any): Promise<Buffer> {
    try {
      const html = await this.generateDashboardHTML(dashboardData);
      return await this.generatePDFWithFallback(html, 'dashboard');
    } catch (error) {
      throw error;
    }
  }

  private static async generateDashboardHTML(data: any): Promise<string> {
    const departmentRows = (data.requestsByDepartment || []).map((item: any) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.value}</td>
      </tr>
    `).join('');

    const urgencyRows = (data.urgencyDistribution || []).map((item: any) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.value}</td>
      </tr>
    `).join('');

    const topDepartmentRows = (data.topDepartments || []).map((item: any) => `
      <tr>
        <td>${item.name}</td>
        <td>${formatCurrency(item.totalValue)}</td>
        <td>${item.requestCount}</td>
      </tr>
    `).join('');

    return await templateService.render("pdf/dashboard", {
      generatedDate: formatDate(new Date()),
      totalActiveRequests: data.totalActiveRequests || 0,
      totalProcessingValue: formatCurrency(data.totalProcessingValue || 0),
      averageApprovalTime: data.averageApprovalTime || 0,
      approvalRate: data.approvalRate || 0,
      departmentRows,
      urgencyRows,
      topDepartmentRows,
    });
  }

  private static async generateApprovalA2HTML(data: any): Promise<string> {
    const { purchaseRequest, items, supplier, approvalHistory, selectedSupplierQuotation, supplierQuotations, deliveryLocation, company, requester, quotationItems } = data;
    

    let qrCodeHtml = '';
    try {
      const frontendUrl = process.env.FRONTEND_URL || 
                         (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
      const trackingUrl = `${frontendUrl}/public/request/${purchaseRequest.id}`;
      const qrCodeDataURL = await QRCode.toDataURL(trackingUrl, {
        width: 100, margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      qrCodeHtml = `<div class="qr-code-container"><img src="${qrCodeDataURL}" alt="QR Code"><div class="qr-code-text">Acompanhe online</div></div>`;
    } catch {}

    const companyLogoBase64 = await getCompanyLogoBase64(company);
    const companyLogoHtml = companyLogoBase64 ? `<div class="header-logo"><img src="${companyLogoBase64}" alt="Logo da Empresa"></div>` : '';
    
    const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.totalPrice) || 0), 0);
    const itemDiscountTotal = items.reduce((sum: number, item: any) => sum + (Number(item.itemDiscount) || 0), 0);
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

    const selectedSupplierHtml = supplier ? `
      <div class="section">
        <div class="section-title">Fornecedor Selecionado</div>
        <div class="info-grid">
          <div>
            <div class="info-item"><span class="info-label">Nome:</span> ${supplier.name}</div>
            <div class="info-item"><span class="info-label">CNPJ:</span> ${supplier.cnpj || 'Não informado'}</div>
            <div class="info-item"><span class="info-label">Email:</span> ${supplier.email || 'Não informado'}</div>
          </div>
          <div>
            <div class="info-item"><span class="info-label">Telefone:</span> ${supplier.phone || 'Não informado'}</div>
          </div>
        </div>
      </div>` : '';

    const itemRows = items.map((item: any, index: number) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>${item.description}</td>
        <td class="text-center">${Number(item.quantity) || 0}</td>
        <td class="text-center">${item.unit || 'UN'}</td>
        <td class="text-right">${item.discountPercentage ? item.discountPercentage + '%' : (item.itemDiscount ? formatCurrency(item.itemDiscount) : '-')}</td>
        <td class="text-right">${formatCurrency(item.unitPrice)}</td>
        <td class="text-right">${formatCurrency(item.totalPrice)}</td>
      </tr>`).join('');

    const deliveryLocationHtml = deliveryLocation ? `
      <div class="section">
        <div class="section-title">Local de Entrega</div>
        <div class="info-grid">
          <div>
            <div class="info-item"><span class="info-label">Nome:</span> ${deliveryLocation.name}</div>
            <div class="info-item"><span class="info-label">Endereço:</span> ${deliveryLocation.address}</div>
          </div>
        </div>
      </div>` : '';

    const approvalHistoryRows = approvalHistory.map((approval: any) => `
      <tr>
        <td>${approval.approverType}</td>
        <td>${approval.approver ? `${approval.approver.firstName} ${approval.approver.lastName || ''}`.trim() : 'N/A'}</td>
        <td>${formatDate(approval.createdAt)}</td>
        <td>
          <span class="approval-status ${approval.approved === true ? 'approval-approved' : approval.approved === false ? 'approval-rejected' : 'approval-pending'}">
            ${approval.approved === true ? 'Aprovado' : approval.approved === false ? 'Rejeitado' : 'Pendente'}
          </span>
        </td>
        <td>${approval.rejectionReason || '-'}</td>
      </tr>`).join('');

    const supplierComparisonHtml = (supplierQuotations && supplierQuotations.length > 0) ? `
      <div class="section">
        <div class="section-title">Comparação de Fornecedores</div>
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th class="text-right">Valor Total</th>
              <th>Prazo</th>
              <th>Pagamento</th>
              <th>Garantia</th>
              <th class="text-right">Desconto</th>
              <th class="text-right">Frete</th>
            </tr>
          </thead>
          <tbody>
            ${supplierQuotations.map((sq: any) => `
            <tr class="${sq.isChosen ? 'supplier-comparison-row selected' : 'supplier-comparison-row'}">
              <td>${sq.supplierName}${sq.isChosen ? '<span class="badge-selected">Selecionado</span>' : ''}</td>
              <td class="text-right">${formatCurrency(Number(sq.totalValue))}</td>
              <td>${sq.deliveryTerms || '-'}</td>
              <td>${sq.paymentTerms || '-'}</td>
              <td>${sq.warrantyPeriod || '-'}</td>
              <td class="text-right">${sq.discountType === 'percentage' ? `${sq.discountValue}%` : (sq.discountValue && Number(sq.discountValue) > 0 ? formatCurrency(Number(sq.discountValue)) : '-')}</td>
              <td class="text-right">${Number(sq.freightValue) > 0 ? formatCurrency(Number(sq.freightValue)) : '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    let comparisonMatrixHtml = '';
    if (supplierQuotations.length > 0 && items.length > 0) {
      comparisonMatrixHtml = `
      <div class="section-title" style="margin-top: 20px;">Comparação Detalhada de Itens</div>
      <div class="comparison-matrix">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="item-col">Item</th>
              ${supplierQuotations.map((sq: any) => `
                <th class="supplier-col ${sq.isChosen ? 'selected-header' : ''}">
                  ${sq.supplierName}${sq.isChosen ? '<div class="selected-badge">Selecionado</div>' : ''}
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => {
              const quotationItemId = item.quotationItemId ?? item.id;
              let quotationItem = quotationItems && quotationItems.find((qi: any) => qi.id === quotationItemId);
              if (!quotationItem && item.description && quotationItems) {
                const normalized = item.description.trim().toLowerCase();
                quotationItem = quotationItems.find((qi: any) => qi.description && qi.description.trim().toLowerCase() === normalized);
              }
              let lowestPrice = Infinity;
              supplierQuotations.forEach((sq: any) => {
                const sqItem = sq.items && sq.items.find((i: any) => (quotationItem && i.quotationItemId === quotationItem.id));
                if (sqItem) {
                  const quantity = Number(sqItem.availableQuantity || item.quantity);
                  const unitPrice = Number(sqItem.unitPrice) || 0;
                  const totalPrice = Number(sqItem.totalPrice) || (unitPrice * quantity);
                  if (totalPrice > 0 && totalPrice < lowestPrice) lowestPrice = totalPrice;
                }
              });
              return `
                <tr>
                  <td class="item-name">${item.description}</td>
                  ${supplierQuotations.map((sq: any) => {
                    const sqItem = sq.items && sq.items.find((i: any) => (quotationItem && i.quotationItemId === quotationItem.id));
                    const quantity = sqItem ? Number(sqItem.availableQuantity || item.quantity) : item.quantity;
                    const unitPrice = sqItem ? Number(sqItem.unitPrice) : 0;
                    const totalPrice = sqItem ? (Number(sqItem.totalPrice) || (unitPrice * quantity)) : 0;
                    const isLowest = totalPrice > 0 && Math.abs(totalPrice - lowestPrice) < 0.01;
                    return `
                      <td class="supplier-cell ${sq.isChosen ? 'selected-cell' : ''}">
                        ${sqItem ? `
                          <div class="price-container ${isLowest ? 'lowest-price' : ''}">
                            ${isLowest ? '<div class="best-value-badge">Melhor valor</div>' : ''}
                            <div class="qty-row">Quantidade: ${quantity} ${item.unit}</div>
                            <div class="unit-row">Vlr. Unit.: ${formatCurrency(unitPrice)}</div>
                            <div class="total-row-item">Vlr Final: ${formatCurrency(totalPrice)}</div>
                          </div>` : '<div class="no-quote">-</div>'}
                      </td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }

    return await templateService.render("pdf/approval-a2", {
      companyLogoHtml,
      qrCodeHtml,
      requestNumber: purchaseRequest.requestNumber,
      generationDate: formatDate(new Date().toISOString()),
      companyName: company?.name || '',
      requesterName: requester?.firstName ? `${requester.firstName} ${requester.lastName || ''}`.trim() : requester?.username || 'Não informado',
      departmentName: purchaseRequest.departmentName,
      costCenterName: purchaseRequest.costCenterName,
      createdAt: formatDate(purchaseRequest.createdAt),
      deliveryDate: formatDate(purchaseRequest.deliveryDate),
      urgency: purchaseRequest.urgency || 'Normal',
      finalValue: formatCurrency(valorFinal),
      justification: purchaseRequest.justification,
      selectedSupplierHtml,
      itemRows,
      subtotal: formatCurrency(subtotal),
      hasDiscount: desconto > 0,
      discount: formatCurrency(desconto),
      hasFreight: freightValue > 0,
      freight: formatCurrency(freightValue),
      deliveryLocationHtml,
      approvalHistoryRows,
      supplierComparisonHtml,
      comparisonMatrixHtml,
      timestamp: new Date().toLocaleString('pt-BR')
    });
  }

  private static async generatePurchaseOrderHTML(data: PurchaseOrderData): Promise<string> {
    const { purchaseRequest, items, supplier, approvalHistory, selectedSupplierQuotation, deliveryLocation, company, buyer, purchaseOrder } = data;
    

    let qrCodeHtml = '';
    try {
      const frontendUrl = process.env.FRONTEND_URL || 
                         (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
      const trackingUrl = `${frontendUrl}/public/request/${purchaseRequest.id}`;
      const qrCodeDataURL = await QRCode.toDataURL(trackingUrl, {
        width: 100, margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      qrCodeHtml = `<div class="qr-code-container"><img src="${qrCodeDataURL}" alt="QR Code" /><div class="qr-code-text">Escaneie para acompanhar</div></div>`;
    } catch {}

    const companyLogoBase64 = await getCompanyLogoBase64(company);
    const companyLogoHtml = companyLogoBase64 ? `<div class="header-logo"><img src="${companyLogoBase64}" alt="Logo da Empresa" /></div>` : '';
    
    const subtotal = items.reduce((sum, item) => sum + (Number(item.originalTotalPrice) || Number(item.totalPrice) || 0), 0);
    const itemDiscountTotal = items.reduce((sum, item) => sum + (Number(item.itemDiscount) || 0), 0);
    
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
    
    const aprovacaoA1 = approvalHistory.find(h => h.approverType === 'A1');
    const aprovacaoA2 = approvalHistory.find(h => h.approverType === 'A2');
    
    const itemRows = items.map(item => {
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
              `<span style="text-decoration: line-through; color: #999;">R$ ${originalUnitPrice.toFixed(4).replace('.', ',')}</span><br>
               <span style="color: #28a745; font-weight: bold;">R$ ${(finalTotalPrice / Number(item.quantity || 1)).toFixed(4).replace('.', ',')}</span>` :
              `R$ ${originalUnitPrice.toFixed(4).replace('.', ',')}`
            }
          </td>
          <td class="text-right">
            ${hasDiscount ? 
              `<span style="text-decoration: line-through; color: #999;">R$ ${originalTotalPrice.toFixed(4).replace('.', ',')}</span><br>
               <span style="color: #28a745; font-weight: bold;">R$ ${finalTotalPrice.toFixed(4).replace('.', ',')}</span>` :
              `R$ ${originalTotalPrice.toFixed(4).replace('.', ',')}`
            }
          </td>
          <td>${item.specifications || ''}</td>
        </tr>`;
    }).join('');

    const fillerRows = Array(Math.max(0, 8 - items.length)).fill(0).map(() => `
      <tr>
        <td class="text-center">&nbsp;</td>
        <td class="text-center">&nbsp;</td>
        <td>&nbsp;</td>
        <td class="text-center">&nbsp;</td>
        <td class="text-right">&nbsp;</td>
        <td class="text-right">&nbsp;</td>
        <td>&nbsp;</td>
      </tr>`).join('');

    let totalRows = '';
    if (desconto > 0 || freightValue > 0) {
      totalRows = `
        <tr class="subtotal-row">
          <td colspan="5" class="text-right"><strong>SUBTOTAL:</strong></td>
          <td class="text-right"><strong>R$ ${subtotal.toFixed(4).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>
        ${desconto > 0 ? `
        <tr class="discount-row">
          <td colspan="5" class="text-right"><strong>TOTAL DESCONTO:</strong></td>
          <td class="text-right"><strong>- R$ ${desconto.toFixed(4).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>` : ''}
        ${freightValue > 0 ? `
        <tr class="subtotal-row">
          <td colspan="5" class="text-right"><strong>FRETE:</strong></td>
          <td class="text-right"><strong>R$ ${freightValue.toFixed(4).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>` : ''}
        <tr class="total-row">
          <td colspan="5" class="text-right"><strong>TOTAL FINAL:</strong></td>
          <td class="text-right"><strong>R$ ${valorFinal.toFixed(4).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>`;
    } else {
      totalRows = `
        <tr class="total-row">
          <td colspan="5" class="text-right"><strong>TOTAL GERAL:</strong></td>
          <td class="text-right"><strong>R$ ${(subtotal + freightValue).toFixed(4).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>`;
    }

    const renderSignature = (approval: any, role: string) => {
      const name = approval?.approver ? `${approval.approver.firstName || ''} ${approval.approver.lastName || ''}`.trim() || approval.approver.username : 'Não informado';
      const dateText = approval ? `${new Date(approval.createdAt).toLocaleDateString('pt-BR')} às ${new Date(approval.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}` : 'Não assinado';
      return `
        <div class="signature-electronic">
          <div class="signature-header">ASSINADO ELETRONICAMENTE POR:</div>
          <div class="signature-name">${name}</div>
          <div class="signature-role">${role}</div>
          <div class="signature-date">${dateText}</div>
        </div>`;
    };

    const buyerSignatureHtml = `
      <div class="signature-electronic">
        <div class="signature-header">ASSINADO ELETRONICAMENTE POR:</div>
        <div class="signature-name">${buyer ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || buyer.username : 'Comprador não definido'}</div>
        <div class="signature-role">Comprador</div>
        <div class="signature-date">${new Date(purchaseRequest.createdAt || new Date()).toLocaleDateString('pt-BR')} às ${new Date(purchaseRequest.createdAt || new Date()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>
      </div>`;

    const a1SignatureHtml = renderSignature(aprovacaoA1, "Aprovador A1");
    const a2SignatureHtml = renderSignature(aprovacaoA2, "Aprovador A2 (Liberador)");

    return await templateService.render("pdf/purchase-order", {
      orderNumber: purchaseOrder?.orderNumber || '',
      companyLogoHtml,
      companyName: company?.name || company?.tradingName || 'EMPRESA NÃO INFORMADA',
      companyAddress: company?.address,
      companyCnpj: company?.cnpj,
      companyPhone: company?.phone,
      companyEmail: company?.email,
      qrCodeHtml,
      supplierName: supplier?.name || 'Não informado',
      supplierCnpj: supplier?.cnpj || 'Não informado',
      supplierAddress: supplier?.address || 'Não informado',
      supplierContact: supplier?.contactPerson || 'Não informado',
      supplierPhone: supplier?.phone || 'Não informado',
      hasProposalDiscount: (selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue),
      proposalDiscount: selectedSupplierQuotation?.discountType === 'percentage' ? `${selectedSupplierQuotation.discountValue}%` : `R$ ${Number(selectedSupplierQuotation?.discountValue || 0).toFixed(4).replace('.', ',')}`,
      deliveryName: deliveryLocation?.name || 'Sede da empresa',
      deliveryAddress: deliveryLocation?.address || 'Av. Nathan Lemos Xavier de Albuquerque, 1.328, Novo Aleixo, Manaus-AM, 69098-145',
      deliveryContact: deliveryLocation?.contactPerson,
      deliveryPhone: deliveryLocation?.phone,
      deliveryEmail: deliveryLocation?.email,
      requestNumber: purchaseRequest.requestNumber,
      requesterName: purchaseRequest.requesterName || (purchaseRequest.requester ? `${purchaseRequest.requester.firstName || ''} ${purchaseRequest.requester.lastName || ''}`.trim() : 'Não informado'),
      departmentName: purchaseRequest.departmentName || 'Não informado',
      orderDate: formatDate(purchaseOrder?.createdAt || purchaseRequest.createdAt),
      deliveryDeadline: selectedSupplierQuotation?.deliveryDate ? formatDate(selectedSupplierQuotation.deliveryDate) : (selectedSupplierQuotation?.deliveryTerms || formatDate(purchaseRequest.idealDeliveryDate)),
      paymentTerms: selectedSupplierQuotation?.paymentTerms || supplier?.paymentTerms || 'A definir',
      itemRows,
      fillerRows,
      totalRows,
      description: purchaseRequest.description || 'Nenhuma observação adicional.',
      urgencyLevel: purchaseRequest.urgencyLevel,
      budgetCenter: purchaseRequest.budgetCenter,
      buyerSignatureHtml,
      a1SignatureHtml,
      a2SignatureHtml,
      timestamp: new Date().toLocaleString('pt-BR')
    });
  }

  static async generateApprovalA2PDF(purchaseRequestId: number): Promise<Buffer> {
    // Buscar dados da solicitação
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
    if (!purchaseRequest) {
      throw new Error('Solicitação de compra não encontrada');
    }

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
    let itemsWithPrices: any[] = [];
    let deliveryLocation = null;
    let enrichedSupplierQuotations: any[] = [];
    let quotationItems: any[] = [];
    
    const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
    
    // Buscar local de entrega se a cotação existir
    if (quotation && quotation.deliveryLocationId) {
      deliveryLocation = await storage.getDeliveryLocationById(quotation.deliveryLocationId);
    }
    
    if (quotation) {
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      
      // Buscar items da cotação
      quotationItems = await storage.getQuotationItems(quotation.id);

      // Enriquecer cotações com nomes dos fornecedores
      enrichedSupplierQuotations = await Promise.all(supplierQuotations.map(async (sq) => {
        const s = await storage.getSupplierById(sq.supplierId);
        const sqItems = await storage.getSupplierQuotationItems(sq.id);
        
        return {
          ...sq,
          supplierName: s?.name || 'Fornecedor Desconhecido',
          cnpj: s?.cnpj || '',
          email: s?.email || '',
          phone: s?.phone || '',
          items: sqItems // Adicionar items para comparação detalhada
        };
      }));

      selectedSupplierQuotation = supplierQuotations.find(sq => sq.isChosen) || supplierQuotations[0];
      
      if (selectedSupplierQuotation) {
        supplier = await storage.getSupplierById(selectedSupplierQuotation.supplierId);
        
        // Buscar os itens do fornecedor selecionado com preços
        const supplierItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
        const currentQuotationItems = await storage.getQuotationItems(quotation.id);
        const approvedItems = await storage.getApprovedQuotationItems(quotation.id);
        const approvedSupplierItemIds = new Set(
          approvedItems.map((i: any) => i.supplierQuotationItemId),
        );
        const hasApprovedItems = approvedItems.length > 0;

        itemsWithPrices = supplierItems
          .filter((si: any) => {
            if (hasApprovedItems) {
              return approvedSupplierItemIds.has(si.id);
            }
            return si.isAvailable !== false;
          })
          .map((si: any) => {
            const qi = currentQuotationItems.find((q: any) => q.id === si.quotationItemId);
            const description = qi?.description || '';
            const unit = si.confirmedUnit || qi?.unit || 'UN';
            const quantityRaw = si.availableQuantity ?? qi?.quantity ?? 0;
            const quantity = Number(quantityRaw) || 0;
            const unitPrice = Number(si.unitPrice) || 0;

            const storedTotalPrice = Number(si.totalPrice) || 0;
            const originalTotalPrice = storedTotalPrice > 0 ? storedTotalPrice : unitPrice * quantity;

            const discountedCandidate = si.discountedTotalPrice ? Number(si.discountedTotalPrice) : 0;
            const discountPercentage = Number(si.discountPercentage) || 0;
            const discountValue = Number(si.discountValue) || 0;

            let totalPrice = originalTotalPrice;
            let itemDiscount = 0;

            if (discountedCandidate > 0) {
              totalPrice = discountedCandidate;
              itemDiscount = Math.max(0, originalTotalPrice - totalPrice);
            } else if (discountPercentage > 0) {
              itemDiscount = (originalTotalPrice * discountPercentage) / 100;
              totalPrice = Math.max(0, originalTotalPrice - itemDiscount);
            } else if (discountValue > 0) {
              itemDiscount = discountValue;
              totalPrice = Math.max(0, originalTotalPrice - itemDiscount);
            }

            return {
              quotationItemId: qi?.id || si.quotationItemId,
              description,
              quantity,
              unit,
              unitPrice,
              originalUnitPrice: unitPrice,
              itemDiscount,
              discountPercentage: discountPercentage > 0 ? discountPercentage : 0,
              brand: si.brand || '',
              deliveryTime: si.deliveryDays ? `${si.deliveryDays} dias` : '',
              totalPrice,
              originalTotalPrice,
            };
          });
      }
    }

    // Buscar histórico de aprovações
    let approvalHistory = await storage.getApprovalHistory(purchaseRequestId);

    // Fallback: Se o histórico estiver vazio ou incompleto, verificar colunas da solicitação
    const hasA1 = approvalHistory.some(h => h.approverType === 'A1');
    const hasA2 = approvalHistory.some(h => h.approverType === 'A2');
    
    // Check A1 Fallback
    if (!hasA1 && purchaseRequest.approvalDateA1) {
      let approverA1 = null;
      if (purchaseRequest.approverA1Id) {
        approverA1 = await storage.getUser(purchaseRequest.approverA1Id);
      }
      
      approvalHistory.push({
        id: -1, // ID fictício
        approverType: 'A1',
        approved: purchaseRequest.approvedA1,
        rejectionReason: purchaseRequest.rejectionReasonA1,
        createdAt: purchaseRequest.approvalDateA1,
        approver: approverA1
      });
    }

    // Check A2 Fallback
    if (!hasA2 && purchaseRequest.approvalDateA2) {
      let approverA2 = null;
      if (purchaseRequest.approverA2Id) {
        approverA2 = await storage.getUser(purchaseRequest.approverA2Id);
      }
      
      approvalHistory.push({
        id: -2, // ID fictício
        approverType: 'A2',
        approved: purchaseRequest.approvedA2,
        rejectionReason: purchaseRequest.rejectionReasonA2,
        createdAt: purchaseRequest.approvalDateA2,
        approver: approverA2
      });
    }

    // Ordenar por data (decrescente)
    approvalHistory.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      supplierQuotations: enrichedSupplierQuotations,
      deliveryLocation,
      company,
      requester,
      quotationItems
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
      buyer,
      purchaseOrder
    };

    // Gerar HTML
    const html = await this.generatePurchaseOrderHTML(data);

    // Gerar PDF usando sistema de fallback robusto
    return await this.generatePDFWithFallback(html, 'purchase-order');
  }

  private static async generateCompletionSummaryHTML(data: any): Promise<string> {
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
    

    let totalValue = 0;
    const itemRows = items.map((item: any) => {
      const quotationItem = supplierQuotationItems.find((qi: any) => qi.itemDescription === item.description);
      const unitPrice = quotationItem ? Number(quotationItem.unitPrice) : 0;
      const totalPrice = Number(item.requestedQuantity ?? item.quantity ?? 0) * unitPrice;
      totalValue += totalPrice;
      
      return `
        <tr>
          <td>${item.description}</td>
          <td>${item.unit}</td>
          <td class="text-right">${parseInt(String(item.requestedQuantity ?? item.quantity ?? 0)) || 0}</td>
          <td class="text-right">${formatCurrency(unitPrice)}</td>
          <td class="text-right">${formatCurrency(totalPrice)}</td>
        </tr>`;
    }).join('');

    const timelineHtml = (completeTimeline || []).map((event: any) => {
      const phaseLabels: Record<string, string> = {
        'solicitacao': 'Solicitação',
        'aprovacao_a1': 'Aprovação A1',
        'cotacao': 'Cotação (RFQ)',
        'aprovacao_a2': 'Aprovação A2',
        'pedido_compra': 'Pedido de Compra',
        'recebimento': 'Recebimento',
        'conf_fiscal': 'Conf. Fiscal',
        'conclusao_compra': 'Conclusão',
        'arquivado': 'Arquivado'
      };
      
      const phaseLabel = phaseLabels[event.phase] || event.phase;
      const eventDate = event.timestamp ? formatDate(event.timestamp) : 'N/A';
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
        </div>`;
    }).join('');

    return await templateService.render("pdf/completion-summary", {
      requestNumber: purchaseRequest.requestNumber,
      requesterName: requester ? `${requester.firstName} ${requester.lastName}` : 'N/A',
      departmentName: department?.name || 'N/A',
      costCenterName: costCenter?.name || 'N/A',
      createdAt: formatDate(purchaseRequest.createdAt),
      completionDate: purchaseRequest.receivedDate ? formatDate(purchaseRequest.receivedDate) : 'N/A',
      urgency: purchaseRequest.urgency || 'N/A',
      hasSelectedSupplier: !!selectedSupplier,
      supplierName: selectedSupplier?.name,
      supplierCnpj: selectedSupplier?.cnpj,
      supplierEmail: selectedSupplier?.email,
      supplierPhone: selectedSupplier?.phone,
      itemRows,
      totalValue: formatCurrency(totalValue),
      hasTimeline: completeTimeline && completeTimeline.length > 0,
      timelineHtml,
      hasQuotationData: !!selectedSupplierQuotation,
      quotationTotalValue: formatCurrency(Number(selectedSupplierQuotation?.totalValue || 0)),
      quotationDeliveryTime: selectedSupplierQuotation?.deliveryTime || 'N/A',
      quotationPaymentTerms: selectedSupplierQuotation?.paymentTerms || selectedSupplier?.paymentTerms || 'N/A',
      quotationObservations: selectedSupplierQuotation?.observations || 'N/A',
      hasQuotationDiscount: (selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue),
      quotationDiscount: selectedSupplierQuotation?.discountType === 'percentage' ? `${selectedSupplierQuotation.discountValue}%` : formatCurrency(Number(selectedSupplierQuotation?.discountValue)),
      quotationJustification: selectedSupplierQuotation?.justification
    });
  }
}


async function getCompanyLogoBase64(company: any): Promise<string | null> {
  if (company?.logoBase64) {
    return company.logoBase64.startsWith("data:")
      ? company.logoBase64
      : `data:image/png;base64,${company.logoBase64}`;
  }

  if (company?.logoUrl) {
    try {
      const buffer = await fileStorageService.readFileBuffer(company.logoUrl);
      const mimeType = (company.logoUrl.split(".").pop() || "png").toLowerCase() === "jpg"
        ? "image/jpeg"
        : ((company.logoUrl.match(/\.(png|jpeg|jpg|gif|webp)(?:$|\?)/i)?.[1]) || "png");
      const normalizedMime = mimeType.startsWith("image/") ? mimeType : `image/${mimeType}`;
      return `data:${normalizedMime};base64,${buffer.toString("base64")}`;
    } catch (error) {
      console.error("Erro ao carregar logo da empresa para PDF:", error);
    }
  }

  return null;
}
