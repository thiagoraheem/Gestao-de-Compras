import { storage } from './storage.js';

async function findRequestsForTesting() {
  try {
    // Find requests that have chosen suppliers but might not have purchase orders yet
    const allRequests = await storage.getAllPurchaseRequests();
    console.log('=== Looking for requests suitable for testing ===');
    
    for (const request of allRequests) {
      if (request.currentPhase === 'aprovacao_a2' || request.currentPhase === 'pedido_compra' || request.currentPhase === 'conclusao_compra') {
        console.log(`Request ${request.requestNumber} (ID: ${request.id}) - Phase: ${request.currentPhase}`);
        
        // Check if it has a quotation
        const quotation = await storage.getQuotationByPurchaseRequestId(request.id);
        if (quotation) {
          const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
          const chosenSupplier = supplierQuotations.find(sq => sq.isChosen);
          if (chosenSupplier) {
            console.log(`  ✓ Has chosen supplier: ${chosenSupplier.supplierId}`);
            
            // Check if purchase order exists
            const purchaseOrder = await storage.getPurchaseOrderByRequestId(request.id);
            if (purchaseOrder) {
              console.log(`  ✓ Has purchase order: ${purchaseOrder.id}`);
            } else {
              console.log(`  ✗ No purchase order found - GOOD FOR TESTING`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

findRequestsForTesting();