import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, Clock, Activity } from "lucide-react";
import { PURCHASE_PHASES } from "@/lib/types";

interface ConferenceDashboardProps {
  requests: any[];
}

export default function ConferenceDashboard({ requests }: ConferenceDashboardProps) {
  const totalPending = requests.length;

  const urgentCount = requests.filter(
    (r) => r.urgency === "alta_urgencia" || r.urgency === "alto"
  ).length;

  const lateCount = requests.filter((r) => {
    if (!r.idealDeliveryDate) return false;
    const deliveryDate = new Date(r.idealDeliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deliveryDate < today;
  }).length;

  // Simple metric for "Average items per order" just to show something interesting
  const totalItems = requests.reduce((acc, r) => acc + (r.items?.length || 0), 0);
  const avgItems = totalPending > 0 ? Math.round(totalItems / totalPending) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPending}</div>
          <p className="text-xs text-muted-foreground">
            Aguardando conferência física
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pedidos Urgentes</CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{urgentCount}</div>
          <p className="text-xs text-muted-foreground">
            Alta prioridade
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
          <Clock className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{lateCount}</div>
          <p className="text-xs text-muted-foreground">
            Prazo de entrega excedido
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Média de Itens</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgItems}</div>
          <p className="text-xs text-muted-foreground">
            Itens por pedido
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
