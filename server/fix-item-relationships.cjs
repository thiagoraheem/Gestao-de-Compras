// Set environment to use development database
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { eq } = require('drizzle-orm');

// Import schema
const schema = require('../shared/schema.ts');
const { quotationItems, quotations, purchaseRequestItems } = schema;

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool, { schema });

(async () => {
  try {
    console.log('Fixing item relationships...');
    
    // Get all quotations
    const allQuotations = await db.select().from(quotations);
    
    console.log(`Found ${allQuotations.length} quotations`);
    
    for (const quotation of allQuotations) {
      console.log(`\nProcessing quotation ${quotation.quotationNumber} (ID: ${quotation.id})`);
      
      // Get purchase request items
      const requestItems = await db
        .select()
        .from(purchaseRequestItems)
        .where(eq(purchaseRequestItems.purchaseRequestId, quotation.purchaseRequestId))
        .orderBy(purchaseRequestItems.id);
      
      // Get quotation items
      const quotationItemsList = await db
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quotation.id))
        .orderBy(quotationItems.id);
      
      console.log(`  Purchase request items: ${requestItems.length}`);
      console.log(`  Quotation items: ${quotationItemsList.length}`);
      
      // Update quotation items to link with purchase request items
      for (let i = 0; i < Math.min(requestItems.length, quotationItemsList.length); i++) {
        const requestItem = requestItems[i];
        const quotationItem = quotationItemsList[i];
        
        console.log(`    Linking QI ${quotationItem.id} (${quotationItem.description}) -> PRI ${requestItem.id} (${requestItem.description})`);
        
        await db
          .update(quotationItems)
          .set({
            purchaseRequestItemId: requestItem.id
          })
          .where(eq(quotationItems.id, quotationItem.id));
      }
    }
    
    console.log('\n✓ Item relationships fixed successfully!');
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
})();