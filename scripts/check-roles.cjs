const { Client } = require('pg');

async function checkRoles() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    const result = await client.query('SELECT id, username, is_admin, is_buyer, is_manager, is_approver_a1 FROM users WHERE id = 1');
    if (result.rows.length > 0) {
      console.log('User Roles:', result.rows[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkRoles();
