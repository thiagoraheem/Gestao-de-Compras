# Sistema de Performance e Monitoramento em Tempo Real

Este documento descreve o sistema completo de otimização de performance e monitoramento em tempo real implementado no projeto.

## 📋 Visão Geral

O sistema implementa uma solução completa de otimização de atualizações em tempo real, incluindo:

- **WebSocket Server e Client** com reconexão automática
- **Smart Polling Service** com backoff exponencial
- **Local Cache Manager** com IndexedDB
- **React Hooks Otimizados** que combinam WebSocket + polling + cache
- **Sistema de Notificação por Eventos** no backend
- **Middleware de Cache Inteligente** com compressão GZIP
- **Sistema de Métricas e Monitoramento** completo
- **Testes de Performance** automatizados

## 🏗️ Arquitetura

### Backend Components

#### 1. WebSocket Server (`server/websocket-server.js`)
- Gerenciamento de conexões WebSocket
- Sistema de autenticação e autorização
- Heartbeat e health checks automáticos
- Broadcast de eventos em tempo real
- Métricas de conexão e performance

#### 2. Smart Polling Service (`server/smart-polling.js`)
- Polling inteligente com backoff exponencial
- Detecção de atividade do usuário
- Fallback automático quando WebSocket falha
- Otimização baseada em padrões de uso

#### 3. Local Cache Manager (`server/cache-manager.js`)
- Cache local com IndexedDB
- Validação de ETags e timestamps
- Gerenciamento de TTL por tipo de dados
- Compressão automática de dados

#### 4. Performance Monitor (`server/performance-monitor.js`)
- Coleta de métricas em tempo real
- Sistema de alertas configurável
- Análise de tendências e padrões
- Relatórios de performance automáticos

#### 5. Event Notification System (`server/event-notification.js`)
- Sistema de eventos baseado em EventEmitter
- Delta updates para reduzir payload
- Compressão GZIP automática
- Roteamento inteligente de eventos

### Frontend Components

#### 1. React Hooks Otimizados (`client/src/hooks/`)

##### `useOptimizedQuery.ts`
Hook principal que combina WebSocket, polling e cache:

```typescript
const { data, loading, error } = useOptimizedQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  realTime: {
    enabled: true,
    events: ['product:created', 'product:updated']
  },
  polling: {
    enabled: true,
    interval: 30000,
    backoffMultiplier: 1.5
  },
  cache: {
    enabled: true,
    ttl: 300000,
    staleWhileRevalidate: true
  }
});
```

##### `useRealTimeData.ts`
Hook especializado para dados em tempo real:

```typescript
const { data, connectionStatus, stats } = useRealTimeData({
  resource: 'products',
  autoRefresh: true,
  optimizations: {
    debounceMs: 300,
    batchUpdates: true,
    deltaUpdates: true
  }
});
```

#### 2. WebSocket Client (`client/src/services/websocket-client.ts`)
- Conexão WebSocket com reconexão automática
- Sistema de heartbeat
- Gerenciamento de subscriptions
- Buffer de mensagens offline

#### 3. Cache Service (`client/src/services/cache-service.ts`)
- Interface unificada para cache
- Suporte a IndexedDB e localStorage
- Validação de dados e TTL
- Sincronização automática

## 🚀 Como Usar

### 1. Configuração Inicial

Certifique-se de que as variáveis de ambiente estão configuradas no `.env`:

```env
# WebSocket Configuration
WEBSOCKET_PORT=3001
WEBSOCKET_HEARTBEAT_INTERVAL=30000
WEBSOCKET_CONNECTION_TIMEOUT=5000

# Smart Polling Configuration
SMART_POLLING_ENABLED=true
SMART_POLLING_BASE_INTERVAL=30000
SMART_POLLING_MAX_INTERVAL=300000
SMART_POLLING_BACKOFF_MULTIPLIER=1.5

# Cache Configuration
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300000
CACHE_MAX_SIZE=100
CACHE_COMPRESSION_ENABLED=true

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
METRICS_COLLECTION_INTERVAL=5000
ALERT_RESPONSE_TIME_THRESHOLD=1000
ALERT_MEMORY_THRESHOLD=512
ALERT_CACHE_HIT_RATE_THRESHOLD=70
```

### 2. Usando os Hooks no React

#### Exemplo Básico
```typescript
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';

function ProductList() {
  const { data: products, loading, error } = useOptimizedQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(res => res.json()),
    realTime: { enabled: true },
    polling: { enabled: true, interval: 30000 },
    cache: { enabled: true, ttl: 300000 }
  });

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div>
      {products?.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

#### Exemplo Avançado com Tempo Real
```typescript
import { useRealTimeData } from '@/hooks/useRealTimeData';

function RealTimeStats() {
  const {
    data: stats,
    connectionStatus,
    dataSource,
    controls
  } = useRealTimeData({
    resource: 'system-stats',
    realTime: {
      enabled: true,
      events: ['stats:updated'],
      reconnectAttempts: 5
    },
    polling: {
      enabled: true,
      interval: 10000,
      adaptiveInterval: true
    },
    optimizations: {
      debounceMs: 500,
      batchUpdates: true,
      deltaUpdates: true
    }
  });

  return (
    <div>
      <div>Status: {connectionStatus.websocket}</div>
      <div>Fonte: {dataSource.current}</div>
      <div>CPU: {stats?.cpu}%</div>
      <div>Memória: {stats?.memory}MB</div>
      
      <button onClick={controls.forceRefresh}>
        Atualizar Agora
      </button>
      <button onClick={controls.reconnectWebSocket}>
        Reconectar WebSocket
      </button>
    </div>
  );
}
```

### 3. Componente de Demonstração

O sistema inclui um componente completo de demonstração em `client/src/components/RealTimeDemo.tsx` que mostra:

- Conexão WebSocket em tempo real
- Polling inteligente
- Cache local
- Métricas de performance
- Controles manuais

## 📊 Monitoramento e Testes

### Scripts Disponíveis

```bash
# Testes de performance completos
npm run test:performance

# Teste de carga com Artillery
npm run test:load

# Teste específico de WebSocket
npm run test:websocket

# Monitoramento em tempo real (5 minutos)
npm run monitor:realtime

# Análise de performance
npm run monitor:analyze

# Monitoramento completo + análise
npm run monitor:full
```

### Testes de Performance

#### 1. Artillery Load Testing
- **Configuração**: `tests/performance/artillery-config.yml`
- **Fases**: Warm-up, Load, Stress, Spike
- **Métricas**: Response time, throughput, error rate
- **Thresholds**: P95 < 500ms, P50 < 200ms, Error rate < 1%

#### 2. WebSocket Load Testing
- **Configuração**: `tests/performance/websocket-load-test.yml`
- **Cenários**: Conexão, autenticação, mensagens, estabilidade
- **Métricas**: Connection time, message latency, error rate

#### 3. Monitoramento em Tempo Real
- **Script**: `tests/performance/monitor-realtime.js`
- **Duração**: Configurável (padrão: 5 minutos)
- **Métricas**: Response time, memory usage, cache hit rate, health status
- **Alertas**: Automáticos baseados em thresholds

#### 4. Análise de Performance
- **Script**: `tests/performance/analyze-performance.js`
- **Relatórios**: HTML e JSON
- **Scoring**: Sistema de pontuação 0-100
- **Recomendações**: Automáticas baseadas em análise

### Métricas Coletadas

#### Métricas de Performance
- **Response Time**: Média, P50, P95, P99
- **Memory Usage**: Heap used, heap total, RSS
- **CPU Usage**: Percentual de uso
- **Cache Performance**: Hit rate, miss rate, size

#### Métricas de WebSocket
- **Connections**: Total, active, errors
- **Messages**: Sent, received, errors
- **Latency**: Connection time, message latency

#### Métricas de Sistema
- **Health Status**: Healthy, warning, critical
- **Alerts**: Total, por categoria
- **Uptime**: Tempo de atividade
- **Throughput**: Requests per second

## 🎯 Objetivos de Performance

O sistema foi projetado para atingir os seguintes objetivos:

### Métricas Alvo
- **Redução de Requisições**: 60% menos requisições desnecessárias
- **Latência**: < 500ms para 95% das requisições
- **Cache Hit Rate**: > 70%
- **Memory Usage**: < 512MB em condições normais
- **Error Rate**: < 1%
- **WebSocket Uptime**: > 99%

### Otimizações Implementadas
1. **Smart Polling**: Reduz polling quando não há atividade
2. **Delta Updates**: Envia apenas mudanças, não dados completos
3. **Compression**: GZIP automático para payloads > 1KB
4. **Connection Pooling**: Reutilização de conexões HTTP
5. **Batch Updates**: Agrupa múltiplas atualizações
6. **Debouncing**: Evita atualizações excessivas
7. **Stale While Revalidate**: Serve cache enquanto atualiza

## 🔧 Configuração Avançada

### Configuração de Cache
```typescript
const cacheConfig = {
  enabled: true,
  ttl: 300000, // 5 minutos
  maxSize: 100, // máximo 100 entradas
  compression: true,
  staleWhileRevalidate: true,
  strategies: {
    products: { ttl: 600000 }, // 10 minutos
    users: { ttl: 180000 },    // 3 minutos
    stats: { ttl: 30000 }      // 30 segundos
  }
};
```

### Configuração de WebSocket
```typescript
const wsConfig = {
  heartbeatInterval: 30000,
  connectionTimeout: 5000,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  authentication: {
    required: true,
    timeout: 10000
  }
};
```

### Configuração de Polling
```typescript
const pollingConfig = {
  baseInterval: 30000,
  maxInterval: 300000,
  backoffMultiplier: 1.5,
  adaptiveInterval: true,
  userActivityDetection: true,
  fallbackEnabled: true
};
```

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. WebSocket não conecta
- Verifique se o servidor WebSocket está rodando na porta correta
- Confirme as configurações de firewall
- Verifique os logs do servidor para erros de autenticação

#### 2. Cache não funciona
- Verifique se IndexedDB está disponível no browser
- Confirme as configurações de TTL
- Verifique se há espaço suficiente no storage

#### 3. Performance baixa
- Execute `npm run monitor:realtime` para identificar gargalos
- Verifique o uso de memória e CPU
- Analise os logs de performance

#### 4. Polling excessivo
- Verifique se a detecção de atividade está funcionando
- Confirme as configurações de backoff
- Monitore os logs de polling

### Logs e Debugging

#### Habilitar logs detalhados
```env
DEBUG=websocket:*,polling:*,cache:*,performance:*
LOG_LEVEL=debug
```

#### Monitoramento em produção
```bash
# Monitoramento contínuo
npm run monitor:realtime -- --duration=3600 --interval=10

# Análise de logs
npm run monitor:analyze

# Relatório completo
npm run monitor:full
```

## 📈 Roadmap

### Próximas Funcionalidades
- [ ] Dashboard de métricas em tempo real
- [ ] Alertas por email/Slack
- [ ] Clustering para WebSocket
- [ ] Cache distribuído com Redis
- [ ] Machine Learning para otimização automática
- [ ] Integração com APM tools (New Relic, DataDog)

### Melhorias Planejadas
- [ ] Compressão de mensagens WebSocket
- [ ] Lazy loading de componentes
- [ ] Service Worker para cache offline
- [ ] GraphQL subscriptions
- [ ] Edge caching com CDN

## 🤝 Contribuindo

Para contribuir com o sistema de performance:

1. Execute os testes antes de fazer mudanças: `npm run test:all`
2. Monitore o impacto das mudanças: `npm run monitor:full`
3. Documente novas configurações e funcionalidades
4. Mantenha os thresholds de performance atualizados

## 📚 Referências

- [WebSocket API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Artillery Load Testing](https://artillery.io/docs/)
- [Performance Best Practices](https://web.dev/performance/)

---

**Nota**: Este sistema foi projetado para ser altamente configurável e extensível. Consulte os arquivos de configuração individuais para opções avançadas.