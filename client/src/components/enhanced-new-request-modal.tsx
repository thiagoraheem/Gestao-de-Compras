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
import { Plus, X, Edit3, Edit2, Copy, Trash2, Check, CloudUpload } from "lucide-react";
import HybridProductInput from "./hybrid-product-input";
import { useUnits } from "@/hooks/useUnits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    if (!newItemForm.description || !newItemForm.description.trim() || !newItemForm.unit) {
      toast({
        title: "Erro",
        description: "Preencha pelo menos a descrição e unidade do item.",
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

  // Handler para o botão "Adicionar Item"
  const handleAddItem = () => {
    addManualItem();
  };

  // Handler para o botão "Limpar"
  const handleClearForm = () => {
    setNewItemForm({
      description: "",
      unit: "UN",
      requestedQuantity: 1,
      technicalSpecification: "",
      productCode: ""
    });
    
    // Trigger reset do HybridProductInput
    setResetTrigger(prev => prev + 1);
    
    // Reset maintainSearchMode
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

  // Handler para upload de arquivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Apenas arquivos Excel (.xlsx, .xls) são permitidos",
          variant: "destructive",
        });
        return;
      }
      
      // Validar tamanho do arquivo (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setUploadedFile(file);
      toast({
        title: "Arquivo selecionado",
        description: `${file.name} foi selecionado com sucesso`,
      });
    }
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
          <DialogTitle className="text-sm md:text-base">Nova Solicitação de Compra</DialogTitle>
        </DialogHeader>
        <p id="new-request-description" className="sr-only">
          Formulário para criar uma nova solicitação de compra no sistema
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            {/* Informações Básicas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Company Selection - now available for all users */}
                {companies && companies.length > 0 && (
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Empresa *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(parseInt(value));
                              setSelectedCompanyId(parseInt(value));
                              // Reset cost center when company changes
                              form.setValue("costCenterId", 0);
                            }}
                            value={field.value?.toString()}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {companies.map((company: any) => (
                                <SelectItem key={company.id} value={company.id.toString()}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="costCenterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Centro de Custo *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value?.toString()}
                            disabled={!selectedCompanyId || isLoadingCostCenters}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {costCenters?.map((costCenter: any) => (
                                <SelectItem key={costCenter.id} value={costCenter.id.toString()}>
                                  {costCenter.code} - {costCenter.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
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
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-8 text-xs">
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
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Urgência *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(URGENCY_LEVELS).map(([key, value]) => (
                                <SelectItem key={value} value={value}>
                                  {URGENCY_LABELS[value]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="availableBudget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Orçamento Disponível</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="R$ 0,00"
                            className="h-8 text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

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
                          placeholder="Selecione a data..."
                          className="h-8 text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="justification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Justificativa *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva a justificativa para esta solicitação..."
                          className="min-h-[60px] text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Informações Adicionais</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações complementares..."
                          className="min-h-[60px] text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Itens da Solicitação */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Itens da Solicitação</CardTitle>
                <CardDescription className="text-xs">
                  Adicione os itens que deseja solicitar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Tabs value={itemsMethod} onValueChange={(value) => setItemsMethod(value as "manual" | "upload")}>
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="manual" className="text-xs">Adicionar Manualmente</TabsTrigger>
                    <TabsTrigger value="upload" className="text-xs">Upload de Arquivo</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Adicionar Item</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium">Descrição do Item *</label>
                            <HybridProductInput
                              value={newItemForm.description}
                              onChange={(value) => setNewItemForm(prev => ({ ...prev, description: value }))}
                              onProductSelect={(product) => {
                                setNewItemForm(prev => ({
                                  ...prev,
                                  description: product.description,
                                  productCode: product.code,
                                  unit: processERPUnit(product.unit)
                                }));
                              }}
                              placeholder="Digite ou busque um produto..."
                              className="h-8 text-xs"
                              resetTrigger={resetTrigger}
                              maintainSearchMode={maintainSearchMode}
                              ref={descriptionInputRef}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium">Unidade</label>
                              <Select
                                value={newItemForm.unit}
                                onValueChange={(value) => setNewItemForm(prev => ({ ...prev, unit: value }))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="UN">Unidade</SelectItem>
                                  <SelectItem value="KG">Quilograma</SelectItem>
                                  <SelectItem value="M">Metro</SelectItem>
                                  <SelectItem value="M2">Metro Quadrado</SelectItem>
                                  <SelectItem value="M3">Metro Cúbico</SelectItem>
                                  <SelectItem value="L">Litro</SelectItem>
                                  <SelectItem value="CX">Caixa</SelectItem>
                                  <SelectItem value="PC">Peça</SelectItem>
                                  <SelectItem value="PAR">Par</SelectItem>
                                  <SelectItem value="KIT">Kit</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="text-xs font-medium">Quantidade *</label>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={newItemForm.requestedQuantity}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, requestedQuantity: parseInt(e.target.value) || 1 }))}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium">Especificação Técnica</label>
                            <Input
                              value={newItemForm.technicalSpecification}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, technicalSpecification: e.target.value }))}
                              placeholder="Especificações técnicas..."
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={handleAddItem}
                            disabled={!newItemForm.description.trim()}
                            className="h-8 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Adicionar Item
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleClearForm}
                            className="h-8 text-xs"
                          >
                            Limpar
                          </Button>
                        </div>

                        {/* Lista de Itens */}
                        <div className="space-y-2">
                          {manualItems.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium mb-1">
                                Itens Adicionados ({manualItems.length})
                              </h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Descrição</TableHead>
                                    <TableHead className="text-xs">Unidade</TableHead>
                                    <TableHead className="text-xs">Quantidade</TableHead>
                                    <TableHead className="text-xs">Especificação</TableHead>
                                    <TableHead className="text-xs">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {manualItems.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell className="py-1">
                                        {editingItemId === item.id ? (
                                          <Input
                                            value={newItemForm.description}
                                            onChange={(e) => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="h-6 text-xs"
                                          />
                                        ) : (
                                          <div>
                                            <p className="font-medium text-xs">{item.description}</p>
                                            {item.productCode && (
                                              <p className="text-xs text-gray-500">Código: {item.productCode}</p>
                                            )}
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-1">
                                        {editingItemId === item.id ? (
                                          <Select
                                            value={newItemForm.unit}
                                            onValueChange={(value) => setNewItemForm(prev => ({ ...prev, unit: value }))}
                                          >
                                            <SelectTrigger className="h-6 text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="UN">UN</SelectItem>
                                              <SelectItem value="KG">KG</SelectItem>
                                              <SelectItem value="M">M</SelectItem>
                                              <SelectItem value="M2">M²</SelectItem>
                                              <SelectItem value="M3">M³</SelectItem>
                                              <SelectItem value="L">L</SelectItem>
                                              <SelectItem value="CX">CX</SelectItem>
                                              <SelectItem value="PC">PC</SelectItem>
                                              <SelectItem value="PAR">PAR</SelectItem>
                                              <SelectItem value="KIT">KIT</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <span className="text-xs">{item.unit}</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-1">
                                        {editingItemId === item.id ? (
                                          <Input
                                            type="number"
                                            min="1"
                                            value={newItemForm.requestedQuantity}
                                            onChange={(e) => setNewItemForm(prev => ({ ...prev, requestedQuantity: parseInt(e.target.value) || 1 }))}
                                            className="h-6 text-xs"
                                          />
                                        ) : (
                                          <span className="text-xs">{item.requestedQuantity}</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-1">
                                        {editingItemId === item.id ? (
                                          <Input
                                            value={newItemForm.technicalSpecification}
                                            onChange={(e) => setNewItemForm(prev => ({ ...prev, technicalSpecification: e.target.value }))}
                                            className="h-6 text-xs"
                                          />
                                        ) : (
                                          <span className="text-xs">{item.technicalSpecification || "-"}</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <div className="flex gap-1">
                                          {editingItemId === item.id ? (
                                            <>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={saveEditingItem}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Check className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={cancelEditingItem}
                                                className="h-6 w-6 p-0"
                                              >
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </>
                                          ) : (
                                            <>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => startEditingItem(item.id)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => cloneManualItem(item.id)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Copy className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeManualItem(item.id)}
                                                className="h-6 w-6 p-0"
                                              >
                                                <Trash2 className="w-3 h-3" />
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
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Upload de Planilha</CardTitle>
                        <CardDescription className="text-xs">
                          Faça upload de uma planilha Excel com os itens
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                          <CloudUpload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-xs text-gray-600 mb-2">
                            Arraste e solte sua planilha aqui ou clique para selecionar
                          </p>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                          />
                          <label
                            htmlFor="file-upload"
                            className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Selecionar Arquivo
                          </label>
                          {uploadedFile && (
                            <p className="text-xs text-green-600 mt-2">
                              Arquivo selecionado: {uploadedFile.name}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createRequestMutation.isPending || (itemsMethod === "manual" && manualItems.length === 0)}
                className="h-8 text-xs"
              >
                {createRequestMutation.isPending ? "Criando..." : "Criar Solicitação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
