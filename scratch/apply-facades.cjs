const fs = require('fs');

try {
  let content = fs.readFileSync('server/storage.ts', 'utf8');

  function replaceFacade(startMarker, endMarker, replacement) {
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);
    if (startIndex === -1 || endIndex === -1) {
      console.log(`Markers not found for ${startMarker.substring(0, 30)}...`);
      return;
    }
    content = content.substring(0, startIndex) + replacement + '\n  ' + content.substring(endIndex);
  }

  // 1. Company
  replaceFacade(
    '  // Company operations',
    '  // User operations',
    `  // Company operations
  async getAllCompanies() { return await companyRepository.getAllCompanies(); }
  async getCompanyById(id) { return await companyRepository.getCompanyById(id); }
  async createCompany(company) { return await companyRepository.createCompany(company); }
  async updateCompany(id, company) { return await companyRepository.updateCompany(id, company); }
  async deleteCompany(id) { return await companyRepository.deleteCompany(id); }`
  );

  // 2. User
  replaceFacade(
    '  // User operations',
    '  // Department operations',
    `  // User operations
  async getUser(id) { return await userRepository.getUser(id); }
  async getUserByUsername(username) { return await userRepository.getUserByUsername(username); }
  async getUserByEmail(email) { return await userRepository.getUserByEmail(email); }
  async createUser(insertUser) { return await userRepository.createUser(insertUser); }
  async updateUser(id, user) { return await userRepository.updateUser(id, user); }
  async deleteUser(id) { return await userRepository.deleteUser(id); }
  async getAllUsers() { return await userRepository.getAllUsers(); }
  async getUsersByRole(role) { return await userRepository.getUsersByRole(role); }
  async getUserDepartments(userId) { return await userRepository.getUserDepartments(userId); }
  async assignUserToDepartments(userId, departmentIds) { return await userRepository.assignUserToDepartments(userId, departmentIds); }`
  );

  // 3. Department
  replaceFacade(
    '  // Department operations',
    '  // Supplier operations',
    `  // Department operations
  async getAllDepartments() { return await departmentRepository.getAllDepartments(); }
  async getDepartmentById(id) { return await departmentRepository.getDepartmentById(id); }
  async createDepartment(department) { return await departmentRepository.createDepartment(department); }
  async updateDepartment(id, department) { return await departmentRepository.updateDepartment(id, department); }
  async deleteDepartment(id) { return await departmentRepository.deleteDepartment(id); }`
  );

  // 4. Supplier
  replaceFacade(
    '  // Supplier operations',
    '  // Supplier Attachment operations',
    `  // Supplier operations
  async getAllSuppliers() { return await supplierRepository.getAllSuppliers(); }
  async getSupplierById(id) { return await supplierRepository.getSupplierById(id); }
  async createSupplier(supplier) { return await supplierRepository.createSupplier(supplier); }
  async updateSupplier(id, supplier) { return await supplierRepository.updateSupplier(id, supplier); }
  async deleteSupplier(id) { return await supplierRepository.deleteSupplier(id); }`
  );

  // 5. PurchaseOrder
  replaceFacade(
    '  // Purchase Order operations',
    '  async createReceipt(',
    `  // Purchase Order operations
  async getPurchaseOrderById(id) { return await purchaseOrderRepository.getPurchaseOrderById(id); }
  async getPurchaseOrderByRequestId(reqId) { return await purchaseOrderRepository.getPurchaseOrderByRequestId(reqId); }
  async createPurchaseOrder(po) { return await purchaseOrderRepository.createPurchaseOrder(po); }
  async updatePurchaseOrder(id, po) { return await purchaseOrderRepository.updatePurchaseOrder(id, po); }

  // Purchase Order Items operations
  async getPurchaseOrderItems(poId) { return await purchaseOrderRepository.getPurchaseOrderItems(poId); }
  async createPurchaseOrderItem(item) { return await purchaseOrderRepository.createPurchaseOrderItem(item); }
  async deletePurchaseOrderByRequestId(reqId) { return await purchaseOrderRepository.deletePurchaseOrderByRequestId(reqId); }
  async updatePurchaseOrderItem(id, item) { return await purchaseOrderRepository.updatePurchaseOrderItem(id, item); }`
  );

  // 6. Receipt
  replaceFacade(
    '  async createReceipt(',
    '  // Approval History operations',
    `  async createReceipt(receipt) { return await receiptRepository.createReceipt(receipt); }
  async createReceiptItem(item) { return await receiptRepository.createReceiptItem(item); }
  async getReceiptsByPurchaseOrderId(poId) { return await receiptRepository.getReceiptsByPurchaseOrderId(poId); }
  async getReceiptById(id) { return await receiptRepository.getReceiptById(id); }
  async returnToPhysicalReceipt(reqId, userId) { return await receiptRepository.returnToPhysicalReceipt(reqId, userId); }`
  );

  // 7. Quotation (RFQ)
  replaceFacade(
    '  // RFQ (Quotation) operations',
    '  // Approval History operations', // Wait, no. "Approval History operations" is before RFQ? No, it's after `returnToPhysicalReceipt`. Let's check where RFQ ends.
    // Let me find out where RFQ ends first!
    ''
  );

  fs.writeFileSync('server/storage.ts', content);
  console.log('Applied initial facades!');
} catch (e) {
  console.error(e);
}
