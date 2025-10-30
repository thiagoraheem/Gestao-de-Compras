import { db } from '../db';
import { quotationItems, supplierQuotationItems, supplierQuotations } from '../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { storage } from '../storage';

export interface QuotationSyncService {
  syncQuotationItems(quotationId: number): Promise<void>;
  syncSupplierQuotationItems(supplierQuotationId: number): Promise<void>;
  validateQuantityConsistency(quotationId: number): Promise<ValidationResult[]>;
  fixMissingMappings(quotationId: number): Promise<void>;
}

export interface ValidationResult {
  quotationItemId: number;
  supplierQuotationItemId?: number;
  issue: string;
  severity: 'warning' | 'error';
  suggestedFix?: string;
}

class QuotationSyncServiceImpl implements QuotationSyncService {
  /**
   * Sincroniza todos os itens de cotação para garantir mapeamento correto
   */
  async syncQuotationItems(quotationId: number): Promise<void> {
    try {
      // Buscar todos os quotation_items da cotação
      const qItems = await storage.getQuotationItems(quotationId);
      
      // Buscar todas as supplier_quotations desta cotação
      const supplierQuots = await storage.getSupplierQuotations(quotationId);
      
      for (const supplierQuot of supplierQuots) {
        await this.syncSupplierQuotationItems(supplierQuot.id);
      }
      
      console.log(`Sincronização concluída para cotação ${quotationId}`);
    } catch (error) {
      console.error(`Erro na sincronização da cotação ${quotationId}:`, error);
      throw error;
    }
  }

  /**
   * Sincroniza itens de uma cotação de fornecedor específica
   */
  async syncSupplierQuotationItems(supplierQuotationId: number): Promise<void> {
    try {
      // Buscar a supplier quotation
      const supplierQuot = await storage.getSupplierQuotationById(supplierQuotationId);
      if (!supplierQuot) {
        throw new Error(`Supplier quotation ${supplierQuotationId} não encontrada`);
      }

      // Buscar quotation_items da cotação principal
      const quotationItems = await storage.getQuotationItems(supplierQuot.quotationId);
      
      // Buscar supplier_quotation_items existentes
      const supplierItems = await storage.getSupplierQuotationItems(supplierQuotationId);

      // Para cada quotation_item, garantir que existe um supplier_quotation_item correspondente
      for (const qItem of quotationItems) {
        let supplierItem = supplierItems.find(si => si.quotationItemId === qItem.id);
        
        if (!supplierItem) {
          // Tentar encontrar por descrição se quotationItemId não estiver definido
          supplierItem = supplierItems.find(si => 
            !si.quotationItemId && 
            si.description?.toLowerCase().trim() === qItem.description?.toLowerCase().trim()
          );
          
          if (supplierItem) {
            // Atualizar o supplier_item para incluir o quotationItemId
            await storage.updateSupplierQuotationItem(supplierItem.id, {
              quotationItemId: qItem.id,
              quantity: qItem.quantity, // Sincronizar quantidade
              unit: qItem.unit // Sincronizar unidade
            });
            console.log(`Mapeamento corrigido: supplier_item ${supplierItem.id} -> quotation_item ${qItem.id}`);
          } else {
            // Criar novo supplier_quotation_item se não existir
            await storage.createSupplierQuotationItem({
              supplierQuotationId: supplierQuotationId,
              quotationItemId: qItem.id,
              itemCode: qItem.itemCode,
              description: qItem.description,
              quantity: qItem.quantity,
              unit: qItem.unit,
              unitPrice: '0.00',
              totalPrice: '0.00',
              deliveryDays: 0,
              isAvailable: true
            });
            console.log(`Novo supplier_item criado para quotation_item ${qItem.id}`);
          }
        } else {
          // Verificar se as quantidades estão sincronizadas
          if (supplierItem.availableQuantity !== qItem.quantity || supplierItem.confirmedUnit !== qItem.unit) {
            await storage.updateSupplierQuotationItem(supplierItem.id, {
              availableQuantity: qItem.quantity,
              confirmedUnit: qItem.unit
            });
            console.log(`Quantidades sincronizadas para supplier_item ${supplierItem.id}`);
          }
        }
      }
    } catch (error) {
      console.error(`Erro na sincronização do supplier quotation ${supplierQuotationId}:`, error);
      throw error;
    }
  }

  /**
   * Valida consistência de quantidades entre tabelas relacionadas
   */
  async validateQuantityConsistency(quotationId: number): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const quotationItems = await storage.getQuotationItems(quotationId);
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      
      for (const qItem of quotationItems) {
        for (const supplierQuot of supplierQuotations) {
          const supplierItems = await storage.getSupplierQuotationItems(supplierQuot.id);
          const supplierItem = supplierItems.find(si => si.quotationItemId === qItem.id);
          
          if (!supplierItem) {
            results.push({
              quotationItemId: qItem.id,
              issue: `Item de cotação ${qItem.id} não possui supplier_quotation_item correspondente no fornecedor ${supplierQuot.supplier?.name}`,
              severity: 'error',
              suggestedFix: 'Executar sincronização automática'
            });
          } else {
            // Verificar consistência de quantidades
            if (supplierItem.availableQuantity !== qItem.quantity) {
              results.push({
                quotationItemId: qItem.id,
                supplierQuotationItemId: supplierItem.id,
                issue: `Quantidade inconsistente: quotation_item=${qItem.quantity}, supplier_item=${supplierItem.availableQuantity}`,
                severity: 'warning',
                suggestedFix: 'Sincronizar quantidades'
              });
            }
            
            // Verificar consistência de unidades
            if (supplierItem.unit !== qItem.unit) {
              results.push({
                quotationItemId: qItem.id,
                supplierQuotationItemId: supplierItem.id,
                issue: `Unidade inconsistente: quotation_item=${qItem.unit}, supplier_item=${supplierItem.unit}`,
                severity: 'warning',
                suggestedFix: 'Sincronizar unidades'
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erro na validação de consistência:`, error);
      throw error;
    }
    
    return results;
  }

  /**
   * Corrige mapeamentos ausentes baseado em descrição e ordem
   */
  async fixMissingMappings(quotationId: number): Promise<void> {
    try {
      const quotationItems = await storage.getQuotationItems(quotationId);
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      
      for (const supplierQuot of supplierQuotations) {
        const supplierItems = await storage.getSupplierQuotationItems(supplierQuot.id);
        
        // Encontrar supplier_items sem quotationItemId
        const unmappedSupplierItems = supplierItems.filter(si => !si.quotationItemId);
        
        for (const unmappedItem of unmappedSupplierItems) {
          // Tentar encontrar quotation_item correspondente por descrição
          const matchingQuotationItem = quotationItems.find(qi => 
            qi.description?.toLowerCase().trim() === unmappedItem.description?.toLowerCase().trim()
          );
          
          if (matchingQuotationItem) {
            // Verificar se já não existe outro supplier_item mapeado para este quotation_item
            const existingMapping = supplierItems.find(si => 
              si.quotationItemId === matchingQuotationItem.id && si.id !== unmappedItem.id
            );
            
            if (!existingMapping) {
              await storage.updateSupplierQuotationItem(unmappedItem.id, {
                quotationItemId: matchingQuotationItem.id,
                quantity: matchingQuotationItem.quantity,
                unit: matchingQuotationItem.unit
              });
              console.log(`Mapeamento corrigido por descrição: supplier_item ${unmappedItem.id} -> quotation_item ${matchingQuotationItem.id}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao corrigir mapeamentos:`, error);
      throw error;
    }
  }
}

export const quotationSyncService = new QuotationSyncServiceImpl();