import axios, { AxiosInstance, AxiosError } from 'axios';
import { db } from './db';
import { suppliers, supplierIntegrationHistory, supplierIntegrationQueue, supplierIntegrationControl, users } from '../shared/schema';
import { eq, and, or, inArray, sql, desc } from 'drizzle-orm';
import { validateCNPJ, validateCPF } from './cnpj-cpf-validator';
import { createHash } from 'crypto';

interface ERPSupplier {
  id: string;
  name: string;
  cnpj?: string;
  cpf?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipcode?: string;
  };
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface ERPResponse {
  suppliers: ERPSupplier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ComparisonResult {
  erpSupplier: ERPSupplier;
  localSupplier?: any;
  action: 'create' | 'update' | 'ignore';
  reason: string;
  differences?: string[];
}

interface IntegrationConfig {
  apiUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
}

export class ERPIntegrationService {
  private axiosInstance: AxiosInstance;
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });

    // Adicionar interceptors para retry e logging
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const path = config.url || '';
        const method = config.method?.toUpperCase() || 'GET';
        const fullUrl = `${this.config.apiUrl}${path}`;
        console.log(`[ERP Integration] Request: ${method} ${path}`);
        console.log(`[ERP Integration] Full URL: ${fullUrl}`);
        return config;
      },
      (error) => {
        console.error('[ERP Integration] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const path = response.config.url || '';
        const fullUrl = `${this.config.apiUrl}${path}`;
        console.log(`[ERP Integration] Response: ${response.status} ${path}`);
        console.log(`[ERP Integration] Full URL: ${fullUrl}`);
        return response;
      },
      async (error: AxiosError) => {
        console.error('[ERP Integration] Response error:', error.message);
        
        if (error.config && error.response?.status === 429) {
          // Rate limit - esperar e retry
          await this.delay(this.config.retryDelay * 2);
          return this.axiosInstance.request(error.config);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryRequest<T>(requestFn: () => Promise<T>, attempt = 1): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt >= this.config.retryAttempts) {
        throw error;
      }
      
      console.log(`[ERP Integration] Retry attempt ${attempt + 1} of ${this.config.retryAttempts}`);
      await this.delay(this.config.retryDelay * attempt);
      return this.retryRequest(requestFn, attempt + 1);
    }
  }

  /**
   * Busca fornecedores do ERP com paginação
   */
  async fetchSuppliers(page = 1, limit = 100, updatedAfter?: Date): Promise<ERPResponse> {
    try {
      // Mapeia parâmetros conforme API ERP documentada (swagger: /api/Fornecedor)
      // A API aceita pelo menos: search, limit. "page" pode ser ignorado pelo ERP,
      // mas mantemos por compatibilidade e possível suporte.
      const params: any = { search: '', limit, page };
      if (updatedAfter) {
        // Algumas integrações suportam filtro por data; se não suportar, o ERP ignora.
        params.updated_after = updatedAfter.toISOString();
      }

      // Buscar fornecedores via endpoint correto
      const fornecedoresRes = await this.retryRequest(() =>
        this.axiosInstance.get<any>('/Fornecedor', { params })
      );

      const rawData = fornecedoresRes.data;

      // A resposta do ERP para /Fornecedor é um array simples de fornecedores.
      // Precisamos normalizar para ERPSupplier[] e criar paginação.
      const erpSuppliers: ERPSupplier[] = Array.isArray(rawData)
        ? rawData.map((item: any) => ({
            id: String(item.id ?? item.codigo ?? item.code ?? item.idSupplier ?? ''),
            name: item.name ?? item.description ?? item.razaoSocial ?? item.fantasia ?? 'Fornecedor',
            cnpj: item.cnpj || undefined,
            cpf: item.cpf || undefined,
            email: item.email || undefined,
            phone: item.phone || item.telefone || undefined,
            address: undefined,
            status: 'active',
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
          }))
        : (rawData?.suppliers ?? []);

      // Buscar total via endpoint de contagem, quando disponível
      let total = erpSuppliers.length;
      try {
        const countRes = await this.retryRequest(() =>
          this.axiosInstance.get<any>('/Fornecedor/GetCount', { params: { search: params.search } })
        );
        const countData = countRes.data;
        if (typeof countData === 'number') {
          total = countData;
        } else if (countData && typeof countData.total === 'number') {
          total = countData.total;
        } else if (countData && typeof countData.count === 'number') {
          total = countData.count;
        }
      } catch (err) {
        // Se falhar a contagem, seguimos com o tamanho do array atual
        console.warn('[ERP Integration] Could not retrieve total count, using current batch size.');
      }

      const pages = Math.max(1, Math.ceil(total / limit));
      const response: ERPResponse = {
        suppliers: erpSuppliers,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };

      return this.validateERPResponse(response);
    } catch (error: any) {
      console.error('[ERP Integration] Error fetching suppliers:', error);
      throw new Error(`Failed to fetch suppliers from ERP: ${error.message}`);
    }
  }

  /**
   * Busca todos os fornecedores do ERP (com paginação automática)
   */
  async fetchAllSuppliers(updatedAfter?: Date): Promise<ERPSupplier[]> {
    const allSuppliers: ERPSupplier[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchSuppliers(page, this.config.batchSize, updatedAfter);
      allSuppliers.push(...response.suppliers);
      
      hasMore = page < response.pagination.pages;
      page++;
    }

    return allSuppliers;
  }

  /**
   * Valida a resposta do ERP
   */
  private validateERPResponse(response: any): ERPResponse {
    if (!response || !Array.isArray(response.suppliers)) {
      throw new Error('Invalid ERP response format');
    }

    // Sanitizar e validar fornecedores sem bloquear integração
    // 1) Remover registros sem id ou name
    response.suppliers = response.suppliers.filter((supplier: any) => {
      if (!supplier.id || !supplier.name) {
        console.warn(`[ERP Integration] Skipping supplier due to missing id/name`);
        return false;
      }
      return true;
    });

    // 2) Sanitizar campos inválidos (CNPJ/CPF/email) sem lançar erro
    response.suppliers.forEach((supplier: any) => {
      if (supplier.cnpj && !validateCNPJ(supplier.cnpj)) {
        console.warn(`[ERP Integration] Invalid CNPJ for supplier ${supplier.id}: ${supplier.cnpj} — removing field`);
        supplier.cnpj = undefined;
      }

      if (supplier.cpf && !validateCPF(supplier.cpf)) {
        console.warn(`[ERP Integration] Invalid CPF for supplier ${supplier.id}: ${supplier.cpf} — removing field`);
        supplier.cpf = undefined;
      }

      if (supplier.email && !this.validateEmail(supplier.email)) {
        console.warn(`[ERP Integration] Invalid email for supplier ${supplier.id}: ${supplier.email} — removing field`);
        supplier.email = undefined;
      }
    });

    return response;
  }

  /**
   * Valida formato de email
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Compara fornecedores do ERP com os locais
   */
  async compareSuppliers(erpSuppliers: ERPSupplier[]): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];

    // Buscar todos os fornecedores locais
    const localSuppliers = await db.select().from(suppliers);

    for (const erpSupplier of erpSuppliers) {
      const result = await this.compareSingleSupplier(erpSupplier, localSuppliers);
      results.push(result);
    }

    return results;
  }

  /**
   * Compara um fornecedor individual
   */
  private async compareSingleSupplier(erpSupplier: ERPSupplier, localSuppliers: any[]): Promise<ComparisonResult> {
    // 1. Verificar por idsuppliererp
    const byErpId = localSuppliers.find(s => s.idsuppliererp === erpSupplier.id);
    if (byErpId) {
      return {
        erpSupplier,
        localSupplier: byErpId,
        action: 'ignore',
        reason: 'Supplier already integrated by ERP ID'
      };
    }

    // 2. Verificar por CNPJ
    if (erpSupplier.cnpj) {
      const byCnpj = localSuppliers.find(s => s.cnpj === erpSupplier.cnpj);
      if (byCnpj) {
        return {
          erpSupplier,
          localSupplier: byCnpj,
          action: 'update',
          reason: 'Found by CNPJ - will update ERP ID',
          differences: [`idsuppliererp: ${byCnpj.idsuppliererp || 'null'} -> ${erpSupplier.id}`]
        };
      }
    }

    // 3. Verificar por CPF
    if (erpSupplier.cpf) {
      const byCpf = localSuppliers.find(s => s.cpf === erpSupplier.cpf);
      if (byCpf) {
        return {
          erpSupplier,
          localSupplier: byCpf,
          action: 'update',
          reason: 'Found by CPF - will update ERP ID',
          differences: [`idsuppliererp: ${byCpf.idsuppliererp || 'null'} -> ${erpSupplier.id}`]
        };
      }
    }

    // 4. Novo fornecedor
    return {
      erpSupplier,
      action: 'create',
      reason: 'New supplier - will create',
      differences: ['New supplier from ERP']
    };
  }

  /**
   * Cria uma nova integração no banco de dados
   */
  async createIntegration(userId: string, type: 'full' | 'incremental'): Promise<string> {
    const integration = await db.insert(supplierIntegrationControl).values({
      integration_type: type,
      status: 'started',
      created_by: userId
    }).returning();

    return integration[0].id;
  }

  /**
   * Salva resultados da comparação na fila de integração
   */
  async saveComparisonResults(integrationId: string, results: ComparisonResult[]): Promise<void> {
    const queueItems = results
      .filter(r => r.action !== 'ignore')
      .map(result => ({
        integration_id: integrationId,
        erp_supplier_id: result.erpSupplier.id,
        supplier_data: result.erpSupplier,
        comparison_result: result.action,
        action_required: result.action,
        local_supplier_id: result.localSupplier?.id,
        status: 'pending'
      }));

    if (queueItems.length > 0) {
      await db.insert(supplierIntegrationQueue).values(queueItems);
    }
  }

  /**
   * Processa e aplica as integrações
   */
  async processIntegration(integrationId: string, selectedSuppliers: string[], userId: string): Promise<void> {
    const integration = await db.select().from(supplierIntegrationControl)
      .where(eq(supplierIntegrationControl.id, integrationId));

    if (!integration.length) {
      throw new Error('Integration not found');
    }

    // Atualizar status para processing
    await db.update(supplierIntegrationControl)
      .set({ status: 'processing' })
      .where(eq(supplierIntegrationControl.id, integrationId));

    try {
      // Buscar itens da fila
      const queueItems = await db.select().from(supplierIntegrationQueue)
        .where(and(
          eq(supplierIntegrationQueue.integration_id, integrationId),
          selectedSuppliers.length > 0 ? inArray(supplierIntegrationQueue.erp_supplier_id, selectedSuppliers) : undefined
        ));

      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      // Processar em lotes
      for (const item of queueItems) {
        try {
          if (item.action_required === 'create') {
            await this.createSupplier(item, userId);
            createdCount++;
          } else if (item.action_required === 'update') {
            await this.updateSupplier(item, userId);
            updatedCount++;
          }

          // Atualizar status do item
          await db.update(supplierIntegrationQueue)
            .set({ status: 'processed', processed_at: new Date() })
            .where(eq(supplierIntegrationQueue.id, item.id));

        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          errorCount++;

          // Registrar erro
          await db.update(supplierIntegrationQueue)
            .set({ status: 'error' })
            .where(eq(supplierIntegrationQueue.id, item.id));

          // Registrar no histórico
          await db.insert(supplierIntegrationHistory).values({
            integration_id: integrationId,
            operation_type: item.action_required,
            supplier_id: item.local_supplier_id,
            erp_supplier_id: item.erp_supplier_id,
            supplier_name: item.supplier_data.name,
            action_taken: 'error',
            status: 'error',
            error_message: error.message,
            created_by: userId
          });
        }
      }

      // Atualizar controle de integração
      await db.update(supplierIntegrationControl)
        .set({
          status: 'completed',
          completed_at: new Date(),
          created_suppliers: createdCount,
          updated_suppliers: updatedCount,
          error_count: errorCount
        })
        .where(eq(supplierIntegrationControl.id, integrationId));

    } catch (error) {
      // Atualizar status para error
      await db.update(supplierIntegrationControl)
        .set({ 
          status: 'error',
          completed_at: new Date(),
          error_log: error.message
        })
        .where(eq(supplierIntegrationControl.id, integrationId));

      throw error;
    }
  }

  /**
   * Cria um novo fornecedor
   */
  private async createSupplier(queueItem: any, userId: string): Promise<void> {
    const supplierData = queueItem.supplier_data;
    
    const newSupplier = await db.insert(suppliers).values({
      name: supplierData.name,
      cnpj: supplierData.cnpj,
      cpf: supplierData.cpf,
      email: supplierData.email,
      phone: supplierData.phone,
      idsuppliererp: supplierData.id,
      address: supplierData.address ? JSON.stringify(supplierData.address) : null,
      status: supplierData.status === 'active' ? 'active' : 'inactive'
    }).returning();

    // Registrar no histórico
    await db.insert(supplierIntegrationHistory).values({
      integration_id: queueItem.integration_id,
      operation_type: 'create',
      supplier_id: newSupplier[0].id,
      erp_supplier_id: supplierData.id,
      supplier_name: supplierData.name,
      action_taken: 'created',
      status: 'success',
      processed_data: supplierData,
      created_by: userId
    });
  }

  /**
   * Atualiza um fornecedor existente
   */
  private async updateSupplier(queueItem: any, userId: string): Promise<void> {
    const supplierData = queueItem.supplier_data;
    
    await db.update(suppliers)
      .set({
        idsuppliererp: supplierData.id,
        updated_at: new Date()
      })
      .where(eq(suppliers.id, queueItem.local_supplier_id));

    // Registrar no histórico
    await db.insert(supplierIntegrationHistory).values({
      integration_id: queueItem.integration_id,
      operation_type: 'update',
      supplier_id: queueItem.local_supplier_id,
      erp_supplier_id: supplierData.id,
      supplier_name: supplierData.name,
      action_taken: 'updated',
      status: 'success',
      processed_data: { idsuppliererp: supplierData.id },
      created_by: userId
    });
  }

  /**
   * Busca estatísticas de uma integração
   */
  async getIntegrationStats(integrationId: string): Promise<any> {
    // Usar o builder do Drizzle para garantir um retorno consistente
    const result = await db
      .select({
        total: sql<number>`COUNT(*)::INTEGER`,
        pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::INTEGER`,
        processed: sql<number>`SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END)::INTEGER`,
        to_create: sql<number>`SUM(CASE WHEN action_required = 'create' THEN 1 ELSE 0 END)::INTEGER`,
        to_update: sql<number>`SUM(CASE WHEN action_required = 'update' THEN 1 ELSE 0 END)::INTEGER`,
        errors: sql<number>`SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::INTEGER`,
      })
      .from(supplierIntegrationQueue)
      .where(eq(supplierIntegrationQueue.integration_id, integrationId));

    const row = Array.isArray(result) && result.length > 0 ? result[0] : undefined;
    return {
      total: row?.total ?? 0,
      pending: row?.pending ?? 0,
      processed: row?.processed ?? 0,
      to_create: row?.to_create ?? 0,
      to_update: row?.to_update ?? 0,
      errors: row?.errors ?? 0,
    };
  }

  /**
   * Busca histórico de integrações
   */
  async getIntegrationHistory(options: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  } = {}): Promise<any> {
    const { page = 1, limit = 20, status, userId } = options;
    const offset = (page - 1) * limit;

    // Construir condições dinamicamente usando Drizzle
    const conditions = [] as any[];
    if (status) {
      conditions.push(eq(supplierIntegrationControl.status, status));
    }
    if (userId) {
      // created_by é inteiro; garantir número
      const uid = typeof userId === 'string' ? Number(userId) : (userId as any);
      conditions.push(eq(supplierIntegrationControl.created_by, uid));
    }
    const whereExpr = conditions.length ? and(...conditions) : undefined;

    // Buscar histórico usando builder do Drizzle para garantir forma de retorno consistente
    const history = await db
      .select({
        id: supplierIntegrationControl.id,
        integration_type: supplierIntegrationControl.integration_type,
        status: supplierIntegrationControl.status,
        total_suppliers: supplierIntegrationControl.total_suppliers,
        created_suppliers: supplierIntegrationControl.created_suppliers,
        updated_suppliers: supplierIntegrationControl.updated_suppliers,
        error_count: supplierIntegrationControl.error_count,
        started_at: supplierIntegrationControl.started_at,
        completed_at: supplierIntegrationControl.completed_at,
        created_by: supplierIntegrationControl.created_by,
      })
      .from(supplierIntegrationControl)
      .where(whereExpr)
      .orderBy(desc(supplierIntegrationControl.started_at))
      .limit(limit)
      .offset(offset);

    // Buscar total com COUNT(*) através do builder
    const totalRes = await db
      .select({ count: sql<number>`COUNT(*)::INTEGER` })
      .from(supplierIntegrationControl)
      .where(whereExpr);

    const totalCount = (totalRes && totalRes[0] && typeof totalRes[0].count !== 'undefined')
      ? Number(totalRes[0].count)
      : 0;

    return {
      data: history,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.max(1, Math.ceil(totalCount / limit))
      }
    };
  }
}

// Exportar instância configurada
export const erpIntegrationService = new ERPIntegrationService({
  // Alinha com BASE_API_URL do .env (ex.: http://54.232.194.197:5001/api)
  apiUrl: process.env.BASE_API_URL || process.env.ERP_API_URL || 'http://54.232.194.197:5001/api',
  apiKey: process.env.ERP_API_KEY,
  timeout: parseInt(process.env.ERP_API_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.ERP_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.ERP_RETRY_DELAY || '1000'),
  batchSize: parseInt(process.env.SUPPLIER_INTEGRATION_BATCH_SIZE || '50')
});
