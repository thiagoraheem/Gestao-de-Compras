const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { purchaseRequests } = require('./shared/schema.ts');
const { eq, or } = require('drizzle-orm');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function checkRequests() {
  try {
    const requests = await db.select()
      .from(purchaseRequests)
      .where(or(
        eq(purchaseRequests.requestNumber, 'SOL-2025-330'),
        eq(purchaseRequests.requestNumber, 'SOL-2025-329')
      ));
    
    console.log('=== ESTADO ATUAL DAS SOLICITAÇÕES ===');
    requests.forEach(req => {
      console.log(`${req.requestNumber}:`);
      console.log(`  ID: ${req.id}`);
      console.log(`  Current Phase: ${req.currentPhase}`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Created At: ${req.createdAt}`);
      console.log(`  Updated At: ${req.updatedAt}`);
      console.log(`  Department: ${req.department}`);
      console.log(`  Category: ${req.category}`);
      console.log(`  Urgency: ${req.urgency}`);
      console.log('---');
    });
    
    await sql.end();
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkRequests();