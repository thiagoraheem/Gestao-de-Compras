import { useState, useEffect } from 'react';
import { getWebSocketClient } from '@/lib/websocket-client';

export interface WebSocketStatus {
  connected: boolean;
  authenticated: boolean;
  connecting: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  connectionId: string | null;
}

export function useWebSocketStatus() {
  // Estado inicial com valores padrão seguros
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    authenticated: false,
    connecting: false,
    reconnectAttempts: 0,
    lastHeartbeat: 0,
    connectionId: null,
  });

  useEffect(() => {
    let wsClient: any = null;
    
    try {
      wsClient = getWebSocketClient({ debug: false });
    } catch (error) {
      console.error('Erro ao inicializar WebSocket client:', error);
      return;
    }
    
    // Função para atualizar o status
    const updateStatus = () => {
      try {
        const connectionStatus = wsClient.getConnectionStatus();
        setStatus({
          connected: connectionStatus.connected || false,
          authenticated: connectionStatus.authenticated || false,
          connecting: false, // Será atualizado pelos eventos
          reconnectAttempts: connectionStatus.reconnectAttempts || 0,
          lastHeartbeat: connectionStatus.lastHeartbeat || 0,
          connectionId: connectionStatus.connectionId || null,
        });
      } catch (error) {
        console.error('Erro ao atualizar status do WebSocket:', error);
        // Manter estado padrão em caso de erro
        setStatus({
          connected: false,
          authenticated: false,
          connecting: false,
          reconnectAttempts: 0,
          lastHeartbeat: 0,
          connectionId: null,
        });
      }
    };

    // Inicializar conexão WebSocket automaticamente
    const initializeConnection = async () => {
      try {
        if (wsClient && typeof wsClient.connect === 'function') {
          wsClient.connect();
        }
      } catch (error) {
        console.error('Erro ao conectar WebSocket:', error);
      }
    };

    // Eventos do WebSocket
    const handleConnected = () => {
      setStatus(prev => ({ ...prev, connected: true, connecting: false }));
    };

    const handleDisconnected = () => {
      setStatus(prev => ({ ...prev, connected: false, authenticated: false, connecting: false }));
    };

    const handleConnecting = () => {
      setStatus(prev => ({ ...prev, connecting: true }));
    };

    const handleAuthenticated = () => {
      setStatus(prev => ({ ...prev, authenticated: true }));
    };

    const handleReconnecting = () => {
      setStatus(prev => ({ ...prev, connecting: true }));
    };

    const handleHeartbeat = () => {
      setStatus(prev => ({ ...prev, lastHeartbeat: Date.now() }));
    };

    // Registrar listeners apenas se o wsClient foi inicializado corretamente
    if (wsClient && typeof wsClient.on === 'function') {
      wsClient.on('connected', handleConnected);
      wsClient.on('disconnected', handleDisconnected);
      wsClient.on('connecting', handleConnecting);
      wsClient.on('authenticated', handleAuthenticated);
      wsClient.on('reconnecting', handleReconnecting);
      wsClient.on('heartbeat', handleHeartbeat);

      // Atualizar status inicial
      updateStatus();

      // Inicializar conexão
      initializeConnection();
    }

    // Atualizar status periodicamente
    const interval = setInterval(updateStatus, 1000);

    // Cleanup
    return () => {
      clearInterval(interval);
      if (wsClient && typeof wsClient.off === 'function') {
        wsClient.off('connected', handleConnected);
        wsClient.off('disconnected', handleDisconnected);
        wsClient.off('connecting', handleConnecting);
        wsClient.off('authenticated', handleAuthenticated);
        wsClient.off('reconnecting', handleReconnecting);
        wsClient.off('heartbeat', handleHeartbeat);
      }
    };
  }, []);

  // Garantir que sempre retornamos um objeto válido
  return {
    status: status || {
      connected: false,
      authenticated: false,
      connecting: false,
      reconnectAttempts: 0,
      lastHeartbeat: 0,
      connectionId: null,
    }
  };
}