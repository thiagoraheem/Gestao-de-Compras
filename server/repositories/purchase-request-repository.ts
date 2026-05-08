import { db, pool } from "../db";
import { 
  purchaseRequests, 
  purchaseRequestItems, 
  users, 
  departments, 
  costCenters, 
  suppliers, 
  purchaseOrders, 
  quotations, 
  supplierQuotations,
  receipts,
  auditLogs,
  purchaseOrderItems,
  approvalHistory,
  quotationVersionHistory,
  receiptItems,
  supplierQuotationItems,
  attachments,
  quotationItems,
  quantityAdjustmentHistory,
  approvedQuotationItems
} from "../../shared/schema";
import { eq, desc, and, or, inArray, like, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { 
  PurchaseRequest, 
  InsertPurchaseRequest, 
  PurchaseRequestItem, 
  InsertPurchaseRequestItem,
  User,
  PurchaseRequestWithDetails
} from "../../shared/schema";
import { CalculadoraValoresSolicitacao, ItemCalculo } from "../../shared/utils/CalculadoraValoresSolicitacao";
import { userRepository } from "./user-repository";

// Create aliases for user tables
const requesterUser = alias(users, "requester_user");
const approverA1User = alias(users, "approver_a1_user");
const chosenSupplier = alias(suppliers, "chosen_supplier");

export class PurchaseRequestRepository {
  async getAllPurchaseRequests(companyId?: number, user?: User): Promise<PurchaseRequest[]> {
    const conditions = [];

    if (companyId) {
      conditions.push(eq(purchaseRequests.companyId, companyId));
    }

    if (user) {
      const hasFullAccess =
        user.isAdmin ||
        user.isBuyer ||
        user.isReceiver ||
        user.isApproverA1 ||
        user.isApproverA2;

      if (!hasFullAccess) {
        // Restricted access: Creator OR Department
        const userDeptIds = await userRepository.getUserDepartments(user.id);
        
        const restrictions = [eq(purchaseRequests.requesterId, user.id)];
        
        if (userDeptIds.length > 0) {
             restrictions.push(inArray(departments.id, userDeptIds));
        }
        
        conditions.push(or(...restrictions));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const requests = await db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        requesterId: purchaseRequests.requesterId,
        costCenterId: purchaseRequests.costCenterId,
        companyId: purchaseRequests.companyId,
        category: purchaseRequests.category,
        urgency: purchaseRequests.urgency,
        justification: purchaseRequests.justification,
        idealDeliveryDate: purchaseRequests.idealDeliveryDate,
        availableBudget: purchaseRequests.availableBudget,
        additionalInfo: purchaseRequests.additionalInfo,
        currentPhase: purchaseRequests.currentPhase,
        lastPhase: purchaseRequests.lastPhase,
        approverA1Id: purchaseRequests.approverA1Id,
        approvedA1: purchaseRequests.approvedA1,
        rejectionReasonA1: purchaseRequests.rejectionReasonA1,
        approvalDateA1: purchaseRequests.approvalDateA1,
        buyerId: purchaseRequests.buyerId,
        totalValue: sql<string>`COALESCE(
          NULLIF(${purchaseRequests.totalValue}, 0),
          (SELECT SUM(total_price) FROM purchase_order_items WHERE purchase_order_id = ${purchaseOrders.id}),
          0
        )::text`,
        paymentMethodId: purchaseRequests.paymentMethodId,
        approverA2Id: purchaseRequests.approverA2Id,
        approvedA2: purchaseRequests.approvedA2,
        rejectionReasonA2: purchaseRequests.rejectionReasonA2,
        rejectionActionA2: purchaseRequests.rejectionActionA2,
        approvalDateA2: purchaseRequests.approvalDateA2,
        chosenSupplierId: purchaseRequests.chosenSupplierId,
        choiceReason: purchaseRequests.choiceReason,
        negotiatedValue: purchaseRequests.negotiatedValue,
        discountsObtained: purchaseRequests.discountsObtained,
        deliveryDate: purchaseRequests.deliveryDate,
        purchaseDate: purchaseRequests.purchaseDate,
        purchaseObservations: purchaseRequests.purchaseObservations,
        receivedById: purchaseRequests.receivedById,
        receivedDate: purchaseRequests.receivedDate,
        hasPendency: purchaseRequests.hasPendency,
        pendencyReason: purchaseRequests.pendencyReason,
        createdAt: purchaseRequests.createdAt,
        updatedAt: purchaseRequests.updatedAt,
        // Requester data
        requester: {
          id: requesterUser.id,
          firstName: requesterUser.firstName,
          lastName: requesterUser.lastName,
          username: requesterUser.username,
          email: requesterUser.email,
        },
        // Approver A1 data
        approverA1: {
          id: approverA1User.id,
          firstName: approverA1User.firstName,
          lastName: approverA1User.lastName,
          username: approverA1User.username,
          email: approverA1User.email,
        },
        // Cost Center and Department data
        costCenter: {
          id: costCenters.id,
          code: costCenters.code,
          name: costCenters.name,
          departmentId: costCenters.departmentId,
        },
        department: {
          id: departments.id,
          name: departments.name,
          description: departments.description,
        },
        // Check if quotation exists
        hasQuotation: sql<boolean>`EXISTS(SELECT 1 FROM ${quotations} WHERE ${quotations.purchaseRequestId} = ${purchaseRequests.id})`,
        // Chosen Supplier data
        chosenSupplier: {
          id: chosenSupplier.id,
          name: chosenSupplier.name,
          email: chosenSupplier.email,
        },
        // Purchase Order data
        purchaseOrder: {
          id: purchaseOrders.id,
          orderNumber: purchaseOrders.orderNumber,
          fulfillmentStatus: purchaseOrders.fulfillmentStatus,
        },
        // Check for pending fiscal receipts
        hasPendingFiscal: sql<boolean>`EXISTS(SELECT 1 FROM ${receipts} WHERE ${receipts.purchaseOrderId} = ${purchaseOrders.id} AND ${receipts.status} = 'conf_fisica')`,
      })
      .from(purchaseRequests)
      .leftJoin(
        requesterUser,
        eq(purchaseRequests.requesterId, requesterUser.id),
      )
      .leftJoin(
        approverA1User,
        eq(purchaseRequests.approverA1Id, approverA1User.id),
      )
      .leftJoin(costCenters, eq(purchaseRequests.costCenterId, costCenters.id))
      .leftJoin(departments, eq(costCenters.departmentId, departments.id))
      .leftJoin(
        chosenSupplier,
        eq(purchaseRequests.chosenSupplierId, chosenSupplier.id),
      )
      .leftJoin(
        purchaseOrders,
        eq(purchaseOrders.purchaseRequestId, purchaseRequests.id),
      )
      .where(whereClause)
      .orderBy(desc(purchaseRequests.createdAt));

    return requests as any[];
  }

  async getPurchaseRequestById(
    id: number,
  ): Promise<PurchaseRequest | undefined> {
    // First get the purchase request
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, id));

    if (!request) {
      return undefined;
    }

    // Then get the requester data separately if requesterId exists
    let requester = null;
    let requesterName = "N/A";
    let requesterUsername = "N/A";
    let requesterEmail = "";

    if (request.requesterId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.requesterId));

      if (user) {
        requester = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        };
        requesterName = user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.username;
        requesterUsername = user.username;
        requesterEmail = user.email || "";
      }
    }

    // Get chosen supplier if exists
    let chosenSupplierData = null;
    if (request.chosenSupplierId) {
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, request.chosenSupplierId));
      if (supplier) {
        chosenSupplierData = supplier;
      }
    }

    // Return the complete object with all necessary fields
    const result = {
      ...request,
      requester,
      requesterName,
      requesterUsername,
      requesterEmail,
      chosenSupplier: chosenSupplierData,
    };

    return result as any;
  }

  async getPurchaseRequestByNumber(requestNumber: string): Promise<PurchaseRequest | undefined> {
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requestNumber, requestNumber));
    
    return request || undefined;
  }

  async createPurchaseRequest(
    request: InsertPurchaseRequest,
  ): Promise<PurchaseRequest> {
    // Generate request number
    const year = new Date().getFullYear();
    const requests = await db
      .select()
      .from(purchaseRequests)
      .orderBy(desc(purchaseRequests.requestNumber));

    let maxSequence = 0;
    const prefix = `SOL-${year}-`;

    // Find the highest sequence number for the current year
    for (const req of requests) {
      if (req.requestNumber?.startsWith(prefix)) {
        const sequence = parseInt(req.requestNumber.substring(prefix.length));
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }

    // Generate next sequence number
    const nextSequence = maxSequence + 1;
    const requestNumber = `${prefix}${String(nextSequence).padStart(3, "0")}`;

    const [newRequest] = await db
      .insert(purchaseRequests)
      .values({ ...request, requestNumber })
      .returning();
    return newRequest;
  }

  async updatePurchaseRequest(
    id: number,
    request: Partial<InsertPurchaseRequest>,
  ): Promise<PurchaseRequest> {
    const [updatedRequest] = await db
      .update(purchaseRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(purchaseRequests.id, id))
      .returning();
    return updatedRequest;
  }

  async getPurchaseRequestsByPhase(phase: string): Promise<PurchaseRequestWithDetails[]> {
    const results = await db
      .select({
        request: purchaseRequests,
        supplier: suppliers,
        requester: users,
      })
      .from(purchaseRequests)
      .leftJoin(suppliers, eq(purchaseRequests.chosenSupplierId, suppliers.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(eq(purchaseRequests.currentPhase, phase))
      .orderBy(desc(purchaseRequests.createdAt));

    const requestsWithItems = await Promise.all(
      results.map(async ({ request, supplier, requester }) => {
        const items = await this.getPurchaseRequestItems(request.id);
        
        // Buscar pedido de compra associado
        const [purchaseOrder] = await db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseRequestId, request.id))
          .limit(1);

        return {
          ...request,
          chosenSupplier: supplier,
          requester,
          items,
          purchaseOrder,
        };
      })
    );

    return requestsWithItems as unknown as PurchaseRequestWithDetails[];
  }

  async getPendingMaterialsForConference(): Promise<PurchaseRequestWithDetails[]> {
    // New flow: requests in 'pedido_concluido' with pending receipts in 'recebimento_fisico'
    // Legacy flow: requests still in 'recebimento' phase
    const results = await db
      .selectDistinct({
        request: purchaseRequests,
        supplier: suppliers,
        requester: users,
      })
      .from(purchaseRequests)
      .leftJoin(suppliers, eq(purchaseRequests.chosenSupplierId, suppliers.id))
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .leftJoin(receipts, eq(purchaseRequests.id, receipts.purchaseRequestId))
      .leftJoin(purchaseOrders, eq(purchaseRequests.id, purchaseOrders.purchaseRequestId))
      .where(
        or(
          eq(purchaseRequests.currentPhase, 'recebimento'),
          and(
            eq(purchaseRequests.currentPhase, 'pedido_concluido'),
            eq(receipts.receiptPhase, 'recebimento_fisico'),
            // Filter out orphans: if PO is fully received, the receipt must NOT be nf_pendente/rascunho
            sql`NOT (${purchaseOrders.fulfillmentStatus} = 'fulfilled' AND (${receipts.status} = 'nf_pendente' OR ${receipts.status} = 'rascunho'))`
          )
        )
      )
      .orderBy(desc(purchaseRequests.createdAt));

    const requestsWithItems = await Promise.all(
      results.map(async ({ request, supplier, requester }) => {
        const items = await this.getPurchaseRequestItems(request.id);
        
        const [purchaseOrder] = await db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseRequestId, request.id))
          .limit(1);

        return {
          ...request,
          chosenSupplier: supplier,
          requester,
          items,
          purchaseOrder,
        };
      })
    );

    return requestsWithItems as unknown as PurchaseRequestWithDetails[];
  }

  async getPurchaseRequestsByUser(userId: number): Promise<PurchaseRequest[]> {
    return await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, userId))
      .orderBy(desc(purchaseRequests.createdAt));
  }

  async getPurchaseRequestsForReport(filters: any): Promise<{ data: any[]; total: number; summary?: any }> {
    try {
      const timeoutMsRaw = Number(process.env.REPORT_QUERY_TIMEOUT_MS ?? "");
      const timeoutMs =
        Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 20_000;

      // Base SQL query parts
      let selectClause = `
        SELECT 
          pr.id,
          pr.request_number as "requestNumber",
          pr.justification,
          pr.category,
          pr.requester_id as "requesterId",
          pr.cost_center_id as "costCenterId",
          pr.current_phase as "currentPhase",
          pr.urgency,
          pr.created_at as "createdAt",
          pr.updated_at as "updatedAt",
          pr.buyer_id as "buyerId",
          pr.approver_a1_id as "approverA1Id",
          pr.approver_a2_id as "approverA2Id",
          pr.total_value as "totalValue",
          pr.chosen_supplier_id as "chosenSupplierId"
      `;
      
      let fromClause = `FROM purchase_requests pr`;
      
      const whereConditions: string[] = [];
      const params: any[] = [];
      let paramCounter = 1;
      
      // Build WHERE conditions
      if (filters?.startDate) {
        whereConditions.push(`pr.created_at >= $${paramCounter}`);
        params.push(filters.startDate);
        paramCounter++;
      }

      if (filters?.endDate) {
        whereConditions.push(`pr.created_at <= $${paramCounter}`);
        params.push(filters.endDate);
        paramCounter++;
      }
      
      if (filters?.departmentId && !isNaN(parseInt(filters.departmentId))) {
        whereConditions.push(`pr.cost_center_id = $${paramCounter}`);
        params.push(parseInt(filters.departmentId));
        paramCounter++;
      }
      
      if (filters?.requesterId && !isNaN(parseInt(filters.requesterId))) {
        whereConditions.push(`pr.requester_id = $${paramCounter}`);
        params.push(parseInt(filters.requesterId));
        paramCounter++;
      }
      
      if (filters?.phase && typeof filters.phase === 'string') {
        whereConditions.push(`pr.current_phase = $${paramCounter}`);
        params.push(filters.phase);
        paramCounter++;
      }
      
      if (filters?.urgency && typeof filters.urgency === 'string') {
        whereConditions.push(`pr.urgency = $${paramCounter}`);
        params.push(filters.urgency);
        paramCounter++;
      }
      
      if (filters?.supplierId && typeof filters.supplierId === 'string') {
        // Filter by supplier name instead of ID since frontend sends supplier name
        whereConditions.push(`pr.chosen_supplier_id IN (SELECT id FROM suppliers WHERE name = $${paramCounter})`);
        params.push(filters.supplierId);
        paramCounter++;
      }
      
      if (filters?.search && typeof filters.search === 'string' && filters.search.trim() !== '') {
        const searchTerm = `%${filters.search.trim()}%`;
        whereConditions.push(`(pr.justification ILIKE $${paramCounter} OR pr.request_number ILIKE $${paramCounter + 1} OR pr.category ILIKE $${paramCounter + 2})`);
        params.push(searchTerm, searchTerm, searchTerm);
        paramCounter += 3;
      }
      
      if (filters?.itemDescription && typeof filters.itemDescription === 'string' && filters.itemDescription.trim() !== '') {
        const itemDesc = `%${filters.itemDescription.trim()}%`;
        whereConditions.push(`pr.id IN (SELECT purchase_request_id FROM purchase_request_items WHERE description ILIKE $${paramCounter})`);
        params.push(itemDesc);
        paramCounter++;
      }
      
      // Combine clauses
      let whereClause = '';
      if (whereConditions.length > 0) {
        whereClause = ' WHERE ' + whereConditions.join(' AND ');
      }
      
      // 1. Get total count + data with timeout for the main report query
      const client = await pool.connect();
      let total = 0;
      let requests: any[] = [];
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);

        const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
        const countResult = await client.query(countSql, params);
        total = parseInt(countResult.rows[0]?.total || "0");

        let sqlQuery = `${selectClause} ${fromClause} ${whereClause} ORDER BY pr.created_at DESC`;

        if (filters.limit !== undefined && filters.offset !== undefined && !filters.resumo && !filters.export) {
          sqlQuery += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
          params.push(filters.limit, filters.offset);
          paramCounter += 2;
        }

        const result = await client.query(sqlQuery, params);
        requests = result.rows;
        await client.query("COMMIT");
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw error;
      } finally {
        client.release();
      }
      
      // Get requester and department names separately, plus related data
      const requestsWithNames = await Promise.all(
        requests.map(async (request: any) => {
          let requesterName = 'N/A';
          let requesterEmail = 'N/A';
          let departmentName = 'N/A';
          
          if (request.requesterId) {
            try {
              const requesterResult = await pool.query(
                'SELECT first_name, last_name, email FROM users WHERE id = $1 LIMIT 1',
                [request.requesterId]
              );
              
              if (requesterResult.rows.length > 0) {
                const user = requesterResult.rows[0];
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A';
                requesterName = fullName;
                requesterEmail = user.email || 'N/A';
              }
            } catch (error) {
              // Error fetching requester data
            }
          }
          
          if (request.costCenterId) {
            try {
              const costCenterResult = await pool.query(
                'SELECT cc.name as cost_center_name, d.name as department_name FROM cost_centers cc LEFT JOIN departments d ON cc.department_id = d.id WHERE cc.id = $1 LIMIT 1',
                [request.costCenterId]
              );
              
              if (costCenterResult.rows.length > 0) {
                departmentName = costCenterResult.rows[0].department_name || 'N/A';
              }
            } catch (error) {
              // Error fetching department data
            }
          }
          
          // Fetch chosen supplier information
          let supplierName = 'N/A';
          if (request.chosenSupplierId) {
            try {
              const supplierResult = await pool.query(
                'SELECT name FROM suppliers WHERE id = $1 LIMIT 1',
                [request.chosenSupplierId]
              );
              
              if (supplierResult.rows.length > 0) {
                supplierName = supplierResult.rows[0].name || 'N/A';
              }
            } catch (error) {
              // Error fetching supplier data
            }
          }
          
          // Fetch approvers information
          let approverA1Name = 'N/A';
          let approverA2Name = 'N/A';
          
          if (request.approverA1Id) {
            try {
              const approverResult = await pool.query(
                'SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1',
                [request.approverA1Id]
              );
              
              if (approverResult.rows.length > 0) {
                const user = approverResult.rows[0];
                approverA1Name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A';
              }
            } catch (error) {
              // Error fetching approver A1 data
            }
          }
          
          if (request.approverA2Id) {
            try {
              const approverResult = await pool.query(
                'SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1',
                [request.approverA2Id]
              );
              
              if (approverResult.rows.length > 0) {
                const user = approverResult.rows[0];
                approverA2Name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A';
              }
            } catch (error) {
              // Error fetching approver A2 data
            }
          }
          
          let itemsParaCalculo: ItemCalculo[] = [];
          let globalDiscount = { tipo: "none" as any, valor: 0 };
          
          let poItemsSum = 0;
          let purchaseOrderOriginalDescFound = false;

          try {
            const poItemsResult = await pool.query(
              `SELECT poi.unit_price, poi.quantity, poi.total_price
               FROM purchase_order_items poi 
               JOIN purchase_orders po ON poi.purchase_order_id = po.id 
               WHERE po.purchase_request_id = $1`,
              [request.id]
            );
            if (poItemsResult.rows.length > 0) {
              purchaseOrderOriginalDescFound = true;
              itemsParaCalculo = poItemsResult.rows.map((row: any) => ({
                valorOriginal: (parseFloat(row.unit_price) || 0) * (parseFloat(row.quantity) || 0),
                descontoItem: ((parseFloat(row.unit_price) || 0) * (parseFloat(row.quantity) || 0)) - (parseFloat(row.total_price) || 0)
              }));
              poItemsSum = itemsParaCalculo.reduce((acc, curr) => acc + (curr.valorOriginal - curr.descontoItem), 0);
            }
          } catch {}

          if (!purchaseOrderOriginalDescFound && request.chosenSupplierId) {
            const chosenSupplierQuotationResult = await pool.query(
              `SELECT sq.id, sq.discount_type, sq.discount_value
               FROM supplier_quotations sq
               JOIN quotations q ON sq.quotation_id = q.id
               WHERE q.purchase_request_id = $1 AND sq.supplier_id = $2
               ORDER BY sq.created_at DESC LIMIT 1`,
              [request.id, request.chosenSupplierId]
            );
            if (chosenSupplierQuotationResult.rows.length > 0) {
              const quotation = chosenSupplierQuotationResult.rows[0];
              globalDiscount = {
                tipo: quotation.discount_type,
                valor: parseFloat(quotation.discount_value) || 0
              };
              
              try {
                const itemsRes = await pool.query(
                  `SELECT original_total_price, discounted_total_price, total_price, discount_percentage, discount_value
                   FROM supplier_quotation_items
                   WHERE supplier_quotation_id = $1`,
                  [quotation.id]
                );
                
                itemsParaCalculo = itemsRes.rows.map((row: any) => {
                  let orig = parseFloat(row.original_total_price || '0') || 0;
                  const final = parseFloat(row.total_price || '0') || 0;
                  if (orig === 0 || orig < final) orig = final; // safeguard

                  // We trust the explicit discount if mapped
                  let descItem = orig - final;
                  return { valorOriginal: orig, descontoItem: Math.max(0, descItem) };
                });
              } catch (err) {}
            }
          }

          if (itemsParaCalculo.length === 0 && request.totalValue) {
             const v = parseFloat(request.totalValue);
             if (v > 0) {
               itemsParaCalculo.push({ valorOriginal: v, descontoItem: 0 });
             }
          }

          const resultadoCalculo = CalculadoraValoresSolicitacao.calcularTotais(itemsParaCalculo, globalDiscount);

          // Fetch related items with prices from purchase orders if available
          let items: any[] = [];
          try {
            const itemsResult = await pool.query(
              'SELECT id, description, requested_quantity, unit, product_code, technical_specification FROM purchase_request_items WHERE purchase_request_id = $1 ORDER BY id',
              [request.id]
            );
            
            // Get purchase order items for pricing if purchase order exists
            let purchaseOrderItemsResult = [];
            try {
              const poItemsResult = await pool.query(
                `SELECT poi.item_code, poi.description, poi.unit_price, poi.total_price, po.id as purchase_order_id
                 FROM purchase_order_items poi 
                 JOIN purchase_orders po ON poi.purchase_order_id = po.id 
                 WHERE po.purchase_request_id = $1
                 ORDER BY poi.id`,
                [request.id]
              );
              purchaseOrderItemsResult = poItemsResult.rows;
            } catch (error) {}
            
            // Fallback: Get pricing from supplier quotations if no purchase order items
            let supplierQuotationItems = [];
            if (request.chosenSupplierId && (purchaseOrderItemsResult.length === 0 || purchaseOrderItemsResult.every(poi => parseFloat(poi.unit_price) === 0))) {
              try {
                const quotationResult = await pool.query(
                  'SELECT id FROM quotations WHERE purchase_request_id = $1 ORDER BY created_at DESC LIMIT 1',
                  [request.id]
                );
                
                if (quotationResult.rows.length > 0) {
                  const quotationId = quotationResult.rows[0].id;
                  const supplierQuotationResult = await pool.query(
                    'SELECT id FROM supplier_quotations WHERE quotation_id = $1 AND supplier_id = $2 AND (is_chosen = true OR is_chosen IS NULL) LIMIT 1',
                    [quotationId, request.chosenSupplierId]
                  );
                  
                  if (supplierQuotationResult.rows.length > 0) {
                    const supplierQuotationId = supplierQuotationResult.rows[0].id;
                    const sqItemsResult = await pool.query(
                      `SELECT sqi.unit_price, sqi.total_price, qi.description, qi.item_code
                       FROM supplier_quotation_items sqi
                       JOIN quotation_items qi ON sqi.quotation_item_id = qi.id
                       WHERE sqi.supplier_quotation_id = $1 AND sqi.is_available = true`,
                      [supplierQuotationId]
                    );
                    supplierQuotationItems = sqItemsResult.rows;
                  }
                }
              } catch (error) {}
            }
            
            items = itemsResult.rows.map(item => {
              // Try to find matching purchase order item for pricing
              let poItem = purchaseOrderItemsResult.find(poi => {
                const descMatch = poi.description?.toLowerCase().trim() === item.description?.toLowerCase().trim();
                const codeMatch = poi.item_code === item.product_code;
                return descMatch || codeMatch;
              });
              
              // Fallback to supplier quotation items
              if (!poItem && supplierQuotationItems.length > 0) {
                poItem = supplierQuotationItems.find(sqi => {
                  const descMatch = sqi.description?.toLowerCase().trim() === item.description?.toLowerCase().trim();
                  const codeMatch = sqi.item_code === item.product_code;
                  return descMatch || codeMatch;
                });
              }
              
              let unitPrice = null;
              let totalPrice = null;
              
              if (poItem) {
                unitPrice = parseFloat(poItem.unit_price) || 0;
                totalPrice = parseFloat(poItem.total_price) || 0;
              } else {
                // Final fallback
                if (request.currentPhase === 'conclusao_compra' && request.totalValue) {
                  const totalRequestValue = parseFloat(request.totalValue) || 0;
                  if (totalRequestValue > 0) {
                    const itemCount = itemsResult.rows.length;
                    if (itemCount > 0) {
                      const estimatedTotal = totalRequestValue / itemCount;
                      const requestedQty = parseFloat(item.requested_quantity) || 1;
                      unitPrice = estimatedTotal / requestedQty;
                      totalPrice = estimatedTotal;
                    }
                  }
                }
              }
              
              return {
                id: item.id,
                description: item.description,
                quantity: parseFloat(item.requested_quantity) || 0,
                unit: item.unit,
                productCode: item.product_code,
                technicalSpecification: item.technical_specification,
                unitPrice,
                totalPrice
              };
            });
          } catch (error) {}
          
          return {
            ...request,
            requestDate: request.createdAt,
            phase: request.currentPhase,
            description: request.justification,
            requesterName,
            requesterEmail,
            departmentName,
            supplierName,
            approverA1Name,
            approverA2Name,
            valorItens: resultadoCalculo.valorItens,
            desconto: resultadoCalculo.desconto,
            subTotal: resultadoCalculo.subTotal,
            descontoProposta: resultadoCalculo.descontoProposta,
            valorFinal: resultadoCalculo.valorFinal,
            items,
            approvals: [],
            quotations: [],
            purchaseOrders: []
          };
        })
      );
      
      let summaryData = undefined;
      if (filters.resumo || filters.export) {
        summaryData = requestsWithNames.reduce((acc, curr) => ({
          totalValorItens: acc.totalValorItens + curr.valorItens,
          totalDesconto: acc.totalDesconto + curr.desconto,
          totalSubTotal: acc.totalSubTotal + curr.subTotal,
          totalDescontoProposta: acc.totalDescontoProposta + curr.descontoProposta,
          totalValorFinal: acc.totalValorFinal + curr.valorFinal,
        }), {
          totalValorItens: 0,
          totalDesconto: 0,
          totalSubTotal: 0,
          totalDescontoProposta: 0,
          totalValorFinal: 0
        });
      }

      if (filters.resumo && !filters.export) {
        return { data: [], total, summary: summaryData };
      }

      return { data: requestsWithNames, total, summary: summaryData };
    } catch (error) {
      console.error('Error in getPurchaseRequestsForReport:', error);
      throw error;
    }
  }

  async getQuotationsDashboardData(): Promise<any> {
    const activeRequests = await this.getPurchaseRequestsByPhase('cotacao');

    const enhancedRequests = await Promise.all(activeRequests.map(async (req) => {
      const [quotation] = await db
        .select()
        .from(quotations)
        .where(eq(quotations.purchaseRequestId, req.id))
        .orderBy(desc(quotations.createdAt))
        .limit(1);

      let supplierCount = 0;
      let responseCount = 0;
      let quotationStatus = 'pending';
      let quotationDeadline = null;

      if (quotation) {
        quotationStatus = quotation.status;
        quotationDeadline = quotation.quotationDeadline;
        const supplierQuotes = await db
          .select()
          .from(supplierQuotations)
          .where(eq(supplierQuotations.quotationId, quotation.id));
        
        supplierCount = supplierQuotes.length;
        responseCount = supplierQuotes.filter(sq => sq.status === 'received').length;
      }

      let departmentName = 'N/A';
      if (req.costCenterId) {
         const [cc] = await db.select().from(costCenters).where(eq(costCenters.id, req.costCenterId));
         if (cc && cc.departmentId) {
             const [dept] = await db.select().from(departments).where(eq(departments.id, cc.departmentId));
             if (dept) departmentName = dept.name;
         }
      }

      return {
        ...req,
        quotationId: quotation?.id,
        quotationStatus,
        quotationDeadline,
        departmentName,
        supplierCount,
        responseCount
      };
    }));

    const resultResponseTime = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (sq.received_at - sq.sent_at))/3600) as avg_hours
      FROM supplier_quotations sq
      WHERE sq.status = 'received' AND sq.sent_at IS NOT NULL AND sq.received_at IS NOT NULL
    `);
    const avgResponseTime = Number(resultResponseTime.rows[0]?.avg_hours || 0);

    const resultResponseRate = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'received') as received_count,
        COUNT(*) as total_count
      FROM supplier_quotations
    `);
    const receivedCount = Number(resultResponseRate.rows[0]?.received_count || 0);
    const totalSentCount = Number(resultResponseRate.rows[0]?.total_count || 0);
    const responseRate = totalSentCount > 0 ? (receivedCount / totalSentCount) * 100 : 0;

    const resultConversion = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM purchase_orders) as po_count,
        (SELECT COUNT(*) FROM quotations) as quote_count
    `);
    const poCount = Number(resultConversion.rows[0]?.po_count || 0);
    const quoteCount = Number(resultConversion.rows[0]?.quote_count || 0);
    const conversionRate = quoteCount > 0 ? (poCount / quoteCount) * 100 : 0;

    const totalOpenValue = activeRequests.reduce((sum, req) => sum + Number(req.totalValue || 0), 0);

    const resultAvgSuppliers = await db.execute(sql`
      SELECT AVG(supplier_count) as avg_suppliers
      FROM (
        SELECT quotation_id, COUNT(*) as supplier_count
        FROM supplier_quotations
        GROUP BY quotation_id
      ) sub
    `);
    const avgSuppliers = Number(resultAvgSuppliers.rows[0]?.avg_suppliers || 0);

    return {
      requests: enhancedRequests,
      kpis: {
        avgResponseTime,
        responseRate,
        conversionRate,
        totalOpenValue,
        avgSuppliers
      }
    };
  }

  async deletePurchaseRequest(id: number): Promise<void> {
    const prQuotations = await db
      .select()
      .from(quotations)
      .where(eq(quotations.purchaseRequestId, id));

    for (const quotation of prQuotations) {
      const prSupplierQuotations = await db
        .select()
        .from(supplierQuotations)
        .where(eq(supplierQuotations.quotationId, quotation.id));

      for (const supplierQuotation of prSupplierQuotations) {
        const sqItems = await db
          .select({ id: supplierQuotationItems.id })
          .from(supplierQuotationItems)
          .where(eq(supplierQuotationItems.supplierQuotationId, supplierQuotation.id));
        
        const sqItemIds = sqItems.map(i => i.id);

        if (sqItemIds.length > 0) {
            await db.delete(quantityAdjustmentHistory)
                .where(inArray(quantityAdjustmentHistory.supplierQuotationItemId, sqItemIds));
        }

        await db.delete(attachments)
            .where(eq(attachments.supplierQuotationId, supplierQuotation.id));

        await db.delete(supplierQuotationItems)
            .where(eq(supplierQuotationItems.supplierQuotationId, supplierQuotation.id));
      }

      await db.delete(supplierQuotations)
        .where(eq(supplierQuotations.quotationId, quotation.id));

      await db.delete(approvedQuotationItems)
        .where(eq(approvedQuotationItems.quotationId, quotation.id));

      // Use quotationVersionHistory instead of history
      await db.delete(quotationVersionHistory)
        .where(eq(quotationVersionHistory.quotationId, quotation.id));

      await db.delete(quotationItems)
        .where(eq(quotationItems.quotationId, quotation.id));

      await db.delete(attachments)
        .where(eq(attachments.quotationId, quotation.id));
    }

    await db.delete(quotations)
      .where(eq(quotations.purchaseRequestId, id));

    await db.delete(approvalHistory)
      .where(eq(approvalHistory.purchaseRequestId, id));

    await db.delete(auditLogs)
      .where(eq(auditLogs.purchaseRequestId, id));

    await db.delete(attachments)
      .where(eq(attachments.purchaseRequestId, id));

    await db
      .delete(purchaseRequestItems)
      .where(eq(purchaseRequestItems.purchaseRequestId, id));

    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));
  }

  async getPurchaseRequestItems(
    purchaseRequestId: number,
    includeTransferred: boolean = false
  ): Promise<PurchaseRequestItem[]> {
    let query;
    if (!includeTransferred) {
      query = db
        .select()
        .from(purchaseRequestItems)
        .where(
          and(
            eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId),
            or(
              eq(purchaseRequestItems.isTransferred, false),
              isNull(purchaseRequestItems.isTransferred)
            )
          )
        );
    } else {
      query = db
        .select()
        .from(purchaseRequestItems)
        .where(eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId));
    }
    
    return await query.orderBy(purchaseRequestItems.id);
  }

  async createPurchaseRequestItem(
    item: InsertPurchaseRequestItem,
  ): Promise<PurchaseRequestItem> {
    const [newItem] = await db
      .insert(purchaseRequestItems)
      .values(item)
      .returning();
    return newItem;
  }

  async updatePurchaseRequestItem(
    id: number,
    item: Partial<InsertPurchaseRequestItem>,
  ): Promise<PurchaseRequestItem> {
    const [updatedItem] = await db
      .update(purchaseRequestItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(purchaseRequestItems.id, id))
      .returning();
    return updatedItem;
  }

  async deletePurchaseRequestItem(id: number): Promise<void> {
    await db
      .delete(purchaseRequestItems)
      .where(eq(purchaseRequestItems.id, id));
  }

  async createPurchaseRequestItems(
    items: InsertPurchaseRequestItem[],
  ): Promise<PurchaseRequestItem[]> {
    if (items.length === 0) return [];
    return await db.insert(purchaseRequestItems).values(items).returning();
  }



  async cleanupPurchaseRequestsData(): Promise<void> {
    try {
      // Delete in the correct order to respect foreign key constraints

      // 1. Delete receipt items first
      await db.delete(receiptItems);

      // 2. Delete receipts
      await db.delete(receipts);

      // 3. Delete purchase order items
      await db.delete(purchaseOrderItems);

      // 4. Delete purchase orders
      await db.delete(purchaseOrders);

      // 5. Delete supplier quotation items
      await db.delete(supplierQuotationItems);

      // 6. Delete attachments (all types)
      await db.delete(attachments);

      // 7. Delete supplier quotations
      await db.delete(supplierQuotations);

      // 8. Delete quotation items
      await db.delete(quotationItems);

      // 9. Delete quotations
      await db.delete(quotations);

      // 10. Delete approval history
      await db.delete(approvalHistory);

      // 12. Delete purchase request items
      await db.delete(purchaseRequestItems);

      // 13. Finally, delete purchase requests
      await db.delete(purchaseRequests);
    } catch (error) {
      console.error("❌ Erro durante a limpeza:", error);
      throw error;
    }
  }
}

export const purchaseRequestRepository = new PurchaseRequestRepository();
