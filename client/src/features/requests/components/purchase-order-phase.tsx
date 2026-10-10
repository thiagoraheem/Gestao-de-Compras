import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/shared/ui/button";
import PDFViewer from "@/shared/components/pdf-viewer";
import { ErrorBoundary } from "@/shared/components/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/shared/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Download, 
  FileText, 
  User, 
  Calendar, 
  Building, 
  Building2,
  Clock, 
  CheckCircle, 
  Package,
  Truck,
  X,
  Eye,
  RotateCcw,
  AlertTriangle,
  Phone,
  Mail,
  Save
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import debug from "@/lib/debug";
import { formatCurrencyIn, normalizeCurrencyCode, formatDualCurrency, formatDualCurrencyBrlFirst, roundCurrency } from "@/lib/currency";

const purchaseOrderSchema = z.object({
  purchaseObservations: z.string().optional(),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

interface PurchaseOrderPhaseProps {
  request: any;
  onClose: () => void;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  className?: string;
}
 

export default function PurchaseOrderPhase({ request, onClose, onPreviewOpen, onPreviewClose, className }: PurchaseOrderPhaseProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canReturnToQuotation = user?.isAdmin || user?.isBuyer;

  // Return-to-quotation dialog state
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnReasonError, setReturnReasonError] = useState("");
  // Bloqueio por recebimento com NF
  const [blockedByReceipts, setBlockedByReceipts] = useState<{ receiptsWithNF: any[] } | null>(null);
  // Return-to-approval-a2 dialog state
  const [showReturnToA2Dialog, setShowReturnToA2Dialog] = useState(false);
  const [returnToA2Reason, setReturnToA2Reason] = useState("");
  const [returnToA2ReasonError, setReturnToA2ReasonError] = useState("");
  const [blockedByReceiptsA2, setBlockedByReceiptsA2] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState<string>("");

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      purchaseObservations: request?.purchaseObservations || "",
    },
  });

  // Reset form when request data changes (including after successful updates)
  useEffect(() => {
    form.reset({
      purchaseObservations: request?.purchaseObservations || "",
    });
  }, [request?.purchaseObservations, form]);

  // Buscar dados relacionados
  // Primeiro buscar o pedido de compra relacionado à solicitação
  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  // Lista de todos os usuários (para filtrar compradores)
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Lista de empresas (para obter telefone do comprador via company)
  const { data: allCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
  });

  // Apenas usuários marcados como comprador
  const buyers = allUsers.filter((u: any) => u.isBuyer === true && u.isActive !== false);

  // Buscar itens do pedido de compra (não da solicitação)
  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
  });

  const { data: approvalHistory = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/approval-history`],
    enabled: !!request?.id,
  });

  const { data: attachments = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/attachments`],
    enabled: !!request?.id,
  });

  const { data: quotation } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request?.id}`],
    enabled: !!request?.id,
  });

  // Seta o selectedBuyerUserId inicial quando purchaseOrder carrega
  // REGRA: NUNCA seleciona automaticamente quem não tem isBuyer=true
  // 1) Match por email/nome salvo no PO (se o user for isBuyer)
  // 2) CRIADOR DA COTAÇÃO (quotation.createdBy) = QUEM REALIZOU a cotação
  //    - SE esse usuário tiver isBuyer=true
  // Fallback safety: NÃO usa purchaseOrder.createdBy (pode ser Aprovador A2)
  useEffect(() => {
    if (!purchaseOrder || !allUsers.length) return;
    const poEmail = purchaseOrder.buyerEmail;
    const poName = purchaseOrder.buyerName;

    // Only consider users with isBuyer=true for auto-selection
    const isBuyerCheck = (u: any) => u.isBuyer === true;

    // 1) Match por email primeiro (exato) e tem que ser comprador
    let matched: any = null;
    if (poEmail) {
      const m = allUsers.find((u: any) => u.email === poEmail);
      if (m && isBuyerCheck(m)) matched = m;
    }
    // 2) Fallback: match por nome completo e tem que ser comprador
    if (!matched && poName) {
      const m = allUsers.find((u: any) => {
        const uName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
        return uName === poName || u.username === poName;
      });
      if (m && isBuyerCheck(m)) matched = m;
    }
    // 3) Fallback: CRIADOR DA COTAÇÃO (quotation.createdBy)
    //    PRIORIDADE ALTA: quem fez a cotação de fato é o comprador real
    //    Só aceita se for isBuyer
    if (!matched && quotation?.createdBy) {
      const m = allUsers.find((u: any) => u.id === quotation.createdBy);
      if (m && isBuyerCheck(m)) matched = m;
    }
    // NOTA: NÃO usamos purchaseOrder.createdBy como fallback de segurança
    // porque pode ser Aprovador A2 (Bruno Derzi) que não é comprador.
    setSelectedBuyerUserId(matched ? String(matched.id) : "");
  }, [purchaseOrder, allUsers, quotation]);

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Buscar items do fornecedor selecionado para obter preços
  const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen === true) || supplierQuotations.find((sq: any) => sq.totalValue);
  
  const { data: supplierQuotationItems = [], isLoading: isLoadingSupplierItems } = useQuery<any[]>({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });

  // Buscar dados do fornecedor selecionado
  const { data: selectedSupplier } = useQuery<any>({
    queryKey: [`/api/suppliers/${selectedSupplierQuotation?.supplierId}`],
    enabled: !!selectedSupplierQuotation?.supplierId,
  });



  // Mutation para salvar observações
  const updateRequestMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      return apiRequest(`/api/purchase-requests/${request.id}`, {
        method: "PATCH",
        body: data
      });
    },
    onSuccess: (updatedRequest) => {
      toast({
        title: "Sucesso",
        description: "Observações do pedido atualizadas com sucesso!",
      });
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ predicate: (query) => !!(query.queryKey[0] === "/api/purchase-requests") });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar observações do pedido",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar dados do comprador (via buyerUserId)
  const updateBuyerMutation = useMutation({
    mutationFn: async (params: { buyerUserId: number }) => {
      if (!purchaseOrder?.id) throw new Error("Pedido de compra não encontrado");
      return apiRequest(`/api/purchase-orders/${purchaseOrder.id}`, {
        method: "PATCH",
        body: params
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Comprador vinculado e dados atualizados com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/by-request/${request?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao vincular comprador ao pedido",
        variant: "destructive",
      });
    },
  });

  const handleChangeBuyer = async (value: string) => {
    setSelectedBuyerUserId(value);
  };

  const handleSaveBuyer = () => {
    if (!selectedBuyerUserId) {
      toast({ title: "Aviso", description: "Selecione um comprador antes de salvar", variant: "destructive" });
      return;
    }
    updateBuyerMutation.mutate({ buyerUserId: Number(selectedBuyerUserId) });
  };

  // Dados do comprador selecionado atualmente para exibição preview
  const selectedBuyerUser = selectedBuyerUserId
    ? allUsers.find((u: any) => String(u.id) === selectedBuyerUserId)
    : undefined;
  const selectedBuyerCompany = selectedBuyerUser?.companyId
    ? allCompanies.find((c: any) => c.id === selectedBuyerUser.companyId)
    : undefined;

  // Dados do comprador efetivamentes salvos no PO (podem ser os mesmos, mas refletem o estado do banco)
  const displayBuyerName = purchaseOrder?.buyerName || (selectedBuyerUser && ([selectedBuyerUser.firstName, selectedBuyerUser.lastName].filter(Boolean).join(" ").trim() || selectedBuyerUser.username)) || "-";
  const displayBuyerEmail = purchaseOrder?.buyerEmail || selectedBuyerUser?.email || "-";
  const displayBuyerPhone =
    purchaseOrder?.buyerPhone ||
    selectedBuyerUser?.phone ||
    selectedBuyerCompany?.phone ||
    purchaseOrder?.contactPhone ||
    "-";

  // Mutation para avançar para recebimento
  const advanceToReceiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/purchase-requests/${request.id}/advance-to-receipt`, {
        method: "POST"
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação movida para recebimento com sucesso!",
      });
      onClose(); // Close the modal after successful advance
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao avançar para recebimento",
        variant: "destructive",
      });
    },
  });

  const handleAdvanceToReceipt = () => {
    if (window.confirm("Confirma o avanço desta solicitação para a fase de Recebimento?")) {
      advanceToReceiptMutation.mutate();
    }
  };

  // Mutation para retornar para cotação
  const returnToQuotationMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await fetch(`/api/purchase-requests/${request.id}/return-to-quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (response.status === 409) {
        const data = await response.json();
        // Bloqueio por NF registrada — guardar dados e não fechar o dialog
        setBlockedByReceipts({ receiptsWithNF: data.receiptsWithNF || [] });
        throw new Error(data.error || "Existem recebimentos com NF registrada");
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Erro ao retornar para cotação");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      if (data && data.partial) {
        toast({
          title: "Saldo Desmembrado",
          description: `Pedido concluído parcialmente. Criada a nova solicitação ${data.newRequest.requestNumber} diretamente em Cotação para o saldo pendente.`,
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Solicitação retornada para Cotação. O Pedido de Compra foi excluído.",
        });
      }
      setShowReturnDialog(false);
      setReturnReason("");
      setBlockedByReceipts(null);
      onClose();
    },
    onError: (error: any) => {
      // Se for bloqueio por NF, não exibe toast genérico — o dialog mostrará o estado
      if (blockedByReceipts) return;
      toast({
        title: "Erro",
        description: error?.message || "Falha ao retornar para cotação",
        variant: "destructive",
      });
    },
  });

  const handleReturnToQuotation = () => {
    if (!returnReason.trim()) {
      setReturnReasonError("A justificativa é obrigatória.");
      return;
    }
    setReturnReasonError("");
    returnToQuotationMutation.mutate(returnReason.trim());
  };

  // Mutation para retornar para Aprovação A2 (recriar PO com valores corretos)
  const returnToApprovalA2Mutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await fetch(`/api/purchase-requests/${request.id}/return-to-approval-a2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (response.status === 409) {
        const data = await response.json();
        setBlockedByReceiptsA2(true);
        throw new Error(data.error || "Não é possível retornar para Aprovação A2");
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Erro ao retornar para Aprovação A2");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação retornada para Aprovação A2. O Pedido de Compra antigo foi excluído. Re-aprove a A2 para gerar um novo PO com valores corrigidos.",
      });
      setShowReturnToA2Dialog(false);
      setReturnToA2Reason("");
      setBlockedByReceiptsA2(false);
      onClose();
    },
    onError: (error: any) => {
      if (blockedByReceiptsA2) return;
      toast({
        title: "Erro",
        description: error?.message || "Falha ao retornar para Aprovação A2",
        variant: "destructive",
      });
    },
  });

  const handleReturnToApprovalA2 = () => {
    if (!returnToA2Reason.trim()) {
      setReturnToA2ReasonError("A justificativa é obrigatória.");
      return;
    }
    setReturnToA2ReasonError("");
    returnToApprovalA2Mutation.mutate(returnToA2Reason.trim());
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return window.btoa(binary);
  };

  const handlePreviewPDF = async () => {
    try { onPreviewOpen && onPreviewOpen(); } catch {}
    setIsLoadingPreview(true);
    setShowPreviewModal(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const contentType = response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      setPdfBuffer(buffer);
      const base64 = arrayBufferToBase64(buffer);
      const url = `data:application/pdf;base64,${base64}`;
      setPdfPreviewUrl(url);
      setPreviewMimeType(contentType);
      setPreviewLoaded(false);
      // setShowPreviewModal(true); // Já foi aberto no início

      if (contentType.includes('application/pdf')) {
        toast({
          title: "Sucesso",
          description: "Pré-visualização do PDF carregada com sucesso!",
        });
      } else if (contentType.includes('text/html')) {
        toast({
          title: "Aviso",
          description: "PDF não pôde ser gerado. Exibindo documento em HTML.",
        });
      } else {
        toast({
          title: "Aviso",
          description: "Formato de arquivo inesperado na pré-visualização.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar pré-visualização do PDF",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  

  // Função para download do PDF
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const contentType = response.headers.get('Content-Type') || '';
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Pedido_Compra_${request.requestNumber}.${contentType.includes('application/pdf') ? 'pdf' : contentType.includes('text/html') ? 'html' : 'bin'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: contentType.includes('application/pdf') ? "PDF do pedido de compra baixado com sucesso!" : "Documento alternativo baixado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao baixar PDF do pedido de compra",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Função para baixar PDF da pré-visualização
  const handleDownloadFromPreview = () => {
    if (pdfPreviewUrl) {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = pdfPreviewUrl;
      a.download = `Pedido_Compra_${request.requestNumber}.${previewMimeType && previewMimeType.includes('text/html') ? 'html' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Sucesso",
        description: previewMimeType && previewMimeType.includes('application/pdf') ? "PDF do pedido de compra baixado com sucesso!" : "Documento alternativo baixado com sucesso!",
      });
    }
  };

  // Limpar URL do blob quando o modal for fechado
  const handleClosePreview = () => {
    try { onPreviewClose && onPreviewClose(); } catch {}
    setShowPreviewModal(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setPreviewMimeType(null);
  };

  // Controla abertura/fechamento do modal de pré-visualização sem interferir no diálogo pai
  const handlePreviewOpenChange = (open: boolean) => {
    if (open) {
      setShowPreviewModal(true);
      return;
    }
    handleClosePreview();
  };

  const onSubmit = (data: PurchaseOrderFormData) => {
    updateRequestMutation.mutate(data);
  };

  // Para a fase de pedido de compra, não precisamos mais dos itens da cotação
  // Os dados já vêm corretos da API de itens do pedido de compra

  const currencyCodeNorm = normalizeCurrencyCode(
    purchaseOrder?.currencyCode || request?.currencyCode || selectedSupplierQuotation?.currencyCode
  );
  const exchangeRateNum = Number(
    purchaseOrder?.exchangeRate || request?.exchangeRate || selectedSupplierQuotation?.exchangeRate || 1
  ) || 0;
  const isForeign = currencyCodeNorm !== 'BRL' && exchangeRateNum > 0;

  // Para a fase de pedido de compra, usar diretamente os dados dos itens que já vêm com preços
  // REGRA CRÍTICA: Itens de PurchaseOrder (PO) são armazenados EM BRL no banco.
  //   - unitPriceBrl/totalPriceBrl = próprio valor do item (já é BRL)
  //   - unitPriceOrig/totalPriceOrig = valor em moeda original (BRL / taxa)
  const itemsWithPrices = Array.isArray(items) ? items.map(item => {
    const unitPriceBrl = Number(item.unitPrice) || 0;
    const quantity = Number(item.quantity) || 0;
    const totalPriceBrl = Number(item.totalPrice) || 0;
    const unitPriceOrig = isForeign && exchangeRateNum > 0
      ? unitPriceBrl / exchangeRateNum
      : unitPriceBrl;
    const totalPriceOrig = isForeign && exchangeRateNum > 0
      ? totalPriceBrl / exchangeRateNum
      : totalPriceBrl;

    return {
      ...item,
      unitPrice: unitPriceOrig,
      originalUnitPrice: unitPriceOrig,
      unitPriceBrl: unitPriceBrl,
      totalPriceBrl: totalPriceBrl,
      itemDiscount: 0,
      totalPrice: totalPriceOrig,
      originalTotalPrice: totalPriceOrig,
      brand: item.brand || '',
      deliveryTime: item.deliveryTime || '',
      isAvailable: true
    };
  }) : [];

  const toOrig = (brl: number): number => {
    if (!isForeign) return brl;
    return exchangeRateNum > 0 ? brl / exchangeRateNum : brl;
  };
  const toBRL = (orig: number): number => {
    if (!isForeign) return orig;
    return exchangeRateNum > 0 ? roundCurrency(orig * exchangeRateNum) : orig;
  };

  // Calcular valores totais (PO itens em BRL; Orig derivado via / taxa)
  // REGRA: Itens de PO são FONTE DA VERDADE e já vêm armazenados em BRL.
  // Soma os itens para Subtotal, Desconto (itens), depois aplica desconto de proposta e frete do SQ.
  const subtotalBrl = itemsWithPrices.reduce((sum: number, item: any) =>
    sum + (Number(item.totalPriceBrl) || 0), 0
  );
  const subtotalOrig = isForeign && exchangeRateNum > 0
    ? subtotalBrl / exchangeRateNum
    : subtotalBrl;
  const subtotal = subtotalBrl;
  const itemDiscountTotalOrig = 0;
  const itemDiscountTotal = 0;

  // Calcular desconto da proposta (o desconto é NA MOEDA original do fornecedor, se houver)
  let proposalDiscount = 0;
  let proposalDiscountOrig = 0;
  if (selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) {
    const discountValue = Number(selectedSupplierQuotation.discountValue) || 0;
    const discountValueBrlRaw = Number((selectedSupplierQuotation as any)?.discountValueBrl);

    if (selectedSupplierQuotation.discountType === 'percentage') {
      proposalDiscountOrig = (subtotalOrig * discountValue) / 100;
      proposalDiscount = (subtotalBrl * discountValue) / 100;
    } else if (selectedSupplierQuotation.discountType === 'fixed') {
      proposalDiscountOrig = discountValue;
      proposalDiscount = !isNaN(discountValueBrlRaw) && discountValueBrlRaw > 0
        ? discountValueBrlRaw
        : (isForeign ? roundCurrency(discountValue * exchangeRateNum) : discountValue);
    }
  }

  const totalDiscountOrig = itemDiscountTotalOrig + proposalDiscountOrig;
  const totalDiscount = itemDiscountTotal + proposalDiscount;

  // Frete (da cotação vencedora - pode estar em moeda original)
  const freightValueRaw = selectedSupplierQuotation?.includesFreight && selectedSupplierQuotation?.freightValue
    ? Number(selectedSupplierQuotation.freightValue) || 0
    : 0;
  const freightValueBrlRaw = Number((selectedSupplierQuotation as any)?.freightValueBrl);
  const freightValueOrig = freightValueRaw;
  const freightValue = !isNaN(freightValueBrlRaw) && freightValueBrlRaw > 0
    ? freightValueBrlRaw
    : (isForeign ? roundCurrency(freightValueRaw * exchangeRateNum) : freightValueRaw);

  // Valores base calculados a partir dos itens (fonte da verdade para novos POs)
  const calcSubtotalOrig = subtotalOrig;
  const calcSubtotalBrl = subtotalBrl;
  let calcFinalTotalOrig = Math.max(0, calcSubtotalOrig - totalDiscountOrig + freightValueOrig);
  let calcFinalTotalBrl = Math.max(0, calcSubtotalBrl - totalDiscount + freightValue);

  // Fallback leve para PEDIDOS ANTIGOS (criados antes da correção, ex: SOL-975 com itens BRL=100):
  // Se a cotação vencedora tiver total/final registrado e houver divergência grande (>R$0,50),
  // ajustar Subtotal e Total Geral baseados na cotação vencedora (que é a verdade negociada).
  const sqTotalValueOrig = selectedSupplierQuotation?.totalValue ? Number(selectedSupplierQuotation.totalValue) : 0;
  const sqSubtotalOrig = selectedSupplierQuotation?.subtotalValue ? Number(selectedSupplierQuotation.subtotalValue) : 0;
  const sqFinalValueOrig = selectedSupplierQuotation?.finalValue ? Number(selectedSupplierQuotation.finalValue) : 0;

  const sqSubtotalBrl = sqSubtotalOrig > 0 ? toBRL(sqSubtotalOrig) : 0;
  const sqFinalBrl = sqFinalValueOrig > 0 ? toBRL(sqFinalValueOrig) : (sqTotalValueOrig > 0 ? toBRL(sqTotalValueOrig) : 0);

  let displaySubtotalOrig = calcSubtotalOrig;
  let displaySubtotalBrl = calcSubtotalBrl;
  if (sqSubtotalOrig > 0 && Math.abs(sqSubtotalBrl - calcSubtotalBrl) > 0.5) {
    displaySubtotalOrig = sqSubtotalOrig;
    displaySubtotalBrl = sqSubtotalBrl;
  }

  let finalTotalOrig = calcFinalTotalOrig;
  let finalTotal = calcFinalTotalBrl;
  if (sqFinalValueOrig > 0 && Math.abs(sqFinalBrl - calcFinalTotalBrl) > 0.5) {
    finalTotalOrig = sqFinalValueOrig;
    finalTotal = sqFinalBrl;
  } else if (sqTotalValueOrig > 0 && Math.abs(toBRL(sqTotalValueOrig) - calcFinalTotalBrl) > 0.5) {
    finalTotalOrig = sqTotalValueOrig;
    finalTotal = toBRL(sqTotalValueOrig);
  }

  const fmt4OrigFirst = (orig: number, brl: number): string => {
    return formatDualCurrency(orig, brl, currencyCodeNorm, 4);
  };
  const fmt4 = (orig: number, brl: number): string => {
    return formatDualCurrencyBrlFirst(orig, brl, currencyCodeNorm, 4);
  };
  const fmt2OrigFirst = (orig: number, brl: number): string => {
    return formatDualCurrency(orig, brl, currencyCodeNorm, 2);
  };
  const fmt2 = (orig: number, brl: number): string => {
    return formatDualCurrencyBrlFirst(orig, brl, currencyCodeNorm, 2);
  };

  // fmtBRL4: valor de entrada EM BRL → mostra dual (BRL primeiro)
  const fmtBRL4 = (brl: number): string => fmt4(toOrig(brl), brl);
  const fmtBRL2 = (brl: number): string => fmt2(toOrig(brl), brl);

  // fmtOrig4: valor de entrada EM MOEDA ORIGINAL → dual (BRL primeiro)
  const fmtOrig4 = (orig: number): string => fmt4(orig, toBRL(orig));
  const fmtOrig2 = (orig: number): string => fmt2(orig, toBRL(orig));

  const formatRate = (rate: number): string => {
    if (!rate) return '—';
    return rate.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };



  // Organizar histórico de aprovações
  const aprovacaoA1 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A1') : null;
  const aprovacaoA2 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A2') : null;

  if (showPreviewModal) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 pb-3 mb-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Pré-visualização - Pedido de Compra {request.requestNumber}{purchaseOrder?.orderNumber ? ` - ${purchaseOrder.orderNumber}` : ''}</h3>
              <div className="flex gap-2">
                <Button onClick={handleDownloadFromPreview} size="sm" className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
                <Button onClick={handleClosePreview} size="sm" variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-[60vh]">
              {pdfBuffer ? (
                <ErrorBoundary fallback={
                  <div className="flex items-center justify-center h-full p-6 bg-red-50 text-red-600">
                    <p>Erro ao exibir PDF. O arquivo pode estar corrompido ou ser incompatível.</p>
                  </div>
                }>
                  <PDFViewer data={pdfBuffer} />
                </ErrorBoundary>
              ) : pdfPreviewUrl ? (
                <object data={pdfPreviewUrl} type="application/pdf" className="w-full h-[70vh] border border-border rounded-lg bg-slate-50 dark:bg-slate-900">
                  <iframe onLoad={() => setPreviewLoaded(true)}
                    src={pdfPreviewUrl}
                    className="w-full h-[70vh] border border-border rounded-lg bg-slate-50 dark:bg-slate-900"
                    title="Pré-visualização do PDF"
                  />
                </object>
              ) : (
                <div className="flex items-center justify-center h-[70vh] bg-slate-100 dark:bg-slate-800 rounded-lg border border-border">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-300">Carregando pré-visualização...</p>
                  </div>
                </div>
              )}
          </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {request.hasPendency && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>Motivo da Pendência:</strong> {request.pendencyReason}
          </p>
        </div>
      )}

      {/* Moeda e Taxa - Info Box READ-ONLY conforme FR-17 */}
      {purchaseOrder && (
        <Card className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  Moeda da Cotação
                </div>
                <p className="text-base font-bold text-indigo-800 dark:text-indigo-300">
                  {currencyCodeNorm}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({currencyCodeNorm === 'BRL' ? 'Real Brasileiro' :
                      currencyCodeNorm === 'USD' ? 'Dólar Americano' :
                      currencyCodeNorm === 'EUR' ? 'Euro' :
                      currencyCodeNorm === 'GBP' ? 'Libra Esterlina' : currencyCodeNorm})
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  Taxa de Câmbio
                </div>
                <p className="text-base font-bold text-indigo-800 dark:text-indigo-300">
                  {isForeign ? `1 ${currencyCodeNorm} = R$ ${formatRate(exchangeRateNum)}` : 'Taxa 1,0000 (moeda nacional)'}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  Data da Taxa (Referência)
                </div>
                <p className="text-base font-bold text-indigo-800 dark:text-indigo-300">
                  {purchaseOrder?.createdAt
                    ? new Date(purchaseOrder.createdAt).toLocaleDateString('pt-BR')
                    : new Date(request.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground italic">
              ⓘ Conforme especificação FR-17: Moeda e taxa de câmbio são definidas na cotação vencedora e <strong>não são editáveis</strong> nesta fase do Pedido de Compra.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo da Solicitação */}
      <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-5 h-5" />
            Informações da Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Departamento:</span>
                <span>{request.department?.name || "Não informado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Data da Solicitação:</span>
                <span>{new Date(request.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Empresa Solicitante:</span>
                <span>{request.company?.name || "Não informado"}{request.company?.cnpj ? ` — CNPJ ${request.company.cnpj}` : ""}</span>
              </div>
              {(() => {
                const billingCompany = request.billingCompany;
                const differs = billingCompany?.id && request.company?.id && billingCompany.id !== request.company.id;
                if (!billingCompany) return null;
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Empresa para Faturamento:</span>
                    <span className="font-medium">{billingCompany.name}{billingCompany.cnpj ? ` — CNPJ ${billingCompany.cnpj}` : ""}</span>
                    {differs && (
                      <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border-0">
                        Difere da Solicitação
                      </Badge>
                    )}
                  </div>
                );
              })()}
              {isForeign && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    $
                  </span>
                  <span className="font-medium">Moeda · Taxa:</span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {currencyCodeNorm} · {formatRate(exchangeRateNum)}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Urgência:</span>
                <Badge variant={request.urgency === 'alto' ? 'destructive' : 'secondary'}>
                  {request.urgency === 'alto' ? 'Alto' : request.urgency === 'medio' ? 'Médio' : request.urgency === 'baixo' ? 'Baixo' : request.urgency}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Categoria:</span>
                <span>{request.category}</span>
              </div>
              {selectedSupplier && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Fornecedor Selecionado:</span>
                  <span className="text-green-600 font-medium">{selectedSupplier.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Entrega Ideal:</span>
                <span>
                  {request.idealDeliveryDate 
                    ? new Date(request.idealDeliveryDate).toLocaleDateString('pt-BR')
                    : "Não especificada"
                  }
                </span>
              </div>
            </div>
          </div>
          <div>
            <span className="font-medium">Justificativa:</span>
            <p className="text-sm text-muted-foreground mt-1">{request.justification}</p>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Comprador */}
      <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <User className="w-5 h-5" />
            Dados do Comprador
          </CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-200 dark:border-slate-700 space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Selecione o Comprador
            </Label>
            <Select
              value={selectedBuyerUserId}
              onValueChange={handleChangeBuyer}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um comprador cadastrado..." />
              </SelectTrigger>
              <SelectContent>
                {buyers.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Nenhum usuário "Comprador" cadastrado
                  </SelectItem>
                )}
                {buyers.map((u: any) => {
                  const display =
                    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
                    u.username;
                  return (
                    <SelectItem key={u.id} value={String(u.id)}>
                      <span className="flex items-center justify-between w-full gap-4">
                        <span>{display}</span>
                        {u.email && (
                          <span className="text-xs text-muted-foreground ml-2 truncate max-w-[220px]">
                            {u.email}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Resumo dos dados do comprador (puxados do cadastro) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <User className="w-3.5 h-3.5" />
                Nome
              </div>
              <p className="text-sm font-medium break-words">{displayBuyerName}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <Phone className="w-3.5 h-3.5" />
                Telefone
              </div>
              <p className="text-sm font-medium break-words">{displayBuyerPhone}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <Mail className="w-3.5 h-3.5" />
                E-mail
              </div>
              <p className="text-sm font-medium break-words">{displayBuyerEmail}</p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button
              type="button"
              onClick={handleSaveBuyer}
              disabled={updateBuyerMutation.isPending || !selectedBuyerUserId}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateBuyerMutation.isPending ? "Salvando..." : "Salvar Comprador"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Itens da Solicitação */}
      <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Itens Solicitados</CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-200 dark:border-slate-700">
          {isLoadingSupplierItems ? (
            <div className="text-center py-4">Carregando itens...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-border px-4 py-2 text-left">Item</th>
                    <th className="border border-border px-4 py-2 text-center">Qtd.</th>
                    <th className="border border-border px-4 py-2 text-center">Unidade</th>
                    <th className="border border-border px-4 py-2 text-center">Valor Unit.</th>
                    <th className="border border-border px-4 py-2 text-center">Valor Total</th>
                    <th className="border border-border px-4 py-2 text-center">Marca</th>
                    <th className="border border-border px-4 py-2 text-center">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithPrices.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                      <td className="border border-border px-4 py-2">
                        <div className="font-medium">{item.description}</div>
                        {item.specifications && (
                          <div className="text-sm text-muted-foreground">
                            Especificações: {item.specifications}
                          </div>
                        )}
                      </td>
                      <td className="border border-border px-4 py-2 text-center">
                        {Number(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-border px-4 py-2 text-center">
                        {item.unit || 'UND'}
                      </td>
                      <td className="border border-border px-4 py-2 text-center whitespace-nowrap">
                        {fmt4(Number(item.unitPrice) || 0, Number(item.unitPriceBrl) || Number(item.unitPrice) || 0)}
                      </td>
                      <td className="border border-border px-4 py-2 text-center font-medium whitespace-nowrap">
                        {item.itemDiscount > 0 ? (
                          <div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 line-through">
                              {fmt4(Number(item.originalTotalPrice) || 0, Number(item.totalPriceBrl) || Number(item.originalTotalPrice) || 0)}
                            </div>
                            <div className="text-green-600 dark:text-green-300">
                              {fmt4(Number(item.totalPrice) || 0, Number(item.totalPriceBrl) || Number(item.totalPrice) || 0)}
                            </div>
                          </div>
                        ) : (
                          <span>{fmt4(Number(item.totalPrice) || 0, Number(item.totalPriceBrl) || Number(item.totalPrice) || 0)}</span>
                        )}
                      </td>
                      <td className="border border-border px-4 py-2 text-center">
                        {item.brand || '-'}
                      </td>
                      <td className="border border-border px-4 py-2 text-center">
                        {item.deliveryTime || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <td className="border border-border px-4 py-2" colSpan={4}>
                      Subtotal:
                    </td>
                    <td className="border border-border px-4 py-2 text-center whitespace-nowrap">
                      {fmt4(displaySubtotalOrig, displaySubtotalBrl)}
                    </td>
                    <td className="border border-border px-4 py-2" colSpan={2}></td>
                  </tr>
                  {totalDiscount > 0 && (
                    <tr>
                      <td className="border border-border px-4 py-2" colSpan={4}>
                        Desconto Total:
                      </td>
                      <td className="border border-border px-4 py-2 text-center text-red-600 dark:text-red-400 whitespace-nowrap">
                        - {fmt4(totalDiscountOrig, totalDiscount)}
                      </td>
                      <td className="border border-border px-4 py-2" colSpan={2}></td>
                    </tr>
                  )}
                  <tr>
                    <td className="border border-border px-4 py-2" colSpan={4}>
                      <div className="flex items-center gap-1">
                        <Truck className="h-4 w-4" />
                        Frete:
                      </div>
                    </td>
                    <td className="border border-border px-4 py-2 text-center whitespace-nowrap">
                      {freightValue > 0 ? (
                        <span className="text-blue-600 dark:text-blue-300">
                          {fmt4(freightValueOrig, freightValue)}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Não incluso</span>
                      )}
                    </td>
                    <td className="border border-border px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <td className="border border-border px-4 py-2" colSpan={4}>
                      Total Geral:
                    </td>
                    <td className="border border-border px-4 py-2 text-center whitespace-nowrap">
                      {fmt4(finalTotalOrig, finalTotal)}
                    </td>
                    <td className="border border-border px-4 py-2" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fornecedor Vencedor */}
      {selectedSupplierQuotation && (
        <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building className="w-5 h-5" />
              Fornecedor Vencedor
            </CardTitle>
          </CardHeader>
          <CardContent className="border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Nome:</span>
                  <p className="text-lg font-semibold">{selectedSupplierQuotation.supplier?.name || selectedSupplier?.name}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">E-mail:</span>
                  <p>{selectedSupplierQuotation.supplier?.email || selectedSupplier?.email}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Telefone:</span>
                  <p>{selectedSupplierQuotation.supplier?.phone || selectedSupplier?.phone || 'Não informado'}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">CNPJ:</span>
                  <p>{selectedSupplierQuotation.supplier?.cnpj || selectedSupplier?.cnpj || 'Não informado'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Valor Total da Proposta:</span>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-300 whitespace-pre-wrap">
                    {fmt2(finalTotalOrig, finalTotal)}
                  </p>
                </div>
                {totalDiscount > 0 && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Desconto Total Aplicado:</span>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400 whitespace-pre-wrap">
                      - {fmt2(totalDiscountOrig, totalDiscount)}
                    </p>
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Prazo de Entrega:</span>
                  <p>{selectedSupplierQuotation.deliveryTerms || 'Não informado'}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Condições de Pagamento:</span>
                  <p>{selectedSupplierQuotation.paymentTerms || 'Não informado'}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600 flex items-center gap-1">
                    <Truck className="h-4 w-4" />
                    Frete:
                  </span>
                  <p className="text-lg font-semibold whitespace-pre-wrap">
                    {freightValue > 0 ? (
                      <span className="text-blue-600 dark:text-blue-300">
                        {fmt2(freightValueOrig, freightValue)}
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">Não incluso</span>
                    )}
                  </p>
                </div>
                {selectedSupplierQuotation.observations && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Observações:</span>
                    <p>{selectedSupplierQuotation.observations}</p>
                  </div>
                )}
                
                {/* Desconto da Proposta */}
                {(selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Desconto da Proposta:</span>
                    <p className="text-lg font-semibold text-green-600">
                      {selectedSupplierQuotation.discountType === 'percentage' 
                        ? `${selectedSupplierQuotation.discountValue}%`
                        : fmt2(proposalDiscountOrig, proposalDiscount)
                      }
                    </p>
                  </div>
                )}
                {isForeign && (
                  <div className="text-sm pt-2 mt-1 border-t border-border">
                    <span className="font-medium text-gray-600">Moeda · Taxa:</span>
                    <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                      {currencyCodeNorm} · {formatRate(exchangeRateNum)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Aprovações */}
      <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Histórico de Aprovações</CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            {aprovacaoA1 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium">Aprovação A1</div>
                  <div className="text-sm text-muted-foreground">
                    {aprovacaoA1.approved ? 'Aprovado' : 'Rejeitado'} por {aprovacaoA1.approver?.firstName} {aprovacaoA1.approver?.lastName} em{" "}
                    {new Date(aprovacaoA1.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  {aprovacaoA1.rejectionReason && (
                    <div className="text-sm text-muted-foreground">
                      Motivo: {aprovacaoA1.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            )}
            {aprovacaoA2 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium">Aprovação A2</div>
                  <div className="text-sm text-muted-foreground">
                    {aprovacaoA2.approved ? 'Aprovado' : 'Rejeitado'} por {aprovacaoA2.approver?.firstName} {aprovacaoA2.approver?.lastName} em{" "}
                    {new Date(aprovacaoA2.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  {aprovacaoA2.rejectionReason && (
                    <div className="text-sm text-muted-foreground">
                      Motivo: {aprovacaoA2.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            )}
            {!aprovacaoA1 && !aprovacaoA2 && (
              <div className="text-center text-muted-foreground py-4">
                Nenhuma aprovação encontrada no histórico
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Observações do Pedido */}
      <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Observações do Pedido de Compra</CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-200 dark:border-slate-700">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="purchaseObservations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={4} 
                        placeholder="Adicione observações específicas para o pedido de compra..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateRequestMutation.isPending}>
                {updateRequestMutation.isPending ? "Salvando..." : "Salvar Observações"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Anexos */}
      {Array.isArray(attachments) && attachments.length > 0 && (
        <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
          <CardHeader>
          <CardTitle className="text-sm font-semibold">Anexos</CardTitle>
          </CardHeader>
          <CardContent className="border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {attachments.map((attachment: any) => (
                <div key={attachment.id} className="flex items-center gap-2 p-2 border rounded">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{attachment.filename}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rodapé fixo com ações */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
        <div className="flex justify-between gap-3">
          {/* Ações destrutivas / de retrocesso à esquerda */}
          <div className="flex gap-2">
            {canReturnToQuotation && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setBlockedByReceiptsA2(false); setReturnToA2Reason(""); setReturnToA2ReasonError(""); setShowReturnToA2Dialog(true); }}
                  className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retornar Aprovação A2
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setBlockedByReceipts(null); setReturnReason(""); setReturnReasonError(""); setShowReturnDialog(true); }}
                  className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900/20"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retornar Cotação
                </Button>
              </>
            )}
          </div>

          {/* Ações de avanço à direita */}
          <div className="flex gap-3">
            <Button
              onClick={handleAdvanceToReceipt}
              disabled={advanceToReceiptMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <Truck className="w-4 h-4 mr-2" />
              {advanceToReceiptMutation.isPending ? "Avançando..." : "Avançar Recebimento"}
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePreviewPDF();
              }}
              disabled={isLoadingPreview}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
            >
              <Eye className="w-4 h-4 mr-2" />
              {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? "Gerando PDF..." : "Baixar PDF"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog: Retornar para Cotação */}
      <Dialog open={showReturnDialog} onOpenChange={(open) => { if (!open) { setShowReturnDialog(false); setBlockedByReceipts(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <RotateCcw className="w-5 h-5" />
              Retornar para Cotação
            </DialogTitle>
          </DialogHeader>

          {blockedByReceipts ? (
            /* Estado de bloqueio — há NFs registradas */
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-md">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Não é possível retornar para Cotação</p>
                  <p>Este pedido possui {blockedByReceipts.receiptsWithNF.length} recebimento(s) com Nota Fiscal já registrada:</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {blockedByReceipts.receiptsWithNF.map((r: any) => (
                      <li key={r.id}>NF {r.documentNumber} ({r.receiptNumber})</li>
                    ))}
                  </ul>
                  <p className="mt-2">Para prosseguir, escolha uma das opções abaixo ou entre em contato com o comprador responsável.</p>
                </div>
              </div>
              <DialogFooter className="gap-2 flex-col sm:flex-row">
                <Button variant="outline" onClick={() => setShowReturnDialog(false)} className="w-full sm:w-auto">
                  Deixar como está
                </Button>
                <Button
                  variant="default"
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    // TODO: implementar fluxo de conclusão parcial quando necessário
                    toast({ title: "Em breve", description: "O fluxo de conclusão com recebimento parcial será implementado em breve.", variant: "default" });
                  }}
                >
                  Mover para Conclusão (parcial)
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Estado normal — solicitar justificativa */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta ação irá <strong>excluir o Pedido de Compra</strong> gerado e retornar a solicitação para a fase de Cotação,
                permitindo que um novo processo de cotação seja iniciado.
              </p>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md text-sm text-orange-800 dark:text-orange-300">
                ⚠️ Esta ação não pode ser desfeita. O Pedido de Compra e quaisquer recebimentos sem NF serão excluídos permanentemente.
              </div>
              <div className="space-y-1">
                <Label htmlFor="return-reason" className="text-sm font-medium">
                  Justificativa <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="return-reason"
                  placeholder="Descreva o motivo do retorno para cotação (ex: fornecedor informou indisponibilidade de estoque)..."
                  value={returnReason}
                  onChange={(e) => { setReturnReason(e.target.value); if (returnReasonError) setReturnReasonError(""); }}
                  className={returnReasonError ? "border-destructive" : ""}
                  rows={3}
                />
                {returnReasonError && <p className="text-xs text-destructive">{returnReasonError}</p>}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowReturnDialog(false)} disabled={returnToQuotationMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleReturnToQuotation}
                  disabled={returnToQuotationMutation.isPending || !returnReason.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {returnToQuotationMutation.isPending ? "Processando..." : "Confirmar Retorno"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Retornar para Aprovação A2 */}
      <Dialog open={showReturnToA2Dialog} onOpenChange={(open) => { if (!open) { setShowReturnToA2Dialog(false); setBlockedByReceiptsA2(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <RotateCcw className="w-5 h-5" />
              Retornar para Aprovação A2
            </DialogTitle>
          </DialogHeader>

          {blockedByReceiptsA2 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-md">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Não é possível retornar para Aprovação A2</p>
                  <p>Este Pedido de Compra já possui recebimento parcial ou Nota Fiscal vinculada. Utilize a opção "Retornar para Cotação" se for necessário reiniciar o processo.</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowReturnToA2Dialog(false)}>
                  Entendido
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta ação irá <strong>excluir o Pedido de Compra atual</strong> e retornar a solicitação para a fase de
                <strong> Aprovação A2</strong>. Ao re-aprovar a A2, um novo Pedido de Compra será gerado com os valores
                monetários corretamente convertidos para BRL nos campos principais (resolvendo divergências de valores em multi-moeda).
              </p>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md text-sm text-indigo-800 dark:text-indigo-300">
                ⚠️ Esta ação é recomendada para pedidos criados ANTES da correção de valores BRL, onde os valores dos itens aparecem invertidos. O PO antigo e eventuais recebimentos em rascunho serão permanentemente excluídos.
              </div>
              <div className="space-y-1">
                <Label htmlFor="return-a2-reason" className="text-sm font-medium">
                  Justificativa <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="return-a2-reason"
                  placeholder="Descreva o motivo do retorno (ex: valores do pedido de compra gravados em moeda errada, necessidade de recriação com valores BRL corretos)..."
                  value={returnToA2Reason}
                  onChange={(e) => { setReturnToA2Reason(e.target.value); if (returnToA2ReasonError) setReturnToA2ReasonError(""); }}
                  className={returnToA2ReasonError ? "border-destructive" : ""}
                  rows={3}
                />
                {returnToA2ReasonError && <p className="text-xs text-destructive">{returnToA2ReasonError}</p>}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowReturnToA2Dialog(false)} disabled={returnToApprovalA2Mutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleReturnToApprovalA2}
                  disabled={returnToApprovalA2Mutation.isPending || !returnToA2Reason.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {returnToApprovalA2Mutation.isPending ? "Processando..." : "Confirmar Retorno p/ A2"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
