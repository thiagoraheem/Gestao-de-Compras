import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { PDFService } from "../pdf-service";
import { storage } from "../storage";
// Import other route modules as they are created
// import { registerUserRoutes } from "./users";
// import { registerCompanyRoutes } from "./companies";
// import { registerPurchaseRequestRoutes } from "./purchase-requests";
// import { registerQuotationRoutes } from "./quotations";
// import { registerPurchaseOrderRoutes } from "./purchase-orders";

// Register public routes (no authentication required)
function registerPublicRoutes(app: Express) {
  // Public endpoint to get purchase request details
  app.get("/api/public/purchase-request/:id", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }

      const purchaseRequest = await storage.getPurchaseRequestById(requestId);
      if (!purchaseRequest) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Get related data
      const [items, requester, timeline] = await Promise.all([
        storage.getPurchaseRequestItems(requestId),
        purchaseRequest.requesterId ? storage.getUser(purchaseRequest.requesterId) : null,
        storage.getCompleteTimeline(requestId)
      ]);

      // Get department and cost center
      let department = null;
      let costCenter = null;
      if (purchaseRequest.costCenterId) {
        const allCostCenters = await storage.getAllCostCenters();
        costCenter = allCostCenters.find((cc: any) => cc.id === purchaseRequest.costCenterId);
        
        if (costCenter && costCenter.departmentId) {
          const allDepartments = await storage.getAllDepartments();
          department = allDepartments.find((d: any) => d.id === costCenter.departmentId);
        }
      }

      // Get company
      let company = null;
      if (purchaseRequest.companyId) {
        company = await storage.getCompanyById(purchaseRequest.companyId);
      }

      // Get delivery location
      let deliveryLocation = null;
      if (purchaseRequest.deliveryLocationId) {
        const allDeliveryLocations = await storage.getAllDeliveryLocations();
        deliveryLocation = allDeliveryLocations.find((dl: any) => dl.id === purchaseRequest.deliveryLocationId);
      }

      // Get supplier information if available
      let supplier = null;
      try {
        const quotation = await storage.getQuotationByPurchaseRequestId(requestId);
        if (quotation) {
          const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
          const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen);
          
          if (selectedSupplierQuotation) {
            const allSuppliers = await storage.getAllSuppliers();
            supplier = allSuppliers.find((s: any) => s.id === selectedSupplierQuotation.supplierId);
          }
        }
      } catch (error) {
        console.warn('Could not fetch supplier data:', error);
      }

      // Check if purchase order PDF is available
      const hasPurchaseOrderPdf = purchaseRequest.phase === 'purchase_order' || 
                                 purchaseRequest.phase === 'conclusion' || 
                                 purchaseRequest.phase === 'receipt' || 
                                 purchaseRequest.phase === 'archived';

      res.json({
        purchaseRequest,
        items,
        requester,
        department,
        costCenter,
        company,
        deliveryLocation,
        timeline,
        supplier,
        hasPurchaseOrderPdf
      });
    } catch (error) {
      console.error("Error fetching public purchase request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public endpoint to download purchase order PDF
  app.get("/api/public/purchase-request/:id/pdf", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }

      const purchaseRequest = await storage.getPurchaseRequestById(requestId);
      if (!purchaseRequest) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Check if PDF is available based on phase
      const hasPurchaseOrderPdf = purchaseRequest.phase === 'purchase_order' || 
                                 purchaseRequest.phase === 'conclusion' || 
                                 purchaseRequest.phase === 'receipt' || 
                                 purchaseRequest.phase === 'archived';

      if (!hasPurchaseOrderPdf) {
        return res.status(404).json({ message: "Purchase order PDF not available yet" });
      }

      // Generate PDF
      const pdfBuffer = await PDFService.generatePurchaseOrderPDF(requestId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Pedido_Compra_${purchaseRequest.requestNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating public PDF:", error);
      res.status(500).json({ message: "Error generating PDF" });
    }
  });
}

export function registerAllRoutes(app: Express) {
  // Register public routes (no authentication required)
  registerPublicRoutes(app);
  
  // Register authentication routes
  registerAuthRoutes(app);
  
  // Register other route modules
  // registerUserRoutes(app);
  // registerCompanyRoutes(app);
  // registerPurchaseRequestRoutes(app);
  // registerQuotationRoutes(app);
  // registerPurchaseOrderRoutes(app);
}

// Export middleware for use in other modules
export { isAuthenticated } from "./auth";
export { canApproveRequest, isAdmin, isAdminOrBuyer } from "./middleware";
export { quotationUpload, companyLogoUpload } from "./upload-config";