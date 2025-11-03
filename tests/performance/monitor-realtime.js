#!/usr/bin/env node

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  server: {
    url: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
    metricsEndpoint: '/api/metrics',
    healthEndpoint: '/api/health'
  },
  monitoring: {
    interval: 5000,        // 5 seconds
    duration: 300000,      // 5 minutes
    alertThresholds: {
      responseTime: 1000,  // 1 second
      errorRate: 5,        // 5%
      memoryUsage: 512,    // 512MB
      cacheHitRate: 50     // 50%
    }
  },
  output: {
    directory: path.join(__dirname, 'monitoring'),
    logFile: 'realtime-monitoring.log',
    metricsFile: 'realtime-metrics.json'
  }
};

class RealTimeMonitor {
  constructor() {
    this.startTime = Date.now();
    this.metrics = [];
    this.alerts = [];
    this.isRunning = false;
    this.wsConnection = null;
    this.monitoringInterval = null;
    
    this.ensureOutputDirectory();
    this.setupSignalHandlers();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(CONFIG.output.directory)) {
      fs.mkdirSync(CONFIG.output.directory, { recursive: true });
    }
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down gracefully...');
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down gracefully...');
      this.stop();
    });
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    console.log(logMessage);
    
    // Write to log file
    const logPath = path.join(CONFIG.output.directory, CONFIG.output.logFile);
    fs.appendFileSync(logPath, logMessage + '\n');
  }

  error(message, error = null) {
    this.log(message, 'error');
    if (error) {
      console.error(error);
    }
  }

  warn(message) {
    this.log(message, 'warn');
  }

  async fetchMetrics() {
    try {
      const response = await fetch(`${CONFIG.server.url}${CONFIG.server.metricsEndpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      this.error('Failed to fetch metrics', error);
      return null;
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${CONFIG.server.url}${CONFIG.server.healthEndpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      this.error('Health check failed', error);
      return null;
    }
  }

  connectWebSocket() {
    try {
      this.wsConnection = new WebSocket(CONFIG.server.wsUrl);
      
      this.wsConnection.on('open', () => {
        this.log('WebSocket connected for monitoring');
        
        // Send authentication
        this.wsConnection.send(JSON.stringify({
          type: 'auth',
          token: 'monitor-token',
          userId: 'performance-monitor'
        }));
        
        // Subscribe to system events
        this.wsConnection.send(JSON.stringify({
          type: 'subscribe',
          resource: 'system',
          events: ['metrics', 'alerts', 'performance']
        }));
      });
      
      this.wsConnection.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.error('Failed to parse WebSocket message', error);
        }
      });
      
      this.wsConnection.on('close', (code, reason) => {
        this.warn(`WebSocket connection closed: ${code} ${reason}`);
        
        // Attempt to reconnect if monitoring is still active
        if (this.isRunning) {
          setTimeout(() => {
            this.log('Attempting to reconnect WebSocket...');
            this.connectWebSocket();
          }, 5000);
        }
      });
      
      this.wsConnection.on('error', (error) => {
        this.error('WebSocket error', error);
      });
      
    } catch (error) {
      this.error('Failed to connect WebSocket', error);
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'notification':
        if (message.event === 'performance-alert') {
          this.handlePerformanceAlert(message.data);
        }
        break;
        
      case 'metrics-update':
        this.log(`Real-time metrics update: ${JSON.stringify(message.data)}`);
        break;
        
      case 'system-event':
        this.log(`System event: ${message.event} - ${message.message}`);
        break;
        
      default:
        // Ignore other message types
        break;
    }
  }

  handlePerformanceAlert(alertData) {
    const alert = {
      timestamp: Date.now(),
      type: alertData.type || 'warning',
      metric: alertData.metric,
      value: alertData.value,
      threshold: alertData.threshold,
      message: alertData.message
    };
    
    this.alerts.push(alert);
    this.warn(`PERFORMANCE ALERT: ${alert.message}`);
  }

  analyzeMetrics(metrics) {
    const analysis = {
      timestamp: Date.now(),
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Check response time
    if (metrics.performance && metrics.performance.averageResponseTime > CONFIG.monitoring.alertThresholds.responseTime) {
      analysis.status = 'warning';
      analysis.issues.push(`High response time: ${metrics.performance.averageResponseTime}ms`);
      analysis.recommendations.push('Consider optimizing slow queries or increasing server resources');
    }
    
    // Check memory usage
    if (metrics.performance && metrics.performance.memoryUsage) {
      const memoryMB = metrics.performance.memoryUsage.heapUsed / 1024 / 1024;
      if (memoryMB > CONFIG.monitoring.alertThresholds.memoryUsage) {
        analysis.status = 'warning';
        analysis.issues.push(`High memory usage: ${Math.round(memoryMB)}MB`);
        analysis.recommendations.push('Monitor for memory leaks and consider garbage collection tuning');
      }
    }
    
    // Check cache hit rate
    if (metrics.cache && metrics.cache.hitRate < CONFIG.monitoring.alertThresholds.cacheHitRate) {
      analysis.status = 'warning';
      analysis.issues.push(`Low cache hit rate: ${metrics.cache.hitRate}%`);
      analysis.recommendations.push('Review cache configuration and TTL settings');
    }
    
    // Check WebSocket connections
    if (metrics.websocket && metrics.websocket.errors > 0) {
      const errorRate = (metrics.websocket.errors / (metrics.websocket.totalMessages || 1)) * 100;
      if (errorRate > CONFIG.monitoring.alertThresholds.errorRate) {
        analysis.status = 'critical';
        analysis.issues.push(`High WebSocket error rate: ${errorRate.toFixed(2)}%`);
        analysis.recommendations.push('Investigate WebSocket connection stability and error handling');
      }
    }
    
    return analysis;
  }

  async collectMetrics() {
    const timestamp = Date.now();
    
    // Fetch server metrics
    const serverMetrics = await this.fetchMetrics();
    const healthStatus = await this.checkHealth();
    
    if (!serverMetrics) {
      this.error('Failed to collect server metrics');
      return;
    }
    
    // Analyze metrics
    const analysis = this.analyzeMetrics(serverMetrics);
    
    // Create metric entry
    const metricEntry = {
      timestamp,
      elapsed: timestamp - this.startTime,
      server: serverMetrics,
      health: healthStatus,
      analysis,
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
    
    this.metrics.push(metricEntry);
    
    // Log status
    const status = analysis.status.toUpperCase();
    const message = `Status: ${status} | Response: ${serverMetrics.performance?.averageResponseTime || 'N/A'}ms | Memory: ${Math.round((serverMetrics.performance?.memoryUsage?.heapUsed || 0) / 1024 / 1024)}MB | Cache: ${serverMetrics.cache?.hitRate || 'N/A'}%`;
    
    if (analysis.status === 'critical') {
      this.error(message);
    } else if (analysis.status === 'warning') {
      this.warn(message);
    } else {
      this.log(message);
    }
    
    // Log issues and recommendations
    if (analysis.issues.length > 0) {
      analysis.issues.forEach(issue => this.warn(`ISSUE: ${issue}`));
    }
    
    if (analysis.recommendations.length > 0) {
      analysis.recommendations.forEach(rec => this.log(`RECOMMENDATION: ${rec}`));
    }
    
    // Save metrics to file
    this.saveMetrics();
  }

  saveMetrics() {
    const metricsPath = path.join(CONFIG.output.directory, CONFIG.output.metricsFile);
    const data = {
      startTime: this.startTime,
      currentTime: Date.now(),
      duration: Date.now() - this.startTime,
      metrics: this.metrics,
      alerts: this.alerts,
      summary: this.generateSummary()
    };
    
    fs.writeFileSync(metricsPath, JSON.stringify(data, null, 2));
  }

  generateSummary() {
    if (this.metrics.length === 0) {
      return null;
    }
    
    const responseTimes = this.metrics
      .map(m => m.server.performance?.averageResponseTime)
      .filter(rt => rt !== undefined);
    
    const memoryUsages = this.metrics
      .map(m => m.server.performance?.memoryUsage?.heapUsed)
      .filter(mu => mu !== undefined);
    
    const cacheHitRates = this.metrics
      .map(m => m.server.cache?.hitRate)
      .filter(chr => chr !== undefined);
    
    const healthyCount = this.metrics.filter(m => m.analysis.status === 'healthy').length;
    const warningCount = this.metrics.filter(m => m.analysis.status === 'warning').length;
    const criticalCount = this.metrics.filter(m => m.analysis.status === 'critical').length;
    
    return {
      totalSamples: this.metrics.length,
      healthyCount,
      warningCount,
      criticalCount,
      healthPercentage: (healthyCount / this.metrics.length) * 100,
      averageResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      averageMemoryUsage: memoryUsages.length > 0 ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0,
      maxMemoryUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
      averageCacheHitRate: cacheHitRates.length > 0 ? cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length : 0,
      totalAlerts: this.alerts.length
    };
  }

  async start() {
    this.log('Starting real-time performance monitoring...');
    this.log(`Monitoring interval: ${CONFIG.monitoring.interval}ms`);
    this.log(`Duration: ${CONFIG.monitoring.duration}ms`);
    this.log(`Output directory: ${CONFIG.output.directory}`);
    
    this.isRunning = true;
    
    // Connect WebSocket for real-time events
    this.connectWebSocket();
    
    // Initial health check
    const health = await this.checkHealth();
    if (!health) {
      this.error('Initial health check failed, continuing anyway...');
    } else {
      this.log(`Server health: ${health.status} - ${health.message}`);
    }
    
    // Start periodic metrics collection
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, CONFIG.monitoring.interval);
    
    // Set duration timeout
    setTimeout(() => {
      this.log('Monitoring duration completed');
      this.stop();
    }, CONFIG.monitoring.duration);
    
    this.log('Real-time monitoring started');
  }

  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.log('Stopping real-time monitoring...');
    this.isRunning = false;
    
    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Close WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    
    // Save final metrics
    this.saveMetrics();
    
    // Generate final report
    const summary = this.generateSummary();
    if (summary) {
      this.log('='.repeat(50));
      this.log('MONITORING SUMMARY');
      this.log('='.repeat(50));
      this.log(`Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
      this.log(`Total samples: ${summary.totalSamples}`);
      this.log(`Health percentage: ${summary.healthPercentage.toFixed(2)}%`);
      this.log(`Average response time: ${Math.round(summary.averageResponseTime)}ms`);
      this.log(`Max response time: ${Math.round(summary.maxResponseTime)}ms`);
      this.log(`Average memory usage: ${Math.round(summary.averageMemoryUsage / 1024 / 1024)}MB`);
      this.log(`Max memory usage: ${Math.round(summary.maxMemoryUsage / 1024 / 1024)}MB`);
      this.log(`Average cache hit rate: ${summary.averageCacheHitRate.toFixed(2)}%`);
      this.log(`Total alerts: ${summary.totalAlerts}`);
      this.log('='.repeat(50));
    }
    
    this.log('Real-time monitoring stopped');
    process.exit(0);
  }
}

// CLI interface - Execute monitoring
const args = process.argv.slice(2);

// Parse command line arguments
args.forEach(arg => {
  if (arg.startsWith('--duration=')) {
    CONFIG.monitoring.duration = parseInt(arg.split('=')[1]) * 1000;
  } else if (arg.startsWith('--interval=')) {
    CONFIG.monitoring.interval = parseInt(arg.split('=')[1]) * 1000;
  } else if (arg.startsWith('--url=')) {
    CONFIG.server.url = arg.split('=')[1];
    CONFIG.server.wsUrl = CONFIG.server.url.replace('http', 'ws');
  }
});

// Update server URL to match the running server
CONFIG.server.url = 'http://localhost:5201';
CONFIG.server.wsUrl = 'ws://localhost:5201';

const monitor = new RealTimeMonitor();
monitor.start().catch(error => {
  console.error('Failed to start monitoring:', error);
  process.exit(1);
});

export default RealTimeMonitor;