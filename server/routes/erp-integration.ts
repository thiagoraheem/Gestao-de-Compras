import { Router } from 'express';
import { erpIntegrationService } from '../erp-integration-service';
import { isAuthenticated, requireAuth } from './middleware';
import { db } from '../db';
import { supplierIntegrationControl, supplierIntegrationQueue, supplierIntegrationHistory } from '../../shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/erp-integration/suppliers/fetch
 * Inicia o processo de busca de fornecedores do ERP
 */
router.post('/suppliers/fetch', isAuthenticated, async (req, res) => {
  try {
    const { sync_type = 'full', filters = {} } = req.body;
    const userId = req.session.userId!;

    // Validar tipo de sincronização
    if (!['full', 'incremental'].includes(sync_type)) {
      return res.status(400).json({
        error: 'Invalid sync_type. Must be "full" or "incremental"'
      });
    }

    // Criar registro de integração
    const integrationId = await erpIntegrationService.createIntegration(userId, sync_type);

    // Buscar fornecedores do ERP em background
    process.nextTick(async () => {
      try {
        let updatedAfter: Date | undefined;
        if (sync_type === 'incremental' && filters.updated_after) {
          updatedAfter = new Date(filters.updated_after);
        }

        console.log(`[ERP Integration] Starting ${sync_type} sync for integration ${integrationId}`);

        // Atualizar status para 'fetching' (buscando fornecedores no ERP)
        await db.update(supplierIntegrationControl)
          .set({ status: 'fetching' })
          .where(eq(supplierIntegrationControl.id, integrationId));
        
        // Buscar todos os fornecedores do ERP
        const erpSuppliers = await erpIntegrationService.fetchAllSuppliers(updatedAfter);
        
        console.log(`[ERP Integration] Found ${erpSuppliers.length} suppliers in ERP`);

        // Atualizar status para 'comparing' (comparando com base local)
        await db.update(supplierIntegrationControl)
          .set({ status: 'comparing' })
          .where(eq(supplierIntegrationControl.id, integrationId));

        // Comparar com fornecedores locais
        const comparisonResults = await erpIntegrationService.compareSuppliers(erpSuppliers);
        
        console.log(`[ERP Integration] Comparison completed: ${comparisonResults.length} results`);

        // Salvar resultados na fila
        await erpIntegrationService.saveComparisonResults(integrationId, comparisonResults);

        // Atualizar contador total na tabela de controle
        const stats = await erpIntegrationService.getIntegrationStats(integrationId);
        await db.update(supplierIntegrationControl)
          .set({ total_suppliers: stats.total, status: 'prepared' })
          .where(eq(supplierIntegrationControl.id, integrationId));

        console.log(`[ERP Integration] Integration ${integrationId} prepared successfully`);

      } catch (error) {
        console.error(`[ERP Integration] Error processing integration ${integrationId}:`, error);
        
        // Atualizar status para erro
        await db.update(supplierIntegrationControl)
          .set({ 
            status: 'error',
            completed_at: new Date(),
            error_log: error.message
          })
          .where(eq(supplierIntegrationControl.id, integrationId));
      }
    });

    res.json({
      message: 'Integration started successfully',
      integration_id: integrationId,
      status: 'started'
    });

  } catch (error) {
    console.error('[ERP Integration] Error starting fetch:', error);
    res.status(500).json({
      error: 'Failed to start integration',
      details: error.message
    });
  }
});

/**
 * GET /api/erp-integration/suppliers/status/:integration_id
 * Verifica o status de uma integração em andamento
 */
router.get('/suppliers/status/:integration_id', isAuthenticated, async (req, res) => {
  try {
    const { integration_id } = req.params;

    // Buscar informações da integração
    const integration = await db.select()
      .from(supplierIntegrationControl)
      .where(eq(supplierIntegrationControl.id, integration_id));

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Buscar estatísticas
    const stats = await erpIntegrationService.getIntegrationStats(integration_id);

    res.json({
      integration: integration[0],
      stats
    });

  } catch (error) {
    console.error('[ERP Integration] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get integration status',
      details: error.message
    });
  }
});

/**
 * POST /api/erp-integration/suppliers/cancel/:integration_id
 * Cancela uma integração em andamento e retorna JSON
 */
router.post('/suppliers/cancel/:integration_id', isAuthenticated, async (req, res) => {
  try {
    const { integration_id } = req.params;

    // Verificar se a integração existe
    const integration = await db.select()
      .from(supplierIntegrationControl)
      .where(eq(supplierIntegrationControl.id, integration_id));

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const currentStatus = integration[0].status;
    // Evitar cancelar integrações já finalizadas/deletadas
    if (['completed', 'deleted', 'cancelled'].includes(currentStatus)) {
      return res.status(400).json({ 
        error: 'Integration cannot be cancelled in current status',
        current_status: currentStatus
      });
    }

    // Atualizar status para 'cancelled'
    await db.update(supplierIntegrationControl)
      .set({ status: 'cancelled', completed_at: new Date() })
      .where(eq(supplierIntegrationControl.id, integration_id));

    // Opcionalmente poderíamos marcar itens pendentes, mas não é necessário para o fluxo atual
    // Garantir resposta JSON
    res.json({
      message: 'Integration cancelled successfully',
      integration_id,
      status: 'cancelled'
    });

  } catch (error: any) {
    console.error('[ERP Integration] Error cancelling integration:', error);
    res.status(500).json({
      error: 'Failed to cancel integration',
      details: error.message
    });
  }
});

/**
 * GET /api/erp-integration/suppliers/comparison/:integration_id
 * Retorna comparação detalhada de uma integração
 */
router.get('/suppliers/comparison/:integration_id', isAuthenticated, async (req, res) => {
  try {
    const { integration_id } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      status = 'pending',
      action_type,
      search 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Construir condições WHERE
    let whereConditions = eq(supplierIntegrationQueue.integration_id, integration_id);
    
    if (status !== 'all') {
      whereConditions = and(whereConditions, eq(supplierIntegrationQueue.status, status as string));
    }
    
    if (action_type) {
      whereConditions = and(whereConditions, eq(supplierIntegrationQueue.action_required, action_type as string));
    }
    
    if (search) {
      whereConditions = and(
        whereConditions,
        sql`${supplierIntegrationQueue.supplier_data}->>'name' ILIKE ${`%${search}%`}`
      );
    }

    // Buscar itens da fila
    const [items, total] = await Promise.all([
      db.select({
        id: supplierIntegrationQueue.id,
        erp_supplier_id: supplierIntegrationQueue.erp_supplier_id,
        supplier_data: supplierIntegrationQueue.supplier_data,
        comparison_result: supplierIntegrationQueue.comparison_result,
        action_required: supplierIntegrationQueue.action_required,
        local_supplier_id: supplierIntegrationQueue.local_supplier_id,
        status: supplierIntegrationQueue.status,
        created_at: supplierIntegrationQueue.created_at
      })
        .from(supplierIntegrationQueue)
        .where(whereConditions)
        .orderBy(sql`${supplierIntegrationQueue.created_at} ASC`)
        .limit(Number(limit))
        .offset(offset),

      db.select({ count: sql`COUNT(*)::INTEGER` })
        .from(supplierIntegrationQueue)
        .where(whereConditions)
    ]);

    res.json({
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: total[0].count,
        pages: Math.ceil(total[0].count / Number(limit))
      }
    });

  } catch (error) {
    console.error('[ERP Integration] Error getting comparison:', error);
    res.status(500).json({
      error: 'Failed to get comparison data',
      details: error.message
    });
  }
});

/**
 * POST /api/erp-integration/suppliers/process
 * Processa e aplica as integrações selecionadas
 */
router.post('/suppliers/process', isAuthenticated, async (req, res) => {
  try {
    const { integration_id, selected_suppliers = [], operation_type = 'both' } = req.body;
    const userId = req.session.userId!;

    // Validar integração
    const integration = await db.select()
      .from(supplierIntegrationControl)
      .where(eq(supplierIntegrationControl.id, integration_id));

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (integration[0].status !== 'started' && integration[0].status !== 'prepared') {
      return res.status(400).json({ 
        error: 'Integration cannot be processed in current status',
        current_status: integration[0].status
      });
    }

    // Validar fornecedores selecionados
    if (selected_suppliers.length === 0) {
      return res.status(400).json({ error: 'No suppliers selected for processing' });
    }

    // Processar em background
    process.nextTick(async () => {
      try {
        console.log(`[ERP Integration] Starting processing for integration ${integration_id}`);
        
        await erpIntegrationService.processIntegration(integration_id, selected_suppliers, userId);
        
        console.log(`[ERP Integration] Processing completed for integration ${integration_id}`);

      } catch (error) {
        console.error(`[ERP Integration] Error processing integration ${integration_id}:`, error);
        
        // Atualizar status para erro
        await db.update(supplierIntegrationControl)
          .set({ 
            status: 'error',
            completed_at: new Date(),
            error_log: error.message
          })
          .where(eq(supplierIntegrationControl.id, integration_id));
      }
    });

    res.json({
      message: 'Processing started successfully',
      integration_id,
      status: 'processing'
    });

  } catch (error) {
    console.error('[ERP Integration] Error starting processing:', error);
    res.status(500).json({
      error: 'Failed to start processing',
      details: error.message
    });
  }
});

/**
 * GET /api/erp-integration/history
 * Retorna histórico de integrações
 */
router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const history = await erpIntegrationService.getIntegrationHistory({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      userId: req.session.userId!
    });

    res.json(history);

  } catch (error) {
    console.error('[ERP Integration] Error getting history:', error);
    res.status(500).json({
      error: 'Failed to get integration history',
      details: error.message
    });
  }
});

/**
 * GET /api/erp-integration/history/:integration_id/details
 * Retorna detalhes de uma integração específica
 */
router.get('/history/:integration_id/details', isAuthenticated, async (req, res) => {
  try {
    const { integration_id } = req.params;

    // Buscar informações da integração
    const integration = await db.select()
      .from(supplierIntegrationControl)
      .where(eq(supplierIntegrationControl.id, integration_id));

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Buscar histórico detalhado
    const details = await db.select({
      id: supplierIntegrationHistory.id,
      operation_type: supplierIntegrationHistory.operation_type,
      supplier_id: supplierIntegrationHistory.supplier_id,
      erp_supplier_id: supplierIntegrationHistory.erp_supplier_id,
      supplier_name: supplierIntegrationHistory.supplier_name,
      action_taken: supplierIntegrationHistory.action_taken,
      status: supplierIntegrationHistory.status,
      error_message: supplierIntegrationHistory.error_message,
      created_at: supplierIntegrationHistory.created_at
    })
      .from(supplierIntegrationHistory)
      .where(eq(supplierIntegrationHistory.integration_id, integration_id))
      .orderBy(sql`${supplierIntegrationHistory.created_at} DESC`);

    res.json({
      integration: integration[0],
      details
    });

  } catch (error) {
    console.error('[ERP Integration] Error getting integration details:', error);
    res.status(500).json({
      error: 'Failed to get integration details',
      details: error.message
    });
  }
});

/**
 * DELETE /api/erp-integration/history/:integration_id
 * Remove uma integração do histórico (soft delete)
 */
router.delete('/history/:integration_id', isAuthenticated, async (req, res) => {
  try {
    const { integration_id } = req.params;

    // Verificar se a integração existe
    const integration = await db.select()
      .from(supplierIntegrationControl)
      .where(eq(supplierIntegrationControl.id, integration_id));

    if (!integration.length) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Marcar como deletado (soft delete)
    await db.update(supplierIntegrationControl)
      .set({ status: 'deleted' })
      .where(eq(supplierIntegrationControl.id, integration_id));

    res.json({ message: 'Integration deleted successfully' });

  } catch (error) {
    console.error('[ERP Integration] Error deleting integration:', error);
    res.status(500).json({
      error: 'Failed to delete integration',
      details: error.message
    });
  }
});

export default router;