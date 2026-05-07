import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ApprovalConfiguration {
  id: number;
  valueThreshold: string;
  isActive: boolean;
  effectiveDate: string;
  createdBy: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTypeInfo {
  requiresDualApproval: boolean;
  approvalType: 'single' | 'dual';
  valueThreshold: number;
  nextApprover?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    isCEO: boolean;
    isDirector: boolean;
  };
  approvalStep?: number;
  totalSteps?: number;
}

export interface UseApprovalTypeReturn {
  data: 'single' | 'dual' | null;
  approvalInfo: ApprovalTypeInfo | null;
  configuration: ApprovalConfiguration | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApprovalType(totalValue?: number, requestId?: number): UseApprovalTypeReturn {
  // Use React Query for configuration - shared across all components
  const { 
    data: configuration, 
    isLoading: configLoading, 
    error: configError,
    refetch: refetchConfig
  } = useQuery<ApprovalConfiguration>({
    queryKey: ['/api/approval-rules/config'],
    queryFn: () => apiRequest('/api/approval-rules/config'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use React Query for approval info if requestId is provided
  const { 
    data: approvalInfo, 
    isLoading: infoLoading, 
    error: infoError,
    refetch: refetchInfo
  } = useQuery<ApprovalTypeInfo>({
    queryKey: [`/api/approval-rules/${requestId}`],
    queryFn: () => apiRequest(`/api/approval-rules/${requestId}`),
    enabled: !!requestId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Determine approval type based on value and threshold
  const data = (totalValue !== undefined && configuration)
    ? determineApprovalType(totalValue, parseFloat(configuration.valueThreshold) || 2500)
    : null;

  const refetch = () => {
    refetchConfig();
    if (requestId) refetchInfo();
  };

  return {
    data,
    approvalInfo: approvalInfo || null,
    configuration: configuration || null,
    loading: configLoading || infoLoading,
    error: (configError || infoError) ? 'Failed to fetch approval information' : null,
    refetch,
  };
}

// Helper function to determine approval type based on value and threshold
export function determineApprovalType(
  totalValue: number,
  threshold: number
): 'single' | 'dual' {
  return totalValue > threshold ? 'dual' : 'single';
}

// Helper function to format approval type for display
export function formatApprovalType(approvalType: 'single' | 'dual'): string {
  return approvalType === 'single' ? 'APROVAÇÃO SIMPLES' : 'DUPLA APROVAÇÃO';
}

// Helper function to get approval type color
export function getApprovalTypeColor(approvalType: 'single' | 'dual'): string {
  return approvalType === 'single' ? 'green' : 'orange';
}

// Helper function to calculate total value from purchase request items
export function calculateTotalValue(items: Array<{ quantity: number; unitPrice: string }>): number {
  return items.reduce((total, item) => {
    const unitPrice = parseFloat(item.unitPrice) || 0;
    return total + (item.quantity * unitPrice);
  }, 0);
}