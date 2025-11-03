import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocketStatus } from "@/hooks/useWebSocketStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function WebSocketIndicator() {
  const { status } = useWebSocketStatus();

  // Verificação de segurança para evitar erros quando status é undefined
  if (!status) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Carregando...
        </span>
      </div>
    );
  }

  const getStatusColor = () => {
    if (!status) return 'bg-gray-400';
    if (status.connecting) return 'bg-yellow-500';
    if (status.connected && status.authenticated) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (!status) return 'Carregando...';
    if (status.connecting) return 'Conectando...';
    if (status.connected && status.authenticated) return 'Conectado';
    return 'Desconectado';
  };

  const getTooltipText = () => {
    if (!status) return 'Carregando status do WebSocket...';
    if (status.connecting) return 'WebSocket conectando ao servidor';
    if (status.connected && status.authenticated) {
      return `WebSocket conectado e autenticado${status.lastHeartbeat ? ` (último heartbeat: ${new Date(status.lastHeartbeat).toLocaleTimeString()})` : ''}`;
    }
    return `WebSocket desconectado${status.reconnectAttempts > 0 ? ` (tentativas de reconexão: ${status.reconnectAttempts})` : ''}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getStatusText()}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}