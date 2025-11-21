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
        <span className="text-sm text-muted-foreground">Carregando itens...</span>
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
        <table className="min-w-full border border-border rounded-lg">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-border">
                Descrição
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-border">
                Quantidade
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-border">
                Especificação Técnica
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-white dark:bg-slate-900/30' : 'bg-slate-50 dark:bg-slate-800/40'}>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-200">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-200">
                  <span className="font-semibold">
                    {formatNumber(item.requestedQuantity)} {item.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {item.technicalSpecification || (
                    <span className="text-slate-400 dark:text-slate-500 italic">Não informado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      <div className="border-t border-border pt-3 mt-4">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Total de itens:</span>
          <span className="font-semibold">{items.length} item(s)</span>
        </div>
      </div>
    </div>
  );
}
