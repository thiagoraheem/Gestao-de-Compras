import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, X, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PHASE_LABELS, URGENCY_LABELS, URGENCY_LEVELS } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NotificationsProps {
  className?: string;
}

export default function Notifications({ className }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: purchaseRequests } = useQuery({
    queryKey: ["/api/purchase-requests"],
  });

  // Filter requests that need attention (pending approvals, quotations, etc.)
  const pendingNotifications = Array.isArray(purchaseRequests) 
    ? purchaseRequests.filter((request: any) => {
        // Show notifications for requests in approval phases or quotation phase
        return request.currentPhase === "aprovacao_a1" || 
               request.currentPhase === "cotacao" ||
               request.currentPhase === "aprovacao_a2";
      })
    : [];

  const notificationCount = pendingNotifications.length;

  const getNotificationMessage = (request: any) => {
    switch (request.currentPhase) {
      case "aprovacao_a1":
        return "Aguardando aprovação A1";
      case "cotacao":
        return "Aguardando cotação";
      case "aprovacao_a2":
        return "Aguardando aprovação A2";
      default:
        return "Requer atenção";
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case URGENCY_LEVELS.ALTA_URGENCIA:
        return "border-l-red-600 bg-red-100";
      case URGENCY_LEVELS.ALTO:
        return "border-l-red-500 bg-red-50";
      case URGENCY_LEVELS.MEDIO:
        return "border-l-yellow-500 bg-yellow-50";
      default:
        return "border-l-blue-500 bg-blue-50";
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-9 w-9 rounded-full"
      >
        <Bell className="h-5 w-5" />
        {notificationCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {notificationCount > 9 ? "9+" : notificationCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Panel */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notifications Dropdown */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-2">
              {notificationCount === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">Nenhuma notificação no momento</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingNotifications.map((request: any) => (
                    <Card 
                      key={request.id} 
                      className={cn(
                        "border-l-4 transition-colors hover:bg-gray-50 cursor-pointer",
                        getUrgencyColor(request.urgency)
                      )}
                      onClick={() => {
                        // TODO: Navigate to specific request management page
                        setIsOpen(false);
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {request.requestNumber}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {PHASE_LABELS[request.currentPhase as keyof typeof PHASE_LABELS]}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 truncate mb-1">
                              {request.justification}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {getNotificationMessage(request)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(request.createdAt), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            </div>
                          </div>
                          <Badge 
                            variant={request.urgency === URGENCY_LEVELS.ALTO ? "destructive" : "secondary"}
                            className="ml-2 text-xs"
                          >
                            {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {notificationCount > 0 && (
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => {
                    // TODO: Navigate to request management page
                    setIsOpen(false);
                  }}
                >
                  Ver todas as solicitações
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}