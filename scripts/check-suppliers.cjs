const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
});

(async () => {
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM suppliers LIMIT 5');
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
})();
