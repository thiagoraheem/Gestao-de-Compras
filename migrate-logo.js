import fs from 'fs';
import path from 'path';
import { db } from './server/db.ts';
import { companies } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function migrateLogo() {
  try {
    console.log('Starting logo migration...');
    
    // Get company with existing logo
    const company = await db.select().from(companies).where(eq(companies.id, 2)).then(rows => rows[0]);
    
    if (!company) {
      console.log('No company found with ID 2');
      return;
    }
    
    console.log(`Found company: ${company.name}`);
    
    // Check if logo file exists
    const logoPath = path.join('uploads/company_logos/logo-1752518174965-791241502.jpg');
    if (!fs.existsSync(logoPath)) {
      console.log('Logo file not found at path:', logoPath);
      return;
    }
    
    // Read and convert to base64
    const logoBuffer = fs.readFileSync(logoPath);
    const base64Logo = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
    
    console.log(`Logo converted to base64 (${base64Logo.length} characters)`);
    
    // Update database
    await db.update(companies)
      .set({ logoBase64: base64Logo })
      .where(eq(companies.id, 2));
    
    console.log('Logo migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateLogo();