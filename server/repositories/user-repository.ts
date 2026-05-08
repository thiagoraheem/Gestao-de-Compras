import { db } from "../db";
import { users, userDepartments, userCostCenters, purchaseRequests, approvalHistory } from "../../shared/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import type { User, InsertUser } from "../../shared/schema";

export class UserRepository {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async deleteUser(id: number): Promise<void> {
    // Delete all user associations first
    await db.delete(userDepartments).where(eq(userDepartments.userId, id));
    await db.delete(userCostCenters).where(eq(userCostCenters.userId, id));

    // Delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async checkUserCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedRequests?: number;
  }> {
    // Check if user has any purchase requests as requester
    const requestsAsRequester = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, id));

    // Check if user has any purchase requests as approver A1
    const requestsAsApproverA1 = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.approverA1Id, id));

    // Check if user has any purchase requests as approver A2
    const requestsAsApproverA2 = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.approverA2Id, id));

    // Check approval history
    const approvalHistoryCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(approvalHistory)
      .where(eq(approvalHistory.approverId, id));

    const totalRequests =
      Number(requestsAsRequester[0].count) +
      Number(requestsAsApproverA1[0].count) +
      Number(requestsAsApproverA2[0].count);

    const totalApprovals = Number(approvalHistoryCount[0].count);

    if (totalRequests > 0 || totalApprovals > 0) {
      return {
        canDelete: false,
        reason:
          "Usuário possui solicitações de compra ou histórico de aprovações associadas",
        associatedRequests: totalRequests + totalApprovals,
      };
    }

    return { canDelete: true };
  }

  async getUserDepartments(userId: number): Promise<number[]> {
    const userDepts = await db
      .select({ departmentId: userDepartments.departmentId })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId));
    return userDepts.map((ud) => ud.departmentId!).filter((id) => id !== null);
  }

  async assignUserToDepartment(
    userId: number,
    departmentId: number,
  ): Promise<void> {
    await db
      .insert(userDepartments)
      .values({ userId, departmentId })
      .onConflictDoNothing();
  }

  async removeUserFromDepartment(
    userId: number,
    departmentId: number,
  ): Promise<void> {
    await db
      .delete(userDepartments)
      .where(
        and(
          eq(userDepartments.userId, userId),
          eq(userDepartments.departmentId, departmentId),
        ),
      );
  }

  async getUserCostCenters(userId: number): Promise<number[]> {
    const userCostCentersList = await db
      .select({ costCenterId: userCostCenters.costCenterId })
      .from(userCostCenters)
      .where(eq(userCostCenters.userId, userId));
    return userCostCentersList
      .map((uc) => uc.costCenterId!)
      .filter((id) => id !== null);
  }

  async assignUserToCostCenter(
    userId: number,
    costCenterId: number,
  ): Promise<void> {
    await db
      .insert(userCostCenters)
      .values({ userId, costCenterId })
      .onConflictDoNothing();
  }

  async removeUserFromCostCenter(
    userId: number,
    costCenterId: number,
  ): Promise<void> {
    await db
      .delete(userCostCenters)
      .where(
        and(
          eq(userCostCenters.userId, userId),
          eq(userCostCenters.costCenterId, costCenterId),
        ),
      );
  }

  async setUserCostCenters(
    userId: number,
    costCenterIds: number[],
  ): Promise<void> {
    // Remove all existing associations
    await db.delete(userCostCenters).where(eq(userCostCenters.userId, userId));

    // Add new associations
    if (costCenterIds.length > 0) {
      await db
        .insert(userCostCenters)
        .values(
          costCenterIds.map((costCenterId) => ({ userId, costCenterId })),
        );
    }
  }

  async generatePasswordResetToken(email: string): Promise<string | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiration

    await db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpires: expires,
      })
      .where(eq(users.id, user.id));

    return token;
  }

  async validatePasswordResetToken(token: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.passwordResetToken, token),
            gt(users.passwordResetExpires, new Date()),
          ),
        )
        .limit(1);

      return user || null;
    } catch (error) {
      console.error("Error validating password reset token:", error);
      return null;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.validatePasswordResetToken(token);
      if (!user) {
        return false;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db
        .update(users)
        .set({
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        })
        .where(eq(users.id, user.id));

      return true;
    } catch (error) {
      console.error("Error resetting password:", error);
      return false;
    }
  }
}

export const userRepository = new UserRepository();
