import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AdminOrBuyerRoute from "@/app/guards/admin-or-buyer-route";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Input } from "@/shared/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Plus, Search, X } from "lucide-react";
import { SupplierIntegrationPanel } from "@/components/supplier-integration-panel";
import { useSuppliers } from "./hooks/useSuppliers";
import { supplierSchema, SupplierFormData } from "./schemas/supplier.schema";
import { SupplierList } from "./components/SupplierList";
import { SupplierFormModal } from "./components/SupplierFormModal";

export function SuppliersManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [showIntegration, setShowIntegration] = useState(false);
  
  const queryClient = useQueryClient();
  const { suppliers, isLoading, createSupplierMutation } = useSuppliers(editingSupplier);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "", type: 0, cnpj: "", cpf: "", contact: "", email: "",
      phone: "", website: "", address: "", paymentTerms: "", idSupplierERP: null,
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
      name: supplier.name || "", type: supplier.type || 0, cnpj: supplier.cnpj || "",
      cpf: supplier.cpf || "", contact: supplier.contact || "", email: supplier.email || "",
      phone: supplier.phone || "", website: supplier.website || "", address: supplier.address || "",
      paymentTerms: supplier.paymentTerms || "", idSupplierERP: supplier.idSupplierERP ?? null,
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editSupplierId = urlParams.get("edit");
    const createNew = urlParams.get("new");

    if (editSupplierId && suppliers.length > 0) {
      const supplierToEdit = suppliers.find((supplier: any) => supplier.id === parseInt(editSupplierId));
      if (supplierToEdit) {
        handleEditSupplier(supplierToEdit);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }

    if (createNew === "1") {
      setEditingSupplier(null);
      form.reset({
        name: "", type: 0, cnpj: "", cpf: "", contact: "", email: "",
        phone: "", website: "", address: "", paymentTerms: "", idSupplierERP: null,
      });
      setIsModalOpen(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [suppliers]);

  const onSubmit = (data: SupplierFormData) => {
    createSupplierMutation.mutate(data, {
      onSuccess: () => {
        handleCloseModal();
      }
    });
  };

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedTerm(searchTerm), 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredSuppliers = useMemo(() => {
    const collator = new Intl.Collator("pt", { sensitivity: "base", numeric: true });
    const source = Array.isArray(suppliers) ? suppliers : [];
    const term = debouncedTerm?.toLowerCase() ?? "";
    const list = term
      ? source.filter((s: any) => {
          const fields = [s.name, s.cnpj, s.cpf, s.contact, s.email, s.phone, s.website, s.address];
          return fields.some((v: any) => typeof v === "string" ? v.toLowerCase().includes(term) : false);
        })
      : [...source];

    return list
      .map((s: any, i: number) => ({ s, i }))
      .sort((a: any, b: any) => {
        const cmp = collator.compare(a.s?.name ?? "", b.s?.name ?? "");
        return cmp !== 0 ? cmp : a.i - b.i;
      })
      .map(({ s }: any) => s);
  }, [suppliers, debouncedTerm]);

  return (
    <AdminOrBuyerRoute>
      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto p-6">
          <Collapsible open={showIntegration} onOpenChange={setShowIntegration}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Integração de Fornecedores com ERP</div>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {showIntegration ? "Ocultar Integração ERP" : "Mostrar Integração ERP"}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <SupplierIntegrationPanel
                onRefreshSuppliers={() => queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] })}
              />
            </CollapsibleContent>
          </Collapsible>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Fornecedores</CardTitle>
                <Button
                  onClick={() => {
                    setEditingSupplier(null);
                    form.reset({
                      name: "", type: 0, cnpj: "", cpf: "", contact: "", email: "",
                      phone: "", website: "", address: "", paymentTerms: "", idSupplierERP: null,
                    });
                    setIsModalOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
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
                <>
                  <div className="mb-4 flex items-center">
                    <div className="relative w-full sm:w-1/2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nome, CNPJ, contato..."
                        className="pl-9 pr-9"
                      />
                      {searchTerm && (
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={() => setSearchTerm("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <SupplierList 
                    suppliers={filteredSuppliers}
                    searchTerm={searchTerm}
                    onEdit={handleEditSupplier}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <SupplierFormModal 
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            form={form}
            isEditing={!!editingSupplier}
            onSubmit={onSubmit}
            isPending={createSupplierMutation.isPending}
          />
        </div>
      </div>
    </AdminOrBuyerRoute>
  );
}

export default SuppliersManagement;
