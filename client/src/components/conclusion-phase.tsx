import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PHASE_LABELS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { 
  Download, 
  FileText, 
  User, 
  Calendar, 
  Building, 
  Clock, 
  CheckCircle, 
  Package,
  Truck,
  X,
  Archive,
  Mail,
  Printer,
  History,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Phone,
  ExternalLink,
  Star,
  AlertTriangle
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const archiveSchema = z.object({
  conclusionObservations: z.string().optional(),
});

type ArchiveFormData = z.infer<typeof archiveSchema>;

interface ConclusionPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
}

export default function ConclusionPhase({ request, onClose, className }: ConclusionPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);

  const form = useForm<ArchiveFormData>({
    resolver: zodResolver(archiveSchema),
    defaultValues: {
      conclusionObservations: "",
    },
  });

  // Fetch all related data
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
  });

  const { data: approvalHistory = [], isLoading: approvalHistoryLoading } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/attachments`],
  });

  const { data: quotation, isLoading: quotationLoading } = useQuery({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [], isLoading: supplierQuotationsLoading } = useQuery({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (data: ArchiveFormData) => {
      return apiRequest("PATCH", `/api/purchase-requests/${request.id}/archive`, {
        ...data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Solicitação arquivada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao arquivar solicitação",
        variant: "destructive",
      });
    },
  });

  // Export PDF mutation
  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/purchase-requests/${request.id}/completion-summary-pdf`, {
        method: "GET",
      });
      
      if (!response.ok) {
        throw new Error("Erro ao gerar PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conclusao-${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "PDF gerado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar PDF",
        variant: "destructive",
      });
    },
  });

  const handleArchive = async (data: ArchiveFormData) => {
    setIsArchiving(true);
    try {
      await archiveMutation.mutateAsync(data);
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    try {
      await apiRequest("POST", `/api/purchase-requests/${request.id}/send-conclusion-email`);
      toast({
        title: "Sucesso",
        description: "Resumo enviado por e-mail",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar e-mail",
        variant: "destructive",
      });
    }
  };

  // Calculate metrics
  const selectedSupplier = supplierQuotations.find(sq => sq.status === 'selected');
  const totalProcessTime = request.createdAt ? differenceInDays(new Date(), new Date(request.createdAt)) : 0;
  const totalItemsValue = items.reduce((sum: number, item: any) => sum + (item.requestedQuantity * (item.unitPrice || 0)), 0);
  const budgetSavings = request.availableBudget ? request.availableBudget - totalItemsValue : 0;

  // Get status indicators
  const getItemStatus = (item: any) => {
    // Mock status based on item data - in real app this would come from receipt data
    return item.requestedQuantity > 0 ? 'received' : 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'divergent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge variant="default" className="bg-green-100 text-green-800">Recebido</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'divergent':
        return <Badge variant="destructive">Divergente</Badge>;
      default:
        return <Badge variant="outline">Não informado</Badge>;
    }
  };

  const isLoading = itemsLoading || approvalHistoryLoading || attachmentsLoading || quotationLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando informações da conclusão...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Conclusão da Compra</h2>
          <p className="text-gray-600">Solicitação {request.requestNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPDFMutation.mutate()}
            disabled={exportPDFMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendEmail}
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar E-mail
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Process Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tempo Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalProcessTime} dias</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalItemsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Economia</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {budgetSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                {budgetSavings > 0 ? (
                  <TrendingDown className="h-8 w-8 text-green-500" />
                ) : (
                  <TrendingUp className="h-8 w-8 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <p className="text-2xl font-bold text-green-600">Concluído</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resumo da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Número da Solicitação</span>
                  <p className="text-lg font-semibold">{request.requestNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Data de Criação</span>
                  <p>{format(new Date(request.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Status Final</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {PHASE_LABELS[request.currentPhase]}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Solicitante</span>
                  <p className="font-medium">{request.requesterName}</p>
                  <p className="text-sm text-gray-600">{request.requesterEmail}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Departamento</span>
                  <p>{request.departmentName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Centro de Custo</span>
                  <p>{request.costCenterName}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Categoria</span>
                  <Badge variant="outline">{CATEGORY_LABELS[request.category]}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Urgência</span>
                  <Badge variant="outline">{URGENCY_LABELS[request.urgency]}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Orçamento Disponível</span>
                  <p className="font-medium">
                    {request.availableBudget?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div>
              <span className="text-sm font-medium text-gray-500">Justificativa</span>
              <p className="mt-1 text-gray-900">{request.justification}</p>
            </div>
          </CardContent>
        </Card>

        {/* Selected Supplier */}
        {selectedSupplier && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Fornecedor Selecionado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Nome do Fornecedor</span>
                    <p className="text-lg font-semibold">{selectedSupplier.supplier?.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Contato</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p>{selectedSupplier.supplier?.phone || 'Não informado'}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p>{selectedSupplier.supplier?.email || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Valor da Cotação</span>
                    <p className="text-lg font-semibold text-green-600">
                      {selectedSupplier.totalValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Prazo de Entrega</span>
                    <p>{selectedSupplier.deliveryTime || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Status</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Selecionado
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase Order Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dados do Pedido de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Número do Pedido</span>
                  <p className="text-lg font-semibold">{request.requestNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Data de Emissão</span>
                  <p>{format(new Date(request.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Status do Pedido</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Entregue
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Condições de Pagamento</span>
                  <p>{request.paymentConditions || 'Conforme contrato'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Local de Entrega</span>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <p>{request.deliveryLocation || 'Sede da empresa'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Dados do Recebimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Data do Recebimento</span>
                  <p>{format(new Date(request.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Responsável pelo Recebimento</span>
                  <p>{request.receivedBy || 'Sistema Automático'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Status da Conferência</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Conforme
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Observações</span>
                  <p>{request.receiptObservations || 'Recebimento sem observações'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Linha do Tempo do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvalHistory.map((approval: any, index: number) => (
                <div key={approval.id} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{approval.phase}</p>
                      <span className="text-sm text-gray-500">
                        {format(new Date(approval.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{approval.approverName}</p>
                    {approval.observations && (
                      <p className="text-sm text-gray-600 mt-1">{approval.observations}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Items Received */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">Unidade</th>
                    <th className="text-right py-2">Qtd. Solicitada</th>
                    <th className="text-right py-2">Qtd. Recebida</th>
                    <th className="text-right py-2">Preço Unitário</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => {
                    const status = getItemStatus(item);
                    const unitPrice = item.unitPrice || 0;
                    const total = item.requestedQuantity * unitPrice;
                    
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">
                          <div>
                            <p className="font-medium">{item.description}</p>
                            {item.specifications && (
                              <p className="text-sm text-gray-600">{item.specifications}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2">{item.unit}</td>
                        <td className="text-right py-2">{item.requestedQuantity}</td>
                        <td className="text-right py-2">{item.requestedQuantity}</td>
                        <td className="text-right py-2">
                          {unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-right py-2 font-medium">
                          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-center py-2">
                          <div className="flex items-center justify-center gap-1">
                            {getStatusIcon(status)}
                            {getStatusBadge(status)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Anexos do Processo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attachments.map((attachment: any) => (
                  <div key={attachment.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">{attachment.filename}</p>
                      <p className="text-sm text-gray-600">{attachment.fileType}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Process Completion Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Status do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Processo Concluído</p>
                <p className="text-sm text-green-700">
                  Todas as etapas foram executadas com sucesso. O processo está finalizado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}