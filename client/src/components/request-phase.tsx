
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
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
import { DateInput } from "@/components/ui/date-input";
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
import HybridProductInput from "./hybrid-product-input";
import { UnitSelect } from "./unit-select";
import { useUnits } from "@/hooks/useUnits";

const MAX_TITLE_LENGTH = 150;
const MIN_ITEM_DESCRIPTION_LENGTH = 10;

const requestSchema = z.object({
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z
    .string()
    .min(10, "Título deve ter pelo menos 10 caracteres")
    .max(MAX_TITLE_LENGTH, `Título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres`),
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: any;
}

export default function RequestPhase({ open, onOpenChange, request }: RequestPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { processERPUnit } = useUnits();
  const [manualItems, setManualItems] = useState<Item[]>([]);
  const [isTitleFocused, setIsTitleFocused] = useState(false);

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

  const selectedCategory = form.watch("category");

  const isServiceOrMaterialCategory =
    selectedCategory === CATEGORY_OPTIONS.SERVICO ||
    selectedCategory === CATEGORY_OPTIONS.MATERIAL;

  const hasInvalidDescriptionChars = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.length < MIN_ITEM_DESCRIPTION_LENGTH) return true;
    if (/[<>]/.test(trimmed)) return true;
    if (/(script|onerror|onload|javascript:)/i.test(trimmed)) return true;
    return false;
  };

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
      onOpenChange(false);
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
      onOpenChange(false);
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

    if (data.category === CATEGORY_OPTIONS.PRODUTO) {
      const invalidItem = manualItems.find((item) => !item.productCode);
      if (invalidItem) {
        toast({
          title: "Produtos obrigatórios",
          description: "Para a categoria Produto, todos os itens devem ser selecionados a partir da busca no ERP.",
          variant: "destructive",
        });
        return;
      }
    }

    if (
      data.category === CATEGORY_OPTIONS.SERVICO ||
      data.category === CATEGORY_OPTIONS.MATERIAL ||
      data.category === CATEGORY_OPTIONS.OUTROS
    ) {
      const invalidItem = manualItems.find((item) =>
        hasInvalidDescriptionChars(item.description || ""),
      );
      if (invalidItem) {
        toast({
          title: "Descrição inválida",
          description:
            `Para ${CATEGORY_LABELS[data.category]}, a descrição dos itens deve ter pelo menos ${MIN_ITEM_DESCRIPTION_LENGTH} caracteres e não pode conter caracteres inválidos.`,
          variant: "destructive",
        });
        return;
      }
    }

    createRequestMutation.mutate(data);
  };

  const isFormValid = form.formState.isValid && manualItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" aria-describedby="request-phase-desc">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {request ? 'Editar Solicitação de Compra' : 'Nova Solicitação de Compra'}
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </DialogClose>
          </div>
        </div>
        <p id="request-phase-desc" className="sr-only">Formulário edição de solicitação de compra</p>

        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pt-0 pb-24">
          {/* Informações Básicas */}
          <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-semibold">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
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
                          <SelectTrigger className="h-9">
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
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CATEGORY_OPTIONS.PRODUTO}>{CATEGORY_LABELS[CATEGORY_OPTIONS.PRODUTO]}</SelectItem>
                            <SelectItem value={CATEGORY_OPTIONS.SERVICO}>{CATEGORY_LABELS[CATEGORY_OPTIONS.SERVICO]}</SelectItem>
                            <SelectItem value={CATEGORY_OPTIONS.MATERIAL}>{CATEGORY_LABELS[CATEGORY_OPTIONS.MATERIAL]}</SelectItem>
                            <SelectItem value={CATEGORY_OPTIONS.OUTROS}>{CATEGORY_LABELS[CATEGORY_OPTIONS.OUTROS]}</SelectItem>
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
                        <SelectTrigger className="h-9">
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
                          className="h-9 text-sm"
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
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        placeholder="Informe um título curto para esta solicitação..."
                        className="text-sm min-h-[64px]"
                        aria-describedby="title-counter"
                        onFocus={() => setIsTitleFocused(true)}
                        onBlur={() => setIsTitleFocused(false)}
                        onChange={(e) => {
                          const v = e.target.value || "";
                          if (v.length <= MAX_TITLE_LENGTH) {
                            field.onChange(v);
                          } else {
                            field.onChange(v.slice(0, MAX_TITLE_LENGTH));
                            toast({
                              title: "Limite atingido",
                              description: `Máximo de ${MAX_TITLE_LENGTH} caracteres permitido`,
                              variant: "destructive",
                            });
                          }
                        }}
                      />
                    </FormControl>
                    {isTitleFocused && (
                      <div
                        id="title-counter"
                        aria-live="polite"
                        className={cn(
                          "mt-1 text-xs",
                          (form.watch("justification") || "").length >= Math.floor(MAX_TITLE_LENGTH * 0.8)
                            ? "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {(form.watch("justification") || "").length}/{MAX_TITLE_LENGTH} · {MAX_TITLE_LENGTH - (form.watch("justification") || "").length} caracteres disponíveis
                      </div>
                    )}
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
                        rows={3}
                        placeholder="Informações complementares sobre a solicitação..."
                        className="text-sm min-h-[64px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Itens da Solicitação */}
          <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-semibold">Itens da Solicitação</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adicione os itens necessários. Você pode buscar produtos do ERP ou cadastrar itens avulsos.
              </CardDescription>
            </CardHeader>
            <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
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
                <div className="space-y-4">
                  {manualItems.map((item, index) => (
                    <Card key={item.id} className="p-6 border-l-4 border-l-blue-500">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium text-lg flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">
                            Item {index + 1}
                          </span>
                        </h5>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeManualItem(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remover
                        </Button>
                      </div>

                      {/* Campos principais em grid responsivo */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <div className="lg:col-span-2">
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Descrição do Item *
                          </label>
                          <HybridProductInput
                            mode={selectedCategory === CATEGORY_OPTIONS.PRODUTO ? "erp-only" : "hybrid"}
                            value={item.description}
                            onChange={(value) =>
                              updateManualItem(item.id, "description", value)
                            }
                            onProductSelect={(product) =>
                              handleProductSelect(item.id, product)
                            }
                            placeholder="Digite a descrição ou busque no ERP..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Unidade *
                            </label>
                        <UnitSelect
                          value={item.unit}
                          onValueChange={(value) =>
                            updateManualItem(item.id, "unit", value)
                          }
                          className="h-9"
                        />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Quantidade *
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
                              className="h-9 text-sm"
                              placeholder="Qtd"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Especificação Técnica */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
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
                          placeholder="Especificações técnicas detalhadas (marca, modelo, características, normas técnicas, etc.)"
                          rows={3}
                          className="resize-none text-sm"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form status (sem ações; ações ficam no rodapé sticky) */}
          <div className="pt-6 border-t">
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
          </div>
        </form>
      </Form>
        <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={createRequestMutation.isPending || sendToApprovalMutation.isPending}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            {request && request.currentPhase === "solicitacao" && (
              <Button 
                type="button"
                variant="default"
                onClick={() => sendToApprovalMutation.mutate()}
                disabled={sendToApprovalMutation.isPending || createRequestMutation.isPending}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
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
              form=""
              disabled={createRequestMutation.isPending || sendToApprovalMutation.isPending || !isFormValid}
              className="w-full sm:w-auto"
              onClick={() => form.handleSubmit(onSubmit)()}
            >
              {createRequestMutation.isPending ? (
                "Processando..."
              ) : (
                request ? "Salvar Alterações" : "Criar Solicitação"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
