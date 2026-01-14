import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Truck, Package, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { URGENCY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConferenceOrderCardProps {
  request: any;
  onSelect: (request: any) => void;
}

export default function ConferenceOrderCard({ request, onSelect }: ConferenceOrderCardProps) {
  const isUrgent = request.urgency === "alta_urgencia" || request.urgency === "alto";
  
  const deliveryDate = request.idealDeliveryDate ? new Date(request.idealDeliveryDate) : null;
  const isLate = deliveryDate && deliveryDate < new Date() && deliveryDate.toDateString() !== new Date().toDateString();

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow cursor-pointer border-l-4",
      isUrgent ? "border-l-amber-500" : isLate ? "border-l-red-500" : "border-l-blue-500"
    )} onClick={() => onSelect(request)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-bold">{request.requestNumber}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1" title={request.justification}>
              {request.justification || "Sem descrição"}
            </p>
          </div>
          <Badge variant={isUrgent ? "destructive" : "secondary"} className="shrink-0">
            {(URGENCY_LABELS as any)[request.urgency] || request.urgency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2 text-sm">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="h-4 w-4" />
            <span className="font-medium text-foreground truncate">{request.chosenSupplier?.name || "Fornecedor não definido"}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{request.items?.length || 0} itens para conferir</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className={cn(isLate && "text-red-600 font-medium")}>
              {deliveryDate ? format(deliveryDate, "dd 'de' MMMM", { locale: ptBR }) : "Data não informada"}
              {isLate && " (Atrasado)"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button className="w-full" onClick={(e) => {
          e.stopPropagation();
          onSelect(request);
        }}>
          Conferir Material
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
