const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyRealtimeTriggers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '..', 'migrations', '0010_add_realtime_triggers.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing real-time triggers migration...');
    
    // Execute the SQL
    await client.query(sqlContent);
    
    console.log('✅ Real-time triggers migration applied successfully!');
    
    // Verify triggers were created
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' 
      AND trigger_name LIKE '%notify_trigger'
      ORDER BY event_object_table, trigger_name;
    `);
    
    console.log('\n📋 Created triggers:');
    triggerCheck.rows.forEach(row => {
      console.log(`  - ${row.trigger_name} on ${row.event_object_table} (${row.event_manipulation})`);
    });
    
    // Verify functions were created
    const functionCheck = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name LIKE '%notify_%_change'
      ORDER BY routine_name;
    `);
    
    console.log('\n🔧 Created functions:');
    functionCheck.rows.forEach(row => {
      console.log(`  - ${row.routine_name} (${row.routine_type})`);
    });

  } catch (error) {
    console.error('❌ Error applying real-time triggers migration:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Load environment variables
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

applyRealtimeTriggers();