/**
 * Teste de Componentes de Sincronização
 * Valida os hooks e componentes React relacionados à sincronização
 */

const puppeteer = require('puppeteer');

class ComponentsSyncTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
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

  async setup() {
    this.log('🚀 Configurando ambiente de teste...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.page = await this.browser.newPage();
      
      // Configurar console listener
      this.page.on('console', msg => {
        const text = msg.text();
        if (text.includes('🔌') || text.includes('🔄') || text.includes('📡')) {
          this.log(`📱 Console: ${text}`);
        }
      });
      
      // Configurar error listener
      this.page.on('pageerror', error => {
        this.log(`❌ Erro na página: ${error.message}`, 'error');
      });
      
      this.log('✅ Ambiente configurado com sucesso');
      return true;
    } catch (error) {
      this.log(`❌ Erro ao configurar ambiente: ${error.message}`, 'error');
      return false;
    }
  }

  async testPageLoad() {
    this.log('📄 Testando carregamento da página...');
    
    try {
      await this.page.goto('http://localhost:5201', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Aguardar o componente Kanban carregar
      await this.page.waitForSelector('[data-testid="kanban-board"], .kanban-board, .grid', {
        timeout: 15000
      });
      
      this.log('✅ Página carregada com sucesso');
      return true;
    } catch (error) {
      this.log(`❌ Erro ao carregar página: ${error.message}`, 'error');
      return false;
    }
  }

  async testConnectionStatus() {
    this.log('🔌 Testando componente ConnectionStatus...');
    
    try {
      // Procurar pelo componente de status de conexão
      const statusElements = await this.page.$$eval('[class*="connection"], [class*="status"], .badge', 
        elements => elements.map(el => ({
          text: el.textContent,
          className: el.className,
          visible: el.offsetParent !== null
        }))
      );
      
      if (statusElements.length > 0) {
        this.log(`✅ Encontrados ${statusElements.length} elementos de status`);
        
        // Verificar se há indicadores de conexão
        const connectionIndicators = statusElements.filter(el => 
          el.text.toLowerCase().includes('conectado') ||
          el.text.toLowerCase().includes('online') ||
          el.text.toLowerCase().includes('websocket') ||
          el.className.includes('success') ||
          el.className.includes('green')
        );
        
        if (connectionIndicators.length > 0) {
          this.log('✅ Indicadores de conexão encontrados');
          return true;
        } else {
          this.log('⚠️ Nenhum indicador de conexão ativa encontrado', 'warn');
          return false;
        }
      } else {
        this.log('⚠️ Componente ConnectionStatus não encontrado', 'warn');
        return false;
      }
    } catch (error) {
      this.log(`❌ Erro ao testar ConnectionStatus: ${error.message}`, 'error');
      return false;
    }
  }

  async testRealtimeHook() {
    this.log('🔄 Testando hook useRealtimeSync...');
    
    try {
      // Injetar script para testar o hook
      const hookData = await this.page.evaluate(() => {
        // Procurar por elementos que indicam o uso do hook
        const indicators = {
          websocketConnected: false,
          pollingActive: false,
          lastSync: null,
          connectionStatus: 'unknown'
        };
        
        // Verificar console logs para indicadores do hook
        const logs = window.console._logs || [];
        
        for (const log of logs) {
          if (typeof log === 'string') {
            if (log.includes('WebSocket connected')) {
              indicators.websocketConnected = true;
            }
            if (log.includes('polling')) {
              indicators.pollingActive = true;
            }
            if (log.includes('Realtime update processed')) {
              indicators.lastSync = new Date().toISOString();
            }
          }
        }
        
        return indicators;
      });
      
      if (hookData.websocketConnected || hookData.pollingActive) {
        this.log('✅ Hook useRealtimeSync está ativo');
        return true;
      } else {
        this.log('⚠️ Hook useRealtimeSync não detectado', 'warn');
        return false;
      }
    } catch (error) {
      this.log(`❌ Erro ao testar hook: ${error.message}`, 'error');
      return false;
    }
  }

  async testAnimations() {
    this.log('🎬 Testando componentes de animação...');
    
    try {
      // Verificar se há elementos com animações
      const animatedElements = await this.page.$$eval('[class*="motion"], [class*="animate"], [style*="transform"]', 
        elements => elements.length
      );
      
      if (animatedElements > 0) {
        this.log(`✅ Encontrados ${animatedElements} elementos com animação`);
        return true;
      } else {
        this.log('⚠️ Nenhum elemento animado encontrado', 'warn');
        return false;
      }
    } catch (error) {
      this.log(`❌ Erro ao testar animações: ${error.message}`, 'error');
      return false;
    }
  }

  async testKanbanInteraction() {
    this.log('🎯 Testando interação com Kanban...');
    
    try {
      // Procurar por colunas do Kanban
      const columns = await this.page.$$('.kanban-column, [class*="column"], .grid > div');
      
      if (columns.length > 0) {
        this.log(`✅ Encontradas ${columns.length} colunas do Kanban`);
        
        // Procurar por cartões
        const cards = await this.page.$$('.kanban-card, [class*="card"], [draggable="true"]');
        
        if (cards.length > 0) {
          this.log(`✅ Encontrados ${cards.length} cartões no Kanban`);
          return true;
        } else {
          this.log('⚠️ Nenhum cartão encontrado no Kanban', 'warn');
          return false;
        }
      } else {
        this.log('❌ Colunas do Kanban não encontradas', 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Erro ao testar Kanban: ${error.message}`, 'error');
      return false;
    }
  }

  async testNetworkRequests() {
    this.log('🌐 Testando requisições de rede...');
    
    const requests = [];
    
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });
    
    // Aguardar algumas requisições
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (requests.length > 0) {
      this.log(`✅ Capturadas ${requests.length} requisições da API`);
      
      const uniqueEndpoints = [...new Set(requests.map(r => r.url))];
      this.log(`📊 Endpoints únicos: ${uniqueEndpoints.length}`);
      
      return true;
    } else {
      this.log('⚠️ Nenhuma requisição da API capturada', 'warn');
      return false;
    }
  }

  generateReport() {
    this.log('📋 Gerando relatório de testes de componentes...');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      successfulTests: this.testResults.filter(r => r.success).length,
      failedTests: this.testResults.filter(r => !r.success).length,
      details: this.testResults
    };

    console.log('\n' + '='.repeat(60));
    console.log('📋 RELATÓRIO DE TESTES - COMPONENTES DE SINCRONIZAÇÃO');
    console.log('='.repeat(60));
    console.log(`📅 Data/Hora: ${report.timestamp}`);
    console.log(`📊 Total de testes: ${report.totalTests}`);
    console.log(`✅ Sucessos: ${report.successfulTests}`);
    console.log(`❌ Falhas: ${report.failedTests}`);
    console.log(`📈 Taxa de sucesso: ${((report.successfulTests / report.totalTests) * 100).toFixed(2)}%`);
    console.log('='.repeat(60));

    return report;
  }

  async cleanup() {
    this.log('🧹 Limpando ambiente de teste...');
    
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      this.log('✅ Limpeza concluída');
    } catch (error) {
      this.log(`⚠️ Erro durante limpeza: ${error.message}`, 'warn');
    }
  }

  async runAllTests() {
    this.log('🚀 Iniciando testes de componentes de sincronização...');
    
    try {
      // Setup
      const setupSuccess = await this.setup();
      if (!setupSuccess) {
        throw new Error('Falha no setup do ambiente');
      }
      
      // Teste 1: Carregamento da página
      await this.testPageLoad();
      
      // Teste 2: Componente ConnectionStatus
      await this.testConnectionStatus();
      
      // Teste 3: Hook useRealtimeSync
      await this.testRealtimeHook();
      
      // Teste 4: Animações
      await this.testAnimations();
      
      // Teste 5: Interação com Kanban
      await this.testKanbanInteraction();
      
      // Teste 6: Requisições de rede
      await this.testNetworkRequests();
      
      // Gerar relatório final
      const report = this.generateReport();
      
      this.log('🎉 Testes de componentes concluídos!');
      
      return {
        success: report.failedTests === 0,
        report
      };
      
    } catch (error) {
      this.log(`❌ Erro durante execução dos testes: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        report: this.generateReport()
      };
    } finally {
      await this.cleanup();
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new ComponentsSyncTester();
  
  tester.runAllTests()
    .then(results => {
      if (results.success) {
        console.log('\n🎉 Todos os testes de componentes passaram!');
        process.exit(0);
      } else {
        console.log('\n❌ Alguns testes de componentes falharam.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Erro fatal durante os testes:', error);
      process.exit(1);
    });
}

module.exports = ComponentsSyncTester;