import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  timestamp: number;
  
  // Request metrics
  totalRequests: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  slowQueries: number;
  
  // WebSocket metrics
  websocketConnections: number;
  websocketMessages: number;
  websocketErrors: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheMissRate: number;
  cacheSize: number;
  compressionSavings: number;
  
  // System metrics
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  
  // Custom metrics
  customMetrics: Record<string, number>;
}

export interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
}

export interface MonitorConfig {
  enabled: boolean;
  metricsInterval: number;
  slowQueryThreshold: number;
  alertThresholds: {
    responseTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    errorRate: number;
  };
  retentionPeriod: number;
  debug: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private config: MonitorConfig;
  private metrics: PerformanceMetrics[] = [];
  private currentMetrics: Partial<PerformanceMetrics> = {};
  private metricsTimer: NodeJS.Timeout | null = null;
  private requestTimes: number[] = [];
  private startTime = Date.now();
  private lastCpuUsage = process.cpuUsage();
  private alerts: PerformanceAlert[] = [];

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    
    this.config = {
      enabled: config.enabled !== false,
      metricsInterval: config.metricsInterval || 60000, // 1 minute
      slowQueryThreshold: config.slowQueryThreshold || 1000, // 1 second
      alertThresholds: {
        responseTime: config.alertThresholds?.responseTime || 2000,
        memoryUsage: config.alertThresholds?.memoryUsage || 512 * 1024 * 1024, // 512MB
        cacheHitRate: config.alertThresholds?.cacheHitRate || 50, // 50%
        errorRate: config.alertThresholds?.errorRate || 5, // 5%
        ...config.alertThresholds
      },
      retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      debug: config.debug || false
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }

    this.log('Performance Monitor initialized', this.config);
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[Performance Monitor] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    console.error(`[Performance Monitor] ${message}`, error || '');
    this.emit('error', { message, error });
  }

  private startMonitoring() {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);

    this.log('Performance monitoring started');
  }

  private collectMetrics() {
    try {
      const now = Date.now();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage(this.lastCpuUsage);
      this.lastCpuUsage = process.cpuUsage();

      // Calculate request metrics
      const totalRequests = this.currentMetrics.totalRequests || 0;
      const requestsPerSecond = this.requestTimes.length / (this.config.metricsInterval / 1000);
      const averageResponseTime = this.requestTimes.length > 0 
        ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length 
        : 0;
      const slowQueries = this.requestTimes.filter(time => time > this.config.slowQueryThreshold).length;

      // Reset request times for next interval
      this.requestTimes = [];

      const metrics: PerformanceMetrics = {
        timestamp: now,
        totalRequests,
        requestsPerSecond,
        averageResponseTime,
        slowQueries,
        websocketConnections: this.currentMetrics.websocketConnections || 0,
        websocketMessages: this.currentMetrics.websocketMessages || 0,
        websocketErrors: this.currentMetrics.websocketErrors || 0,
        cacheHitRate: this.currentMetrics.cacheHitRate || 0,
        cacheMissRate: this.currentMetrics.cacheMissRate || 0,
        cacheSize: this.currentMetrics.cacheSize || 0,
        compressionSavings: this.currentMetrics.compressionSavings || 0,
        memoryUsage,
        cpuUsage,
        uptime: now - this.startTime,
        customMetrics: { ...this.currentMetrics.customMetrics } || {}
      };

      this.metrics.push(metrics);
      this.cleanupOldMetrics();
      this.checkAlerts(metrics);
      
      this.emit('metrics', metrics);
      this.log('Metrics collected', {
        requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime),
        memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        cacheHitRate: Math.round(metrics.cacheHitRate * 100) / 100 + '%'
      });

    } catch (error) {
      this.error('Failed to collect metrics', error);
    }
  }

  private cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  private checkAlerts(metrics: PerformanceMetrics) {
    const alerts: PerformanceAlert[] = [];

    // Check response time
    if (metrics.averageResponseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'warning',
        metric: 'averageResponseTime',
        value: metrics.averageResponseTime,
        threshold: this.config.alertThresholds.responseTime,
        message: `Average response time (${Math.round(metrics.averageResponseTime)}ms) exceeds threshold (${this.config.alertThresholds.responseTime}ms)`,
        timestamp: metrics.timestamp
      });
    }

    // Check memory usage
    if (metrics.memoryUsage.heapUsed > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'warning',
        metric: 'memoryUsage',
        value: metrics.memoryUsage.heapUsed,
        threshold: this.config.alertThresholds.memoryUsage,
        message: `Memory usage (${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB) exceeds threshold (${Math.round(this.config.alertThresholds.memoryUsage / 1024 / 1024)}MB)`,
        timestamp: metrics.timestamp
      });
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < this.config.alertThresholds.cacheHitRate) {
      alerts.push({
        type: 'warning',
        metric: 'cacheHitRate',
        value: metrics.cacheHitRate,
        threshold: this.config.alertThresholds.cacheHitRate,
        message: `Cache hit rate (${Math.round(metrics.cacheHitRate * 100) / 100}%) is below threshold (${this.config.alertThresholds.cacheHitRate}%)`,
        timestamp: metrics.timestamp
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert', alert);
      this.log(`ALERT: ${alert.message}`, alert);
    });
  }

  // Public methods for recording metrics
  public recordRequest(responseTime: number) {
    this.requestTimes.push(responseTime);
    this.currentMetrics.totalRequests = (this.currentMetrics.totalRequests || 0) + 1;
  }

  public recordWebSocketConnection(count: number) {
    this.currentMetrics.websocketConnections = count;
  }

  public recordWebSocketMessage() {
    this.currentMetrics.websocketMessages = (this.currentMetrics.websocketMessages || 0) + 1;
  }

  public recordWebSocketError() {
    this.currentMetrics.websocketErrors = (this.currentMetrics.websocketErrors || 0) + 1;
  }

  public recordCacheMetrics(hitRate: number, missRate: number, size: number, compressionSavings: number) {
    this.currentMetrics.cacheHitRate = hitRate;
    this.currentMetrics.cacheMissRate = missRate;
    this.currentMetrics.cacheSize = size;
    this.currentMetrics.compressionSavings = compressionSavings;
  }

  public recordCustomMetric(name: string, value: number) {
    if (!this.currentMetrics.customMetrics) {
      this.currentMetrics.customMetrics = {};
    }
    this.currentMetrics.customMetrics[name] = value;
  }

  public getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getMetricsHistory(minutes: number = 60): PerformanceMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp > cutoff);
  }

  public getAlerts(minutes: number = 60): PerformanceAlert[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  public getHealthStatus() {
    const latest = this.getLatestMetrics();
    const recentAlerts = this.getAlerts(5); // Last 5 minutes
    
    if (!latest) {
      return {
        status: 'unknown',
        message: 'No metrics available'
      };
    }

    const criticalAlerts = recentAlerts.filter(alert => alert.type === 'critical');
    const warningAlerts = recentAlerts.filter(alert => alert.type === 'warning');

    if (criticalAlerts.length > 0) {
      return {
        status: 'critical',
        message: `${criticalAlerts.length} critical alerts`,
        alerts: criticalAlerts
      };
    }

    if (warningAlerts.length > 0) {
      return {
        status: 'warning',
        message: `${warningAlerts.length} warnings`,
        alerts: warningAlerts
      };
    }

    return {
      status: 'healthy',
      message: 'All systems operating normally',
      metrics: {
        responseTime: Math.round(latest.averageResponseTime),
        memoryUsage: Math.round(latest.memoryUsage.heapUsed / 1024 / 1024),
        cacheHitRate: Math.round(latest.cacheHitRate * 100) / 100,
        uptime: Math.round(latest.uptime / 1000 / 60) // minutes
      }
    };
  }

  public getSummaryReport(hours: number = 24) {
    const metrics = this.getMetricsHistory(hours * 60);
    
    if (metrics.length === 0) {
      return null;
    }

    const responseTimes = metrics.map(m => m.averageResponseTime).filter(t => t > 0);
    const memoryUsages = metrics.map(m => m.memoryUsage.heapUsed);
    const cacheHitRates = metrics.map(m => m.cacheHitRate).filter(r => r > 0);

    return {
      period: `${hours} hours`,
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0,
      maxResponseTime: Math.max(...responseTimes, 0),
      minResponseTime: Math.min(...responseTimes, 0),
      averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      maxMemoryUsage: Math.max(...memoryUsages),
      averageCacheHitRate: cacheHitRates.length > 0 
        ? cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length 
        : 0,
      totalSlowQueries: metrics.reduce((sum, m) => sum + m.slowQueries, 0),
      totalWebSocketMessages: metrics.reduce((sum, m) => sum + m.websocketMessages, 0),
      totalWebSocketErrors: metrics.reduce((sum, m) => sum + m.websocketErrors, 0),
      alertsCount: this.getAlerts(hours * 60).length
    };
  }

  public destroy() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    this.metrics = [];
    this.alerts = [];
    this.removeAllListeners();
    
    this.log('Performance Monitor destroyed');
  }
}

// Singleton instance
let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(config?: Partial<MonitorConfig>): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor(config);
  }
  return globalPerformanceMonitor;
}

export function destroyPerformanceMonitor() {
  if (globalPerformanceMonitor) {
    globalPerformanceMonitor.destroy();
    globalPerformanceMonitor = null;
  }
}

// Express middleware for automatic request tracking
export function createPerformanceMiddleware() {
  const monitor = getPerformanceMonitor();
  
  return (req: any, res: any, next: any) => {
    const startTime = performance.now();
    
    res.on('finish', () => {
      const responseTime = performance.now() - startTime;
      monitor.recordRequest(responseTime);
    });
    
    next();
  };
}