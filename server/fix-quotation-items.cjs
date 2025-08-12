// Set environment to use development database
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

const { storage } = require('./storage.ts');
const { db } = require('./db.ts');
const { quotationItems } = require('../shared/schema.ts');
const { eq } = require('drizzle-orm');

(async () => {
  try {
    console.log('Fixing quotation items for SOL-2025-004...');
    
    // Get purchase request by ID 14
    const pr = await storage.getPurchaseRequestById(14);
    if (!pr) {
      console.log('Purchase request with ID 14 not found');
      return;
    }
    
    console.log('Purchase Request:', pr.requestNumber);
    
    // Get purchase request items
    const requestItems = await storage.getPurchaseRequestItems(pr.id);
    console.log('Purchase Request Items:', requestItems.length);
    
    // Get quotation
    const quotation = await storage.getQuotationByPurchaseRequestId(pr.id);
    if (!quotation) {
      console.log('No quotation found');
      return;
    }
    
    // Get quotation items
    const quotationItemsList = await storage.getQuotationItems(quotation.id);
    console.log('Quotation Items:', quotationItemsList.length);
    
    // Update quotation items with correct descriptions
    for (let i = 0; i < Math.min(requestItems.length, quotationItemsList.length); i++) {
      const requestItem = requestItems[i];
      const quotationItem = quotationItemsList[i];
      
      console.log(`Updating quotation item ${quotationItem.id}: "${quotationItem.description}" -> "${requestItem.description}"`);
      
      await db
        .update(quotationItems)
        .set({
          description: requestItem.description,
          itemCode: requestItem.itemCode,
          unit: requestItem.unit,
          quantity: requestItem.requestedQuantity.toString()
        })
        .where(eq(quotationItems.id, quotationItem.id));
    }
    
    console.log('✓ Quotation items updated successfully!');
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
})();