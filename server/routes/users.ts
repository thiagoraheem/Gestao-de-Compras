import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { insertUserSchema, auditLogs } from "../../shared/schema";
import { isAuthenticated, isAdmin } from "./middleware";
import bcrypt from "bcryptjs";
import {
  notifyPasswordReset,
  notifyAdminSetPassword,
} from "../email-service";

/**
 * User management routes extracted from the monolithic routes.ts (Phase 2).
 * Handles CRUD operations, password management, cost center assignments.
 */
export function registerUserRoutes(app: Express) {
  // List all users
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create user (Admin only)
  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Get current user to check if they can set admin permissions
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.isAdmin) {
        return res
          .status(403)
          .json({ message: "Apenas administradores podem criar usuários" });
      }

      // Only admins can set admin permissions
      if (userData.isAdmin && !currentUser.isAdmin) {
        return res
          .status(403)
          .json({
            message:
              "Apenas administradores podem conceder permissões de administrador",
          });
      }

      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Set user cost centers if provided
      if (req.body.costCenterIds && Array.isArray(req.body.costCenterIds)) {
        await storage.setUserCostCenters(user.id, req.body.costCenterIds);
      }

      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);

      // Check if it's a unique constraint violation for email
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        error.constraint === "users_email_unique"
      ) {
        res
          .status(400)
          .json({
            message: "Este e-mail já está sendo usado por outro usuário",
          });
      } else {
        res.status(400).json({ message: "Dados do usuário inválidos" });
      }
    }
  });

  // Set password for user (Admin only)
  app.post(
    "/api/users/:id/set-password",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { password } = req.body;

        if (!password || password.length < 8) {
          return res
            .status(400)
            .json({ message: "A senha deve ter no mínimo 8 caracteres." });
        }

        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (
          !(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)
        ) {
          return res.status(400).json({
            message:
              "A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais.",
          });
        }

        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user password and set forceChangePassword to true for security
        const updatedUser = await storage.updateUser(id, {
          password: hashedPassword,
          forceChangePassword: true,
        });

        // Audit Log
        try {
          await db.insert(auditLogs).values({
            purchaseRequestId: 0,
            performedBy: req.session.userId,
            actionType: "ADMIN_SET_PASSWORD",
            actionDescription: `Senha alterada pelo administrador para o usuário ${user.username}`,
            affectedTables: ["users"],
            beforeData: { forceChangePassword: user.forceChangePassword },
            afterData: { forceChangePassword: true },
          });
        } catch (logError) {
          console.error("Failed to create audit log:", logError);
        }

        // Notify User
        await notifyAdminSetPassword(updatedUser);

        res.json({ message: "Senha alterada com sucesso" });
      } catch (error) {
        console.error("Error setting password:", error);
        res.status(500).json({ message: "Erro ao alterar senha" });
      }
    },
  );

  // Update user (Admin only)
  app.put("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = insertUserSchema.partial().parse(req.body);

      // Get current user to check if they can set admin permissions
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.isAdmin) {
        return res
          .status(403)
          .json({ message: "Apenas administradores podem editar usuários" });
      }

      // Get the user being updated
      const userBeingUpdated = await storage.getUser(id);
      if (!userBeingUpdated) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Only admins can change admin permissions
      if (
        "isAdmin" in userData &&
        userData.isAdmin !== userBeingUpdated.isAdmin
      ) {
        if (!currentUser.isAdmin) {
          return res
            .status(403)
            .json({
              message:
                "Apenas administradores podem alterar permissões de administrador",
            });
        }
      }

      // Prevent user from removing their own admin privileges if they are the only admin
      if (id === currentUser.id && userData.isAdmin === false) {
        const allUsers = await storage.getAllUsers();
        const adminCount = allUsers.filter(
          (u) => u.isAdmin && u.id !== id,
        ).length;
        if (adminCount === 0) {
          return res
            .status(400)
            .json({
              message:
                "Não é possível remover sua própria permissão de administrador. Deve existir pelo menos um administrador no sistema.",
            });
        }
      }

      // If password is provided, hash it
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const user = await storage.updateUser(id, userData);

      // Update user cost centers if provided
      if (req.body.costCenterIds !== undefined) {
        await storage.setUserCostCenters(id, req.body.costCenterIds);
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);

      // Check if it's a unique constraint violation for email
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        error.constraint === "users_email_unique"
      ) {
        res
          .status(400)
          .json({
            message: "Este e-mail já está sendo usado por outro usuário",
          });
      } else {
        res.status(400).json({ message: "Dados do usuário inválidos" });
      }
    }
  });

  // Check if user can be deleted
  app.get(
    "/api/users/:id/can-delete",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const result = await storage.checkUserCanBeDeleted(id);
        res.json(result);
      } catch (error) {
        console.error("Error checking if user can be deleted:", error);
        res
          .status(500)
          .json({ message: "Failed to check user deletion eligibility" });
      }
    },
  );

  // Delete user
  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if user can be deleted first
      const canDeleteCheck = await storage.checkUserCanBeDeleted(id);
      if (!canDeleteCheck.canDelete) {
        return res.status(400).json({
          message: canDeleteCheck.reason,
          associatedRequests: canDeleteCheck.associatedRequests,
        });
      }

      await storage.deleteUser(id);
      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user profile (without password)
  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const sessionUserId = (req.session as any).userId;

      // Users can only update their own profile
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { firstName, lastName, email } = req.body;
      const user = await storage.updateUser(userId, {
        firstName,
        lastName,
        email,
      });
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);

      // Check if it's a unique constraint violation for email
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        error.constraint === "users_email_unique"
      ) {
        res
          .status(400)
          .json({
            message: "Este e-mail já está sendo usado por outro usuário",
          });
      } else {
        res.status(400).json({ message: "Falha ao atualizar perfil" });
      }
    }
  });

  // Change password
  app.post(
    "/api/users/:id/change-password",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const sessionUserId = (req.session as any).userId;

        // Users can only change their own password
        if (userId !== sessionUserId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const { currentPassword, newPassword } = req.body;

        // Get user to verify current password
        const user = await storage.getUser(userId!);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(
          currentPassword,
          user.password,
        );
        if (!isValidPassword) {
          return res.status(400).json({ message: "Senha atual incorreta" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await storage.updateUser(userId, { 
          password: hashedPassword,
          forceChangePassword: false 
        });

        res.json({ message: "Password changed successfully" });
      } catch (error) {
        console.error("Error changing password:", error);
        res.status(400).json({ message: "Failed to change password" });
      }
    },
  );

  // Admin reset password
  app.post(
    "/api/users/:id/reset-password",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const adminId = (req.session as any).userId;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Check hierarchy: Admin cannot reset another Admin
        if (targetUser.isAdmin && targetUser.id !== adminId) {
             return res.status(403).json({ message: "Não é permitido redefinir a senha de outro Administrador." });
        }
        
        const newPassword = "Locador@" + Math.floor(1000 + Math.random() * 9000);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await storage.updateUser(userId, { 
            password: hashedPassword,
            forceChangePassword: true
        });

        // Send email
        await notifyPasswordReset(targetUser, newPassword);

        res.json({ message: "Senha redefinida com sucesso", tempPassword: newPassword });
      } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Erro ao redefinir senha" });
      }
    }
  );

  // Get user cost centers
  app.get("/api/users/:id/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const costCenterIds = await storage.getUserCostCenters(id);
      res.json(costCenterIds);
    } catch (error) {
      console.error("Error fetching user cost centers:", error);
      res.status(500).json({ message: "Failed to fetch user cost centers" });
    }
  });
}
