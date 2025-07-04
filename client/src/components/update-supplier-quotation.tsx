import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DollarSign, FileText, CheckCircle, X } from "lucide-react";

const updateSupplierQuotationSchema = z.object({
  totalValue: z.string().min(1, "Valor total é obrigatório"),
  observations: z.string().optional(),
});

type UpdateSupplierQuotationData = z.infer<typeof updateSupplierQuotationSchema>;

interface UpdateSupplierQuotationProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: number;
  supplierId: number;
  supplierName: string;
  onSuccess?: () => void;
}

export default function UpdateSupplierQuotation({
  isOpen,
  onClose,
  quotationId,
  supplierId,
  supplierName,
  onSuccess
}: UpdateSupplierQuotationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UpdateSupplierQuotationData>({
    resolver: zodResolver(updateSupplierQuotationSchema),
    defaultValues: {
      totalValue: "",
      observations: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateSupplierQuotationData) => {
      // Convert totalValue to number and format properly
      const numericValue = parseFloat(data.totalValue.replace(/[^\d.,]/g, '').replace(',', '.'));
      
      return apiRequest("POST", `/api/quotations/${quotationId}/update-supplier-quotation`, {
        supplierId,
        totalValue: numericValue,
        observations: data.observations || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Cotação do fornecedor atualizada com sucesso!",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/quotations/${quotationId}/supplier-quotations`],
      });
      
      form.reset();
      onClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível atualizar a cotação.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: UpdateSupplierQuotationData) => {
    updateMutation.mutate(data);
  };

  const formatCurrency = (value: string) => {
    // Remove all non-numeric characters except comma and period
    const numericValue = value.replace(/[^\d.,]/g, '');
    
    // Convert to number for formatting
    const number = parseFloat(numericValue.replace(',', '.'));
    if (isNaN(number)) return '';
    
    // Format as Brazilian currency
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Atualizar Cotação - {supplierName}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="totalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Valor Total da Proposta
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: 1.500,00"
                      value={field.value ? `R$ ${formatCurrency(field.value)}` : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace('R$ ', '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Observações (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Condições de pagamento, prazo de entrega, garantias..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {updateMutation.isPending ? (
                  "Atualizando..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Recebimento
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}