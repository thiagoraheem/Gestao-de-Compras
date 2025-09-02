import { storage } from './storage.js';
import { db } from './db.js';
import { purchaseOrders } from '../shared/schema.js';

async function fixExistingPurchaseOrders() {
  try {
    console.log('=== Fixing Existing Purchase Orders with Zero Values ===');
    
    // Find all purchase orders with zero values
    const allPurchaseOrders = await db
      .select()
      .from(purchaseOrders)
      .orderBy(purchaseOrders.id);
    
    for (const po of allPurchaseOrders) {
      console.log(`\nChecking Purchase Order ${po.id} for request ${po.purchaseRequestId}...`);
      
      // Get the purchase order items
      const poItems = await storage.getPurchaseOrderItems(po.id);
      const hasZeroValues = poItems.some(item => 
        parseFloat(item.unitPrice) === 0 || parseFloat(item.totalPrice) === 0
      );
      
      if (hasZeroValues) {
        console.log(`  ❌ Found zero values in PO ${po.id}`);
        
        // Get the request and quotation info
        const request = await storage.getPurchaseRequestById(po.purchaseRequestId);
        const quotation = await storage.getQuotationByPurchaseRequestId(po.purchaseRequestId);
        
        if (quotation) {
          const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
          const chosenSupplier = supplierQuotations.find(sq => sq.isChosen);
          
          if (chosenSupplier) {
            console.log(`  🔍 Found chosen supplier ${chosenSupplier.supplierId} for quotation ${quotation.id}`);
            
            // Get supplier quotation items and quotation items for mapping
            const supplierQuotationItems = await storage.getSupplierQuotationItems(chosenSupplier.id);
            const quotationItems = await storage.getQuotationItems(quotation.id);
            const requestItems = await storage.getPurchaseRequestItems(po.purchaseRequestId);
            
            console.log(`  📋 Found ${supplierQuotationItems.length} supplier items, ${quotationItems.length} quotation items, ${requestItems.length} request items`);
            
            // Update each purchase order item with correct prices
            for (const poItem of poItems) {
              console.log(`\n  Processing PO item: ${poItem.description}`);
              
              // Find the corresponding request item
              const requestItem = requestItems.find(ri => 
                ri.description?.toLowerCase().trim() === poItem.description?.toLowerCase().trim()
              );
              
              if (requestItem) {
                console.log(`    ✓ Found request item ${requestItem.id}`);
                
                // Find the quotation item using our new logic
                const quotationItem = quotationItems.find(qi => 
                  qi.purchaseRequestItemId === requestItem.id ||
                  qi.description?.toLowerCase().trim() === requestItem.description?.toLowerCase().trim()
                );
                
                if (quotationItem) {
                  console.log(`    ✓ Found quotation item ${quotationItem.id}`);
                  
                  // Find the supplier quotation item
                  const supplierItem = supplierQuotationItems.find(si => 
                    si.quotationItemId === quotationItem.id
                  );
                  
                  if (supplierItem) {
                    const oldUnitPrice = poItem.unitPrice;
                    const oldTotalPrice = poItem.totalPrice;
                    const newUnitPrice = supplierItem.unitPrice;
                    const newTotalPrice = supplierItem.totalPrice;
                    
                    console.log(`    📊 Price update: ${oldUnitPrice} → ${newUnitPrice}, ${oldTotalPrice} → ${newTotalPrice}`);
                    
                    if (oldUnitPrice !== newUnitPrice || oldTotalPrice !== newTotalPrice) {
                      // Update the purchase order item
                      await storage.updatePurchaseOrderItem(poItem.id, {
                        unitPrice: newUnitPrice,
                        totalPrice: newTotalPrice
                      });
                      
                      console.log(`    ✅ Updated PO item ${poItem.id} with correct prices`);
                    } else {
                      console.log(`    ℹ️ Prices already correct for PO item ${poItem.id}`);
                    }
                  } else {
                    console.log(`    ❌ No supplier item found for quotation item ${quotationItem.id}`);
                  }
                } else {
                  console.log(`    ❌ No quotation item found for request item ${requestItem.id}`);
                }
              } else {
                console.log(`    ❌ No request item found for PO item description: ${poItem.description}`);
              }
            }
          } else {
            console.log(`  ❌ No chosen supplier found for quotation ${quotation.id}`);
          }
        } else {
          console.log(`  ❌ No quotation found for request ${po.purchaseRequestId}`);
        }
      } else {
        console.log(`  ✅ PO ${po.id} has correct values`);
      }
    }
    
    console.log('\n=== Fix Complete ===');
    
  } catch (error) {
    console.error('Error fixing existing purchase orders:', error);
  }
}

fixExistingPurchaseOrders();