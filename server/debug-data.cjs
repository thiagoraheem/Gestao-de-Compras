// Set environment to use development database
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

const { storage } = require('./storage.ts');

(async () => {
  try {
    console.log('Checking data for purchase request ID 14...');
    
    // Get purchase request by ID 14
    const pr = await storage.getPurchaseRequestById(14);
    if (!pr) {
      console.log('Purchase request with ID 14 not found');
      return;
    }
    console.log('Purchase Request ID:', pr.id);
    console.log('Request Number:', pr.requestNumber);
    
    // Get purchase request items
    const requestItems = await storage.getPurchaseRequestItems(pr.id);
    console.log('\nPurchase Request Items count:', requestItems.length);
    requestItems.forEach(item => {
      console.log(`  PR Item ID: ${item.id}, Desc: "${item.description}", Code: "${item.itemCode || 'N/A'}", Qty: ${item.requestedQuantity}`);
    });
    
    const quotation = await storage.getQuotationByPurchaseRequestId(pr.id);
    if (!quotation) {
      console.log('No quotation found');
      return;
    }
    console.log('\nQuotation ID:', quotation.id);
    
    const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
    console.log('Supplier Quotations count:', supplierQuotations.length);
    
    supplierQuotations.forEach(sq => {
      console.log(`SQ ID: ${sq.id}, Status: ${sq.status}, IsChosen: ${sq.isChosen}, TotalValue: ${sq.totalValue}`);
    });
    
    const quotationItems = await storage.getQuotationItems(quotation.id);
    console.log('\nQuotation Items count:', quotationItems.length);
    
    quotationItems.forEach(qi => {
      console.log(`QI ID: ${qi.id}, Desc: "${qi.description}", Code: "${qi.itemCode || 'N/A'}", Qty: ${qi.quantity}`);
    });
    
    for (const sq of supplierQuotations) {
      const items = await storage.getSupplierQuotationItems(sq.id);
      console.log(`\nSupplier ${sq.id} Items count: ${items.length}`);
      items.forEach(item => {
        console.log(`  Item: quotationItemId=${item.quotationItemId}, unitPrice=${item.unitPrice}, discountPercentage=${item.discountPercentage}, discountValue=${item.discountValue}`);
      });
    }
    
    // Test the matching logic
    console.log('\n=== TESTING ITEM MATCHING LOGIC ===');
    const supplierItems = await storage.getSupplierQuotationItems(supplierQuotations[0].id);
    
    for (const requestItem of requestItems) {
      console.log(`\nTesting PR Item: "${requestItem.description}" (Code: "${requestItem.itemCode || 'N/A'}")`);
      
      const quotationItem = quotationItems.find(qi => {
        // Primeiro tenta por descrição exata
        if (qi.description && requestItem.description && 
            qi.description.trim().toLowerCase() === requestItem.description.trim().toLowerCase()) {
          console.log(`  ✓ Matched by exact description: "${qi.description}"`);
          return true;
        }
        // Depois tenta por código do item
        if (qi.itemCode && requestItem.itemCode && qi.itemCode === requestItem.itemCode) {
          console.log(`  ✓ Matched by item code: "${qi.itemCode}"`);
          return true;
        }
        // Por último, tenta por descrição parcial
        if (qi.description && requestItem.description) {
          const qiDesc = qi.description.trim().toLowerCase();
          const itemDesc = requestItem.description.trim().toLowerCase();
          if (qiDesc.includes(itemDesc) || itemDesc.includes(qiDesc)) {
            console.log(`  ✓ Matched by partial description: "${qi.description}"`);
            return true;
          }
        }
        return false;
      });
      
      if (quotationItem) {
        const matchedSupplierItem = supplierItems.find(si => si.quotationItemId === quotationItem.id);
        if (matchedSupplierItem) {
          console.log(`  ✓ Found supplier item with price: ${matchedSupplierItem.unitPrice}`);
        } else {
          console.log(`  ✗ No supplier item found for quotationItemId: ${quotationItem.id}`);
        }
      } else {
        console.log(`  ✗ No matching quotation item found`);
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();