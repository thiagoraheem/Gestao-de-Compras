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
  Paperclip
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
import { apiRequest } from "@/lib/queryClient";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import ApprovalItemsViewer from "./approval-items-viewer";
import AttachmentsViewer from "./attachments-viewer";

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
}

export default function ApprovalA2Phase({ request, onClose, className }: ApprovalA2PhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null);

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
    // Encontrar o item correspondente na cotação pela descrição
    const quotationItem = quotationItems.find((qi: any) => qi.description === item.description);
    let unitPrice = 0;
    let totalPrice = 0;
    
    if (quotationItem) {
      // Encontrar o preço do fornecedor para este item da cotação
      const supplierItem = supplierQuotationItems.find((si: any) => si.quotationItemId === quotationItem.id);
      if (supplierItem) {
        unitPrice = Number(supplierItem.unitPrice) || 0;
        totalPrice = unitPrice * Number(item.requestedQuantity || 0);
      }
    }

    return {
      id: item.id,
      description: item.description,
      unit: item.unit,
      requestedQuantity: parseFloat(item.requestedQuantity || '0'),
      unitPrice,
      totalPrice
    };
  });

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      approved: false,
      rejectionReason: "",
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      const response = await apiRequest("POST", `/api/purchase-requests/${request.id}/approve-a2`, {
        ...data,
        approverId: user?.id,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: selectedAction === 'approve' 
          ? "Solicitação aprovada e movida para Pedido de Compra!"
          : "Solicitação reprovada e movida para Arquivado",
      });
      onClose?.();
    },
    onError: (error: any) => {
      console.error("Erro na aprovação A2:", error);
      toast({
        title: "Erro",
        description: "Falha ao processar aprovação A2",
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

  if (!canApprove) {
    return (
      <Card className={cn("w-full max-w-4xl", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Aprovação A2 - {request.requestNumber}
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Visualização Somente Leitura:</strong> Você não possui permissão de aprovação nível A2. 
              Entre em contato com o administrador do sistema para obter acesso.
            </AlertDescription>
          </Alert>

          {/* Request Information - Read Only */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Solicitante</Label>
              <p className="text-sm text-gray-900">{request.requesterName || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Departamento</Label>
              <p className="text-sm text-gray-900">{request.department || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Centro de Custo</Label>
              <p className="text-sm text-gray-900">{request.costCenter || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Urgência</Label>
              <Badge variant={request.urgency === 'alta' ? 'destructive' : request.urgency === 'media' ? 'secondary' : 'default'}>
                {request.urgency}
              </Badge>
            </div>
          </div>

          {/* Items Section - Read Only */}
          {transformedItems.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">Itens da Solicitação</Label>
              <div className="space-y-2">
                {transformedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-gray-600">
                        Quantidade: {item.requestedQuantity} {item.unit}
                      </p>
                      {item.unitPrice > 0 && (
                        <p className="text-sm text-green-600 font-medium">
                          Valor unitário: R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                          Total: R$ {item.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Supplier */}
          {selectedSupplierQuotation && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">Fornecedor Vencedor</Label>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">{selectedSupplierQuotation.supplier?.name}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">E-mail:</p>
                    <p className="text-sm font-medium">{selectedSupplierQuotation.supplier?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Telefone:</p>
                    <p className="text-sm font-medium">{selectedSupplierQuotation.supplier?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Valor Total:</p>
                    <p className="font-medium text-green-700">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(selectedSupplierQuotation.totalValue || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Condições de Pagamento:</p>
                    <p className="text-sm font-medium">{selectedSupplierQuotation.paymentTerms || "N/A"}</p>
                  </div>
                </div>
                {selectedSupplierQuotation.choiceReason && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-1">Justificativa da Escolha:</p>
                    <p className="text-sm text-gray-700">{selectedSupplierQuotation.choiceReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Approval History */}
          {approvalHistory && approvalHistory.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">Histórico de Aprovações</Label>
              <div className="space-y-2">
                {approvalHistory.map((history: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{history.approverName}</p>
                      <p className="text-sm text-gray-600">{history.approverType}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={history.approved ? 'default' : 'destructive'}>
                        {history.approved ? 'Aprovado' : 'Reprovado'}
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(history.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">Anexos</Label>
              <div className="space-y-2">
                {attachments.map((attachment: any) => (
                  <div key={attachment.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Paperclip className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{attachment.fileName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-4xl", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Aprovação A2 - {request.requestNumber}
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
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
                  <Badge variant={request.urgency === "alto" ? "destructive" : "secondary"}>
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

        {/* Items Table with Supplier Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Itens da Solicitação
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {transformedItems.length} {transformedItems.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
            </p>
          </CardHeader>
          <CardContent>
            {transformedItems.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transformedItems.map((item: any, index: number) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="font-medium">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.requestedQuantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unitPrice > 0 ? (
                            <span className="font-medium text-green-600">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(item.unitPrice)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.totalPrice > 0 ? (
                            <span className="font-semibold text-green-600">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(item.totalPrice)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Total Summary */}
                <div className="border-t bg-gray-50 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Total Geral ({transformedItems.length} {transformedItems.length === 1 ? 'item' : 'itens'})
                    </span>
                    <span className="text-lg font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(
                        transformedItems.reduce((total: number, item: any) => total + (item.totalPrice || 0), 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum item encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attachments section removed - no longer showing purchase request attachments */}

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
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.approved ? 'default' : 'destructive'} className="text-xs">
                        {item.approved ? 'Aprovado' : 'Reprovado'}
                      </Badge>
                      <span className="text-sm font-medium">
                        {item.approver?.firstName && item.approver?.lastName 
                          ? `${item.approver.firstName} ${item.approver.lastName}`
                          : item.approver?.username || 'N/A'
                        }
                      </span>
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

        {/* Approval Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ação de Aprovação A2</CardTitle>
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
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="archive" id="archive" />
                                <Label htmlFor="archive">Arquivar definitivamente</Label>
                              </div>
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
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedAction(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={approvalMutation.isPending}
                      className={selectedAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : ''}
                    >
                      {approvalMutation.isPending ? 'Processando...' : 'Confirmar'}
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}