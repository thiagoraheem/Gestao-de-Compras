const axios = require('axios');

// Teste de integração com ERP
class ERPIntegrationTest {
  constructor() {
    // Usar base da API conforme swagger: http://54.232.194.197:5001/api
    this.baseURL = 'http://54.232.194.197:5001/api';
    this.localBaseURL = 'http://localhost:3000/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async testConnection() {
    console.log('🧪 Testando conexão com ERP...');
    try {
      // Endpoint correto conforme swagger: GET /api/Fornecedor
      const response = await this.axiosInstance.get('/Fornecedor', { params: { search: '', limit: 10 } });
      console.log('✅ Conexão estabelecida com sucesso');
      console.log(`📊 Status: ${response.status}`);
      const data = Array.isArray(response.data) ? response.data : [];
      console.log(`📦 Fornecedores encontrados: ${data.length}`);
      return true;
    } catch (error) {
      console.error('❌ Erro na conexão:', error.message);
      return false;
    }
  }

  async testSupplierData() {
    console.log('\n🧪 Testando estrutura de dados dos fornecedores...');
    try {
      // Endpoint correto conforme swagger: GET /api/Fornecedor
      const response = await this.axiosInstance.get('/Fornecedor', { params: { search: '', limit: 10 } });
      const suppliers = Array.isArray(response.data) ? response.data : [];
      
      if (suppliers.length === 0) {
        console.log('⚠️  Nenhum fornecedor encontrado');
        return;
      }

      const firstSupplier = suppliers[0];
      console.log('📋 Estrutura do primeiro fornecedor:');
      console.log(JSON.stringify(firstSupplier, null, 2));

      // Verificar campos obrigatórios
      const requiredFields = ['id', 'name'];
      const missingFields = requiredFields.filter(field => !(field in firstSupplier));
      
      if (missingFields.length > 0) {
        console.log(`⚠️  Campos ausentes: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ Todos os campos obrigatórios presentes');
      }

    } catch (error) {
      console.error('❌ Erro ao testar dados:', error.message);
    }
  }

  async testLocalIntegration() {
    console.log('\n🧪 Testando integração local...');
    try {
      // Testar endpoint de busca de fornecedores
      const response = await axios.post(`${this.localBaseURL}/erp-integration/suppliers/fetch`, {
        incremental: false
      });
      
      console.log('✅ Integração iniciada com sucesso');
      console.log(`🆔 ID da integração: ${response.data.integrationId}`);
      console.log(`📊 Status: ${response.data.status}`);
      
      // Aguardar um pouco e verificar status
      setTimeout(async () => {
        await this.checkIntegrationStatus(response.data.integrationId);
      }, 5000);
      
    } catch (error) {
      console.error('❌ Erro na integração local:', error.message);
    }
  }

  async checkIntegrationStatus(integrationId) {
    console.log('\n🧪 Verificando status da integração...');
    try {
      const response = await axios.get(`${this.localBaseURL}/erp-integration/suppliers/status/${integrationId}`);
      
      console.log(`📊 Status: ${response.data.status}`);
      console.log(`📈 Progresso: ${response.data.progress}%`);
      console.log(`📊 Total processado: ${response.data.totalProcessed}`);
      console.log(`📊 Novos fornecedores: ${response.data.newSuppliers}`);
      console.log(`📊 Atualizações: ${response.data.updatedSuppliers}`);
      
      if (response.data.status === 'completed') {
        console.log('✅ Integração concluída com sucesso!');
      } else if (response.data.status === 'processing') {
        console.log('⏳ Integração ainda em processamento...');
      } else if (response.data.status === 'error') {
        console.log('❌ Erro durante a integração');
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error.message);
    }
  }

  async testComparison() {
    console.log('\n🧪 Testando comparação de fornecedores...');
    try {
      // Primeiro iniciar uma integração
      const fetchResponse = await axios.post(`${this.localBaseURL}/erp-integration/suppliers/fetch`, {
        incremental: false
      });
      
      const integrationId = fetchResponse.data.integrationId;
      
      // Aguardar processamento
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Obter resultados da comparação
      const comparisonResponse = await axios.get(`${this.localBaseURL}/erp-integration/suppliers/comparison/${integrationId}`);
      
      console.log('✅ Comparação obtida com sucesso');
      console.log(`📊 Total de fornecedores: ${comparisonResponse.data.items?.length || 0}`);
      
      const items = comparisonResponse.data.items || [];
      const stats = {
        new: items.filter(item => item.action === 'create').length,
        update: items.filter(item => item.action === 'update').length,
        ignore: items.filter(item => item.action === 'ignore').length
      };
      
      console.log(`📈 Novos fornecedores: ${stats.new}`);
      console.log(`🔄 Fornecedores para atualizar: ${stats.update}`);
      console.log(`⏭️  Fornecedores para ignorar: ${stats.ignore}`);
      
    } catch (error) {
      console.error('❌ Erro na comparação:', error.message);
    }
  }

  async runAllTests() {
    console.log('🚀 Iniciando testes de integração com ERP\n');
    
    const tests = [
      () => this.testConnection(),
      () => this.testSupplierData(),
      () => this.testLocalIntegration(),
      () => this.testComparison()
    ];
    
    for (const test of tests) {
      try {
        await test();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar entre testes
      } catch (error) {
        console.error('❌ Erro no teste:', error.message);
      }
    }
    
    console.log('\n✅ Testes concluídos!');
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new ERPIntegrationTest();
  tester.runAllTests().catch(console.error);
}

module.exports = ERPIntegrationTest;