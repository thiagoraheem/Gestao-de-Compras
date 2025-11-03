import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
});

async function checkSessionsTable() {
  try {
    console.log('Checking sessions table...');
    
    // Check if sessions table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      );
    `);
    
    console.log('Sessions table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Check table structure
      const tableStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'sessions' 
        ORDER BY ordinal_position;
      `);
      
      console.log('Table structure:');
      tableStructure.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      // Check if there are any sessions
      const sessionCount = await pool.query('SELECT COUNT(*) FROM sessions');
      console.log('Current sessions count:', sessionCount.rows[0].count);
      
      // Show recent sessions (if any)
      const recentSessions = await pool.query(`
        SELECT sid, expire, 
               CASE 
                 WHEN expire > NOW() THEN 'valid' 
                 ELSE 'expired' 
               END as status
        FROM sessions 
        ORDER BY expire DESC 
        LIMIT 5
      `);
      
      console.log('Recent sessions:');
      recentSessions.rows.forEach(row => {
        console.log(`  ${row.sid}: expires ${row.expire} (${row.status})`);
      });
    } else {
      console.log('Sessions table does not exist! This could be the problem.');
      console.log('Creating sessions table...');
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "sessions" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        )
        WITH (OIDS=FALSE);
      `);
      
      await pool.query(`
        ALTER TABLE "sessions" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
      `);
      
      await pool.query(`
        CREATE INDEX "IDX_session_expire" ON "sessions" ("expire");
      `);
      
      console.log('Sessions table created successfully!');
    }
    
  } catch (error) {
    console.error('Error checking sessions table:', error);
  } finally {
    await pool.end();
  }
}

checkSessionsTable();