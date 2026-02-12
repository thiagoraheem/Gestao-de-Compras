
import { storage } from '../storage';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function resetAdmin() {
  try {
    const admin = await storage.getUserByUsername('admin');
    if (admin) {
      console.log('Admin found, resetting password...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, admin.id));
      console.log('Password reset to admin123');
    } else {
      console.log('Admin not found, initializing defaults...');
      await storage.initializeDefaultData();
      console.log('Defaults initialized');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

resetAdmin();
