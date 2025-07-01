import { useState } from "react";
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
  Upload, 
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const quotationItemSchema = z.object({
  itemCode: z.string().min(1, "Código do item é obrigatório"),
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
  onClose: () => void;
  onComplete: () => void;
}

export default function RFQCreation({ purchaseRequest, onClose, onComplete }: RFQCreationProps) {
  const [attachments, setAttachments] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const form = useForm<RFQCreationData>({
    resolver: zodResolver(rfqCreationSchema),
    defaultValues: {
      purchaseRequestId: purchaseRequest.id,
      quotationDeadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      selectedSuppliers: [],
      items: [
        {
          itemCode: "",
          description: purchaseRequest.justification || "",
          quantity: "1",
          unit: "un",
          specifications: "",
          deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createRFQMutation = useMutation({
    mutationFn: async (data: RFQCreationData) => {
      // Create quotation
      const quotationResponse = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseRequestId: data.purchaseRequestId,
          quotationDeadline: data.quotationDeadline,
          termsAndConditions: data.termsAndConditions,
          technicalSpecs: data.technicalSpecs,
          createdBy: 1, // TODO: Get from auth context
        }),
      });

      const quotation = await quotationResponse.json();

      // Create quotation items
      for (const item of data.items) {
        await fetch(`/api/quotations/${quotation.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
      }

      // Create supplier quotations
      for (const supplierId of data.selectedSuppliers) {
        await fetch(`/api/quotations/${quotation.id}/supplier-quotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId,
            status: "pending",
          }),
        });
      }

      return quotation;
    },
    onSuccess: () => {
      toast({
        title: "RFQ criada com sucesso",
        description: "A solicitação de cotação foi enviada aos fornecedores selecionados.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar RFQ",
        description: "Ocorreu um erro ao criar a solicitação de cotação.",
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
      unit: "un",
      specifications: "",
      deliveryDeadline: format(addDays(new Date(), 15), "yyyy-MM-dd"),
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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
            <h2 className="text-2xl font-bold text-gray-900">Criar Solicitação de Cotação (RFQ)</h2>
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
                  <p className="text-lg">{purchaseRequest.requesterName}</p>
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
                        <Input type="date" {...field} />
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
                      <FormLabel>Especificações Técnicas Detalhadas</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Especificações técnicas detalhadas dos itens..."
                          rows={4}
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
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Item {index + 1}</h4>
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.itemCode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código do Item</FormLabel>
                            <FormControl>
                              <Input placeholder="EX: ITM-001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantidade</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} />
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
                            <FormLabel>Unidade</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="un">Unidade</SelectItem>
                                  <SelectItem value="kg">Kg</SelectItem>
                                  <SelectItem value="m">Metro</SelectItem>
                                  <SelectItem value="m2">Metro²</SelectItem>
                                  <SelectItem value="m3">Metro³</SelectItem>
                                  <SelectItem value="l">Litro</SelectItem>
                                  <SelectItem value="cj">Conjunto</SelectItem>
                                  <SelectItem value="pc">Peça</SelectItem>
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
                            <FormLabel>Prazo de Entrega</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Descrição detalhada do item"
                              rows={2}
                              {...field}
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
                          <FormLabel>Especificações Técnicas</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Especificações técnicas específicas deste item"
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Anexos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Documentos de Referência</Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <Label htmlFor="file-upload" className="cursor-pointer text-blue-600 hover:text-blue-500">
                      Clique para selecionar arquivos
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOC, XLS, PNG, JPG até 10MB cada
                    </p>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Arquivos Selecionados</Label>
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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