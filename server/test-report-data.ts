import { Pool } from 'pg';
import { DatabaseStorage } from './storage.ts';
import 'dotenv/config';

const poolConfig = {
  connectionString: process.env.DATABASE_URL_DEV || 'postgresql://postgres:postgres@localhost:5432/gestao_compras',
};

const testPool = new Pool(poolConfig);

async function testReportData() {
  try {
    console.log('=== Testing Purchase Requests Report Data ===');
    
    // Test the actual function that's being called
    const storage = new DatabaseStorage();
    
    console.log('Calling getPurchaseRequestsForReport...');
    const requests = await storage.getPurchaseRequestsForReport({});
    
    console.log(`Found ${requests.length} requests`);
    
    // Find requests with items that should have pricing
    const requestsWithItems = requests.filter(r => r.items && r.items.length > 0);
    console.log(`Found ${requestsWithItems.length} requests with items`);
    
    if (requestsWithItems.length > 0) {
      const firstRequest = requestsWithItems[0];
      console.log('\nFirst request with items:');
      console.log(`Request: ${firstRequest.requestNumber}`);
      console.log('Items:');
      firstRequest.items.forEach((item, index) => {
        console.log(`  Item ${index + 1}:`);
        console.log(`    Description: ${item.description}`);
        console.log(`    Unit Price: ${item.unitPrice} (type: ${typeof item.unitPrice})`);
        console.log(`    Total Price: ${item.totalPrice} (type: ${typeof item.totalPrice})`);
        console.log(`    Unit Price === null: ${item.unitPrice === null}`);
        console.log(`    Total Price === null: ${item.totalPrice === null}`);
        console.log('');
      });
      
      // Test formatCurrency on these values
      const formatCurrency = (value) => {
        if (value === null || value === undefined) {
          return "N/A";
        }
        
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(numValue)) {
          return "N/A";
        }
        
        return numValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      };
      
      console.log('Testing formatCurrency on these values:');
      firstRequest.items.forEach((item, index) => {
        console.log(`  Item ${index + 1}: ${item.description}`);
        console.log(`    formatCurrency(unitPrice): ${formatCurrency(item.unitPrice)}`);
        console.log(`    formatCurrency(totalPrice): ${formatCurrency(item.totalPrice)}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await testPool.end();
    process.exit(0);
  }
}

testReportData();