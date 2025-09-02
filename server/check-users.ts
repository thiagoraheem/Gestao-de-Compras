import { storage } from './storage.js';

async function checkUsers() {
  try {
    const db = storage.db;
    const { users } = storage.db.schema;
    
    // Get some users to see what IDs are available
    const userList = await db.select().from(users).limit(5);
    console.log('Available users:');
    for (const user of userList) {
      console.log(`ID: ${user.id}, Username: ${user.username}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();