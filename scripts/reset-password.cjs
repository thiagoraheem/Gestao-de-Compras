const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function reset() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    // Hash for 'admin123'
    const hash = await bcrypt.hash('admin123', 10);
    const result = await client.query('UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username', [hash, 'usuario']);
    
    if (result.rowCount > 0) {
      console.log(`✅ Password reset successfully for user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
    } else {
      console.log('❌ User "usuario" not found.');
    }
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await client.end();
  }
}

reset();
