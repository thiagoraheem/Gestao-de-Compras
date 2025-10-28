// Integrity Validation Routes
// Endpoints para validação de integridade de dados e rollback de transações

import { Router } from 'express';
import { isAuthenticated } from './middleware';
import { storage } from '../storage';

const router = Router();

// Endpoint para validação de integridade de quantidades
router.get('/api/integrity/validate-quantities/:supplierQuotationId?', isAuthenticated, async (req, res) => {
  try {
    const supplierQuotationId = req.params.supplierQuotationId ? parseInt(req.params.supplierQuotationId) : null;
    
    // Get the current user
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Execute integrity validation function
    const result = await storage.db.query(`
      SELECT validate_quantity_integrity($1) as result
    `, [supplierQuotationId]);

    const validationResult = result.rows[0].result;

    res.json({
      message: "Integrity validation completed",
      ...validationResult,
      validated_at: new Date().toISOString(),
      validated_by: currentUser.id
    });

  } catch (error) {
    console.error("Error in integrity validation:", error);
    res.status(500).json({ 
      message: "Failed to validate integrity", 
      error: error.message,
      success: false
    });
  }
});

// Endpoint para rollback de transação específica
router.post('/api/integrity/rollback-transaction', isAuthenticated, async (req, res) => {
  try {
    const { transaction_id, rollback_reason } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    // Get the current user
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user has permission for rollback operations
    if (!currentUser.isBuyer && !currentUser.isAdmin) {
      return res.status(403).json({ message: "Insufficient permissions for rollback operations" });
    }

    // Execute rollback function
    const result = await storage.db.query(`
      SELECT rollback_quantity_transaction($1, $2, $3) as result
    `, [transaction_id, currentUser.id, rollback_reason || 'Manual rollback requested']);

    const rollbackResult = result.rows[0].result;

    if (!rollbackResult.success) {
      return res.status(400).json({
        message: "Rollback failed",
        ...rollbackResult
      });
    }

    res.json({
      message: "Transaction rolled back successfully",
      ...rollbackResult,
      rolled_back_at: new Date().toISOString(),
      rolled_back_by: currentUser.id
    });

  } catch (error) {
    console.error("Error in transaction rollback:", error);
    res.status(500).json({ 
      message: "Failed to rollback transaction", 
      error: error.message,
      success: false
    });
  }
});

// Endpoint para obter histórico de transações
router.get('/api/integrity/transaction-history/:supplierQuotationId?', isAuthenticated, async (req, res) => {
  try {
    const supplierQuotationId = req.params.supplierQuotationId ? parseInt(req.params.supplierQuotationId) : null;
    const { limit = 50, offset = 0, operation_type } = req.query;

    // Get the current user
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    let query = `
      SELECT 
        dal.transaction_id,
        dal.table_name,
        dal.record_id,
        dal.operation_type,
        dal.user_id,
        u.name as user_name,
        dal.created_at,
        dal.change_reason,
        dal.metadata,
        COUNT(*) OVER() as total_count
      FROM detailed_audit_log dal
      LEFT JOIN users u ON u.id = dal.user_id
      WHERE dal.table_name = 'supplier_quotation_items'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (supplierQuotationId) {
      query += ` AND dal.record_id = $${paramIndex}`;
      params.push(supplierQuotationId);
      paramIndex++;
    }

    if (operation_type) {
      query += ` AND dal.operation_type = $${paramIndex}`;
      params.push(operation_type);
      paramIndex++;
    }

    query += ` ORDER BY dal.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await storage.db.query(query, params);

    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;

    res.json({
      message: "Transaction history retrieved successfully",
      transactions: result.rows.map(row => ({
        transaction_id: row.transaction_id,
        table_name: row.table_name,
        record_id: row.record_id,
        operation_type: row.operation_type,
        user_id: row.user_id,
        user_name: row.user_name,
        created_at: row.created_at,
        change_reason: row.change_reason,
        metadata: row.metadata
      })),
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: (parseInt(offset as string) + parseInt(limit as string)) < totalCount
      }
    });

  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({ 
      message: "Failed to fetch transaction history", 
      error: error.message,
      success: false
    });
  }
});

// Endpoint para obter estatísticas de integridade
router.get('/api/integrity/statistics', isAuthenticated, async (req, res) => {
  try {
    // Get the current user
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Get various integrity statistics
    const queries = await Promise.all([
      // Total items with integrity issues
      storage.db.query(`
        SELECT COUNT(*) as count FROM supplier_quotation_items 
        WHERE available_quantity < 0 OR fulfillment_percentage < 0 OR fulfillment_percentage > 200
      `),
      
      // Recent critical quantity changes (last 7 days)
      storage.db.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE action_type = 'CRITICAL_QUANTITY_CHANGE' 
        AND performed_at >= NOW() - INTERVAL '7 days'
      `),
      
      // Total atomic transactions today
      storage.db.query(`
        SELECT COUNT(DISTINCT transaction_id) as count FROM detailed_audit_log 
        WHERE operation_type IN ('BULK_UPDATE', 'BULK_UPDATE_COMPLETE')
        AND created_at >= CURRENT_DATE
      `),
      
      // Failed transactions today
      storage.db.query(`
        SELECT COUNT(DISTINCT transaction_id) as count FROM detailed_audit_log 
        WHERE operation_type = 'BULK_UPDATE_COMPLETE'
        AND created_at >= CURRENT_DATE
        AND (metadata->>'error_count')::INTEGER > 0
      `),
      
      // Average fulfillment percentage
      storage.db.query(`
        SELECT ROUND(AVG(fulfillment_percentage), 2) as avg_fulfillment 
        FROM supplier_quotation_items 
        WHERE fulfillment_percentage IS NOT NULL
      `)
    ]);

    const statistics = {
      integrity_issues: parseInt(queries[0].rows[0].count),
      critical_changes_week: parseInt(queries[1].rows[0].count),
      atomic_transactions_today: parseInt(queries[2].rows[0].count),
      failed_transactions_today: parseInt(queries[3].rows[0].count),
      average_fulfillment_percentage: parseFloat(queries[4].rows[0].avg_fulfillment) || 0,
      last_updated: new Date().toISOString()
    };

    res.json({
      message: "Integrity statistics retrieved successfully",
      statistics
    });

  } catch (error) {
    console.error("Error fetching integrity statistics:", error);
    res.status(500).json({ 
      message: "Failed to fetch integrity statistics", 
      error: error.message,
      success: false
    });
  }
});

// Endpoint público para validação básica de integridade (sem autenticação)
router.get('/api/integrity/validate-all', async (req, res) => {
  try {
    // Execute basic integrity validation without user context
    const result = await storage.db.query(`
      SELECT validate_quantity_integrity(NULL) as result
    `);

    const validationResult = result.rows[0].result;

    res.json({
      message: "Basic integrity validation completed",
      ...validationResult,
      validated_at: new Date().toISOString(),
      public_validation: true
    });

  } catch (error) {
    console.error("Error in public integrity validation:", error);
    res.status(500).json({ 
      message: "Failed to validate integrity", 
      error: error.message,
      success: false
    });
  }
});

export default router;