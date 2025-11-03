/**
 * Teste de Sincronização em Tempo Real
 * Valida a funcionalidade do sistema de sincronização WebSocket e polling
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

// Configurações de teste
const TEST_CONFIG = {
  serverUrl: 'http://localhost:5201',
  wsUrl: 'ws://localhost:5201/ws',
  testTimeout: 30000,
  pollingInterval: 5000
};

class RealtimeSyncTester {
  constructor() {
    this.testResults = [];
    this.wsConnection = null;
    this.isConnected = false;
    this.messagesReceived = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    this.testResults.push({
      timestamp,
      type,
      message,
      success: type !== 'error'
    });
  }

  async testWebSocketConnection() {
    this.log('🔌 Testando conexão WebSocket...');
    
    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket(TEST_CONFIG.wsUrl);
        
        const timeout = setTimeout(() => {
          this.log('❌ Timeout na conexão WebSocket', 'error');
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.wsConnection.on('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.log('✅ WebSocket conectado com sucesso');
          resolve(true);
        });

        this.wsConnection.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.messagesReceived.push(message);
            this.log(`📨 Mensagem recebida: ${message.type || 'unknown'}`);
          } catch (error) {
            this.log(`⚠️ Erro ao processar mensagem: ${error.message}`, 'warn');
          }
        });

        this.wsConnection.on('error', (error) => {
          clearTimeout(timeout);
          this.log(`❌ Erro WebSocket: ${error.message}`, 'error');
          reject(error);
        });

        this.wsConnection.on('close', () => {
          this.isConnected = false;
          this.log('🔌 WebSocket desconectado');
        });

      } catch (error) {
        this.log(`❌ Erro ao criar conexão WebSocket: ${error.message}`, 'error');
        reject(error);
      }
    });
  }

  async testApiEndpoints() {
    this.log('🌐 Testando endpoints da API...');
    
    const endpoints = [
      '/api/purchase-requests',
      '/api/health',
      '/api/websocket/stats'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}${endpoint}`);
        
        if (response.ok) {
          this.log(`✅ Endpoint ${endpoint} respondeu com status ${response.status}`);
        } else {
          this.log(`⚠️ Endpoint ${endpoint} retornou status ${response.status}`, 'warn');
        }
      } catch (error) {
        this.log(`❌ Erro ao testar endpoint ${endpoint}: ${error.message}`, 'error');
      }
    }
  }

  async testRealtimeUpdates() {
    this.log('🔄 Testando atualizações em tempo real...');
    
    if (!this.isConnected) {
      this.log('❌ WebSocket não conectado para teste de atualizações', 'error');
      return false;
    }

    // Simular uma atualização enviando uma mensagem de teste
    const testMessage = {
      type: 'test_update',
      timestamp: Date.now(),
      data: { test: true }
    };

    try {
      this.wsConnection.send(JSON.stringify(testMessage));
      this.log('📤 Mensagem de teste enviada');
      
      // Aguardar resposta por 5 segundos
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const receivedTestMessages = this.messagesReceived.filter(msg => 
        msg.type === 'test_update' || msg.type === 'connected'
      );
      
      if (receivedTestMessages.length > 0) {
        this.log(`✅ Recebidas ${receivedTestMessages.length} mensagens de teste`);
        return true;
      } else {
        this.log('⚠️ Nenhuma mensagem de teste recebida', 'warn');
        return false;
      }
    } catch (error) {
      this.log(`❌ Erro ao testar atualizações: ${error.message}`, 'error');
      return false;
    }
  }

  async testPollingFallback() {
    this.log('📡 Testando fallback de polling...');
    
    // Fechar conexão WebSocket para forçar polling
    if (this.wsConnection && this.isConnected) {
      this.wsConnection.close();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Testar se a API ainda responde (simulando polling)
    try {
      const response = await fetch(`${TEST_CONFIG.serverUrl}/api/purchase-requests`);
      
      if (response.ok) {
        this.log('✅ Polling fallback funcionando - API acessível');
        return true;
      } else {
        this.log(`⚠️ Polling fallback com problemas - Status: ${response.status}`, 'warn');
        return false;
      }
    } catch (error) {
      this.log(`❌ Erro no polling fallback: ${error.message}`, 'error');
      return false;
    }
  }

  async testPerformance() {
    this.log('⚡ Testando performance do sistema...');
    
    const startTime = Date.now();
    const testRequests = 10;
    let successfulRequests = 0;

    for (let i = 0; i < testRequests; i++) {
      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/api/health`);
        if (response.ok) {
          successfulRequests++;
        }
      } catch (error) {
        this.log(`⚠️ Erro na requisição ${i + 1}: ${error.message}`, 'warn');
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / testRequests;

    this.log(`📊 Performance: ${successfulRequests}/${testRequests} requisições bem-sucedidas`);
    this.log(`📊 Tempo médio por requisição: ${averageTime.toFixed(2)}ms`);
    
    return {
      successRate: (successfulRequests / testRequests) * 100,
      averageResponseTime: averageTime,
      totalTime
    };
  }

  generateReport() {
    this.log('📋 Gerando relatório de testes...');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      successfulTests: this.testResults.filter(r => r.success).length,
      failedTests: this.testResults.filter(r => !r.success).length,
      details: this.testResults
    };

    console.log('\n' + '='.repeat(60));
    console.log('📋 RELATÓRIO DE TESTES - SINCRONIZAÇÃO EM TEMPO REAL');
    console.log('='.repeat(60));
    console.log(`📅 Data/Hora: ${report.timestamp}`);
    console.log(`📊 Total de testes: ${report.totalTests}`);
    console.log(`✅ Sucessos: ${report.successfulTests}`);
    console.log(`❌ Falhas: ${report.failedTests}`);
    console.log(`📈 Taxa de sucesso: ${((report.successfulTests / report.totalTests) * 100).toFixed(2)}%`);
    console.log('='.repeat(60));

    return report;
  }

  async runAllTests() {
    this.log('🚀 Iniciando bateria de testes de sincronização em tempo real...');
    
    try {
      // Teste 1: Conexão WebSocket
      await this.testWebSocketConnection();
      
      // Teste 2: Endpoints da API
      await this.testApiEndpoints();
      
      // Teste 3: Atualizações em tempo real
      await this.testRealtimeUpdates();
      
      // Teste 4: Fallback de polling
      await this.testPollingFallback();
      
      // Teste 5: Performance
      const performanceResults = await this.testPerformance();
      
      // Gerar relatório final
      const report = this.generateReport();
      
      this.log('🎉 Bateria de testes concluída!');
      
      return {
        success: report.failedTests === 0,
        report,
        performance: performanceResults
      };
      
    } catch (error) {
      this.log(`❌ Erro durante execução dos testes: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        report: this.generateReport()
      };
    } finally {
      // Limpar conexões
      if (this.wsConnection) {
        this.wsConnection.close();
      }
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new RealtimeSyncTester();
  
  tester.runAllTests()
    .then(results => {
      if (results.success) {
        console.log('\n🎉 Todos os testes passaram!');
        process.exit(0);
      } else {
        console.log('\n❌ Alguns testes falharam.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Erro fatal durante os testes:', error);
      process.exit(1);
    });
}

module.exports = RealtimeSyncTester;