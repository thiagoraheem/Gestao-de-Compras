
import React from "react";
import { useReceipt } from "./ReceiptContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, User } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ReceiptBasicInfo() {
  const { request } = useReceipt();
  
  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR
    });
  };

  return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Informações da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Número</p>
                <Badge variant="outline" className="mt-1">
                  {request.requestNumber}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Categoria</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Justificativa</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{request.justification}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Urgência</p>
                <Badge
                  variant={request.urgency === "alto" ? "destructive" : "secondary"}
                  className="mt-1"
                >
                  {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Valor Total</p>
                <p className="text-sm font-medium mt-1 text-slate-700 dark:text-slate-300">{formatCurrency(request.totalValue)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Data de Criação</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{formatDate(request.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* People Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Solicitante</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                {request.requester ?
                  `${request.requester.firstName} ${request.requester.lastName}` :
                  "N/A"
                }
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{request.requester?.email}</p>
            </div>

            {request.approverA1 && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovador A1</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                  {`${request.approverA1.firstName} ${request.approverA1.lastName}`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.approverA1.email}</p>
              </div>
            )}

            {request.approverA2 && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovador A2</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                  {`${request.approverA2.firstName} ${request.approverA2.lastName}`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.approverA2.email}</p>
              </div>
            )}

            {request.costCenter && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Centro de Custo</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{request.costCenter.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Código: {request.costCenter.code}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
