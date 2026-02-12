import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PurchaseRequestHeaderContext = "physical" | "fiscal";

/**
 * Card de cabeçalho reutilizável para solicitações e pedidos de compra.
 *
 * Este componente foi extraído do fluxo de Recebimento Físico e pode ser
 * utilizado também na Conferência Fiscal. Ele exibe informações principais
 * como número da solicitação/pedido, solicitante, fornecedor, data,
 * valor total e status, permitindo variação visual conforme o contexto.
 */
export interface PurchaseRequestHeaderCardProps {
  /**
   * Contexto de uso do card.
   * - "physical": Recebimento Físico
   * - "fiscal"  : Conferência Fiscal
   */
  context?: PurchaseRequestHeaderContext;

  /**
   * Número da solicitação (requestNumber).
   */
  requestNumber?: string | number;

  /**
   * Número do pedido de compra associado (orderNumber).
   */
  orderNumber?: string | number;

  /**
   * Nome completo do solicitante.
   */
  requesterName?: string;

  /**
   * Nome do fornecedor selecionado ou associado.
   */
  supplierName?: string;

  /**
   * Data do pedido já formatada para exibição.
   */
  orderDate?: string;

  /**
   * Valor total do pedido já formatado (ex: "R$ 1.234,56").
   */
  totalValue?: string;

  /**
   * Texto descritivo do status atual do processo.
   */
  status?: string;

  /**
   * Classes adicionais para estilização do container.
   */
  className?: string;
}

const PurchaseRequestHeaderCard: React.FC<PurchaseRequestHeaderCardProps> = ({
  context = "physical",
  requestNumber,
  orderNumber,
  requesterName,
  supplierName,
  orderDate,
  totalValue,
  status,
  className,
}) => {
  const themeClasses =
    context === "fiscal"
      ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-slate-950/40"
      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60";

  const fullRequestNumber =
    requestNumber !== undefined && requestNumber !== null
      ? String(requestNumber)
      : "";

  const fullOrderNumber =
    orderNumber !== undefined && orderNumber !== null
      ? String(orderNumber)
      : "";

  const hasOrderNumber = fullOrderNumber.length > 0;

  return (
    <Card className={cn("border", themeClasses, className)}>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 text-sm pt-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Solicitação / Pedido
          </p>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {fullRequestNumber}
            {hasOrderNumber && <> / {fullOrderNumber}</>}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Solicitante
          </p>
          <p className="text-slate-900 dark:text-slate-100 truncate">
            {requesterName && requesterName.trim().length > 0
              ? requesterName
              : "N/A"}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Fornecedor
          </p>
          <p className="text-slate-900 dark:text-slate-100 truncate">
            {supplierName && supplierName.trim().length > 0
              ? supplierName
              : "Não definido"}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Data do Pedido
          </p>
          <p className="text-slate-900 dark:text-slate-100">
            {orderDate && orderDate.trim().length > 0 ? orderDate : "N/A"}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Valor Total
          </p>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {totalValue && totalValue.trim().length > 0 ? totalValue : "R$ 0,00"}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Status Atual
          </p>
          <p className="text-slate-900 dark:text-slate-100">
            {status && status.trim().length > 0 ? status : "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PurchaseRequestHeaderCard;

