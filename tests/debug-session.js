import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
});

async function debugSession() {
  try {
    console.log('Debugging session data...');
    
    // Get session data from database
    const sessionResult = await pool.query(`
      SELECT sid, sess, expire FROM sessions 
      WHERE expire > NOW() 
      ORDER BY expire DESC 
      LIMIT 1
    `);
    
    if (sessionResult.rows.length === 0) {
      console.log('No valid sessions found in database');
      return;
    }
    
    const session = sessionResult.rows[0];
    console.log('Session ID:', session.sid);
    console.log('Session expires:', session.expire);
    console.log('Session data:', JSON.stringify(session.sess, null, 2));
    
    // Check if userId exists in session
    if (session.sess && session.sess.userId) {
      console.log('User ID in session:', session.sess.userId);
      
      // Check if user exists in database
      const userResult = await pool.query(`
        SELECT id, username, email, first_name, last_name, is_admin, is_buyer, is_approver_a1, is_approver_a2 FROM users WHERE id = $1
      `, [session.sess.userId]);
      
      if (userResult.rows.length > 0) {
        console.log('User found:', userResult.rows[0]);
      } else {
        console.log('User not found in database!');
      }
    } else {
      console.log('No userId found in session data!');
    }
    
  } catch (error) {
    console.error('Error debugging session:', error);
  } finally {
    await pool.end();
  }
}

debugSession();