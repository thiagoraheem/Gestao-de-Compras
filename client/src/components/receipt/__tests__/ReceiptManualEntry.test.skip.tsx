
/** @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReceiptManualEntry } from '../ReceiptManualEntry';
import { useReceipt } from '../ReceiptContext';
import { useReceiptActions } from '../useReceiptActions';
import { useQuery } from '@tanstack/react-query';

// Mock dependencies
jest.mock('../ReceiptContext');
jest.mock('../useReceiptActions');
jest.mock('@tanstack/react-query');
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
}));

// Mock Lucide icons to avoid render issues
jest.mock('lucide-react', () => ({
  Search: () => <div data-testid="icon-search" />,
  Trash: () => <div data-testid="icon-trash" />,
  AlertCircle: () => <div data-testid="icon-alert" />,
  Plus: () => <div data-testid="icon-plus" />,
}));

// Mock UI components that might be complex
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root">
      <select 
        data-testid="select-trigger" 
        value={value} 
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

describe('ReceiptManualEntry', () => {
  const mockSetManualItems = jest.fn();
  const mockSetManualTotal = jest.fn();
  const mockSetReceiptType = jest.fn();
  
  const defaultContext = {
    request: { id: 1 },
    receiptType: 'produto',
    setReceiptType: mockSetReceiptType,
    manualNFNumber: '',
    setManualNFNumber: jest.fn(),
    manualNFSeries: '',
    setManualNFSeries: jest.fn(),
    manualNFIssueDate: '',
    setManualNFIssueDate: jest.fn(),
    manualNFEntryDate: '',
    setManualNFEntryDate: jest.fn(),
    manualTotal: '',
    setManualTotal: mockSetManualTotal,
    manualNFEmitterCNPJ: '',
    setManualNFEmitterCNPJ: jest.fn(),
    manualNFAccessKey: '',
    setManualNFAccessKey: jest.fn(),
    manualItems: [],
    setManualItems: mockSetManualItems,
    manualErrors: {},
    setManualErrors: jest.fn(),
    manualNFStep: 2, // Step 2 shows items
    setManualNFStep: jest.fn(),
    setActiveTab: jest.fn(),
    itemTaxes: {},
    setItemTaxes: jest.fn(),
    purchaseOrderItems: [
      { id: 101, itemCode: 'PO1', description: 'PO Item 1', quantity: 10, unit: 'UN' }
    ],
    nfConfirmed: false,
    canConfirmNf: true,
    nfStatus: {},
    setNfReceiptId: jest.fn(),
    nfReceiptId: 123,
    setXmlPreview: jest.fn(),
    setProductTransp: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useReceipt as jest.Mock).mockReturnValue(defaultContext);
    (useReceiptActions as jest.Mock).mockReturnValue({ confirmNfMutation: { mutate: jest.fn() } });
    (useQuery as jest.Mock).mockReturnValue({ data: [] }); // Default no receipt items
  });

  it('renders correctly', () => {
    render(<ReceiptManualEntry />);
    expect(screen.getByText('Inclusão Manual de Nota Fiscal')).toBeInTheDocument();
  });

  it('auto-fills items when type is "avulso" and receipt items exist', async () => {
    const receiptItems = [
      {
        id: 1,
        locadorProductCode: 'CODE1',
        description: 'Received Item 1',
        unit: 'UN',
        quantityReceived: 5,
        unitPrice: 10,
        ncm: '12345678',
        purchaseOrderItemId: 101
      }
    ];

    (useReceipt as jest.Mock).mockReturnValue({
      ...defaultContext,
      receiptType: 'avulso',
      manualItems: [], // Initially empty
    });

    (useQuery as jest.Mock).mockReturnValue({ data: receiptItems });

    render(<ReceiptManualEntry />);

    await waitFor(() => {
      expect(mockSetManualItems).toHaveBeenCalled();
    });

    const expectedItems = [{
      code: 'CODE1',
      description: 'Received Item 1',
      unit: 'UN',
      quantity: 5,
      unitPrice: 10,
      ncm: '12345678',
      purchaseOrderItemId: 101,
      matchSource: 'auto',
      isReadOnly: true
    }];

    expect(mockSetManualItems).toHaveBeenCalledWith(expectedItems);
    
    // Also check total calculation
    expect(mockSetManualTotal).toHaveBeenCalledWith('50,00');
  });

  it('filters combobox items correctly for "produto" type', () => {
    const receiptItems = [
      {
        id: 1,
        purchaseOrderItemId: 101,
        description: 'Received Item 1',
        quantityReceived: 5,
        unit: 'UN'
      }
    ];

    (useReceipt as jest.Mock).mockReturnValue({
      ...defaultContext,
      receiptType: 'produto',
      manualItems: [{ 
        code: 'TEST', 
        description: 'Test Item', 
        quantity: 1, 
        purchaseOrderItemId: null 
      }],
    });

    (useQuery as jest.Mock).mockReturnValue({ data: receiptItems });

    render(<ReceiptManualEntry />);

    // Since we mocked Select as a native select, we can check options
    const select = screen.getByTestId('select-trigger');
    expect(select).toBeInTheDocument();
    
    const options = screen.getAllByRole('option');
    // Options: "Sem vínculo" + 1 receipt item
    // The PO item option should NOT be there if receiptItems are present (based on logic: receiptItems.length > 0 ? receiptItems.map... : purchaseOrderItems.map...)
    
    // Check if receipt item option is present
    expect(screen.getByText(/Received Item 1/)).toBeInTheDocument();
    expect(screen.getByText(/Recebido: 5/)).toBeInTheDocument();
    
    // PO Item description should NOT be present in the options list because receipt items take precedence
    expect(screen.queryByText(/PO Item 1/)).not.toBeInTheDocument();
  });

  it('validates quantity when linking item', async () => {
     const receiptItems = [
      {
        id: 1,
        purchaseOrderItemId: 101,
        description: 'Received Item 1',
        quantityReceived: 5,
        unit: 'UN'
      }
    ];
    
    // Mock manual items with quantity > received
    const manualItems = [{ 
      code: 'TEST', 
      description: 'Test Item', 
      quantity: 10, // > 5
      purchaseOrderItemId: null 
    }];

    const setManualItemsFn = jest.fn();

    (useReceipt as jest.Mock).mockReturnValue({
      ...defaultContext,
      receiptType: 'produto',
      manualItems: manualItems,
      setManualItems: setManualItemsFn,
    });

    (useQuery as jest.Mock).mockReturnValue({ data: receiptItems });
    
    // Mock toast
    const mockToast = jest.fn();
    const useToastMock = require('@/hooks/use-toast');
    useToastMock.useToast = () => ({ toast: mockToast });

    render(<ReceiptManualEntry />);

    const select = screen.getByTestId('select-trigger');
    
    // Select the item (value = purchaseOrderItemId = 101)
    fireEvent.change(select, { target: { value: '101' } });

    // Expect toast warning
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'Validação',
      description: expect.stringContaining('Quantidade informada (10) é maior que a recebida (5)'),
    }));
  });

  it('disables inputs for "avulso" type', () => {
    const manualItems = [{
      code: 'CODE1',
      description: 'Received Item 1',
      unit: 'UN',
      quantity: 5,
      unitPrice: 10,
      ncm: '12345678',
      purchaseOrderItemId: 101,
      matchSource: 'auto',
      isReadOnly: true
    }];

    (useReceipt as jest.Mock).mockReturnValue({
      ...defaultContext,
      receiptType: 'avulso',
      manualItems: manualItems,
    });

    render(<ReceiptManualEntry />);

    // Check if inputs are disabled
    const inputs = screen.getAllByRole('textbox'); // Inputs are usually textboxes
    // Filter specifically for item inputs if there are header inputs too
    // But we are in Step 2, so header inputs might not be rendered or might be different
    // Wait, step 2 renders header summary or just items? 
    // Looking at code: ReceiptManualEntry renders both cards, but Step 2 card is conditional.
    // Step 1 card is always rendered.
    
    // Let's look for item description input specifically
    const descriptionInput = screen.getByDisplayValue('Received Item 1');
    expect(descriptionInput).toBeDisabled();
    
    const quantityInput = screen.getByDisplayValue('5');
    expect(quantityInput).toBeDisabled();
  });
});
