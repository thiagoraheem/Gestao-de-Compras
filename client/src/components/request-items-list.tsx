import { useQuery } from "@tanstack/react-query";
import { Package, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RequestItem {
  id: number;
  description: string;
  unit: string;
  requestedQuantity: number;
  technicalSpecification?: string;
}

interface RequestItemsListProps {
  requestId: number;
}

export default function RequestItemsList({ requestId }: RequestItemsListProps) {
  const { data: items = [], isLoading, error } = useQuery<RequestItem[]>({
    queryKey: [`/api/purchase-requests/${requestId}/items`],
    enabled: !!requestId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Clock className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Carregando itens...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar os itens da solicitação.
        </AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Esta solicitação não possui itens cadastrados.
        </AlertDescription>
      </Alert>
    );
  }

  const formatNumber = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <span className="text-sm font-medium text-gray-500">Descrição</span>
              <p className="text-sm mt-1">{item.description}</p>
              {item.technicalSpecification && (
                <>
                  <span className="text-sm font-medium text-gray-500 mt-2 block">Especificação Técnica</span>
                  <p className="text-xs text-gray-600 mt-1">{item.technicalSpecification}</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-500">Quantidade</span>
                <p className="text-sm font-semibold">{formatNumber(item.requestedQuantity)} {item.unit}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Summary */}
      <div className="border-t pt-3 mt-4">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-600">Total de itens:</span>
          <span className="font-semibold">{items.length} item(s)</span>
        </div>
      </div>
    </div>
  );
}