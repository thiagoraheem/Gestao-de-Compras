#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  // Test configurations
  tests: [
    {
      name: 'API Load Test',
      config: 'artillery-config.yml',
      output: 'api-load-test-results.json',
      description: 'Tests API endpoints with caching and real-time updates'
    },
    {
      name: 'WebSocket Load Test',
      config: 'websocket-load-test.yml',
      output: 'websocket-load-test-results.json',
      description: 'Tests WebSocket connections and messaging performance'
    }
  ],
  
  // Performance thresholds (based on technical requirements)
  thresholds: {
    responseTime: {
      p50: 200,  // 50% of requests should be < 200ms
      p95: 500,  // 95% of requests should be < 500ms
      p99: 1000  // 99% of requests should be < 1000ms
    },
    errorRate: 1,        // Error rate should be < 1%
    throughput: 100,     // Minimum requests per second
    websocket: {
      connectionTime: 1000,  // WebSocket connection should be < 1s
      messageLatency: 100    // Message latency should be < 100ms
    }
  },
  
  // Server configuration
  server: {
    url: 'http://localhost:3000',
    healthEndpoint: '/api/health',
    metricsEndpoint: '/api/metrics'
  },
  
  // Output configuration
  output: {
    directory: path.join(__dirname, 'results'),
    reportFile: 'performance-report.html',
    summaryFile: 'performance-summary.json'
  }
};

class PerformanceTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(CONFIG.output.directory)) {
      fs.mkdirSync(CONFIG.output.directory, { recursive: true });
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level.toUpperCase().padEnd(5);
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  error(message, error = null) {
    this.log(message, 'error');
    if (error) {
      console.error(error);
    }
  }

  async checkServerHealth() {
    this.log('Checking server health...');
    
    try {
      const response = await fetch(`${CONFIG.server.url}${CONFIG.server.healthEndpoint}`);
      
      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status} ${response.statusText}`);
      }
      
      const health = await response.json();
      this.log(`Server health: ${health.status} - ${health.message}`);
      
      if (health.status === 'critical') {
        throw new Error('Server is in critical state, aborting tests');
      }
      
      return true;
    } catch (error) {
      this.error('Server health check failed', error);
      return false;
    }
  }

  async getServerMetrics() {
    try {
      const response = await fetch(`${CONFIG.server.url}${CONFIG.server.metricsEndpoint}`);
      
      if (!response.ok) {
        this.log(`Failed to get server metrics: ${response.status}`, 'warn');
        return null;
      }
      
      return await response.json();
    } catch (error) {
      this.log('Failed to get server metrics', 'warn');
      return null;
    }
  }

  runArtilleryTest(testConfig) {
    return new Promise((resolve, reject) => {
      const configPath = path.join(__dirname, testConfig.config);
      const outputPath = path.join(CONFIG.output.directory, testConfig.output);
      
      this.log(`Starting ${testConfig.name}...`);
      this.log(`Config: ${configPath}`);
      this.log(`Output: ${outputPath}`);
      
      const args = [
        'run',
        '--output', outputPath,
        configPath
      ];
      
      const artillery = spawn('npx', ['artillery', ...args], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });
      
      let stdout = '';
      let stderr = '';
      
      artillery.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      
      artillery.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      artillery.on('close', (code) => {
        if (code === 0) {
          this.log(`${testConfig.name} completed successfully`);
          resolve({ stdout, stderr, outputPath });
        } else {
          this.error(`${testConfig.name} failed with exit code ${code}`);
          reject(new Error(`Artillery test failed with exit code ${code}`));
        }
      });
      
      artillery.on('error', (error) => {
        this.error(`Failed to start ${testConfig.name}`, error);
        reject(error);
      });
    });
  }

  parseArtilleryResults(outputPath) {
    try {
      if (!fs.existsSync(outputPath)) {
        this.log(`Results file not found: ${outputPath}`, 'warn');
        return null;
      }
      
      const rawData = fs.readFileSync(outputPath, 'utf8');
      const results = JSON.parse(rawData);
      
      return {
        summary: results.aggregate,
        intermediate: results.intermediate,
        scenarios: results.scenarios || {}
      };
    } catch (error) {
      this.error(`Failed to parse results from ${outputPath}`, error);
      return null;
    }
  }

  analyzeResults(testName, results) {
    if (!results || !results.summary) {
      return {
        testName,
        status: 'failed',
        message: 'No results data available'
      };
    }
    
    const summary = results.summary;
    const analysis = {
      testName,
      status: 'passed',
      metrics: {},
      issues: [],
      recommendations: []
    };
    
    // Analyze response times
    if (summary.latency) {
      analysis.metrics.responseTime = {
        p50: summary.latency.p50,
        p95: summary.latency.p95,
        p99: summary.latency.p99,
        max: summary.latency.max,
        min: summary.latency.min
      };
      
      // Check thresholds
      if (summary.latency.p50 > CONFIG.thresholds.responseTime.p50) {
        analysis.issues.push(`P50 response time (${summary.latency.p50}ms) exceeds threshold (${CONFIG.thresholds.responseTime.p50}ms)`);
        analysis.status = 'warning';
      }
      
      if (summary.latency.p95 > CONFIG.thresholds.responseTime.p95) {
        analysis.issues.push(`P95 response time (${summary.latency.p95}ms) exceeds threshold (${CONFIG.thresholds.responseTime.p95}ms)`);
        analysis.status = 'failed';
      }
    }
    
    // Analyze error rates
    if (summary.codes) {
      const totalRequests = Object.values(summary.codes).reduce((sum, count) => sum + count, 0);
      const errorRequests = Object.entries(summary.codes)
        .filter(([code]) => code >= 400)
        .reduce((sum, [, count]) => sum + count, 0);
      
      const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
      
      analysis.metrics.errorRate = errorRate;
      analysis.metrics.totalRequests = totalRequests;
      analysis.metrics.errorRequests = errorRequests;
      
      if (errorRate > CONFIG.thresholds.errorRate) {
        analysis.issues.push(`Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${CONFIG.thresholds.errorRate}%)`);
        analysis.status = 'failed';
      }
    }
    
    // Analyze throughput
    if (summary.requestsCompleted && summary.period) {
      const throughput = summary.requestsCompleted / (summary.period / 1000);
      analysis.metrics.throughput = throughput;
      
      if (throughput < CONFIG.thresholds.throughput) {
        analysis.issues.push(`Throughput (${throughput.toFixed(2)} req/s) is below threshold (${CONFIG.thresholds.throughput} req/s)`);
        analysis.status = 'warning';
      }
    }
    
    // Add recommendations based on issues
    if (analysis.issues.length > 0) {
      if (analysis.metrics.responseTime && analysis.metrics.responseTime.p95 > 1000) {
        analysis.recommendations.push('Consider implementing more aggressive caching strategies');
        analysis.recommendations.push('Review database query performance and indexing');
      }
      
      if (analysis.metrics.errorRate > 5) {
        analysis.recommendations.push('Investigate server errors and implement better error handling');
        analysis.recommendations.push('Review server capacity and scaling configuration');
      }
      
      if (analysis.metrics.throughput < 50) {
        analysis.recommendations.push('Consider horizontal scaling or server optimization');
        analysis.recommendations.push('Review connection pooling and resource management');
      }
    }
    
    return analysis;
  }

  generateReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: process.memoryUsage()
      },
      results: this.results,
      summary: this.generateSummary()
    };
    
    // Save JSON summary
    const summaryPath = path.join(CONFIG.output.directory, CONFIG.output.summaryFile);
    fs.writeFileSync(summaryPath, JSON.stringify(reportData, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(reportData);
    const reportPath = path.join(CONFIG.output.directory, CONFIG.output.reportFile);
    fs.writeFileSync(reportPath, htmlReport);
    
    this.log(`Performance report generated: ${reportPath}`);
    this.log(`Performance summary saved: ${summaryPath}`);
    
    return reportData;
  }

  generateSummary() {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    
    return {
      total: this.results.length,
      passed,
      warnings,
      failed,
      overallStatus: failed > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed'
    };
  }

  generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-passed { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-failed { color: #dc3545; }
        .metric-card { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .issue { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; border-left: 3px solid #ffc107; }
        .recommendation { background: #d1ecf1; padding: 10px; margin: 5px 0; border-radius: 3px; border-left: 3px solid #17a2b8; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .chart { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Test Report</h1>
            <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
            <p>Duration: ${Math.round(data.duration / 1000)}s</p>
            <h2 class="status-${data.summary.overallStatus}">
                Overall Status: ${data.summary.overallStatus.toUpperCase()}
            </h2>
        </div>

        <div class="summary">
            <h2>Test Summary</h2>
            <div class="metric-card">
                <strong>Tests Run:</strong> ${data.summary.total}<br>
                <strong>Passed:</strong> <span class="status-passed">${data.summary.passed}</span><br>
                <strong>Warnings:</strong> <span class="status-warning">${data.summary.warnings}</span><br>
                <strong>Failed:</strong> <span class="status-failed">${data.summary.failed}</span>
            </div>
        </div>

        <div class="results">
            <h2>Test Results</h2>
            ${data.results.map(result => `
                <div class="test-result">
                    <h3 class="status-${result.status}">${result.testName}</h3>
                    
                    ${result.metrics ? `
                        <div class="metrics">
                            <h4>Metrics</h4>
                            ${result.metrics.responseTime ? `
                                <div class="metric-card">
                                    <strong>Response Time:</strong><br>
                                    P50: ${result.metrics.responseTime.p50}ms<br>
                                    P95: ${result.metrics.responseTime.p95}ms<br>
                                    P99: ${result.metrics.responseTime.p99}ms<br>
                                    Max: ${result.metrics.responseTime.max}ms
                                </div>
                            ` : ''}
                            
                            ${result.metrics.errorRate !== undefined ? `
                                <div class="metric-card">
                                    <strong>Error Rate:</strong> ${result.metrics.errorRate.toFixed(2)}%<br>
                                    <strong>Total Requests:</strong> ${result.metrics.totalRequests}<br>
                                    <strong>Error Requests:</strong> ${result.metrics.errorRequests}
                                </div>
                            ` : ''}
                            
                            ${result.metrics.throughput ? `
                                <div class="metric-card">
                                    <strong>Throughput:</strong> ${result.metrics.throughput.toFixed(2)} req/s
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${result.issues && result.issues.length > 0 ? `
                        <div class="issues">
                            <h4>Issues</h4>
                            ${result.issues.map(issue => `<div class="issue">${issue}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${result.recommendations && result.recommendations.length > 0 ? `
                        <div class="recommendations">
                            <h4>Recommendations</h4>
                            ${result.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="system-info">
            <h2>System Information</h2>
            <div class="metric-card">
                <strong>Platform:</strong> ${data.system.platform}<br>
                <strong>Architecture:</strong> ${data.system.arch}<br>
                <strong>Node.js Version:</strong> ${data.system.nodeVersion}<br>
                <strong>Memory Usage:</strong> ${Math.round(data.system.memory.heapUsed / 1024 / 1024)}MB
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  async run() {
    this.log('Starting performance test suite...');
    
    // Check server health before starting
    const isHealthy = await this.checkServerHealth();
    if (!isHealthy) {
      this.error('Server health check failed, aborting tests');
      process.exit(1);
    }
    
    // Get initial server metrics
    const initialMetrics = await this.getServerMetrics();
    if (initialMetrics) {
      this.log('Initial server metrics collected');
    }
    
    // Run each test
    for (const testConfig of CONFIG.tests) {
      try {
        this.log(`\n${'='.repeat(50)}`);
        this.log(`Running: ${testConfig.name}`);
        this.log(`Description: ${testConfig.description}`);
        this.log(`${'='.repeat(50)}`);
        
        const testResult = await this.runArtilleryTest(testConfig);
        const parsedResults = this.parseArtilleryResults(testResult.outputPath);
        const analysis = this.analyzeResults(testConfig.name, parsedResults);
        
        this.results.push(analysis);
        
        this.log(`${testConfig.name} analysis: ${analysis.status}`);
        if (analysis.issues.length > 0) {
          this.log(`Issues found: ${analysis.issues.length}`, 'warn');
        }
        
      } catch (error) {
        this.error(`Test ${testConfig.name} failed`, error);
        this.results.push({
          testName: testConfig.name,
          status: 'failed',
          message: error.message
        });
      }
    }
    
    // Get final server metrics
    const finalMetrics = await this.getServerMetrics();
    if (finalMetrics) {
      this.log('Final server metrics collected');
    }
    
    // Generate report
    const report = this.generateReport();
    
    // Print summary
    this.log(`\n${'='.repeat(50)}`);
    this.log('PERFORMANCE TEST SUMMARY');
    this.log(`${'='.repeat(50)}`);
    this.log(`Overall Status: ${report.summary.overallStatus.toUpperCase()}`);
    this.log(`Tests Run: ${report.summary.total}`);
    this.log(`Passed: ${report.summary.passed}`);
    this.log(`Warnings: ${report.summary.warnings}`);
    this.log(`Failed: ${report.summary.failed}`);
    this.log(`Duration: ${Math.round(report.duration / 1000)}s`);
    
    // Exit with appropriate code
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// Run the tests
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.run().catch(error => {
    console.error('Performance test runner failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTestRunner;