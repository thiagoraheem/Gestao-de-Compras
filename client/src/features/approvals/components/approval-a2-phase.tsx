import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate } from "@/lib/date";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Building,
  FileText,
  Calendar,
  DollarSign,
  MessageSquare,
  History,
  Paperclip,
  BarChart3,
  Truck,
  Download,
  Printer
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Textarea } from "@/shared/ui/textarea";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Label } from "@/shared/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useApprovalType } from "@/hooks/useApprovalType";
import { apiRequest } from "@/lib/queryClient";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import AttachmentsViewer from "@/features/requests/components/attachments-viewer";
import SupplierComparisonReadonly from "@/features/quotations/components/supplier-comparison-readonly";
import debug from "@/lib/debug";
import { formatDualCurrency, formatDualCurrencyBrlFirst, normalizeCurrencyCode, CURRENCY_SYMBOLS, formatCurrencyIn, roundCurrency } from "@/lib/currency";

const approvalSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  rejectionAction: z.enum(['arquivar', 'recotacao']).optional(),
}).refine((data) => {
  if (!data.approved && (!data.rejectionReason || data.rejectionReason.trim().length < 10)) {
    return false;
  }
  return true;
}, {
  message: "Justificativa de reprovação deve ter pelo menos 10 caracteres",
  path: ["rejectionReason"],
});

type ApprovalFormData = z.infer<typeof approvalSchema>;

interface ApprovalA2PhaseProps {
  request: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAction?: 'approve' | 'reject' | null;
}

// Função para mapear tipos de aprovação para descrições de fase
const getPhaseDescription = (approverType: string): string => {
  switch (approverType) {
    case 'A1':
      return 'Aprovação A1';
    case 'A2':
      return 'Aprovação A2';
    default:
      return approverType;
  }
};

const brlCurrencyFormatter4 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const decimalFormatter4 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const parseLooseNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  let cleaned = raw.replace(/[^\d,.\-]/g, "");
  cleaned = cleaned.replace(/(?!^)-/g, "");
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    normalized = normalized.replace(",", ".");
  } else if (!hasComma && hasDot) {
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount > 1) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatBRLCurrency4 = (value: unknown): string => {
  return brlCurrencyFormatter4.format(parseLooseNumber(value));
};

const formatDecimal4 = (value: unknown): string => {
  return decimalFormatter4.format(parseLooseNumber(value));
};

export default function ApprovalA2Phase({ request, open, onOpenChange, initialAction = null }: ApprovalA2PhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(initialAction);
  const [showComparison, setShowComparison] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const currencyCodeNorm = normalizeCurrencyCode(request?.currencyCode);
  const exchangeRateNum = parseLooseNumber(request?.exchangeRate);
  const isForeign = currencyCodeNorm !== 'BRL' && exchangeRateNum > 0;

  const sqExchangeRate = (sq: any) => {
    const sqRate = parseLooseNumber(sq?.exchangeRate);
    return sqRate > 0 ? sqRate : exchangeRateNum;
  };

  const toOrig = (brl: number, rate = exchangeRateNum): number => {
    if (!isForeign) return brl;
    return rate > 0 ? brl / rate : brl;
  };

  const toBRL = (orig: number, rate = exchangeRateNum): number => {
    if (!isForeign) return orig;
    return rate > 0 ? orig * rate : orig;
  };

  const formatCurrency4 = (orig: number, brl: number, code: any = currencyCodeNorm): string => {
    const normCode = normalizeCurrencyCode(code);
    if (normCode === 'BRL') return brlCurrencyFormatter4.format(brl);
    const origFmt = formatCurrencyIn(normCode, orig, 4);
    const brlFmt = formatCurrencyIn('BRL', brl, 4);
    return `${origFmt}  (${brlFmt})`;
  };

  // Para valores informados EM BRL (request) — divide por taxa para obter moeda original
  const fmtBRL4 = (brl: number, rate = exchangeRateNum): string => formatCurrency4(toOrig(brl, rate), brl);
  // Para valores informados EM MOEDA ORIGINAL (itens do fornecedor) — multiplica por taxa p/ obter BRL
  const fmtOrig4 = (orig: number, rate = exchangeRateNum): string => formatCurrency4(orig, toBRL(orig, rate), currencyCodeNorm);

  const formatRate = (rate: number): string => {
    if (!rate) return '—';
    return rate.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  // Check if user has A2 approval permissions
  const canApprove = user?.isApproverA2 || false;

  // Removed attachments query - no longer showing purchase request attachments

  // Buscar anexos de fornecedores para esta solicitação
  const { data: supplierAttachments } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/supplier-attachments`],
  });

  const { data: approvalHistory } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  const { data: requestItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
  });

  const { data: selectedSupplier } = useQuery<any>({
    queryKey: [`/api/purchase-requests/${request.id}/selected-supplier`],
  });

  // Buscar cotação para obter valores dos itens
  const { data: quotation } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Buscar items do fornecedor selecionado para obter preços
  const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen) || supplierQuotations[0];

  const { data: supplierQuotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });

  const { data: quotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/items`],
    enabled: !!quotation?.id,
  });

  const originalItems = requestItems.map(item => ({
    id: item.id,
    description: item.description,
    unit: item.unit,
    requestedQuantity: parseLooseNumber(item.requestedQuantity)
  }));

  const approvedItemIds = new Set(
    selectedSupplier?.approvedItems?.map((ai: any) => ai.supplierQuotationItemId) || []
  );
  const hasApprovedItems = selectedSupplier?.approvedItems && selectedSupplier.approvedItems.length > 0;

  const winningItems = supplierQuotationItems
    .filter(si => {
      if (hasApprovedItems) {
        return approvedItemIds.has(si.id);
      }
      return si.isAvailable !== false;
    })
    .map(si => {
      const qi = quotationItems.find((q: any) => q.id === si.quotationItemId);
      const description = si.description || qi?.description || '';
      const unit = si.confirmedUnit || qi?.unit || '';
      // Use available quantity if provided and > 0, otherwise fallback to requested quantity
      const siQty = parseLooseNumber(si.availableQuantity);
      const quantity = (siQty > 0) ? siQty : parseLooseNumber(qi?.quantity || 0);
      const unitPrice = parseLooseNumber(si.unitPrice);

      // If we have a stored totalPrice, use it as a base, otherwise recalculate
      const storedTotalPrice = parseLooseNumber(si.totalPrice);
      const originalTotalPrice = (storedTotalPrice > 0) ? storedTotalPrice : (unitPrice * quantity);

      let itemDiscount = 0;
      let totalPrice = originalTotalPrice;

      const discountPercentageNum = parseLooseNumber(si.discountPercentage);
      const discountValueNum = parseLooseNumber(si.discountValue);

      // If we have discountedTotalPrice from DB, use it
      const storedDiscountedTotal = parseLooseNumber(si.discountedTotalPrice);
      if (storedDiscountedTotal > 0) {
        totalPrice = storedDiscountedTotal;
        itemDiscount = Math.max(0, originalTotalPrice - totalPrice);
      } else if (discountPercentageNum > 0) {
        const d = discountPercentageNum;
        itemDiscount = (originalTotalPrice * d) / 100;
        totalPrice = originalTotalPrice - itemDiscount;
      } else if (discountValueNum > 0) {
        itemDiscount = discountValueNum;
        totalPrice = Math.max(0, originalTotalPrice - itemDiscount);
      }
      return {
        id: si.id,
        description,
        unit,
        quantity,
        unitPrice,
        itemDiscount,
        originalTotalPrice,
        totalPrice
      };
    });

  const { subtotalNet, proposalDiscount, freightValue, finalTotalValue, subtotalNetBrl, proposalDiscountBrl, freightValueBrl, finalTotalValueBrl } = ((): {
    subtotalNet: number;
    proposalDiscount: number;
    freightValue: number;
    finalTotalValue: number;
    subtotalNetBrl: number;
    proposalDiscountBrl: number;
    freightValueBrl: number;
    finalTotalValueBrl: number;
  } => {
    const subtotal = winningItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

    if (!selectedSupplierQuotation) return {
      subtotalNet: subtotal,
      proposalDiscount: 0,
      freightValue: 0,
      finalTotalValue: subtotal,
      subtotalNetBrl: subtotal,
      proposalDiscountBrl: 0,
      freightValueBrl: 0,
      finalTotalValueBrl: subtotal,
    };

    const rate = sqExchangeRate(selectedSupplierQuotation);

    const discountInput = parseLooseNumber(selectedSupplierQuotation.discountValue);
    let discount = 0;
    let discountBrl = 0;

    if (selectedSupplierQuotation.discountType === 'percentage') {
      discount = (subtotal * discountInput) / 100;
      const subtotalBrl = toBRL(subtotal, rate);
      discountBrl = (subtotalBrl * discountInput) / 100;
    } else if (selectedSupplierQuotation.discountType === 'fixed') {
      discount = discountInput;
      discountBrl = toBRL(discountInput, rate);
    }

    const freight = selectedSupplierQuotation.includesFreight
      ? parseLooseNumber(selectedSupplierQuotation.freightValue)
      : 0;
    const freightBrl = selectedSupplierQuotation.includesFreight
      ? toBRL(parseLooseNumber(selectedSupplierQuotation.freightValue), rate)
      : 0;

    const total = Math.max(0, subtotal - discount) + freight;
    const totalBrl = Math.max(0, toBRL(subtotal, rate) - discountBrl) + freightBrl;

    const storedTotal = parseLooseNumber(selectedSupplierQuotation.finalValue || selectedSupplierQuotation.totalValue);
    const storedTotalBrl = parseLooseNumber(selectedSupplierQuotation.finalValueBrl || selectedSupplierQuotation.totalValueBrl);
    const finalTotal = (total > 0) ? total : (storedTotal > 0 ? storedTotal : subtotal);
    const finalTotalBrl = (totalBrl > 0)
      ? totalBrl
      : (storedTotalBrl > 0 ? storedTotalBrl : toBRL(storedTotal > 0 ? storedTotal : subtotal, rate));

    const subtotalNetStoredBrl = parseLooseNumber(selectedSupplierQuotation.subtotalValueBrl);
    return {
      subtotalNet: subtotal,
      proposalDiscount: discount,
      freightValue: freight,
      finalTotalValue: finalTotal,
      subtotalNetBrl: subtotalNetStoredBrl > 0 ? subtotalNetStoredBrl : toBRL(subtotal, rate),
      proposalDiscountBrl: discountBrl,
      freightValueBrl: freightBrl,
      finalTotalValueBrl: finalTotalBrl,
    };
  })();

  const totalValue = finalTotalValue || parseLooseNumber(request.totalValue);
  const totalValueBrl = finalTotalValueBrl > 0
    ? finalTotalValueBrl
    : (parseLooseNumber(request.totalValue) > 0
        ? parseLooseNumber(request.totalValue)
        : toBRL(totalValue, sqExchangeRate(selectedSupplierQuotation)));

  // Regras de aprovação (valores limiares) são SEMPRE em BRL, mesmo que moeda original seja estrangeira
  const { data: approvalType, approvalInfo } = useApprovalType(totalValueBrl, request.id);

  const codeForDisplay = request.currencyCode || selectedSupplierQuotation?.currencyCode;

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      approved: initialAction === 'approve' ? true : false,
      rejectionReason: "",
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      debug.log("Sending A2 approval data:", data);
      // Usar o novo endpoint que implementa dupla aprovação
      const response = await apiRequest(`/api/approval-rules/${request.id}/approve`, {
        method: "POST",
        body: {
          ...data,
          approverId: user?.id,
        },
      });
      return response;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });

      // Mensagem baseada no resultado da dupla aprovação
      let message = "Aprovação processada com sucesso!";

      if (result.isComplete) {
        // Aprovação completa (single ou segunda aprovação dual)
        if (variables.approved) {
          message = "Solicitação aprovada e movida para Pedido de Compra!";
        } else {
          if (variables.rejectionAction === "recotacao") {
            message = "Solicitação reprovada e movida para nova Cotação!";
          } else {
            message = "Solicitação reprovada e movida para Arquivado!";
          }
        }
      } else {
        // Primeira aprovação em dupla aprovação
        if (variables.approved) {
          message = "Primeira aprovação realizada! Aguardando aprovação final do CEO.";
        } else {
          message = "Solicitação reprovada na primeira aprovação.";
        }
      }

      toast({
        title: "Sucesso",
        description: message,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      debug.error("Erro na aprovação A2:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao processar aprovação A2",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApprovalFormData) => {
    approvalMutation.mutate(data);
  };

  const handleApprove = () => {
    setSelectedAction('approve');
    form.setValue('approved', true);
  };

  const handleReject = () => {
    setSelectedAction('reject');
    form.setValue('approved', false);
  };

  // Função para download do PDF
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/approval-a2-pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Aprovacao_A2_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "PDF da aprovação A2 baixado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao baixar PDF da aprovação A2",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Função para imprimir
  const handlePrint = async () => {
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/approval-a2-pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF para impressão');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Abrir em nova janela para impressão
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      // Limpar URL após um tempo
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

      toast({
        title: "Sucesso",
        description: "PDF preparado para impressão!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao preparar PDF para impressão",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" aria-describedby="approval-a2-description">
          <div className="flex-shrink-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Aprovação A2 - Solicitação #{request.requestNumber}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {request.urgency && (
                  <Badge variant={request.urgency === "alto" ? "destructive" : "secondary"}>
                    {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS] || request.urgency}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="h-8 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isDownloading ? 'Gerando...' : 'Gerar PDF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <XCircle className="h-4 w-4" />
                    <span className="sr-only">Fechar</span>
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>

          <p id="approval-a2-description" className="sr-only">Tela de detalhes de aprovação A2 da solicitação</p>

          <div className="space-y-6 px-6 pt-0 pb-24">
            {(() => {
              const reqCurrencyCode = normalizeCurrencyCode(request.currencyCode || selectedSupplierQuotation?.currencyCode);
              const reqExchangeRate = request.exchangeRate || selectedSupplierQuotation?.exchangeRate;
              if (reqCurrencyCode && reqCurrencyCode !== 'BRL') {
                return (
                  <Alert className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">
                        <DollarSign className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200">
                            Cotação em {reqCurrencyCode} · Taxa {Number(reqExchangeRate || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                          </Badge>
                        </div>
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                          Todos os valores convertidos para BRL para avaliação. Valores originais em {reqCurrencyCode} exibidos em parênteses.
                        </p>
                      </div>
                    </div>
                  </Alert>
                );
              }
              return null;
            })()}

            {/* Request Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações da Solicitação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Solicitante:</span>
                    <span className="font-medium">
                      {request.requester?.firstName && request.requester?.lastName
                        ? `${request.requester.firstName} ${request.requester.lastName}`
                        : request.requester?.username || 'N/A'
                      }
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Centro de Custo:</span>
                    <span className="font-medium">
                      {request.costCenter?.code} - {request.costCenter?.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Categoria:</span>
                    <Badge variant="outline">
                      {request.category in CATEGORY_LABELS ? CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS] : request.category}
                    </Badge>
                  </div>

                  {request.idealDeliveryDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Data Ideal:</span>
                      <span className="font-medium">
                        {formatLocalDate(request.idealDeliveryDate)}
                      </span>
                    </div>
                  )}

                  {request.urgency && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Urgência:</span>
                      <Badge variant={request.urgency === "alta_urgencia" || request.urgency === "alto" ? "destructive" : "secondary"}>
                        {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                      </Badge>
                    </div>
                  )}

                  {totalValue > 0 && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Valor Total:</span>
                      <span className="font-medium text-green-600">
                        {(() => {
                          const storedOrig = parseLooseNumber(request.totalValueOrig);
                          const sqOrig = parseLooseNumber(selectedSupplierQuotation?.totalValue);
                          const orig = storedOrig > 0 ? storedOrig : (sqOrig > 0 ? sqOrig : totalValue);
                          const code = request.currencyCode || selectedSupplierQuotation?.currencyCode;
                          const normCode = normalizeCurrencyCode(code);
                          const rate = sqExchangeRate(selectedSupplierQuotation);
                          const isForeign = normCode !== 'BRL';

                          let sideBrl: number;
                          if (isForeign && rate > 0 && storedOrig > 0) {
                            sideBrl = roundCurrency(storedOrig * rate);
                          } else if (isForeign && rate > 0 && sqOrig > 0) {
                            sideBrl = roundCurrency(sqOrig * rate);
                          } else if (totalValueBrl > 0) {
                            sideBrl = totalValueBrl;
                          } else if (isForeign && rate > 0) {
                            sideBrl = roundCurrency(orig * rate);
                          } else {
                            sideBrl = orig;
                          }
                          return formatDualCurrencyBrlFirst(orig, sideBrl, code);
                        })()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Justification */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Justificativa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32">
                    <p className="text-sm leading-relaxed">{request.justification}</p>
                  </ScrollArea>

                  {request.additionalInfo && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Informações Adicionais:</h4>
                      <ScrollArea className="h-20">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {request.additionalInfo}
                        </p>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Winning Supplier Information */}
            {selectedSupplierQuotation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Fornecedor Vencedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Nome do Fornecedor</Label>
                      <p className="text-sm font-semibold mt-1">{selectedSupplierQuotation.supplier?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">E-mail</Label>
                      <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Telefone</Label>
                      <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">CNPJ</Label>
                      <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.cnpj || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Total da Proposta
                        {(() => {
                          const sqCode = normalizeCurrencyCode(selectedSupplierQuotation?.currencyCode);
                          if (sqCode && sqCode !== 'BRL') {
                            return (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({CURRENCY_SYMBOLS[sqCode]} {sqCode})
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </Label>
                      {proposalDiscount > 0 ? (
                        <div className="flex flex-col mt-1">
                          <span className="text-sm text-muted-foreground line-through whitespace-pre-wrap">
                            {formatDualCurrency(
                              (parseLooseNumber(selectedSupplierQuotation?.subtotalValue) + parseLooseNumber(selectedSupplierQuotation?.freightValue)) || (subtotalNet + freightValue),
                              (subtotalNetBrl + freightValueBrl) > 0 ? (subtotalNetBrl + freightValueBrl) : (subtotalNet + freightValue),
                              selectedSupplierQuotation?.currencyCode
                            )}
                          </span>
                          <span className="text-lg font-bold text-green-600 whitespace-pre-wrap">
                            {formatDualCurrency(
                              selectedSupplierQuotation?.finalValue || selectedSupplierQuotation?.totalValue || totalValue,
                              totalValueBrl > 0 ? totalValueBrl : totalValue,
                              selectedSupplierQuotation?.currencyCode
                            )}
                          </span>
                        </div>
                      ) : (
                        <p className="text-lg font-bold text-green-600 mt-1 whitespace-pre-wrap">
                          {formatDualCurrency(
                            selectedSupplierQuotation?.finalValue || selectedSupplierQuotation?.totalValue || totalValue,
                            totalValueBrl > 0 ? totalValueBrl : totalValue,
                            selectedSupplierQuotation?.currencyCode
                          )}
                        </p>
                      )}
                      {selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue && (
                        <p className="text-sm text-orange-600 mt-1">
                          Desconto da proposta: {selectedSupplierQuotation.discountType === 'percentage'
                            ? `${selectedSupplierQuotation.discountValue}%`
                            : formatDualCurrency(
                                selectedSupplierQuotation.discountValue,
                                selectedSupplierQuotation.discountValueBrl,
                                selectedSupplierQuotation.currencyCode
                              )
                          }
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Frete
                      </Label>
                      <p className="text-lg font-semibold mt-1">
                        {selectedSupplierQuotation.includesFreight ? (
                          <span className="text-blue-600 whitespace-pre-wrap">
                            {formatDualCurrency(
                              selectedSupplierQuotation.freightValue,
                              selectedSupplierQuotation.freightValueBrl,
                              selectedSupplierQuotation.currencyCode
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-500">Não incluso</span>
                        )}
                      </p>
                      {selectedSupplierQuotation.includesFreight && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✓ Frete incluído na proposta
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Condições de Pagamento</Label>
                      <p className="text-sm mt-1">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
                    </div>
                  </div>

                  {selectedSupplierQuotation.choiceReason && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <Label className="text-sm font-medium text-green-800">Justificativa da Escolha:</Label>
                      <p className="text-sm text-green-700 mt-1">{selectedSupplierQuotation.choiceReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Itens conforme Solicitação Original
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {originalItems.length} {originalItems.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                </p>
              </CardHeader>
              <CardContent>
                {originalItems.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-center">Unidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {originalItems.map((item: any, index: number) => (
                          <TableRow key={item.id || index}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell className="text-center">{item.requestedQuantity}</TableCell>
                            <TableCell className="text-center">{item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum item encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Itens conforme Cotação Vencedora
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {winningItems.length} {winningItems.length === 1 ? 'item cotado' : 'itens cotados'}
                </p>
              </CardHeader>
              <CardContent>
                {winningItems.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-center">Unidade</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Desconto Item</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {winningItems.map((item: any, index: number) => (
                          <TableRow key={item.id || index}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell className="text-center">{formatDecimal4(item.quantity)}</TableCell>
                            <TableCell className="text-center">{item.unit}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {fmtOrig4(item.unitPrice, sqExchangeRate(selectedSupplierQuotation))}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {item.itemDiscount > 0
                                ? fmtOrig4(item.itemDiscount, sqExchangeRate(selectedSupplierQuotation))
                                : <span className="text-gray-400">-</span>
                              }
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap font-medium">
                              {fmtOrig4(item.totalPrice, sqExchangeRate(selectedSupplierQuotation))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {selectedSupplierQuotation && (
                      <div className="border-t border-blue-300 dark:border-slate-700 bg-blue-50 dark:bg-slate-800/50 p-4">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Resumo Financeiro</h4>
                        <div className="space-y-2">
                          {(() => {
                            const subtotal = winningItems.reduce((sum, item) => sum + (item.originalTotalPrice || 0), 0);
                            const discountInput = parseLooseNumber(selectedSupplierQuotation.discountValue);

                            // Recalcular valor final dinamicamente
                            const subtotalNet = winningItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                            let proposalDiscount = 0;

                            if (selectedSupplierQuotation.discountType === 'percentage') {
                              proposalDiscount = (subtotalNet * discountInput) / 100;
                            } else if (selectedSupplierQuotation.discountType === 'fixed') {
                              proposalDiscount = discountInput;
                            }

                            const freightValue = selectedSupplierQuotation.includesFreight
                              ? parseLooseNumber(selectedSupplierQuotation.freightValue)
                              : 0;

                            const finalValue = Math.max(0, subtotalNet - proposalDiscount) + freightValue;

                            const sqCurrency = selectedSupplierQuotation?.currencyCode;
                            const sqSubtotalOrig = parseLooseNumber(selectedSupplierQuotation?.subtotalValue);
                            const sqSubtotalBrl = parseLooseNumber(selectedSupplierQuotation?.subtotalValueBrl);
                            const sqFinalOrig = parseLooseNumber(selectedSupplierQuotation?.finalValue || selectedSupplierQuotation?.totalValue);
                            const sqFinalBrl = parseLooseNumber(selectedSupplierQuotation?.finalValueBrl || selectedSupplierQuotation?.totalValueBrl);

                            return (
                              <>
                                {isForeign && (
                                  <div className="flex justify-between items-center pb-1 mb-1 border-b border-blue-200/60 dark:border-slate-600/60">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Moeda · Taxa:</span>
                                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                                      {currencyCodeNorm} · {formatRate(exchangeRateNum)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Subtotal (sem desconto):</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap text-right">
                                    {formatDualCurrency(
                                      sqSubtotalOrig > 0 ? sqSubtotalOrig : subtotal,
                                      sqSubtotalBrl > 0 ? sqSubtotalBrl : toBRL(subtotal, sqExchangeRate(selectedSupplierQuotation)),
                                      sqCurrency
                                    )}
                                  </span>
                                </div>
                                {discountInput > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-orange-600 dark:text-orange-300">Desconto da proposta:</span>
                                    <span className="font-medium text-orange-600 dark:text-orange-300 whitespace-pre-wrap text-right">
                                      {selectedSupplierQuotation.discountType === 'percentage'
                                        ? `- ${discountInput}%`
                                        : `- ${formatDualCurrency(
                                            parseLooseNumber(selectedSupplierQuotation.discountValue),
                                            parseLooseNumber(selectedSupplierQuotation.discountValueBrl) > 0
                                              ? parseLooseNumber(selectedSupplierQuotation.discountValueBrl)
                                              : toBRL(parseLooseNumber(selectedSupplierQuotation.discountValue), sqExchangeRate(selectedSupplierQuotation)),
                                            sqCurrency
                                          )}`}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    <Truck className="h-4 w-4" />
                                    Frete:
                                  </span>
                                  <span className="font-medium whitespace-pre-wrap text-right">
                                    {selectedSupplierQuotation.includesFreight ? (
                                      <span className="text-blue-600 dark:text-blue-300">
                                        {formatDualCurrency(
                                          parseLooseNumber(selectedSupplierQuotation.freightValue),
                                          parseLooseNumber(selectedSupplierQuotation.freightValueBrl) > 0
                                            ? parseLooseNumber(selectedSupplierQuotation.freightValueBrl)
                                            : toBRL(parseLooseNumber(selectedSupplierQuotation.freightValue), sqExchangeRate(selectedSupplierQuotation)),
                                          sqCurrency
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 dark:text-gray-400">Não incluso</span>
                                    )}
                                  </span>
                                </div>
                                <div className="border-t border-blue-300 dark:border-slate-700 pt-2 mt-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-base font-semibold text-blue-800 dark:text-blue-200">Valor Final:</span>
                                    <span className="text-lg font-bold text-green-700 dark:text-green-300 whitespace-pre-wrap text-right">
                                      {formatDualCurrency(
                                        sqFinalOrig > 0 ? sqFinalOrig : finalValue,
                                        sqFinalBrl > 0 ? sqFinalBrl : toBRL(finalValue, sqExchangeRate(selectedSupplierQuotation)),
                                        sqCurrency
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum item de cotação vencedor encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Attachments */}
            {supplierAttachments && supplierAttachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Anexos dos Fornecedores
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Propostas e documentos enviados pelos fornecedores
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {supplierAttachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                            <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.supplierName} • {attachment.fileType}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {attachment.attachmentType === 'supplier_proposal' ? 'Proposta' : 'Documento'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => {
                              if (attachment.id) {
                                const fileUrl = `/api/attachments/${attachment.id}/download`;
                                window.open(fileUrl, '_blank');
                              } else {
                                toast({
                                  title: "Erro",
                                  description: "Identificador do anexo não encontrado",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Visualizar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approval History */}
            {approvalHistory && approvalHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico de Aprovações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {approvalHistory.map((item: any, index: number) => (
                      <div key={index} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                        <div className="flex-1 flex items-start gap-2 min-w-0">
                          <Badge variant={item.approved ? 'default' : 'destructive'} className="text-xs shrink-0 mt-0.5">
                            {item.approved ? 'Aprovado' : 'Reprovado'}
                          </Badge>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium">
                              {item.approver?.firstName && item.approver?.lastName
                                ? `${item.approver.firstName} ${item.approver.lastName}`
                                : item.approver?.username || 'N/A'
                              }
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getPhaseDescription(item.approverType)}
                              {item.approvalStep && item.approvalStep !== 'single' && (
                                <span className="ml-1">
                                  · {item.approvalStep === 'first' ? '1ª aprovação' : item.approvalStep === 'final' ? 'Aprovação final' : item.approvalStep}
                                </span>
                              )}
                            </span>
                            {item.approvalValue && parseLooseNumber(item.approvalValue) > 0 && (
                              <span className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                                Valor: {(() => {
                                  const histCurrency = request.currencyCode || selectedSupplierQuotation?.currencyCode;
                                  const histOrig = request.totalValueOrig || selectedSupplierQuotation?.totalValue;
                                  return formatDualCurrency(
                                    (histCurrency && histCurrency !== 'BRL') ? histOrig : null,
                                    item.approvalValue,
                                    histCurrency
                                  );
                                })()}
                              </span>
                            )}
                            {item.rejectionReason && (
                              <span className="text-xs text-muted-foreground mt-0.5">
                                - {item.rejectionReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 text-right">
                          {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Supplier Comparison */}
            {canApprove && quotation?.id && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Comparação de Fornecedores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    Visualize a comparação completa dos fornecedores que foi feita na fase de cotação para auxiliar na tomada de decisão.
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowComparison(true)}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Ver Comparação de Fornecedores
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Approval Actions */}
            {canApprove && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ação de Aprovação A2</CardTitle>
                  {/* Mostrar informações sobre o tipo de aprovação */}
                  {approvalType && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-slate-800/50 border border-blue-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          {approvalType === 'dual' ? 'Dupla Aprovação Necessária' : 'Aprovação Simples'}
                        </span>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {approvalType === 'dual'
                          ? `Valor ${formatDualCurrencyBrlFirst(totalValue, totalValueBrl, codeForDisplay)} requer aprovação sequencial de dois aprovadores A2.`
                          : `Valor ${formatDualCurrencyBrlFirst(totalValue, totalValueBrl, codeForDisplay)} requer apenas uma aprovação A2.`
                        }
                      </p>
                      {approvalInfo && approvalInfo.nextApprover && (
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Próximo aprovador: {approvalInfo.nextApprover.firstName} {approvalInfo.nextApprover.lastName}
                          {approvalInfo.nextApprover.isCEO && ' (CEO)'}
                        </p>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          variant={selectedAction === 'approve' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={handleApprove}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant={selectedAction === 'reject' ? 'destructive' : 'outline'}
                          className="flex-1"
                          onClick={handleReject}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reprovar
                        </Button>
                      </div>

                      {selectedAction === 'reject' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="rejectionAction"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Destino da Solicitação Reprovada</FormLabel>
                                <FormControl>
                                  <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex flex-col space-y-2"
                                  >
                                    {(user?.isAdmin || user?.isBuyer) && (
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="arquivar" id="arquivar" />
                                        <Label htmlFor="arquivar">Arquivar definitivamente</Label>
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="recotacao" id="recotacao" />
                                      <Label htmlFor="recotacao">Retornar para nova cotação</Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="rejectionReason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Justificativa da Reprovação</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Explique o motivo da reprovação..."
                                    {...field}
                                    rows={4}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {selectedAction && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedAction(null)}
                            className="w-full sm:w-auto order-last sm:order-first"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            disabled={approvalMutation.isPending}
                            className={`${selectedAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : ''} w-full sm:w-auto`}
                          >
                            {approvalMutation.isPending ? 'Processando...' : 'Confirmar'}
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={approvalMutation.isPending}
                className="w-full sm:w-auto order-last sm:order-first"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  handleReject();
                  form.handleSubmit(onSubmit)();
                }}
                variant="destructive"
                className="flex items-center gap-2 w-full sm:w-auto"
                disabled={!canApprove || approvalMutation.isPending}
              >
                <XCircle className="h-4 w-4" />
                Reprovar Solicitação
              </Button>
              <Button
                type="button"
                onClick={() => {
                  handleApprove();
                  form.handleSubmit(onSubmit)();
                }}
                variant="default"
                className="flex items-center gap-2 bg-green-500 w-full sm:w-auto"
                disabled={!canApprove || approvalMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                Aprovar Solicitação
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {quotation?.id && (
        <SupplierComparisonReadonly
          quotationId={quotation.id}
          isOpen={showComparison}
          onOpenChange={setShowComparison}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}
