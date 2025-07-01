import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Building2, Package, Calendar, Eye, Plus, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import RFQCreation from "./rfq-creation";
import RFQAnalysis from "./rfq-analysis";

interface QuotationPhaseProps {
  request: any;
  onClose?: () => void;
  className?: string;
}

export default function QuotationPhase({ request, onClose, className }: QuotationPhaseProps) {
  const [showRFQCreation, setShowRFQCreation] = useState(false);
  const [showRFQAnalysis, setShowRFQAnalysis] = useState(false);
  const { user } = useAuth();

  // Fetch existing quotation for this purchase request
  const { data: quotation, isLoading } = useQuery({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  // Fetch quotation items if quotation exists
  const { data: quotationItems = [] } = useQuery({
    queryKey: [`/api/quotations/${(quotation as any)?.id}/items`],
    enabled: !!(quotation as any)?.id,
  });

  // Fetch supplier quotations if quotation exists
  const { data: supplierQuotations = [] } = useQuery({
    queryKey: [`/api/quotations/${(quotation as any)?.id}/supplier-quotations`],
    enabled: !!(quotation as any)?.id,
  });

  const hasQuotation = !!quotation;
  const hasSupplierResponses = Array.isArray(supplierQuotations) && (supplierQuotations as any[]).some((sq: any) => sq.status === 'received');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando informações da cotação...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Request Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informações da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Número</span>
                <p className="text-lg font-semibold">{request.requestNumber}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Solicitante</span>
                <p>{request.requesterName}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Data da Solicitação</span>
                <p>{format(new Date(request.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div>
              <span className="text-sm font-medium text-gray-500">Justificativa</span>
              <p className="mt-1">{request.justification}</p>
            </div>
          </CardContent>
        </Card>

        {/* RFQ Status */}
        {!hasQuotation ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Solicitação de Cotação (RFQ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Esta solicitação ainda não possui uma RFQ criada. Para prosseguir com as cotações, 
                  é necessário criar uma solicitação formal de cotação que será enviada aos fornecedores.
                </AlertDescription>
              </Alert>
              
              <div className="mt-4">
                {user?.isBuyer ? (
                  <Button 
                    onClick={() => setShowRFQCreation(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Solicitação de Cotação (RFQ)
                  </Button>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Apenas usuários com perfil de comprador podem criar solicitações de cotação.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Existing RFQ Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  RFQ Criada - {quotation.quotationNumber}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Status</span>
                    <Badge variant="outline" className="ml-2">
                      {quotation.status === 'draft' && 'Rascunho'}
                      {quotation.status === 'sent' && 'Enviada'}
                      {quotation.status === 'received' && 'Recebida'}
                      {quotation.status === 'analyzed' && 'Analisada'}
                      {quotation.status === 'approved' && 'Aprovada'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Prazo para Cotação</span>
                    <p>{format(new Date(quotation.quotationDeadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Fornecedores Convidados</span>
                    <p>{supplierQuotations.length}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Itens da Cotação</span>
                    <div className="mt-2 space-y-2">
                      {quotationItems.map((item: any, index: number) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{item.itemCode} - {item.description}</p>
                            <p className="text-sm text-gray-600">
                              Qtd: {item.quantity} {item.unit}
                              {item.deliveryDeadline && (
                                <span className="ml-4">
                                  Entrega: {format(new Date(item.deliveryDeadline), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-500">Status dos Fornecedores</span>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {supplierQuotations.map((sq: any) => (
                        <div key={sq.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{sq.supplier?.name || 'Fornecedor'}</span>
                            <Badge 
                              variant={sq.status === 'received' ? 'default' : 'secondary'}
                            >
                              {sq.status === 'pending' && 'Pendente'}
                              {sq.status === 'sent' && 'Enviado'}
                              {sq.status === 'received' && 'Recebido'}
                              {sq.status === 'expired' && 'Expirado'}
                            </Badge>
                          </div>
                          {sq.receivedAt && (
                            <p className="text-sm text-gray-600 mt-1">
                              Recebido em {format(new Date(sq.receivedAt), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                          {sq.totalValue && (
                            <p className="text-sm font-medium text-green-600 mt-1">
                              R$ {parseFloat(sq.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  {hasSupplierResponses && (
                    <Button 
                      onClick={() => setShowRFQAnalysis(true)}
                      variant="outline"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Analisar Cotações
                    </Button>
                  )}
                  
                  {quotation.status === 'draft' && user?.isBuyer && (
                    <Button 
                      onClick={() => setShowRFQCreation(true)}
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Editar RFQ
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modals */}
      {showRFQCreation && (
        <RFQCreation 
          purchaseRequest={request}
          onClose={() => setShowRFQCreation(false)}
          onComplete={() => {
            setShowRFQCreation(false);
            // Refetch data
            window.location.reload();
          }}
        />
      )}

      {showRFQAnalysis && quotation && (
        <RFQAnalysis 
          quotation={quotation}
          quotationItems={quotationItems}
          supplierQuotations={supplierQuotations}
          onClose={() => setShowRFQAnalysis(false)}
          onComplete={() => {
            setShowRFQAnalysis(false);
            onClose?.();
          }}
        />
      )}
    </div>
  );
}