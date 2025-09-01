import { pool } from './db.js';

async function main() {
  try {
    // Check purchase requests and their purchase orders
    console.log('=== Purchase Requests with Purchase Orders ===');
    const result1 = await pool.query(`
      SELECT pr.request_number, pr.current_phase, po.id as po_id, po.order_number 
      FROM purchase_requests pr 
      LEFT JOIN purchase_orders po ON pr.id = po.purchase_request_id 
      ORDER BY pr.created_at DESC LIMIT 10
    `);
    
    result1.rows.forEach(r => {
      console.log(`Request: ${r.request_number}, Phase: ${r.current_phase}, PO ID: ${r.po_id}, PO Number: ${r.order_number}`);
    });
    
    // Check purchase order items for recent requests
    console.log('\n=== Purchase Order Items ===');
    const result2 = await pool.query(`
      SELECT pr.request_number, poi.description, poi.unit_price, poi.total_price, poi.item_code
      FROM purchase_requests pr 
      JOIN purchase_orders po ON pr.id = po.purchase_request_id 
      JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
      ORDER BY pr.created_at DESC LIMIT 10
    `);
    
    if (result2.rows.length === 0) {
      console.log('No purchase order items found');
    } else {
      result2.rows.forEach(r => {
        console.log(`Request: ${r.request_number}, Item: ${r.description}, Unit Price: ${r.unit_price}, Total: ${r.total_price}`);
      });
    }
    
    // Check request items
    console.log('\n=== Purchase Request Items ===');
    const result3 = await pool.query(`
      SELECT pr.request_number, pri.description, pri.requested_quantity, pri.unit, pri.product_code
      FROM purchase_requests pr 
      JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id
      ORDER BY pr.created_at DESC LIMIT 10
    `);
    
    if (result3.rows.length === 0) {
      console.log('No purchase request items found');
    } else {
      result3.rows.forEach(r => {
        console.log(`Request: ${r.request_number}, Item: ${r.description}, Qty: ${r.requested_quantity}, Code: ${r.product_code}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();