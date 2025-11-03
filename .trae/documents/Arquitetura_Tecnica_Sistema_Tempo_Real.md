# Arquitetura Técnica - Sistema de Atualizações em Tempo Real

## 1. Arquitetura Geral do Sistema

```mermaid
graph TD
    A[Cliente React] --> B[WebSocket Client]
    A --> C[Smart Polling Service]
    A --> D[Local Cache Manager]
    
    B --> E[WebSocket Server]
    C --> F[REST API Gateway]
    D --> G[IndexedDB]
    
    E --> H[Event Notification System]
    F --> I[Delta Response Service]
    H --> J[PostgreSQL Database]
    I --> J
    
    K[Metrics Service] --> L[Performance Monitor]
    E --> K
    F --> K
    
    subgraph "Frontend Layer"
        A
        B
        C
        D
        G
    end
    
    subgraph "Backend Layer"
        E
        F
        H
        I
        K
    end
    
    subgraph "Data Layer"
        J
    end
    
    subgraph "Monitoring Layer"
        L
    end
```

## 2. Especificação de Tecnologias

**Frontend**:
- React@18 + TypeScript
- TanStack Query@4 (React Query)
- Socket.io-client@4
- IndexedDB (via Dexie.js)
- Tailwind CSS@3
- Vite@4

**Backend**:
- Node.js@18 + Express@4
- Socket.io@4
- PostgreSQL@15
- Redis@7 (para cache de sessões WebSocket)
- Compression middleware (GZIP)
- Winston (logging)

**Infraestrutura**:
- Docker + Docker Compose
- Nginx (proxy reverso)
- PM2 (gerenciamento de processos)
- Artillery (testes de carga)

## 3. Definições de Rotas

### 3.1 Rotas Frontend

| Rota | Propósito | Funcionalidades Tempo Real |
|------|-----------|---------------------------|
| `/dashboard` | Dashboard principal | Métricas atualizadas automaticamente, gráficos dinâmicos |
| `/solicitacoes` | Kanban de solicitações | Movimentação automática de cards, contadores dinâmicos |
| `/cotacoes` | Gestão de cotações | Status atualizado quando fornecedores respondem |
| `/aprovacoes` | Fila de aprovações | Notificações instantâneas, lista atualizada automaticamente |
| `/pedidos` | Pedidos de compra | Status de entrega em tempo real, alertas automáticos |
| `/relatorios` | Relatórios e analytics | Dados sempre atualizados, gráficos responsivos |
| `/configuracoes` | Configurações do sistema | Status de conectividade, métricas de performance |

### 3.2 WebSocket Events

| Event | Direção | Payload | Descrição |
|-------|---------|---------|-----------|
| `connect` | Client → Server | `{ userId, token }` | Estabelece conexão autenticada |
| `subscribe` | Client → Server | `{ events: string[] }` | Inscreve em eventos específicos |
| `unsubscribe` | Client → Server | `{ events: string[] }` | Remove inscrição de eventos |
| `heartbeat` | Bidirectional | `{ timestamp }` | Mantém conexão ativa |
| `data_update` | Server → Client | `{ type, data, delta }` | Notifica mudanças nos dados |
| `notification` | Server → Client | `{ message, type, action }` | Envia notificações ao usuário |
| `metrics` | Server → Client | `{ performance, status }` | Métricas de performance |

## 4. APIs REST Otimizadas

### 4.1 APIs com Suporte a Delta Updates

**Solicitações de Compra**
```
GET /api/purchase-requests?etag=<hash>&since=<timestamp>
```

Request Headers:
| Header | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| If-None-Match | string | false | ETag para verificação de cache |
| Accept-Encoding | string | false | gzip, deflate para compressão |

Response:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| data | array | Lista de solicitações (completa ou delta) |
| etag | string | Hash para cache |
| isDelta | boolean | Indica se é resposta delta |
| timestamp | string | Timestamp da última modificação |

Exemplo Response (Delta):
```json
{
  "data": [
    {
      "id": "123",
      "status": "approved",
      "updatedAt": "2024-01-15T10:30:00Z",
      "_operation": "update"
    }
  ],
  "etag": "abc123def456",
  "isDelta": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Cotações**
```
GET /api/quotations?etag=<hash>&compress=true
```

Request:
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| etag | string | ETag para cache |
| compress | boolean | Habilita compressão GZIP |
| fields | string | Campos específicos (otimização) |

**Métricas de Performance**
```
GET /api/metrics/realtime
```

Response:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| activeConnections | number | Conexões WebSocket ativas |
| requestsPerMinute | number | Requisições por minuto |
| cacheHitRate | number | Taxa de acerto do cache |
| averageLatency | number | Latência média em ms |

### 4.2 APIs de Configuração

**Preferências de Notificação**
```
PUT /api/user/notification-preferences
```

Request Body:
```json
{
  "events": ["purchase_request_approved", "quotation_received"],
  "frequency": "immediate",
  "soundEnabled": true,
  "emailNotifications": false
}
```

## 5. Arquitetura do Servidor

```mermaid
graph TD
    A[Nginx Load Balancer] --> B[Express Server 1]
    A --> C[Express Server 2]
    
    B --> D[WebSocket Handler]
    B --> E[REST API Handler]
    B --> F[Metrics Middleware]
    
    C --> G[WebSocket Handler]
    C --> H[REST API Handler]
    C --> I[Metrics Middleware]
    
    D --> J[Redis Session Store]
    G --> J
    
    E --> K[PostgreSQL Primary]
    H --> L[PostgreSQL Replica]
    
    F --> M[Metrics Aggregator]
    I --> M
    
    subgraph "Load Balancer"
        A
    end
    
    subgraph "Application Servers"
        B
        C
        D
        E
        F
        G
        H
        I
    end
    
    subgraph "Data Layer"
        J
        K
        L
    end
    
    subgraph "Monitoring"
        M
    end
```

### 5.1 Componentes do Servidor

**WebSocket Manager** (`websocket-manager.ts`):
```typescript
interface WebSocketManager {
  connections: Map<string, WebSocketConnection>;
  subscriptions: Map<string, Set<string>>;
  
  handleConnection(socket: Socket): void;
  handleDisconnection(socketId: string): void;
  broadcastToSubscribers(event: string, data: any): void;
  sendToUser(userId: string, data: any): void;
}
```

**Event Notification System** (`event-system.ts`):
```typescript
interface EventNotificationSystem {
  subscribe(userId: string, events: string[]): void;
  unsubscribe(userId: string, events: string[]): void;
  notify(event: string, data: any, filters?: any): void;
  getSubscribers(event: string): string[];
}
```

**Delta Response Service** (`delta-service.ts`):
```typescript
interface DeltaResponseService {
  generateETag(data: any): string;
  createDelta(oldData: any, newData: any): any;
  compressResponse(data: any): Buffer;
  shouldSendDelta(etag: string, currentETag: string): boolean;
}
```

## 6. Modelo de Dados Otimizado

### 6.1 Schema do Banco de Dados

**Tabela de Conexões WebSocket**
```sql
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    socket_id VARCHAR(255) NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX idx_websocket_user_id ON websocket_connections(user_id);
CREATE INDEX idx_websocket_socket_id ON websocket_connections(socket_id);
```

**Tabela de Assinaturas de Eventos**
```sql
CREATE TABLE event_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    filters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_event_subscriptions_user_event ON event_subscriptions(user_id, event_type);
CREATE INDEX idx_event_subscriptions_type ON event_subscriptions(event_type) WHERE is_active = true;
```

**Tabela de Métricas de Performance**
```sql
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    user_id UUID REFERENCES users(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_performance_metrics_type_time ON performance_metrics(metric_type, recorded_at DESC);
```

**Tabela de Cache ETags**
```sql
CREATE TABLE cache_etags (
    resource_key VARCHAR(255) PRIMARY KEY,
    etag VARCHAR(64) NOT NULL,
    data_hash VARCHAR(64) NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_cache_etags_modified ON cache_etags(last_modified DESC);
```

### 6.2 Triggers para Notificações Automáticas

**Trigger para Solicitações de Compra**
```sql
CREATE OR REPLACE FUNCTION notify_purchase_request_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Notifica mudança via WebSocket
    PERFORM pg_notify('purchase_request_changed', 
        json_build_object(
            'id', COALESCE(NEW.id, OLD.id),
            'operation', TG_OP,
            'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
            'new_status', CASE WHEN TG_OP != 'DELETE' THEN NEW.status END,
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_request_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION notify_purchase_request_change();
```

**Trigger para Cotações**
```sql
CREATE OR REPLACE FUNCTION notify_quotation_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('quotation_changed',
        json_build_object(
            'id', COALESCE(NEW.id, OLD.id),
            'purchase_request_id', COALESCE(NEW.purchase_request_id, OLD.purchase_request_id),
            'operation', TG_OP,
            'supplier_id', CASE WHEN TG_OP != 'DELETE' THEN NEW.supplier_id END,
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON quotations
    FOR EACH ROW EXECUTE FUNCTION notify_quotation_change();
```

### 6.3 Índices para Performance

```sql
-- Índices para consultas de tempo real
CREATE INDEX CONCURRENTLY idx_purchase_requests_status_updated 
ON purchase_requests(status, updated_at DESC) 
WHERE status IN ('pending_a1', 'pending_a2', 'pending_a3');

CREATE INDEX CONCURRENTLY idx_quotations_active 
ON quotations(purchase_request_id, created_at DESC) 
WHERE status = 'active';

-- Índices para métricas
CREATE INDEX CONCURRENTLY idx_audit_logs_realtime 
ON audit_logs(table_name, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Índice parcial para conexões ativas
CREATE INDEX CONCURRENTLY idx_websocket_active 
ON websocket_connections(user_id, last_heartbeat DESC) 
WHERE last_heartbeat > NOW() - INTERVAL '5 minutes';
```

## 7. Configuração de Ambiente

### 7.1 Variáveis de Ambiente (.env)

```bash
# Configurações do WebSocket
WEBSOCKET_PORT=3001
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_HEARTBEAT_INTERVAL=30000
WEBSOCKET_CONNECTION_TIMEOUT=60000

# Configurações de Cache
CACHE_TTL_SECONDS=3600
CACHE_MAX_SIZE_MB=100
ENABLE_COMPRESSION=true
COMPRESSION_LEVEL=6

# Configurações de Performance
MAX_CONCURRENT_CONNECTIONS=1000
RATE_LIMIT_REQUESTS_PER_MINUTE=100
ENABLE_DELTA_UPDATES=true
ENABLE_SMART_POLLING=true

# Configurações de Monitoramento
METRICS_COLLECTION_INTERVAL=60000
PERFORMANCE_ALERT_THRESHOLD_MS=1000
ENABLE_PERFORMANCE_MONITORING=true

# Configurações do Redis (para sessões WebSocket)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Configurações de Logging
LOG_LEVEL=info
LOG_WEBSOCKET_EVENTS=true
LOG_PERFORMANCE_METRICS=true
```

### 7.2 Docker Compose para Desenvolvimento

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/gestao_compras
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: gestao_compras
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 7.3 Configuração do Nginx

```nginx
upstream app_servers {
    server app:3000;
}

upstream websocket_servers {
    server app:3001;
}

server {
    listen 80;
    
    # Aplicação principal
    location / {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://websocket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
    
    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml;
}
```

## 8. Estratégia de Deploy e Monitoramento

### 8.1 Pipeline de Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy Real-time System

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Load Tests
        run: |
          npm install -g artillery
          artillery run tests/load-test.yml
      
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          # Deploy gradual com health checks
          docker-compose up -d --scale app=2
          ./scripts/health-check.sh
          docker-compose up -d --scale app=4
```

### 8.2 Monitoramento em Produção

**Health Check Endpoint**:
```typescript
app.get('/health/realtime', async (req, res) => {
  const metrics = {
    websocketConnections: websocketManager.getActiveConnections(),
    cacheHitRate: await cacheManager.getHitRate(),
    averageLatency: await metricsService.getAverageLatency(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
  
  const isHealthy = 
    metrics.websocketConnections < 1000 &&
    metrics.cacheHitRate > 0.7 &&
    metrics.averageLatency < 500;
    
  res.status(isHealthy ? 200 : 503).json(metrics);
});
```

**Alertas Automáticos**:
```typescript
interface AlertConfig {
  maxLatency: 1000;           // ms
  minCacheHitRate: 0.6;       // 60%
  maxMemoryUsage: 512;        // MB
  maxConnections: 800;        // conexões simultâneas
}

class AlertManager {
  checkMetrics(metrics: Metrics): Alert[] {
    const alerts: Alert[] = [];
    
    if (metrics.averageLatency > this.config.maxLatency) {
      alerts.push({
        type: 'HIGH_LATENCY',
        severity: 'warning',
        message: `Latência alta: ${metrics.averageLatency}ms`
      });
    }
    
    return alerts;
  }
}
```

## 9. Testes de Performance

### 9.1 Configuração do Artillery

```yaml
# tests/load-test-realtime.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Load test"
    - duration: 120
      arrivalRate: 100
      name: "Stress test"
  
  socketio:
    transports: ['websocket']
    
scenarios:
  - name: "WebSocket Connection Test"
    weight: 70
    engine: socketio
    flow:
      - emit:
          channel: "subscribe"
          data:
            events: ["purchase_request_changed", "quotation_changed"]
      - think: 30
      - emit:
          channel: "heartbeat"
          data:
            timestamp: "{{ $timestamp }}"
      - think: 60
      
  - name: "REST API with Cache"
    weight: 30
    flow:
      - get:
          url: "/api/purchase-requests"
          headers:
            If-None-Match: "{{ etag }}"
          capture:
            - json: "$.etag"
              as: "etag"
      - think: 5
```

### 9.2 Métricas de Validação

**Critérios de Aceitação**:
```typescript
interface PerformanceTargets {
  maxLatency: 500;              // ms
  minThroughput: 1000;          // req/s
  maxErrorRate: 0.01;           // 1%
  minCacheHitRate: 0.8;         // 80%
  maxMemoryUsage: 512;          // MB
  maxCpuUsage: 70;              // %
  maxWebSocketConnections: 1000;
}
```

## 10. Segurança e Compliance

### 10.1 Autenticação WebSocket

```typescript
// Middleware de autenticação para WebSocket
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(new Error('Authentication failed'));
    }
    
    socket.userId = user.id;
    socket.userRole = user.role;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

### 10.2 Rate Limiting

```typescript
// Rate limiting para WebSocket
const rateLimiter = new Map();

io.use((socket, next) => {
  const userId = socket.userId;
  const now = Date.now();
  const windowMs = 60000; // 1 minuto
  const maxRequests = 100;
  
  if (!rateLimiter.has(userId)) {
    rateLimiter.set(userId, { count: 1, resetTime: now + windowMs });
    return next();
  }
  
  const userLimit = rateLimiter.get(userId);
  
  if (now > userLimit.resetTime) {
    userLimit.count = 1;
    userLimit.resetTime = now + windowMs;
  } else {
    userLimit.count++;
  }
  
  if (userLimit.count > maxRequests) {
    return next(new Error('Rate limit exceeded'));
  }
  
  next();
});
```

### 10.3 Sanitização de Dados

```typescript
// Sanitização de mensagens WebSocket
function sanitizeWebSocketMessage(data: any): any {
  if (typeof data === 'string') {
    return validator.escape(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeWebSocketMessage);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[validator.escape(key)] = sanitizeWebSocketMessage(value);
    }
    return sanitized;
  }
  
  return data;
}
```

## 11. Conclusão Técnica

Esta arquitetura técnica fornece uma base sólida para implementar um sistema de atualizações em tempo real altamente performático e escalável. Os principais benefícios técnicos incluem:

**Performance**:
- ⚡ Redução de 60% no tráfego de rede
- ⚡ Latência < 500ms para 95% das operações
- ⚡ Cache hit rate > 80%
- ⚡ Suporte a 1000+ conexões simultâneas

**Escalabilidade**:
- 📈 Arquitetura horizontal com load balancing
- 📈 Cache distribuído com Redis
- 📈 Banco de dados com réplicas de leitura
- 📈 WebSocket clustering

**Confiabilidade**:
- 🛡️ Fallback automático para polling
- 🛡️ Reconexão automática
- 🛡️ Monitoramento e alertas em tempo real
- 🛡️ Health checks automatizados

**Segurança**:
- 🔒 Autenticação JWT para WebSocket
- 🔒 Rate limiting por usuário
- 🔒 Sanitização de dados
- 🔒 Auditoria completa de eventos

A implementação seguirá as melhores práticas de desenvolvimento, com testes automatizados, deploy gradual e monitoramento contínuo para garantir uma transição suave e operação estável em produção.