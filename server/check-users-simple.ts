import { storage } from './storage.js';

async function checkUsersSimple() {
  try {
    const users = await storage.getAllUsers();
    console.log('Available users:');
    for (const user of users) {
      console.log(`ID: ${user.id}, Username: ${user.username}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsersSimple();