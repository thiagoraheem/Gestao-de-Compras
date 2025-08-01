import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminOrBuyerRoute from "@/components/admin-or-buyer-route";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  contact: z.string().min(1, "Contato é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      contact: "",
      email: "",
      phone: "",
      address: "",
      paymentTerms: "",
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (editingSupplier) {
        return await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          body: data,
        });
      } else {
        return await apiRequest("/api/suppliers", {
          method: "POST",
          body: data,
        });
      }
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/suppliers"] });
      
      // Snapshot the previous value
      const previousSuppliers = queryClient.getQueryData(["/api/suppliers"]);
      
      if (!editingSupplier) {
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
      } else {
        // Optimistically update existing supplier
        queryClient.setQueryData(["/api/suppliers"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map(supplier => 
            supplier.id === editingSupplier.id 
              ? { ...supplier, ...data }
              : supplier
          );
        });
      }
      
      return { previousSuppliers };
    },
    onError: (err: any, variables, context) => {
      // Roll back on error
      if (context?.previousSuppliers) {
        queryClient.setQueryData(["/api/suppliers"], context.previousSuppliers);
      }
      
      // Extract error message from API response
      let errorMessage = "Falha ao salvar fornecedor";
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
    onSuccess: () => {
      // Comprehensive cache invalidation for supplier-related data
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      
      // Force immediate refetch for real data
      queryClient.refetchQueries({ queryKey: ["/api/suppliers"] });
      
      handleCloseModal();
      toast({
        title: "Sucesso",
        description: editingSupplier ? "Fornecedor atualizado com sucesso" : "Fornecedor criado com sucesso",
      });
    },
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    form.reset();
  };

  const handleEditSupplier = (supplier: any) => {
    setEditingSupplier(supplier);
    form.reset({
      name: supplier.name || "",
      cnpj: supplier.cnpj || "",
      contact: supplier.contact || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      paymentTerms: supplier.paymentTerms || "",
    });
    setIsModalOpen(true);
  };

  const onSubmit = (data: SupplierFormData) => {
    createSupplierMutation.mutate(data);
  };

  return (
    <AdminOrBuyerRoute>
      <div className="max-w-7xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fornecedores</CardTitle>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Fornecedor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Nenhum fornecedor encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.cnpj}</TableCell>
                      <TableCell>{supplier.contact}</TableCell>
                      <TableCell>{supplier.email}</TableCell>
                      <TableCell>{supplier.phone || "Não informado"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSupplier(supplier)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(11) 99999-9999" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condições de Pagamento</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createSupplierMutation.isPending}>
                  {createSupplierMutation.isPending 
                    ? "Salvando..." 
                    : editingSupplier ? "Atualizar" : "Criar"
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
    </AdminOrBuyerRoute>
  );
}