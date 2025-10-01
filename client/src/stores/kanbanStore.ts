import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { NotificationPayload } from '../hooks/useWebSocket';
import { apiRequest } from '../lib/queryClient';

// Types for Kanban entities
export interface PurchaseRequest {
  id: number;
  requestNumber: string;
  description: string;
  requestDate: string;
  urgency: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'rascunho' | 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada';
  phase: 'solicitacao' | 'aprovacao' | 'cotacao' | 'analise' | 'pedido' | 'entrega' | 'recebimento' | 'finalizada';
  totalValue?: number;
  requesterId: number;
  departmentId: number;
  companyId: number;
  requester?: {
    name: string;
    email: string;
  };
  department?: {
    name: string;
  };
  items?: PurchaseRequestItem[];
  quotations?: Quotation[];
  purchaseOrders?: PurchaseOrder[];
}

export interface PurchaseRequestItem {
  id: number;
  purchaseRequestId: number;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  specifications?: string;
}

export interface Quotation {
  id: number;
  purchaseRequestId: number;
  quotationNumber: string;
  quotationDate: string;
  status: 'pendente' | 'em_analise' | 'aprovada' | 'rejeitada';
  totalValue?: number;
  validUntil?: string;
  supplierQuotations?: SupplierQuotation[];
}

export interface SupplierQuotation {
  id: number;
  quotationId: number;
  supplierId: number;
  quotationDate: string;
  totalValue: number;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  validUntil?: string;
  supplier?: {
    name: string;
    email: string;
  };
}

export interface PurchaseOrder {
  id: number;
  purchaseRequestId: number;
  orderNumber: string;
  orderDate: string;
  status: 'pendente' | 'aprovada' | 'enviada' | 'entregue' | 'cancelada';
  totalValue: number;
  supplierId: number;
  supplier?: {
    name: string;
    email: string;
  };
}

// Kanban phases configuration
export const KANBAN_PHASES = [
  { id: 'solicitacao', name: 'Solicitação', color: 'bg-gray-100' },
  { id: 'aprovacao', name: 'Aprovação', color: 'bg-yellow-100' },
  { id: 'cotacao', name: 'Cotação', color: 'bg-blue-100' },
  { id: 'analise', name: 'Análise', color: 'bg-purple-100' },
  { id: 'pedido', name: 'Pedido', color: 'bg-orange-100' },
  { id: 'entrega', name: 'Entrega', color: 'bg-indigo-100' },
  { id: 'recebimento', name: 'Recebimento', color: 'bg-green-100' },
  { id: 'finalizada', name: 'Finalizada', color: 'bg-emerald-100' }
] as const;

export type KanbanPhase = typeof KANBAN_PHASES[number]['id'];

// Filter types
export interface KanbanFilters {
  search: string;
  department: string;
  urgency: string;
  requester: string;
  supplier: string;
  dateRange: {
    start: string;
    end: string;
  };
}

// Store state interface
export interface KanbanState {
  // Data
  purchaseRequests: PurchaseRequest[];
  quotations: Quotation[];
  supplierQuotations: SupplierQuotation[];
  purchaseOrders: PurchaseOrder[];
  
  // UI State
  filters: KanbanFilters;
  selectedRequest: PurchaseRequest | null;
  isLoading: boolean;
  error: string | null;
  
  // Real-time state
  lastUpdate: number;
  pendingUpdates: Map<string, NotificationPayload>;
  isRealTimeEnabled: boolean;
  
  // Statistics
  stats: {
    totalRequests: number;
    requestsByPhase: Record<KanbanPhase, number>;
    requestsByUrgency: Record<string, number>;
    averageProcessingTime: number;
  };
}

// Store actions interface
export interface KanbanActions {
  // Data actions
  setPurchaseRequests: (requests: PurchaseRequest[]) => void;
  addPurchaseRequest: (request: PurchaseRequest) => void;
  updatePurchaseRequest: (id: number, updates: Partial<PurchaseRequest>) => void;
  removePurchaseRequest: (id: number) => void;
  
  setQuotations: (quotations: Quotation[]) => void;
  addQuotation: (quotation: Quotation) => void;
  updateQuotation: (id: number, updates: Partial<Quotation>) => void;
  removeQuotation: (id: number) => void;
  
  setSupplierQuotations: (quotations: SupplierQuotation[]) => void;
  addSupplierQuotation: (quotation: SupplierQuotation) => void;
  updateSupplierQuotation: (id: number, updates: Partial<SupplierQuotation>) => void;
  removeSupplierQuotation: (id: number) => void;
  
  setPurchaseOrders: (orders: PurchaseOrder[]) => void;
  addPurchaseOrder: (order: PurchaseOrder) => void;
  updatePurchaseOrder: (id: number, updates: Partial<PurchaseOrder>) => void;
  removePurchaseOrder: (id: number) => void;
  
  // API actions
  fetchPurchaseRequests: () => Promise<void>;
  
  updatePurchaseRequestPhase: (id: number, phase: KanbanPhase) => Promise<void>;
  refreshData: () => Promise<void>;
  
  // Filter actions
  setFilters: (filters: Partial<KanbanFilters>) => void;
  clearFilters: () => void;
  
  // UI actions
  setSelectedRequest: (request: PurchaseRequest | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Real-time actions
  handleNotification: (payload: NotificationPayload) => void;
  processPendingUpdates: () => void;
  setRealTimeEnabled: (enabled: boolean) => void;
  
  // Utility actions
  getRequestsByPhase: (phase: KanbanPhase) => PurchaseRequest[];
  getFilteredRequests: () => PurchaseRequest[];
  moveRequest: (requestId: number, newPhase: KanbanPhase) => void;
  refreshStats: () => void;
  reset: () => void;
}

// Initial state
const initialState: KanbanState = {
  purchaseRequests: [],
  quotations: [],
  supplierQuotations: [],
  purchaseOrders: [],
  
  filters: {
    search: '',
    department: '',
    urgency: '',
    requester: '',
    supplier: '',
    dateRange: {
      start: '',
      end: ''
    }
  },
  
  selectedRequest: null,
  isLoading: false,
  error: null,
  
  lastUpdate: Date.now(),
  pendingUpdates: new Map(),
  isRealTimeEnabled: true,
  
  stats: {
    totalRequests: 0,
    requestsByPhase: {
      solicitacao: 0,
      aprovacao: 0,
      cotacao: 0,
      analise: 0,
      pedido: 0,
      entrega: 0,
      recebimento: 0,
      finalizada: 0
    },
    requestsByUrgency: {
      baixa: 0,
      media: 0,
      alta: 0,
      critica: 0
    },
    averageProcessingTime: 0
  }
};

// Create the store
export const useKanbanStore = create<KanbanState & KanbanActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Data actions
    setPurchaseRequests: (requests) => {
      set({ purchaseRequests: requests, lastUpdate: Date.now() });
      get().refreshStats();
    },

    addPurchaseRequest: (request) => {
      set((state) => ({
        purchaseRequests: [...state.purchaseRequests, request],
        lastUpdate: Date.now()
      }));
      get().refreshStats();
    },

    updatePurchaseRequest: (id, updates) => {
      set((state) => ({
        purchaseRequests: state.purchaseRequests.map(req =>
          req.id === id ? { ...req, ...updates } : req
        ),
        lastUpdate: Date.now()
      }));
      get().refreshStats();
    },

    removePurchaseRequest: (id) => {
      set((state) => ({
        purchaseRequests: state.purchaseRequests.filter(req => req.id !== id),
        selectedRequest: state.selectedRequest?.id === id ? null : state.selectedRequest,
        lastUpdate: Date.now()
      }));
      get().refreshStats();
    },

    setQuotations: (quotations) => {
      set({ quotations, lastUpdate: Date.now() });
    },

    // API actions implementation
    fetchPurchaseRequests: async () => {
      try {
        set({ isLoading: true, error: null });
        const requests = await apiRequest('/api/purchase-requests');
        get().setPurchaseRequests(requests);
      } catch (error) {
        console.error('Error fetching purchase requests:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to fetch purchase requests' });
      } finally {
        set({ isLoading: false });
      }
    },

    updatePurchaseRequestPhase: async (id, phase) => {
      try {
        const updatedRequest = await apiRequest(`/api/purchase-requests/${id}`, {
          method: 'PATCH',
          body: { phase }
        });
        get().updatePurchaseRequest(id, updatedRequest);
      } catch (error) {
        console.error('Error updating purchase request phase:', error);
        throw error;
      }
    },

    refreshData: async () => {
      await get().fetchPurchaseRequests();
    },

    addQuotation: (quotation) => {
      set((state) => ({
        quotations: [...state.quotations, quotation],
        lastUpdate: Date.now()
      }));
    },

    updateQuotation: (id, updates) => {
      set((state) => ({
        quotations: state.quotations.map(quot =>
          quot.id === id ? { ...quot, ...updates } : quot
        ),
        lastUpdate: Date.now()
      }));
    },

    removeQuotation: (id) => {
      set((state) => ({
        quotations: state.quotations.filter(quot => quot.id !== id),
        lastUpdate: Date.now()
      }));
    },

    setSupplierQuotations: (quotations) => {
      set({ supplierQuotations: quotations, lastUpdate: Date.now() });
    },

    addSupplierQuotation: (quotation) => {
      set((state) => ({
        supplierQuotations: [...state.supplierQuotations, quotation],
        lastUpdate: Date.now()
      }));
    },

    updateSupplierQuotation: (id, updates) => {
      set((state) => ({
        supplierQuotations: state.supplierQuotations.map(quot =>
          quot.id === id ? { ...quot, ...updates } : quot
        ),
        lastUpdate: Date.now()
      }));
    },

    removeSupplierQuotation: (id) => {
      set((state) => ({
        supplierQuotations: state.supplierQuotations.filter(quot => quot.id !== id),
        lastUpdate: Date.now()
      }));
    },

    setPurchaseOrders: (orders) => {
      set({ purchaseOrders: orders, lastUpdate: Date.now() });
    },

    addPurchaseOrder: (order) => {
      set((state) => ({
        purchaseOrders: [...state.purchaseOrders, order],
        lastUpdate: Date.now()
      }));
    },

    updatePurchaseOrder: (id, updates) => {
      set((state) => ({
        purchaseOrders: state.purchaseOrders.map(order =>
          order.id === id ? { ...order, ...updates } : order
        ),
        lastUpdate: Date.now()
      }));
    },

    removePurchaseOrder: (id) => {
      set((state) => ({
        purchaseOrders: state.purchaseOrders.filter(order => order.id !== id),
        lastUpdate: Date.now()
      }));
    },

    // Filter actions
    setFilters: (newFilters) => {
      set((state) => ({
        filters: { ...state.filters, ...newFilters }
      }));
    },

    clearFilters: () => {
      set({ filters: initialState.filters });
    },

    // UI actions
    setSelectedRequest: (request) => {
      set({ selectedRequest: request });
    },

    setLoading: (loading) => {
      set({ isLoading: loading });
    },

    setError: (error) => {
      set({ error });
    },

    // Real-time actions
    handleNotification: (payload) => {
      const { table, operation, data } = payload;
      
      if (!get().isRealTimeEnabled) return;

      console.log('[Kanban Store] Handling notification:', payload);

      switch (table) {
        case 'purchase_requests':
          switch (operation) {
            case 'INSERT':
              get().addPurchaseRequest(data);
              break;
            case 'UPDATE':
              get().updatePurchaseRequest(data.id, data);
              break;
            case 'DELETE':
              get().removePurchaseRequest(data.id);
              break;
            case 'CACHE':
              if (Array.isArray(data)) {
                get().setPurchaseRequests(data);
              }
              break;
          }
          break;

        case 'quotations':
          switch (operation) {
            case 'INSERT':
              get().addQuotation(data);
              break;
            case 'UPDATE':
              get().updateQuotation(data.id, data);
              break;
            case 'DELETE':
              get().removeQuotation(data.id);
              break;
            case 'CACHE':
              if (Array.isArray(data)) {
                get().setQuotations(data);
              }
              break;
          }
          break;

        case 'supplier_quotations':
          switch (operation) {
            case 'INSERT':
              get().addSupplierQuotation(data);
              break;
            case 'UPDATE':
              get().updateSupplierQuotation(data.id, data);
              break;
            case 'DELETE':
              get().removeSupplierQuotation(data.id);
              break;
            case 'CACHE':
              if (Array.isArray(data)) {
                get().setSupplierQuotations(data);
              }
              break;
          }
          break;

        case 'purchase_orders':
          switch (operation) {
            case 'INSERT':
              get().addPurchaseOrder(data);
              break;
            case 'UPDATE':
              get().updatePurchaseOrder(data.id, data);
              break;
            case 'DELETE':
              get().removePurchaseOrder(data.id);
              break;
            case 'CACHE':
              if (Array.isArray(data)) {
                get().setPurchaseOrders(data);
              }
              break;
          }
          break;
      }

      // Store pending update for potential rollback
      const updateKey = `${table}_${operation}_${data.id || Date.now()}`;
      set((state) => ({
        pendingUpdates: new Map(state.pendingUpdates).set(updateKey, payload)
      }));
    },

    processPendingUpdates: () => {
      // Clear processed updates after a delay
      setTimeout(() => {
        set({ pendingUpdates: new Map() });
      }, 5000);
    },

    setRealTimeEnabled: (enabled) => {
      set({ isRealTimeEnabled: enabled });
    },

    // Utility actions
    getRequestsByPhase: (phase) => {
      return get().purchaseRequests.filter(req => req.phase === phase);
    },

    getFilteredRequests: () => {
      const { purchaseRequests, filters } = get();
      
      return purchaseRequests.filter(request => {
        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch = 
            request.requestNumber.toLowerCase().includes(searchLower) ||
            request.description.toLowerCase().includes(searchLower) ||
            request.requester?.name.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) return false;
        }

        // Department filter
        if (filters.department && request.department?.name !== filters.department) {
          return false;
        }

        // Urgency filter
        if (filters.urgency && request.urgency !== filters.urgency) {
          return false;
        }

        // Requester filter
        if (filters.requester && request.requester?.name !== filters.requester) {
          return false;
        }

        // Date range filter
        if (filters.dateRange.start || filters.dateRange.end) {
          const requestDate = new Date(request.requestDate);
          
          if (filters.dateRange.start && requestDate < new Date(filters.dateRange.start)) {
            return false;
          }
          
          if (filters.dateRange.end && requestDate > new Date(filters.dateRange.end)) {
            return false;
          }
        }

        return true;
      });
    },

    moveRequest: (requestId, newPhase) => {
      get().updatePurchaseRequest(requestId, { phase: newPhase });
    },

    refreshStats: () => {
      const { purchaseRequests } = get();
      
      const stats = {
        totalRequests: purchaseRequests.length,
        requestsByPhase: KANBAN_PHASES.reduce((acc, phase) => {
          acc[phase.id] = purchaseRequests.filter(req => req.phase === phase.id).length;
          return acc;
        }, {} as Record<KanbanPhase, number>),
        requestsByUrgency: {
          baixa: purchaseRequests.filter(req => req.urgency === 'baixa').length,
          media: purchaseRequests.filter(req => req.urgency === 'media').length,
          alta: purchaseRequests.filter(req => req.urgency === 'alta').length,
          critica: purchaseRequests.filter(req => req.urgency === 'critica').length,
        },
        averageProcessingTime: 0 // TODO: Calculate based on phase transitions
      };

      set({ stats });
    },

    reset: () => {
      set(initialState);
    }
  }))
);

// Selectors for optimized subscriptions
export const selectPurchaseRequests = (state: KanbanState & KanbanActions) => state.purchaseRequests;
export const selectFilters = (state: KanbanState & KanbanActions) => state.filters;
export const selectSelectedRequest = (state: KanbanState & KanbanActions) => state.selectedRequest;
export const selectStats = (state: KanbanState & KanbanActions) => state.stats;
export const selectIsLoading = (state: KanbanState & KanbanActions) => state.isLoading;
export const selectError = (state: KanbanState & KanbanActions) => state.error;