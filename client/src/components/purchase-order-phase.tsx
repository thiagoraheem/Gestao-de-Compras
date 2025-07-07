import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  Clock, 
  CheckCircle, 
  Package,
  Truck,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const purchaseOrderSchema = z.object({
  purchaseObservations: z.string().optional(),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

interface PurchaseOrderPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
}

export default function PurchaseOrderPhase({ request, onClose, className }: PurchaseOrderPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      purchaseObservations: request?.purchaseObservations || "",
    },
  });

  // Buscar dados relacionados
  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/items`],
    enabled: !!request?.id,
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

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Mutation para salvar observações
  const updateRequestMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      return apiRequest("PATCH", `/api/purchase-requests/${request.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Observações do pedido atualizadas com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar observações do pedido",
        variant: "destructive",
      });
    },
  });

  // Função para download do PDF
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
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
      a.download = `Pedido_Compra_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "PDF do pedido de compra baixado com sucesso!",
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

  const onSubmit = (data: PurchaseOrderFormData) => {
    updateRequestMutation.mutate(data);
  };

  // Calcular valores totais
  const subtotal = Array.isArray(items) ? items.reduce((sum: number, item: any) => 
    sum + (item.unitPrice * item.requestedQuantity || 0), 0
  ) : 0;

  // Encontrar fornecedor selecionado
  const selectedSupplier = Array.isArray(supplierQuotations) ? 
    (supplierQuotations.find((sq: any) => sq.isSelected) || supplierQuotations[0]) : null;

  // Organizar histórico de aprovações
  const aprovacaoA1 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A1') : null;
  const aprovacaoA2 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A2') : null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com título e botão de fechar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pedido de Compra</h2>
          <p className="text-muted-foreground">
            Solicitação {request.requestNumber} - Resumo completo do processo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="bg-green-600 hover:bg-green-700"
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

      {/* Resumo da Solicitação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Informações da Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Solicitante:</span>
                <span>{request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "Não informado"}</span>
              </div>
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

      {/* Itens da Solicitação */}
      <Card>
        <CardHeader>
          <CardTitle>Itens Solicitados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(items) && items.map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{item.itemCode} - {item.description}</div>
                  <div className="text-sm text-muted-foreground">
                    Quantidade: {item.requestedQuantity} {item.unit || 'UND'}
                  </div>
                  {item.specifications && (
                    <div className="text-sm text-muted-foreground">
                      Especificações: {item.specifications}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    R$ {item.unitPrice?.toFixed(2).replace('.', ',') || '0,00'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total: R$ {(item.unitPrice * item.requestedQuantity || 0).toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total Geral:</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fornecedor Selecionado */}
      {selectedSupplier && (
        <Card>
          <CardHeader>
            <CardTitle>Fornecedor Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><span className="font-medium">Nome:</span> {selectedSupplier.supplierName}</div>
              <div><span className="font-medium">Valor Total:</span> R$ {selectedSupplier.totalValue?.replace('.', ',')}</div>
              <div><span className="font-medium">Prazo de Entrega:</span> {selectedSupplier.deliveryDays} dias</div>
              <div><span className="font-medium">Condições de Pagamento:</span> {selectedSupplier.paymentTerms}</div>
              {selectedSupplier.observations && (
                <div><span className="font-medium">Observações:</span> {selectedSupplier.observations}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Aprovações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Aprovações</CardTitle>
        </CardHeader>
        <CardContent>
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
      <Card>
        <CardHeader>
          <CardTitle>Observações do Pedido de Compra</CardTitle>
        </CardHeader>
        <CardContent>
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
        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent>
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
    </div>
  );
}