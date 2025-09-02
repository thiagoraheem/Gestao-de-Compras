import 'dotenv/config';
import { pool } from './db.js';

async function testSpecificRequest() {
  try {
    console.log('=== Testing specific request SOL-2025-024 ===');
    
    // Find the request
    const requestResult = await pool.query(
      'SELECT id, request_number, current_phase, chosen_supplier_id FROM purchase_requests WHERE request_number = $1',
      ['SOL-2025-024']
    );
    
    if (requestResult.rows.length === 0) {
      console.log('Request SOL-2025-024 not found');
      return;
    }
    
    const request = requestResult.rows[0];
    console.log('Request found:', request);
    
    // Check request items
    const itemsResult = await pool.query(
      'SELECT id, description, requested_quantity, unit, product_code FROM purchase_request_items WHERE purchase_request_id = $1',
      [request.id]
    );
    
    console.log(`Found ${itemsResult.rows.length} items for this request:`);
    itemsResult.rows.forEach(item => {
      console.log(`  - ${item.description} (${item.requested_quantity} ${item.unit})`);
    });
    
    // Check purchase order items
    const poItemsResult = await pool.query(
      `SELECT poi.description, poi.unit_price, poi.total_price 
       FROM purchase_order_items poi 
       JOIN purchase_orders po ON poi.purchase_order_id = po.id 
       WHERE po.purchase_request_id = $1`,
      [request.id]
    );
    
    console.log(`Found ${poItemsResult.rows.length} purchase order items:`);
    poItemsResult.rows.forEach(item => {
      console.log(`  - ${item.description}: unit=${item.unit_price}, total=${item.total_price}`);
    });
    
    // Check supplier quotation items if chosen supplier exists
    if (request.chosen_supplier_id) {
      console.log(`Checking supplier quotation items for chosen supplier ${request.chosen_supplier_id}...`);
      
      const quotationResult = await pool.query(
        'SELECT id FROM quotations WHERE purchase_request_id = $1 LIMIT 1',
        [request.id]
      );
      
      if (quotationResult.rows.length > 0) {
        const quotationId = quotationResult.rows[0].id;
        const supplierQuotationResult = await pool.query(
          'SELECT id FROM supplier_quotations WHERE quotation_id = $1 AND supplier_id = $2 LIMIT 1',
          [quotationId, request.chosen_supplier_id]
        );
        
        if (supplierQuotationResult.rows.length > 0) {
          const supplierQuotationId = supplierQuotationResult.rows[0].id;
          const sqItemsResult = await pool.query(
            `SELECT sqi.unit_price, sqi.total_price, qi.description 
             FROM supplier_quotation_items sqi
             JOIN quotation_items qi ON sqi.quotation_item_id = qi.id
             WHERE sqi.supplier_quotation_id = $1`,
            [supplierQuotationId]
          );
          
          console.log(`Found ${sqItemsResult.rows.length} supplier quotation items:`);
          sqItemsResult.rows.forEach(item => {
            console.log(`  - ${item.description}: unit=${item.unit_price}, total=${item.total_price}`);
          });
        } else {
          console.log('No supplier quotation found for chosen supplier');
        }
      } else {
        console.log('No quotation found for this request');
      }
    } else {
      console.log('No chosen supplier for this request');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testSpecificRequest();