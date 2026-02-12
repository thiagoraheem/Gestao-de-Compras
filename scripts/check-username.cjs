const { Client } = require('pg');

async function checkUsername() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    const result = await client.query('SELECT id, username, email FROM users WHERE id = 1');
    if (result.rows.length > 0) {
      console.log('User ID 1:', result.rows[0]);
    } else {
      console.log('User ID 1 not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkUsername();
