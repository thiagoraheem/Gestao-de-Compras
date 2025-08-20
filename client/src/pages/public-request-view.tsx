import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, User, FileText, Download, Building2, Phone, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PublicRequestData {
  purchaseRequest: any;
  items: any[];
  requester: any;
  department: any;
  costCenter: any;
  company: any;
  deliveryLocation: any;
  timeline: any[];
  supplier?: any;
  hasPurchaseOrderPdf?: boolean;
}

function formatCurrency(value: string | number | null | undefined) {
  if (!value) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'Não informado';
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
}

function getPhaseLabel(phase: string) {
  const phases = {
    'request': 'Solicitação',
    'approval_a1': 'Aprovação A1',
    'quotation': 'Cotação',
    'approval_a2': 'Aprovação A2',
    'purchase_order': 'Pedido de Compra',
    'conclusion': 'Conclusão',
    'receipt': 'Recebimento',
    'archived': 'Arquivado'
  };
  return phases[phase as keyof typeof phases] || phase;
}

function getStatusColor(phase: string) {
  const colors = {
    'request': 'bg-blue-500',
    'approval_a1': 'bg-yellow-500',
    'quotation': 'bg-purple-500',
    'approval_a2': 'bg-orange-500',
    'purchase_order': 'bg-green-500',
    'conclusion': 'bg-teal-500',
    'receipt': 'bg-indigo-500',
    'archived': 'bg-gray-500'
  };
  return colors[phase as keyof typeof colors] || 'bg-gray-400';
}

export default function PublicRequestView() {
  const [match, params] = useRoute("/public/request/:id");
  const requestId = params?.id;

  const { data, isLoading, error } = useQuery<PublicRequestData>({
    queryKey: ['/api/public/purchase-request', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');
      const response = await fetch(`/api/public/purchase-request/${requestId}`);
      if (!response.ok) throw new Error('Solicitação não encontrada');
      return response.json();
    },
    enabled: !!requestId
  });

  const handleDownloadPDF = async () => {
    if (!requestId) return;
    
    try {
      const response = await fetch(`/api/public/purchase-request/${requestId}/pdf`);
      if (!response.ok) throw new Error('PDF não disponível');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Pedido_Compra_${data?.purchaseRequest?.requestNumber || requestId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
    }
  };

  if (!requestId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Inválido</h1>
          <p className="text-gray-600">O link fornecido não é válido.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Solicitação Não Encontrada</h1>
          <p className="text-gray-600">A solicitação de compra solicitada não foi encontrada ou não está disponível.</p>
        </div>
      </div>
    );
  }

  const { purchaseRequest, items, requester, department, costCenter, company, deliveryLocation, timeline, supplier, hasPurchaseOrderPdf } = data;
  const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Solicitação de Compra
          </h1>
          <p className="text-lg text-gray-600">
            {purchaseRequest.requestNumber}
          </p>
          <div className="flex justify-center">
            <Badge 
              variant="outline" 
              className={`${getStatusColor(purchaseRequest.phase)} text-white border-0`}
            >
              {getPhaseLabel(purchaseRequest.phase)}
            </Badge>
          </div>
        </div>

        {/* Company Info */}
        {company && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {company.name || company.tradingName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {company.cnpj && <p><span className="font-medium">CNPJ:</span> {company.cnpj}</p>}
              {company.address && <p><span className="font-medium">Endereço:</span> {company.address}</p>}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {company.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {company.phone}
                  </div>
                )}
                {company.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {company.email}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Request Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados da Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="font-medium">Solicitante:</span>
                <p>{requester?.name || 'Não informado'}</p>
              </div>
              <div>
                <span className="font-medium">Departamento:</span>
                <p>{department?.name || 'Não informado'}</p>
              </div>
              <div>
                <span className="font-medium">Centro de Custo:</span>
                <p>{costCenter?.name || 'Não informado'}</p>
              </div>
              <div>
                <span className="font-medium">Urgência:</span>
                <Badge variant={purchaseRequest.urgency === 'high' ? 'destructive' : 'secondary'}>
                  {purchaseRequest.urgency === 'high' ? 'Alta' : purchaseRequest.urgency === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {formatDate(purchaseRequest.createdAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Local de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Local:</span>
                <p>{deliveryLocation?.name || 'Sede da empresa'}</p>
              </div>
              <div>
                <span className="font-medium">Endereço:</span>
                <p>{deliveryLocation?.address || 'Não informado'}</p>
              </div>
              {deliveryLocation?.contactPerson && (
                <div>
                  <span className="font-medium">Responsável:</span>
                  <p>{deliveryLocation.contactPerson}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Supplier Info */}
        {supplier && (
          <Card>
            <CardHeader>
              <CardTitle>Fornecedor Selecionado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Nome:</span>
                <p>{supplier.name}</p>
              </div>
              {supplier.cnpj && (
                <div>
                  <span className="font-medium">CNPJ:</span>
                  <p>{supplier.cnpj}</p>
                </div>
              )}
              {supplier.contactPerson && (
                <div>
                  <span className="font-medium">Contato:</span>
                  <p>{supplier.contactPerson}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Itens da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-center p-2">Qtd</th>
                    <th className="text-center p-2">Unidade</th>
                    <th className="text-right p-2">Valor Unit.</th>
                    <th className="text-right p-2">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.productCode && (
                            <p className="text-xs text-gray-500">Código: {item.productCode}</p>
                          )}
                          {item.technicalSpecification && (
                            <p className="text-xs text-gray-600 mt-1">{item.technicalSpecification}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2">{item.requestedQuantity}</td>
                      <td className="text-center p-2">{item.unit}</td>
                      <td className="text-right p-2">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right p-2 font-medium">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-gray-300">
                    <td colSpan={4} className="text-right p-2 font-bold">Total Geral:</td>
                    <td className="text-right p-2 font-bold text-lg">{formatCurrency(totalValue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {timeline && timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico do Processo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.map((event, index) => (
                  <div key={index} className="flex gap-3">
                    <div className={`w-3 h-3 rounded-full mt-2 ${getStatusColor(event.phase)}`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getPhaseLabel(event.phase)}</span>
                        <span className="text-sm text-gray-500">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                      {event.observations && (
                        <p className="text-sm text-gray-600 mt-1">{event.observations}</p>
                      )}
                      {event.userName && (
                        <p className="text-xs text-gray-500">Por: {event.userName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download PDF */}
        {hasPurchaseOrderPdf && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Button onClick={handleDownloadPDF} size="lg" className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar Pedido de Compra (PDF)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Sistema de Gestão de Compras</p>
          <p>Visualização pública - Acesso via QR Code</p>
        </div>
      </div>
    </div>
  );
}