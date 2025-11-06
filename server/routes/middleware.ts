import type { Request, Response } from "express";
import { storage } from "../storage";

export async function isAuthenticated(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware que exige autenticação e anexa o usuário em req.user
export async function requireAuth(req: Request, res: Response, next: Function) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Anexar usuário à requisição para uso em rotas
    (req as any).user = {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      isBuyer: user.isBuyer,
      isManager: user.isManager,
      isApproverA1: user.isApproverA1,
      isApproverA2: user.isApproverA2,
      isReceiver: user.isReceiver,
      departmentId: user.departmentId,
      costCenterId: user.costCenterId,
      companyId: user.companyId,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function canApproveRequest(req: Request, res: Response, next: Function) {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only admin, buyer, and manager can approve requests
    if (user.isAdmin || user.isBuyer || user.isManager) {
      next();
    } else {
      res.status(403).json({ message: "Insufficient permissions to approve requests" });
    }
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function isAdmin(req: Request, res: Response, next: Function) {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isAdmin) {
      next();
    } else {
      res.status(403).json({ message: "Admin access required" });
    }
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function isAdminOrBuyer(req: Request, res: Response, next: Function) {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isAdmin || user.isBuyer) {
      next();
    } else {
      res.status(403).json({ message: "Admin or buyer access required" });
    }
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}