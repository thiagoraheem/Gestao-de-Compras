import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createCacheMiddleware } from "./cache";
import { createCacheMiddleware as createIntelligentCacheMiddleware, createDeltaUpdateMiddleware, getCacheManager } from "./cache-middleware.js";
import { getPerformanceMonitor, createPerformanceMiddleware } from './performance-monitor.js';
import { WebSocketManager } from "./websocket-manager.js";
import { EventNotificationSystem } from "./event-notification-system.js";
import { checkDatabaseHealth, isDatabaseConnected } from "./db";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Configure CORS with credentials support
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, process.env.BASE_URL].filter(Boolean)
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(createPerformanceMiddleware()); // Performance monitoring middleware
app.use(createCacheMiddleware());
app.use(createIntelligentCacheMiddleware({
  ttl: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
  compression: process.env.CACHE_COMPRESSION === 'true',
  etag: process.env.CACHE_ETAG === 'true',
  skipPaths: ['/api/ws', '/api/health', '/api/metrics', '/api/auth/check', '/api/auth/login', '/api/auth/logout']
}));
app.use(createDeltaUpdateMiddleware());

// Environment-based log configuration
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'info'),
  enableRequestLogs: process.env.ENABLE_REQUEST_LOGS !== 'false',
  verboseMode: process.env.LOG_VERBOSE === 'true'
};

// Log filtering configuration
const LOG_FILTERS = {
  // Skip logging for these paths when they return 304 (Not Modified)
  skipOn304: [
    '/api/auth/check',
    '/api/purchase-requests',
    '/api/quotations/purchase-request/',
    '/api/quotations/',
    '/api/purchase-requests/',
    '/api/supplier-quotations/'
  ],
  // Skip logging for frequent polling endpoints
  skipFrequentPolling: [
    '/api/auth/check'
  ],
  // Only log errors for these paths
  errorsOnly: [
    '/api/purchase-requests/attachments',
    '/api/quotations/supplier-quotations'
  ]
};

// Custom logging middleware
app.use((req, res, next) => {
  // Skip request logging if disabled
  if (!LOG_CONFIG.enableRequestLogs) {
    return next();
  }
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    if (path.startsWith("/api")) {
      // In production, only log errors unless verbose mode is enabled
      if (LOG_CONFIG.level === 'error' && res.statusCode < 400 && !LOG_CONFIG.verboseMode) {
        return;
      }
      
      // Skip logging based on filters
      const shouldSkip = (
        // Skip 304 responses for specified paths
        (res.statusCode === 304 && LOG_FILTERS.skipOn304.some(skipPath => path.includes(skipPath))) ||
        // Skip frequent polling endpoints with 200/304 responses
        (LOG_FILTERS.skipFrequentPolling.some(skipPath => path.includes(skipPath)) && [200, 304].includes(res.statusCode)) ||
        // Skip successful responses for errors-only paths
        (LOG_FILTERS.errorsOnly.some(errorPath => path.includes(errorPath)) && res.statusCode < 400)
      );

      if (shouldSkip) {
        return;
      }

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only include response body for errors or important operations (and if verbose mode is enabled)
      if (capturedJsonResponse && (res.statusCode >= 400 || duration > 1000) && LOG_CONFIG.verboseMode) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      // Use appropriate log level
      if (res.statusCode >= 500) {
        console.error(logLine);
      } else if (res.statusCode >= 400) {
        // Only log warnings in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(logLine);
        }
      } else {
        log(logLine);
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize WebSocket Manager and Event Notification System
  const wsManager = new WebSocketManager(server);
  const eventSystem = new EventNotificationSystem(wsManager);
  
  // Initialize Performance Monitor
  const performanceMonitor = getPerformanceMonitor({
    enabled: process.env.PERFORMANCE_MONITORING_ENABLED === 'true',
    metricsInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60000'),
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
    alertThresholds: {
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '2000'),
      memoryUsage: parseInt(process.env.ALERT_MEMORY_THRESHOLD || '536870912'), // 512MB
      cacheHitRate: parseInt(process.env.ALERT_CACHE_HIT_RATE_THRESHOLD || '50'),
      errorRate: parseInt(process.env.ALERT_ERROR_RATE_THRESHOLD || '5')
    },
    debug: process.env.PERFORMANCE_DEBUG === 'true'
  });

  // Make WebSocket and Event System available globally
  app.set('wsManager', wsManager);
  app.set('eventSystem', eventSystem);
  app.set('performanceMonitor', performanceMonitor);

  // Add WebSocket health check endpoint
  app.get('/api/ws/health', (req, res) => {
    const healthStatus = wsManager.getHealthStatus();
    res.json(healthStatus);
  });

  // Add comprehensive metrics endpoint
  app.get('/api/metrics', (req, res) => {
    const cacheManager = getCacheManager();
    const cacheStats = cacheManager.getStats();
    const healthStatus = performanceMonitor.getHealthStatus();
    const latestMetrics = performanceMonitor.getLatestMetrics();
    const summaryReport = performanceMonitor.getSummaryReport(1); // Last hour
    
    // Update performance monitor with current WebSocket metrics
    performanceMonitor.recordWebSocketConnection(wsManager.getActiveConnections());
    performanceMonitor.recordCacheMetrics(
      cacheStats.hitRate,
      100 - cacheStats.hitRate,
      cacheStats.size,
      cacheStats.compressionSavings || 0
    );
    
    res.json({
      health: healthStatus,
      websocket: {
        connections: wsManager.getActiveConnections(),
        connectionsByUser: Object.fromEntries(wsManager.getConnectionsByUser()),
        subscriptionStats: Object.fromEntries(wsManager.getSubscriptionStats())
      },
      cache: cacheStats,
      performance: latestMetrics,
      summary: summaryReport,
      alerts: performanceMonitor.getAlerts(60), // Last hour
      timestamp: new Date().toISOString()
    });
  });

  // Add comprehensive health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      const performanceHealthStatus = performanceMonitor.getHealthStatus();
      const dbConnected = isDatabaseConnected();
      const dbHealthy = await checkDatabaseHealth();
      
      // Determine overall system status
      let overallStatus = 'healthy';
      let statusCode = 200;
      
      if (!dbConnected || !dbHealthy) {
        overallStatus = 'critical';
        statusCode = 503;
      } else if (performanceHealthStatus.status === 'critical') {
        overallStatus = 'critical';
        statusCode = 503;
      } else if (performanceHealthStatus.status === 'warning') {
        overallStatus = 'warning';
        statusCode = 200;
      }
      
      res.status(statusCode).json({
        status: overallStatus,
        message: overallStatus === 'critical' 
          ? 'Sistema com problemas críticos' 
          : overallStatus === 'warning' 
            ? 'Sistema com avisos' 
            : 'Sistema funcionando normalmente',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        components: {
          database: {
            connected: dbConnected,
            healthy: dbHealthy,
            status: dbConnected && dbHealthy ? 'healthy' : 'critical'
          },
          performance: {
            status: performanceHealthStatus.status,
            message: performanceHealthStatus.message
          }
        }
      });
    } catch (error) {
      console.error('❌ Erro no health check:', error);
      res.status(503).json({
        status: 'critical',
        message: 'Erro interno no health check',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Enhanced error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details
    console.error(`❌ Erro na rota ${req.method} ${req.path}:`, {
      error: message,
      status,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    // Check if it's a database connection error
    if (err.message && (
      err.message.includes('Connection terminated') ||
      err.message.includes('ECONNRESET') ||
      err.message.includes('ENOTFOUND') ||
      err.message.includes('ECONNREFUSED')
    )) {
      console.log('🔄 Erro de conexão detectado, verificando status do banco...');
      // Don't crash the server, just return error response
      return res.status(503).json({ 
        message: "Serviço temporariamente indisponível devido a problemas de conectividade",
        error: "DATABASE_CONNECTION_ERROR",
        timestamp: new Date().toISOString()
      });
    }

    res.status(status).json({ 
      message,
      timestamp: new Date().toISOString()
    });
    
    // Don't throw the error to prevent server crash
    // throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment variables, fallback to 5000 if not set
  // this serves both the API and the client.
  const port = process.env.PORT 
    ? parseInt(process.env.PORT, 10) 
    : 5000;
  
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    log(`WebSocket server ready on ws://localhost:${port}/ws`);
  });

  // Enhanced error handling for uncaught exceptions and rejections
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    
    // Check if it's a database connection error
    if (error.message && (
      error.message.includes('Connection terminated') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED')
    )) {
      console.log('🔄 Erro de conexão não capturado detectado, continuando execução...');
      return; // Don't exit, let reconnection logic handle it
    }
    
    // For other critical errors, still exit gracefully
    console.log('🚨 Erro crítico detectado, encerrando servidor...');
    wsManager.close();
    server.close(() => {
      process.exit(1);
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Check if it's a database connection error
    if (reason && typeof reason === 'object' && 'message' in reason) {
      const message = (reason as Error).message;
      if (message.includes('Connection terminated') ||
          message.includes('ECONNRESET') ||
          message.includes('ENOTFOUND') ||
          message.includes('ECONNREFUSED')) {
        console.log('🔄 Promise rejeitada por erro de conexão, continuando execução...');
        return; // Don't exit, let reconnection logic handle it
      }
    }
    
    // For other unhandled rejections, log but don't crash
    console.log('⚠️ Promise rejeitada não tratada, mas continuando execução...');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    wsManager.close();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down gracefully');
    wsManager.close();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });
})();
