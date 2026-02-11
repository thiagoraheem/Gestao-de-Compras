const { Client } = require('pg');

async function promoteUser() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    await client.query(`
      UPDATE users 
      SET is_admin = true, 
          is_buyer = true, 
          is_manager = true, 
          is_approver_a1 = true, 
          is_approver_a2 = true 
      WHERE id = 1
    `);
    console.log('✅ User 1 promoted to Super Admin');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

promoteUser();
