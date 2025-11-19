import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PHASE_LABELS, PURCHASE_PHASES, URGENCY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ApprovalTypeBadge, ApprovalProgressBadge } from "@/components/ApprovalTypeBadge";
import RequestPhase from "./request-phase";
import ApprovalA1Phase from "./approval-a1-phase";
import ApprovalA2Phase from "./approval-a2-phase";
import QuotationPhase from "./quotation-phase";
import PurchaseOrderPhase from "./purchase-order-phase";
import ReceiptPhase from "./receipt-phase";
import ConclusionPhase from "./conclusion-phase";
import RequestView from "./request-view";

interface RequestListProps {
  departmentFilter?: string;
  urgencyFilter?: string;
  requesterFilter?: string;
  supplierFilter?: string;
  searchFilter?: string;
  dateFilter?: { startDate: string; endDate: string };
  openPhases?: string[];
  onOpenPhasesChange?: (value: string[]) => void;
}

export default function RequestList({
  departmentFilter = "all",
  urgencyFilter = "all",
  requesterFilter = "all",
  supplierFilter = "all",
  searchFilter = "",
  dateFilter,
  openPhases,
  onOpenPhasesChange,
}: RequestListProps) {
  const { user } = useAuth();
  const [activeRequest, setActiveRequest] = useState<any | null>(null);

  const { data: purchaseRequests, isLoading } = useQuery({
    queryKey: ["/api/purchase-requests"],
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    staleTime: 1000 * 60,
    enabled: !!user,
  });

  const highlightedRequestIds = useMemo(() => {
    const ids = new Set<number>();
    if (searchFilter && searchFilter.trim()) {
      const query = searchFilter.toLowerCase().trim();
      const allRequests = Array.isArray(purchaseRequests) ? purchaseRequests : [];
      allRequests.forEach((request: any) => {
        const searchFields = [
          request.requestNumber?.toLowerCase(),
          request.title?.toLowerCase(),
          request.description?.toLowerCase(),
          request.justification?.toLowerCase(),
          request.requester?.firstName?.toLowerCase(),
          request.requester?.lastName?.toLowerCase(),
          request.requester?.username?.toLowerCase(),
          request.department?.name?.toLowerCase(),
          request.chosenSupplier?.name?.toLowerCase(),
          request.chosenSupplier?.cnpj?.toLowerCase(),
          ...(request.items || []).map((item: any) => `${item.description} ${item.technicalSpecification} ${item.model} ${item.brand}`.toLowerCase()),
        ].filter(Boolean);
        const matchesSearch = searchFields.some((field) => field && field.includes(query));
        const numbers = query.replace(/[^\d]/g, "");
        const matchesRequestNumber = numbers && request.requestNumber?.replace(/[^\d]/g, "").includes(numbers);
        if (matchesSearch || matchesRequestNumber) ids.add(request.id);
      });
    }
    return ids;
  }, [searchFilter, purchaseRequests]);

  const filteredRequests = Array.isArray(purchaseRequests)
    ? purchaseRequests.filter((request: any) => {
      let passes = true;
      if (departmentFilter !== "all") passes = passes && request.department?.id?.toString() === departmentFilter;
      if (urgencyFilter !== "all") passes = passes && request.urgency === urgencyFilter;
      if (requesterFilter !== "all") passes = passes && request.requester?.id?.toString() === requesterFilter;
      if (supplierFilter !== "all") passes = passes && request.chosenSupplier?.id?.toString() === supplierFilter;
      if (dateFilter && (request.currentPhase === PURCHASE_PHASES.ARQUIVADO || request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA)) {
        const requestDate = new Date(request.updatedAt || request.createdAt);
        const startDate = new Date(dateFilter.startDate);
        const endDate = new Date(dateFilter.endDate);
        endDate.setHours(23, 59, 59, 999);
        passes = passes && requestDate >= startDate && requestDate <= endDate;
      }
      return passes;
    })
    : [];

  const urgencyOrder = { alto: 1, medio: 2, baixo: 3 } as Record<string, number>;
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const ua = urgencyOrder[a.urgency] ?? 999;
    const ub = urgencyOrder[b.urgency] ?? 999;
    if (ua !== ub) return ua - ub;
    const da = new Date(a.idealDeliveryDate);
    const db = new Date(b.idealDeliveryDate);
    return da.getTime() - db.getTime();
  });

  const formatRelative = (date: any) => {
    if (!date) return "";
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };
  const groupedByPhase = Object.values(PURCHASE_PHASES).reduce((acc: Record<string, any[]>, phase) => {
    acc[phase] = sortedRequests.filter((r) => r.currentPhase === phase);
    return acc;
  }, {} as Record<string, any[]>);

  const defaultOpen = Object.entries(groupedByPhase)
    .filter(([_, items]) => items.length > 0)
    .map(([phase]) => phase);

  const accordionControlProps = openPhases
    ? { value: openPhases, onValueChange: onOpenPhasesChange }
    : { defaultValue: defaultOpen };

  return (
    <div className="h-full px-4 md:px-6 py-4 overflow-auto">
      <div className="mb-3 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-muted/50 border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">Total de Solicitações do Período</div>
          <div className="text-lg font-semibold">{sortedRequests.length}</div>
        </div>
        <div className="bg-muted/50 border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">% em Aprovação</div>
          <div className="text-lg font-semibold">
            {(() => {
              const total = sortedRequests.length || 0;
              const approval = sortedRequests.filter((r) => r.currentPhase === PURCHASE_PHASES.APROVACAO_A1 || r.currentPhase === PURCHASE_PHASES.APROVACAO_A2).length;
              const pct = total ? Math.round((approval / total) * 100) : 0;
              return `${pct}%`;
            })()}
          </div>
        </div>
        <div className="bg-muted/50 border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">% em Cotação</div>
          <div className="text-lg font-semibold">
            {(() => {
              const total = sortedRequests.length || 0;
              const cnt = sortedRequests.filter((r) => r.currentPhase === PURCHASE_PHASES.COTACAO).length;
              const pct = total ? Math.round((cnt / total) * 100) : 0;
              return `${pct}%`;
            })()}
          </div>
        </div>
        <div className="bg-muted/50 border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">% cotação com RFQ criada</div>
          <div className="text-lg font-semibold">
            {(() => {
              const cotacoes = sortedRequests.filter((r) => r.currentPhase === PURCHASE_PHASES.COTACAO);
              const total = cotacoes.length || 0;
              const withRfq = cotacoes.filter((r) => r.hasQuotation).length;
              const pct = total ? Math.round((withRfq / total) * 100) : 0;
              return `${pct}%`;
            })()}
          </div>
        </div>
        <div className="bg-muted/50 border rounded-md p-3">
          <div className="text-[11px] text-muted-foreground">% Concluído</div>
          <div className="text-lg font-semibold">
            {(() => {
              const total = sortedRequests.length || 0;
              const done = sortedRequests.filter((r) => r.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA).length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return `${pct}%`;
            })()}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-md">
        <Accordion type="multiple" {...accordionControlProps}>
          {Object.values(PURCHASE_PHASES).map((phase) => (
            <AccordionItem key={phase} value={phase}>
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-3 w-1 rounded",
                    phase === PURCHASE_PHASES.SOLICITACAO && "bg-[var(--kanban-solicitacao)]",
                    phase === PURCHASE_PHASES.APROVACAO_A1 && "bg-[var(--kanban-aprovacao-a1)]",
                    phase === PURCHASE_PHASES.COTACAO && "bg-[var(--kanban-cotacao)]",
                    phase === PURCHASE_PHASES.APROVACAO_A2 && "bg-[var(--kanban-aprovacao-a2)]",
                    phase === PURCHASE_PHASES.PEDIDO_COMPRA && "bg-[var(--kanban-pedido)]",
                    phase === PURCHASE_PHASES.RECEBIMENTO && "bg-[var(--kanban-recebimento)]",
                    phase === PURCHASE_PHASES.CONCLUSAO_COMPRA && "bg-[var(--kanban-conclusao)]",
                    phase === PURCHASE_PHASES.ARQUIVADO && "bg-[var(--kanban-arquivado)]"
                  )} />
                  <div className="text-sm font-medium">{PHASE_LABELS[phase as keyof typeof PHASE_LABELS]}</div>
                  <Badge variant="secondary" className="text-[11px]">{groupedByPhase[phase]?.length || 0}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table className="text-xs table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Nº</TableHead>
                      <TableHead className="w-[520px]">Descrição</TableHead>
                      <TableHead className="w-44">Departamento</TableHead>
                      <TableHead className="w-44">Solicitante</TableHead>
                      <TableHead className="w-44">Fornecedor</TableHead>
                      <TableHead className="w-28">Urgência</TableHead>
                      <TableHead className="w-28">Categoria</TableHead>
                      <TableHead className="w-32">Valor</TableHead>
                      <TableHead className="w-40">Aprovação</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Carregando...</TableCell>
                      </TableRow>
                    )}
                    {!isLoading && (groupedByPhase[phase]?.length || 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Sem itens nesta fase</TableCell>
                      </TableRow>
                    )}
                    {(groupedByPhase[phase] || []).map((request: any) => (
                      <TableRow key={request.id} className={cn(
                        "cursor-pointer",
                        highlightedRequestIds.has(request.id) && "ring-1 ring-blue-500 bg-blue-50"
                      )} onClick={() => setActiveRequest(request)}>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5">{request.requestNumber}</Badge>
                        </TableCell>
                        <TableCell className="w-[520px]">
                          <div className="line-clamp-2 break-words" title={request.justification}>{request.justification}</div>
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                            <span>{formatRelative(request.createdAt)}</span>
                            <span>•</span>
                            <span>{request.items?.length || 0} itens</span>
                            {request.hasPendency && phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
                              <Badge variant="destructive" className="text-[11px] px-1.5 py-0.5">Pendência</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="truncate">{request.department?.name || "—"}</TableCell>
                        <TableCell className="truncate">{request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "—"}</TableCell>
                        <TableCell className="truncate">{request.chosenSupplier?.name || "—"}</TableCell>
                        <TableCell>
                          {request.urgency && (
                            <Badge variant={request.urgency === "alta_urgencia" || request.urgency === "alto" ? "destructive" : "secondary"} className="text-[11px] px-1.5 py-0.5">
                              {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0.5">{request.category?.[0]?.toUpperCase() + request.category?.slice(1) || "—"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(request.totalValue)}</TableCell>
                        <TableCell>
                          {phase === PURCHASE_PHASES.APROVACAO_A2 && (
                            <div className="flex items-center gap-2">
                              <ApprovalTypeBadge approvalType={request.approvalType || 'single'} />
                              {request.approvalProgress && (
                                <ApprovalProgressBadge
                                  approvalType={request.approvalType || 'single'}
                                  currentStep={request.approvalProgress.currentStep}
                                  totalSteps={request.approvalProgress.totalSteps}
                                />
                              )}
                            </div>
                          )}
                          {phase !== PURCHASE_PHASES.APROVACAO_A2 && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {request.approverA1 ? `Aprovador: ${request.approverA1.firstName} ${request.approverA1.lastName}` : "Aprovador: Pendente"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setActiveRequest(request); }}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {activeRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setActiveRequest(null)}>
          <div className="bg-card rounded-lg w-full mx-4 max-w-6xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {activeRequest.currentPhase === PURCHASE_PHASES.SOLICITACAO && (
              <RequestPhase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.APROVACAO_A1 && (
              <ApprovalA1Phase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.COTACAO && (
              <QuotationPhase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.APROVACAO_A2 && (
              <ApprovalA2Phase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.PEDIDO_COMPRA && (
              <PurchaseOrderPhase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.RECEBIMENTO && (
              <ReceiptPhase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
              <ConclusionPhase request={activeRequest} onClose={() => setActiveRequest(null)} className="p-6" />
            )}
            {activeRequest.currentPhase === PURCHASE_PHASES.ARQUIVADO && (
              <RequestView request={activeRequest} onClose={() => setActiveRequest(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
