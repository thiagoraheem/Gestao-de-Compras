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
  History
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

  const { data: attachments } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests", request.id, "attachments"],
  });

  const { data: approvalHistory } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests", request.id, "approval-history"],
  });

  const { data: requestItems = [] } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests", request.id, "items"],
  });

  // Transform items to match ApprovalItemData interface
  const transformedItems = requestItems.map(item => ({
    id: item.id,
    itemNumber: item.itemNumber,
    description: item.description,
    unit: item.unit,
    requestedQuantity: parseFloat(item.requestedQuantity || '0')
  }));

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
        title: "Aprovação A2 processada",
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
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para aprovar solicitações no nível A2. 
              Entre em contato com o administrador do sistema.
            </AlertDescription>
          </Alert>
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

        {/* Request Items */}
        <ApprovalItemsViewer 
          items={transformedItems} 
          requestId={request.id} 
          requestNumber={request.requestNumber}
        />

        {/* Attachments */}
        <AttachmentsViewer 
          attachments={attachments || []}
          requestId={request.id}
          requestNumber={request.requestNumber}
        />

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