import puppeteer from 'puppeteer';
import { storage } from './storage';

interface PurchaseOrderData {
  purchaseRequest: any;
  items: any[];
  supplier: any;
  approvalHistory: any[];
}

export class PDFService {
  static async generateDashboardPDF(dashboardData: any): Promise<Buffer> {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }).catch(async () => {
      // Fallback: try without specifying executable path
      return await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        headless: true
      });
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(this.generateDashboardHTML(dashboardData));
      await page.emulateMediaType('screen');
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      return pdfBuffer;
    } finally {
      await browser.close();
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
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.requestedQuantity), 0);
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
      margin: 20px;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
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
      margin: 15px 0;
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
      margin-top: 30px;
      font-size: 10px;
    }
    .signature-section {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }
    .signature-box {
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 60px;
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
            <td>${item.itemCode} - ${item.description}</td>
            <td class="text-right">R$ ${item.unitPrice?.toFixed(2).replace('.', ',') || '0,00'}</td>
            <td class="text-right">R$ ${(item.unitPrice * item.requestedQuantity || 0).toFixed(2).replace('.', ',')}</td>
            <td class="text-right">R$ 0,00</td>
            <td class="text-right">R$ ${(item.unitPrice * item.requestedQuantity || 0).toFixed(2).replace('.', ',')}</td>
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
        ${approval.decision} em ${new Date(approval.createdAt).toLocaleDateString('pt-BR')} 
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
      // Buscar o fornecedor selecionado (selectedSupplier = true)
      const selectedSupplierQuotation = supplierQuotations.find(sq => sq.selectedSupplier) || supplierQuotations[0];
      
      if (selectedSupplierQuotation) {
        supplier = await storage.getSupplierById(selectedSupplierQuotation.supplierId);
        
        // Buscar os itens do fornecedor selecionado com preços
        const supplierItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
        
        // Combinar os itens da solicitação com os preços do fornecedor
        itemsWithPrices = items.map(item => {
          const supplierItem = supplierItems.find(si => si.quotationItemId === item.id);
          return {
            ...item,
            unitPrice: supplierItem?.unitPrice || 0,
            brand: supplierItem?.brand || '',
            deliveryTime: supplierItem?.deliveryTime || '',
            totalPrice: (supplierItem?.unitPrice || 0) * (item.requestedQuantity || 1)
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

    // Gerar PDF usando Puppeteer
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      headless: true
    }).catch(async () => {
      // Fallback: try without specifying executable path
      return await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        headless: true
      });
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}