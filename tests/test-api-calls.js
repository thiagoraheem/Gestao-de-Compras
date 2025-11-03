import { Pool } from 'pg';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
});

// Use local server port from .env
const PORT = process.env.PORT || 5201;

function makeRequest(url, sessionId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: url,
      method: 'GET',
      headers: {
        'Cookie': `sessionId=${sessionId}`, // Changed from connect.sid to sessionId
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testApiCalls() {
  try {
    console.log(`Testing API calls on localhost:${PORT}...`);
    
    // Get a valid session ID from the database
    const sessionResult = await pool.query(`
      SELECT sid FROM sessions 
      WHERE expire > NOW() 
      ORDER BY expire DESC 
      LIMIT 1
    `);
    
    if (sessionResult.rows.length === 0) {
      console.log('No valid sessions found in database');
      return;
    }
    
    const sessionId = sessionResult.rows[0].sid;
    console.log('Using session ID:', sessionId);
    
    // Test endpoints that are failing
    const endpoints = [
      '/api/auth/check',
      '/api/approval-rules/config',
      '/api/purchase-requests'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\nTesting ${endpoint}...`);
      
      try {
        const response = await makeRequest(endpoint, sessionId);
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.status === 200) {
          console.log(`Response: ${response.data.substring(0, 200)}${response.data.length > 200 ? '...' : ''}`);
        } else {
          console.log(`Error: ${response.data}`);
        }
        
      } catch (error) {
        console.log(`Request failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error testing API calls:', error);
  } finally {
    await pool.end();
  }
}

testApiCalls();