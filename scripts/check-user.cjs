const { Client } = require('pg');

async function checkUsers() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');
    
    // Verificar se existe usuário ID=1
    const result = await client.query('SELECT id, first_name, last_name, email FROM users WHERE id = 1');
    if (result.rows.length > 0) {
      console.log('✅ Usuário ID=1 encontrado:', result.rows[0]);
    } else {
      console.log('❌ Usuário ID=1 NÃO encontrado');
    }
    
    // Contar total de usuários
    const countResult = await client.query('SELECT COUNT(*) as total FROM users');
    console.log('📊 Total de usuários:', countResult.rows[0].total);
    
    // Mostrar primeiros usuários
    const usersResult = await client.query('SELECT id, first_name, last_name, email FROM users ORDER BY id LIMIT 5');
    console.log('👥 Primeiros usuários:');
    usersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Nome: ${user.first_name} ${user.last_name}, Email: ${user.email}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkUsers();