
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  URGENCY_LEVELS,
  CATEGORY_OPTIONS,
  URGENCY_LABELS,
  CATEGORY_LABELS,
} from "@/lib/types";
import { Plus, X, Edit3, FileText, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const requestSchema = z.object({
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z
    .string()
    .min(10, "Justificativa deve ter pelo menos 10 caracteres"),
  idealDeliveryDate: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface Item {
  id: string;
  description: string;
  unit: string;
  requestedQuantity: number;
  estimatedPrice?: number;
  technicalSpecification?: string;
}

interface RequestPhaseProps {
  onClose?: () => void;
  className?: string;
  request?: any;
}

export default function RequestPhase({ onClose, className, request }: RequestPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [manualItems, setManualItems] = useState<Item[]>([]);

  // Get user's cost center IDs
  const { data: userCostCenterIds } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "cost-centers"],
    queryFn: () =>
      fetch(`/api/users/${user?.id}/cost-centers`).then((res) => res.json()),
    enabled: !!user?.id,
  });

  // Get all cost centers
  const { data: allCostCenters } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  // Filter cost centers based on user's assigned cost centers
  const costCenters =
    allCostCenters?.filter((center) =>
      userCostCenterIds?.includes(center.id),
    ) || [];

  // Buscar itens existentes da solicitação se estiver editando
  const { data: existingItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/items`],
    enabled: !!request?.id,
  });

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      costCenterId: request?.costCenterId || 0,
      category: request?.category || "",
      urgency: request?.urgency || "",
      justification: request?.justification || "",
      idealDeliveryDate: request?.idealDeliveryDate 
        ? new Date(request.idealDeliveryDate).toISOString().split('T')[0] 
        : "",
      additionalInfo: request?.additionalInfo || "",
    },
  });

  // Carregar itens existentes quando disponíveis
  useEffect(() => {
    if (existingItems.length > 0) {
      const convertedItems: Item[] = existingItems.map((item) => ({
        id: item.id?.toString() || Date.now().toString(),
        description: item.description || "",
        unit: item.unit || "UN",
        requestedQuantity: item.requestedQuantity || 1,
        estimatedPrice: item.estimatedPrice || 0,
        technicalSpecification: item.technicalSpecification || "",
      }));
      setManualItems(convertedItems);
    }
  }, [existingItems]);

  // Atualizar formulário quando os dados da solicitação mudarem
  useEffect(() => {
    if (request) {
      form.reset({
        costCenterId: request.costCenterId || 0,
        category: request.category || "",
        urgency: request.urgency || "",
        justification: request.justification || "",
        idealDeliveryDate: request.idealDeliveryDate 
          ? new Date(request.idealDeliveryDate).toISOString().split('T')[0] 
          : "",
        additionalInfo: request.additionalInfo || "",
      });
    }
  }, [request, form]);

  const createRequestMutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      const requestData = {
        ...data,
        requesterId: user?.id || 1,
        costCenterId: Number(data.costCenterId),
        idealDeliveryDate: data.idealDeliveryDate || undefined,
        items: manualItems,
      };
      
      const url = request ? `/api/purchase-requests/${request.id}` : "/api/purchase-requests";
      const method = request ? "PUT" : "POST";
      const response = await apiRequest(url, {
        method,
        body: requestData,
      });
      return response.json();
    },
    onMutate: async (data) => {
      if (!request) {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: ["/api/purchase-requests"] });

        // Snapshot the previous value
        const previousRequests = queryClient.getQueryData([
          "/api/purchase-requests",
        ]);

        // Optimistically add new request
        queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          const costCenter = costCenters.find(
            (cc) => cc.id === Number(data.costCenterId),
          );
          const optimisticRequest = {
            id: Date.now(), // Temporary ID
            requestNumber: `SOL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
            currentPhase: "solicitacao",
            urgency: data.urgency,
            category: data.category,
            justification: data.justification,
            costCenterId: Number(data.costCenterId),
            costCenter: costCenter,
            department: costCenter?.department,
            requesterId: user?.id || 1,
            requester: {
              firstName: user?.firstName || "Usuário",
              lastName: user?.lastName || "Atual",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: manualItems,
          };
          return [optimisticRequest, ...old];
        });

        return { previousRequests };
      }
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousRequests) {
        queryClient.setQueryData(
          ["/api/purchase-requests"],
          context.previousRequests,
        );
      }

      toast({
        title: "Erro",
        description: request ? "Falha ao atualizar solicitação" : "Falha ao criar solicitação",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation and immediate refetch
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-requests/${request?.id}/items`] });

      // Force immediate refetch for real data
      queryClient.refetchQueries({
        queryKey: ["/api/purchase-requests"],
        type: "active",
      });

      toast({
        title: "Sucesso",
        description: request ? "Solicitação atualizada com sucesso!" : "Solicitação criada com sucesso!",
      });
      
      if (!request) {
        form.reset();
        setManualItems([]);
      }
      onClose?.();
    },
  });

  const sendToApprovalMutation = useMutation({
    mutationFn: async () => {
      if (!request?.id) throw new Error("ID da solicitação não encontrado");
      return await apiRequest(`/api/purchase-requests/${request.id}/send-to-approval`, {
        method: "POST",
      });
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/purchase-requests"] });

      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData(["/api/purchase-requests"]);

      // Optimistically update the request phase
      queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) =>
          item.id === request?.id
            ? { ...item, currentPhase: "aprovacao_a1", updatedAt: new Date().toISOString() }
            : item
        );
      });

      return { previousRequests };
    },
    onSuccess: () => {
      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
      });
      
      // Force refetch to ensure we have the latest data
      queryClient.refetchQueries({ queryKey: ["/api/purchase-requests"] });
      
      toast({
        title: "Sucesso",
        description: "Solicitação enviada para aprovação A1",
      });
      onClose?.();
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousRequests) {
        queryClient.setQueryData(["/api/purchase-requests"], context.previousRequests);
      }
      
      toast({
        title: "Erro",
        description: err?.message || "Não foi possível enviar para aprovação",
        variant: "destructive",
      });
    },
  });

  const addManualItem = () => {
    const newItem: Item = {
      id: Date.now().toString(),
      description: "",
      unit: "UN",
      requestedQuantity: 1,
      estimatedPrice: 0,
      technicalSpecification: "",
    };
    setManualItems([...manualItems, newItem]);
  };

  const removeManualItem = (id: string) => {
    setManualItems(manualItems.filter((item) => item.id !== id));
  };

  const updateManualItem = (id: string, field: keyof Item, value: any) => {
    setManualItems(
      manualItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const onSubmit = (data: RequestFormData) => {
    // Validação: deve ter itens manuais
    if (manualItems.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item à solicitação",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate(data);
  };

  const isFormValid = form.formState.isValid && manualItems.length > 0;

  return (
    <div className={cn("w-full max-w-4xl", className)}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          {request ? 'Editar Solicitação de Compra' : 'Nova Solicitação de Compra'}
        </h2>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="costCenterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo *</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value?.toString()}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {costCenters &&
                              (costCenters as any[]).map((center: any) => (
                                <SelectItem
                                  key={center.id}
                                  value={center.id.toString()}
                                >
                                  {center.code} - {center.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria de Compra *</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_OPTIONS).map(
                              ([key, value]) => (
                                <SelectItem key={value} value={value}>
                                  {CATEGORY_LABELS[value]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgência *</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(URGENCY_LEVELS).map(
                              ([key, value]) => (
                                <SelectItem key={value} value={value}>
                                  {URGENCY_LABELS[value]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="idealDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo Ideal de Entrega</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="DD/MM/AAAA"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Descreva a necessidade e justificativa para esta compra..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Informações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        placeholder="Informações complementares sobre a solicitação..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Itens da Solicitação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Itens da Solicitação</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value="manual" className="space-y-4">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger
                    value="manual"
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Cadastro Manual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Itens Cadastrados</h4>
                    <Button
                      type="button"
                      onClick={addManualItem}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </div>

                  {manualItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Edit3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>Nenhum item cadastrado ainda.</p>
                      <p className="text-sm">
                        Clique em "Adicionar Item" para começar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {manualItems.map((item) => (
                        <Card key={item.id} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <label className="text-sm font-medium">
                                Descrição
                              </label>
                              <Input
                                value={item.description}
                                onChange={(e) =>
                                  updateManualItem(
                                    item.id,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                placeholder="Descrição do item"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">
                                Unidade
                              </label>
                              <Select
                                value={item.unit}
                                onValueChange={(value) =>
                                  updateManualItem(item.id, "unit", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="UN">UN</SelectItem>
                                  <SelectItem value="PC">PC</SelectItem>
                                  <SelectItem value="MT">MT</SelectItem>
                                  <SelectItem value="KG">KG</SelectItem>
                                  <SelectItem value="LT">LT</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium">
                                Quantidade
                              </label>
                              <Input
                                type="number"
                                value={item.requestedQuantity}
                                onChange={(e) =>
                                  updateManualItem(
                                    item.id,
                                    "requestedQuantity",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                min="1"
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeManualItem(item.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">
                              Especificação Técnica
                            </label>
                            <Textarea
                              value={item.technicalSpecification || ""}
                              onChange={(e) =>
                                updateManualItem(
                                  item.id,
                                  "technicalSpecification",
                                  e.target.value,
                                )
                              }
                              placeholder="Especificações técnicas detalhadas (marca, modelo, características, etc.)"
                              rows={2}
                              className="mt-1"
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isFormValid ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Formulário válido e pronto para envio</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>Preencha todos os campos obrigatórios</span>
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              {onClose && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={createRequestMutation.isPending || sendToApprovalMutation.isPending}
                >
                  Cancelar
                </Button>
              )}
              
              {/* Send to Approval button - only for editing requests in request phase */}
              {request && request.currentPhase === "solicitacao" && (
                <Button 
                  type="button"
                  variant="default"
                  onClick={() => sendToApprovalMutation.mutate()}
                  disabled={sendToApprovalMutation.isPending || createRequestMutation.isPending}
                  className="min-w-[140px] bg-blue-600 hover:bg-blue-700"
                >
                  {sendToApprovalMutation.isPending ? (
                    "Enviando..."
                  ) : (
                    "Enviar para Aprovação"
                  )}
                </Button>
              )}
              
              <Button 
                type="submit" 
                disabled={createRequestMutation.isPending || sendToApprovalMutation.isPending || !isFormValid}
                className="min-w-[140px]"
              >
                {createRequestMutation.isPending ? (
                  "Processando..."
                ) : (
                  request ? "Salvar Alterações" : "Criar Solicitação"
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
