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
import { DateInput } from "@/components/ui/date-input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { URGENCY_LEVELS, CATEGORY_OPTIONS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { CloudUpload } from "lucide-react";

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

interface NewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewRequestModal({ open, onOpenChange }: NewRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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

  const onSubmit = (data: RequestFormData) => {
    createRequestMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="new-request-description">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Compra</DialogTitle>
        </DialogHeader>
        <p id="new-request-description" className="sr-only">
          Formulário para criar uma nova solicitação de compra no sistema
        </p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <FormLabel>Grau de Urgência *</FormLabel>
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

            <div>
              <FormLabel>Upload de Planilha (Requisição de Compra) *</FormLabel>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors">
                <div className="space-y-1 text-center">
                  <CloudUpload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80">
                      <span>Clique para fazer upload</span>
                      <Input type="file" className="sr-only" accept=".xlsx,.xls,.csv" />
                    </label>
                    <p className="pl-1">ou arraste e solte</p>
                  </div>
                  <p className="text-xs text-gray-500">XLS, XLSX, CSV até 10MB</p>
                </div>
              </div>
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
                  <FormLabel>Mais Informações</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      rows={2}
                      placeholder="Informações adicionais relevantes..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                disabled={createRequestMutation.isPending}
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
