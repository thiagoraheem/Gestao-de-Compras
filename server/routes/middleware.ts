import type { Request, Response } from "express";
import { storage } from "../storage";

export async function isAuthenticated(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
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