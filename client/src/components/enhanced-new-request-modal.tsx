import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
import { Plus, X, Edit3, Edit2, Copy, Trash2, Check } from "lucide-react";
import HybridProductInput from "./hybrid-product-input";
import { useUnits } from "@/hooks/useUnits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MAX_TITLE_LENGTH = 150;
const MIN_ITEM_DESCRIPTION_LENGTH = 10;

const requestSchema = z.object({
  companyId: z.coerce.number().min(1, "Empresa é obrigatória"),
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z
    .string()
    .min(10, "Título deve ter pelo menos 10 caracteres")
    .max(MAX_TITLE_LENGTH, `Título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres`),
  idealDeliveryDate: z.string().optional(),
  availableBudget: z.string().optional(),
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
  const { processERPUnit } = useUnits();
  const [itemsMethod, setItemsMethod] = useState<"manual" | "upload">("manual");
  const [manualItems, setManualItems] = useState<Item[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({
    description: "",
    unit: "UN",
    requestedQuantity: 1,
    technicalSpecification: "",
    productCode: ""
  });
  const [resetTrigger, setResetTrigger] = useState(0);
  const [maintainSearchMode, setMaintainSearchMode] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(user?.companyId || null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const [isTitleFocused, setIsTitleFocused] = useState(false);

  // Removed automatic item creation - users will manually add items as needed

  // Get available companies (now available for all users)
  const { data: companies } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: !!user, // Load companies for all authenticated users
  });

  // Get user's cost center IDs
  const { data: userCostCenterIds, isLoading: isLoadingUserCostCenters, error: userCostCentersError } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "cost-centers"],
    queryFn: () => apiRequest(`/api/users/${user?.id}/cost-centers`),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get all cost centers
  const { data: allCostCenters } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter cost centers based on user's assigned cost centers only (not filtering by company anymore)
  // Managers can see all cost centers, others only their assigned ones
  const costCenters = React.useMemo(() => {
    if (!allCostCenters || !Array.isArray(allCostCenters)) return [];
    
    // If user is a manager, return all cost centers
    if (user?.isManager) {
      return allCostCenters;
    }
    
    // For non-managers, filter by assigned cost centers
    if (!userCostCenterIds || !Array.isArray(userCostCenterIds)) return [];
    return allCostCenters.filter((center: any) => userCostCenterIds.includes(center.id));
  }, [allCostCenters, userCostCenterIds, user?.isManager]);

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

  const selectedCategory = form.watch("category");

  const isServiceOrMaterialCategory =
    selectedCategory === CATEGORY_OPTIONS.SERVICO ||
    selectedCategory === CATEGORY_OPTIONS.MATERIAL ||
    selectedCategory === CATEGORY_OPTIONS.OUTROS;

  const hasInvalidDescriptionChars = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.length < MIN_ITEM_DESCRIPTION_LENGTH) return true;
    if (/[<>]/.test(trimmed)) return true;
    if (/(script|onerror|onload|javascript:)/i.test(trimmed)) return true;
    return false;
  };

  // Set default company to user's company but allow selection for all users
  React.useEffect(() => {
    if (user?.companyId) {
      setSelectedCompanyId(user.companyId);
      form.setValue('companyId', user.companyId);
    }
  }, [user, form]);

  // Monitor manualItems changes to debug state resets (only log significant changes)
  React.useEffect(() => {
    // Debug monitoring removed for production
  }, [manualItems]);

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
      return response;
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
          id: `temp_${Date.now()}`, // Temporary ID - using string to avoid confusion with real IDs
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
    const category = form.getValues("category");

    if (!category) {
      toast({
        title: "Erro",
        description: "Selecione a categoria de compra antes de adicionar itens.",
        variant: "destructive",
      });
      return;
    }

    if (!newItemForm.unit) {
      toast({
        title: "Erro",
        description: "Informe a unidade do item.",
        variant: "destructive",
      });
      return;
    }

    if (category === CATEGORY_OPTIONS.PRODUTO) {
      if (!newItemForm.productCode) {
        toast({
          title: "Produto obrigatório",
          description: "Para a categoria Produto, selecione um item do ERP antes de adicionar.",
          variant: "destructive",
        });
        return;
      }
    } else if (
      category === CATEGORY_OPTIONS.SERVICO ||
      category === CATEGORY_OPTIONS.MATERIAL ||
      category === CATEGORY_OPTIONS.OUTROS
    ) {
      const description = newItemForm.description?.trim() || "";
      if (description.length < MIN_ITEM_DESCRIPTION_LENGTH) {
        toast({
          title: "Descrição obrigatória",
          description: `Para ${CATEGORY_LABELS[category]}, a descrição deve ter pelo menos ${MIN_ITEM_DESCRIPTION_LENGTH} caracteres.`,
          variant: "destructive",
        });
        return;
      }
      if (hasInvalidDescriptionChars(description)) {
        toast({
          title: "Descrição inválida",
          description: "A descrição não pode conter caracteres inválidos ou código potencialmente malicioso.",
          variant: "destructive",
        });
        return;
      }
    } else if (!newItemForm.description || !newItemForm.description.trim()) {
      toast({
        title: "Erro",
        description: "Preencha pelo menos a descrição do item.",
        variant: "destructive",
      });
      return;
    }

    const newItem: Item = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      description: newItemForm.description,
      unit: newItemForm.unit,
      requestedQuantity: newItemForm.requestedQuantity,
      technicalSpecification: newItemForm.technicalSpecification,
      productCode: newItemForm.productCode,
      estimatedPrice: 0,
    };
    setManualItems([...manualItems, newItem]);
    
    // Reset form
    setNewItemForm({
      description: "",
      unit: "UN",
      requestedQuantity: 1,
      technicalSpecification: "",
      productCode: ""
    });
    
    // Trigger reset do HybridProductInput
    setResetTrigger(prev => prev + 1);
    
    // Reset maintainSearchMode para permitir que o usuário saia do modo busca
    setMaintainSearchMode(false);
    
    // Focus back to description field
    setTimeout(() => {
      descriptionInputRef.current?.focus();
    }, 100);
  };

  const removeManualItem = (id: string) => {
    setManualItems((prev) => prev.filter((item) => item.id !== id));
  };

  const cloneManualItem = (id: string) => {
    const itemToClone = manualItems.find((item) => item.id === id);
    if (itemToClone) {
      const clonedItem: Item = {
        ...itemToClone,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      };
      setManualItems((prev) => [...prev, clonedItem]);
    }
  };

  const startEditingItem = (id: string) => {
    setEditingItemId(id);
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
  };

  const saveEditingItem = () => {
    setEditingItemId(null);
  };

  const updateManualItem = (id: string, field: keyof Item, value: any) => {
    setManualItems((prevItems) => {
      const itemToUpdate = prevItems.find(item => item.id === id);
      
      // Only update if the value actually changed
      if (itemToUpdate && itemToUpdate[field] !== value) {
        return prevItems.map((item) =>
          item.id === id ? { ...item, [field]: value } : item,
        );
      }
      
      // Return the same array reference if no change is needed
      return prevItems;
    });
  };

  const handleProductSelect = (itemId: string, product: any) => {
    setManualItems((prevItems) => {
      const updatedItems = prevItems.map((item) => {
        if (item.id === itemId) {
          // Processa a unidade do ERP para garantir que ela existe no sistema
          const processedUnit = product.unidade ? processERPUnit(product.unidade) : item.unit;
          
          const updatedItem = {
            ...item,
            productCode: product.codigo,
            description: product.descricao,
            unit: processedUnit,
          };
          return updatedItem;
        }
        return item;
      });
      return updatedItems;
    });
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

    const category = data.category;

    if (category === CATEGORY_OPTIONS.PRODUTO) {
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
      category === CATEGORY_OPTIONS.SERVICO ||
      category === CATEGORY_OPTIONS.MATERIAL ||
      category === CATEGORY_OPTIONS.OUTROS
    ) {
      const hasInvalidDescription = manualItems.some(
        (item) => hasInvalidDescriptionChars(item.description)
      );

      if (hasInvalidDescription) {
        toast({
          title: "Erro",
          description:
            `Para ${CATEGORY_LABELS[category]}, a descrição dos itens deve ter pelo menos ${MIN_ITEM_DESCRIPTION_LENGTH} caracteres e não pode conter caracteres inválidos.`,
          variant: "destructive",
        });
        return;
      }
    }

    createRequestMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg"
        aria-describedby="new-request-description"
      >
        <div className="flex-shrink-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Nova Solicitação de Compra</DialogTitle>
            <DialogClose asChild>
              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </div>
        <p id="new-request-description" className="sr-only">
          Formulário para criar uma nova solicitação de compra no sistema
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-6 pt-2 pb-0">
            <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
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
                              <SelectTrigger className="h-9">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
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
                          className="text-sm min-h-[48px]"
                          aria-describedby="new-request-title-counter"
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
                          id="new-request-title-counter"
                          aria-live="polite"
                          className={`mt-1 text-xs ${((form.watch("justification") || "").length >= Math.floor(MAX_TITLE_LENGTH * 0.8)) ? "text-red-600" : "text-muted-foreground"}`}
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

            <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">Itens da Solicitação</CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">Adicione os itens necessários. Você pode buscar produtos do ERP ou cadastrar itens avulsos.</CardDescription>
              </CardHeader>
              <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Itens Cadastrados</h4>
                </div>

                {/* Formulário para adicionar novo item */}
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Adicionar Novo Item</h4>
                  <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-12">
                    <div className="sm:col-span-7">
                      {selectedCategory === CATEGORY_OPTIONS.PRODUTO ? (
                        <>
                          <HybridProductInput
                            value={newItemForm.description}
                            onChange={(value) =>
                              setNewItemForm((prev) => ({
                                ...prev,
                                description: value,
                              }))
                            }
                            onProductSelect={(product) => {
                              const processedUnit = processERPUnit(product.unidade);
                              setNewItemForm((prev) => ({
                                ...prev,
                                description: product.descricao,
                                unit: processedUnit,
                                productCode: product.codigo,
                              }));
                              setMaintainSearchMode(true);
                            }}
                            placeholder="Digite para buscar no ERP..."
                            className="h-9 text-sm"
                            resetTrigger={resetTrigger}
                            maintainSearchMode={maintainSearchMode}
                            mode="erp-only"
                          />
                          {newItemForm.productCode && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                ERP: {newItemForm.productCode}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <Input
                          ref={descriptionInputRef}
                          value={newItemForm.description}
                          onChange={(e) =>
                            setNewItemForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          placeholder={
                            isServiceOrMaterialCategory
                              ? "Descreva detalhadamente o item..."
                              : "Informe a descrição do item..."
                          }
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                    <div className="sm:col-span-3">
                      <Select value={newItemForm.unit} onValueChange={(value) => setNewItemForm(prev => ({ ...prev, unit: value }))}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UN">UN - Unidade</SelectItem>
                          <SelectItem value="KG">KG - Quilograma</SelectItem>
                          <SelectItem value="M">M - Metro</SelectItem>
                          <SelectItem value="L">L - Litro</SelectItem>
                          <SelectItem value="Par">Par - Par</SelectItem>
                          <SelectItem value="PCT">PCT - Pacote</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-9 text-sm"
                        min="1"
                        autoComplete="off"
                        value={newItemForm.requestedQuantity}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, requestedQuantity: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-12 mt-2">
                    <Textarea
                      placeholder="Especificação técnica (opcional)"
                      rows={2}
                      className="resize-none text-sm min-h-[64px]"
                      value={newItemForm.technicalSpecification}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, technicalSpecification: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-12 flex justify-end mt-3">
                    <Button
                      type="button"
                      onClick={addManualItem}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </Card>

                {manualItems.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <Edit3 className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-500" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum item cadastrado ainda.</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Use o formulário acima para adicionar itens.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead className="min-w-[250px]">Descrição</TableHead>
                          <TableHead className="w-[80px]">Un.</TableHead>
                          <TableHead className="w-[80px]">Qtd</TableHead>
                          <TableHead className="w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manualItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">
                                   {editingItemId === item.id ? (
                                     <HybridProductInput
                                       value={item.description}
                                       onChange={(value) => updateManualItem(item.id, 'description', value)}
                                       onProductSelect={(product) => handleProductSelect(item.id, product)}
                                       placeholder="Digite a descrição ou busque no ERP..."
                                       className="h-8"
                                     />
                                   ) : (
                                     <div className="flex items-center gap-2">
                                       <span>{item.description}</span>
                                       {item.productCode && (
                                         <Badge variant="secondary" className="text-xs">
                                           ERP: {item.productCode}
                                         </Badge>
                                       )}
                                     </div>
                                   )}
                                 </div>
                                 {(item.technicalSpecification || editingItemId === item.id) && (
                                   <div className="text-xs text-gray-500 truncate max-w-[200px]" title={item.technicalSpecification}>
                                     {editingItemId === item.id ? (
                                       <Textarea
                                         value={item.technicalSpecification || ""}
                                         onChange={(e) => updateManualItem(item.id, 'technicalSpecification', e.target.value)}
                                         className="h-16 text-xs"
                                         rows={2}
                                         placeholder="Especificação técnica (opcional)"
                                       />
                                     ) : (
                                       item.technicalSpecification
                                     )}
                                   </div>
                                 )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {editingItemId === item.id ? (
                                <Select
                                  value={item.unit}
                                  onValueChange={(value) => updateManualItem(item.id, 'unit', value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UN">UN</SelectItem>
                                    <SelectItem value="KG">KG</SelectItem>
                                    <SelectItem value="M">M</SelectItem>
                                    <SelectItem value="L">L</SelectItem>
                                    <SelectItem value="Par">Par - Par</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                item.unit
                              )}
                            </TableCell>
                            <TableCell>
                              {editingItemId === item.id ? (
                                <Input
                                  type="number"
                                  value={item.requestedQuantity}
                                  onChange={(e) => updateManualItem(item.id, 'requestedQuantity', parseInt(e.target.value) || 1)}
                                  className="h-8"
                                  min="1"
                                  autoComplete="off"
                                />
                              ) : (
                                item.requestedQuantity
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {editingItemId === item.id ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                      onClick={saveEditingItem}
                                      title="Salvar alterações"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                                      onClick={cancelEditingItem}
                                      title="Cancelar edição"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => startEditingItem(item.id)}
                                      title="Editar item"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => cloneManualItem(item.id)}
                                      className="h-8 w-8 p-0"
                                      title="Clonar item"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeManualItem(item.id)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Excluir item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
              <div className="flex justify-end items-center space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createRequestMutation.isPending}>
                  {createRequestMutation.isPending ? "Criando..." : "Criar Solicitação"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
