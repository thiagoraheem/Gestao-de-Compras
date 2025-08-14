import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
// Import other route modules as they are created
// import { registerUserRoutes } from "./users";
// import { registerCompanyRoutes } from "./companies";
// import { registerPurchaseRequestRoutes } from "./purchase-requests";
// import { registerQuotationRoutes } from "./quotations";
// import { registerPurchaseOrderRoutes } from "./purchase-orders";

export function registerAllRoutes(app: Express) {
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