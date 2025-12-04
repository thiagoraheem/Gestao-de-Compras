// Middleware para validação de quantidades e verificações de consistência
// Implementa validações em tempo real para operações críticas de quantidade

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { pool } from '../db';

// Interface para dados de validação de quantidade
interface QuantityValidationData {
  id?: number;
  availableQuantity?: number;
  confirmedUnit?: string;
  quantityAdjustmentReason?: string;
  originalQuantity?: number;
}

// Interface para resultado de validação
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: any;
}

// Classe principal do middleware de validação
export class QuantityValidationMiddleware {
  
  // Validar dados básicos de quantidade
  static validateQuantityData(data: QuantityValidationData): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      severity: 'LOW'
    };

    // Validar ID do item
    if (data.id !== undefined && (!Number.isInteger(data.id) || data.id <= 0)) {
      result.errors.push('Item ID must be a positive integer');
      result.isValid = false;
    }

    // Validar quantidade disponível
    if (data.availableQuantity !== undefined) {
      if (typeof data.availableQuantity !== 'number' || isNaN(data.availableQuantity)) {
        result.errors.push('Available quantity must be a valid number');
        result.isValid = false;
      } else if (data.availableQuantity < 0) {
        result.errors.push('Available quantity cannot be negative');
        result.isValid = false;
        result.severity = 'HIGH';
      } else if (data.availableQuantity === 0) {
        result.warnings.push('Available quantity is zero - item will be unavailable');
        result.severity = 'MEDIUM';
      }
    }

    // Validar unidade confirmada
    if (data.confirmedUnit !== undefined) {
      if (typeof data.confirmedUnit !== 'string' || data.confirmedUnit.trim().length === 0) {
        result.errors.push('Confirmed unit must be a non-empty string');
        result.isValid = false;
      } else if (data.confirmedUnit.length > 50) {
        result.errors.push('Confirmed unit must be 50 characters or less');
        result.isValid = false;
      }
    }

    // Validar razão do ajuste
    if (data.quantityAdjustmentReason !== undefined && data.quantityAdjustmentReason !== null) {
      if (typeof data.quantityAdjustmentReason !== 'string') {
        result.errors.push('Quantity adjustment reason must be a string');
        result.isValid = false;
      } else if (data.quantityAdjustmentReason.length > 500) {
        result.errors.push('Quantity adjustment reason must be 500 characters or less');
        result.isValid = false;
      }
    }

    // Validar mudança significativa de quantidade
    if (data.originalQuantity !== undefined && data.availableQuantity !== undefined) {
      const changePercentage = Math.abs(data.availableQuantity - data.originalQuantity) / Math.max(data.originalQuantity, 1);
      
      if (changePercentage > 0.5) {
        result.warnings.push(`Significant quantity change detected: ${(changePercentage * 100).toFixed(1)}%`);
        result.severity = 'CRITICAL';
        
        if (!data.quantityAdjustmentReason || data.quantityAdjustmentReason.trim().length < 10) {
          result.errors.push('Significant quantity changes require a detailed adjustment reason (minimum 10 characters)');
          result.isValid = false;
        }
      } else if (changePercentage > 0.3) {
        result.warnings.push(`Moderate quantity change detected: ${(changePercentage * 100).toFixed(1)}%`);
        result.severity = 'HIGH';
      } else if (changePercentage > 0.1) {
        result.severity = 'MEDIUM';
      }
    }

    return result;
  }

  // Middleware para validar atualização de quantidades
  static validateQuantityUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body;
      const supplierQuotationId = parseInt(req.params.id);

      // Validar estrutura básica
      if (!Array.isArray(items)) {
        res.status(400).json({
          message: 'Items array is required',
          validation_error: true,
          error_type: 'INVALID_INPUT_STRUCTURE'
        });
        return;
      }

      if (items.length === 0) {
        res.status(400).json({
          message: 'At least one item is required for quantity update',
          validation_error: true,
          error_type: 'EMPTY_ITEMS_ARRAY'
        });
        return;
      }

      if (items.length > 100) {
        res.status(400).json({
          message: 'Too many items in single request (maximum 100)',
          validation_error: true,
          error_type: 'EXCESSIVE_ITEMS_COUNT'
        });
        return;
      }

      // Buscar itens existentes para comparação
      let existingItems: any[] = [];
      try {
        existingItems = await storage.getSupplierQuotationItems(supplierQuotationId);
      } catch (error) {
        res.status(404).json({
          message: 'Supplier quotation not found or inaccessible',
          validation_error: true,
          error_type: 'QUOTATION_NOT_FOUND'
        });
        return;
      }

      const validationResults: { [key: string]: ValidationResult } = {};
      let hasErrors = false;
      let maxSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

      // Validar cada item
      for (const item of items) {
        const existingItem = existingItems.find(ei => ei.id === item.id);
        
        const validationData: QuantityValidationData = {
          id: item.id,
          availableQuantity: item.availableQuantity,
          confirmedUnit: item.confirmedUnit,
          quantityAdjustmentReason: item.quantityAdjustmentReason,
          originalQuantity: existingItem ? (existingItem.availableQuantity || existingItem.quantity) : undefined
        };

        const result = QuantityValidationMiddleware.validateQuantityData(validationData);
        
        // Validações adicionais específicas do contexto
        if (!existingItem) {
          result.errors.push(`Item with ID ${item.id} not found in supplier quotation`);
          result.isValid = false;
        }

        validationResults[`item_${item.id}`] = result;
        
        if (!result.isValid) {
          hasErrors = true;
        }

        // Determinar severidade máxima
        const severityLevels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
        if (severityLevels[result.severity] > severityLevels[maxSeverity]) {
          maxSeverity = result.severity;
        }
      }

      // Se há erros, retornar resposta de validação
      if (hasErrors) {
        res.status(400).json({
          message: 'Validation failed for quantity update',
          validation_error: true,
          error_type: 'VALIDATION_FAILED',
          validation_results: validationResults,
          max_severity: maxSeverity
        });
        return;
      }

      // Adicionar resultados de validação ao request para uso posterior
      req.quantityValidation = {
        results: validationResults,
        maxSeverity,
        existingItems
      };

      next();

    } catch (error) {
      console.error('Error in quantity validation middleware:', error);
      res.status(500).json({
        message: 'Internal error during validation',
        validation_error: true,
        error_type: 'VALIDATION_INTERNAL_ERROR'
      });
      return;
    }
  };

  // Middleware para validar consistência em tempo real
  static validateRealTimeConsistency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const supplierQuotationId = parseInt(req.params.id);

      // Executar validação de integridade
      const integrityResult = await pool.query(`
        SELECT validate_quantity_integrity($1) as result
      `, [supplierQuotationId]);

      const validation = integrityResult.rows[0].result;

      // Se há problemas críticos de integridade, bloquear operação
      const criticalIssues = validation.issues?.filter((issue: any) => 
        issue.severity === 'HIGH' || issue.severity === 'CRITICAL'
      ) || [];

      if (criticalIssues.length > 0) {
        res.status(409).json({
          message: 'Critical integrity issues detected - operation blocked',
          validation_error: true,
          error_type: 'INTEGRITY_VIOLATION',
          integrity_issues: criticalIssues,
          integrity_score: validation.summary?.integrity_score || 0
        });
        return;
      }

      // Adicionar informações de integridade ao request
      req.integrityValidation = {
        score: validation.summary?.integrity_score || 100,
        issues: validation.issues || [],
        summary: validation.summary || {}
      };

      next();

    } catch (error: any) {
      console.error('Error in real-time consistency validation:', error);
      // Não bloquear operação por erro de validação de consistência
      // mas registrar o problema
      req.integrityValidation = {
        score: 0,
        issues: [{ type: 'VALIDATION_ERROR', severity: 'HIGH', error: error?.message || String(error) }],
        summary: { validation_error: true }
      };
      next();
    }
  };

  // Middleware para log de operações críticas
  static logCriticalOperations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body;
      const supplierQuotationId = parseInt(req.params.id);
      const userId = req.session?.userId;

      // Verificar se há mudanças críticas
      const validationResults = req.quantityValidation?.results || {};
      const hasCriticalChanges = Object.values(validationResults).some(
        (result: any) => result.severity === 'CRITICAL'
      );

      if (hasCriticalChanges) {
        // Log da operação crítica antes da execução
        await pool.query(`
          INSERT INTO detailed_audit_log (
            table_name, record_id, operation_type, user_id,
            change_reason, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          'supplier_quotation_items',
          supplierQuotationId,
          'CRITICAL_OPERATION_INITIATED',
          userId,
          'Critical quantity changes detected - operation logged',
          JSON.stringify({
            items_count: items.length,
            validation_results: validationResults,
            integrity_score: req.integrityValidation?.score,
            client_ip: req.ip,
            user_agent: req.get('User-Agent')
          })
        ]);
      }

      next();

    } catch (error) {
      console.error('Error in critical operations logging:', error);
      // Não bloquear operação por erro de log
      next();
    }
  };

  // Middleware combinado para validação completa
  static fullValidation = [
    QuantityValidationMiddleware.validateQuantityUpdate,
    QuantityValidationMiddleware.validateRealTimeConsistency,
    QuantityValidationMiddleware.logCriticalOperations
  ];
}

// Estender interface Request para incluir dados de validação
declare global {
  namespace Express {
    interface Request {
      quantityValidation?: {
        results: { [key: string]: ValidationResult };
        maxSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        existingItems: any[];
      };
      integrityValidation?: {
        score: number;
        issues: any[];
        summary: any;
      };
    }
  }
}

export default QuantityValidationMiddleware;
