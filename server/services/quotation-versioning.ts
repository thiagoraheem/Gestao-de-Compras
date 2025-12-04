import { db } from '../db';
import { quotations, quotationVersionHistory, quotationItems, supplierQuotations, supplierQuotationItems } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface QuotationVersionChange {
  field: string;
  previousValue: any;
  newValue: any;
}

export interface QuotationVersionData {
  quotationId: number;
  changeType: 'created' | 'updated' | 'items_modified' | 'deadline_extended' | 'terms_changed';
  changeDescription?: string;
  changes: QuotationVersionChange[];
  itemsAffected?: number[];
  reasonForChange?: string;
  impactAssessment?: string;
  changedBy: number;
  approvedBy?: number;
}

export interface QuotationVersionService {
  createVersion(data: QuotationVersionData): Promise<{ id: number; version: number }>;
  getVersionHistory(quotationId: number): Promise<any[]>;
  getVersionDetails(versionId: number): Promise<any>;
  compareVersions(quotationId: number, version1: number, version2: number): Promise<any>;
  rollbackToVersion(quotationId: number, targetVersion: number, changedBy: number): Promise<{ success: boolean; newVersion: number }>;
  validateVersionChange(quotationId: number, changes: QuotationVersionChange[]): Promise<{ valid: boolean; errors: string[] }>;
  getLatestVersion(quotationId: number): Promise<number>;
  incrementVersion(quotationId: number): Promise<number>;
}

export class QuotationVersionServiceImpl implements QuotationVersionService {
  
  async createVersion(data: QuotationVersionData): Promise<{ id: number; version: number }> {
    return await db.transaction(async (tx) => {
      // Get current version and increment
      const currentQuotation = await tx
        .select({ rfqVersion: quotations.rfqVersion })
        .from(quotations)
        .where(eq(quotations.id, data.quotationId))
        .limit(1);

      if (!currentQuotation.length) {
        throw new Error('Quotation not found');
      }

      const previousVersion = currentQuotation[0].rfqVersion || 1;
      const newVersion = previousVersion + 1;

      // Update quotation version
      await tx
        .update(quotations)
        .set({ 
          rfqVersion: newVersion,
          updatedAt: new Date()
        })
        .where(eq(quotations.id, data.quotationId));

      // Create version history record
      const changedFields: Record<string, any> = {};
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};

      data.changes.forEach(change => {
        changedFields[change.field] = true;
        previousValues[change.field] = change.previousValue;
        newValues[change.field] = change.newValue;
      });

      const [versionRecord] = await tx
        .insert(quotationVersionHistory)
        .values({
          quotationId: data.quotationId,
          previousVersion,
          newVersion,
          changeType: data.changeType,
          changeDescription: data.changeDescription,
          changedFields,
          previousValues,
          newValues,
          itemsAffected: data.itemsAffected || [],
          reasonForChange: data.reasonForChange,
          impactAssessment: data.impactAssessment,
          changedBy: data.changedBy,
          approvedBy: data.approvedBy,
          notificationsSent: false
        })
        .returning({ id: quotationVersionHistory.id });

      return { id: versionRecord.id, version: newVersion };
    });
  }

  async getVersionHistory(quotationId: number): Promise<any[]> {
    const history = await db
      .select({
        id: quotationVersionHistory.id,
        previousVersion: quotationVersionHistory.previousVersion,
        newVersion: quotationVersionHistory.newVersion,
        changeType: quotationVersionHistory.changeType,
        changeDescription: quotationVersionHistory.changeDescription,
        changedFields: quotationVersionHistory.changedFields,
        previousValues: quotationVersionHistory.previousValues,
        newValues: quotationVersionHistory.newValues,
        itemsAffected: quotationVersionHistory.itemsAffected,
        reasonForChange: quotationVersionHistory.reasonForChange,
        impactAssessment: quotationVersionHistory.impactAssessment,
        changedBy: quotationVersionHistory.changedBy,
        changedAt: quotationVersionHistory.changedAt,
        approvedBy: quotationVersionHistory.approvedBy,
        approvedAt: quotationVersionHistory.approvedAt,
        notificationsSent: quotationVersionHistory.notificationsSent
      })
      .from(quotationVersionHistory)
      .where(eq(quotationVersionHistory.quotationId, quotationId))
      .orderBy(desc(quotationVersionHistory.newVersion));

    return history;
  }

  async getVersionDetails(versionId: number): Promise<any> {
    const [version] = await db
      .select()
      .from(quotationVersionHistory)
      .where(eq(quotationVersionHistory.id, versionId))
      .limit(1);

    return version;
  }

  async compareVersions(quotationId: number, version1: number, version2: number): Promise<any> {
    const versions = await db
      .select()
      .from(quotationVersionHistory)
      .where(
        and(
          eq(quotationVersionHistory.quotationId, quotationId),
          // Get versions between version1 and version2
        )
      )
      .orderBy(quotationVersionHistory.newVersion);

    // Build comparison data
    const comparison = {
      quotationId,
      fromVersion: version1,
      toVersion: version2,
      changes: [] as any[],
      summary: {
        totalChanges: 0,
        fieldsChanged: new Set<string>(),
        itemsAffected: new Set<number>()
      }
    };

    versions.forEach(version => {
      if (version.newVersion > version1 && version.newVersion <= version2) {
        comparison.changes.push({
          version: version.newVersion,
          changeType: version.changeType,
          changeDescription: version.changeDescription,
          changedFields: version.changedFields,
          previousValues: version.previousValues,
          newValues: version.newValues,
          itemsAffected: version.itemsAffected,
          changedAt: version.changedAt,
          changedBy: version.changedBy
        });

        comparison.summary.totalChanges++;
        
        if (version.changedFields) {
          Object.keys(version.changedFields).forEach(field => {
            comparison.summary.fieldsChanged.add(field);
          });
        }

        if (version.itemsAffected && Array.isArray(version.itemsAffected)) {
          version.itemsAffected.forEach((itemId: number) => {
            comparison.summary.itemsAffected.add(itemId);
          });
        }
      }
    });

    // Mantém conjuntos para evitar erro de tipagem

    return comparison;
  }

  async rollbackToVersion(quotationId: number, targetVersion: number, changedBy: number): Promise<{ success: boolean; newVersion: number }> {
    return await db.transaction(async (tx) => {
      // Get target version data
      const [targetVersionData] = await tx
        .select()
        .from(quotationVersionHistory)
        .where(
          and(
            eq(quotationVersionHistory.quotationId, quotationId),
            eq(quotationVersionHistory.newVersion, targetVersion)
          )
        )
        .limit(1);

      if (!targetVersionData) {
        throw new Error('Target version not found');
      }

      // Get current quotation data
      const [currentQuotation] = await tx
        .select()
        .from(quotations)
        .where(eq(quotations.id, quotationId))
        .limit(1);

      if (!currentQuotation) {
        throw new Error('Quotation not found');
      }

      // Create rollback version record
      const rollbackVersion = await this.createVersion({
        quotationId,
        changeType: 'updated',
        changeDescription: `Rollback to version ${targetVersion}`,
        changes: [{
          field: 'rollback',
          previousValue: currentQuotation.rfqVersion,
          newValue: targetVersion
        }],
        reasonForChange: `Rollback to version ${targetVersion}`,
        impactAssessment: 'System rollback operation',
        changedBy
      });

      // Here you would implement the actual rollback logic
      // This would involve restoring quotation data, items, etc. to the target version state
      // For now, we'll just update the version number

      return { success: true, newVersion: rollbackVersion.version };
    });
  }

  async validateVersionChange(quotationId: number, changes: QuotationVersionChange[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if quotation exists
    const [quotation] = await db
      .select({ id: quotations.id, status: quotations.status })
      .from(quotations)
      .where(eq(quotations.id, quotationId))
      .limit(1);

    if (!quotation) {
      errors.push('Quotation not found');
      return { valid: false, errors };
    }

    // Validate changes based on quotation status
    if (quotation.status === 'approved' || quotation.status === 'rejected') {
      const criticalFields = ['quotationDeadline', 'termsAndConditions', 'technicalSpecs'];
      const hasCriticalChanges = changes.some(change => criticalFields.includes(change.field));
      
      if (hasCriticalChanges) {
        errors.push('Cannot modify critical fields in approved/rejected quotations');
      }
    }

    // Validate individual changes
    changes.forEach(change => {
      switch (change.field) {
        case 'quotationDeadline':
          const newDeadline = new Date(change.newValue);
          const now = new Date();
          if (newDeadline <= now) {
            errors.push('Quotation deadline must be in the future');
          }
          break;
        
        case 'quantity':
          if (change.newValue <= 0) {
            errors.push('Quantity must be greater than zero');
          }
          break;
      }
    });

    return { valid: errors.length === 0, errors };
  }

  async getLatestVersion(quotationId: number): Promise<number> {
    const [quotation] = await db
      .select({ rfqVersion: quotations.rfqVersion })
      .from(quotations)
      .where(eq(quotations.id, quotationId))
      .limit(1);

    return quotation?.rfqVersion || 1;
  }

  async incrementVersion(quotationId: number): Promise<number> {
    const currentVersion = await this.getLatestVersion(quotationId);
    const newVersion = currentVersion + 1;

    await db
      .update(quotations)
      .set({ 
        rfqVersion: newVersion,
        updatedAt: new Date()
      })
      .where(eq(quotations.id, quotationId));

    return newVersion;
  }
}

export const quotationVersionService = new QuotationVersionServiceImpl();
