// Script final para verificar as solicitações SOL-2025-330 e SOL-2025-329
const { Pool } = require('pg');

async function checkRequests() {
  console.log('🔍 Verificação final das solicitações SOL-2025-330 e SOL-2025-329');
  
  const pool = new Pool({
    user: 'compras',
    host: '54.232.194.197',
    database: 'locador_compras',
    password: 'Compras2025',
    port: 5432,
  });

  try {
    // Primeiro, verificar a estrutura da tabela
    const structureResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'purchase_requests' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura da tabela purchase_requests:');
    structureResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });

    // Buscar as duas solicitações específicas com campos básicos
    const result = await pool.query(`
      SELECT 
        pr.*
      FROM purchase_requests pr
      WHERE pr.request_number IN ('SOL-2025-330', 'SOL-2025-329')
      ORDER BY pr.request_number
    `);

    console.log(`\n📊 Encontradas ${result.rows.length} solicitações:`);
    
    result.rows.forEach(row => {
      console.log(`\n🔸 ${row.request_number}:`);
      console.log(`   Dados completos:`, JSON.stringify(row, null, 2));
    });

    // Verificar se há algum problema com os dados
    const sol330 = result.rows.find(r => r.request_number === 'SOL-2025-330');
    const sol329 = result.rows.find(r => r.request_number === 'SOL-2025-329');

    console.log('\n🔍 Análise:');
    
    if (sol330 && sol329) {
      console.log(`✅ Ambas as solicitações existem no banco`);
      console.log(`✅ SOL-2025-330 fase: ${sol330.current_phase}`);
      console.log(`✅ SOL-2025-329 fase: ${sol329.current_phase}`);
      
      if (sol330.current_phase === sol329.current_phase) {
        console.log(`✅ Ambas estão na mesma fase: ${sol330.current_phase}`);
      } else {
        console.log(`❌ Fases diferentes! SOL-330: ${sol330.current_phase}, SOL-329: ${sol329.current_phase}`);
      }

      // Comparar todos os campos
      console.log('\n🔍 Comparação detalhada:');
      const keys = Object.keys(sol330);
      keys.forEach(key => {
        if (sol330[key] !== sol329[key]) {
          console.log(`   ❌ ${key}: SOL-330="${sol330[key]}" vs SOL-329="${sol329[key]}"`);
        } else {
          console.log(`   ✅ ${key}: "${sol330[key]}"`);
        }
      });
      
    } else {
      if (!sol330) console.log('❌ SOL-2025-330 não encontrada no banco');
      if (!sol329) console.log('❌ SOL-2025-329 não encontrada no banco');
    }

  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
  } finally {
    await pool.end();
  }
}

checkRequests();