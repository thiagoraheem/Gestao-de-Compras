#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  input: {
    directory: path.join(__dirname, 'monitoring'),
    metricsFile: 'realtime-metrics.json',
    artilleryReports: 'artillery-reports'
  },
  output: {
    directory: path.join(__dirname, 'analysis'),
    reportFile: 'performance-analysis.html',
    jsonFile: 'performance-analysis.json'
  },
  thresholds: {
    responseTime: {
      excellent: 200,
      good: 500,
      acceptable: 1000,
      poor: 2000
    },
    cacheHitRate: {
      excellent: 90,
      good: 75,
      acceptable: 60,
      poor: 40
    },
    memoryUsage: {
      excellent: 256,  // MB
      good: 512,
      acceptable: 1024,
      poor: 2048
    },
    errorRate: {
      excellent: 0.1,  // %
      good: 1,
      acceptable: 5,
      poor: 10
    }
  }
};

class PerformanceAnalyzer {
  constructor() {
    this.data = {
      realTimeMetrics: null,
      artilleryReports: [],
      analysis: null
    };
    
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(CONFIG.output.directory)) {
      fs.mkdirSync(CONFIG.output.directory, { recursive: true });
    }
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  error(message, error = null) {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
    if (error) {
      console.error(error);
    }
  }

  loadRealTimeMetrics() {
    const metricsPath = path.join(CONFIG.input.directory, CONFIG.input.metricsFile);
    
    if (!fs.existsSync(metricsPath)) {
      this.log('No real-time metrics file found, skipping...');
      return null;
    }
    
    try {
      const data = fs.readFileSync(metricsPath, 'utf8');
      this.data.realTimeMetrics = JSON.parse(data);
      this.log(`Loaded ${this.data.realTimeMetrics.metrics.length} real-time metric samples`);
      return this.data.realTimeMetrics;
    } catch (error) {
      this.error('Failed to load real-time metrics', error);
      return null;
    }
  }

  loadArtilleryReports() {
    const reportsDir = path.join(CONFIG.input.directory, CONFIG.input.artilleryReports);
    
    if (!fs.existsSync(reportsDir)) {
      this.log('No Artillery reports directory found, skipping...');
      return [];
    }
    
    try {
      const files = fs.readdirSync(reportsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(reportsDir, file);
        const data = fs.readFileSync(filePath, 'utf8');
        const report = JSON.parse(data);
        
        this.data.artilleryReports.push({
          filename: file,
          data: report
        });
      }
      
      this.log(`Loaded ${this.data.artilleryReports.length} Artillery reports`);
      return this.data.artilleryReports;
    } catch (error) {
      this.error('Failed to load Artillery reports', error);
      return [];
    }
  }

  analyzeRealTimeMetrics() {
    if (!this.data.realTimeMetrics) {
      return null;
    }
    
    const metrics = this.data.realTimeMetrics.metrics;
    const summary = this.data.realTimeMetrics.summary;
    
    // Response time analysis
    const responseTimes = metrics
      .map(m => m.server.performance?.averageResponseTime)
      .filter(rt => rt !== undefined);
    
    const responseTimeAnalysis = {
      samples: responseTimes.length,
      average: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      min: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      max: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      p50: this.calculatePercentile(responseTimes, 50),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
      rating: this.rateMetric(responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0, CONFIG.thresholds.responseTime)
    };
    
    // Memory usage analysis
    const memoryUsages = metrics
      .map(m => m.server.performance?.memoryUsage?.heapUsed)
      .filter(mu => mu !== undefined)
      .map(mu => mu / 1024 / 1024); // Convert to MB
    
    const memoryAnalysis = {
      samples: memoryUsages.length,
      average: memoryUsages.length > 0 ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0,
      min: memoryUsages.length > 0 ? Math.min(...memoryUsages) : 0,
      max: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
      p95: this.calculatePercentile(memoryUsages, 95),
      rating: this.rateMetric(memoryUsages.length > 0 ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0, CONFIG.thresholds.memoryUsage)
    };
    
    // Cache hit rate analysis
    const cacheHitRates = metrics
      .map(m => m.server.cache?.hitRate)
      .filter(chr => chr !== undefined);
    
    const cacheAnalysis = {
      samples: cacheHitRates.length,
      average: cacheHitRates.length > 0 ? cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length : 0,
      min: cacheHitRates.length > 0 ? Math.min(...cacheHitRates) : 0,
      max: cacheHitRates.length > 0 ? Math.max(...cacheHitRates) : 0,
      rating: this.rateMetric(cacheHitRates.length > 0 ? cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length : 0, CONFIG.thresholds.cacheHitRate)
    };
    
    // Health status analysis
    const healthCounts = {
      healthy: metrics.filter(m => m.analysis.status === 'healthy').length,
      warning: metrics.filter(m => m.analysis.status === 'warning').length,
      critical: metrics.filter(m => m.analysis.status === 'critical').length
    };
    
    const healthAnalysis = {
      total: metrics.length,
      ...healthCounts,
      healthyPercentage: (healthCounts.healthy / metrics.length) * 100,
      warningPercentage: (healthCounts.warning / metrics.length) * 100,
      criticalPercentage: (healthCounts.critical / metrics.length) * 100,
      rating: healthCounts.critical > 0 ? 'critical' : 
              healthCounts.warning > metrics.length * 0.1 ? 'warning' : 'excellent'
    };
    
    return {
      duration: this.data.realTimeMetrics.duration,
      totalSamples: metrics.length,
      responseTime: responseTimeAnalysis,
      memory: memoryAnalysis,
      cache: cacheAnalysis,
      health: healthAnalysis,
      alerts: this.data.realTimeMetrics.alerts.length,
      summary
    };
  }

  analyzeArtilleryReports() {
    if (this.data.artilleryReports.length === 0) {
      return null;
    }
    
    const analysis = {};
    
    for (const report of this.data.artilleryReports) {
      const data = report.data;
      const testName = report.filename.replace('.json', '');
      
      // Extract key metrics
      const aggregate = data.aggregate || {};
      const intermediate = data.intermediate || [];
      
      analysis[testName] = {
        summary: {
          scenarios: aggregate.scenariosCreated || 0,
          requests: aggregate.requestsCompleted || 0,
          errors: aggregate.errors || 0,
          duration: data.phases ? data.phases.reduce((sum, phase) => sum + (phase.duration || 0), 0) : 0
        },
        latency: {
          min: aggregate.latency?.min || 0,
          max: aggregate.latency?.max || 0,
          median: aggregate.latency?.median || 0,
          p95: aggregate.latency?.p95 || 0,
          p99: aggregate.latency?.p99 || 0
        },
        rps: {
          mean: aggregate.rps?.mean || 0,
          max: aggregate.rps?.max || 0
        },
        errors: {
          total: aggregate.errors || 0,
          rate: aggregate.requestsCompleted > 0 ? 
                ((aggregate.errors || 0) / aggregate.requestsCompleted) * 100 : 0
        },
        rating: {
          latency: this.rateMetric(aggregate.latency?.p95 || 0, CONFIG.thresholds.responseTime),
          errors: this.rateMetric(
            aggregate.requestsCompleted > 0 ? 
            ((aggregate.errors || 0) / aggregate.requestsCompleted) * 100 : 0, 
            CONFIG.thresholds.errorRate
          )
        }
      };
    }
    
    return analysis;
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  rateMetric(value, thresholds) {
    if (value <= thresholds.excellent) return 'excellent';
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.acceptable) return 'acceptable';
    if (value <= thresholds.poor) return 'poor';
    return 'critical';
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Real-time metrics recommendations
    if (this.data.analysis.realTime) {
      const rt = this.data.analysis.realTime;
      
      if (rt.responseTime.rating === 'poor' || rt.responseTime.rating === 'critical') {
        recommendations.push({
          category: 'Performance',
          priority: 'high',
          issue: `High response times (avg: ${Math.round(rt.responseTime.average)}ms)`,
          recommendation: 'Optimize database queries, implement better caching, or scale server resources'
        });
      }
      
      if (rt.memory.rating === 'poor' || rt.memory.rating === 'critical') {
        recommendations.push({
          category: 'Memory',
          priority: 'high',
          issue: `High memory usage (avg: ${Math.round(rt.memory.average)}MB)`,
          recommendation: 'Investigate memory leaks, optimize data structures, or increase server memory'
        });
      }
      
      if (rt.cache.rating === 'poor' || rt.cache.rating === 'critical') {
        recommendations.push({
          category: 'Caching',
          priority: 'medium',
          issue: `Low cache hit rate (avg: ${Math.round(rt.cache.average)}%)`,
          recommendation: 'Review cache TTL settings, improve cache key strategies, or increase cache size'
        });
      }
      
      if (rt.health.criticalPercentage > 5) {
        recommendations.push({
          category: 'Reliability',
          priority: 'critical',
          issue: `${Math.round(rt.health.criticalPercentage)}% of monitoring samples were critical`,
          recommendation: 'Immediate investigation required - check logs and system resources'
        });
      }
    }
    
    // Artillery reports recommendations
    if (this.data.analysis.artillery) {
      for (const [testName, results] of Object.entries(this.data.analysis.artillery)) {
        if (results.rating.latency === 'poor' || results.rating.latency === 'critical') {
          recommendations.push({
            category: 'Load Testing',
            priority: 'high',
            issue: `${testName}: High latency under load (p95: ${results.latency.p95}ms)`,
            recommendation: 'Optimize for concurrent requests, implement connection pooling, or scale horizontally'
          });
        }
        
        if (results.errors.rate > 1) {
          recommendations.push({
            category: 'Reliability',
            priority: 'high',
            issue: `${testName}: High error rate (${results.errors.rate.toFixed(2)}%)`,
            recommendation: 'Investigate error causes, improve error handling, or increase timeout values'
          });
        }
      }
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'Optimization',
        priority: 'low',
        issue: 'System performance is within acceptable ranges',
        recommendation: 'Continue monitoring and consider implementing additional optimizations for better user experience'
      });
    }
    
    return recommendations;
  }

  generateOverallScore() {
    let totalScore = 0;
    let components = 0;
    
    // Real-time metrics scoring
    if (this.data.analysis.realTime) {
      const rt = this.data.analysis.realTime;
      const scores = {
        excellent: 100,
        good: 80,
        acceptable: 60,
        poor: 40,
        critical: 20
      };
      
      totalScore += scores[rt.responseTime.rating] || 0;
      totalScore += scores[rt.memory.rating] || 0;
      totalScore += scores[rt.cache.rating] || 0;
      totalScore += scores[rt.health.rating] || 0;
      components += 4;
    }
    
    // Artillery scoring
    if (this.data.analysis.artillery) {
      for (const results of Object.values(this.data.analysis.artillery)) {
        const scores = {
          excellent: 100,
          good: 80,
          acceptable: 60,
          poor: 40,
          critical: 20
        };
        
        totalScore += scores[results.rating.latency] || 0;
        totalScore += scores[results.rating.errors] || 0;
        components += 2;
      }
    }
    
    const overallScore = components > 0 ? Math.round(totalScore / components) : 0;
    
    let grade = 'F';
    if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 60) grade = 'D';
    
    return {
      score: overallScore,
      grade,
      components,
      interpretation: this.interpretScore(overallScore)
    };
  }

  interpretScore(score) {
    if (score >= 90) return 'Excellent performance - system is highly optimized';
    if (score >= 80) return 'Good performance - minor optimizations recommended';
    if (score >= 70) return 'Acceptable performance - some improvements needed';
    if (score >= 60) return 'Poor performance - significant optimizations required';
    return 'Critical performance issues - immediate attention required';
  }

  generateHTMLReport() {
    const analysis = this.data.analysis;
    const score = this.generateOverallScore();
    const recommendations = this.generateRecommendations();
    
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Análise de Performance - Sistema de Tempo Real</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .score-card {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .score-number {
            font-size: 4rem;
            font-weight: bold;
            color: ${score.score >= 80 ? '#10b981' : score.score >= 60 ? '#f59e0b' : '#ef4444'};
        }
        
        .score-grade {
            font-size: 2rem;
            margin: 10px 0;
            color: #666;
        }
        
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .card h2 {
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .metric-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .metric-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 5px;
        }
        
        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #333;
        }
        
        .rating {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .rating.excellent { background: #d1fae5; color: #065f46; }
        .rating.good { background: #dbeafe; color: #1e40af; }
        .rating.acceptable { background: #fef3c7; color: #92400e; }
        .rating.poor { background: #fed7d7; color: #c53030; }
        .rating.critical { background: #fecaca; color: #991b1b; }
        
        .recommendations {
            margin-top: 20px;
        }
        
        .recommendation {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 0 8px 8px 0;
        }
        
        .recommendation.high { border-left-color: #ef4444; }
        .recommendation.medium { border-left-color: #f59e0b; }
        .recommendation.low { border-left-color: #10b981; }
        .recommendation.critical { border-left-color: #dc2626; }
        
        .recommendation-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .priority {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .priority.high { background: #fecaca; color: #991b1b; }
        .priority.medium { background: #fef3c7; color: #92400e; }
        .priority.low { background: #d1fae5; color: #065f46; }
        .priority.critical { background: #dc2626; color: white; }
        
        .chart-placeholder {
            height: 200px;
            background: #f8f9fa;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-style: italic;
        }
        
        .timestamp {
            text-align: center;
            color: #666;
            font-size: 0.9rem;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Análise de Performance</h1>
            <p>Sistema de Atualizações em Tempo Real</p>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <div class="score-card">
            <div class="score-number">${score.score}</div>
            <div class="score-grade">Nota: ${score.grade}</div>
            <p>${score.interpretation}</p>
        </div>
        
        ${analysis.realTime ? `
        <div class="card">
            <h2>Métricas em Tempo Real</h2>
            <div class="metrics-grid">
                <div class="metric-item">
                    <div class="metric-label">Tempo de Resposta Médio</div>
                    <div class="metric-value">${Math.round(analysis.realTime.responseTime.average)}ms</div>
                    <span class="rating ${analysis.realTime.responseTime.rating}">${analysis.realTime.responseTime.rating}</span>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Uso de Memória Médio</div>
                    <div class="metric-value">${Math.round(analysis.realTime.memory.average)}MB</div>
                    <span class="rating ${analysis.realTime.memory.rating}">${analysis.realTime.memory.rating}</span>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Taxa de Cache Hit</div>
                    <div class="metric-value">${Math.round(analysis.realTime.cache.average)}%</div>
                    <span class="rating ${analysis.realTime.cache.rating}">${analysis.realTime.cache.rating}</span>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Status de Saúde</div>
                    <div class="metric-value">${Math.round(analysis.realTime.health.healthyPercentage)}%</div>
                    <span class="rating ${analysis.realTime.health.rating}">${analysis.realTime.health.rating}</span>
                </div>
            </div>
            
            <h3>Detalhes de Performance</h3>
            <div class="metrics-grid">
                <div class="metric-item">
                    <div class="metric-label">P95 Tempo de Resposta</div>
                    <div class="metric-value">${Math.round(analysis.realTime.responseTime.p95)}ms</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">P99 Tempo de Resposta</div>
                    <div class="metric-value">${Math.round(analysis.realTime.responseTime.p99)}ms</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Pico de Memória</div>
                    <div class="metric-value">${Math.round(analysis.realTime.memory.max)}MB</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Total de Alertas</div>
                    <div class="metric-value">${analysis.realTime.alerts}</div>
                </div>
            </div>
        </div>
        ` : ''}
        
        ${analysis.artillery ? `
        <div class="card">
            <h2>Testes de Carga (Artillery)</h2>
            ${Object.entries(analysis.artillery).map(([testName, results]) => `
                <h3>${testName}</h3>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-label">Requisições Completadas</div>
                        <div class="metric-value">${results.summary.requests.toLocaleString()}</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">P95 Latência</div>
                        <div class="metric-value">${results.latency.p95}ms</div>
                        <span class="rating ${results.rating.latency}">${results.rating.latency}</span>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Taxa de Erro</div>
                        <div class="metric-value">${results.errors.rate.toFixed(2)}%</div>
                        <span class="rating ${results.rating.errors}">${results.rating.errors}</span>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">RPS Médio</div>
                        <div class="metric-value">${Math.round(results.rps.mean)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="card">
            <h2>Recomendações</h2>
            <div class="recommendations">
                ${recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <div class="recommendation-header">
                            <strong>${rec.category}</strong>
                            <span class="priority ${rec.priority}">${rec.priority}</span>
                        </div>
                        <div><strong>Problema:</strong> ${rec.issue}</div>
                        <div><strong>Recomendação:</strong> ${rec.recommendation}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="timestamp">
            Relatório gerado automaticamente pelo sistema de análise de performance
        </div>
    </div>
</body>
</html>`;
    
    return html;
  }

  async analyze() {
    this.log('Starting performance analysis...');
    
    // Load data
    this.loadRealTimeMetrics();
    this.loadArtilleryReports();
    
    // Perform analysis
    this.data.analysis = {
      realTime: this.analyzeRealTimeMetrics(),
      artillery: this.analyzeArtilleryReports(),
      timestamp: Date.now()
    };
    
    // Generate reports
    const htmlReport = this.generateHTMLReport();
    const jsonReport = {
      ...this.data.analysis,
      score: this.generateOverallScore(),
      recommendations: this.generateRecommendations()
    };
    
    // Save reports
    const htmlPath = path.join(CONFIG.output.directory, CONFIG.output.reportFile);
    const jsonPath = path.join(CONFIG.output.directory, CONFIG.output.jsonFile);
    
    fs.writeFileSync(htmlPath, htmlReport);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    this.log(`HTML report saved to: ${htmlPath}`);
    this.log(`JSON report saved to: ${jsonPath}`);
    
    // Print summary
    const score = this.generateOverallScore();
    this.log('='.repeat(50));
    this.log('PERFORMANCE ANALYSIS SUMMARY');
    this.log('='.repeat(50));
    this.log(`Overall Score: ${score.score}/100 (Grade: ${score.grade})`);
    this.log(`Interpretation: ${score.interpretation}`);
    
    if (this.data.analysis.realTime) {
      this.log(`Real-time samples: ${this.data.analysis.realTime.totalSamples}`);
      this.log(`Average response time: ${Math.round(this.data.analysis.realTime.responseTime.average)}ms`);
      this.log(`Cache hit rate: ${Math.round(this.data.analysis.realTime.cache.average)}%`);
    }
    
    if (this.data.analysis.artillery) {
      const testCount = Object.keys(this.data.analysis.artillery).length;
      this.log(`Artillery tests analyzed: ${testCount}`);
    }
    
    const recommendations = this.generateRecommendations();
    const criticalRecs = recommendations.filter(r => r.priority === 'critical').length;
    const highRecs = recommendations.filter(r => r.priority === 'high').length;
    
    this.log(`Recommendations: ${recommendations.length} total (${criticalRecs} critical, ${highRecs} high priority)`);
    this.log('='.repeat(50));
    
    return jsonReport;
  }
}

// CLI interface
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer();
  analyzer.analyze().catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceAnalyzer;