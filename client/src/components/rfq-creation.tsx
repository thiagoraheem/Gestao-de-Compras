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
  Clock,
  UserPlus
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
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
// supplier-creation-modal removido; cadastro será feito na página de fornecedores
import { SupplierSelector } from "./supplier-selector";
import { UnitSelect } from "./unit-select";
import { useUnits } from "@/hooks/useUnits";
import debug from "@/lib/debug";

const quotationItemSchema = z.object({
  itemCode: z.string().optional(),
  description: z.string().min(1, "Descrição é obrigatória"),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  unit: z.string().min(1, "Unidade é obrigatória"),
  specifications: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  purchaseRequestItemId: z.number().optional(),
});

const rfqCreationSchema = z.object({
  purchaseRequestId: z.number(),
  quotationDeadline: z.string(),
  deliveryLocationId: z.number().min(1, "Selecione um local de entrega"),
  termsAndConditions: z.string().optional(),
  technicalSpecs: z.string().optional(),
  selectedSuppliers: z.array(z.number()).min(1, "Selecione pelo menos um fornecedor"),
  items: z.array(quotationItemSchema).min(1, "Adicione pelo menos um item"),
});

type RFQCreationData = z.infer<typeof rfqCreationSchema>;

interface RFQCreationProps {
  purchaseRequest: any;
  existingQuotation?: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export default function RFQCreation({ purchaseRequest, existingQuotation, isOpen, onOpenChange, onComplete }: RFQCreationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { processERPUnit } = useUnits();
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  // Removido estado de modal de fornecedor

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    enabled: !!isOpen,
  });

  const { data: deliveryLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/delivery-locations"],
    enabled: !!isOpen,
  });

  // Fetch existing purchase request items
  const { data: purchaseRequestItems = [], isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${purchaseRequest?.id}/items`],
    enabled: !!isOpen && !!purchaseRequest?.id,
  });

  // Fetch complete purchase request data with requester info
  const { data: completeRequestData, isLoading: requestLoading } = useQuery<any>({
    queryKey: [`/api/purchase-requests/${purchaseRequest?.id}`],
    enabled: !!isOpen && !!purchaseRequest?.id,
  });

  // Fetch existing quotation items if editing
  const { data: existingQuotationItems = [], isLoading: quotationItemsLoading } = useQuery<any[]>({
    queryKey: [`/api/quotations/${existingQuotation?.id}/items`],
    enabled: !!isOpen && !!existingQuotation?.id,
  });

  // Fetch existing supplier quotations if editing
  const { data: existingSupplierQuotations = [], isLoading: supplierQuotationsLoading } = useQuery<any[]>({
    queryKey: [`/api/quotations/${existingQuotation?.id}/supplier-quotations`],
    enabled: !!isOpen && !!existingQuotation?.id,
  });

  const form = useForm<RFQCreationData>({
    resolver: zodResolver(rfqCreationSchema),
    defaultValues: {
      purchaseRequestId: purchaseRequest?.id ?? 0,
      quotationDeadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      deliveryLocationId: 0,
      selectedSuppliers: [],
      items: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Check if we have all the data we need
  const isLoadingData = existingQuotation 
    ? quotationItemsLoading || supplierQuotationsLoading
    : itemsLoading || requestLoading;

  // Set form items when all data is loaded
  useEffect(() => {
    if (isLoadingData) return;

    if (existingQuotation) {
      const targetLen = existingQuotationItems.length;
      if (fields.length !== targetLen && targetLen > 0) {
        const mappedItems = existingQuotationItems.map(item => ({
          itemCode: item.itemCode || "",
          description: item.description || "",
          quantity: item.quantity?.toString() || "1",
          unit: item.unit || "UN",
          specifications: item.specifications || "",
          deliveryDeadline: item.deliveryDeadline ? format(new Date(item.deliveryDeadline), "yyyy-MM-dd") : format(addDays(new Date(), 15), "yyyy-MM-dd"),
          purchaseRequestItemId: item.purchaseRequestItemId,
        }));
        replace(mappedItems);
      }
      return;
    }

    const targetLen = purchaseRequestItems.length;
    if (targetLen > 0) {
      if (fields.length !== targetLen) {
        const mappedItems = purchaseRequestItems.map(item => ({
          itemCode: "",
          description: item.description || "",
          quantity: item.requestedQuantity?.toString() || "1",
          unit: item.unit || "UN",
          specifications: item.technicalSpecification || "",
          deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
          purchaseRequestItemId: item.id,
        }));
        replace(mappedItems);
      }
      return;
    }

    if (fields.length === 0 && targetLen === 0) {
      const defaultItem = {
        itemCode: "",
        description: purchaseRequest?.justification || "",
        quantity: "1",
        unit: "UN",
        specifications: purchaseRequest?.additionalInfo || "",
        deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
      };
      replace([defaultItem]);
    }
  }, [isLoadingData, existingQuotation, existingQuotationItems, purchaseRequestItems, purchaseRequest, fields.length, replace]);

  // Set form values when existing quotation data is loaded
  useEffect(() => {
    if (existingQuotation) {
      form.setValue("quotationDeadline", existingQuotation.quotationDeadline ? format(new Date(existingQuotation.quotationDeadline), "yyyy-MM-dd") : format(addDays(new Date(), 7), "yyyy-MM-dd"));
      form.setValue("termsAndConditions", existingQuotation.termsAndConditions || "");
      form.setValue("technicalSpecs", existingQuotation.technicalSpecs || "");
    } else if (purchaseRequest?.additionalInfo && !form.getValues("technicalSpecs")) {
      // Load technical specs from original request when creating new quotation, only if not already set
      form.setValue("technicalSpecs", purchaseRequest.additionalInfo);
    }
  }, [existingQuotation?.id, purchaseRequest?.additionalInfo]);

  // Set selected suppliers when existing supplier quotations are loaded
  useEffect(() => {
    if (existingSupplierQuotations.length > 0) {
      const selectedSupplierIds = existingSupplierQuotations.map(sq => sq.supplierId);
      form.setValue("selectedSuppliers", selectedSupplierIds);
    }
  }, [existingSupplierQuotations, form]);

  // Set delivery location to first available option when delivery locations are loaded
  useEffect(() => {
    if (deliveryLocations.length > 0 && form.getValues("deliveryLocationId") === 0) {
      form.setValue("deliveryLocationId", deliveryLocations[0].id);
    }
  }, [deliveryLocations, form]);

  // Mutation para criar RFQ e enviar por e-mail
  const createRFQWithEmailMutation = useMutation({
    mutationFn: async (data: RFQCreationData) => {
      // Create quotation
      const quotationResponse = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseRequestId: data.purchaseRequestId,
          quotationDeadline: data.quotationDeadline,
          deliveryLocationId: data.deliveryLocationId,
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

      // Send RFQ to suppliers via email
      const sendRFQResponse = await fetch(`/api/quotations/${quotation.id}/send-rfq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendEmail: true,
          releaseWithoutEmail: false
        }),
      });

      if (!sendRFQResponse.ok) {
        throw new Error('Erro ao enviar e-mails para fornecedores');
      }

      const emailResult = await sendRFQResponse.json();
      if (emailResult.emailResult?.errors?.length > 0) {
        debug.warn('Alguns e-mails não foram enviados:', emailResult.emailResult.errors);
      }

      return { quotation, emailResult };
    },
    onSuccess: (result) => {
      toast({
        title: "RFQ criada e enviada com sucesso",
        description: "A solicitação de cotação foi criada e os e-mails foram enviados aos fornecedores selecionados.",
      });
      // Invalidate all quotation-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      if (purchaseRequest?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/quotations/purchase-request/${purchaseRequest.id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/quotations/purchase-request/${purchaseRequest.id}/status`] });
      }
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          !!(purchaseRequest?.id && query.queryKey[0]?.toString().includes(`/api/quotations/purchase-request/${purchaseRequest.id}`) ||
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`))
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar RFQ",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao criar a solicitação de cotação.",
        variant: "destructive",
      });
      debug.error("Error creating RFQ with email:", error);
    },
  });

  // Mutation para criar RFQ e liberar sem e-mail
  const createRFQWithoutEmailMutation = useMutation({
    mutationFn: async (data: RFQCreationData) => {
      // Create quotation
      const quotationResponse = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseRequestId: data.purchaseRequestId,
          quotationDeadline: data.quotationDeadline,
          deliveryLocationId: data.deliveryLocationId,
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

      // Release RFQ without sending emails
      const releaseRFQResponse = await fetch(`/api/quotations/${quotation.id}/send-rfq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendEmail: false,
          releaseWithoutEmail: true
        }),
      });

      if (!releaseRFQResponse.ok) {
        throw new Error('Erro ao liberar cotação');
      }

      const releaseResult = await releaseRFQResponse.json();
      return { quotation, releaseResult };
    },
    onSuccess: (result) => {
      toast({
        title: "RFQ criada e liberada com sucesso",
        description: "A solicitação de cotação foi criada e liberada para a próxima etapa sem envio de e-mail.",
      });
      // Invalidate all quotation-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      if (purchaseRequest?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/quotations/purchase-request/${purchaseRequest.id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/quotations/purchase-request/${purchaseRequest.id}/status`] });
      }
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          !!(purchaseRequest?.id && query.queryKey[0]?.toString().includes(`/api/quotations/purchase-request/${purchaseRequest.id}`) ||
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`))
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Erro ao liberar RFQ",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao liberar a solicitação de cotação.",
        variant: "destructive",
      });
      debug.error("Error creating RFQ without email:", error);
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



  const onSubmitWithEmail = (data: RFQCreationData) => {
    createRFQWithEmailMutation.mutate(data);
  };

  const onSubmitWithoutEmail = (data: RFQCreationData) => {
    createRFQWithoutEmailMutation.mutate(data);
  };

  const saveDraft = () => {
    // TODO: Implement save as draft functionality
    toast({
      title: "Rascunho salvo",
      description: "A RFQ foi salva como rascunho.",
    });
  };

  // Show loading state while data is being fetched
  if (isLoadingData) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg z-[60]" aria-describedby="rfq-loading-desc">
          <div className="p-6 text-center">
            <DialogTitle className="sr-only">Carregando RFQ</DialogTitle>
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Carregando dados da solicitação...</h3>
            <p className="text-gray-600">Aguarde enquanto os dados são carregados.</p>
            <p id="rfq-loading-desc" className="sr-only">Carregando dados necessários para criar a RFQ</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isOpen || !purchaseRequest) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg z-[60]" aria-describedby="rfq-creation-desc">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">{existingQuotation ? 'Editar' : 'Criar'} Solicitação de Cotação (RFQ)</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </DialogClose>
          </div>
          <p className="text-xs text-slate-500 mt-1">Solicitação: {purchaseRequest?.requestNumber || ""}</p>
        </div>

        <Form {...form}>
          <div className="space-y-6 px-6 pt-0 pb-2">
            {/* Header Information */}
            <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-5 w-5" />
                  Informações da Solicitação
                </CardTitle>
              </CardHeader>
              <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Número da Solicitação</Label>
                  <p className="text-lg font-semibold">{purchaseRequest?.requestNumber || ""}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Solicitante</Label>
                  <p className="text-lg">
                    {completeRequestData?.requester 
                      ? `${completeRequestData.requester.firstName} ${completeRequestData.requester.lastName}`.trim() || completeRequestData.requester.username
                      : completeRequestData?.requesterName 
                      || purchaseRequest?.requesterName 
                      || purchaseRequest?.requesterUsername 
                      || 'Carregando...'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data de Criação</Label>
                  <p className="text-lg">{purchaseRequest?.createdAt ? format(new Date(purchaseRequest.createdAt), "dd/MM/yyyy", { locale: ptBR }) : ""}</p>
                </div>
              </CardContent>
            </Card>

            {/* Quotation Settings */}
            <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-5 w-5" />
                  Configurações da Cotação
                </CardTitle>
              </CardHeader>
              <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            className="h-9 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryLocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local de Entrega *</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value.toString()} 
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione o local de entrega" />
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryLocations
                                .sort((a, b) => a.id - b.id)
                                .map((location) => (
                                  <SelectItem key={location.id} value={location.id.toString()}>
                                    {location.name}
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
            <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
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
              <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
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
                              className="h-9 text-sm"
                              autoComplete="off"
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
                                <UnitSelect
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  className="h-9"
                                />
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
                                  className="h-9 text-sm"
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
                                className="text-sm"
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
                                className="text-sm"
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
            <Card className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Seleção de Fornecedores
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      window.open('/suppliers?new=1', '_blank');
                    }}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Novo Fornecedor
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4">
                <FormField
                  control={form.control}
                  name="selectedSuppliers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedores para Cotação</FormLabel>
                      <SupplierSelector
                        suppliers={suppliers}
                        selectedSuppliers={field.value}
                        onSelectionChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>



            {/* Rodapé */}
            <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 -mx-6 px-6 py-3">
              <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Rascunho
              </Button>
              <Button 
                type="button"
                onClick={form.handleSubmit(onSubmitWithoutEmail)}
                disabled={createRFQWithoutEmailMutation.isPending || createRFQWithEmailMutation.isPending}
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                {createRFQWithoutEmailMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Liberando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Liberar sem E-mail
                  </>
                )}
              </Button>
              <Button 
                type="button"
                onClick={form.handleSubmit(onSubmitWithEmail)}
                disabled={createRFQWithEmailMutation.isPending || createRFQWithoutEmailMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createRFQWithEmailMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Cotação em E-mail
                  </>
                )}
              </Button>
              </div>
            </div>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
