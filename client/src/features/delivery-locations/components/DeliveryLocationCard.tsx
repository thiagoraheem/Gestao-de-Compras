import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Edit, Trash2, CheckCircle, MapPin, User, Phone, Mail, FileText } from "lucide-react";
import type { DeliveryLocation } from "@shared/schema";

interface DeliveryLocationCardProps {
  location: DeliveryLocation;
  onEdit: (location: DeliveryLocation) => void;
  onDelete: (id: number) => void;
  onActivate: (id: number) => void;
  isUpdatePending: boolean;
  isDeletePending: boolean;
}

export function DeliveryLocationCard({
  location,
  onEdit,
  onDelete,
  onActivate,
  isUpdatePending,
  isDeletePending,
}: DeliveryLocationCardProps) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{location.name}</CardTitle>
            </div>
          </div>
          <Badge variant={location.active ? "default" : "secondary"}>
            {location.active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Endereço:</span> {location.address}
          </div>
          {location.contactPerson && (
            <div className="flex items-center space-x-1">
              <User className="h-3 w-3" />
              <span className="font-medium">Contato:</span> {location.contactPerson}
            </div>
          )}
          {location.phone && (
            <div className="flex items-center space-x-1">
              <Phone className="h-3 w-3" />
              <span className="font-medium">Telefone:</span> {location.phone}
            </div>
          )}
          {location.email && (
            <div className="flex items-center space-x-1">
              <Mail className="h-3 w-3" />
              <span className="font-medium">Email:</span> {location.email}
            </div>
          )}
          {location.observations && (
            <div className="flex items-start space-x-1">
              <FileText className="h-3 w-3 mt-0.5" />
              <div>
                <span className="font-medium">Observações:</span>
                <p className="text-muted-foreground mt-1">{location.observations}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex space-x-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onEdit(location)} disabled={isUpdatePending}>
            <Edit className="h-4 w-4 mr-1" /> Editar
          </Button>
          {location.active ? (
            <Button variant="outline" size="sm" onClick={() => onDelete(location.id)} disabled={isDeletePending}>
              <Trash2 className="h-4 w-4 mr-1" /> Desativar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onActivate(location.id)} disabled={isUpdatePending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Ativar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
