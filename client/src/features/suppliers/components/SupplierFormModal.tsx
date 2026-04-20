import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { CPFInput } from "@/shared/components/cpf-input";
import { CNPJInput } from "@/shared/components/cnpj-input";
import { UseFormReturn } from "react-hook-form";
import { SupplierFormData } from "../schemas/supplier.schema";

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: UseFormReturn<SupplierFormData>;
  isEditing: boolean;
  onSubmit: (data: SupplierFormData) => void;
  isPending: boolean;
}

export function SupplierFormModal({
  isOpen,
  onClose,
  form,
  isEditing,
  onSubmit,
  isPending
}: SupplierFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>
            {isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form id="supplier-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Fornecedor *</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Pessoa Jurídica</SelectItem>
                        <SelectItem value="2">Pessoa Física</SelectItem>
                        <SelectItem value="1">Online</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {form.watch("type") === 0 && (
                  <FormField control={form.control} name="cnpj" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <CNPJInput value={field.value || ""} onChange={field.onChange} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {form.watch("type") === 2 && (
                  <FormField control={form.control} name="cpf" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <CPFInput value={field.value || ""} onChange={field.onChange} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="contact" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato{form.watch("type") === 0 ? " *" : ""}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email{form.watch("type") === 0 ? " *" : ""}</FormLabel>
                    <FormControl><Input {...field} type="email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone{form.watch("type") === 0 ? " *" : ""}</FormLabel>
                    <FormControl><Input {...field} placeholder="(11) 99999-9999" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="website" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website do Fornecedor{form.watch("type") === 1 ? " *" : ""}</FormLabel>
                    <FormControl><Input {...field} placeholder="https://exemplo.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="idSupplierERP" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>ID Fornecedor ERP</span>
                      {field.value ? (
                        <span className="text-xs text-green-600">Vinculado ao ERP (ID: {field.value})</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não vinculado ao ERP</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input value={field.value?.toString() || ""} readOnly disabled placeholder="Não editável" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condições de Pagamento</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Endereço completo do fornecedor" rows={3} className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50/50">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto order-2 sm:order-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              form="supplier-form"
              disabled={isPending}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isPending ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
