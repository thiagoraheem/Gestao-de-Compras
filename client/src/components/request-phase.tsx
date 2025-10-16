
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
import ProductSearch from "./product-search";
import HybridProductInput from "./hybrid-product-input";
import { UnitSelect } from "./unit-select";
import { useUnits } from "@/hooks/useUnits";

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
  productCode?: string; // Código do produto no ERP
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
  const { processERPUnit } = useUnits();
  const [manualItems, setManualItems] = useState<Item[]>([]);

  // Get user's cost center IDs
  const { data: userCostCenterIds } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "cost-centers"],
    queryFn: () => apiRequest(`/api/users/${user?.id}/cost-centers`),
    enabled: !!user?.id,
  });

  // Get all cost centers
  const { data: allCostCenters } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  // Filter cost centers based on user's assigned cost centers
  // Managers can see all cost centers, others only their assigned ones
  const costCenters = user?.isManager 
    ? (allCostCenters || [])
    : (allCostCenters?.filter((center) =>
        userCostCenterIds?.includes(center.id),
      ) || []);

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
        productCode: item.productCode || "",
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
  }, [request]); // Removido 'form' das dependências

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
      return response;
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
            id: `temp_${Date.now()}`, // Temporary ID - using string to avoid confusion with real IDs
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
    onSuccess: (response) => {
      // Comprehensive cache invalidation and immediate refetch
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-requests/${request?.id}/items`] });

      // For new requests, also update the cache with the real data returned from server
      if (!request && response) {
        queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          // Remove temporary entries and ensure we get fresh data
          return old.filter(item => !item.id.toString().startsWith('temp_'));
        });
      }

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
          !!query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
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
      productCode: "",
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

  const handleProductSelect = (itemId: string, product: any) => {
    const processedUnit = processERPUnit(product.unidade);
    setManualItems(
      manualItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productCode: product.codigo,
              description: product.descricao,
              unit: processedUnit || item.unit,
            }
          : item,
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

  // Define displayItems based on whether we're viewing an existing request or creating a new one
  const displayItems = request ? existingItems : manualItems;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-1 md:p-2">
        <DialogHeader className="pb-1 md:pb-2">
          <DialogTitle className="text-sm md:text-base">
            {request ? "Visualizar Solicitação" : "Nova Solicitação de Compra"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1 md:space-y-2">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-7 md:h-8">
                <TabsTrigger value="general" className="text-xs">Informações Gerais</TabsTrigger>
                <TabsTrigger value="items" className="text-xs">Itens</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-1 md:space-y-2 mt-1 md:mt-2">
                <Card>
                  <CardHeader className="pb-1 md:pb-2 p-2 md:p-3">
                    <CardTitle className="text-xs md:text-sm">Dados da Solicitação</CardTitle>
                    <CardDescription className="text-xs">
                      Preencha as informações básicas da solicitação
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-2 md:p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                      <FormField
                        control={form.control}
                        name="costCenterId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Centro de Custo *</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(Number(value))}
                              value={field.value?.toString() || ""}
                              disabled={request}
                            >
                              <FormControl>
                                <SelectTrigger className="h-7 md:h-8 text-xs">
                                  <SelectValue placeholder="Selecione o centro de custo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {costCenters.map((costCenter) => (
                                  <SelectItem key={costCenter.id} value={costCenter.id.toString()}>
                                    {costCenter.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Categoria *</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={request}
                            >
                              <FormControl>
                                <SelectTrigger className="h-7 md:h-8 text-xs">
                                  <SelectValue placeholder="Selecione a categoria" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(CATEGORY_OPTIONS).map(([key, value]) => (
                                  <SelectItem key={key} value={value}>
                                    {CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="urgency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Urgência *</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={request}
                            >
                              <FormControl>
                                <SelectTrigger className="h-7 md:h-8 text-xs">
                                  <SelectValue placeholder="Selecione a urgência" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(URGENCY_LEVELS).map(([key, value]) => (
                                  <SelectItem key={key} value={value}>
                                    {URGENCY_LABELS[value as keyof typeof URGENCY_LABELS]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="idealDeliveryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Data Ideal de Entrega</FormLabel>
                            <FormControl>
                              <DateInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Selecione a data"
                                disabled={request}
                                className="h-7 md:h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-1 md:mt-2">
                      <FormField
                        control={form.control}
                        name="justification"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Justificativa *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Descreva a justificativa para esta solicitação..."
                                {...field}
                                disabled={request}
                                rows={2}
                                className="text-xs min-h-[40px] md:min-h-[50px]"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-1 md:mt-2">
                      <FormField
                        control={form.control}
                        name="additionalInfo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Informações Adicionais</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Informações complementares (opcional)..."
                                {...field}
                                disabled={request}
                                rows={2}
                                className="text-xs min-h-[30px] md:min-h-[40px]"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Status Information for existing requests */}
                {request && (
                  <Card>
                    <CardHeader className="pb-1 md:pb-2 p-2 md:p-3">
                      <CardTitle className="text-xs md:text-sm">Status da Solicitação</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 md:p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 md:gap-2">
                        <div>
                          <p className="text-xs font-medium text-gray-600">Número</p>
                          <p className="text-xs">{request.requestNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">Data</p>
                          <p className="text-xs">
                            {new Date(request.requestDate).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">Fase Atual</p>
                          <Badge variant="outline" className="text-xs h-5">
                            {request.currentPhase}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">Solicitante</p>
                          <p className="text-xs">
                            {request.requester?.firstName} {request.requester?.lastName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">Urgência</p>
                          <Badge
                            variant={
                              request.urgency === URGENCY_LEVELS.ALTA_URGENCIA
                                ? "destructive"
                                : request.urgency === URGENCY_LEVELS.ALTO
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs h-5"
                          >
                            {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">Categoria</p>
                          <p className="text-xs">
                            {CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="items" className="space-y-1 md:space-y-2 mt-1 md:mt-2">
                <Card>
                  <CardHeader className="pb-1 md:pb-2 p-2 md:p-3">
                    <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                      <FileText className="h-3 w-3 md:h-4 md:w-4" />
                      Itens da Solicitação
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {request ? "Visualize os itens desta solicitação" : "Adicione os itens que deseja solicitar"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-2 md:p-3">
                    {!request && (
                      <div className="mb-1 md:mb-2">
                        <HybridProductInput
                          onAddItem={handleAddItem}
                          disabled={isSubmitting}
                        />
                      </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-1 md:space-y-2">
                      {displayItems.map((item, index) => (
                        <Card key={item.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-1">
                                  <h4 className="text-xs font-medium">{item.description}</h4>
                                  {item.productCode && (
                                    <Badge variant="outline" className="text-xs h-4">
                                      {item.productCode}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-2 text-xs text-gray-600">
                                  <div>
                                    <span className="font-medium">Qtd:</span> {item.requestedQuantity}
                                  </div>
                                  <div>
                                    <span className="font-medium">Un:</span> {item.unit}
                                  </div>
                                  {item.estimatedPrice && (
                                    <div>
                                      <span className="font-medium">Preço:</span> R$ {item.estimatedPrice.toFixed(2)}
                                    </div>
                                  )}
                                  {item.estimatedPrice && (
                                    <div>
                                      <span className="font-medium">Total:</span> R$ {(item.estimatedPrice * item.requestedQuantity).toFixed(2)}
                                    </div>
                                  )}
                                </div>

                                {item.technicalSpecification && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-medium">Especificação:</span> {item.technicalSpecification}
                                  </div>
                                )}
                              </div>

                              {!request && (
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditItem(index)}
                                    className="h-5 w-5 p-0"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(index)}
                                    className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {displayItems.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          <FileText className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">
                            {request ? "Nenhum item encontrado" : "Nenhum item adicionado ainda"}
                          </p>
                          {!request && (
                            <p className="text-xs text-gray-400 mt-1">
                              Use o campo acima para adicionar itens à solicitação
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Total Estimated Value */}
                    {displayItems.length > 0 && displayItems.some(item => item.estimatedPrice) && (
                      <div className="mt-1 md:mt-2 pt-1 md:pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium">Valor Total Estimado:</span>
                          <span className="text-sm font-bold text-green-600">
                            R$ {displayItems
                              .reduce((total, item) => total + (item.estimatedPrice || 0) * item.requestedQuantity, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            {!request && (
              <div className="flex flex-col sm:flex-row gap-1 pt-1 md:pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-7 md:h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createRequestMutation.isPending || displayItems.length === 0}
                  className="h-7 md:h-8 text-xs"
                >
                  {createRequestMutation.isPending ? (
                    "Salvando..."
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Criar Solicitação
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
