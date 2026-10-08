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
  currencyCode?: string;
  exchangeRate?: number;
}

const SUPPORTED_LABELS: Record<string, string> = {
  BRL: 'Real Brasileiro',
  USD: 'Dólar Americano',
  EUR: 'Euro',
  GBP: 'Libra Esterlina',
};

const SUPPORTED_SYMBOLS: Record<string, string> = {
  BRL: 'R$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
};

const formatWithSymbol = (value: number | string, currencyCode: string = 'BRL') => {
  const num = typeof value === 'string' ? parseFloat(value) : value || 0;
  const upper = currencyCode.toUpperCase();
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: upper }).format(num);
  } catch {
    const sym = SUPPORTED_SYMBOLS[upper] || SUPPORTED_SYMBOLS.BRL;
    return `${sym} ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

const formatDualBrlFirst = (brlValue: number | string, originalValue: number | string, currencyCode: string = 'BRL'): string => {
  const upper = currencyCode.toUpperCase();
  if (upper === 'BRL') {
    return formatWithSymbol(brlValue, 'BRL');
  }
  return `${formatWithSymbol(brlValue, 'BRL')} (${formatWithSymbol(originalValue, upper)})`;
};

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
  getItemStatus,
  currencyCode,
  exchangeRate,
}: PrintTemplateProps) => {
  const rawCode = (currencyCode || (request as any)?.currencyCode || (selectedSupplier as any)?.currencyCode || 'BRL').toUpperCase();
  const rateNum = Number(exchangeRate ?? (request as any)?.exchangeRate ?? (selectedSupplier as any)?.exchangeRate ?? 0) || 0;
  const isForeign = rawCode !== 'BRL' && rateNum > 0;
  const label = SUPPORTED_LABELS[rawCode] || rawCode;

  const toOrigFromBrl = (brl: number | string): number => {
    const brlNum = typeof brl === 'string' ? parseFloat(brl) : brl || 0;
    if (!isForeign || rateNum === 0) return brlNum;
    return brlNum / rateNum;
  };

  const formatCurrency = (value: number | string) =>
    formatDualBrlFirst(value, toOrigFromBrl(value), rawCode);

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return 'N/A';
    }
  };

  const currencyNoteHtml = isForeign
    ? `<div style="font-size: 11px; color: #3730a3; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 8px 12px; margin-bottom: 20px;">
         <strong>🌍 Compra Internacional:</strong> valores originalmente negociados em <strong>${label} (${rawCode})</strong>.
         Taxa de câmbio aplicada: <strong>1 ${rawCode} = ${formatWithSymbol(rateNum, 'BRL').replace('R$', 'R$ ')}</strong>.
         Valores abaixo mostram <strong>BRL primeiro</strong> como referência principal.
       </div>`
    : '';

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
        margin-bottom: 20px; 
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
        margin-bottom: 24px; 
      }
      .metric-card { 
        border: 1px solid #e5e7eb; 
        border-radius: 8px; 
        padding: 16px; 
        text-align: center; 
      }
      .metric-label { 
        font-size: 12px; 
        color: #6b7280; 
        font-weight: 500; 
        margin-bottom: 5px; 
      }
      .metric-value { 
        font-size: 18px; 
        font-weight: bold; 
        color: #111827; 
        line-height: 1.3;
        white-space: pre-wrap;
      }
      .section { 
        margin-bottom: 24px; 
        border: 1px solid #e5e7eb; 
        border-radius: 8px; 
        overflow: hidden; 
      }
      .section-header { 
        background: #f9fafb; 
        padding: 12px 16px; 
        border-bottom: 1px solid #e5e7eb; 
        font-weight: 600; 
        font-size: 15px; 
      }
      .section-content { 
        padding: 16px; 
      }
      .grid { 
        display: grid; 
        grid-template-columns: repeat(3, 1fr); 
        gap: 16px; 
      }
      .field { 
        margin-bottom: 12px; 
      }
      .field-label { 
        font-size: 12px; 
        color: #6b7280; 
        font-weight: 500; 
        margin-bottom: 3px; 
      }
      .field-value { 
        font-size: 13px; 
        color: #111827; 
        font-weight: 500; 
        white-space: pre-wrap;
      }
      .table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 12px; 
      }
      .table th, .table td { 
        border: 1px solid #e5e7eb; 
        padding: 8px 10px; 
        text-align: left; 
      }
      .table th { 
        background: #f9fafb; 
        font-weight: 600; 
        font-size: 12px; 
      }
      .table td { 
        font-size: 12px; 
        vertical-align: top;
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
        padding: 12px;
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

    ${currencyNoteHtml}

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
        <div class="field" style="margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
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

        const unitPriceBrl = supplierItem ? parseFloat(supplierItem.unitPrice) || 0 : 0;
        const quantity = parseFloat(item.requestedQuantity) || 0;
        const totalBrl = quantity * unitPriceBrl;
        const status = getItemStatus(item);

        return `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.unit}</td>
                  <td class="text-right">${quantity.toLocaleString('pt-BR')}</td>
                  <td class="text-right">${quantity.toLocaleString('pt-BR')}</td>
                  <td class="text-right">${formatCurrency(unitPriceBrl)}</td>
                  <td class="text-right" style="font-weight: 600;">${formatCurrency(totalBrl)}</td>
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
