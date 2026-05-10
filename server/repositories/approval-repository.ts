import { db } from "../db";
import { 
  approvalHistory, 
  approvalConfigurations, 
  configurationHistory, 
  users 
} from "../../shared/schema";
import { eq, desc, and, or } from "drizzle-orm";
import type { 
  ApprovalHistory, 
  InsertApprovalHistory, 
  ApprovalConfiguration, 
  InsertApprovalConfiguration,
  ConfigurationHistory,
  User
} from "../../shared/schema";

export class ApprovalRepository {
  async getApprovalHistory(purchaseRequestId: number): Promise<any[]> {
    try {
      return await db
        .select({
          id: approvalHistory.id,
          approverType: approvalHistory.approverType,
          approved: approvalHistory.approved,
          rejectionReason: approvalHistory.rejectionReason,
          createdAt: approvalHistory.createdAt,
          approver: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(approvalHistory)
        .leftJoin(users, eq(approvalHistory.approverId, users.id))
        .where(eq(approvalHistory.purchaseRequestId, purchaseRequestId))
        .orderBy(desc(approvalHistory.createdAt));
    } catch (error) {
      console.error("Error fetching approval history:", error);
      return [];
    }
  }

  async createApprovalHistory(
    approvalHistoryData: InsertApprovalHistory,
  ): Promise<ApprovalHistory> {
    try {
      const [newApprovalHistory] = await db
        .insert(approvalHistory)
        .values(approvalHistoryData)
        .returning();
      return newApprovalHistory;
    } catch (error) {
      console.error("Error creating approval history:", error);
      throw error;
    }
  }

  async getApprovalHistoryByRequestId(requestId: number): Promise<ApprovalHistory[]> {
    try {
      return await db
        .select()
        .from(approvalHistory)
        .where(eq(approvalHistory.purchaseRequestId, requestId))
        .orderBy(desc(approvalHistory.createdAt));
    } catch (error) {
      console.error("Error fetching approval history by request ID:", error);
      return [];
    }
  }

  async getActiveApprovalConfiguration(): Promise<ApprovalConfiguration | undefined> {
    try {
      const result = await db
        .select()
        .from(approvalConfigurations)
        .where(eq(approvalConfigurations.isActive, true))
        .orderBy(desc(approvalConfigurations.effectiveDate))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error fetching active approval configuration:", error);
      return undefined;
    }
  }

  async getCEOAndDirectors(): Promise<User[]> {
    try {
      return await db
        .select()
        .from(users)
        .where(
          and(
            or(eq(users.isCEO, true), eq(users.isDirector, true)),
            eq(users.isApproverA2, true)
          )
        )
        .orderBy(desc(users.isCEO), users.firstName, users.lastName);
    } catch (error) {
      console.error("Error fetching CEO and Directors:", error);
      return [];
    }
  }

  async getA2Approvers(): Promise<User[]> {
    try {
      return await db
        .select()
        .from(users)
        .where(eq(users.isApproverA2, true))
        .orderBy(users.firstName, users.lastName);
    } catch (error) {
      console.error("Error fetching A2 approvers:", error);
      return [];
    }
  }

  async createApprovalHistoryWithStep(history: InsertApprovalHistory & { 
    approvalStep: string; 
    approvalValue: string; 
    requiresDualApproval: boolean; 
    ipAddress: string; 
    userAgent: string; 
  }): Promise<ApprovalHistory> {
    try {
      const result = await db
        .insert(approvalHistory)
        .values({
          purchaseRequestId: history.purchaseRequestId,
          approverType: history.approverType,
          approverId: history.approverId,
          approved: history.approved,
          rejectionReason: history.rejectionReason,
          approvalStep: history.approvalStep,
          approvalValue: history.approvalValue,
          requiresDualApproval: history.requiresDualApproval,
          ipAddress: history.ipAddress,
          userAgent: history.userAgent,
          createdAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating approval history with step:", error);
      throw error;
    }
  }

  async createApprovalConfiguration(config: InsertApprovalConfiguration): Promise<ApprovalConfiguration> {
    try {
      // Deactivate current active configuration
      await db
        .update(approvalConfigurations)
        .set({ isActive: false })
        .where(eq(approvalConfigurations.isActive, true));

      // Create new configuration
      const result = await db
        .insert(approvalConfigurations)
        .values({
          valueThreshold: config.valueThreshold,
          isActive: true,
          effectiveDate: new Date(),
          createdBy: config.createdBy,
          reason: config.reason,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error creating approval configuration:", error);
      throw error;
    }
  }

  async getConfigurationHistory(): Promise<ConfigurationHistory[]> {
    try {
      const result = await db
        .select({
          id: configurationHistory.id,
          configurationId: configurationHistory.configurationId,
          changeType: configurationHistory.changeType,
          previousValues: configurationHistory.previousValues,
          newValues: configurationHistory.newValues,
          changedBy: configurationHistory.changedBy,
          ipAddress: configurationHistory.ipAddress,
          userAgent: configurationHistory.userAgent,
          changedAt: configurationHistory.changedAt,
          changedByUser: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          }
        })
        .from(configurationHistory)
        .leftJoin(users, eq(configurationHistory.changedBy, users.id))
        .orderBy(desc(configurationHistory.changedAt));
      
      return result.map(row => ({
        ...row,
        changedByUser: row.changedByUser && row.changedByUser.id ? row.changedByUser : undefined,
      })) as ConfigurationHistory[];
    } catch (error) {
      console.error("Error fetching configuration history:", error);
      return [];
    }
  }
}

export const approvalRepository = new ApprovalRepository();
