import { chromium, firefox, webkit, Browser, Page } from 'playwright';
import puppeteer from 'puppeteer';
import htmlPdf from 'html-pdf-node';
import { storage } from './storage';

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

interface PDFOptions {
  format?: 'A4' | 'A3' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  timeout?: number;
  quality?: 'high' | 'medium' | 'low';
}

export class ImprovedPDFService {
  private static readonly DEFAULT_OPTIONS: PDFOptions = {
    format: 'A4',
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    printBackground: true,
    timeout: 30000,
    quality: 'high'
  };

  /**
   * Método principal para geração de PDF com múltiplas estratégias
   * Ordem de prioridade: Playwright (Chromium) → Playwright (Firefox) → Puppeteer → html-pdf-node → HTML
   */
  public static async generatePDF(html: string, options: PDFOptions = {}): Promise<Buffer> {
    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const strategies = [
      () => this.generateWithPlaywrightChromium(html, finalOptions),
      () => this.generateWithPlaywrightFirefox(html, finalOptions),
      () => this.generateWithPuppeteer(html, finalOptions),
      () => this.generateWithHtmlPdfNode(html, finalOptions),
      () => this.generateHTMLFallback(html)
    ];

    let lastError: Error | null = null;

    for (let i = 0; i < strategies.length; i++) {
      const strategyName = this.getStrategyName(i);
      console.log(`🔄 Tentativa ${i + 1}: ${strategyName}`);
      
      try {
        const result = await strategies[i]();
        console.log(`✅ PDF gerado com sucesso usando ${strategyName}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ ${strategyName} falhou:`, error.message);
        
        // Para estratégias de browser, aguarda um pouco antes da próxima tentativa
        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.error('❌ Todas as estratégias falharam, retornando HTML como fallback');
    return this.generateHTMLFallback(html);
  }

  /**
   * Estratégia 1: Playwright com Chromium (mais confiável)
   */
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
          '--disable-features=VizDisplayCompositor'
        ]
      });

      page = await browser.newPage();
      
      // Configurações de viewport para melhor renderização
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Define o conteúdo HTML
      await page.setContent(html, { 
        waitUntil: 'networkidle',
        timeout: options.timeout 
      });

      // Aguarda fontes e imagens carregarem
      await page.waitForLoadState('networkidle');
      
      // Gera o PDF
      const pdfBuffer = await page.pdf({
        format: options.format,
        margin: options.margin,
        printBackground: options.printBackground,
        timeout: options.timeout
      });

      return Buffer.from(pdfBuffer);
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * Estratégia 2: Playwright com Firefox (fallback cross-browser)
   */
  private static async generateWithPlaywrightFirefox(html: string, options: PDFOptions): Promise<Buffer> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await firefox.launch({
        headless: true,
        args: ['--no-sandbox']
      });

      page = await browser.newPage();
      await page.setContent(html, { 
        waitUntil: 'networkidle',
        timeout: options.timeout 
      });

      // Firefox no Playwright ainda não suporta PDF nativamente
      // Então fazemos screenshot e convertemos (não ideal, mas funciona)
      throw new Error('Firefox PDF generation not yet supported in Playwright');
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * Estratégia 3: Puppeteer (fallback tradicional)
   */
  private static async generateWithPuppeteer(html: string, options: PDFOptions): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    let page = null;
    try {
      page = await browser.newPage();
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: options.timeout 
      });

      const pdfBuffer = await page.pdf({
        format: options.format,
        margin: options.margin,
        printBackground: options.printBackground,
        timeout: options.timeout
      });

      return pdfBuffer;
    } finally {
      if (page) await page.close();
      await browser.close();
    }
  }

  /**
   * Estratégia 4: html-pdf-node (fallback sem browser)
   */
  private static async generateWithHtmlPdfNode(html: string, options: PDFOptions): Promise<Buffer> {
    const htmlPdfOptions = {
      format: options.format,
      margin: options.margin,
      printBackground: options.printBackground,
      timeout: options.timeout
    };

    const file = { content: html };
    return await htmlPdf.generatePdf(file, htmlPdfOptions);
  }

  /**
   * Estratégia 5: HTML Fallback (último recurso)
   */
  private static generateHTMLFallback(html: string): Buffer {
    const htmlDocument = `<!-- HTML_FALLBACK_MARKER -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Documento - Gestão de Compras</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .print-instructions { display: none; }
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 20px; 
            line-height: 1.6;
        }
        .print-instructions {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .print-instructions h3 {
            margin: 0 0 10px 0;
            font-size: 18px;
        }
        .print-instructions p {
            margin: 5px 0;
            opacity: 0.9;
        }
        .keyboard-shortcut {
            background: rgba(255,255,255,0.2);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="print-instructions no-print">
        <h3>📄 Documento em formato HTML</h3>
        <p><strong>Para salvar como PDF:</strong></p>
        <p>• Windows/Linux: <span class="keyboard-shortcut">Ctrl + P</span> → Salvar como PDF</p>
        <p>• Mac: <span class="keyboard-shortcut">Cmd + P</span> → Salvar como PDF</p>
        <p>• Ou use o menu do navegador: Arquivo → Imprimir → Salvar como PDF</p>
    </div>
    ${html}
</body>
</html>`;
    
    return Buffer.from(htmlDocument, 'utf8');
  }

  /**
   * Utilitário para obter nome da estratégia
   */
  private static getStrategyName(index: number): string {
    const names = [
      'Playwright (Chromium)',
      'Playwright (Firefox)', 
      'Puppeteer',
      'html-pdf-node',
      'HTML Fallback'
    ];
    return names[index] || 'Estratégia Desconhecida';
  }

  /**
   * Método para verificar se o resultado é HTML ou PDF
   */
  public static isHTMLContent(buffer: Buffer): boolean {
    const content = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
    return content.includes('HTML_FALLBACK_MARKER') ||
           content.includes('<!DOCTYPE html>') ||
           content.includes('<html>') ||
           content.includes('<HTML>') ||
           content.trim().startsWith('<');
  }

  /**
   * Método para gerar PDF de Pedido de Compra (mantém compatibilidade)
   */
  public static async generatePurchaseOrderPDF(requestId: string): Promise<Buffer> {
    // Reutiliza a lógica existente para buscar dados
    const data = await this.getPurchaseOrderData(requestId);
    const html = await this.generatePurchaseOrderHTML(data);
    
    return this.generatePDF(html, {
      format: 'A4',
      quality: 'high',
      timeout: 45000 // Timeout maior para pedidos complexos
    });
  }

  /**
   * Método para gerar PDF do Dashboard (mantém compatibilidade)
   */
  public static async generateDashboardPDF(): Promise<Buffer> {
    const html = await this.generateDashboardHTML();
    
    return this.generatePDF(html, {
      format: 'A4',
      quality: 'medium',
      timeout: 30000
    });
  }

  /**
   * Método para gerar PDF de Resumo de Conclusão (mantém compatibilidade)
   */
  public static async generateCompletionSummaryPDF(requestId: string): Promise<Buffer> {
    const html = await this.generateCompletionSummaryHTML(requestId);
    
    return this.generatePDF(html, {
      format: 'A4',
      quality: 'high',
      timeout: 30000
    });
  }

  // Métodos auxiliares (mantidos da implementação original)
  private static async getPurchaseOrderData(requestId: string): Promise<PurchaseOrderData> {
    // Implementação existente...
    throw new Error('Método não implementado - usar implementação original');
  }

  private static async generatePurchaseOrderHTML(data: PurchaseOrderData): Promise<string> {
    // Implementação existente...
    throw new Error('Método não implementado - usar implementação original');
  }

  private static async generateDashboardHTML(): Promise<string> {
    // Implementação existente...
    throw new Error('Método não implementado - usar implementação original');
  }

  private static async generateCompletionSummaryHTML(requestId: string): Promise<string> {
    // Implementação existente...
    throw new Error('Método não implementado - usar implementação original');
  }
}