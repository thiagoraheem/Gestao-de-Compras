import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Building2, Package, Calendar, Eye, Plus, Clock, CheckCircle, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RFQCreation from "./rfq-creation";
import RFQAnalysis from "./rfq-analysis";
import SupplierComparison from "./supplier-comparison";
import UpdateSupplierQuotation from "./update-supplier-quotation";
import RequestItemsList from "./request-items-list";

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
  supplierId: number;
  supplier: {
    name: string;
  };
  status: 'pending' | 'sent' | 'received' | 'expired';
  receivedAt?: string;
  totalValue?: string;
  observations?: string;
}

interface QuotationPhaseProps {
  request: any;
  onClose?: () => void;
  className?: string;
}

export default function QuotationPhase({ request, onClose, className }: QuotationPhaseProps) {
  const [showRFQCreation, setShowRFQCreation] = useState(false);
  const [showRFQAnalysis, setShowRFQAnalysis] = useState(false);
  const [showSupplierComparison, setShowSupplierComparison] = useState(false);
  const [showUpdateQuotation, setShowUpdateQuotation] = useState(false);
  const [showRFQHistory, setShowRFQHistory] = useState(false);
  const [selectedSupplierForUpdate, setSelectedSupplierForUpdate] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mark supplier as no response
  const markSupplierAsNoResponse = async (supplierQuotationId: number) => {
    try {
      await apiRequest(`/api/supplier-quotations/${supplierQuotationId}/mark-no-response`, {
          method: "PUT",
        });
      toast({
        title: "Fornecedor marcado",
        description: "Fornecedor marcado como não respondeu com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar o fornecedor como não respondeu.",
        variant: "destructive",
      });
    }
  };
  


  const { data: quotation, isLoading } = useQuery<Quotation>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
    refetchInterval: 30000, // Refetch every 30 seconds for updates
    refetchOnWindowFocus: true,
    staleTime: 15000, // Consider data fresh for 15 seconds
  });

  const { data: quotationItems = [] } = useQuery<QuotationItem[]>({
    queryKey: [`/api/quotations/${quotation?.id}/items`],
    enabled: !!quotation?.id,
  });

  const { data: supplierQuotations = [] } = useQuery<SupplierQuotation[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  const { data: rfqHistory = [] } = useQuery<Quotation[]>({
    queryKey: [`/api/quotations/purchase-request/${request.id}/history`],
    enabled: showRFQHistory,
  });

  const hasQuotation = !!quotation;
  const hasSupplierResponses = supplierQuotations.some(sq => sq.status === 'received');
  const allSuppliersResponded = supplierQuotations.length > 0 && supplierQuotations.every(sq => sq.status === 'received');
  
  // Allow comparison if at least one supplier has responded (even if others marked as no_response)
  const canCompareSuppliers = hasSupplierResponses;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando informações da cotação...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 md:space-y-2 ${className || ''}`}>
      <div className="space-y-1 md:space-y-2">
        {/* Request Details */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs md:text-sm flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Detalhes da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
              <div>
                <span className="text-xs font-medium text-gray-500">Solicitante</span>
                <p className="text-xs">{request.requesterName || (request.requester ? `${request.requester.firstName || ''} ${request.requester.lastName || ''}`.trim() : 'N/A')}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Data da Solicitação</span>
                <p className="text-xs">{format(new Date(request.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
            
            <Separator className="my-1" />
            
            <div>
              <span className="text-xs font-medium text-gray-500">Justificativa</span>
              <p className="mt-1 text-xs">{request.justification}</p>
            </div>
            <Separator className="my-1" />
            
            {!hasQuotation ? (
            <div>
              <span className="text-xs font-medium text-gray-500 mb-1 block">Itens da Solicitação</span>
              <RequestItemsList requestId={request.id} />
            </div>
            ) : (
              <div></div>
            ) 
            }
          </CardContent>
        </Card>

        {/* RFQ Status */}
        {!hasQuotation ? (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Status da Cotação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <Alert>
                <AlertDescription className="text-xs">
                  Nenhuma RFQ (Request for Quotation) foi criada ainda para esta solicitação.
                </AlertDescription>
              </Alert>
              
              {user?.isBuyer && (
                <div className="mt-1">
                  <Button 
                    onClick={() => setShowRFQCreation(true)}
                    className="w-full text-xs h-7"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Criar RFQ
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Status da Cotação
                </CardTitle>
              </CardHeader>
              <CardContent className="p-1 md:p-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Status</span>
                    <p className="text-xs font-semibold">
                      {quotation.status === 'draft' && 'Rascunho'}
                      {quotation.status === 'sent' && 'Enviada'}
                      {quotation.status === 'received' && 'Recebida'}
                      {quotation.status === 'analyzed' && 'Analisada'}
                      {quotation.status === 'approved' && 'Aprovada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Prazo para Resposta</span>
                    <p className="text-xs">{format(new Date(quotation.quotationDeadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Respostas Recebidas</span>
                    <p className="text-xs">{supplierQuotations.length}</p>
                  </div>
                </div>
                
                {/* Option to create new RFQ */}
                {user?.isBuyer && (
                  <div className="mt-1 pt-1 border-t">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
                      <div>
                        <p className="text-xs text-gray-600">
                          Precisa de uma nova cotação? Você pode criar uma nova RFQ mantenendo o histórico anterior.
                        </p>
                      </div>
                      <div className="flex space-x-1">
                        <Button 
                          onClick={() => setShowRFQHistory(true)}
                          variant="outline"
                          className="text-xs h-6"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Histórico
                        </Button>
                        <Button 
                          onClick={() => setShowRFQCreation(true)}
                          variant="outline"
                          className="text-xs h-6"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Nova RFQ
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items List */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Itens Solicitados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-1">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-1 text-xs font-medium text-gray-700">Descrição</th>
                        <th className="text-center p-1 text-xs font-medium text-gray-700 w-20">Quantidade</th>
                        <th className="text-center p-1 text-xs font-medium text-gray-700 w-24">Prazo de Entrega</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationItems.map((item, index) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-1">
                            <div>
                              <p className="text-xs font-medium text-gray-900">{item.description}</p>
                              {item.itemCode && (
                                <p className="text-xs text-gray-500 mt-0.5">Código: {item.itemCode}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-1 text-center">
                            <span className="text-xs font-semibold text-gray-900">
                              {Math.round(Number(item.quantity))} {item.unit}
                            </span>
                          </td>
                          <td className="p-1 text-center">
                            <span className="text-xs text-gray-700">
                              {item.deliveryDeadline ? format(new Date(item.deliveryDeadline), "dd/MM/yyyy", { locale: ptBR }) : 'Não informado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Summary */}
                  <div className="mt-1 pt-1 border-t bg-gray-50 rounded-b-lg px-1 py-0.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-gray-600">Total de itens:</span>
                      <span className="font-semibold text-gray-900">{quotationItems.length} item(s)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Supplier Responses */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Respostas dos Fornecedores
                </CardTitle>
              </CardHeader>
              <CardContent className="p-1">
                <div className="space-y-1">
                  {supplierQuotations.map((sq) => (
                    <div key={sq.id} className="border rounded-lg p-1">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-1 items-center">
                        <div>
                          <span className="text-xs font-medium text-gray-500">Fornecedor</span>
                          <p className="text-xs font-medium">{sq.supplier?.name || 'Fornecedor não definido'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Status</span>
                          <Badge variant={
                            sq.status === 'received' ? 'default' :
                            sq.status === 'sent' ? 'secondary' :
                            sq.status === 'expired' ? 'destructive' :
                            'outline'
                          } className="text-xs">
                            {sq.status === 'pending' && 'Pendente'}
                            {sq.status === 'sent' && 'Enviada'}
                            {sq.status === 'received' && 'Recebida'}
                            {sq.status === 'expired' && 'Expirada'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Valor Total</span>
                          <p className="text-xs font-semibold">
                            {sq.totalValue ? `R$ ${Number(sq.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {sq.status === 'received' && user?.isBuyer && (
                            <Button
                              onClick={() => {
                                setSelectedSupplierForUpdate({
                                  id: sq.supplierId,
                                  name: sq.supplier?.name || 'Fornecedor'
                                });
                                setShowUpdateQuotation(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver/Editar
                            </Button>
                          )}
                          {sq.status === 'sent' && user?.isBuyer && (
                            <Button
                              onClick={() => markSupplierAsNoResponse(sq.id)}
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 text-red-600 hover:text-red-700"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Não Respondeu
                            </Button>
                          )}
                        </div>
                      </div>
                      {sq.observations && (
                        <div className="mt-1 pt-1 border-t">
                          <span className="text-xs font-medium text-gray-500">Observações</span>
                          <p className="text-xs text-gray-700 mt-0.5">{sq.observations}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                {user?.isBuyer && supplierQuotations.some(sq => sq.status === 'received') && (
                  <div className="mt-1 pt-1 border-t">
                    <div className="flex flex-col md:flex-row gap-1">
                      <Button
                        onClick={() => setShowRFQAnalysis(true)}
                        variant="outline"
                        className="flex-1 text-xs h-7"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Analisar Cotações
                      </Button>
                      <Button
                        onClick={() => setShowSupplierComparison(true)}
                        className="flex-1 text-xs h-7"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Comparar e Escolher
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Modals */}
        {showRFQCreation && (
          <RFQCreation
            requestId={request.id}
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

        {showSupplierComparison && quotation && (
          <SupplierComparison
            quotationId={quotation.id}
            onClose={() => setShowSupplierComparison(false)}
            onComplete={() => {
              setShowSupplierComparison(false);
              onClose?.(); // Close the entire quotation modal
            }}
          />
        )}

        {showUpdateQuotation && selectedSupplierForUpdate && quotation && (
          <UpdateSupplierQuotation
            isOpen={showUpdateQuotation}
            onClose={() => {
              setShowUpdateQuotation(false);
              setSelectedSupplierForUpdate(null);
            }}
            quotationId={quotation.id}
            supplierId={selectedSupplierForUpdate.id}
            supplierName={selectedSupplierForUpdate.name}
            onSuccess={() => {
              // Refresh supplier quotations data
              // The component will automatically refetch due to query invalidation
            }}
          />
        )}

        {/* RFQ History Dialog */}
        <Dialog open={showRFQHistory} onOpenChange={setShowRFQHistory}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-xs md:text-sm">Histórico de RFQs</DialogTitle>
              <DialogDescription className="text-xs">
                Histórico completo de todas as RFQs criadas para esta solicitação
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              {rfqHistory.length === 0 ? (
                <p className="text-xs text-gray-500">Nenhuma RFQ encontrada no histórico.</p>
              ) : (
                rfqHistory.map((rfq, index) => (
                  <Card key={rfq.id} className={rfq.isActive ? "border-blue-500 bg-blue-50" : "border-gray-200"}>
                    <CardHeader className="pb-1">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-xs">
                          {rfq.quotationNumber} 
                          {rfq.isActive && <Badge className="ml-2 bg-blue-600 text-xs">Ativa</Badge>}
                          {!rfq.isActive && <Badge variant="outline" className="ml-2 text-xs">Inativa</Badge>}
                        </CardTitle>
                        <div className="text-xs text-gray-500">
                          Versão {rfq.rfqVersion || 1}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-1">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                        <div>
                          <span className="text-xs font-medium text-gray-500">Status</span>
                          <p className="text-xs">
                            {rfq.status === 'draft' && 'Rascunho'}
                            {rfq.status === 'sent' && 'Enviada'}
                            {rfq.status === 'received' && 'Recebida'}
                            {rfq.status === 'analyzed' && 'Analisada'}
                            {rfq.status === 'approved' && 'Aprovada'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Prazo para Resposta</span>
                          <p className="text-xs">{format(new Date(rfq.quotationDeadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Criada em</span>
                          <p className="text-xs">{format(new Date(rfq.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
