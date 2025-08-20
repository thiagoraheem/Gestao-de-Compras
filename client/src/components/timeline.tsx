import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  ShoppingCart, 
  Package, 
  Archive,
  Clock,
  User,
  Calendar,
  MessageSquare,
  FilePlus,
  PackageCheck,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    'file-plus': FilePlus,
    'check-circle': CheckCircle,
    'x-circle': XCircle,
    'file-text': FileText,
    'shopping-cart': ShoppingCart,
    'package-check': PackageCheck,
    'archive': Archive,
    'check-circle-2': CheckCircle2,
    'clock': Clock,
    'user': User,
    'calendar': Calendar,
    'message-square': MessageSquare,
    'package': Package
  };
  
  return icons[iconName] || Clock;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return 'Concluído';
    case 'approved':
      return 'Aprovado';
    case 'rejected':
      return 'Reprovado';
    case 'pending':
      return 'Pendente';
    case 'in_progress':
      return 'Em Andamento';
    default:
      return status;
  }
}

function formatDateTime(dateString: string) {
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
}

export default function Timeline({ events, className }: TimelineProps) {
  if (!events || events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Linha do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhum evento encontrado no histórico.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Linha do Tempo Completa
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Histórico completo de todas as etapas do processo
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {events.map((event, index) => {
              const IconComponent = getIconComponent(event.icon);
              const isLast = index === events.length - 1;
              
              return (
                <div key={event.id} className="relative flex items-start gap-4">
                  {/* Timeline dot */}
                  <div className={cn(
                    "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background",
                    event.status === 'approved' || event.status === 'completed' 
                      ? "border-green-500 text-green-600" 
                      : event.status === 'rejected'
                      ? "border-red-500 text-red-600"
                      : "border-blue-500 text-blue-600"
                  )}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  
                  {/* Event content */}
                  <div className="flex-1 min-w-0 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{event.action}</h4>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getStatusColor(event.status))}
                          >
                            {getStatusLabel(event.status)}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {event.description}
                        </p>
                        
                        {event.reason && (
                          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-2">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-red-800">Motivo da reprovação:</p>
                                <p className="text-sm text-red-700">{event.reason}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(event.timestamp)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.userName}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {!isLast && <Separator className="mt-6" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}