import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, User, FileText, Building2, Phone, Mail, X, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PHASE_LABELS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";

interface RequestViewProps {
  request: any;
  onClose?: () => void;
}

function formatCurrency(value: string | number | null | undefined) {
  if (!value) return "R$ 0,00";
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Não informado";
  try {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
}

export default function RequestView({ request, onClose }: RequestViewProps) {
  const { data: requestData, isLoading: isLoadingRequest } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}`],
    enabled: !!request.id,
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
    enabled: !!request.id,
  });

  const isLoading = isLoadingRequest || isLoadingItems;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Carregando detalhes...</p>
      </div>
    );
  }

  const purchaseRequest = requestData || request;
  const {
    requester,
    department,
    costCenter,
    company,
    deliveryLocation
  } = requestData || {};

  // Items don't have price information in purchase requests

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Detalhes da Solicitação
          </h2>
          <p className="text-muted-foreground">
            {purchaseRequest.requestNumber}
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex justify-center mb-6">
        <Badge variant="outline" className="text-sm px-4 py-2">
          {PHASE_LABELS[purchaseRequest.currentPhase as keyof typeof PHASE_LABELS] || purchaseRequest.currentPhase}
        </Badge>
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
              Informações do Solicitante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">Nome:</span>
              <p>{requester ? `${requester.firstName} ${requester.lastName}` : 'Não informado'}</p>
            </div>
            <div>
              <span className="font-medium">Departamento:</span>
              <p>{department?.name || 'Não informado'}</p>
            </div>
            <div>
              <span className="font-medium">Centro de Custo:</span>
              <p>{costCenter?.name || costCenter?.code || 'Não informado'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">Data de Criação:</span>
              <p>{formatDate(purchaseRequest.createdAt)}</p>
            </div>
            <div>
              <span className="font-medium">Urgência:</span>
              <Badge variant={purchaseRequest.urgency === 'alto' ? 'destructive' : 'secondary'}>
                {URGENCY_LABELS[purchaseRequest.urgency as keyof typeof URGENCY_LABELS] || purchaseRequest.urgency}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Categoria:</span>
              <p>{CATEGORY_LABELS[purchaseRequest.category as keyof typeof CATEGORY_LABELS] || purchaseRequest.category}</p>
            </div>
            {purchaseRequest.idealDeliveryDate && (
              <div>
                <span className="font-medium">Data Ideal de Entrega:</span>
                <p>{formatDate(purchaseRequest.idealDeliveryDate)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Location */}
      {deliveryLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Local de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="font-medium">Nome:</span> {deliveryLocation.name}</p>
              {deliveryLocation.address && (
                <p><span className="font-medium">Endereço:</span> {deliveryLocation.address}</p>
              )}
              {deliveryLocation.contactPerson && (
                <p><span className="font-medium">Contato:</span> {deliveryLocation.contactPerson}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Justification */}
      {purchaseRequest.justification && (
        <Card>
          <CardHeader>
            <CardTitle>Justificativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{purchaseRequest.justification}</p>
          </CardContent>
        </Card>
      )}

      {/* Additional Info */}
      {purchaseRequest.additionalInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{purchaseRequest.additionalInfo}</p>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens da Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-center p-2">Qtd Solicitada</th>
                    <th className="text-center p-2">Qtd Aprovada</th>
                    <th className="text-center p-2">Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.technicalSpecification && (
                            <p className="text-xs text-gray-500 mt-1">
                              {item.technicalSpecification}
                            </p>
                          )}
                          {item.productCode && (
                            <p className="text-xs text-blue-600 mt-1">
                              Código: {item.productCode}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2">{item.requestedQuantity || '-'}</td>
                      <td className="text-center p-2">{item.approvedQuantity || '-'}</td>
                      <td className="text-center p-2">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">Nenhum item encontrado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}