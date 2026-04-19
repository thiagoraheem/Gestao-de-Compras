import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, User, FileText, Eye, RefreshCw, Search } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/pagination";
import { formatCurrency } from "@/lib/currency";

import type { PurchaseRequest } from "./types";
import type { ReportFilters } from "./usePurchaseRequestsReport";

const phaseColors = {
  "Aguardando Aprovação A1": "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200",
  "Aguardando Aprovação A2": "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-200",
  "Aprovado - Aguardando Cotação": "bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
  "Em Cotação": "bg-purple-500/15 text-purple-700 dark:bg-purple-400/20 dark:text-purple-200",
  "Cotação Recebida": "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-200",
  "Pedido Gerado": "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200",
  Concluído: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200",
  Rejeitado: "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-200",
};

const urgencyColors = {
  baixa: "bg-muted text-muted-foreground",
  medio: "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200",
  alto: "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-200",
  alta_urgencia: "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-200",
};

const urgencyLabels = {
  baixa: "Baixa",
  medio: "Média",
  alto: "Alta",
  alta_urgencia: "Crítica",
};

interface ReportTableProps {
  isLoading: boolean;
  isRefetching: boolean;
  activeFilters: ReportFilters | null;
  totalItems: number;
  requests: PurchaseRequest[];
  visibleRequests: PurchaseRequest[];
  expandedRows: Set<number>;
  toggleRowExpansion: (id: number) => void;
  totals: {
    totalValorItens: number;
    totalDesconto: number;
    totalSubTotal: number;
    totalDescontoProposta: number;
    totalValorFinal: number;
  };
  pageTotals?: {
    totalValorItens: number;
    totalDesconto: number;
    totalSubTotal: number;
    totalDescontoProposta: number;
    totalValorFinal: number;
  };
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function ReportTable({
  isLoading,
  isRefetching,
  activeFilters,
  totalItems,
  requests,
  visibleRequests,
  expandedRows,
  toggleRowExpansion,
  totals,
  pageTotals,
  page,
  totalPages,
  setPage
}: ReportTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados</CardTitle>
        <CardDescription>
          {(isLoading || isRefetching)
            ? "Carregando..."
            : activeFilters 
              ? `${totalItems} solicitação(ões) encontrada(s)`
              : "Utilize os filtros e clique em Consultar para ver os resultados"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(isLoading || isRefetching) ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Processando consulta...</p>
          </div>
        ) : !activeFilters ? (
           <div className="text-center py-12 text-muted-foreground">
             <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
             <p className="text-lg font-medium">Aguardando consulta</p>
             <p>Preencha os filtros e clique em Consultar.</p>
           </div>
        ) : (
          <div className="overflow-x-auto space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Valor Itens</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Desc. Global</TableHead>
                  <TableHead>Valor Final</TableHead>
                  <TableHead>Urgência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRequests.map((request: PurchaseRequest) => (
                  <React.Fragment key={request.id}>
                    <TableRow className="cursor-pointer hover:bg-accent hover:text-accent-foreground">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(request.id)}
                        >
                          {expandedRows.has(request.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {request.requestNumber}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.description}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.requestDate), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                      <TableCell>{request.departmentName}</TableCell>
                      <TableCell>{request.supplierName}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            phaseColors[
                              request.phase as keyof typeof phaseColors
                            ] || "bg-gray-100 text-gray-800"
                          }
                        >
                          {request.phase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(request.valorItens)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(request.desconto)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(request.subTotal)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(request.descontoProposta)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(request.valorFinal)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            urgencyColors[
                              request.urgency as keyof typeof urgencyColors
                            ] || "bg-gray-100 text-gray-800"
                          }
                        >
                          {urgencyLabels[request.urgency as keyof typeof urgencyLabels] || request.urgency}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row Content */}
                    {expandedRows.has(request.id) && (
                      <TableRow>
                        <TableCell colSpan={12} className="bg-muted p-6">
                          <div className="space-y-6">
                            {/* Approval Information */}
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Aprovação
                              </h4>
                              <div className="bg-card rounded-lg border border-border p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">
                                      Aprovador A1
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {request.approverA1Name}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">
                                      Aprovador A2
                                    </p>
                                    <p className="text-sm font-semibold">
                                      {request.approverA2Name}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Itens da Solicitação
                              </h4>
                              <div className="bg-card rounded-lg border border-border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Descrição</TableHead>
                                      <TableHead>Quantidade</TableHead>
                                      <TableHead>Unidade</TableHead>
                                      <TableHead>Valor do Item</TableHead>
                                      <TableHead>Valor Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {request.items?.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell>
                                          {item.description}
                                        </TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{item.unit}</TableCell>
                                        <TableCell>
                                          {item.unitPrice ? formatCurrency(item.unitPrice) : "N/A"}
                                        </TableCell>
                                        <TableCell>
                                          {item.totalPrice ? formatCurrency(item.totalPrice) : "N/A"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            {/* Approvals */}
                            {request.approvals &&
                              request.approvals.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Aprovações
                                  </h4>
                                  <div className="bg-card rounded-lg border border-border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Nível</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Aprovador</TableHead>
                                          <TableHead>Data</TableHead>
                                          <TableHead>Comentários</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {request.approvals.map((approval) => (
                                          <TableRow key={approval.id}>
                                            <TableCell>
                                              {approval.level}
                                            </TableCell>
                                            <TableCell>
                                              <Badge
                                                className={
                                                  approval.status ===
                                                  "Aprovado"
                                                    ? "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200"
                                                    : "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-200"
                                                }
                                              >
                                                {approval.status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              {approval.approverName}
                                            </TableCell>
                                            <TableCell>
                                              {format(
                                                new Date(
                                                  approval.approvalDate,
                                                ),
                                                "dd/MM/yyyy HH:mm",
                                                { locale: ptBR },
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {approval.comments || "-"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}

                            {/* Quotations */}
                            {request.quotations &&
                              request.quotations.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Cotações
                                  </h4>
                                  <div className="bg-card rounded-lg border border-border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Fornecedor</TableHead>
                                          <TableHead>Valor Total</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Data de Envio</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {request.quotations.map(
                                          (quotation) => (
                                            <TableRow key={quotation.id}>
                                              <TableCell>
                                                {quotation.supplierName}
                                              </TableCell>
                                              <TableCell>
                                                {formatCurrency(
                                                  quotation.totalValue,
                                                )}
                                              </TableCell>
                                              <TableCell>
                                              <Badge
                                                  className={
                                                    quotation.status ===
                                                    "Enviada"
                                                      ? "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200"
                                                      : "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200"
                                                  }
                                                >
                                                  {quotation.status}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>
                                                {format(
                                                  new Date(
                                                    quotation.submissionDate,
                                                  ),
                                                  "dd/MM/yyyy HH:mm",
                                                  { locale: ptBR },
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ),
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}

                            {/* Purchase Orders */}
                            {request.purchaseOrders &&
                              request.purchaseOrders.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Pedidos de Compra
                                  </h4>
                                  <div className="bg-card rounded-lg border border-border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>
                                            Número do Pedido
                                          </TableHead>
                                          <TableHead>Fornecedor</TableHead>
                                          <TableHead>Valor Total</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>
                                            Data do Pedido
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {request.purchaseOrders.map(
                                          (order) => (
                                            <TableRow key={order.id}>
                                              <TableCell className="font-medium">
                                                {order.orderNumber}
                                              </TableCell>
                                              <TableCell>
                                                {order.supplierName}
                                              </TableCell>
                                              <TableCell>
                                                {formatCurrency(
                                                  order.totalValue,
                                                )}
                                              </TableCell>
                                              <TableCell>
                                              <Badge
                                                  className={
                                                    order.status === "Enviado"
                                                      ? "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200"
                                                      : "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200"
                                                  }
                                                >
                                                  {order.status}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>
                                                {format(
                                                  new Date(order.orderDate),
                                                  "dd/MM/yyyy HH:mm",
                                                  { locale: ptBR },
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ),
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}

                {/* Subtotals Row (Current Page) */}
                {requests.length > 0 && pageTotals && (
                  <TableRow className="bg-muted/50 font-semibold border-t border-border">
                    <TableCell colSpan={8} className="font-bold text-right py-4 pr-6">Subtotal da Página</TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(pageTotals.totalValorItens)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(pageTotals.totalDesconto)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(pageTotals.totalSubTotal)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(pageTotals.totalDescontoProposta)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(pageTotals.totalValorFinal)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}

                {/* Totals Row (Global) */}
                {requests.length > 0 && totals && (
                  <TableRow className="bg-muted font-semibold border-t border-border">
                    <TableCell colSpan={8} className="font-bold text-right py-4 pr-6">Total Geral Estimado (Filtros)</TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(totals.totalValorItens)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(totals.totalDesconto)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(totals.totalSubTotal)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(totals.totalDescontoProposta)}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {formatCurrency(totals.totalValorFinal)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {requests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/60" />
                <p>
                  Nenhuma solicitação encontrada com os filtros aplicados.
                </p>
              </div>
            )}
            
            {/* Pagination */}
            {totalItems > 0 && (
              <div className="flex items-center justify-end py-4">
                 <div className="flex-1 text-sm text-muted-foreground">
                   Página {page} de {totalPages} ({totalItems} registros)
                 </div>
                 <Pagination>
                   <PaginationContent>
                     <PaginationItem>
                       <PaginationPrevious 
                         onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                         className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                       />
                     </PaginationItem>
                     
                     {page > 2 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">1</PaginationLink>
                        </PaginationItem>
                     )}
                     {page > 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                     )}
                     
                     {page > 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(page - 1)} className="cursor-pointer">{page - 1}</PaginationLink>
                        </PaginationItem>
                     )}
                     
                     <PaginationItem>
                       <PaginationLink isActive>{page}</PaginationLink>
                     </PaginationItem>
                     
                     {page < totalPages && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(page + 1)} className="cursor-pointer">{page + 1}</PaginationLink>
                        </PaginationItem>
                     )}
                     
                     {page < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                     )}
                     {page < totalPages - 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
                        </PaginationItem>
                     )}

                     <PaginationItem>
                       <PaginationNext 
                         onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                         className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                       />
                     </PaginationItem>
                   </PaginationContent>
                 </Pagination>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
