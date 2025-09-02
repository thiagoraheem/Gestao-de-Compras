import { storage } from './storage.js';

async function debugRequest013Relationships() {
  try {
    const requestId = 25; // SOL-2025-013
    
    console.log('=== Debugging relationships for SOL-2025-013 ===');
    
    // Get request items
    const requestItems = await storage.getPurchaseRequestItems(requestId);
    console.log('\n--- Request Items ---');
    for (const item of requestItems) {
      console.log(`ID: ${item.id}, Description: ${item.description}, Qty: ${item.requestedQuantity} ${item.unit}`);
    }
    
    // Get quotation
    const quotation = await storage.getQuotationByPurchaseRequestId(requestId);
    if (quotation) {
      console.log(`\nQuotation ID: ${quotation.id}`);
      
      // Get quotation items
      const quotationItems = await storage.getQuotationItems(quotation.id);
      console.log('\n--- Quotation Items ---');
      for (const item of quotationItems) {
        console.log(`ID: ${item.id}, Description: ${item.description}, PurchaseRequestItemId: ${item.purchaseRequestItemId}`);
      }
      
      // Get supplier quotations
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      const chosenSupplier = supplierQuotations.find(sq => sq.isChosen);
      
      if (chosenSupplier) {
        console.log(`\nChosen Supplier Quotation ID: ${chosenSupplier.id}`);
        
        // Get supplier quotation items
        const supplierItems = await storage.getSupplierQuotationItems(chosenSupplier.id);
        console.log('\n--- Supplier Quotation Items ---');
        for (const item of supplierItems) {
          console.log(`ID: ${item.id}, Description: "${item.description}", QuotationItemId: ${item.quotationItemId}, Unit: ${item.unitPrice}, Total: ${item.totalPrice}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugRequest013Relationships();