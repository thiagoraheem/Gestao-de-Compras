import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminOrBuyerRoute from "@/components/admin-or-buyer-route";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.number().default(0),
  cnpj: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
}).refine((data) => {
  if (data.type === 0) {
    // Tipo 0 (Tradicional): CNPJ, Contato, Email e Telefone são obrigatórios
    return data.cnpj && data.contact && data.email && data.phone;
  } else if (data.type === 1) {
    // Tipo 1 (Online): Website é obrigatório
    return data.website;
  }
  return true;
}, {
  message: "Campos obrigatórios não preenchidos para o tipo de fornecedor selecionado",
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    queryFn: () => apiRequest("/api/suppliers"),
  });

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      type: 0,
      cnpj: "",
      contact: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      paymentTerms: "",
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
      type: supplier.type || 0,
      cnpj: supplier.cnpj || "",
      contact: supplier.contact || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      website: supplier.website || "",
      address: supplier.address || "",
      paymentTerms: supplier.paymentTerms || "",
    });
    setIsModalOpen(true);
  };

  // Check for URL parameters to auto-open supplier edit modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editSupplierId = urlParams.get("edit");

    if (editSupplierId && suppliers.length > 0) {
      const supplierToEdit = suppliers.find(
        (supplier: any) => supplier.id === parseInt(editSupplierId)
      );
      
      if (supplierToEdit) {
        handleEditSupplier(supplierToEdit);
        // Clear the URL parameter after opening
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [suppliers]);

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
                  <TableHead>Tipo</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Nenhum fornecedor encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          supplier.type === 1 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {supplier.type === 1 ? 'Online' : 'Tradicional'}
                        </span>
                      </TableCell>
                      <TableCell>{supplier.cnpj || "Não informado"}</TableCell>
                      <TableCell>{supplier.contact || "Não informado"}</TableCell>
                      <TableCell>{supplier.email || "Não informado"}</TableCell>
                      <TableCell>{supplier.phone || "Não informado"}</TableCell>
                      <TableCell>
                        {supplier.website ? (
                          <a 
                            href={supplier.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {supplier.website}
                          </a>
                        ) : (
                          "Não informado"
                        )}
                      </TableCell>
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle>
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Fornecedor *</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ{form.watch("type") === 0 ? " *" : ""}</FormLabel>
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
                    <FormLabel>Contato{form.watch("type") === 0 ? " *" : ""}</FormLabel>
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
                    <FormLabel>Email{form.watch("type") === 0 ? " *" : ""}</FormLabel>
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
                    <FormLabel>Telefone{form.watch("type") === 0 ? " *" : ""}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(11) 99999-9999" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website do Fornecedor{form.watch("type") === 1 ? " *" : ""}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://exemplo.com" />
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
                onClick={handleCloseModal}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createSupplierMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
                onClick={form.handleSubmit(onSubmit)}
              >
                {createSupplierMutation.isPending 
                  ? "Salvando..." 
                  : editingSupplier ? "Atualizar" : "Criar"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </AdminOrBuyerRoute>
  );
}