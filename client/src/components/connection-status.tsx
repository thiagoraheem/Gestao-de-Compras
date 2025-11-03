import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, Activity, Database, Clock } from 'lucide-react';
import { useRealTimeData } from '@/hooks/useRealTimeData';

export const ConnectionStatus: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState({
    isWebSocketConnected: false,
    isPollingActive: false,
    cacheHitRate: 0,
    totalUpdates: 0,
    lastUpdateTime: null as Date | null
  });

  // Use real-time data hook to get system status
  const { 
    isWebSocketConnected, 
    isPollingActive, 
    cacheHitRate,
    totalUpdates,
    lastUpdateTime 
  } = useRealTimeData({
    queryKey: ['system-status'],
    queryFn: async () => {
      const response = await fetch('/api/metrics');
      return response.json();
    },
    enableWebSocket: true,
    enablePolling: true,
    enableCache: true,
    subscribeToResource: 'system',
    subscribeToEvents: ['metrics', 'status'],
    pollingInterval: 10000, // 10 seconds
    cacheTimeout: 30000 // 30 seconds
  });

  useEffect(() => {
    setSystemMetrics({
      isWebSocketConnected: isWebSocketConnected || false,
      isPollingActive: isPollingActive || false,
      cacheHitRate: cacheHitRate || 0,
      totalUpdates: totalUpdates || 0,
      lastUpdateTime: lastUpdateTime || null
    });
  }, [isWebSocketConnected, isPollingActive, cacheHitRate, totalUpdates, lastUpdateTime]);

  const getWebSocketStatus = () => {
    if (systemMetrics.isWebSocketConnected) {
      return {
        icon: <Wifi className="h-3 w-3" />,
        variant: 'default' as const,
        text: 'WebSocket Conectado',
        details: `Sistema em tempo real ativo`
      };
    } else {
      return {
        icon: <WifiOff className="h-3 w-3" />,
        variant: 'destructive' as const,
        text: 'WebSocket Desconectado',
        details: 'Usando polling como fallback'
      };
    }
  };

  const getCacheStatus = () => {
    const hitRate = systemMetrics.cacheHitRate;
    if (hitRate > 70) {
      return {
        icon: <Database className="h-3 w-3" />,
        variant: 'default' as const,
        text: `Cache: ${hitRate.toFixed(1)}%`,
        details: `Alta eficiência de cache`
      };
    } else if (hitRate > 40) {
      return {
        icon: <Database className="h-3 w-3" />,
        variant: 'secondary' as const,
        text: `Cache: ${hitRate.toFixed(1)}%`,
        details: `Eficiência moderada de cache`
      };
    } else {
      return {
        icon: <Database className="h-3 w-3" />,
        variant: 'destructive' as const,
        text: `Cache: ${hitRate.toFixed(1)}%`,
        details: `Baixa eficiência de cache`
      };
    }
  };

  const getPollingStatus = () => {
    const now = Date.now();
    const timeSinceLastUpdate = systemMetrics.lastUpdateTime ? now - systemMetrics.lastUpdateTime.getTime() : 0;
    const isActive = systemMetrics.isPollingActive && timeSinceLastUpdate < 30000; // 30 seconds

    if (isActive) {
      return {
        icon: <Activity className="h-3 w-3" />,
        variant: 'default' as const,
        text: 'Polling Ativo',
        details: `${systemMetrics.totalUpdates} atualizações recebidas`
      };
    } else {
      return {
        icon: <Clock className="h-3 w-3" />,
        variant: 'secondary' as const,
        text: 'Polling Inativo',
        details: 'Sistema em modo de espera'
      };
    }
  };

  const wsStatus = getWebSocketStatus();
  const cacheStatus = getCacheStatus();
  const pollingStatus = getPollingStatus();

  return (
    <TooltipProvider>
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={wsStatus.variant} className="flex items-center space-x-1">
              {wsStatus.icon}
              <span className="hidden sm:inline">{wsStatus.text}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{wsStatus.details}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={cacheStatus.variant} className="flex items-center space-x-1">
              {cacheStatus.icon}
              <span className="hidden sm:inline">{cacheStatus.text}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{cacheStatus.details}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={pollingStatus.variant} className="flex items-center space-x-1">
              {pollingStatus.icon}
              <span className="hidden sm:inline">{pollingStatus.text}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{pollingStatus.details}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};