import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, Activity, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConnectionStatusProps {
  isConnected: boolean;
  lastSync: Date;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  connectionType: 'websocket' | 'polling' | 'offline';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  lastSync,
  error,
  syncStatus,
  connectionType
}) => {
  const getConnectionIcon = () => {
    switch (connectionType) {
      case 'websocket':
        return <Wifi className="h-3 w-3" />;
      case 'polling':
        return <Activity className="h-3 w-3" />;
      case 'offline':
        return <WifiOff className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  const getConnectionVariant = () => {
    if (error) return 'destructive' as const;
    if (!isConnected) return 'secondary' as const;
    return 'default' as const;
  };

  const getConnectionText = () => {
    if (error) return 'Erro';
    if (syncStatus === 'syncing') return 'Sincronizando...';
    
    switch (connectionType) {
      case 'websocket':
        return 'Tempo Real';
      case 'polling':
        return 'Polling';
      case 'offline':
        return 'Offline';
      default:
        return 'Desconhecido';
    }
  };

  const getTooltipContent = () => {
    const lastSyncFormatted = format(lastSync, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    
    if (error) {
      return (
        <div>
          <p className="font-semibold text-red-400">Erro de Conexão</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-1">Última sincronização: {lastSyncFormatted}</p>
        </div>
      );
    }

    switch (connectionType) {
      case 'websocket':
        return (
          <div>
            <p className="font-semibold text-green-400">WebSocket Conectado</p>
            <p className="text-sm">Atualizações em tempo real ativas</p>
            <p className="text-xs mt-1">Última sincronização: {lastSyncFormatted}</p>
          </div>
        );
      case 'polling':
        return (
          <div>
            <p className="font-semibold text-blue-400">Modo Polling</p>
            <p className="text-sm">Verificando atualizações a cada 3 segundos</p>
            <p className="text-xs mt-1">Última sincronização: {lastSyncFormatted}</p>
          </div>
        );
      case 'offline':
        return (
          <div>
            <p className="font-semibold text-gray-400">Offline</p>
            <p className="text-sm">Sem conexão com o servidor</p>
            <p className="text-xs mt-1">Última sincronização: {lastSyncFormatted}</p>
          </div>
        );
      default:
        return (
          <div>
            <p className="font-semibold">Status Desconhecido</p>
            <p className="text-xs mt-1">Última sincronização: {lastSyncFormatted}</p>
          </div>
        );
    }
  };

  const getSyncStatusIndicator = () => {
    if (syncStatus === 'syncing') {
      return (
        <div className="flex items-center space-x-1">
          <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-current"></div>
          <span className="text-xs">Sync</span>
        </div>
      );
    }
    return null;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={getConnectionVariant()} 
              className="flex items-center space-x-1 cursor-help"
            >
              {getConnectionIcon()}
              <span className="hidden sm:inline text-xs">{getConnectionText()}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>

        {getSyncStatusIndicator()}

        {/* Last sync time indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground cursor-help">
              <Clock className="h-3 w-3" />
              <span className="hidden md:inline">
                {format(lastSync, 'HH:mm:ss')}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Última sincronização: {format(lastSync, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};