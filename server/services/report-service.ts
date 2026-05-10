import { storage } from "../storage";
import { pool } from "../db";

export class ReportService {
  async getPurchaseRequestReport(filters: any) {
    return await storage.getPurchaseRequestsForReport(filters);
  }

  async generatePurchaseRequestCSV(filters: any): Promise<string> {
    const { data, summary } = await storage.getPurchaseRequestsForReport({ ...filters, export: true });

    const escapeCsvField = (field: string | number | null): string => {
      if (field === null || field === undefined) return "N/A";
      let stringField = String(field);
      stringField = stringField.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (stringField.includes(';') || stringField.includes('"') || String(field).includes('\n')) {
        stringField = stringField.replace(/"/g, '""');
        return `"${stringField}"`;
      }
      return stringField;
    };

    const formatCurrencyForCSV = (value: number | null): string => {
      if (!value || value === 0) return "R$ 0,00";
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const urgencyMap: Record<string, string> = { baixa: "Baixa", medio: "Média", alto: "Alta", alta_urgencia: "Crítica" };
    const phaseMap: Record<string, string> = { 
       solicitacao: "Em Solicitação", 
       aprovacao_a1: "Aprovação A1", 
       cotacao: "Em Cotação",
       aprovacao_a2: "Aprovação A2",
       conclusao_compra: "Conclusão de Compra",
       recebimento: "Recebimento"
    };

    const csvRows = [
      ["Número", "Descrição", "Data", "Solicitante", "Departamento", "Fornecedor", "Fase", "Urgência", "Valor Itens", "Desconto", "Subtotal", "Desconto Proposta", "Valor Final"].join(";")
    ];

    data.forEach(req => {
       let dateStr = "N/A";
       if (req.createdAt) {
           const d = new Date(req.createdAt);
           dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
       }

       csvRows.push([
          escapeCsvField(req.requestNumber),
          escapeCsvField(req.justification || ""),
          escapeCsvField(dateStr),
          escapeCsvField(req.requesterName),
          escapeCsvField(req.departmentName),
          escapeCsvField(req.supplierName === "N/A" ? "" : req.supplierName),
          escapeCsvField(phaseMap[req.phase] || req.phase),
          escapeCsvField(urgencyMap[req.urgency] || req.urgency),
          escapeCsvField(formatCurrencyForCSV(req.valorItens)),
          escapeCsvField(formatCurrencyForCSV(req.desconto)),
          escapeCsvField(formatCurrencyForCSV(req.subTotal)),
          escapeCsvField(formatCurrencyForCSV(req.descontoProposta)),
          escapeCsvField(formatCurrencyForCSV(req.valorFinal)),
       ].join(";"));
    });

    if (summary) {
       csvRows.push([
          "TOTAL GERAL", "", "", "", "", "", "", "",
          escapeCsvField(formatCurrencyForCSV(summary.totalValorItens)),
          escapeCsvField(formatCurrencyForCSV(summary.totalDesconto)),
          escapeCsvField(formatCurrencyForCSV(summary.totalSubTotal)),
          escapeCsvField(formatCurrencyForCSV(summary.totalDescontoProposta)),
          escapeCsvField(formatCurrencyForCSV(summary.totalValorFinal)),
       ].join(";"));
    }

    return csvRows.join("\r\n");
  }

  async getSupplierDetailedReport(supplierId: number, startDate?: string, endDate?: string) {
    const start = startDate && endDate ? new Date(startDate) : null;
    const end = startDate && endDate ? new Date(endDate) : null;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    const supplierResult = await pool.query(
      'SELECT id, name, email, phone, cnpj, cpf, contact, website, address FROM suppliers WHERE id = $1 LIMIT 1',
      [supplierId]
    );
    if (supplierResult.rows.length === 0) {
      throw new Error("Fornecedor não encontrado");
    }
    const supplier = supplierResult.rows[0];

    const quotationsQuery =
      `SELECT 
         sq.id,
         sq.quotation_id as "quotationId",
         q.quotation_number as "quotationNumber",
         q.purchase_request_id as "purchaseRequestId",
         sq.status,
         sq.sent_at as "sentAt",
         sq.received_at as "receivedAt",
         sq.subtotal_value as "subtotalValue",
         sq.final_value as "finalValue",
         sq.total_value as "totalValue",
         sq.discount_type as "discountType",
         sq.discount_value as "discountValue",
         sq.includes_freight as "includesFreight",
         sq.freight_value as "freightValue",
         sq.is_chosen as "isChosen",
         sq.choice_reason as "choiceReason",
         sq.created_at as "createdAt"
       FROM supplier_quotations sq
       JOIN quotations q ON q.id = sq.quotation_id
       WHERE sq.supplier_id = $1` +
       (start && end ? ` AND COALESCE(sq.sent_at, sq.created_at) BETWEEN $2 AND $3` : ``) +
       ` ORDER BY sq.created_at DESC`;
    const quotationsParams = start && end ? [supplierId, start, end] : [supplierId];
    const quotationsResult = await pool.query(quotationsQuery, quotationsParams);

    const quotations = quotationsResult.rows.map((row: any) => {
      const base = parseFloat(row.finalValue || row.subtotalValue || row.totalValue || '0');
      const freight = row.includesFreight && row.freightValue ? parseFloat(row.freightValue) : 0;
      const adjustedTotal = base + freight;
      return { ...row, adjustedTotal };
    });

    const totalSent = quotations.length;
    const responded = quotations.filter((q: any) => q.receivedAt || q.status === 'received').length;
    const wins = quotations.filter((q: any) => q.isChosen === true).length;

    const responseRate = totalSent > 0 ? responded / totalSent : 0;
    const winRate = totalSent > 0 ? wins / totalSent : 0;

    const responseTimesHours = quotations
      .filter((q: any) => q.sentAt && q.receivedAt)
      .map((q: any) => {
        const sent = new Date(q.sentAt).getTime();
        const recv = new Date(q.receivedAt).getTime();
        return (recv - sent) / (1000 * 60 * 60);
      });
    const avgResponseTimeHours = responseTimesHours.length
      ? responseTimesHours.reduce((a: number, b: number) => a + b, 0) / responseTimesHours.length
      : null;

    const monetaryValues = quotations
      .map((q: any) => parseFloat(q.finalValue || q.totalValue || '0'))
      .filter((v: number) => !isNaN(v) && v > 0);
    const totalQuotedValue = monetaryValues.reduce((a: number, b: number) => a + b, 0);
    const averageTicket = monetaryValues.length ? totalQuotedValue / monetaryValues.length : 0;

    const discountRates = quotations
      .map((q: any) => {
        const subtotal = q.subtotalValue ? parseFloat(q.subtotalValue) : null;
        const final = q.finalValue ? parseFloat(q.finalValue) : null;
        if (subtotal && final && subtotal > 0 && final >= 0 && final <= subtotal) {
          return (subtotal - final) / subtotal;
        }
        return null;
      })
      .filter((v: number | null) => v !== null) as number[];
    const averageDiscountRate = discountRates.length
      ? discountRates.reduce((a: number, b: number) => a + b, 0) / discountRates.length
      : 0;

    const itemsAggQuery =
      `SELECT 
         COUNT(*)::int as total_items,
         SUM(CASE WHEN sqi.is_available = true THEN 1 ELSE 0 END)::int as available_items,
         AVG(NULLIF(sqi.delivery_days, 0))::float as avg_delivery_days
       FROM supplier_quotation_items sqi
       JOIN supplier_quotations sq ON sqi.supplier_quotation_id = sq.id
       WHERE sq.supplier_id = $1` +
       (start && end ? ` AND ((COALESCE(sq.sent_at, sq.created_at) BETWEEN $2 AND $3) OR (sq.received_at BETWEEN $2 AND $3))` : ``);
    const itemsAggParams = start && end ? [supplierId, start, end] : [supplierId];
    const itemsAggResult = await pool.query(itemsAggQuery, itemsAggParams);

    const itemsAgg = itemsAggResult.rows[0] || { total_items: 0, available_items: 0, avg_delivery_days: null };
    const availabilityRate = itemsAgg.total_items > 0 ? itemsAgg.available_items / itemsAgg.total_items : 0;
    const averageDeliveryDays = itemsAgg.avg_delivery_days || null;

    const monthlyQuery =
      `SELECT to_char(date_trunc('month', COALESCE(sq.received_at, sq.sent_at, sq.created_at)),'YYYY-MM') as month,
              COUNT(*)::int as count
       FROM supplier_quotations sq
       WHERE sq.supplier_id = $1` +
       (start && end ? ` AND ((COALESCE(sq.sent_at, sq.created_at) BETWEEN $2 AND $3) OR (sq.received_at BETWEEN $2 AND $3))` : ``) +
       ` GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 12`;
    const monthlyParams = start && end ? [supplierId, start, end] : [supplierId];
    const monthlyResult = await pool.query(monthlyQuery, monthlyParams);
    const monthlyActivity = monthlyResult.rows;

    const responseTimeScore = avgResponseTimeHours !== null
      ? Math.max(0, 1 - Math.min(avgResponseTimeHours / 72, 1))
      : 0.5;
    const score = (
      responseRate * 0.25 +
      winRate * 0.3 +
      availabilityRate * 0.2 +
      averageDiscountRate * 0.15 +
      responseTimeScore * 0.1
    ) * 100;

    let recommendationIndex = "Regular";
    if (score >= 85) recommendationIndex = "Excelente";
    else if (score >= 70) recommendationIndex = "Bom";
    else if (score >= 50) recommendationIndex = "Regular";
    else recommendationIndex = "Baixo";

    return {
      supplier,
      metrics: {
        totalSent,
        responded,
        wins,
        responseRate,
        winRate,
        avgResponseTimeHours,
        totalQuotedValue,
        averageTicket,
        averageDiscountRate,
        availabilityRate,
        averageDeliveryDays,
        monthlyActivity,
        score,
        recommendationIndex,
      },
      quotations,
    };
  }
}

export const reportService = new ReportService();
