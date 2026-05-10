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
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import { auditService } from "../services/audit-service";

/**
 * User management routes extracted from the monolithic routes.ts (Phase 2).
 * Handles CRUD operations, password management, cost center assignments.
 */
export function registerUserRoutes(app: Express) {
  // List all users
  app.get("/api/users", isAuthenticated, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  // Get user by ID
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new ValidationError("ID de usuário inválido");
    }

    const user = await storage.getUser(id);
    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    res.json(user);
  });

  // Create user (Admin only)
  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    const userData = insertUserSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Get current user to check if they can set admin permissions
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser?.isAdmin) {
      throw new UnauthorizedError("Apenas administradores podem criar usuários");
    }

    // Only admins can set admin permissions
    if (userData.isAdmin && !currentUser.isAdmin) {
      throw new UnauthorizedError("Apenas administradores podem conceder permissões de administrador");
    }

    const user = await storage.createUser({
      ...userData,
      password: hashedPassword,
    });

    // Set user cost centers if provided
    if (req.body.costCenterIds && Array.isArray(req.body.costCenterIds)) {
      await storage.setUserCostCenters(user.id, req.body.costCenterIds);
    }

    await auditService.log({
      actionType: 'user_created',
      actionDescription: `Usuário ${user.username} criado`,
      performedBy: req.session.userId,
      afterData: { ...user, password: '[HIDDEN]' },
      affectedTables: ['users']
    });

    res.status(201).json(user);
  });

  // Set password for user (Admin only)
  app.post(
    "/api/users/:id/set-password",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { password } = req.body;

      if (!password || password.length < 8) {
        throw new ValidationError("A senha deve ter no mínimo 8 caracteres.");
      }

      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
        throw new ValidationError("A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais.");
      }

      const user = await storage.getUser(id);
      if (!user) {
        throw new NotFoundError("Usuário não encontrado");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password and set forceChangePassword to true for security
      const updatedUser = await storage.updateUser(id, {
        password: hashedPassword,
        forceChangePassword: true,
      });

      // Audit Log
      await auditService.log({
        actionType: "admin_set_password",
        actionDescription: `Senha alterada pelo administrador para o usuário ${user.username}`,
        performedBy: req.session.userId,
        affectedTables: ["users"],
        beforeData: { forceChangePassword: user.forceChangePassword },
        afterData: { forceChangePassword: true },
      });

      // Notify User
      await notifyAdminSetPassword(updatedUser);

      res.json({ message: "Senha alterada com sucesso" });
    },
  );

  // Update user (Admin only)
  app.put("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const userData = insertUserSchema.partial().parse(req.body);

    // Get current user to check if they can set admin permissions
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser?.isAdmin) {
      throw new UnauthorizedError("Apenas administradores podem editar usuários");
    }

    // Get the user being updated
    const userBeingUpdated = await storage.getUser(id);
    if (!userBeingUpdated) {
      throw new NotFoundError("Usuário não encontrado");
    }

    // Only admins can change admin permissions
    if (
      "isAdmin" in userData &&
      userData.isAdmin !== userBeingUpdated.isAdmin
    ) {
      if (!currentUser.isAdmin) {
        throw new UnauthorizedError("Apenas administradores podem alterar permissões de administrador");
      }
    }

    // Prevent user from removing their own admin privileges if they are the only admin
    if (id === currentUser.id && userData.isAdmin === false) {
      const allUsers = await storage.getAllUsers();
      const adminCount = allUsers.filter(
        (u) => u.isAdmin && u.id !== id,
      ).length;
      if (adminCount === 0) {
        throw new ValidationError("Não é possível remover sua própria permissão de administrador. Deve existir pelo menos um administrador no sistema.");
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

    await auditService.log({
      actionType: 'user_updated',
      actionDescription: `Usuário ${user.username} atualizado`,
      performedBy: req.session.userId,
      affectedTables: ['users'],
      beforeData: userBeingUpdated,
      afterData: { ...user, password: '[HIDDEN]' }
    });

    res.json(user);
  });

  // Check if user can be deleted
  app.get(
    "/api/users/:id/can-delete",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      const result = await storage.checkUserCanBeDeleted(id);
      res.json(result);
    },
  );

  // Delete user
  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    const id = parseInt(req.params.id);

    // Check if user can be deleted first
    const canDeleteCheck = await storage.checkUserCanBeDeleted(id);
    if (!canDeleteCheck.canDelete) {
      throw new ValidationError(canDeleteCheck.reason || "Usuário não pode ser excluído");
    }

    const user = await storage.getUser(id);
    await storage.deleteUser(id);

    await auditService.log({
      actionType: 'user_deleted',
      actionDescription: `Usuário ${user?.username || id} excluído`,
      performedBy: req.session.userId,
      beforeData: user,
      affectedTables: ['users']
    });

    res.json({ message: "Usuário excluído com sucesso" });
  });

  // Update user profile (without password)
  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    const userId = parseInt(req.params.id);
    const sessionUserId = (req.session as any).userId;

    // Users can only update their own profile
    if (userId !== sessionUserId) {
      throw new UnauthorizedError("Acesso negado");
    }

    const { firstName, lastName, email } = req.body;
    const user = await storage.updateUser(userId, {
      firstName,
      lastName,
      email,
    });
    res.json(user);
  });

  // Change password
  app.post(
    "/api/users/:id/change-password",
    isAuthenticated,
    async (req, res) => {
      const userId = parseInt(req.params.id);
      const sessionUserId = (req.session as any).userId;

      // Users can only change their own password
      if (userId !== sessionUserId) {
        throw new UnauthorizedError("Acesso negado");
      }

      const { currentPassword, newPassword } = req.body;

      // Get user to verify current password
      const user = await storage.getUser(userId!);
      if (!user) {
        throw new NotFoundError("Usuário não encontrado");
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        throw new ValidationError("Senha atual incorreta");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { 
        password: hashedPassword,
        forceChangePassword: false 
      });

      res.json({ message: "Password changed successfully" });
    },
  );

  // Admin reset password
  app.post(
    "/api/users/:id/reset-password",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const userId = parseInt(req.params.id);
      const adminId = (req.session as any).userId;

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        throw new NotFoundError("Usuário não encontrado");
      }

      // Check hierarchy: Admin cannot reset another Admin
      if (targetUser.isAdmin && targetUser.id !== adminId) {
           throw new UnauthorizedError("Não é permitido redefinir a senha de outro Administrador.");
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
    }
  );

  // Get user cost centers
  app.get("/api/users/:id/cost-centers", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const costCenterIds = await storage.getUserCostCenters(id);
    res.json(costCenterIds);
  });
}
