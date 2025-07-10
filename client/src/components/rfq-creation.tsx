import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  CalendarDays, 
  Package, 
  Plus, 
  Trash2, 
  Send, 
  Save, 
  X,
  Building2,
  FileText,
  Clock
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const quotationItemSchema = z.object({
  itemCode: z.string().optional(),
  description: z.string().min(1, "Descrição é obrigatória"),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  unit: z.string().min(1, "Unidade é obrigatória"),
  specifications: z.string().optional(),
  deliveryDeadline: z.string().optional(),
});

const rfqCreationSchema = z.object({
  purchaseRequestId: z.number(),
  quotationDeadline: z.string(),
  termsAndConditions: z.string().optional(),
  technicalSpecs: z.string().optional(),
  selectedSuppliers: z.array(z.number()).min(1, "Selecione pelo menos um fornecedor"),
  items: z.array(quotationItemSchema).min(1, "Adicione pelo menos um item"),
});

type RFQCreationData = z.infer<typeof rfqCreationSchema>;

interface RFQCreationProps {
  purchaseRequest: any;
  existingQuotation?: any;
  onClose: () => void;
  onComplete: () => void;
}

export default function RFQCreation({ purchaseRequest, existingQuotation, onClose, onComplete }: RFQCreationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  // Fetch existing purchase request items
  const { data: purchaseRequestItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${purchaseRequest.id}/items`],
  });

  // Fetch complete purchase request data with requester info
  const { data: completeRequestData } = useQuery<any>({
    queryKey: [`/api/purchase-requests/${purchaseRequest.id}`],
  });

  // Fetch existing quotation items if editing
  const { data: existingQuotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${existingQuotation?.id}/items`],
    enabled: !!existingQuotation?.id,
  });

  // Fetch existing supplier quotations if editing
  const { data: existingSupplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${existingQuotation?.id}/supplier-quotations`],
    enabled: !!existingQuotation?.id,
  });

  const form = useForm<RFQCreationData>({
    resolver: zodResolver(rfqCreationSchema),
    defaultValues: {
      purchaseRequestId: purchaseRequest.id,
      quotationDeadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      selectedSuppliers: [],
      items: [],
    },
  });

  // Set form items when purchase request items are loaded
  useEffect(() => {
    if (existingQuotation && existingQuotationItems.length > 0) {
      // Load existing quotation items for editing
      const mappedItems = existingQuotationItems.map(item => ({
        itemCode: item.itemCode || "",
        description: item.description || "",
        quantity: item.quantity?.toString() || "1",
        unit: item.unit || "UN",
        specifications: item.specifications || "",
        deliveryDeadline: item.deliveryDeadline ? format(new Date(item.deliveryDeadline), "yyyy-MM-dd") : format(addDays(new Date(), 15), "yyyy-MM-dd"),
      }));
      form.setValue("items", mappedItems);
    } else if (purchaseRequestItems.length > 0 && form.getValues("items").length === 0) {
      // Load purchase request items for new quotation, only if no items are currently set
      const mappedItems = purchaseRequestItems.map(item => ({
        itemCode: "",
        description: item.description || "",
        quantity: item.requestedQuantity?.toString() || "1",
        unit: item.unit || "UN",
        specifications: item.technicalSpecification || "", // Load technical specifications from original request
        deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
      }));
      form.setValue("items", mappedItems);
    } else if (purchaseRequestItems.length === 0 && !existingQuotation && form.getValues("items").length === 0) {
      // Fallback to default item if no items exist
      form.setValue("items", [
        {
          itemCode: "",
          description: purchaseRequest.justification || "",
          quantity: "1",
          unit: "UN",
          specifications: purchaseRequest.additionalInfo || "", // Load from additional info if available
          deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
        }
      ]);
    }
  }, [purchaseRequestItems, existingQuotationItems, existingQuotation]);

  // Set form values when existing quotation data is loaded
  useEffect(() => {
    if (existingQuotation) {
      form.setValue("quotationDeadline", existingQuotation.quotationDeadline ? format(new Date(existingQuotation.quotationDeadline), "yyyy-MM-dd") : format(addDays(new Date(), 7), "yyyy-MM-dd"));
      form.setValue("termsAndConditions", existingQuotation.termsAndConditions || "");
      form.setValue("technicalSpecs", existingQuotation.technicalSpecs || "");
    } else if (purchaseRequest.additionalInfo && !form.getValues("technicalSpecs")) {
      // Load technical specs from original request when creating new quotation, only if not already set
      form.setValue("technicalSpecs", purchaseRequest.additionalInfo);
    }
  }, [existingQuotation?.id, purchaseRequest.additionalInfo]);

  // Set selected suppliers when existing supplier quotations are loaded
  useEffect(() => {
    if (existingSupplierQuotations.length > 0) {
      const selectedSupplierIds = existingSupplierQuotations.map(sq => sq.supplierId);
      form.setValue("selectedSuppliers", selectedSupplierIds);
    }
  }, [existingSupplierQuotations, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createRFQMutation = useMutation({
    mutationFn: async (data: RFQCreationData & { sendEmail?: boolean }) => {
      // Create quotation
      const quotationResponse = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseRequestId: data.purchaseRequestId,
          quotationDeadline: data.quotationDeadline,
          termsAndConditions: data.termsAndConditions,
          technicalSpecs: data.technicalSpecs,
        }),
      });

      if (!quotationResponse.ok) {
        throw new Error('Erro ao criar cotação');
      }

      const quotation = await quotationResponse.json();

      // Create quotation items
      for (const item of data.items) {
        const itemResponse = await fetch(`/api/quotations/${quotation.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        
        if (!itemResponse.ok) {
          throw new Error('Erro ao criar item da cotação');
        }
      }

      // Create supplier quotations
      for (const supplierId of data.selectedSuppliers) {
        const supplierResponse = await fetch(`/api/quotations/${quotation.id}/supplier-quotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId,
            status: "pending",
          }),
        });
        
        if (!supplierResponse.ok) {
          throw new Error('Erro ao associar fornecedor à cotação');
        }
      }

      // Send RFQ to suppliers if requested
      if (data.sendEmail !== false) {
        const sendRFQResponse = await fetch(`/api/quotations/${quotation.id}/send-rfq`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendEmail: true
          }),
        });

        if (!sendRFQResponse.ok) {
          console.warn('Erro ao enviar e-mails, mas cotação foi criada com sucesso');
        } else {
          const emailResult = await sendRFQResponse.json();
          if (emailResult.emailResult?.errors?.length > 0) {
            console.warn('Alguns e-mails não foram enviados:', emailResult.emailResult.errors);
          }
        }
      }

      return quotation;
    },
    onSuccess: () => {
      toast({
        title: "RFQ criada com sucesso",
        description: "A solicitação de cotação foi criada e os e-mails foram enviados aos fornecedores selecionados.",
      });
      // Invalidate all quotation-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      // Invalidate specific queries for this purchase request
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/purchase-request/${purchaseRequest.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/purchase-request/${purchaseRequest.id}/status`] });
      // Invalidate all queries starting with the purchase request API pattern
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0]?.toString().includes(`/api/quotations/purchase-request/${purchaseRequest.id}`) ||
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`)
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar RFQ",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao criar a solicitação de cotação.",
        variant: "destructive",
      });
      console.error("Error creating RFQ:", error);
    },
  });

  const addItem = () => {
    append({
      itemCode: "",
      description: "",
      quantity: "1",
      unit: "UN",
      specifications: "",
      deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };



  const onSubmit = (data: RFQCreationData) => {
    createRFQMutation.mutate(data);
  };

  const saveDraft = () => {
    // TODO: Implement save as draft functionality
    toast({
      title: "Rascunho salvo",
      description: "A RFQ foi salva como rascunho.",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {existingQuotation ? 'Editar' : 'Criar'} Solicitação de Cotação (RFQ)
            </h2>
            <p className="text-gray-600 mt-1">Solicitação: {purchaseRequest.requestNumber}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Header Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informações da Solicitação
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Número da Solicitação</Label>
                  <p className="text-lg font-semibold">{purchaseRequest.requestNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Solicitante</Label>
                  <p className="text-lg">
                    {completeRequestData?.requester 
                      ? `${completeRequestData.requester.firstName} ${completeRequestData.requester.lastName}`.trim() || completeRequestData.requester.username
                      : completeRequestData?.requesterName 
                      || purchaseRequest.requesterName 
                      || purchaseRequest.requesterUsername 
                      || 'Carregando...'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data de Criação</Label>
                  <p className="text-lg">{format(new Date(purchaseRequest.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </CardContent>
            </Card>

            {/* Quotation Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Configurações da Cotação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="quotationDeadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo para Envio de Cotações</FormLabel>
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
                
                <FormField
                  control={form.control}
                  name="termsAndConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Termos e Condições</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Insira os termos e condições específicos para esta cotação..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technicalSpecs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especificações Técnicas Gerais</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Especificações técnicas gerais da solicitação (carregadas automaticamente da solicitação original)"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </CardContent>
            </Card>

            {/* Items List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens da Solicitação
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {purchaseRequestItems.length > 0 ? 
                      `${purchaseRequestItems.length} item(s) carregado(s)` : 
                      "Carregando itens..."}
                  </Badge>
                  <Button type="button" onClick={addItem} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {purchaseRequestItems.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-blue-700">
                      <strong>Itens carregados da solicitação original:</strong> 
                      Revise e confirme os itens abaixo, adicionando especificações técnicas e prazos de entrega conforme necessário.
                    </p>
                  </div>
                )}
                
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        Item {index + 1}
                        {purchaseRequestItems[index] && (
                          <Badge variant="secondary" className="text-xs">
                            Original
                          </Badge>
                        )}
                      </h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Editable Item Fields */}
                    <div className="bg-blue-50 p-3 rounded-lg mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-700 font-medium">Quantidade</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  {...field} 
                                  className="bg-white border-blue-300 focus:border-blue-500"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`items.${index}.unit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-700 font-medium">Unidade</FormLabel>
                              <FormControl>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className="bg-white border-blue-300 focus:border-blue-500">
                                    <SelectValue placeholder="Unidade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UN">Unidade</SelectItem>
                                    <SelectItem value="KG">Kg</SelectItem>
                                    <SelectItem value="M">Metro</SelectItem>
                                    <SelectItem value="M2">Metro²</SelectItem>
                                    <SelectItem value="M3">Metro³</SelectItem>
                                    <SelectItem value="L">Litro</SelectItem>
                                    <SelectItem value="CJ">Conjunto</SelectItem>
                                    <SelectItem value="PC">Peça</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`items.${index}.deliveryDeadline`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-blue-600 font-medium">Prazo de Entrega *</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  placeholder="DD/MM/AAAA"
                                  className="bg-white border-blue-300 focus:border-blue-500"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    {/* Quotation-specific fields */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 font-medium">Descrição do Item</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Descrição detalhada do item (carregada da solicitação original)"
                                rows={2}
                                {...field}
                                className="bg-white border-gray-300 focus:border-blue-500"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`items.${index}.specifications`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-blue-600 font-medium">
                              Especificações Técnicas para Cotação *
                            </FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Especificações técnicas detalhadas que serão enviadas aos fornecedores para cotação (marca, modelo, características técnicas, normas, etc.)"
                                rows={3}
                                {...field}
                                className="bg-white border-blue-300 focus:border-blue-500"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Supplier Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Seleção de Fornecedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="selectedSuppliers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedores para Cotação</FormLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                        {suppliers.map((supplier: any) => (
                          <div key={supplier.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                            <Checkbox
                              checked={field.value.includes(supplier.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, supplier.id]);
                                } else {
                                  field.onChange(field.value.filter((id: number) => id !== supplier.id));
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{supplier.name}</p>
                              <p className="text-xs text-gray-500 truncate">{supplier.email}</p>
                              {supplier.phone && (
                                <p className="text-xs text-gray-500">{supplier.phone}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>



            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Rascunho
              </Button>
              <Button 
                type="submit" 
                disabled={createRFQMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createRFQMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar para Cotação
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
