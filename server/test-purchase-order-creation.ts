import { storage } from './storage.js';

async function testPurchaseOrderCreation() {
  try {
    const requestId = 25; // SOL-2025-013
    
    console.log('=== Testing Purchase Order Creation for SOL-2025-013 ===');
    
    // Get the request
    const purchaseRequest = await storage.getPurchaseRequestById(requestId);
    console.log(`Request: ${purchaseRequest.requestNumber} - Phase: ${purchaseRequest.currentPhase}`);
    
    // Get quotation
    const quotation = await storage.getQuotationByPurchaseRequestId(requestId);
    if (!quotation) {
      console.log('No quotation found');
      return;
    }
    
    // Get supplier quotations and find chosen one
    const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
    const chosenSupplierQuotation = supplierQuotations.find(sq => sq.isChosen);
    
    if (!chosenSupplierQuotation) {
      console.log('No chosen supplier found');
      return;
    }
    
    console.log(`Chosen supplier quotation ID: ${chosenSupplierQuotation.id}`);
    
    // Get request items and supplier quotation items
    const purchaseRequestItems = await storage.getPurchaseRequestItems(requestId);
    const supplierQuotationItems = await storage.getSupplierQuotationItems(chosenSupplierQuotation.id);
    
    console.log('\n--- Before Purchase Order Creation ---');
    console.log('Request Items:');
    for (const item of purchaseRequestItems) {
      console.log(`  - ${item.description} (${item.requestedQuantity} ${item.unit})`);
    }
    
    console.log('Supplier Quotation Items:');
    for (const item of supplierQuotationItems) {
      console.log(`  - QuotationItemId: ${item.quotationItemId}, Unit: ${item.unitPrice}, Total: ${item.totalPrice}`);
    }
    
    // Generate order number (following the pattern used in routes.ts)
    const orderNumber = `PO-${new Date().getFullYear()}-${String(requestId).padStart(3, '0')}`;
    
    // Create purchase order data (simulating the API logic)
    const purchaseOrderData = {
      orderNumber,
      purchaseRequestId: requestId,
      supplierId: chosenSupplierQuotation.supplierId,
      quotationId: quotation.id,
      status: 'draft' as const,
      totalValue: chosenSupplierQuotation.totalValue || '0',
      paymentTerms: null,
      deliveryTerms: null,
      deliveryAddress: null,
      contactPerson: null,
      contactPhone: null,
      observations: 'Testing fixed price matching logic',
      approvedBy: null,
      approvedAt: null,
      createdBy: 2, // Using existing user ID
    };
    
    const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData);
    console.log(`\nCreated purchase order ID: ${purchaseOrder.id}`);
    
    // Criar os itens do purchase order usando nossa lógica corrigida
    for (const requestItem of purchaseRequestItems) {
      console.log(`\nProcessing request item: ${requestItem.description} (ID: ${requestItem.id})`);
      
      // Primeiro buscar os quotation items para fazer o mapeamento correto
      const quotationItems = await storage.getQuotationItems(quotation.id);
      console.log(`Found ${quotationItems.length} quotation items`);
      
      // Encontrar o quotation item que corresponde ao request item
      const quotationItem = quotationItems.find(qi => 
        qi.purchaseRequestItemId === requestItem.id ||
        qi.description?.toLowerCase().trim() === requestItem.description?.toLowerCase().trim()
      );
      
      console.log(`Quotation item found: ${quotationItem ? `ID ${quotationItem.id}` : 'NONE'}`);
      
      // Encontrar o supplier quotation item usando o quotationItemId
      const supplierItem = quotationItem ? 
        supplierQuotationItems.find(si => si.quotationItemId === quotationItem.id) :
        null;
      
      console.log(`Supplier item found: ${supplierItem ? `Unit: ${supplierItem.unitPrice}, Total: ${supplierItem.totalPrice}` : 'NONE'}`);
      
      const purchaseOrderItemData = {
        purchaseOrderId: purchaseOrder.id,
        itemCode: requestItem.productCode || `ITEM-${requestItem.id}`,
        description: requestItem.description,
        quantity: requestItem.approvedQuantity || requestItem.requestedQuantity || '0',
        unit: requestItem.unit,
        unitPrice: supplierItem?.unitPrice || '0',
        totalPrice: supplierItem?.totalPrice || '0',
        deliveryDeadline: null,
        costCenterId: purchaseRequest.costCenterId,
        accountCode: null,
      };
      
      console.log(`Creating purchase order item with unitPrice: ${purchaseOrderItemData.unitPrice}, totalPrice: ${purchaseOrderItemData.totalPrice}`);
      
      const createdItem = await storage.createPurchaseOrderItem(purchaseOrderItemData);
      console.log(`Created purchase order item ID: ${createdItem.id}`);
    }
    
    // Verify the results
    console.log('\n=== VERIFICATION: Reading back the created purchase order items ===');
    const createdItems = await storage.getPurchaseOrderItems(purchaseOrder.id);
    for (const item of createdItems) {
      console.log(`✓ ${item.description}: unit=${item.unitPrice}, total=${item.totalPrice}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPurchaseOrderCreation();