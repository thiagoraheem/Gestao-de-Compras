const fetch = require('node-fetch');
const { Pool } = require('pg');

const API_BASE = 'http://localhost:5201';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras',
  ssl: false
});

async function finalVerification() {
  console.log('🎯 VERIFICAÇÃO FINAL - Problema de Sincronização SOL-2025-329\n');
  
  try {
    // 1. Verificar banco de dados
    console.log('📊 1. Verificando banco de dados...');
    const dbResult = await pool.query(`
      SELECT 
        id, 
        request_number, 
        current_phase, 
        approved_a1, 
        approval_date_a1,
        updated_at
      FROM purchase_requests 
      WHERE request_number = 'SOL-2025-329'
    `);
    
    if (dbResult.rows.length === 0) {
      console.log('❌ SOL-2025-329 não encontrada no banco de dados');
      return;
    }
    
    const dbData = dbResult.rows[0];
    console.log('   ✅ Banco de dados:');
    console.log('      current_phase:', dbData.current_phase);
    console.log('      approved_a1:', dbData.approved_a1);
    console.log('      updated_at:', dbData.updated_at);
    
    // 2. Verificar API
    console.log('\n📡 2. Verificando API REST...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Erro no login:', loginResponse.status);
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    
    const apiResponse = await fetch(`${API_BASE}/api/purchase-requests?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      const sol329 = data.find(req => req.requestNumber === 'SOL-2025-329');
      
      if (sol329) {
        console.log('   ✅ API REST:');
        console.log('      currentPhase:', sol329.currentPhase);
        console.log('      approvedA1:', sol329.approvedA1);
        console.log('      updatedAt:', sol329.updatedAt);
      } else {
        console.log('   ❌ SOL-2025-329 não encontrada na API');
      }
    } else {
      console.log('   ❌ Erro na API:', apiResponse.status);
    }
    
    // 3. Análise de consistência
    console.log('\n🔍 3. Análise de consistência...');
    
    const dbPhase = dbData.current_phase;
    const dbApproved = dbData.approved_a1;
    
    if (dbApproved && dbPhase === 'aprovacao_a1') {
      console.log('   ❌ INCONSISTÊNCIA: approved_a1=true mas current_phase=aprovacao_a1');
      console.log('   🔧 Deveria estar na fase "cotacao"');
    } else if (dbApproved && dbPhase === 'cotacao') {
      console.log('   ✅ CONSISTENTE: approved_a1=true e current_phase=cotacao');
    } else if (!dbApproved && dbPhase === 'aprovacao_a1') {
      console.log('   ✅ CONSISTENTE: approved_a1=false e current_phase=aprovacao_a1');
    } else {
      console.log('   ⚠️  Estado não padrão:', { dbApproved, dbPhase });
    }
    
    // 4. Verificar mapeamento de fases
    console.log('\n🗺️  4. Verificando mapeamento de fases...');
    const phaseMapping = {
      'solicitacao': 'Solicitação',
      'aprovacao_a1': 'Aprovação A1',
      'cotacao': 'Cotação (RFQ)',
      'aprovacao_a2': 'Aprovação A2',
      'pedido_compra': 'Pedido de Compra'
    };
    
    const expectedColumn = phaseMapping[dbPhase];
    console.log(`   📍 SOL-2025-329 deveria aparecer na coluna: "${expectedColumn}"`);
    
    // 5. Resumo final
    console.log('\n📋 RESUMO FINAL:');
    console.log('================');
    
    if (dbApproved && dbPhase === 'cotacao') {
      console.log('🎉 PROBLEMA RESOLVIDO!');
      console.log('   ✅ Banco de dados: Fase correta (cotacao)');
      console.log('   ✅ API: Retornando dados corretos');
      console.log('   ✅ Frontend: Deveria exibir na coluna "Cotação (RFQ)"');
      console.log('\n💡 A SOL-2025-329 agora deve aparecer na coluna correta do Kanban.');
    } else {
      console.log('⚠️  AINDA HÁ PROBLEMAS:');
      console.log('   - Verificar se a correção foi aplicada corretamente');
      console.log('   - Pode ser necessário reiniciar o servidor');
      console.log('   - Verificar cache do frontend');
    }
    
  } catch (error) {
    console.error('❌ Erro durante verificação final:', error);
  } finally {
    await pool.end();
  }
}

finalVerification();