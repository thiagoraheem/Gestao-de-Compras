
import { storage } from '../storage';
import { db } from '../db';

// Mocks
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockLeftJoin = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('../db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
  },
  pool: {},
}));

jest.mock('drizzle-orm', () => ({
  ...jest.requireActual('drizzle-orm'),
  eq: jest.fn(),
  desc: jest.fn(),
}));

describe('Conference Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include purchaseOrder in getPurchaseRequestsByPhase', async () => {
    // Mock getPurchaseRequestItems to avoid internal db calls
    jest.spyOn(storage, 'getPurchaseRequestItems').mockResolvedValue([]);

    // Chain for the main query (getPurchaseRequestsByPhase)
    const mockMainQuery = {
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue([
        { 
          request: { id: 1, currentPhase: 'recebimento' }, 
          supplier: { id: 10, name: 'Fornecedor A' } 
        }
      ])
    };

    // Chain for the purchase order query
    const mockOrderQuery = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { id: 100, orderNumber: 'PO-2023-001', totalValue: '5000.00' }
      ])
    };

    // Setup select to return appropriate chains
    mockSelect
      .mockReturnValueOnce(mockMainQuery) // First call: main query
      .mockReturnValue(mockOrderQuery);   // Subsequent calls: purchase order query inside map

    const results: any[] = await storage.getPurchaseRequestsByPhase('recebimento');

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('purchaseOrder');
    expect(results[0].purchaseOrder).toEqual({ 
      id: 100, 
      orderNumber: 'PO-2023-001', 
      totalValue: '5000.00' 
    });
    
    // Verify db interaction
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});
