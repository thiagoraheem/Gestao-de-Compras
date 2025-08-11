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
    <Card className={cn("w-full max-w-6xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            Aprovação A1 - Solicitação #{request.requestNumber}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={request.urgency === "alto" ? "destructive" : "secondary"}
            >
              {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS] ||
                request.urgency}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <XCircle className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Request Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Informações da Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Solicitante:
                  </span>
                  <span className="font-medium">
                    {request.requester?.firstName && request.requester?.lastName
                      ? `${request.requester.firstName} ${request.requester.lastName}`
                      : request.requester?.username || "N/A"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Centro de Custo:
                  </span>
                  <span className="font-medium">
                    {request.costCenter?.code} - {request.costCenter?.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Categoria:
                  </span>
                  <Badge variant="outline">
                    {request.category in CATEGORY_LABELS
                      ? CATEGORY_LABELS[
                          request.category as keyof typeof CATEGORY_LABELS
                        ]
                      : request.category}
                  </Badge>
                </div>

                {request.idealDeliveryDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Prazo Ideal:
                    </span>
                    <span className="font-medium">
                      {format(
                        new Date(request.idealDeliveryDate),
                        "dd/MM/yyyy",
                        { locale: ptBR },
                      )}
                    </span>
                  </div>
                )}

                {request.availableBudget && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Orçamento:
                    </span>
                    <span className="font-medium">
                      R${" "}
                      {parseFloat(request.availableBudget).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                        },
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Criado:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(request.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
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
                <p className="text-sm leading-relaxed">
                  {request.justification}
                </p>
              </ScrollArea>

              {request.additionalInfo && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">
                    Informações Adicionais:
                  </h4>
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

        {/* Attachments section removed - no longer showing purchase request attachments */}

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
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.approved ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {item.approved ? "Aprovado" : "Reprovado"}
                      </Badge>
                      <span className="text-sm font-medium">
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

        <Separator />

        {/* Approval Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Decisão de Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    onClick={handleApprove}
                    variant={
                      selectedAction === "approve" ? "default" : "outline"
                    }
                    className="flex items-center gap-2"
                    disabled={!canApprove}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar Solicitação
                  </Button>

                  <Button
                    type="button"
                    onClick={handleReject}
                    variant={
                      selectedAction === "reject" ? "destructive" : "outline"
                    }
                    className="flex items-center gap-2"
                    disabled={!canApprove}
                  >
                    <XCircle className="h-4 w-4" />
                    Reprovar Solicitação
                  </Button>
                </div>

                {/* Rejection Reason Field */}
                {selectedAction === "reject" && (
                  <FormField
                    control={form.control}
                    name="rejectionReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa da Reprovação *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={4}
                            placeholder="Descreva detalhadamente os motivos da reprovação..."
                            className="resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Submit Button */}
                {selectedAction && (
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedAction(null);
                        form.reset();
                      }}
                      disabled={approvalMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={approvalMutation.isPending || !canApprove}
                      variant={
                        selectedAction === "approve" ? "default" : "destructive"
                      }
                      className="min-w-[120px]"
                    >
                      {approvalMutation.isPending
                        ? "Processando..."
                        : selectedAction === "approve"
                          ? "Confirmar Aprovação"
                          : "Confirmar Reprovação"}
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
