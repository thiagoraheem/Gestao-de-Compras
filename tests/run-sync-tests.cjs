/**
 * Script Principal de Testes de Sincronização
 * Executa todos os testes relacionados ao sistema de sincronização em tempo real
 */

const RealtimeSyncTester = require('./realtime-sync-test.cjs');
const ComponentsSyncTester = require('./components-sync-test.cjs');

class SyncTestRunner {
  constructor() {
    this.results = {
      realtime: null,
      components: null,
      overall: {
        success: false,
        startTime: null,
        endTime: null,
        duration: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async waitForServer() {
    this.log('⏳ Aguardando servidor estar disponível...');
    
    const maxAttempts = 30;
    const delay = 2000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const fetch = require('node-fetch');
        const response = await fetch('http://localhost:5201/api/health', {
          timeout: 5000
        });
        
        if (response.ok) {
          this.log('✅ Servidor está disponível');
          return true;
        }
      } catch (error) {
        this.log(`⏳ Tentativa ${attempt}/${maxAttempts} - Servidor não disponível ainda...`);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    this.log('❌ Servidor não ficou disponível no tempo esperado', 'error');
    return false;
  }

  async runRealtimeTests() {
    this.log('🔄 Executando testes de sincronização em tempo real...');
    
    try {
      const tester = new RealtimeSyncTester();
      const results = await tester.runAllTests();
      
      this.results.realtime = results;
      
      if (results.success) {
        this.log('✅ Testes de sincronização em tempo real concluídos com sucesso');
      } else {
        this.log('❌ Alguns testes de sincronização em tempo real falharam', 'error');
      }
      
      return results.success;
    } catch (error) {
      this.log(`❌ Erro durante testes de sincronização: ${error.message}`, 'error');
      this.results.realtime = { success: false, error: error.message };
      return false;
    }
  }

  async runComponentsTests() {
    this.log('🎨 Executando testes de componentes...');
    
    try {
      const tester = new ComponentsSyncTester();
      const results = await tester.runAllTests();
      
      this.results.components = results;
      
      if (results.success) {
        this.log('✅ Testes de componentes concluídos com sucesso');
      } else {
        this.log('❌ Alguns testes de componentes falharam', 'error');
      }
      
      return results.success;
    } catch (error) {
      this.log(`❌ Erro durante testes de componentes: ${error.message}`, 'error');
      this.results.components = { success: false, error: error.message };
      return false;
    }
  }

  calculateOverallResults() {
    const realtimeTests = this.results.realtime?.report?.totalTests || 0;
    const componentsTests = this.results.components?.report?.totalTests || 0;
    
    const realtimePassed = this.results.realtime?.report?.successfulTests || 0;
    const componentsPassed = this.results.components?.report?.successfulTests || 0;
    
    this.results.overall.totalTests = realtimeTests + componentsTests;
    this.results.overall.passedTests = realtimePassed + componentsPassed;
    this.results.overall.failedTests = this.results.overall.totalTests - this.results.overall.passedTests;
    
    this.results.overall.success = 
      (this.results.realtime?.success || false) && 
      (this.results.components?.success || false);
  }

  generateFinalReport() {
    this.log('📋 Gerando relatório final...');
    
    this.calculateOverallResults();
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.results.overall.duration,
      summary: {
        totalTests: this.results.overall.totalTests,
        passedTests: this.results.overall.passedTests,
        failedTests: this.results.overall.failedTests,
        successRate: this.results.overall.totalTests > 0 
          ? ((this.results.overall.passedTests / this.results.overall.totalTests) * 100).toFixed(2)
          : 0,
        overallSuccess: this.results.overall.success
      },
      details: {
        realtimeSync: this.results.realtime,
        components: this.results.components
      }
    };

    console.log('\n' + '='.repeat(80));
    console.log('🎯 RELATÓRIO FINAL - SISTEMA DE SINCRONIZAÇÃO EM TEMPO REAL');
    console.log('='.repeat(80));
    console.log(`📅 Data/Hora: ${report.timestamp}`);
    console.log(`⏱️  Duração total: ${(report.duration / 1000).toFixed(2)}s`);
    console.log(`📊 Total de testes: ${report.summary.totalTests}`);
    console.log(`✅ Testes aprovados: ${report.summary.passedTests}`);
    console.log(`❌ Testes falharam: ${report.summary.failedTests}`);
    console.log(`📈 Taxa de sucesso: ${report.summary.successRate}%`);
    console.log(`🎯 Status geral: ${report.summary.overallSuccess ? '✅ SUCESSO' : '❌ FALHA'}`);
    
    console.log('\n📋 DETALHES POR CATEGORIA:');
    console.log('-'.repeat(40));
    
    if (this.results.realtime) {
      const rtSuccess = this.results.realtime.success ? '✅' : '❌';
      const rtTests = this.results.realtime.report?.totalTests || 0;
      const rtPassed = this.results.realtime.report?.successfulTests || 0;
      console.log(`${rtSuccess} Sincronização em Tempo Real: ${rtPassed}/${rtTests} testes`);
    }
    
    if (this.results.components) {
      const compSuccess = this.results.components.success ? '✅' : '❌';
      const compTests = this.results.components.report?.totalTests || 0;
      const compPassed = this.results.components.report?.successfulTests || 0;
      console.log(`${compSuccess} Componentes React: ${compPassed}/${compTests} testes`);
    }
    
    console.log('='.repeat(80));
    
    return report;
  }

  async runAllTests() {
    this.log('🚀 Iniciando bateria completa de testes de sincronização...');
    this.results.overall.startTime = Date.now();
    
    try {
      // Verificar se o servidor está disponível
      const serverReady = await this.waitForServer();
      if (!serverReady) {
        throw new Error('Servidor não está disponível para testes');
      }
      
      // Executar testes de sincronização em tempo real
      const realtimeSuccess = await this.runRealtimeTests();
      
      // Aguardar um pouco entre os testes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Executar testes de componentes
      const componentsSuccess = await this.runComponentsTests();
      
      // Calcular resultados finais
      this.results.overall.endTime = Date.now();
      this.results.overall.duration = this.results.overall.endTime - this.results.overall.startTime;
      
      // Gerar relatório final
      const finalReport = this.generateFinalReport();
      
      const overallSuccess = realtimeSuccess && componentsSuccess;
      
      if (overallSuccess) {
        this.log('🎉 Todos os testes foram executados com sucesso!');
      } else {
        this.log('⚠️ Alguns testes falharam. Verifique o relatório para detalhes.', 'warn');
      }
      
      return {
        success: overallSuccess,
        report: finalReport,
        results: this.results
      };
      
    } catch (error) {
      this.results.overall.endTime = Date.now();
      this.results.overall.duration = this.results.overall.endTime - this.results.overall.startTime;
      
      this.log(`❌ Erro fatal durante execução dos testes: ${error.message}`, 'error');
      
      return {
        success: false,
        error: error.message,
        report: this.generateFinalReport(),
        results: this.results
      };
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const runner = new SyncTestRunner();
  
  runner.runAllTests()
    .then(results => {
      if (results.success) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema de sincronização está funcionando corretamente.');
        process.exit(0);
      } else {
        console.log('\n❌ ALGUNS TESTES FALHARAM. Verifique os logs acima para detalhes.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 ERRO FATAL:', error);
      process.exit(1);
    });
}

module.exports = SyncTestRunner;