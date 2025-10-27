const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.NODE_ENV === 'production' 
    ? process.env.DATABASE_URL 
    : process.env.DATABASE_URL_DEV
});

async function verifyPurchaseOrders() {
  try {
    console.log('🔍 Verificando Purchase Orders no banco de dados...');
    
    // Contar total de purchase orders
    const totalPOs = await pool.query('SELECT COUNT(*) FROM purchase_orders');
    console.log(`📦 Total de Purchase Orders: ${totalPOs.rows[0].count}`);
    
    // Listar todos os purchase orders
    const allPOs = await pool.query(`
      SELECT 
        po.id,
        po.order_number,
        po.purchase_request_id,
        po.status,
        po.total_value,
        pr.request_number
      FROM purchase_orders po
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      ORDER BY po.created_at DESC
    `);
    
    console.log('\n📋 Lista de Purchase Orders:');
    allPOs.rows.forEach(po => {
      console.log(`  - ${po.order_number} (ID: ${po.id}) - Request: ${po.request_number} - Status: ${po.status} - Valor: R$ ${po.total_value}`);
    });
    
    // Verificar solicitações A2 aprovadas sem PO
    const a2WithoutPO = await pool.query(`
      SELECT 
        pr.id,
        pr.request_number,
        pr.approved_a2
      FROM purchase_requests pr
      LEFT JOIN purchase_orders po ON pr.id = po.purchase_request_id
      WHERE pr.approved_a2 = true AND po.id IS NULL
    `);
    
    console.log(`\n⚠️ Solicitações A2 aprovadas SEM Purchase Order: ${a2WithoutPO.rows.length}`);
    a2WithoutPO.rows.forEach(req => {
      console.log(`  - ${req.request_number} (ID: ${req.id})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verifyPurchaseOrders();