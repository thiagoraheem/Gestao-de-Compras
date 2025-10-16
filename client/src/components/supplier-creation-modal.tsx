import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.number().min(0).max(1),
  cnpj: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
}).refine((data) => {
  // Type 0 (Traditional): CNPJ, Contact, Email, Phone are required
  if (data.type === 0) {
    return data.cnpj && data.contact && data.email && data.phone;
  }
  // Type 1 (Online): Website is required, other fields are optional
  if (data.type === 1) {
    return data.website;
  }
  return true;
}, {
  message: "Para fornecedores tradicionais: CNPJ, Contato, E-mail e Telefone são obrigatórios. Para fornecedores online: Site é obrigatório.",
  path: ["type"],
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (supplier: any) => void;
}

export default function SupplierCreationModal({ isOpen, onClose, onSuccess }: SupplierCreationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      type: 0, // Default to Traditional
      cnpj: "",
      contact: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      paymentTerms: "",
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to create supplier");
      }
      
      return response.json();
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/suppliers"] });
      
      // Snapshot the previous value
      const previousSuppliers = queryClient.getQueryData(["/api/suppliers"]);
      
      // Optimistically add new supplier
      queryClient.setQueryData(["/api/suppliers"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        const optimisticSupplier = {
          id: Date.now(), // Temporary ID
          ...data,
          createdAt: new Date().toISOString()
        };
        return [...old, optimisticSupplier];
      });
      
      return { previousSuppliers };
    },
    onError: (err: any, variables, context) => {
      // Roll back on error
      if (context?.previousSuppliers) {
        queryClient.setQueryData(["/api/suppliers"], context.previousSuppliers);
      }
      
      // Extract error message from API response
      let errorMessage = "Falha ao criar fornecedor";
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: (newSupplier) => {
      // Comprehensive cache invalidation for supplier-related data
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      
      // Force immediate refetch for real data
      queryClient.refetchQueries({ queryKey: ["/api/suppliers"] });
      
      toast({
        title: "Sucesso",
        description: "Fornecedor criado com sucesso",
      });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(newSupplier);
      }
      
      handleClose();
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: SupplierFormData) => {
    createSupplierMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Novo Fornecedor
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Nome do Fornecedor *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da empresa" className="h-8 text-xs" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Tipo de Fornecedor *</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Tradicional</SelectItem>
                      <SelectItem value="1">Online</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 0;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs">CNPJ {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0000-00" className="h-8 text-xs" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 0;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs">Pessoa de Contato {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do contato" className="h-8 text-xs" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 0;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs">Email {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" className="h-8 text-xs" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 0;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs">Telefone {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" className="h-8 text-xs" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  );
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => {
                const supplierType = form.watch("type");
                const isRequired = supplierType === 1;
                return (
                  <FormItem>
                    <FormLabel className="text-xs">Site do Fornecedor {isRequired ? "*" : ""}</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://www.exemplo.com" className="h-8 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                );
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Condições de Pagamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 30 dias" className="h-8 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Endereço</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Endereço completo do fornecedor"
                      className="min-h-[60px] text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createSupplierMutation.isPending}
                className="h-8 text-xs"
              >
                {createSupplierMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-1" />
                    Criar Fornecedor
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