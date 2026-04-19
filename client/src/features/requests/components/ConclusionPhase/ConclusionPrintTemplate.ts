export interface PrintTemplateProps {
  request: any;
  totalProcessTime: number;
  totalItemsValue: number;
  requester: any;
  department: any;
  costCenter: any;
  selectedSupplier: any;
  items: any[];
  supplierQuotationItems: any[];
  completeTimeline: any[];
  getItemStatus: (item: any) => string;
}

export const generatePrintableHTML = ({
  request,
  totalProcessTime,
  totalItemsValue,
  requester,
  department,
  costCenter,
  selectedSupplier,
  items,
  supplierQuotationItems,
  completeTimeline,
  getItemStatus
}: PrintTemplateProps) => {
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Conclusão da Compra - ${request.requestNumber}</title>
    <style>
      @media print {
        @page { margin: 1cm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
        line-height: 1.4; 
        margin: 0; 
        padding: 20px; 
        color: #374151;
      }
      .header { 
        text-align: center; 
        margin-bottom: 30px; 
        border-bottom: 2px solid #e5e7eb; 
        padding-bottom: 20px; 
      }
      .header h1 { 
        margin: 0; 
        font-size: 24px; 
        color: #111827; 
      }
      .header p { 
        margin: 5px 0 0 0; 
        color: #6b7280; 
        font-size: 14px; 
      }
      .metrics { 
        display: grid; 
        grid-template-columns: repeat(3, 1fr); 
        gap: 20px; 
        margin-bottom: 30px; 
      }
      .metric-card { 
        border: 1px solid #e5e7eb; 
        border-radius: 8px; 
        padding: 20px; 
        text-align: center; 
      }
      .metric-label { 
        font-size: 12px; 
        color: #6b7280; 
        font-weight: 500; 
        margin-bottom: 5px; 
      }
      .metric-value { 
        font-size: 20px; 
        font-weight: bold; 
        color: #111827; 
      }
      .section { 
        margin-bottom: 30px; 
        border: 1px solid #e5e7eb; 
        border-radius: 8px; 
        overflow: hidden; 
      }
      .section-header { 
        background: #f9fafb; 
        padding: 15px 20px; 
        border-bottom: 1px solid #e5e7eb; 
        font-weight: 600; 
        font-size: 16px; 
      }
      .section-content { 
        padding: 20px; 
      }
      .grid { 
        display: grid; 
        grid-template-columns: repeat(3, 1fr); 
        gap: 20px; 
      }
      .field { 
        margin-bottom: 15px; 
      }
      .field-label { 
        font-size: 12px; 
        color: #6b7280; 
        font-weight: 500; 
        margin-bottom: 3px; 
      }
      .field-value { 
        font-size: 14px; 
        color: #111827; 
        font-weight: 500; 
      }
      .table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 15px; 
      }
      .table th, .table td { 
        border: 1px solid #e5e7eb; 
        padding: 8px 12px; 
        text-align: left; 
      }
      .table th { 
        background: #f9fafb; 
        font-weight: 600; 
        font-size: 12px; 
      }
      .table td { 
        font-size: 13px; 
      }
      .text-right { 
        text-align: right; 
      }
      .text-center { 
        text-align: center; 
      }
      .badge { 
        display: inline-block; 
        padding: 2px 8px; 
        border-radius: 12px; 
        font-size: 11px; 
        font-weight: 500; 
      }
      .badge-success { 
        background: #dcfce7; 
        color: #166534; 
      }
      .badge-outline { 
        background: #f9fafb; 
        color: #374151; 
        border: 1px solid #e5e7eb; 
      }
      .status-complete {
        background: #dcfce7;
        color: #166534;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Conclusão da Compra</h1>
      <p>Solicitação ${request.requestNumber} • ${formatDate(new Date())}</p>
    </div>

    <div class="metrics">
      <div class="metric-card">
        <div class="metric-label">Tempo Total</div>
        <div class="metric-value">${totalProcessTime} dias</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Valor Total</div>
        <div class="metric-value">${formatCurrency(totalItemsValue)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Status</div>
        <div class="metric-value" style="color: #059669;">Concluído</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">📋 Resumo da Solicitação</div>
      <div class="section-content">
        <div class="grid">
          <div>
            <div class="field">
              <div class="field-label">Número da Solicitação</div>
              <div class="field-value">${request.requestNumber}</div>
            </div>
            <div class="field">
              <div class="field-label">Data de Criação</div>
              <div class="field-value">${formatDate(request.createdAt)}</div>
            </div>
            <div class="field">
              <div class="field-label">Status Final</div>
              <div class="field-value">
                <span class="badge badge-success">Concluído</span>
              </div>
            </div>
          </div>
          <div>
            <div class="field">
              <div class="field-label">Solicitante</div>
              <div class="field-value">${requester ? `${requester.firstName} ${requester.lastName}` : request.requesterName || 'Não informado'}</div>
            </div>
            <div class="field">
              <div class="field-label">Departamento</div>
              <div class="field-value">${department?.name || request.departmentName || 'Não informado'}</div>
            </div>
            <div class="field">
              <div class="field-label">Centro de Custo</div>
              <div class="field-value">${costCenter ? `${costCenter.code} - ${costCenter.name}` : request.costCenterName || 'Não informado'}</div>
            </div>
          </div>
          <div>
            <div class="field">
              <div class="field-label">Categoria</div>
              <div class="field-value">
                <span class="badge badge-outline">${request.category}</span>
              </div>
            </div>
            <div class="field">
              <div class="field-label">Urgência</div>
              <div class="field-value">
                <span class="badge badge-outline">${request.urgency}</span>
              </div>
            </div>
            <div class="field">
              <div class="field-label">Orçamento Disponível</div>
              <div class="field-value">${request.availableBudget ? formatCurrency(request.availableBudget) : 'Não informado'}</div>
            </div>
          </div>
        </div>
        <div class="field" style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
          <div class="field-label">Justificativa</div>
          <div class="field-value">${request.justification}</div>
        </div>
      </div>
    </div>

    ${selectedSupplier ? `
    <div class="section">
      <div class="section-header">🏢 Fornecedor Selecionado</div>
      <div class="section-content">
        <div class="grid">
          <div>
            <div class="field">
              <div class="field-label">Nome do Fornecedor</div>
              <div class="field-value">${selectedSupplier.supplier?.name || 'Não informado'}</div>
            </div>
            <div class="field">
              <div class="field-label">Telefone</div>
              <div class="field-value">${selectedSupplier.supplier?.phone || 'Não informado'}</div>
            </div>
            <div class="field">
              <div class="field-label">E-mail</div>
              <div class="field-value">${selectedSupplier.supplier?.email || 'Não informado'}</div>
            </div>
          </div>
          <div>
            <div class="field">
              <div class="field-label">Valor da Cotação</div>
              <div class="field-value" style="color: #059669; font-weight: bold;">
                ${selectedSupplier.totalValue ?
        formatCurrency(selectedSupplier.totalValue) :
        (request.totalValue ? formatCurrency(request.totalValue) : 'Não informado')
      }
              </div>
            </div>
            <div class="field">
              <div class="field-label">Prazo de Entrega</div>
              <div class="field-value">${selectedSupplier.deliveryTerms || selectedSupplier.deliveryTime || 'Não informado'}</div>
            </div>
            <div class="field">
              <div class="field-label">Status</div>
              <div class="field-value">
                <span class="badge badge-success">Selecionado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    ${items.length > 0 ? `
    <div class="section">
      <div class="section-header">📦 Itens Recebidos</div>
      <div class="section-content">
        <table class="table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Unidade</th>
              <th class="text-right">Qtd. Solicitada</th>
              <th class="text-right">Qtd. Recebida</th>
              <th class="text-right">Valor Unitário</th>
              <th class="text-right">Valor Total</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.filter((item: any) => {
        const supplierItem = supplierQuotationItems?.find((sqi: any) => {
          if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
            return true;
          }
          return sqi.description === item.description ||
            sqi.itemCode === item.itemCode ||
            sqi.quotationItemId === item.id;
        });
        return !supplierItem || supplierItem.isAvailable !== false;
      }).map((item: any) => {
        const supplierItem = supplierQuotationItems?.find((sqi: any) => {
          if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
            return true;
          }
          return sqi.description === item.description ||
            sqi.itemCode === item.itemCode ||
            sqi.quotationItemId === item.id;
        });

        const unitPrice = supplierItem ? parseFloat(supplierItem.unitPrice) || 0 : 0;
        const quantity = parseFloat(item.requestedQuantity) || 0;
        const total = quantity * unitPrice;
        const status = getItemStatus(item);

        return `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.unit}</td>
                  <td class="text-right">${quantity}</td>
                  <td class="text-right">${quantity}</td>
                  <td class="text-right">${formatCurrency(unitPrice)}</td>
                  <td class="text-right" style="font-weight: 600;">${formatCurrency(total)}</td>
                  <td class="text-center">
                    <span class="badge ${status === 'received' ? 'badge-success' : 'badge-outline'}">
                      ${status === 'received' ? 'Recebido' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              `;
      }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    ${completeTimeline && completeTimeline.length > 0 ? `
    <div class="section">
      <div class="section-header">📅 Linha do Tempo do Processo</div>
      <div class="section-content">
        <table class="table">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Data</th>
              <th>Usuário</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            ${completeTimeline.map((event: any) => `
              <tr>
                <td>${event.phase || 'N/A'}</td>
                <td>${event.timestamp ? formatDate(event.timestamp) : 'N/A'}</td>
                <td>${event.userName || 'Sistema'}</td>
                <td>${event.description || event.notes || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <div class="status-complete">
      ✅ Processo Concluído - Todas as etapas foram executadas com sucesso
    </div>
  </body>
  </html>
  `;
};
