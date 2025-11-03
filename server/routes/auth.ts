import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";

// Authentication middleware
export async function isAuthenticated(req: Request, res: Response, next: Function) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Validação rigorosa: verificar se a sessão realmente existe no banco
    const { validateSession } = await import('../db');
    const sessionId = req.sessionID;
    
    if (!sessionId) {
      console.log('❌ Middleware auth: No session ID found');
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const sessionValidation = await validateSession(sessionId);
    if (!sessionValidation || sessionValidation.userId !== req.session.userId) {
      console.log('❌ Middleware auth: Session validation failed for sessionId:', sessionId.substring(0, 20) + '...');
      // Limpar sessão inválida
      req.session.destroy((err) => {
        if (err) console.error('Error destroying invalid session:', err);
      });
      return res.status(401).json({ message: "Authentication required" });
    }

    console.log('✅ Middleware auth: Session validated for userId:', sessionValidation.userId);
    next();
  } catch (error) {
    console.error('❌ Middleware auth error:', error);
    res.status(401).json({ message: "Authentication required" });
  }
}

export function registerAuthRoutes(app: Express) {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      
      // Get company data
      const company = user.companyId ? await storage.getCompanyById(user.companyId) : null;
      
      res.json({ 
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isBuyer: user.isBuyer,
        isManager: user.isManager,
        isApproverA1: user.isApproverA1,
        isApproverA2: user.isApproverA2,
        isReceiver: user.isReceiver,
        departmentId: user.departmentId,
        costCenterId: user.costCenterId,
        companyId: user.companyId,
        company: company ? {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          logoUrl: company.logoUrl
        } : null
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ message: "Could not log out" });
      }
      
      // Clear the session cookie with the correct name and options
      res.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      });
      
      // Also try to clear any other potential session cookies
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      });
      
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get company data
      const company = user.companyId ? await storage.getCompanyById(user.companyId) : null;
      
      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isBuyer: user.isBuyer,
        isManager: user.isManager,
        isApproverA1: user.isApproverA1,
        isApproverA2: user.isApproverA2,
        isReceiver: user.isReceiver,
        departmentId: user.departmentId,
        costCenterId: user.costCenterId,
        companyId: user.companyId,
        company: company ? {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          logoUrl: company.logoUrl
        } : null
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/check", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validação adicional: verificar se a sessão realmente existe no banco
      const { validateSession } = await import('../db');
      const sessionId = req.sessionID;
      
      if (!sessionId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const sessionValidation = await validateSession(sessionId);
      if (!sessionValidation || sessionValidation.userId !== req.session.userId) {
        // Limpar sessão inválida
        req.session.destroy((err) => {
          if (err) console.error('Error destroying invalid session:', err);
        });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [department, company] = await Promise.all([
        user.departmentId ? storage.getDepartmentById(user.departmentId) : null,
        user.companyId ? storage.getCompanyById(user.companyId) : null
      ]);

      res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        departmentId: user.departmentId,
        companyId: user.companyId,
        department,
        company,
        isBuyer: user.isBuyer,
        isApproverA1: user.isApproverA1,
        isApproverA2: user.isApproverA2,
        isAdmin: user.isAdmin,
        isManager: user.isManager,
        isReceiver: user.isReceiver
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Password recovery endpoints
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "E-mail é obrigatório" });
      }

      const token = await storage.generatePasswordResetToken(email);

      if (token) {
        const user = await storage.getUserByEmail(email);
        if (user) {
          // Import email service
          const { sendPasswordResetEmail } = await import('../email-service');
          await sendPasswordResetEmail(user, token);
        }
      }

      // Always return success to prevent email enumeration
      res.json({ message: "Se o e-mail existir em nossa base, você receberá instruções de recuperação" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/validate-reset-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token é obrigatório" });
      }

      const user = await storage.validatePasswordResetToken(token);

      if (!user) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      res.json({ message: "Token válido" });
    } catch (error) {
      console.error("Validate reset token error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token e senha são obrigatórios" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter no mínimo 6 caracteres" });
      }

      const success = await storage.resetPassword(token, password);

      if (!success) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      res.json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });
}