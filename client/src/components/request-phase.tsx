import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { URGENCY_LEVELS, CATEGORY_OPTIONS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { CloudUpload, FileText, X, Check, AlertTriangle, Edit3, FileSpreadsheet, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import ExcelImporter, { type ExcelItem } from './excel-importer';
import EditableItemsTable, { type EditableItem } from './editable-items-table';

const requestSchema = z.object({
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
  idealDeliveryDate: z.string().optional(),
  availableBudget: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestPhaseProps {
  onClose?: () => void;
  className?: string;
  request?: any;
}

export default function RequestPhase({ onClose, className, request }: RequestPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requestItems, setRequestItems] = useState<EditableItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [itemsMethod, setItemsMethod] = useState<'manual' | 'upload'>('manual');

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  // Buscar itens existentes da solicitação se estiver editando
  const { data: existingItems = [] } = useQuery<EditableItem[]>({
    queryKey: ["/api/purchase-requests", request?.id, "items"],
    enabled: !!request?.id,
  });

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      costCenterId: request?.costCenterId || 0,
      category: request?.category || "",
      urgency: request?.urgency || "",
      justification: request?.justification || "",
      idealDeliveryDate: request?.idealDeliveryDate ? new Date(request.idealDeliveryDate).toISOString().split('T')[0] : "",
      availableBudget: request?.availableBudget?.toString() || "",
      additionalInfo: request?.additionalInfo || "",
    },
  });

  // Carregar itens existentes quando disponíveis (apenas uma vez)
  useEffect(() => {
    if (existingItems.length > 0 && !itemsLoaded) {
      setRequestItems(existingItems);
      setItemsLoaded(true);
    }
  }, [existingItems, itemsLoaded]);

  // Atualizar formulário quando os dados da solicitação mudarem
  useEffect(() => {
    if (request) {
      form.reset({
        costCenterId: request.costCenterId || 0,
        category: request.category || "",
        urgency: request.urgency || "",
        justification: request.justification || "",
        idealDeliveryDate: request.idealDeliveryDate ? new Date(request.idealDeliveryDate).toISOString().split('T')[0] : "",
        availableBudget: request.availableBudget?.toString() || "",
        additionalInfo: request.additionalInfo || "",
      });
    }
  }, [request, form]);

  const saveRequestMutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      const requestData = {
        ...data,
        requesterId: 1, // TODO: Get from auth context
        costCenterId: Number(data.costCenterId),
        availableBudget: data.availableBudget ? parseFloat(data.availableBudget) : undefined,
        idealDeliveryDate: data.idealDeliveryDate || undefined,
        items: requestItems.map(item => ({
          itemNumber: item.description || '',
          description: item.description || '',
          unit: item.unit || '',
          stockQuantity: "0",
          averageMonthlyQuantity: "0",
          requestedQuantity: (item.requestedQuantity ?? 0).toString(),
          approvedQuantity: undefined,
        })),
      };
      
      // Create or update the request with items
      const url = request ? `/api/purchase-requests/${request.id}` : "/api/purchase-requests";
      const method = request ? "PUT" : "POST";
      const response = await apiRequest(method, url, requestData);
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests", request?.id, "items"] });
      toast({
        title: "Sucesso",
        description: request ? "Solicitação atualizada com sucesso!" : "Solicitação criada com sucesso!",
      });
      form.reset();
      setRequestItems([]);
      setItemsLoaded(false);
      setUploadProgress(0);
      onClose?.();
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao criar solicitação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RequestFormData) => {
    if (requestItems.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "É necessário adicionar pelo menos um item à solicitação",
        variant: "destructive",
      });
      return;
    }
    saveRequestMutation.mutate(data);
  };

  const handleExcelImport = (items: ExcelItem[]) => {
    const convertedItems: EditableItem[] = items.map((item, index) => ({
      id: Date.now() + index, // Temporary ID
      description: item.description,
      unit: item.unit,
      requestedQuantity: item.requestedQuantity,
    }));
    
    setRequestItems(convertedItems);
    toast({
      title: "Sucesso",
      description: `${items.length} itens importados com sucesso!`,
    });
  };

  const isFormValid = form.formState.isValid && requestItems.length > 0;

  return (
    <Card className={cn("w-full max-w-4xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {request ? 'Editar Solicitação de Compra' : 'Nova Solicitação de Compra'}
          </div>
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Required Fields Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Campos Obrigatórios
              </h3>
              
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
                          disabled={costCentersLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o centro de custo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {costCenters && (costCenters as any[]).map((center: any) => (
                              <SelectItem key={center.id} value={center.id.toString()}>
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_OPTIONS).map(([key, value]) => (
                              <SelectItem key={value} value={value}>
                                {CATEGORY_LABELS[value]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grau de Urgência *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o grau de urgência..." />
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
                    <FormMessage />
                  </FormItem>
                )}
              />



              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={4}
                        placeholder="Descreva detalhadamente a necessidade e justificativa para esta compra..."
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Optional Fields Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Informações Adicionais</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="idealDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo Ideal de Entrega</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="availableBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orçamento Disponível</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                          <Input 
                            {...field} 
                            placeholder="0,00" 
                            className="pl-10"
                            type="number"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mais Informações</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={3}
                        placeholder="Informações adicionais relevantes para a compra..."
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Items Management Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Itens da Solicitação</CardTitle>
                <CardDescription>
                  Escolha como deseja gerenciar os itens: cadastro manual ou upload de planilha
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={itemsMethod} onValueChange={(value) => setItemsMethod(value as 'manual' | 'upload')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Cadastro Manual
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Upload de Planilha
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-4">
                    <EditableItemsTable 
                      items={requestItems} 
                      onChange={setRequestItems}
                    />
                  </TabsContent>
                  
                  <TabsContent value="upload" className="space-y-4">
                    <ExcelImporter onImport={handleExcelImport} />
                    
                    {requestItems.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Itens Importados</h4>
                        <EditableItemsTable 
                          items={requestItems} 
                          onChange={setRequestItems}
                          readonly={false}
                        />
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
                    disabled={saveRequestMutation.isPending}
                  >
                    Cancelar
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={saveRequestMutation.isPending || !isFormValid}
                  className="min-w-[140px]"
                >
                  {saveRequestMutation.isPending || isUploading ? (
                    "Processando..."
                  ) : (
                    request ? "Salvar Alterações" : "Criar Solicitação"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}