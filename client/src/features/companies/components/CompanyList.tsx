import { Building, Trash2, CheckCircle, Edit } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Company } from "@shared/schema";

interface CompanyListProps {
  companies: Company[];
  onEdit: (company: Company) => void;
  onDelete: (id: number) => void;
  onActivate: (id: number) => void;
  isUpdatePending: boolean;
  isDeletePending: boolean;
}

export function CompanyList({
  companies,
  onEdit,
  onDelete,
  onActivate,
  isUpdatePending,
  isDeletePending,
}: CompanyListProps) {
  if (!companies || companies.length === 0) {
    return (
      <div className="col-span-full text-center py-8">
        <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhuma empresa cadastrada</p>
      </div>
    );
  }

  return (
    <>
      {companies.map((company: Company) => (
        <Card key={company.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {(company.logoUrl || company.logoBase64) ? (
                  <img
                    src={company.logoUrl || company.logoBase64 || undefined}
                    alt={`Logo ${company.name}`}
                    className="h-8 w-8 object-contain rounded"
                  />
                ) : (
                  <Building className="h-5 w-5 text-primary" />
                )}
                <div>
                  <CardTitle className="text-lg">{company.name}</CardTitle>
                  {company.tradingName && (
                    <p className="text-sm text-muted-foreground">{company.tradingName}</p>
                  )}
                </div>
              </div>
              <Badge variant={company.active ? "default" : "secondary"}>
                {company.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">CNPJ:</span> {company.cnpj}</div>
              {company.address && <div><span className="font-medium">Endereço:</span> {company.address}</div>}
              {company.phone && <div><span className="font-medium">Telefone:</span> {company.phone}</div>}
              {company.email && <div><span className="font-medium">Email:</span> {company.email}</div>}
            </div>
            <div className="flex space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(company)}
                disabled={isUpdatePending}
              >
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
              {company.active ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(company.id)}
                  disabled={isDeletePending}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Desativar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onActivate(company.id)}
                  disabled={isUpdatePending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Ativar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
