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

interface Quotation {
  id: number;
  quotationNumber: string;
  status: 'draft' | 'sent' | 'received' | 'analyzed' | 'approved';
  quotationDeadline: string;
}

interface QuotationItem {
  id: number;
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  deliveryDeadline?: string;
}

interface SupplierQuotation {
  id: number;
  supplier: {
    name: string;
  };
  status: 'pending' | 'sent' | 'received' | 'expired';
  receivedAt?: string;
  totalValue?: string;
}

interface QuotationPhaseProps {
  request: any;
  onClose?: () => void;
  className?: string;
}

export default function QuotationPhase({ request, onClose, className }: QuotationPhaseProps) {
  const [showRFQCreation, setShowRFQCreation] = useState(false);
  const [showRFQAnalysis, setShowRFQAnalysis] = useState(false);
  const { user } = useAuth();

  const { data: quotation, isLoading } = useQuery<Quotation>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: quotationItems = [] } = useQuery<QuotationItem[]>({
    queryKey: [`/api/quotations/${quotation?.id}/items`],
    enabled: !!quotation?.id,
  });

  const { data: supplierQuotations = [] } = useQuery<SupplierQuotation[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  const hasQuotation = !!quotation;
  const hasSupplierResponses = supplierQuotations.some(sq => sq.status === 'received');

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
                    <p className="text-lg font-semibold">
                      {quotation.status === 'draft' && 'Rascunho'}
                      {quotation.status === 'sent' && 'Enviada'}
                      {quotation.status === 'received' && 'Recebida'}
                      {quotation.status === 'analyzed' && 'Analisada'}
                      {quotation.status === 'approved' && 'Aprovada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Prazo para Resposta</span>
                    <p>{format(new Date(quotation.quotationDeadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Respostas Recebidas</span>
                    <p>{supplierQuotations.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens Solicitados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quotationItems.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Código</span>
                          <p>{item.itemCode}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Descrição</span>
                          <p>{item.description}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Quantidade</span>
                          <p>{item.quantity} {item.unit}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Prazo de Entrega</span>
                          <p>{item.deliveryDeadline ? format(new Date(item.deliveryDeadline), "dd/MM/yyyy", { locale: ptBR }) : 'Não informado'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Supplier Responses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Respostas dos Fornecedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {supplierQuotations.map((sq) => (
                    <div key={sq.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Fornecedor</span>
                          <p>{sq.supplier.name}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Status</span>
                          <p>
                            {sq.status === 'pending' && 'Pendente'}
                            {sq.status === 'sent' && 'Enviada'}
                            {sq.status === 'received' && 'Recebida'}
                            {sq.status === 'expired' && 'Expirada'}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Recebido em</span>
                          <p>{sq.receivedAt ? format(new Date(sq.receivedAt), "dd/MM/yyyy", { locale: ptBR }) : 'Não recebida'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {quotation.status === 'draft' && user?.isBuyer && (
              <div className="flex justify-end">
                <Button 
                  onClick={() => setShowRFQCreation(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Editar RFQ
                </Button>
              </div>
            )}
          </>
        )}

        {/* Modals */}
        {showRFQCreation && (
          <RFQCreation
            purchaseRequest={request}
            onClose={() => setShowRFQCreation(false)}
            onComplete={() => {
              setShowRFQCreation(false);
              // TODO: Refresh data
            }}
          />
        )}

        {showRFQAnalysis && (
          <RFQAnalysis
            quotation={quotation}
            quotationItems={quotationItems}
            supplierQuotations={supplierQuotations}
            onClose={() => setShowRFQAnalysis(false)}
            onComplete={() => {
              setShowRFQAnalysis(false);
              // TODO: Refresh data
            }}
          />
        )}
      </div>
    </div>
  );
}
