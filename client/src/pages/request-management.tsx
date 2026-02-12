import { useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { PURCHASE_PHASES, PHASE_LABELS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";

const RequestPhase = lazy(() => import("@/components/request-phase"));
const RequestView = lazy(() => import("@/components/request-view"));
const ApprovalA1Phase = lazy(() => import("@/components/approval-a1-phase"));
const ApprovalA2Phase = lazy(() => import("@/components/approval-a2-phase"));
const QuotationPhase = lazy(() => import("@/components/quotation-phase"));
const PurchaseOrderPhase = lazy(() => import("@/components/purchase-order-phase"));
const ReceiptPhase = lazy(() => import("@/components/receipt-phase"));
const FiscalConferencePhase = lazy(() => import("@/components/fiscal-conference-phase"));
const ConclusionPhase = lazy(() => import("@/components/conclusion-phase"));
import { 
  FileText, 
  CheckCircle, 
  ShoppingCart, 
  Search, 
  Filter,
  Calendar,
  DollarSign,
  User,
  Building
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RequestManagementPage() {
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests"],
  });

  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const filteredRequests = requests?.filter(request => {
    const matchesPhase = filterPhase === 'all' || request.currentPhase === filterPhase;
    const matchesUrgency = filterUrgency === 'all' || request.urgency === filterUrgency;
    const matchesDepartment = filterDepartment === 'all' || request.departmentId?.toString() === filterDepartment;
    const matchesSearch = !searchTerm || 
      request.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.justification.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.requester?.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesPhase && matchesUrgency && matchesDepartment && matchesSearch;
  }) || [];

  const handleOpenPhase = (request: any, phase: string) => {
    setSelectedRequest(request);
    setSelectedPhase(phase);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRequest(null);
    setSelectedPhase('');
  };

  const canAccessPhase = (request: any, phase: string) => {
    switch (phase) {
      case PURCHASE_PHASES.SOLICITACAO:
        return true; // Anyone can view request details
      case PURCHASE_PHASES.APROVACAO_A1:
        return user?.isApproverA1 || false;
      case PURCHASE_PHASES.COTACAO:
        return user?.isBuyer || false;
      case PURCHASE_PHASES.APROVACAO_A2:
        return user?.isApproverA2 || false;
      case PURCHASE_PHASES.PEDIDO_COMPRA:
        return true; // Anyone can view purchase order details
      case PURCHASE_PHASES.RECEBIMENTO:
        return true; // Anyone can view receipt details
      case PURCHASE_PHASES.CONF_FISCAL:
        return user?.isBuyer || false; // Only buyers can view fiscal conference details
      case PURCHASE_PHASES.CONCLUSAO_COMPRA:
        return true; // Anyone can view conclusion details
      case PURCHASE_PHASES.ARQUIVADO:
        return true; // Anyone can view archived request details
      default:
        return false;
    }
  };

  const getPhaseComponent = () => {
    if (!selectedRequest || !selectedPhase) return null;

    return (
      <Suspense fallback={<div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
        {(() => {
          switch (selectedPhase) {
            case PURCHASE_PHASES.SOLICITACAO:
              return <RequestPhase request={selectedRequest} open={modalOpen} onOpenChange={setModalOpen} />;
            case PURCHASE_PHASES.APROVACAO_A1:
              return <ApprovalA1Phase request={selectedRequest} open={modalOpen} onOpenChange={setModalOpen} />;
            case PURCHASE_PHASES.APROVACAO_A2:
              return <ApprovalA2Phase request={selectedRequest} open={modalOpen} onOpenChange={setModalOpen} />;
            case PURCHASE_PHASES.COTACAO:
              return <QuotationPhase request={selectedRequest} open={modalOpen} onOpenChange={setModalOpen} />;
            case PURCHASE_PHASES.PEDIDO_COMPRA:
              return <PurchaseOrderPhase request={selectedRequest} onClose={handleCloseModal} />;
            case PURCHASE_PHASES.RECEBIMENTO:
              return <ReceiptPhase request={selectedRequest} onClose={handleCloseModal} />;
            case PURCHASE_PHASES.CONF_FISCAL:
              return <FiscalConferencePhase request={selectedRequest} onClose={handleCloseModal} />;
            case PURCHASE_PHASES.CONCLUSAO_COMPRA:
              return <ConclusionPhase request={selectedRequest} onClose={handleCloseModal} />;
            case PURCHASE_PHASES.ARQUIVADO:
              return <RequestView request={selectedRequest} />;
            default:
              return (
                <div className="p-8 text-center">
                  <h3 className="text-lg font-medium mb-2">Fase em desenvolvimento</h3>
                  <p className="text-muted-foreground">
                    Esta fase ainda está sendo implementada.
                  </p>
                </div>
              );
          }
        })()}
      </Suspense>
    );
  };

  const getRequestsByPhase = (phase: string) => {
    return filteredRequests.filter(request => request.currentPhase === phase);
  };

  const getPhaseBadgeVariant = (phase: string) => {
    switch (phase) {
      case PURCHASE_PHASES.SOLICITACAO:
        return 'default';
      case PURCHASE_PHASES.APROVACAO_A1:
        return 'secondary';
      case PURCHASE_PHASES.COTACAO:
        return 'outline';
      case PURCHASE_PHASES.APROVACAO_A2:
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case PURCHASE_PHASES.SOLICITACAO:
        return <FileText className="h-4 w-4" />;
      case PURCHASE_PHASES.APROVACAO_A1:
      case PURCHASE_PHASES.APROVACAO_A2:
        return <CheckCircle className="h-4 w-4" />;
      case PURCHASE_PHASES.COTACAO:
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando solicitações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Solicitações</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de compra através das diferentes fases do processo
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, descrição ou solicitante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por fase..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Fases</SelectItem>
                  {Object.entries(PURCHASE_PHASES).map(([key, value]) => (
                    <SelectItem key={value} value={value}>
                      {PHASE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por urgência..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Urgências</SelectItem>
                  {Object.entries(URGENCY_LABELS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por departamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Departamentos</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(PURCHASE_PHASES).slice(0, 4).map(([key, phase]) => {
          const count = getRequestsByPhase(phase).length;
          return (
            <Card key={phase}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getPhaseIcon(phase)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{count}</h3>
                    <p className="text-sm text-muted-foreground">{PHASE_LABELS[phase]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Requests by Phase */}
      <Tabs defaultValue={PURCHASE_PHASES.SOLICITACAO} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(PURCHASE_PHASES).slice(0, 4).map(([key, phase]) => (
            <TabsTrigger key={phase} value={phase} className="flex items-center gap-2">
              {getPhaseIcon(phase)}
              <span className="hidden sm:inline">{PHASE_LABELS[phase]}</span>
              <Badge variant="secondary" className="ml-2">
                {getRequestsByPhase(phase).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(PURCHASE_PHASES).slice(0, 4).map(([key, phase]) => (
          <TabsContent key={phase} value={phase} className="space-y-4">
            {getRequestsByPhase(phase).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="p-4 bg-muted/50 rounded-lg inline-block mb-4">
                    {getPhaseIcon(phase)}
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Nenhuma solicitação em {PHASE_LABELS[phase]}
                  </h3>
                  <p className="text-muted-foreground">
                    {phase === PURCHASE_PHASES.SOLICITACAO 
                      ? "Use o botão no canto inferior esquerdo para criar uma nova solicitação"
                      : "As solicitações aparecerão aqui conforme avançam no processo"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getRequestsByPhase(phase).map((request) => (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">#{request.requestNumber}</CardTitle>
                        <Badge variant={getPhaseBadgeVariant(request.currentPhase)}>
                          {request.currentPhase in PHASE_LABELS ? PHASE_LABELS[request.currentPhase as keyof typeof PHASE_LABELS] : request.currentPhase}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Solicitante:</span>
                          <span className="font-medium">
                            {request.requester?.firstName && request.requester?.lastName 
                              ? `${request.requester.firstName} ${request.requester.lastName}`
                              : request.requester?.username || 'N/A'
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Building className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Centro de Custo:</span>
                          <span className="font-medium">
                            {request.costCenter?.code}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Criado:</span>
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(request.createdAt), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>

                        {request.availableBudget && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Orçamento:</span>
                            <span className="font-medium">
                              R$ {parseFloat(request.availableBudget).toLocaleString('pt-BR', { 
                                minimumFractionDigits: 2 
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {request.category in CATEGORY_LABELS 
                            ? CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS] 
                            : request.category
                          }
                        </Badge>
                        <Badge 
                          variant={request.urgency === 'alta_urgencia' || request.urgency === 'alto' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {request.urgency in URGENCY_LABELS 
                            ? URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS] 
                            : request.urgency
                          }
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {request.justification}
                      </p>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPhase(request, request.currentPhase)}
                          disabled={!canAccessPhase(request, request.currentPhase)}
                          className="flex-1"
                        >
                          {request.currentPhase === PURCHASE_PHASES.SOLICITACAO || request.currentPhase === PURCHASE_PHASES.ARQUIVADO ? 'Visualizar' : 'Processar'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Phase Processing Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPhase && selectedPhase in PHASE_LABELS ? PHASE_LABELS[selectedPhase as keyof typeof PHASE_LABELS] : selectedPhase} - #{selectedRequest?.requestNumber}
            </DialogTitle>
            <DialogDescription>
              Gerencie a solicitação de compra na fase atual do processo.
            </DialogDescription>
          </DialogHeader>
          {getPhaseComponent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
