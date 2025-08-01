import React, { useState } from "react";
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
import { Plus, X, Edit3 } from "lucide-react";
import FileUpload from "./file-upload";
import debug from "@/lib/debug";

const requestSchema = z.object({
  companyId: z.coerce.number().min(1, "Empresa é obrigatória"),
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z
    .string()
    .min(10, "Justificativa deve ter pelo menos 10 caracteres"),
  idealDeliveryDate: z.string().optional(),
  availableBudget: z.string().optional(),
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

interface EnhancedNewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EnhancedNewRequestModal({
  open,
  onOpenChange,
}: EnhancedNewRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [itemsMethod, setItemsMethod] = useState<"manual" | "upload">("manual");
  const [manualItems, setManualItems] = useState<Item[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(user?.companyId || null);

  // Get available companies (now available for all users)
  const { data: companies } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: !!user, // Load companies for all authenticated users
  });

  // Get user's cost center IDs
  const { data: userCostCenterIds, isLoading: isLoadingUserCostCenters, error: userCostCentersError } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "cost-centers"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}/cost-centers`);
      if (!response.ok) {
        throw new Error("Failed to fetch user cost centers");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Debug user cost centers
  debug.log("User Cost Centers Query:", {
    data: userCostCenterIds,
    isLoading: isLoadingUserCostCenters,
    error: userCostCentersError,
    userId: user?.id
  });

  // Get all cost centers
  const { data: allCostCenters } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  // Filter cost centers based on user's assigned cost centers only (not filtering by company anymore)
  const costCenters = allCostCenters?.filter(center => {
    const matchesUser = userCostCenterIds?.includes(center.id);
    return matchesUser;
  }) || [];

  debug.log("Debug - Cost Centers:", {
    allCostCenters: allCostCenters?.length || 0,
    userCostCenterIds: userCostCenterIds?.length || 0,
    filteredCostCenters: costCenters.length,
    userCostCenterIdsArray: userCostCenterIds,
    userId: user?.id
  });

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      companyId: user?.companyId || 0,
      costCenterId: 0,
      category: "",
      urgency: "",
      justification: "",
      idealDeliveryDate: "",
      availableBudget: "",
      additionalInfo: "",
    },
  });

  // Set default company to user's company but allow selection for all users
  React.useEffect(() => {
    if (user?.companyId) {
      setSelectedCompanyId(user.companyId);
      form.setValue('companyId', user.companyId);
    }
  }, [user, form]);

  const createRequestMutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      const requestData = {
        ...data,
        requesterId: user?.id || 1,
        companyId: Number(data.companyId),
        costCenterId: Number(data.costCenterId),
        availableBudget: data.availableBudget
          ? parseFloat(data.availableBudget)
          : undefined,
        idealDeliveryDate: data.idealDeliveryDate || undefined,
        items: itemsMethod === "manual" ? manualItems : undefined,
        attachedFile: uploadedFile,
      };
      const response = await apiRequest("/api/purchase-requests", {
        method: "POST",
        body: requestData,
      });
      return response.json();
    },
    onMutate: async (data) => {
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
          phase: "Solicitação",
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
          items: itemsMethod === "manual" ? manualItems : [],
        };
        return [optimisticRequest, ...old];
      });

      return { previousRequests };
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
        description: "Falha ao criar solicitação",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation and immediate refetch
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });

      // Force immediate refetch for real data
      queryClient.refetchQueries({
        queryKey: ["/api/purchase-requests"],
        type: "active",
      });

      toast({
        title: "Sucesso",
        description: "Solicitação criada com sucesso!",
      });
      form.reset();
      setManualItems([]);
      setUploadedFile(null);
      onOpenChange(false);
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
    // Validação: deve ter itens manuais OU arquivo anexado
    if (itemsMethod === "manual" && manualItems.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item à solicitação",
        variant: "destructive",
      });
      return;
    }

    if (itemsMethod === "upload" && !uploadedFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Anexe uma planilha com os itens da solicitação",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh] overflow-y-auto"
        aria-describedby="new-request-description"
      >
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Compra</DialogTitle>
        </DialogHeader>
        <p id="new-request-description" className="sr-only">
          Formulário para criar uma nova solicitação de compra no sistema
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Company Selection - now available for all users */}
                {companies && companies.length > 0 && (
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedCompanyId(Number(value));
                            }}
                            value={field.value?.toString()}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma empresa..." />
                            </SelectTrigger>
                            <SelectContent>
                              {companies.map((company: any) => (
                                <SelectItem
                                  key={company.id}
                                  value={company.id.toString()}
                                >
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                              {isLoadingUserCostCenters ? (
                                <SelectItem value="loading" disabled>
                                  Carregando centros de custo...
                                </SelectItem>
                              ) : costCenters && costCenters.length > 0 ? (
                                costCenters.map((center: any) => (
                                  <SelectItem
                                    key={center.id}
                                    value={center.id.toString()}
                                  >
                                    {center.code} - {center.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-centers" disabled>
                                  Nenhum centro de custo disponível
                                </SelectItem>
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
                <Tabs
                  value={itemsMethod}
                  onValueChange={(value) => setItemsMethod(value as "manual")}
                >
                  <TabsList className="grid w-full grid-cols-2">
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

            {/* Seção de anexos será adicionada após criar solicitação */}
            {/* Botões */}
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending
                  ? "Criando..."
                  : "Criar Solicitação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
