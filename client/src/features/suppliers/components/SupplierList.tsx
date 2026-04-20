import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Edit } from "lucide-react";

interface SupplierListProps {
  suppliers: any[];
  searchTerm: string;
  onEdit: (supplier: any) => void;
}

export function SupplierList({ suppliers, searchTerm, onEdit }: SupplierListProps) {
  return (
    <div className="relative overflow-x-auto overflow-y-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[80px] text-center">ERP</TableHead>
            <TableHead className="min-w-[250px]">Nome</TableHead>
            <TableHead className="min-w-[140px]">Tipo</TableHead>
            <TableHead className="min-w-[160px]">CNPJ</TableHead>
            <TableHead className="min-w-[160px]">Contato</TableHead>
            <TableHead className="min-w-[220px]">Email</TableHead>
            <TableHead className="min-w-[140px]">Telefone</TableHead>
            <TableHead className="min-w-[200px]">Website</TableHead>
            <TableHead className="sticky right-0 bg-background z-10 border-l min-w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8">
                {searchTerm ? "Nenhum fornecedor corresponde à busca" : "Nenhum fornecedor encontrado"}
              </TableCell>
            </TableRow>
          ) : (
            suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center justify-center">
                        <Checkbox
                          checked={supplier.idSupplierERP != null}
                          disabled
                          className={supplier.idSupplierERP != null
                            ? "border-green-600 dark:border-green-400 data-[state=checked]:bg-green-600 dark:data-[state=checked]:bg-green-400 data-[state=checked]:text-white"
                            : ""}
                          aria-label={supplier.idSupplierERP != null ? "Integrado com ERP" : "Não integrado com ERP"}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {supplier.idSupplierERP != null ? "Integrado com ERP" : "Não integrado com ERP"}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="font-medium whitespace-normal break-words">{supplier.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {(() => {
                    const map = {
                      0: { label: 'Pessoa Jurídica', classes: 'bg-blue-100 text-blue-800' },
                      1: { label: 'Online', classes: 'bg-green-100 text-green-800' },
                      2: { label: 'Pessoa Física', classes: 'bg-purple-100 text-purple-800' },
                    } as const;
                    const m = map[(supplier.type ?? 0) as 0 | 1 | 2] || map[0];
                    return (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.classes}`}>
                        {m.label}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="whitespace-normal break-words">{supplier.cnpj || "Não informado"}</TableCell>
                <TableCell className="whitespace-normal break-words">{supplier.contact || "Não informado"}</TableCell>
                <TableCell className="whitespace-normal break-words max-w-[280px]">{supplier.email || "Não informado"}</TableCell>
                <TableCell className="whitespace-normal break-words">{supplier.phone || "Não informado"}</TableCell>
                <TableCell className="whitespace-normal break-words max-w-[280px]">
                  {supplier.website ? (
                    <a 
                      href={supplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary underline"
                    >
                      {supplier.website}
                    </a>
                  ) : (
                    "Não informado"
                  )}
                </TableCell>
                <TableCell className="sticky right-0 bg-background z-10 border-l">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(supplier)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
