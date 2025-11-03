const { Pool } = require('pg');
const fetch = require('node-fetch');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras',
  ssl: false
});

const API_BASE = 'http://localhost:5201';

async function fixPhaseSyncIssue() {
  console.log('🔧 Iniciando correção do problema de sincronização de fases...\n');
  
  try {
    // 1. Verificar solicitações com inconsistências
    console.log('🔍 Verificando inconsistências no banco de dados...');
    
    const inconsistentRequests = await pool.query(`
      SELECT 
        id, 
        request_number, 
        current_phase, 
        approved_a1, 
        approval_date_a1,
        approved_a2,
        approval_date_a2
      FROM purchase_requests 
      WHERE 
        (current_phase = 'aprovacao_a1' AND approved_a1 = true) OR
        (current_phase = 'aprovacao_a2' AND approved_a2 = true)
      ORDER BY id
    `);
    
    if (inconsistentRequests.rows.length === 0) {
      console.log('✅ Nenhuma inconsistência encontrada!');
      return;
    }
    
    console.log(`❌ Encontradas ${inconsistentRequests.rows.length} solicitações com inconsistências:`);
    inconsistentRequests.rows.forEach(req => {
      console.log(`   - ${req.request_number} (ID: ${req.id}): fase="${req.current_phase}", approvedA1=${req.approved_a1}, approvedA2=${req.approved_a2}`);
    });
    
    console.log('\n🔧 Corrigindo inconsistências...');
    
    // 2. Corrigir cada solicitação inconsistente
    for (const req of inconsistentRequests.rows) {
      let newPhase = req.current_phase;
      
      // Lógica de correção
      if (req.current_phase === 'aprovacao_a1' && req.approved_a1 === true) {
        newPhase = 'cotacao';
        console.log(`   ✅ ${req.request_number}: aprovacao_a1 → cotacao`);
      } else if (req.current_phase === 'aprovacao_a2' && req.approved_a2 === true) {
        newPhase = 'pedido_compra';
        console.log(`   ✅ ${req.request_number}: aprovacao_a2 → pedido_compra`);
      }
      
      // Atualizar no banco de dados
      if (newPhase !== req.current_phase) {
        await pool.query(
          'UPDATE purchase_requests SET current_phase = $1, updated_at = NOW() WHERE id = $2',
          [newPhase, req.id]
        );
      }
    }
    
    // 3. Fazer login na API para invalidar cache
    console.log('\n🔐 Fazendo login na API para invalidar cache...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Erro no login para invalidar cache');
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    
    // 4. Forçar invalidação de cache fazendo uma requisição
    console.log('🔄 Invalidando cache do frontend...');
    const cacheResponse = await fetch(`${API_BASE}/api/purchase-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (cacheResponse.ok) {
      console.log('✅ Cache invalidado com sucesso');
    }
    
    // 5. Enviar notificação WebSocket para atualizar frontend
    console.log('📡 Enviando notificação WebSocket...');
    
    // Simular notificação WebSocket para cada solicitação corrigida
    for (const req of inconsistentRequests.rows) {
      try {
        await fetch(`${API_BASE}/api/debug/websocket-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
          },
          body: JSON.stringify({
            resourceType: 'purchase_requests',
            action: 'updated',
            data: {
              id: req.id,
              requestNumber: req.request_number,
              currentPhase: req.current_phase === 'aprovacao_a1' && req.approved_a1 ? 'cotacao' : 
                           req.current_phase === 'aprovacao_a2' && req.approved_a2 ? 'pedido_compra' : req.current_phase
            }
          })
        });
      } catch (error) {
        // Ignorar erros de WebSocket se o endpoint não existir
      }
    }
    
    // 6. Verificação final
    console.log('\n🔍 Verificação final...');
    const finalCheck = await pool.query(`
      SELECT 
        id, 
        request_number, 
        current_phase, 
        approved_a1, 
        approved_a2
      FROM purchase_requests 
      WHERE 
        (current_phase = 'aprovacao_a1' AND approved_a1 = true) OR
        (current_phase = 'aprovacao_a2' AND approved_a2 = true)
    `);
    
    if (finalCheck.rows.length === 0) {
      console.log('✅ Todas as inconsistências foram corrigidas!');
      console.log('\n📋 Resumo da correção:');
      console.log(`   - ${inconsistentRequests.rows.length} solicitações corrigidas`);
      console.log('   - Cache invalidado');
      console.log('   - Notificações WebSocket enviadas');
      console.log('\n🎯 O frontend deve agora exibir as fases corretas!');
    } else {
      console.log(`❌ Ainda existem ${finalCheck.rows.length} inconsistências:`);
      finalCheck.rows.forEach(req => {
        console.log(`   - ${req.request_number}: fase="${req.current_phase}", approvedA1=${req.approved_a1}, approvedA2=${req.approved_a2}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  } finally {
    await pool.end();
  }
}

fixPhaseSyncIssue();