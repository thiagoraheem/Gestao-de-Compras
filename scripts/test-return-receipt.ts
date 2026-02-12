
import { storage } from "../server/storage";
import { db } from "../server/db";
import { receipts, auditLogs } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function runTests() {
  console.log("Starting Return to Receipt Logic Tests...");

  try {
    // Setup: Get an admin user
    const adminUser = await storage.getUserByUsername("admin");
    if (!adminUser) throw new Error("Admin user not found");

    // Setup: Ensure there is at least one supplier
    let baseSupplier: any;
    try {
        const suppliers = await storage.getAllSuppliers();
        baseSupplier = suppliers[0];
    } catch (e) {
        console.warn("Could not fetch suppliers, trying to create one...");
    }

    if (!baseSupplier) {
      // Try to find by unique field if possible, or just create
      // Since createSupplier might fail if unique constraints (cnpj) exist
      // We'll try to create with a random CNPJ to avoid conflicts
      const randomSuffix = Math.floor(Math.random() * 10000);
      try {
          baseSupplier = await storage.createSupplier({
            name: `Fornecedor Teste Retorno ${randomSuffix}`,
            type: 0,
            cnpj: `000000000${randomSuffix}`,
            contact: "Contato Teste",
            email: `teste-retorno-${randomSuffix}@example.com`,
            phone: "11999999999",
            address: "Endereco Teste, 123",
            paymentTerms: "30 dias",
            productsServices: "Geral",
            companyId: 1,
          });
      } catch (e) {
         console.log("Failed to create supplier, trying to fetch again (maybe race condition)");
         const suppliers = await storage.getAllSuppliers();
         baseSupplier = suppliers[0];
         if (!baseSupplier) throw new Error("Could not get or create a supplier");
      }
    }

    // --- Test Case 1: Full Unconfirmed Order ---
    console.log("\n--- Test Case 1: Full Unconfirmed Order ---");
    
    // 1. Create Request
    const req1 = await storage.createPurchaseRequest({
      requesterId: adminUser.id,
      companyId: 1,
      costCenterId: 1,
      category: "Produto",
      urgency: "Médio",
      justification: "Test Return 1",
      idealDeliveryDate: new Date(),
      totalValue: "1000.00",
      currentPhase: "conf_fiscal",
    });
    console.log(`Created Request ${req1.id}`);

    // 2. Create Order
    const order1 = await storage.createPurchaseOrder({
      orderNumber: `ORD-${req1.id}`,
      purchaseRequestId: req1.id,
      supplierId: baseSupplier.id,
      status: "draft",
      totalValue: "1000.00",
      paymentTerms: "30 days",
      deliveryTerms: null,
      deliveryAddress: null,
      contactPerson: null,
      contactPhone: null,
      observations: "Order for Test Return 1",
      approvedBy: null,
      approvedAt: null,
      createdBy: adminUser.id,
    });
    console.log(`Created Order ${order1.id}`);

    // 3. Create Unconfirmed Receipt
    await db.insert(receipts).values({
      purchaseOrderId: order1.id,
      receiptDate: new Date(),
      invoiceNumber: "NF-1",
      invoiceSeries: "1",
      totalAmount: "500",
      xmlKey: "key1",
      status: "conferencia" // Unconfirmed
    });
    console.log("Created Unconfirmed Receipt");

    // 4. Execute Return
    await storage.returnToPhysicalReceipt(req1.id, adminUser.id);
    console.log("Executed returnToPhysicalReceipt");

    // 5. Verify
    const receipts1 = await storage.getReceiptsByPurchaseOrderId(order1.id);
    const updatedReq1 = await storage.getPurchaseRequest(req1.id);

    if (receipts1.length === 0 && updatedReq1?.currentPhase === "recebimento") {
      console.log("✅ Test Case 1 Passed: Receipts deleted, phase reverted.");
    } else {
      console.error("❌ Test Case 1 Failed:", { receiptsCount: receipts1.length, phase: updatedReq1?.currentPhase });
    }

    // --- Test Case 2: Partial Order with Confirmed NFs ---
    console.log("\n--- Test Case 2: Partial Order with Confirmed NFs ---");

    // 1. Create Request
    const req2 = await storage.createPurchaseRequest({
      requesterId: adminUser.id,
      companyId: 1,
      costCenterId: 1,
      category: "Produto",
      urgency: "Médio",
      justification: "Test Return 2",
      idealDeliveryDate: new Date(),
      totalValue: "2000.00",
      currentPhase: "conf_fiscal",
    });
    console.log(`Created Request ${req2.id}`);

    // 2. Create Order
    const order2 = await storage.createPurchaseOrder({
      orderNumber: `ORD-${req2.id}`,
      purchaseRequestId: req2.id,
      supplierId: baseSupplier.id,
      status: "draft",
      totalValue: "2000.00",
      paymentTerms: "30 days",
      deliveryTerms: null,
      deliveryAddress: null,
      contactPerson: null,
      contactPhone: null,
      observations: "Order for Test Return 2",
      approvedBy: null,
      approvedAt: null,
      createdBy: adminUser.id,
    });

    // 3. Create Confirmed Receipt
    await db.insert(receipts).values({
      purchaseOrderId: order2.id,
      receiptDate: new Date(),
      invoiceNumber: "NF-2-CONF",
      invoiceSeries: "1",
      totalAmount: "1000",
      xmlKey: "key2-conf",
      status: "fiscal_conferida" // Confirmed
    });

    // 4. Create Unconfirmed Receipt
    await db.insert(receipts).values({
      purchaseOrderId: order2.id,
      receiptDate: new Date(),
      invoiceNumber: "NF-2-UNCONF",
      invoiceSeries: "1",
      totalAmount: "1000",
      xmlKey: "key2-unconf",
      status: "conferencia" // Unconfirmed
    });
    console.log("Created 1 Confirmed and 1 Unconfirmed Receipt");

    // 5. Execute Return
    await storage.returnToPhysicalReceipt(req2.id, adminUser.id);
    console.log("Executed returnToPhysicalReceipt");

    // 6. Verify
    const receipts2 = await storage.getReceiptsByPurchaseOrderId(order2.id);
    const updatedReq2 = await storage.getPurchaseRequest(req2.id);

    const hasConfirmed = receipts2.some(r => r.status === "fiscal_conferida");
    const hasUnconfirmed = receipts2.some(r => r.status === "conferencia");

    if (hasConfirmed && !hasUnconfirmed && updatedReq2?.currentPhase === "recebimento") {
      console.log("✅ Test Case 2 Passed: Confirmed kept, Unconfirmed deleted, phase reverted.");
    } else {
      console.error("❌ Test Case 2 Failed:", { 
        receiptsCount: receipts2.length, 
        hasConfirmed, 
        hasUnconfirmed, 
        phase: updatedReq2?.currentPhase 
      });
    }

    // --- Test Case 5: Log Verification ---
    console.log("\n--- Test Case 5: Log Verification ---");
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actionType, "phase_rollback_receipt"))
      .orderBy(desc(auditLogs.id))
      .limit(10);

    const log1 = logs.find((l) => l.purchaseRequestId === req1.id);
    const log2 = logs.find((l) => l.purchaseRequestId === req2.id);

    if (log1 && log2) {
      console.log("✅ Test Case 5 Passed: Logs found for both operations.");
      console.log("Log 1 Description:", log1.actionDescription);
      console.log("Log 2 Description:", log2.actionDescription);
    } else {
      console.error("❌ Test Case 5 Failed: Logs missing.", {
        foundForReq1: !!log1,
        foundForReq2: !!log2,
      });
    }

  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    process.exit(0);
  }
}

runTests();
