import { storage } from './storage.js';

async function testRequest013() {
  try {
    const requestId = 25; // SOL-2025-013
    
    console.log('=== Testing request SOL-2025-013 ===');
    
    const request = await storage.getPurchaseRequestById(requestId);
    console.log(`Request found: ${JSON.stringify({
      id: request.id,
      request_number: request.requestNumber,
      current_phase: request.currentPhase,
      chosen_supplier_id: request.chosenSupplierId
    })}`);
    
    const items = await storage.getPurchaseRequestItems(requestId);
    console.log(`Found ${items.length} items for this request:`);
    for (const item of items) {
      console.log(`  - ${item.description} (${item.requestedQuantity} ${item.unit})`);
    }
    
    // Get quotation and supplier quotation items
    const quotation = await storage.getQuotationByPurchaseRequestId(requestId);
    if (quotation) {
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      const chosenSupplier = supplierQuotations.find(sq => sq.isChosen);
      
      if (chosenSupplier) {
        console.log(`Checking supplier quotation items for chosen supplier ${chosenSupplier.supplierId}...`);
        const supplierItems = await storage.getSupplierQuotationItems(chosenSupplier.id);
        console.log(`Found ${supplierItems.length} supplier quotation items:`);
        for (const item of supplierItems) {
          console.log(`  - ${item.description}: unit=${item.unitPrice}, total=${item.totalPrice}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testRequest013();