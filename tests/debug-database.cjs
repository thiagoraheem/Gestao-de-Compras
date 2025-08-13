// Script para debugar diretamente o banco de dados
const { Pool } = require('pg');

// Configuração do banco (usando as mesmas configurações do servidor)
require('dotenv').config();

const isProduction = process.env.NODE_ENV === "production";

const poolConfig = isProduction
  ? {
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://neondb_owner:npg_qtBpF7Lxkfl3@ep-lingering-wildflower-acwq645y-pooler.sa-east-1.aws.neon.tech/compras",
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      connectionString:
        process.env.DATABASE_URL_DEV ??
        "postgres://compras:Compras2025@54.232.194.197:5432/locador_compras",
    };

const pool = new Pool(poolConfig);

async function debugDatabase() {
  try {
    console.log('🔍 Conectando ao banco de dados...');
    
    // Verificar total de purchase_requests
    const totalRequests = await pool.query('SELECT COUNT(*) as total FROM purchase_requests');
    console.log(`📊 Total de purchase_requests no banco: ${totalRequests.rows[0].total}`);
    
    // Verificar purchase_requests por status
    const statusCount = await pool.query(`
      SELECT current_phase, COUNT(*) as count 
      FROM purchase_requests 
      GROUP BY current_phase 
      ORDER BY count DESC
    `);
    console.log('\n📋 Purchase requests por fase:');
    statusCount.rows.forEach(row => {
      console.log(`- ${row.current_phase}: ${row.count}`);
    });
    
    // Verificar aprovações A2
    const a2Approvals = await pool.query(`
      SELECT COUNT(*) as total 
      FROM purchase_requests 
      WHERE approved_a2 = true
    `);
    console.log(`\n✅ Total de solicitações aprovadas A2: ${a2Approvals.rows[0].total}`);
    
    // Verificar purchase_orders
    const totalPOs = await pool.query('SELECT COUNT(*) as total FROM purchase_orders');
    console.log(`📦 Total de purchase_orders no banco: ${totalPOs.rows[0].total}`);
    
    // Verificar solicitações A2 aprovadas sem purchase_orders
    const missingPOs = await pool.query(`
      SELECT pr.id, pr.request_number, pr.current_phase, pr.approved_a2, pr.approval_date_a2
      FROM purchase_requests pr
      LEFT JOIN purchase_orders po ON pr.id = po.purchase_request_id
      WHERE pr.approved_a2 = true AND po.id IS NULL
      ORDER BY pr.id
    `);
    console.log(`\n🔍 Solicitações A2 aprovadas SEM purchase_orders: ${missingPOs.rows.length}`);
    
    if (missingPOs.rows.length > 0) {
      console.log('\n📋 Lista detalhada:');
      missingPOs.rows.forEach(row => {
        console.log(`- ID: ${row.id}, Número: ${row.request_number}, Fase: ${row.current_phase}, Aprovação A2: ${row.approval_date_a2}`);
      });
    }
    
    // Verificar approval_history para A2
    const a2History = await pool.query(`
      SELECT COUNT(*) as total 
      FROM approval_history 
      WHERE approver_type = 'A2' AND approved = true
    `);
    console.log(`\n📜 Total de aprovações A2 no histórico: ${a2History.rows[0].total}`);
    
    // Verificar company_id nas purchase_requests
    const companyIds = await pool.query(`
      SELECT company_id, COUNT(*) as count 
      FROM purchase_requests 
      GROUP BY company_id 
      ORDER BY count DESC
    `);
    console.log('\n🏢 Purchase requests por company_id:');
    companyIds.rows.forEach(row => {
      console.log(`- Company ID ${row.company_id}: ${row.count} solicitações`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao acessar o banco:', error);
  } finally {
    await pool.end();
  }
}

debugDatabase();