const fs = require('fs');

let content = fs.readFileSync('server/storage.ts', 'utf8');

function replaceMethod(methodName, newImplementation) {
  // Let's just find "  async methodName("
  const startMarker1 = "  async " + methodName + "(";
  const startMarker2 = "  async " + methodName + " (";
  
  let startIndex = content.indexOf(startMarker1);
  let startMarker = startMarker1;
  
  if (startIndex === -1) {
    startIndex = content.indexOf(startMarker2);
    startMarker = startMarker2;
  }
  
  if (startIndex === -1) {
    console.log("Method " + methodName + " not found.");
    return;
  }
  
  // Find the opening brace
  const braceIndex = content.indexOf('{', startIndex);
  if (braceIndex === -1) {
    console.log("Opening brace not found for " + methodName);
    return;
  }
  
  // Find the matching closing brace
  let braceCount = 1;
  let endIndex = braceIndex + 1;
  let inString = false;
  let stringChar = '';
  
  while (braceCount > 0 && endIndex < content.length) {
    const char = content[endIndex];
    if (inString) {
      if (char === stringChar && content[endIndex-1] !== '\\\\') {
        inString = false;
      }
    } else {
      if (char === "'" || char === '"' || char === '\`') {
        inString = true;
        stringChar = char;
      } else if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
    }
    endIndex++;
  }
  
  if (braceCount === 0) {
    content = content.substring(0, startIndex) + "  " + newImplementation + content.substring(endIndex);
    console.log("Successfully replaced " + methodName);
  } else {
    console.log("Could not find closing brace for " + methodName);
  }
}

// Company
replaceMethod('getAllCompanies', 'async getAllCompanies() { return await companyRepository.getAllCompanies(); }');
replaceMethod('getCompanyById', 'async getCompanyById(id: number) { return await companyRepository.getCompanyById(id); }');
replaceMethod('createCompany', 'async createCompany(company: any) { return await companyRepository.createCompany(company); }');
replaceMethod('updateCompany', 'async updateCompany(id: number, company: any) { return await companyRepository.updateCompany(id, company); }');
replaceMethod('deleteCompany', 'async deleteCompany(id: number) { return await companyRepository.deleteCompany(id); }');

// Department
replaceMethod('getAllDepartments', 'async getAllDepartments() { return await departmentRepository.getAllDepartments(); }');
replaceMethod('getDepartmentById', 'async getDepartmentById(id: number) { return await departmentRepository.getDepartmentById(id); }');
replaceMethod('createDepartment', 'async createDepartment(department: any) { return await departmentRepository.createDepartment(department); }');
replaceMethod('updateDepartment', 'async updateDepartment(id: number, department: any) { return await departmentRepository.updateDepartment(id, department); }');
replaceMethod('deleteDepartment', 'async deleteDepartment(id: number) { return await departmentRepository.deleteDepartment(id); }');

// User
replaceMethod('getUser', 'async getUser(id: number) { return await userRepository.getUser(id); }');
replaceMethod('getUserByUsername', 'async getUserByUsername(username: string) { return await userRepository.getUserByUsername(username); }');
replaceMethod('getUserByEmail', 'async getUserByEmail(email: string) { return await userRepository.getUserByEmail(email); }');
replaceMethod('createUser', 'async createUser(insertUser: any) { return await userRepository.createUser(insertUser); }');
replaceMethod('updateUser', 'async updateUser(id: number, user: any) { return await userRepository.updateUser(id, user); }');
replaceMethod('deleteUser', 'async deleteUser(id: number) { return await userRepository.deleteUser(id); }');
replaceMethod('getAllUsers', 'async getAllUsers() { return await userRepository.getAllUsers(); }');
replaceMethod('getUsersByRole', 'async getUsersByRole(role: string) { return await userRepository.getUsersByRole(role); }');
replaceMethod('getUserDepartments', 'async getUserDepartments(userId: number) { return await userRepository.getUserDepartments(userId); }');
replaceMethod('assignUserToDepartments', 'async assignUserToDepartments(userId: number, departmentIds: number[]) { return await userRepository.assignUserToDepartments(userId, departmentIds); }');

// Supplier
replaceMethod('getAllSuppliers', 'async getAllSuppliers() { return await supplierRepository.getAllSuppliers(); }');
replaceMethod('getSupplierById', 'async getSupplierById(id: number) { return await supplierRepository.getSupplierById(id); }');
replaceMethod('createSupplier', 'async createSupplier(supplier: any) { return await supplierRepository.createSupplier(supplier); }');
replaceMethod('updateSupplier', 'async updateSupplier(id: number, supplier: any) { return await supplierRepository.updateSupplier(id, supplier); }');
replaceMethod('deleteSupplier', 'async deleteSupplier(id: number) { return await supplierRepository.deleteSupplier(id); }');

// Quotation
replaceMethod('getQuotationsByPurchaseRequestId', 'async getQuotationsByPurchaseRequestId(id: number) { return await quotationRepository.getQuotationsByPurchaseRequestId(id); }');
replaceMethod('getQuotationById', 'async getQuotationById(id: number) { return await quotationRepository.getQuotationById(id); }');
replaceMethod('getQuotationByPurchaseRequestId', 'async getQuotationByPurchaseRequestId(id: number) { return await quotationRepository.getQuotationByPurchaseRequestId(id); }');
replaceMethod('getAllQuotations', 'async getAllQuotations() { return await quotationRepository.getAllQuotations(); }');
replaceMethod('createQuotation', 'async createQuotation(quotation: any) { return await quotationRepository.createQuotation(quotation); }');
replaceMethod('updateQuotation', 'async updateQuotation(id: number, quotation: any) { return await quotationRepository.updateQuotation(id, quotation); }');
replaceMethod('updateQuotationStatus', 'async updateQuotationStatus(id: number, status: string, approvedBy: number) { return await quotationRepository.updateQuotationStatus(id, status, approvedBy); }');
replaceMethod('createQuotationItem', 'async createQuotationItem(item: any) { return await quotationRepository.createQuotationItem(item); }');
replaceMethod('getQuotationItems', 'async getQuotationItems(quotationId: number) { return await quotationRepository.getQuotationItems(quotationId); }');

// Supplier Quotation
replaceMethod('getSupplierQuotations', 'async getSupplierQuotations(quotationId: number) { return await quotationRepository.getSupplierQuotations(quotationId); }');
replaceMethod('getSupplierQuotationById', 'async getSupplierQuotationById(id: number) { return await quotationRepository.getSupplierQuotationById(id); }');
replaceMethod('createSupplierQuotation', 'async createSupplierQuotation(data: any) { return await quotationRepository.createSupplierQuotation(data); }');
replaceMethod('updateSupplierQuotation', 'async updateSupplierQuotation(id: number, data: any) { return await quotationRepository.updateSupplierQuotation(id, data); }');
replaceMethod('getSupplierQuotationItems', 'async getSupplierQuotationItems(id: number) { return await quotationRepository.getSupplierQuotationItems(id); }');
replaceMethod('createSupplierQuotationItem', 'async createSupplierQuotationItem(item: any) { return await quotationRepository.createSupplierQuotationItem(item); }');
replaceMethod('createSupplierQuotationItems', 'async createSupplierQuotationItems(items: any[]) { return await quotationRepository.createSupplierQuotationItems(items); }');
replaceMethod('updateSupplierQuotationItem', 'async updateSupplierQuotationItem(id: number, data: any) { return await quotationRepository.updateSupplierQuotationItem(id, data); }');

// Approved Quotation Items
replaceMethod('getApprovedQuotationItems', 'async getApprovedQuotationItems(quotationId: number) { return await quotationRepository.getApprovedQuotationItems(quotationId); }');
replaceMethod('createApprovedQuotationItem', 'async createApprovedQuotationItem(item: any) { return await quotationRepository.createApprovedQuotationItem(item); }');
replaceMethod('clearApprovedQuotationItems', 'async clearApprovedQuotationItems(quotationId: number) { return await quotationRepository.clearApprovedQuotationItems(quotationId); }');

// Purchase Order
replaceMethod('getPurchaseOrderById', 'async getPurchaseOrderById(id: number) { return await purchaseOrderRepository.getPurchaseOrderById(id); }');
replaceMethod('getPurchaseOrderByRequestId', 'async getPurchaseOrderByRequestId(id: number) { return await purchaseOrderRepository.getPurchaseOrderByRequestId(id); }');
replaceMethod('createPurchaseOrder', 'async createPurchaseOrder(po: any) { return await purchaseOrderRepository.createPurchaseOrder(po); }');
replaceMethod('updatePurchaseOrder', 'async updatePurchaseOrder(id: number, po: any) { return await purchaseOrderRepository.updatePurchaseOrder(id, po); }');
replaceMethod('getPurchaseOrderItems', 'async getPurchaseOrderItems(poId: number) { return await purchaseOrderRepository.getPurchaseOrderItems(poId); }');
replaceMethod('createPurchaseOrderItem', 'async createPurchaseOrderItem(item: any) { return await purchaseOrderRepository.createPurchaseOrderItem(item); }');
replaceMethod('deletePurchaseOrderByRequestId', 'async deletePurchaseOrderByRequestId(id: number) { return await purchaseOrderRepository.deletePurchaseOrderByRequestId(id); }');
replaceMethod('updatePurchaseOrderItem', 'async updatePurchaseOrderItem(id: number, item: any) { return await purchaseOrderRepository.updatePurchaseOrderItem(id, item); }');

// Receipt
replaceMethod('createReceipt', 'async createReceipt(receipt: any) { return await receiptRepository.createReceipt(receipt); }');
replaceMethod('createReceiptItem', 'async createReceiptItem(item: any) { return await receiptRepository.createReceiptItem(item); }');
replaceMethod('getReceiptsByPurchaseOrderId', 'async getReceiptsByPurchaseOrderId(poId: number) { return await receiptRepository.getReceiptsByPurchaseOrderId(poId); }');
replaceMethod('getReceiptById', 'async getReceiptById(id: number) { return await receiptRepository.getReceiptById(id); }');
replaceMethod('returnToPhysicalReceipt', 'async returnToPhysicalReceipt(reqId: number, userId: number) { return await receiptRepository.returnToPhysicalReceipt(reqId, userId); }');

// Purchase Request
replaceMethod('getAllPurchaseRequests', 'async getAllPurchaseRequests(companyId?: number, user?: any) { return await purchaseRequestRepository.getAllPurchaseRequests(companyId, user); }');
replaceMethod('getPurchaseRequestById', 'async getPurchaseRequestById(id: number) { return await purchaseRequestRepository.getPurchaseRequestById(id); }');
replaceMethod('getPurchaseRequestByNumber', 'async getPurchaseRequestByNumber(reqNumber: string) { return await purchaseRequestRepository.getPurchaseRequestByNumber(reqNumber); }');
replaceMethod('createPurchaseRequest', 'async createPurchaseRequest(req: any) { return await purchaseRequestRepository.createPurchaseRequest(req); }');
replaceMethod('updatePurchaseRequest', 'async updatePurchaseRequest(id: number, req: any) { return await purchaseRequestRepository.updatePurchaseRequest(id, req); }');
replaceMethod('getPurchaseRequestsByPhase', 'async getPurchaseRequestsByPhase(phase: string) { return await purchaseRequestRepository.getPurchaseRequestsByPhase(phase); }');
replaceMethod('getPendingMaterialsForConference', 'async getPendingMaterialsForConference() { return await purchaseRequestRepository.getPendingMaterialsForConference(); }');
replaceMethod('getPurchaseRequestsByUser', 'async getPurchaseRequestsByUser(userId: number) { return await purchaseRequestRepository.getPurchaseRequestsByUser(userId); }');
replaceMethod('getPurchaseRequestsForReport', 'async getPurchaseRequestsForReport(filters: any) { return await purchaseRequestRepository.getPurchaseRequestsForReport(filters); }');
replaceMethod('getQuotationsDashboardData', 'async getQuotationsDashboardData() { return await purchaseRequestRepository.getQuotationsDashboardData(); }');
replaceMethod('getPurchaseRequestItems', 'async getPurchaseRequestItems(reqId: number, includeTransferred?: boolean) { return await purchaseRequestRepository.getPurchaseRequestItems(reqId, includeTransferred); }');
replaceMethod('createPurchaseRequestItem', 'async createPurchaseRequestItem(item: any) { return await purchaseRequestRepository.createPurchaseRequestItem(item); }');
replaceMethod('updatePurchaseRequestItem', 'async updatePurchaseRequestItem(id: number, item: any) { return await purchaseRequestRepository.updatePurchaseRequestItem(id, item); }');
replaceMethod('deletePurchaseRequestItem', 'async deletePurchaseRequestItem(id: number) { return await purchaseRequestRepository.deletePurchaseRequestItem(id); }');
replaceMethod('createPurchaseRequestItems', 'async createPurchaseRequestItems(items: any[]) { return await purchaseRequestRepository.createPurchaseRequestItems(items); }');

fs.writeFileSync('server/storage.ts', content);
console.log('All facades applied via simpler AST-like parsing!');
