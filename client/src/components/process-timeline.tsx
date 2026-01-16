import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  ShoppingCart, 
  Package, 
  Archive,
  FilePlus,
  History,
  Clock
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  phase: string;
  action: string;
  userId?: number;
  userName: string;
  timestamp: string;
  status: string;
  icon: string;
  description: string;
  reason?: string;
}

interface ProcessTimelineProps {
  timeline: TimelineEvent[];
  isLoading?: boolean;
}

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'file-plus': <FilePlus className="h-4 w-4" />,
    'check-circle': <CheckCircle className="h-4 w-4" />,
    'x-circle': <XCircle className="h-4 w-4" />,
    'file-text': <FileText className="h-4 w-4" />,
    'shopping-cart': <ShoppingCart className="h-4 w-4" />,
    'package-check': <Package className="h-4 w-4" />,
    'archive': <Archive className="h-4 w-4" />,
    'check-circle-2': <CheckCircle className="h-4 w-4" />,
    'clock': <Clock className="h-4 w-4" />
  };
  
  return iconMap[iconName] || <Clock className="h-4 w-4" />;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'approved':
      return 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getPhaseLabel = (phase: string) => {
  const phaseLabels: Record<string, string> = {
    'solicitacao': 'Solicitação',
    'aprovacao_a1': 'Aprovação A1',
    'cotacao': 'Cotação (RFQ)',
    'aprovacao_a2': 'Aprovação A2',
    'pedido_compra': 'Pedido de Compra',
    'recebimento': 'Recebimento',
    'conf_fiscal': 'Conf. Fiscal',
    'conclusao_compra': 'Conclusão',
    'arquivado': 'Arquivado'
  };
  
  return phaseLabels[phase] || phase;
};

export default function ProcessTimeline({ timeline, isLoading }: ProcessTimelineProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Linha do Tempo Completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando timeline...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Linha do Tempo Completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum evento encontrado na timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <History className="h-5 w-5" />
          Linha do Tempo Completa do Processo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border"></div>
          
          <div className="space-y-6">
            {timeline.map((event, index) => (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`
                  flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center z-10
                  ${getStatusColor(event.status)}
                `}>
                  {getIconComponent(event.icon)}
                </div>
                
                {/* Event content */}
                <div className="flex-1 min-w-0 pb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          {event.action}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {getPhaseLabel(event.phase)}
                        </Badge>
                        {event.status === 'approved' && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Aprovado
                          </Badge>
                        )}
                        {event.status === 'rejected' && (
                          <Badge variant="destructive" className="text-xs">
                            Rejeitado
                          </Badge>
                        )}
                      </div>
                       
                      <p className="text-sm text-muted-foreground mb-2">
                        {event.description}
                      </p>
                       
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          👤 {event.userName}
                        </span>
                        <span className="flex items-center gap-1">
                          📅 {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                       
                      {event.reason && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                          <p className="text-sm text-red-600 dark:text-red-300">
                            <strong>Motivo:</strong> {event.reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
