import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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
  refetch: () => Promise<void>;
}

export function useApprovalType(totalValue?: number, requestId?: number): UseApprovalTypeReturn {
  const [data, setData] = useState<'single' | 'dual' | null>(null);
  const [approvalInfo, setApprovalInfo] = useState<ApprovalTypeInfo | null>(null);
  const [configuration, setConfiguration] = useState<ApprovalConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovalConfiguration = async () => {
    try {
      const response = await fetch('/api/approval-rules/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        // Se não há autenticação ou outro erro, não tenta fazer parse do JSON
        if (response.status === 401) {
          console.warn('Authentication required for approval configuration');
          return null;
        }
        throw new Error(`Failed to fetch approval configuration: ${response.status}`);
      }

      // Verifica se a resposta tem conteúdo antes de tentar fazer parse
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Response is not JSON format');
        return null;
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        console.warn('Empty response from approval configuration API');
        return null;
      }

      let config;
      try {
        config = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return null;
      }

      setConfiguration(config);
      
      // Determine approval type based on value and threshold
      if (totalValue !== undefined && config) {
        const threshold = parseFloat(config.valueThreshold) || 2500;
        const approvalType = determineApprovalType(totalValue, threshold);
        setData(approvalType);
      }
      
      return config;
    } catch (err) {
      console.error('Error fetching approval configuration:', err);
      // Não propaga o erro para evitar quebrar a aplicação
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  };

  const fetchApprovalInfo = async (requestId: number) => {
    try {
      const response = await fetch(`/api/approval-rules/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch approval info');
      }

      const info = await response.json();
      setApprovalInfo(info);
      return info;
    } catch (err) {
      console.error('Error fetching approval info:', err);
      throw err;
    }
  };

  const refetch = async () => {
    setLoading(true);
    setError(null);

    try {
      const promises = [fetchApprovalConfiguration()];
      if (requestId) {
        promises.push(fetchApprovalInfo(requestId));
      }
      await Promise.all(promises);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(`Erro ao carregar informações de aprovação: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [totalValue, requestId]);

  return {
    data,
    approvalInfo,
    configuration,
    loading,
    error,
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