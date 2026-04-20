import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Building, ChevronsUpDown, Check } from "lucide-react";
import { CNPJInput } from "@/shared/components/cnpj-input";
import { LogoUpload } from "@/shared/components/logo-upload";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { cn } from "@/lib/utils";
import { Company, InsertCompany } from "@shared/schema";
import { EmpresaERP } from "../hooks/useCompanies";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CompanyFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  isPending: boolean;
  formData: InsertCompany;
  setFormData: React.Dispatch<React.SetStateAction<InsertCompany>>;
  editingCompany: Company | null;
  erpCompanies: EmpresaERP[] | undefined;
  openCombobox: boolean;
  setOpenCombobox: (open: boolean) => void;
  handleSelectERPCompany: (company: EmpresaERP | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function CompanyFormModal({
  isOpen, onOpenChange, title, submitLabel, isPending, formData, setFormData,
  editingCompany, erpCompanies, openCombobox, setOpenCombobox, handleSelectERPCompany, onSubmit, onCancel
}: CompanyFormModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Razão Social</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="tradingName">Nome Fantasia</Label>
            <Input
              id="tradingName"
              value={formData.tradingName || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, tradingName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <CNPJInput
                value={formData.cnpj || ""}
                onChange={(value) => setFormData(prev => ({ ...prev, cnpj: value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Empresa ERP</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {formData.idCompanyERP
                      ? erpCompanies?.find((c) => c.idCompany === formData.idCompanyERP)?.companyName
                      : "Selecione o ERP"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="nenhuma" onSelect={() => handleSelectERPCompany(null)}>
                          <Check className={cn("mr-2 h-4 w-4", !formData.idCompanyERP ? "opacity-100" : "opacity-0")} />
                          Nenhuma
                        </CommandItem>
                        {erpCompanies?.map((company) => (
                          <CommandItem
                            key={company.idCompany}
                            value={company.companyName || ""}
                            onSelect={() => handleSelectERPCompany(company)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.idCompanyERP === company.idCompany ? "opacity-100" : "opacity-0")} />
                            {company.companyName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          {editingCompany && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <LogoUpload
                  companyId={editingCompany.id}
                  currentLogoUrl={editingCompany.logoUrl || editingCompany.logoBase64 || undefined}
                  onUploadSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
                    toast({ title: "Sucesso", description: "Logo atualizado com sucesso!" });
                  }}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={formData.active || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="edit-active" className="text-sm font-medium leading-none">
                  Empresa ativa
                </Label>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
