import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useApprovalType } from "@/hooks/useApprovalType";
import { apiRequest } from "@/lib/queryClient";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import ApprovalItemsViewer from "./approval-items-viewer";
import AttachmentsViewer from "./attachments-viewer";
import SupplierComparisonReadonly from "./supplier-comparison-readonly";
import debug from "@/lib/debug";

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

export default function ApprovalA2Phase({ request, open, onOpenChange, initialAction = null }: ApprovalA2PhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(initialAction);
  const [showComparison, setShowComparison] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
    requestedQuantity: Number(item.requestedQuantity || 0)
  }));

  const winningItems = supplierQuotationItems.map(si => {
    const qi = quotationItems.find((q: any) => q.id === si.quotationItemId);
    const description = si.description || qi?.description || '';
    const unit = si.confirmedUnit || qi?.unit || '';
    const quantity = si.availableQuantity !== null && si.availableQuantity !== undefined 
      ? Number(si.availableQuantity) 
      : Number(qi?.quantity || 0);
    const unitPrice = Number(si.unitPrice) || 0;
    const originalTotalPrice = unitPrice * quantity;
    let itemDiscount = 0;
    let totalPrice = originalTotalPrice;
    if (si.discountPercentage && Number(si.discountPercentage) > 0) {
      const d = Number(si.discountPercentage);
      itemDiscount = (originalTotalPrice * d) / 100;
      totalPrice = originalTotalPrice - itemDiscount;
    } else if (si.discountValue && Number(si.discountValue) > 0) {
      itemDiscount = Number(si.discountValue);
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

  const totalValue = selectedSupplierQuotation?.totalValue ?? winningItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

  // Usar hook para determinar tipo de aprovação
  const { data: approvalType, approvalInfo } = useApprovalType(totalValue, request.id);

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
                      {format(new Date(request.idealDeliveryDate), 'dd/MM/yyyy', { locale: ptBR })}
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
                
                {request.totalValue && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Valor Total:</span>
                    <span className="font-medium text-green-600">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(request.totalValue))}
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
                  <Label className="text-sm font-medium text-gray-600">Valor Total da Proposta</Label>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(selectedSupplierQuotation.totalValue || 0))}
                  </p>
                  {selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue && (
                    <p className="text-sm text-orange-600 mt-1">
                      Desconto da proposta: {selectedSupplierQuotation.discountType === 'percentage' 
                        ? `${selectedSupplierQuotation.discountValue}%`
                        : `R$ ${Number(selectedSupplierQuotation.discountValue).toFixed(2).replace('.', ',')}`
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
                      <span className="text-blue-600">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(Number(selectedSupplierQuotation.freightValue || 0))}
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
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.itemDiscount > 0 
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.itemDiscount)
                            : <span className="text-gray-400">-</span>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalPrice)}
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
                        const totalDiscount = selectedSupplierQuotation.discountValue ? Number(selectedSupplierQuotation.discountValue) : 0;
                        const finalValue = Number(selectedSupplierQuotation.totalValue || 0);
                        return (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-700 dark:text-gray-300">Subtotal (sem desconto):</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {totalDiscount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-orange-600 dark:text-orange-300">Desconto da proposta:</span>
                                <span className="font-medium text-orange-600 dark:text-orange-300">
                                  {selectedSupplierQuotation.discountType === 'percentage' 
                                    ? `- ${totalDiscount}%`
                                    : `- R$ ${totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Truck className="h-4 w-4" />
                                Frete:
                              </span>
                              <span className="font-medium">
                                {selectedSupplierQuotation.includesFreight ? (
                                  <span className="text-blue-600 dark:text-blue-300">
                                    R$ {Number(selectedSupplierQuotation.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400">Não incluso</span>
                                )}
                              </span>
                            </div>
                            <div className="border-t border-blue-300 dark:border-slate-700 pt-2 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-base font-semibold text-blue-800 dark:text-blue-200">Valor Final:</span>
                                <span className="text-lg font-bold text-green-700 dark:text-green-300">
                                  R$ {finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Paperclip className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{attachment.fileName}</p>
                        <p className="text-xs text-gray-500">
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
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => {
                          // Extract filename from filePath
                          const filename = attachment.filePath.split('/').pop();
                          if (filename) {
                            const fileUrl = `/api/files/supplier-quotations/${filename}`;
                            window.open(fileUrl, '_blank');
                          } else {
                            toast({
                              title: "Erro",
                              description: "Nome do arquivo não encontrado",
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
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.approved ? 'default' : 'destructive'} className="text-xs">
                        {item.approved ? 'Aprovado' : 'Reprovado'}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {item.approver?.firstName && item.approver?.lastName 
                            ? `${item.approver.firstName} ${item.approver.lastName}`
                            : item.approver?.username || 'N/A'
                          }
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getPhaseDescription(item.approverType)}
                        </span>
                      </div>
                      {item.rejectionReason && (
                        <span className="text-xs text-muted-foreground">
                          - {item.rejectionReason}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
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
                      ? `Valor R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} requer aprovação sequencial de dois aprovadores A2.`
                      : `Valor R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} requer apenas uma aprovação A2.`
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
