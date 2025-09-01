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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Criar Novo Fornecedor
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Fornecedor *</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Tradicional</SelectItem>
                        <SelectItem value="1">Online</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 0;
                  return (
                    <FormItem>
                      <FormLabel>CNPJ {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0000-00" {...field} />
                      </FormControl>
                      <FormMessage />
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
                      <FormLabel>Pessoa de Contato {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do contato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 0;
                  return (
                    <FormItem>
                      <FormLabel>Email {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
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
                      <FormLabel>Telefone {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => {
                  const supplierType = form.watch("type");
                  const isRequired = supplierType === 1;
                  return (
                    <FormItem>
                      <FormLabel>Site do Fornecedor {isRequired ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://www.exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condições de Pagamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 30 dias" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Endereço completo do fornecedor"
                        rows={3}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50/50">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createSupplierMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto order-1 sm:order-2"
              onClick={form.handleSubmit(onSubmit)}
            >
              {createSupplierMutation.isPending ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Criar Fornecedor
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}