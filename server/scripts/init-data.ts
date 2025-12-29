
import "dotenv/config";
import { db, pool } from "../db";
import * as schema from "../../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as readline from "readline";
import fs from "fs";
import path from "path";

// --- Configuration ---
const LOG_FILE = path.join(process.cwd(), "init-data.log");

// --- Utils ---
function log(message: string, type: "INFO" | "WARN" | "ERROR" | "SUCCESS" = "INFO") {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + "\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question + " ", (answer) => {
      resolve(answer.trim());
    });
  });
}

async function close() {
  rl.close();
  await pool.end();
}

// --- Main Script ---

async function main() {
  log("Starting initialization script...", "INFO");

  const args = process.argv.slice(2);
  const isClean = args.includes("--clean");
  const isInteractive = args.includes("--interactive") || (!args.includes("--auto") && process.stdin.isTTY);

  try {
    // 1. Database Connection Check
    log("Checking database connection...", "INFO");
    try {
        await db.execute(sql`SELECT 1`); // Simple query to check connection
        log("Database connection established successfully.", "SUCCESS");
    } catch (error) {
        log(`Database connection failed: ${(error as Error).message}`, "ERROR");
        process.exit(1);
    }

    // 2. Cleanup (Optional)
    if (isClean) {
      if (isInteractive) {
        const confirm = await ask("WARNING: --clean flag detected. This will delete ALL existing data. Are you sure? (yes/no)");
        if (confirm.toLowerCase() !== "yes") {
          log("Cleanup aborted by user.", "WARN");
          process.exit(0);
        }
      }
      
      log("Cleaning up existing data...", "WARN");
      // Delete in order to avoid foreign key constraints
      await db.delete(schema.users);
      await db.delete(schema.departments);
      await db.delete(schema.companies);
      // Add other tables as needed if we want a full wipe, but these are the core ones we are re-creating.
      log("Data cleanup completed.", "SUCCESS");
    }

    // 3. Company Creation
    log("Checking Company...", "INFO");
    let company = await db.query.companies.findFirst();
    
    if (!company) {
      log("No company found. Creating default company...", "INFO");
      const companyData = {
        name: "Empresa Padrão Ltda",
        tradingName: "Empresa Padrão",
        cnpj: "00.000.000/0001-91",
        email: "contato@empresapadrao.com.br",
        active: true
      };
      
      const [newCompany] = await db.insert(schema.companies).values(companyData).returning();
      company = newCompany;
      log(`Company created: ${company.name} (ID: ${company.id})`, "SUCCESS");
    } else {
      log(`Company already exists: ${company.name} (ID: ${company.id})`, "INFO");
    }

    // 4. Departments Creation
    log("Checking Departments...", "INFO");
    const requiredDepts = ["RH", "Financeiro", "TI"];
    const deptMap = new Map<string, number>();

    for (const deptName of requiredDepts) {
      let dept = await db.query.departments.findFirst({
        where: eq(schema.departments.name, deptName),
      });

      if (!dept) {
        log(`Creating department: ${deptName}...`, "INFO");
        const [newDept] = await db.insert(schema.departments).values({
          name: deptName,
          description: `Departamento de ${deptName}`,
          companyId: company!.id,
        }).returning();
        dept = newDept;
        log(`Department created: ${deptName}`, "SUCCESS");
      } else {
        log(`Department already exists: ${deptName}`, "INFO");
      }
      deptMap.set(deptName, dept.id);
    }

    // 5. Admin User Creation
    log("Checking Admin User...", "INFO");
    const adminEmail = "admin@empresapadrao.com.br";
    let adminUser = await db.query.users.findFirst({
      where: eq(schema.users.email, adminEmail),
    });

    if (!adminUser) {
      log("Creating Admin User...", "INFO");
      let password = "admin123"; // Default password
      
      if (isInteractive) {
        const inputPass = await ask("Enter password for admin user (default: admin123):");
        if (inputPass) password = inputPass;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Assign to TI department by default
      const tiDeptId = deptMap.get("TI");

      const [newUser] = await db.insert(schema.users).values({
        username: "admin",
        email: adminEmail,
        password: hashedPassword,
        firstName: "Administrador",
        lastName: "Sistema",
        companyId: company!.id,
        departmentId: tiDeptId,
        isAdmin: true,
        isManager: true,
        isBuyer: true,
        isApproverA1: true,
        isApproverA2: true,
        isReceiver: true,
      }).returning();
      
      adminUser = newUser;
      log(`Admin user created: ${adminEmail}`, "SUCCESS");
      
      // Save credentials to a separate file for security/reference
      const credsFile = path.join(process.cwd(), "admin_credentials.txt");
      fs.writeFileSync(credsFile, `Email: ${adminEmail}\nPassword: ${password}\nDate: ${new Date().toISOString()}`);
      log(`Admin credentials saved to ${credsFile}`, "INFO");
      
    } else {
      log(`Admin user already exists: ${adminEmail}`, "INFO");
    }

    // 6. Verification
    log("Verifying data integrity...", "INFO");
    const totalUsers = (await db.select().from(schema.users)).length;
    const totalDepts = (await db.select().from(schema.departments)).length;
    const totalCompanies = (await db.select().from(schema.companies)).length;

    log(`Verification Report:`, "INFO");
    log(`- Companies: ${totalCompanies}`, "INFO");
    log(`- Departments: ${totalDepts}`, "INFO");
    log(`- Users: ${totalUsers}`, "INFO");

    if (totalCompanies > 0 && totalDepts >= 3 && totalUsers > 0) {
        log("Initialization completed successfully.", "SUCCESS");
    } else {
        log("Initialization completed with warnings. Some data might be missing.", "WARN");
    }

  } catch (error) {
    log(`An unexpected error occurred: ${(error as Error).message}`, "ERROR");
    if ((error as any).stack) {
        log((error as any).stack, "ERROR");
    }
    process.exit(1);
  } finally {
    await close();
  }
}

// Needed for `sql` template literal
import { sql } from "drizzle-orm";

main();
