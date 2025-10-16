import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import {
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  DollarSign,
  User,
  Building,
  AlertTriangle,
  Clock,
  MessageSquare,
  History,
  Paperclip,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import ApprovalItemsViewer from "./approval-items-viewer";
import AttachmentsViewer from "./attachments-viewer";

const approvalSchema = z
  .object({
    approved: z.boolean(),
    rejectionReason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (
        !data.approved &&
        (!data.rejectionReason || data.rejectionReason.trim().length < 10)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Justificativa de reprovação deve ter pelo menos 10 caracteres",
      path: ["rejectionReason"],
    },
  );

type ApprovalFormData = z.infer<typeof approvalSchema>;

interface ApprovalA1PhaseProps {
  request: any;
  onClose?: () => void;
  className?: string;
}

export default function ApprovalA1Phase({
  request,
  onClose,
  className,
}: ApprovalA1PhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState<
    "approve" | "reject" | null
  >(null);

  // Adicionar query para verificar permissão
  const { data: approvalPermission } = useQuery<{canApprove: boolean, requestCostCenter: any, userCostCenters: number[]}>({
    queryKey: [`/api/purchase-requests/${request.id}/can-approve-a1`],
    enabled: !!user?.isApproverA1,
  });

  // Check if user has A1 approval permissions
  const canApprove = user?.isApproverA1 && approvalPermission?.canApprove;

  // Removed attachments query - no longer showing purchase request attachments

  const { data: approvalHistory } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  const { data: requestItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
  });

  // Transform items to match ApprovalItemData interface
  const transformedItems = requestItems.map((item) => ({
    id: item.id,
    description: item.description,
    unit: item.unit,
    requestedQuantity: parseFloat(item.requestedQuantity || "0"),
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
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/approve-a1`,
        {
          method: "POST",
          body: {
            approved: data.approved,
            rejectionReason: data.rejectionReason || null,
            approverId: user?.id || 1,
          },
        },
      );
      return response;
    },
    onSuccess: (response, variables) => {
      // Atualiza os dados em cache
      queryClient.setQueryData(["/api/purchase-requests"], (oldData: any[]) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((item) =>
          item.id === request.id ? response : item,
        );
      });

      // Invalida a query para garantir dados frescos
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });

      toast({
        title: "Sucesso",
        description: variables.approved
          ? "Solicitação aprovada e movida para Cotação! "
          : "Solicitação reprovada e movida para Arquivado ",
      });

      if (onClose) {
        onClose();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao processar aprovação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApprovalFormData) => {
    approvalMutation.mutate(data);
  };

  const handleApprove = () => {
    setSelectedAction("approve");
    form.setValue("approved", true);
    form.setValue("rejectionReason", "");
  };

  const handleReject = () => {
    setSelectedAction("reject");
    form.setValue("approved", false);
  };

  // Alert component for users without permission (will show above the form)
  const PermissionAlert = () => {
    if (canApprove) return null;
    
    return (
      <Alert className="border-amber-200 bg-amber-50 mb-6">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700">
          {!user?.isApproverA1 ? (
            <>
              <strong>Visualização Somente Leitura:</strong> Você não possui
              permissão de aprovação nível A1. Entre em contato com o
              administrador do sistema para obter acesso.
            </>
          ) : (
            <>
              <strong>Acesso Restrito:</strong> Você não possui permissão para aprovar solicitações do centro de custo "{request.costCenter?.name}". 
              Sua aprovação está limitada aos centros de custo aos quais você está associado.
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  };



  // Render normal approval form
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-1 md:pb-2">
        <CardTitle className="text-xs md:text-sm lg:text-base flex items-center gap-1 md:gap-2">
          <FileText className="h-3 w-3 md:h-4 md:w-4" />
          Aprovação A1 - Solicitação #{request.requestNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1 md:p-2 lg:p-4 space-y-1 md:space-y-2">
        {/* Permission Alert */}
        <PermissionAlert
          hasA1Permission={hasA1Permission}
          canApprove={canApprove}
          className="mb-1 md:mb-2"
        />

        {/* Request Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
          {/* Requester Information */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                <User className="h-3 w-3" />
                Informações do Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Nome:</span>
                  <span className="text-xs font-medium">
                    {request.requester?.firstName && request.requester?.lastName
                      ? `${request.requester.firstName} ${request.requester.lastName}`
                      : request.requester?.username || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Centro de Custo:</span>
                  <span className="text-xs font-medium">
                    {request.costCenter?.name || "N/A"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Request Status */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                <Building className="h-3 w-3" />
                Status da Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Categoria:</span>
                  <Badge variant="outline" className="text-xs h-4">
                    {CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS] || request.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Urgência:</span>
                  <Badge
                    variant={
                      request.urgency === "alta_urgencia"
                        ? "destructive"
                        : request.urgency === "alto"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs h-4"
                  >
                    {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS] || request.urgency}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Datas e Prazos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Data da Solicitação:</span>
                  <span className="text-xs font-medium">
                    {format(new Date(request.requestDate), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                {request.idealDeliveryDate && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Entrega Ideal:</span>
                    <span className="text-xs font-medium">
                      {format(new Date(request.idealDeliveryDate), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Tempo Decorrido:</span>
                  <span className="text-xs font-medium">
                    {formatDistanceToNow(new Date(request.requestDate), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Justification and Additional Info */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs md:text-sm flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Justificativa e Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-2">
            <div className="space-y-1">
              <div>
                <h4 className="text-xs font-medium mb-1">Justificativa:</h4>
                <ScrollArea className="h-10 md:h-12">
                  <p className="text-xs text-muted-foreground leading-tight">
                    {request.justification}
                  </p>
                </ScrollArea>
              </div>
              {request.additionalInfo && (
                <div>
                  <h4 className="text-xs font-medium mb-1">Informações Adicionais:</h4>
                  <ScrollArea className="h-10 md:h-12">
                    <p className="text-xs text-muted-foreground leading-tight">
                      {request.additionalInfo}
                    </p>
                  </ScrollArea>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Request Items */}
        <ApprovalItemsViewer
          items={transformedItems}
          title="Itens da Solicitação"
          className="mb-1 md:mb-2"
        />

        {/* Approval History */}
        {approvalHistory && approvalHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                <History className="h-3 w-3" />
                Histórico de Aprovações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <div className="space-y-1">
                {approvalHistory.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-1 border rounded-md">
                    <div className="flex items-center gap-1">
                      <Badge variant={item.approved ? 'default' : 'destructive'} className="text-xs h-4">
                        {item.approved ? 'Aprovado' : 'Reprovado'}
                      </Badge>
                      <span className="text-xs font-medium">
                        {item.approver?.firstName && item.approver?.lastName
                          ? `${item.approver.firstName} ${item.approver.lastName}`
                          : item.approver?.username || "N/A"}
                      </span>
                      {item.rejectionReason && (
                        <span className="text-xs text-muted-foreground">
                          - {item.rejectionReason}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Form */}
        {canApprove && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs md:text-sm">
                Decisão de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1 md:space-y-2">
                  {/* Action Selection */}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={selectedAction === "approve" ? "default" : "outline"}
                      onClick={handleApprove}
                      className="flex-1 h-7 md:h-8 text-xs"
                      disabled={approvalMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant={selectedAction === "reject" ? "destructive" : "outline"}
                      onClick={handleReject}
                      className="flex-1 h-7 md:h-8 text-xs"
                      disabled={approvalMutation.isPending}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reprovar
                    </Button>
                  </div>

                  {/* Rejection Reason */}
                  {selectedAction === "reject" && (
                    <FormField
                      control={form.control}
                      name="rejectionReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            Justificativa da Reprovação *
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descreva o motivo da reprovação..."
                              {...field}
                              rows={2}
                              className="text-xs min-h-[50px]"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Submit Button */}
                  {selectedAction && (
                    <div className="flex justify-end gap-1 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedAction(null);
                          form.reset();
                        }}
                        disabled={approvalMutation.isPending}
                        className="h-7 md:h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={approvalMutation.isPending}
                        className="h-7 md:h-8 text-xs"
                      >
                        {approvalMutation.isPending ? (
                          "Processando..."
                        ) : selectedAction === "approve" ? (
                          "Confirmar Aprovação"
                        ) : (
                          "Confirmar Reprovação"
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
