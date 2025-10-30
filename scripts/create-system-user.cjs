const { Client } = require('pg');

async function createSystemUser() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');
    
    // Verificar se já existe usuário ID=1
    const existingUser = await client.query('SELECT id FROM users WHERE id = 1');
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Usuário ID=1 já existe');
      return;
    }
    
    // Criar usuário padrão do sistema com ID=1
    console.log('🔄 Criando usuário padrão do sistema...');
    
    await client.query(`
      INSERT INTO users (
        id,
        first_name,
        last_name,
        email,
        username,
        password,
        is_admin,
        company_id,
        created_at,
        updated_at
      ) VALUES (
        1,
        'Sistema',
        'Automático',
        'sistema@locador.com.br',
        'sistema',
        '$2b$10$dummy.hash.for.system.user.that.cannot.login',
        false,
        (SELECT id FROM companies LIMIT 1),
        NOW(),
        NOW()
      )
    `);
    
    console.log('✅ Usuário sistema criado com sucesso!');
    
    // Verificar se foi criado corretamente
    const newUser = await client.query('SELECT id, first_name, last_name, email FROM users WHERE id = 1');
    console.log('👤 Usuário criado:', newUser.rows[0]);
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário sistema:', error.message);
    
    // Se o erro for de sequência, ajustar a sequência
    if (error.message.includes('duplicate key') || error.message.includes('violates unique constraint')) {
      console.log('🔄 Tentando ajustar sequência...');
      try {
        await client.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users) + 1, false)");
        console.log('✅ Sequência ajustada');
      } catch (seqError) {
        console.error('❌ Erro ao ajustar sequência:', seqError.message);
      }
    }
  } finally {
    await client.end();
  }
}

createSystemUser();