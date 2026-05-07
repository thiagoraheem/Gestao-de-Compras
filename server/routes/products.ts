import { Express } from "express";
import { isAuthenticated } from "./auth";
import { erpService } from "../erp-service";

/**
 * Product search routes for ERP integration.
 * Restored after backend modularization.
 */
export function registerProductRoutes(app: Express) {
  // Search products in ERP (or mock fallback)
  app.get("/api/products/search", isAuthenticated, async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      
      // Minimum 2 characters for search
      if (q.length < 2) {
        return res.json([]);
      }

      const limit = typeof req.query.limit === "string" 
        ? parseInt(req.query.limit) 
        : 20;

      const products = await erpService.searchProducts({ 
        q, 
        limit: isNaN(limit) ? 20 : limit 
      });

      res.json(products);
    } catch (error) {
      console.error("[Products] Error searching products:", error);
      res.status(500).json({ message: "Erro interno ao buscar produtos" });
    }
  });

  // ERP connection test
  app.get("/api/erp/test-connection", isAuthenticated, async (_req, res) => {
    try {
      const result = await erpService.testConnection();
      res.json(result);
    } catch (error) {
      console.error("[ERP] Error testing connection:", error);
      res.status(500).json({ message: "Erro interno ao testar conexão com ERP" });
    }
  });
}
