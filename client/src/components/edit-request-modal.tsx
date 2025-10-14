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
          <div className="space-y-4 md:space-y-3 lg:space-y-3">
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
          <div className="space-y-4 md:space-y-3 lg:space-y-3">
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
                        autoComplete="off"
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
          <div className="space-y-4 md:space-y-3 lg:space-y-3">
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
            <div className="grid grid-cols-2 gap-4 md:gap-3 lg:gap-3">
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
                          autoComplete="off"
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
                          autoComplete="off"
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
              />
          </div>
        );

      case PURCHASE_PHASES.PEDIDO_COMPRA:
        return (
          <div className="space-y-4 md:space-y-3 lg:space-y-3">
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
          <div className="space-y-4 md:space-y-3 lg:space-y-3">
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-3 md:p-4 lg:p-3">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">Editar Solicitação</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 md:space-y-4 lg:space-y-2">
            {/* Informações Básicas */}
            <div className="space-y-2 md:space-y-3 lg:space-y-2">
              <h3 className="text-base font-semibold mb-1">Informações Básicas</h3>
              <div className="grid grid-cols-2 gap-2 md:gap-3 lg:gap-2">
                <FormField
                  control={form.control}
                  name="requesterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Solicitante</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8">
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
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Categoria</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories && (categories as any[]).map((category: any) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} className="text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-2 md:gap-3 lg:gap-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Prioridade</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Data Esperada</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="DD/MM/AAAA"
                          className="h-8"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Phase-specific fields */}
            {renderPhaseSpecificFields() && (
              <div className="space-y-2 md:space-y-3 lg:space-y-2">
                <h3 className="text-base font-medium mb-1">
                  Campos Específicos - {PHASE_LABELS[phase]}
                </h3>
                {renderPhaseSpecificFields()}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 md:pt-3 lg:pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                size="sm"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateRequestMutation.isPending}
                size="sm"
              >
                <Save className="mr-1 h-3 w-3" />
                {updateRequestMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}