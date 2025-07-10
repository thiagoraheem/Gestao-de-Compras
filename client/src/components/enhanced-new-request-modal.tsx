import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { URGENCY_LEVELS, CATEGORY_OPTIONS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { CloudUpload, Plus, X, FileSpreadsheet, Edit3 } from "lucide-react";

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

export default function EnhancedNewRequestModal({ open, onOpenChange }: EnhancedNewRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [itemsMethod, setItemsMethod] = useState<'manual' | 'upload'>('manual');
  const [manualItems, setManualItems] = useState<Item[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Get user's cost center IDs
  const { data: userCostCenterIds } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "cost-centers"],
    queryFn: () => fetch(`/api/users/${user?.id}/cost-centers`).then(res => res.json()),
    enabled: !!user?.id,
  });

  // Get all cost centers
  const { data: allCostCenters } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  // Filter cost centers based on user's assigned cost centers
  const costCenters = allCostCenters?.filter(center => 
    userCostCenterIds?.includes(center.id)
  ) || [];

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      costCenterId: 0,
      category: "",
      urgency: "",
      justification: "",
      idealDeliveryDate: "",
      availableBudget: "",
      additionalInfo: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      const requestData = {
        ...data,
        requesterId: user?.id || 1,
        costCenterId: Number(data.costCenterId),
        availableBudget: data.availableBudget ? parseFloat(data.availableBudget) : undefined,
        idealDeliveryDate: data.idealDeliveryDate || undefined,
        items: itemsMethod === 'manual' ? manualItems : undefined,
        attachedFile: uploadedFile,
      };
      await apiRequest("POST", "/api/purchase-requests", requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação criada com sucesso!",
      });
      form.reset();
      setManualItems([]);
      setUploadedFile(null);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar solicitação",
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
    setManualItems(manualItems.filter(item => item.id !== id));
  };

  const updateManualItem = (id: string, field: keyof Item, value: any) => {
    setManualItems(manualItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setUploadedFile(file);
        toast({
          title: "Arquivo anexado",
          description: `Planilha ${file.name} anexada com sucesso!`,
        });
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const onSubmit = (data: RequestFormData) => {
    // Validação: deve ter itens manuais OU arquivo anexado
    if (itemsMethod === 'manual' && manualItems.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item à solicitação",
        variant: "destructive",
      });
      return;
    }
    
    if (itemsMethod === 'upload' && !uploadedFile) {
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="new-request-description">
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
                              <SelectValue placeholder="Selecione..." />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urgência *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
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
                <CardDescription>
                  Escolha como deseja adicionar os itens: cadastro manual ou upload de planilha
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
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Itens Cadastrados</h4>
                      <Button type="button" onClick={addManualItem} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Item
                      </Button>
                    </div>
                    
                    {manualItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Edit3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Nenhum item cadastrado ainda.</p>
                        <p className="text-sm">Clique em "Adicionar Item" para começar.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {manualItems.map((item) => (
                          <Card key={item.id} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                              <div>
                                <label className="text-sm font-medium">Descrição</label>
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateManualItem(item.id, 'description', e.target.value)}
                                  placeholder="Descrição do item"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Unidade</label>
                                <Select 
                                  value={item.unit} 
                                  onValueChange={(value) => updateManualItem(item.id, 'unit', value)}
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
                                <label className="text-sm font-medium">Quantidade</label>
                                <Input
                                  type="number"
                                  value={item.requestedQuantity}
                                  onChange={(e) => updateManualItem(item.id, 'requestedQuantity', parseInt(e.target.value) || 0)}
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
                              <label className="text-sm font-medium">Especificação Técnica</label>
                              <Textarea
                                value={item.technicalSpecification || ''}
                                onChange={(e) => updateManualItem(item.id, 'technicalSpecification', e.target.value)}
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
                  
                  <TabsContent value="upload" className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <CloudUpload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Upload de Planilha Excel</p>
                        <p className="text-xs text-gray-500">
                          Faça upload de uma planilha (.xlsx ou .xls) com os itens da solicitação
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-flex items-center justify-center px-4 py-2 mt-4 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                      >
                        Selecionar Arquivo
                      </label>
                    </div>
                    
                    {uploadedFile && (
                      <Card className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8 text-green-600" />
                            <div>
                              <p className="font-medium">{uploadedFile.name}</p>
                              <p className="text-sm text-gray-500">
                                {(uploadedFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">Anexado</Badge>
                        </div>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending ? "Criando..." : "Criar Solicitação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}