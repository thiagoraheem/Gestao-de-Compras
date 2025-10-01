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
    queryFn: () => apiRequest(`/api/purchase-requests/${requestId}/items`),
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
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">
                Descrição
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">
                Quantidade
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">
                Especificação Técnica
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <span className="font-semibold">
                    {formatNumber(item.requestedQuantity)} {item.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.technicalSpecification || (
                    <span className="text-gray-400 italic">Não informado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
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