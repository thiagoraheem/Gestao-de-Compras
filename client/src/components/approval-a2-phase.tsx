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
  Truck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  rejectionAction: z.enum(['archive', 'recotacao']).optional(),
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
  onClose?: () => void;
  className?: string;
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

export default function ApprovalA2Phase({ request, onClose, className, initialAction = null }: ApprovalA2PhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(initialAction);
  const [showComparison, setShowComparison] = useState(false);

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

  // Transform items to match ApprovalItemData interface with prices
  const transformedItems = requestItems.map(item => {
    // Encontrar o item correspondente na cotação usando purchaseRequestItemId
    const quotationItem = quotationItems.find((qi: any) => {
      // Primeiro tenta por purchaseRequestItemId (método mais confiável)
      if (qi.purchaseRequestItemId && item.id && qi.purchaseRequestItemId === item.id) {
        return true;
      }
      // Fallback: tenta por descrição
      return qi.description === item.description;
    });
    let unitPrice = 0;
    let totalPrice = 0;
    let originalTotalPrice = 0;
    let itemDiscount = 0;
    
    if (quotationItem) {
      // Encontrar o preço do fornecedor para este item da cotação
      const supplierItem = supplierQuotationItems.find((si: any) => si.quotationItemId === quotationItem.id);
      if (supplierItem) {
        unitPrice = Number(supplierItem.unitPrice) || 0;
        const quantity = Number(item.requestedQuantity || 0);
        
        // Calcular preço com desconto se houver
        originalTotalPrice = unitPrice * quantity;
        let discountedTotal = originalTotalPrice;
        
        if (supplierItem.discountPercentage && Number(supplierItem.discountPercentage) > 0) {
          const discountPercent = Number(supplierItem.discountPercentage);
          itemDiscount = (originalTotalPrice * discountPercent) / 100;
          discountedTotal = originalTotalPrice - itemDiscount;
        } else if (supplierItem.discountValue && Number(supplierItem.discountValue) > 0) {
          itemDiscount = Number(supplierItem.discountValue);
          discountedTotal = Math.max(0, originalTotalPrice - itemDiscount);
        }
        
        totalPrice = discountedTotal;
      }
    }

    return {
      id: item.id,
      description: item.description,
      unit: item.unit,
      requestedQuantity: parseFloat(item.requestedQuantity || '0'),
      unitPrice,
      totalPrice,
      originalTotalPrice,
      itemDiscount
    };
  });

  // Calcular valor total da solicitação
  const totalValue = transformedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

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
      onClose?.();
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

  return (
    <div className={`space-y-1 md:space-y-2 ${className || ''}`}>
      {/* Request Details */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Detalhes da Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Número</span>
              <p className="text-sm font-semibold">{request.requestNumber}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Solicitante</span>
              <p className="text-xs">
                {request.requester?.firstName && request.requester?.lastName
                  ? `${request.requester.firstName} ${request.requester.lastName}`
                  : request.requesterName || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Centro de Custo</span>
              <p className="text-xs">{request.costCenter?.name || 'N/A'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Data da Solicitação</span>
              <p className="text-xs">{format(new Date(request.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-2 mt-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Urgência</span>
              <Badge variant={request.urgency === 'high' ? 'destructive' : request.urgency === 'medium' ? 'default' : 'secondary'} className="text-xs">
                {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
              </Badge>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Categoria</span>
              <Badge variant="outline" className="text-xs">
                {CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}
              </Badge>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Valor Total</span>
              <p className="text-sm font-bold text-green-600">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          
          <div className="mt-2">
            <span className="text-xs font-medium text-gray-500">Justificativa</span>
            <p className="mt-1 text-xs">{request.justification}</p>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Itens com Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1">
          <ApprovalItemsViewer items={itemsWithPrices} />
        </CardContent>
      </Card>

      {/* Supplier Attachments */}
      {supplierAttachments && supplierAttachments.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Anexos dos Fornecedores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="space-y-1">
              {supplierAttachments.map((attachment: any) => (
                <div key={attachment.id} className="flex items-center justify-between p-1 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-blue-100 rounded-full">
                      <Paperclip className="h-3 w-3 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-xs">{attachment.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {attachment.supplierName} • {attachment.fileType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {attachment.attachmentType === 'supplier_proposal' ? 'Proposta' : 'Documento'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(attachment.fileUrl, '_blank')}
                      className="text-xs h-6"
                    >
                      Ver
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
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1">
              <History className="h-3 w-3" />
              Histórico de Aprovações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="space-y-1">
              {approvalHistory.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-1 border rounded-lg">
                  <div className="flex items-center gap-1">
                    <Badge variant={item.approved ? 'default' : 'destructive'} className="text-xs">
                      {item.approved ? 'Aprovado' : 'Reprovado'}
                    </Badge>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">
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
                    {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplier Comparison */}
      {selectedSupplier && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1">
              <Building className="h-3 w-3" />
              Fornecedor Escolhido
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <Button 
              variant="outline" 
              className="w-full h-6 text-xs"
              onClick={() => setShowComparison(true)}
            >
              <BarChart3 className="mr-1 h-3 w-3" />
              Ver Comparação de Fornecedores
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      {canApprove && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Ação de Aprovação A2</CardTitle>
            {/* Mostrar informações sobre o tipo de aprovação */}
            {approvalType && (
              <div className="mt-1 p-1 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-blue-600" />
                  <span className="text-xs font-medium text-blue-800">
                    {approvalType === 'dual' ? 'Dupla Aprovação Necessária' : 'Aprovação Simples'}
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-0.5">
                  {approvalType === 'dual' 
                    ? `Valor R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} requer aprovação sequencial de dois aprovadores A2.`
                    : `Valor R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} requer apenas uma aprovação A2.`
                  }
                </p>
                {approvalInfo && approvalInfo.nextApprover && (
                  <p className="text-xs text-blue-700 mt-0.5">
                    Próximo aprovador: {approvalInfo.nextApprover.firstName} {approvalInfo.nextApprover.lastName}
                    {approvalInfo.nextApprover.isCEO && ' (CEO)'}
                  </p>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    onClick={handleApprove}
                    variant={selectedAction === 'approve' ? 'default' : 'outline'}
                    className={cn(
                      "flex-1 text-xs h-7",
                      selectedAction === 'approve' && "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleReject}
                    variant={selectedAction === 'reject' ? 'destructive' : 'outline'}
                    className="flex-1 text-xs h-7"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reprovar
                  </Button>
                </div>

                {selectedAction === 'reject' && (
                  <div className="space-y-1">
                    <FormField
                      control={form.control}
                      name="rejectionReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Justificativa da Reprovação</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descreva o motivo da reprovação..."
                              className="min-h-[60px] text-xs"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rejectionAction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Ação após Reprovação</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="recotacao" id="recotacao" />
                                <Label htmlFor="recotacao" className="text-xs">
                                  Retornar para nova cotação
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="archive" id="archive" />
                                <Label htmlFor="archive" className="text-xs">
                                  Arquivar solicitação
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {selectedAction && (
                  <Button
                    type="submit"
                    disabled={approvalMutation.isPending}
                    className="w-full text-xs h-7"
                  >
                    {approvalMutation.isPending ? 'Processando...' : 'Confirmar Decisão'}
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Permission Warning */}
      {!canApprove && (
        <Alert>
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Você não possui permissão para aprovar esta solicitação. Apenas usuários com perfil de Aprovador A2 podem realizar esta ação.
          </AlertDescription>
        </Alert>
      )}

      {/* Supplier Comparison Modal */}
      {showComparison && selectedSupplier && (
        <SupplierComparisonReadonly
          requestId={request.id}
          chosenSupplierId={selectedSupplier.id}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}