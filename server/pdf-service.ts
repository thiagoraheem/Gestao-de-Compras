import puppeteer from 'puppeteer';
import { storage } from './storage';

interface PurchaseOrderData {
  purchaseRequest: any;
  items: any[];
  supplier: any;
  approvalHistory: any[];
}

export class PDFService {
  // Método auxiliar para lançar browser com retry e fallback
  private static async launchBrowserWithRetry(retries: number = 3): Promise<any> {
    const baseArgs = [
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
      '--max_old_space_size=4096'
    ];

    const configurations = [
      // Configuração 1: Com path específico do Chromium
      {
        executablePath: process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: baseArgs,
        headless: true,
        timeout: 30000
      },
      // Configuração 2: Sem path específico
      {
        args: baseArgs,
        headless: true,
        timeout: 30000
      },
      // Configuração 3: Minimal fallback
      {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--disable-gpu'
        ],
        headless: true,
        timeout: 30000
      }
    ];

    for (let i = 0; i < configurations.length; i++) {
      for (let retry = 0; retry < retries; retry++) {
        try {
          console.log(`Tentando lançar browser - Configuração ${i + 1}, Tentativa ${retry + 1}`);
          const browser = await puppeteer.launch(configurations[i]);
          console.log(`Browser lançado com sucesso - Configuração ${i + 1}`);
          return browser;
        } catch (error) {
          console.error(`Erro ao lançar browser - Configuração ${i + 1}, Tentativa ${retry + 1}:`, error.message);
          if (retry === retries - 1) {
            console.log(`Todas as tentativas falharam para configuração ${i + 1}`);
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // Delay progressivo
          }
        }
      }
    }
    
    throw new Error('Falha ao lançar browser após todas as tentativas e configurações');
  }

  static async generateCompletionSummaryPDF(purchaseRequestId: number): Promise<Buffer> {
    try {
      const browser = await this.launchBrowserWithRetry();
      let page = null;
      
      try {
        page = await browser.newPage();
        await page.setDefaultTimeout(30000);
      
      // Buscar dados da solicitação
      const { storage } = await import('./storage');
      const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
      if (!purchaseRequest) {
        throw new Error('Purchase request not found');
      }

      const items = await storage.getPurchaseRequestItems(purchaseRequestId);
      const approvalHistory = await storage.getApprovalHistory(purchaseRequestId);
      
      // Buscar fornecedor selecionado
      let selectedSupplier = null;
      if (purchaseRequest.selectedSupplierId) {
        selectedSupplier = await storage.getSupplierById(purchaseRequest.selectedSupplierId);
      }

      const html = this.generateCompletionSummaryHTML({
        purchaseRequest,
        items,
        approvalHistory,
        selectedSupplier
      });

        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
          timeout: 30000
        });

        return pdfBuffer;
      } catch (error) {
        console.error('Error generating completion summary PDF:', error);
        throw new Error(`Completion summary PDF generation failed: ${error.message}`);
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
    } catch (error) {
      console.error('Error in generateCompletionSummaryPDF:', error);
      throw error;
    }
  }

  static async generateDashboardPDF(dashboardData: any): Promise<Buffer> {
    const browser = await this.launchBrowserWithRetry();
    let page = null;
    
    try {
      page = await browser.newPage();
      await page.setDefaultTimeout(30000);
      
      await page.setContent(this.generateDashboardHTML(dashboardData), { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        timeout: 30000
      });
      
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating dashboard PDF:', error);
      throw new Error(`Dashboard PDF generation failed: ${error.message}`);
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

  private static async generatePurchaseOrderHTML(data: PurchaseOrderData): Promise<string> {
    const { purchaseRequest, items, supplier, approvalHistory } = data;
    
    // Calcular totais
    const subtotal = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    const desconto = 0; // Por enquanto zero, pode ser implementado depois
    const valorFinal = subtotal - desconto;
    
    // Encontrar aprovações
    const aprovacaoA1 = approvalHistory.find(h => h.phase === 'aprovacao-a1');
    const aprovacaoA2 = approvalHistory.find(h => h.phase === 'aprovacao-a2');
    
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
      text-align: center;
      margin-bottom: 10px;
    }
    .header h1 {
      font-size: 16px;
      font-weight: bold;
      margin: 5px 0;
    }
    .header p {
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
    .footer {
      margin-top: 15px;
      font-size: 10px;
    }
    .signature-section {
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }
    .signature-box {
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PEDIDO DE COMPRAS - ${purchaseRequest.requestNumber}</h1>
    <h2>BLOMAQ - LOCAÇÃO ANDAIMES E MÁQUINAS</h2>
    <p>Endereço: Av. Nathan Lemos Xavier de Albuquerque, 1.328</p>
    <p>Novo Aleixo, Manaus - AM, 69098-145</p>
    <p>CNPJ: 13.844.973/0001-59 / IE: 04.235.197-9 / I.M: 20035101 / SUFRAMA: 210.135.271</p>
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
    </div>

    <div class="section">
      <div class="section-title">LOCAL DE ENTREGA</div>
      <div class="info-item">
        <span class="info-label">ENDEREÇO:</span> Av. Nathan Lemos Xavier de Albuquerque, 1.328
      </div>
      <div class="info-item">
        <span class="info-label">BAIRRO:</span> Novo Aleixo
      </div>
      <div class="info-item">
        <span class="info-label">CEP:</span> 69098-145
      </div>
      <div class="info-item">
        <span class="info-label">CIDADE:</span> Manaus-AM
      </div>
      <div class="info-item">
        <span class="info-label">TRANSPORTADORA:</span> Não se Aplica
      </div>
    </div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div>
        <div class="info-item">
          <span class="info-label">SOLICITAÇÃO:</span> ${purchaseRequest.requestNumber}
        </div>
        <div class="info-item">
          <span class="info-label">SOLICITANTE:</span> ${purchaseRequest.requesterName || 'Não informado'}
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
          <span class="info-label">PRAZO ENTREGA:</span> ${purchaseRequest.expectedDelivery || 'Não informado'}
        </div>
        <div class="info-item">
          <span class="info-label">COND. PAGAMENTO:</span> ${supplier?.paymentTerms || 'A combinar'}
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
          <th class="text-center">VL. UNITÁRIO</th>
          <th class="text-center">VL. TOTAL</th>
          <th class="text-center">DESCONTO</th>
          <th class="text-center">VALOR FINAL</th>
          <th>OBSERVAÇÃO</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td class="text-center">${item.requestedQuantity}</td>
            <td class="text-center">${item.unit || 'UND'}</td>
            <td>${item.itemCode || ''} ${item.itemCode ? '-' : ''} ${item.description}</td>
            <td class="text-right">R$ ${typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2).replace('.', ',') : '0,00'}</td>
            <td class="text-right">R$ ${typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2).replace('.', ',') : '0,00'}</td>
            <td class="text-right">R$ 0,00</td>
            <td class="text-right">R$ ${typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2).replace('.', ',') : '0,00'}</td>
            <td>${item.specifications || ''}</td>
          </tr>
        `).join('')}
        
        <!-- Linhas vazias para completar o template -->
        ${Array(Math.max(0, 8 - items.length)).fill(0).map(() => `
          <tr>
            <td class="text-center">&nbsp;</td>
            <td class="text-center">&nbsp;</td>
            <td>&nbsp;</td>
            <td class="text-right">&nbsp;</td>
            <td class="text-right">&nbsp;</td>
            <td class="text-right">&nbsp;</td>
            <td class="text-right">&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        `).join('')}
        
        <tr class="total-row">
          <td colspan="4" class="text-right"><strong>TOTAL GERAL:</strong></td>
          <td class="text-right"><strong>R$ ${subtotal.toFixed(2).replace('.', ',')}</strong></td>
          <td class="text-right"><strong>R$ ${desconto.toFixed(2).replace('.', ',')}</strong></td>
          <td class="text-right"><strong>R$ ${valorFinal.toFixed(2).replace('.', ',')}</strong></td>
          <td>&nbsp;</td>
        </tr>
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
    <div class="section-title">HISTÓRICO DE APROVAÇÕES</div>
    ${approvalHistory.map(approval => `
      <div class="info-item">
        <strong>${approval.phase === 'aprovacao-a1' ? 'Aprovação A1' : 'Aprovação A2'}:</strong> 
        ${approval.decision || 'Aprovado'} em ${new Date(approval.createdAt).toLocaleDateString('pt-BR')} 
        por ${approval.userName || 'Sistema'}
        ${approval.comments ? ` - ${approval.comments}` : ''}
      </div>
    `).join('')}
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <div>Solicitante</div>
      <div style="font-size: 10px; margin-top: 5px;">${purchaseRequest.requesterName || ''}</div>
    </div>
    <div class="signature-box">
      <div>Aprovação A1</div>
      <div style="font-size: 10px; margin-top: 5px;">${aprovacaoA1?.userName || ''}</div>
    </div>
    <div class="signature-box">
      <div>Aprovação A2</div>
      <div style="font-size: 10px; margin-top: 5px;">${aprovacaoA2?.userName || ''}</div>
    </div>
  </div>

  <div class="footer">
    <p><strong>Documento gerado automaticamente em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>
    `;
  }

  static async generatePurchaseOrderPDF(purchaseRequestId: number): Promise<Buffer> {
    // Buscar dados da solicitação
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
    if (!purchaseRequest) {
      throw new Error('Solicitação de compra não encontrada');
    }

    // Buscar itens da solicitação
    const items = await storage.getPurchaseRequestItems(purchaseRequestId);
    
    // Buscar fornecedor e valores dos itens do fornecedor selecionado
    let supplier = null;
    let itemsWithPrices = items;
    
    const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
    if (quotation) {
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      // Buscar o fornecedor selecionado (is_chosen = true)
      const selectedSupplierQuotation = supplierQuotations.find(sq => sq.isChosen) || supplierQuotations[0];
      
      if (selectedSupplierQuotation) {
        supplier = await storage.getSupplierById(selectedSupplierQuotation.supplierId);
        
        // Buscar os itens do fornecedor selecionado com preços
        const supplierItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
        
        // Primeiro, buscar os itens da cotação
        const quotationItems = await storage.getQuotationItems(quotation.id);
        
        // Combinar os itens da solicitação com os preços do fornecedor
        itemsWithPrices = items.map(item => {
          // Encontrar o item correspondente na cotação
          const quotationItem = quotationItems.find(qi => qi.description === item.description);
          if (quotationItem) {
            // Encontrar o preço do fornecedor para este item da cotação
            const supplierItem = supplierItems.find(si => si.quotationItemId === quotationItem.id);
            if (supplierItem) {
              return {
                ...item,
                unitPrice: Number(supplierItem.unitPrice) || 0,
                brand: supplierItem.brand || '',
                deliveryTime: supplierItem.deliveryTime || '',
                totalPrice: (Number(supplierItem.unitPrice) || 0) * (Number(item.requestedQuantity) || 1)
              };
            }
          }
          return {
            ...item,
            unitPrice: 0,
            brand: '',
            deliveryTime: '',
            totalPrice: 0
          };
        });
      }
    }

    // Buscar histórico de aprovações
    const approvalHistory = await storage.getApprovalHistory(purchaseRequestId);

    const data: PurchaseOrderData = {
      purchaseRequest,
      items: itemsWithPrices,
      supplier,
      approvalHistory
    };

    // Gerar HTML
    const html = await this.generatePurchaseOrderHTML(data);

    // Gerar PDF usando Puppeteer com configuração robusta
    let browser = null;
    try {
      browser = await this.launchBrowserWithRetry();
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw new Error(`Browser launch failed: ${error.message}`);
    }

    let page = null;
    try {
      page = await browser.newPage();
      
      // Set page timeout to prevent hanging
      await page.setDefaultTimeout(30000);
      
      // Set content with proper wait conditions
      await page.setContent(html, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });
      
      // Generate PDF with timeout and error handling
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        timeout: 30000
      });

      return Buffer.from(pdf);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
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

  private static generateCompletionSummaryHTML(data: any): string {
    const { purchaseRequest, items, approvalHistory, selectedSupplier } = data;
    
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const totalValue = items.reduce((sum: number, item: any) => {
      return sum + (Number(item.requestedQuantity) * Number(item.unitPrice || 0));
    }, 0);

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
                <span class="info-value">${purchaseRequest.requesterName || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Departamento:</span>
                <span class="info-value">${purchaseRequest.department?.name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Centro de Custo:</span>
                <span class="info-value">${purchaseRequest.costCenter?.name || 'N/A'}</span>
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
              ${items.map((item: any) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.unit}</td>
                  <td>${item.requestedQuantity}</td>
                  <td>${formatCurrency(Number(item.unitPrice || 0))}</td>
                  <td>${formatCurrency(Number(item.requestedQuantity) * Number(item.unitPrice || 0))}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4"><strong>TOTAL GERAL</strong></td>
                <td><strong>${formatCurrency(totalValue)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        ${approvalHistory.length > 0 ? `
        <div class="section">
          <div class="section-title">Histórico de Aprovações</div>
          <div class="timeline">
            ${approvalHistory.map((approval: any) => `
              <div class="timeline-item">
                <div class="timeline-date">${formatDate(approval.approvedAt)}</div>
                <div class="timeline-action">
                  <strong>${approval.approver?.firstName} ${approval.approver?.lastName}</strong> 
                  ${approval.approved ? 'aprovou' : 'rejeitou'} na fase <strong>${approval.phase}</strong>
                  ${approval.reason ? `<br>Motivo: ${approval.reason}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

      </body>
      </html>
    `;
  }
}