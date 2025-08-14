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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { URGENCY_LEVELS, CATEGORY_OPTIONS, URGENCY_LABELS, CATEGORY_LABELS, PURCHASE_PHASES, PHASE_LABELS, PurchasePhase } from "@/lib/types";
import { CloudUpload, Save } from "lucide-react";

interface EditRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: any;
  phase: PurchasePhase;
}

// Define all possible fields in a single schema
const editSchema = z.object({
  companyId: z.number().optional(),
  justification: z.string().min(1, "Justificativa é obrigatória"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  idealDeliveryDate: z.string().optional(),
  availableBudget: z.string().optional(),
  additionalInfo: z.string().optional(),
  // Phase-specific fields
  approvedA1: z.boolean().optional(),
  rejectionReasonA1: z.string().optional(),
  totalValue: z.string().optional(),
  paymentMethodId: z.string().optional(),
  chosenSupplierId: z.string().optional(),
  choiceReason: z.string().optional(),
  negotiatedValue: z.string().optional(),
  discountsObtained: z.string().optional(),
  deliveryDate: z.string().optional(),
  purchaseObservations: z.string().optional(),
  receivedById: z.string().optional(),
});

export default function EditRequestModal({ open, onOpenChange, request, phase }: EditRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(request?.companyId || user?.companyId || null);

  const { data: companies } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: !!user, // Load companies for all authenticated users
  });

  const { data: costCenters } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  const { data: suppliers } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ["/api/payment-methods"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  type EditFormData = z.infer<typeof editSchema>;

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      companyId: request?.companyId || user?.companyId || 0,
      justification: request?.justification || "",
      category: request?.category || "",
      urgency: request?.urgency || "",
      idealDeliveryDate: request?.idealDeliveryDate ? new Date(request.idealDeliveryDate).toISOString().split('T')[0] : "",
      availableBudget: request?.availableBudget?.toString() || "",
      additionalInfo: request?.additionalInfo || "",
      // Phase-specific defaults
      approvedA1: request?.approvedA1 || false,
      rejectionReasonA1: request?.rejectionReasonA1 || "",
      totalValue: request?.totalValue?.toString() || "",
      paymentMethodId: request?.paymentMethodId?.toString() || "",
      chosenSupplierId: request?.chosenSupplierId?.toString() || "",
      choiceReason: request?.choiceReason || "",
      negotiatedValue: request?.negotiatedValue?.toString() || "",
      discountsObtained: request?.discountsObtained?.toString() || "",
      deliveryDate: request?.deliveryDate ? new Date(request.deliveryDate).toISOString().split('T')[0] : "",
      purchaseObservations: request?.purchaseObservations || "",
      receivedById: request?.receivedById?.toString() || "",
    } as EditFormData,
  });

  const updateRequestMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const updateData = {
        ...data,
        companyId: Number(data.companyId),
        // Manter como strings para o schema
        availableBudget: data.availableBudget || undefined,
        totalValue: data.totalValue || undefined,
        negotiatedValue: data.negotiatedValue || undefined,
        discountsObtained: data.discountsObtained || undefined,
        paymentMethodId: data.paymentMethodId || undefined,
        chosenSupplierId: data.chosenSupplierId || undefined,
        receivedById: data.receivedById || undefined,
        idealDeliveryDate: data.idealDeliveryDate || undefined,
        deliveryDate: data.deliveryDate || undefined,
      };
      await apiRequest(`/api/purchase-requests/${request.id}`, {
          method: "PUT",
          body: updateData,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação atualizada com sucesso!",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar solicitação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditFormData) => {
    updateRequestMutation.mutate(data);
  };

  const renderPhaseSpecificFields = () => {
    switch (phase) {
      case PURCHASE_PHASES.APROVACAO_A1:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="approvedA1"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Aprovado</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Marque para aprovar esta solicitação
                    </p>
                  </div>
                </FormItem>
              )}
            />
            {!form.watch("approvedA1") && (
              <FormField
                control={form.control}
                name="rejectionReasonA1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo da Rejeição</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        );

      case PURCHASE_PHASES.COTACAO:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="totalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Total da Compra</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">R$</span>
                      <Input 
                        {...field} 
                        placeholder="0,00" 
                        className="pl-10"
                        type="number"
                        step="0.01"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pagamento</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods && (paymentMethods as any[]).map((method: any) => (
                          <SelectItem key={method.id} value={method.id.toString()}>
                            {method.name}
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
        );

      case PURCHASE_PHASES.APROVACAO_A2:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="chosenSupplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor Escolhido</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers && (suppliers as any[]).map((supplier: any) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.name}
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
              name="choiceReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo da Escolha</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="melhor_preco">Melhor Preço</SelectItem>
                        <SelectItem value="melhor_relacionamento">Melhor Relacionamento</SelectItem>
                        <SelectItem value="melhor_prazo">Melhor Prazo</SelectItem>
                        <SelectItem value="melhor_qualidade">Melhor Qualidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="negotiatedValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Negociado</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">R$</span>
                        <Input 
                          {...field} 
                          placeholder="0,00" 
                          className="pl-10"
                          type="number"
                          step="0.01"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountsObtained"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descontos Obtidos</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">R$</span>
                        <Input 
                          {...field} 
                          placeholder="0,00" 
                          className="pl-10"
                          type="number"
                          step="0.01"
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
              name="deliveryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Entrega</FormLabel>
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
        );

      case PURCHASE_PHASES.PEDIDO_COMPRA:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="purchaseObservations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações do Pedido</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <FormLabel>Upload de Pedido de Compra</FormLabel>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors">
                <div className="space-y-1 text-center">
                  <CloudUpload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80">
                      <span>Clique para fazer upload</span>
                      <Input type="file" className="sr-only" accept=".pdf,.doc,.docx" />
                    </label>
                    <p className="pl-1">ou arraste e solte</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX até 10MB</p>
                </div>
              </div>
            </div>
          </div>
        );

      case PURCHASE_PHASES.RECEBIMENTO:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="receivedById"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recebido por</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users && (users as any[]).map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.firstName || user.lastName 
                              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                              : user.username
                            }
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
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-request-description">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Editar Solicitação - {request?.requestNumber}</DialogTitle>
            <Badge variant="outline" className="text-sm">
              {PHASE_LABELS[phase]}
            </Badge>
          </div>
        </DialogHeader>
        <p id="edit-request-description" className="sr-only">
          Formulário para editar solicitação de compra com campos específicos da fase atual
        </p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Informações Básicas</h3>
              
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
                            field.onChange(Number(value));
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria de Compra</FormLabel>
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
                
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grau de Urgência</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Informações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Phase-specific fields */}
            {renderPhaseSpecificFields() && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Campos Específicos - {PHASE_LABELS[phase]}
                </h3>
                {renderPhaseSpecificFields()}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateRequestMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateRequestMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}