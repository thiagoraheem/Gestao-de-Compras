import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Save, 
  Search, 
  Filter,
  Download,
  History,
  ArrowLeft,
  Loader2,
  Eye,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

// Error boundary simples para prevenir quebra de UI
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }>{
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error('Erro na interface de integração de fornecedores:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTitle>Erro ao exibir os dados</AlertTitle>
          <AlertDescription>
            Ocorreu um problema ao renderizar a tabela de comparação. Tente recarregar a página.
          </AlertDescription>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

interface IntegrationItem {
  id: string;
  erp_supplier_id: string;
  supplier_data: {
    id: string;
    name: string;
    cnpj?: string;
    cpf?: string;
    email?: string;
    phone?: string;
    status: string;
  };
  comparison_result: string;
  action_required: 'create' | 'update' | 'ignore';
  local_supplier_id?: string;
  status: 'pending' | 'processed' | 'error';
  created_at: string;
}

interface IntegrationStats {
  total: number;
  pending: number;
  processed: number;
  created: number;
  updated: number;
  errors: number;
}

interface IntegrationProgress {
  currentStep: number;
  totalSteps: number;
  stepDescription: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}

interface OperationTimeout {
  duration: number;
  warningTime: number;
  timeoutMessage: string;
}

interface IntegrationHistory {
  id: string;
  integration_type: string;
  status: string;
  total_suppliers: number;
  created_suppliers: number;
  updated_suppliers: number;
  error_count: number;
  started_at: string;
  completed_at?: string;
  user_name?: string;
}

export default function SupplierIntegrationPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estado da integração atual
  const [currentIntegrationId, setCurrentIntegrationId] = useState<string | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<string>('idle');
  const [stats, setStats] = useState<IntegrationStats>({
    total: 0,
    pending: 0,
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0
  });
  
  // Estado de progresso detalhado
  const [progress, setProgress] = useState<IntegrationProgress>({
    currentStep: 0,
    totalSteps: 5,
    stepDescription: 'Aguardando início...',
    percentage: 0
  });
  
  // Configurações de timeout
  const [operationTimeout, setOperationTimeout] = useState<OperationTimeout>({
    duration: 300000, // 5 minutos
    warningTime: 240000, // 4 minutos (aviso)
    timeoutMessage: 'A operação está demorando mais que o esperado. Deseja continuar aguardando?'
  });
  
  // Controle de timeout e cancelamento
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [timeoutTimer, setTimeoutTimer] = useState<NodeJS.Timeout | null>(null);
  const [warningTimer, setWarningTimer] = useState<NodeJS.Timeout | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const operationStartTime = useRef<number>(0);
  const estimatedOperationTime = useRef<number>(0);
  
  // Timeout configuration
  const [timeoutConfig] = useState({
    integrationTimeout: 5 * 60 * 1000, // 5 minutes for integration
    processingTimeout: 3 * 60 * 1000, // 3 minutes for processing
    pollingInterval: 2000, // 2 seconds polling
    warningTime: 30 * 1000, // 30 seconds warning before timeout
    maxRetries: 3,
    retryDelay: 5000 // 5 seconds between retries
  });
  
  // Estado dos dados de comparação
  const [comparisonData, setComparisonData] = useState<IntegrationItem[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionFilter, setActionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Estado do histórico
  const [history, setHistory] = useState<IntegrationHistory[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<IntegrationHistory | null>(null);
  
  // Controle de polling
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  
  // Estado para controle de retry automático
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryMessage, setRetryMessage] = useState<string>('');
  const [maxRetries] = useState(3);
  
  // Diálogos
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState<IntegrationItem | null>(null);

  // Efeito para polling do status da integração
  useEffect(() => {
    if (currentIntegrationId && (integrationStatus === 'processing' || integrationStatus === 'started' || integrationStatus === 'retrying')) {
      const interval = setInterval(() => {
        checkIntegrationStatus();
      }, 3000);
      setPollingInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [currentIntegrationId, integrationStatus]);

  // Persistência no localStorage para manter informações visíveis entre navegações/refresh
  useEffect(() => {
    const savedIntegrationId = localStorage.getItem('supplier_integration_id');
    const savedStatus = localStorage.getItem('supplier_integration_status');
    if (savedIntegrationId && !currentIntegrationId) {
      setCurrentIntegrationId(savedIntegrationId);
      if (savedStatus) setIntegrationStatus(savedStatus);
      // Retomar acompanhamento se havia fluxo em andamento
      checkIntegrationStatus();
    }
  }, []);

  useEffect(() => {
    if (currentIntegrationId) {
      localStorage.setItem('supplier_integration_id', currentIntegrationId);
    } else {
      localStorage.removeItem('supplier_integration_id');
    }
  }, [currentIntegrationId]);

  useEffect(() => {
    if (integrationStatus) {
      localStorage.setItem('supplier_integration_status', integrationStatus);
    }
  }, [integrationStatus]);

  // Limpar polling e timers ao desmontar
  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (warningTimer) clearTimeout(warningTimer);
    };
  }, [pollingInterval, timeoutTimer, warningTimer]);

  // Buscar histórico inicial
  useEffect(() => {
    fetchHistory();
  }, [historyPage]);

  // Rebuscar dados de comparação quando filtros/página mudarem enquanto em 'prepared' ou 'processing'
  useEffect(() => {
    if (!currentIntegrationId) return;
    if (!['prepared', 'processing'].includes(integrationStatus)) return;
    fetchComparisonData();
  }, [currentIntegrationId, integrationStatus, currentPage, itemsPerPage, statusFilter, actionFilter, searchTerm]);

  const startTimeoutMonitoring = (operationType: 'integration' | 'processing' = 'integration') => {
    // Limpar timers existentes
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (warningTimer) clearTimeout(warningTimer);
    
    operationStartTime.current = Date.now();
    const timeoutDuration = operationType === 'processing' ? timeoutConfig.processingTimeout : timeoutConfig.integrationTimeout;
    estimatedOperationTime.current = timeoutDuration;
    
    // Timer de aviso (30 segundos antes do timeout)
    const warningTimeout = setTimeout(() => {
      setTimeoutWarning(true);
    }, timeoutDuration - timeoutConfig.warningTime);
    setWarningTimer(warningTimeout);
    
    // Timer de timeout total
    const totalTimeout = setTimeout(() => {
      handleTimeout();
    }, timeoutDuration);
    setTimeoutTimer(totalTimeout);
  };

  const stopTimeoutMonitoring = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      setTimeoutTimer(null);
    }
    if (warningTimer) {
      clearTimeout(warningTimer);
      setWarningTimer(null);
    }
    setTimeoutWarning(false);
    
    // Reset retry states when stopping timeout monitoring
    if (integrationStatus !== 'retrying') {
      setAutoRetryCount(0);
      setRetryCount(0);
      setRetryMessage('');
    }
  };

  const handleTimeout = () => {
    const elapsedTime = Date.now() - operationStartTime.current;
    const estimatedRemaining = Math.max(0, estimatedOperationTime.current - elapsedTime);
    
    stopTimeoutMonitoring();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    // Tentar retry automático se ainda não atingiu o limite
    if (autoRetryCount < timeoutConfig.maxRetries) {
      handleAutoRetry();
      return;
    }
    
    setError(`A operação excedeu o tempo limite de ${Math.round(estimatedOperationTime.current / 1000)} segundos após ${timeoutConfig.maxRetries} tentativas. Por favor, tente novamente mais tarde.`);
    setIntegrationStatus('timeout');
    setProgress(prev => ({
      ...prev,
      stepDescription: `Operação cancelada devido ao timeout (${Math.round(elapsedTime / 1000)}s)`
    }));
  };
  
  const handleAutoRetry = () => {
    if (autoRetryCount >= timeoutConfig.maxRetries) {
      return;
    }
    
    const newRetryCount = autoRetryCount + 1;
    setAutoRetryCount(newRetryCount);
    setRetryCount(newRetryCount);
    setLastRetryTime(new Date());
    
    // Limpar estado de erro e continuar
    setError(null);
    setIntegrationStatus('retrying');
    setRetryMessage(`Tentando restabelecer conexão com o servidor...`);
    setProgress(prev => ({
      ...prev,
      stepDescription: `Tentando reconectar... (Tentativa ${newRetryCount} de ${timeoutConfig.maxRetries})`
    }));
    
    // Reiniciar monitoramento com tempo adicional
    const additionalTime = 2 * 60 * 1000; // 2 minutos adicionais por retry
    estimatedOperationTime.current += additionalTime;
    
    // Aguardar um tempo antes de tentar novamente
    setTimeout(() => {
      if (currentIntegrationId) {
        checkIntegrationStatus();
        startTimeoutMonitoring('integration');
      }
    }, timeoutConfig.retryDelay);
  };

  const handleContinueOperation = () => {
    setTimeoutWarning(false);
    // Estender o timeout por mais 3 minutos
    const additionalTime = 3 * 60 * 1000;
    estimatedOperationTime.current += additionalTime;
    
    stopTimeoutMonitoring();
    
    // Timer de aviso (30 segundos antes do novo timeout)
    const warningTimeout = setTimeout(() => {
      setTimeoutWarning(true);
    }, additionalTime - timeoutConfig.warningTime);
    setWarningTimer(warningTimeout);
    
    // Timer de timeout total adicional
    const totalTimeout = setTimeout(() => {
      handleTimeout();
    }, additionalTime);
    setTimeoutTimer(totalTimeout);
  };

  const handleCancelOperation = async () => {
    if (!currentIntegrationId) return;
    
    setIsCancelling(true);
    stopTimeoutMonitoring();
    
    try {
      await apiRequest(`/api/erp-integration/suppliers/cancel/${currentIntegrationId}`, {
        method: 'POST'
      });
      
      setIntegrationStatus('cancelled');
      setSuccess('Operação cancelada com sucesso.');
      // Limpar persistência
      localStorage.removeItem('supplier_integration_id');
      localStorage.setItem('supplier_integration_status', 'cancelled');
      
      // Limpar estado de retry
      setAutoRetryCount(0);
      setRetryCount(0);
      setRetryMessage('');
      
      // Limpar estado
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      
    } catch (error: any) {
      console.error('Error cancelling operation:', error);
      setError('Erro ao cancelar operação. A operação pode continuar em segundo plano.');
    } finally {
      setIsCancelling(false);
    }
  };

  const updateProgress = (status: string, stats?: IntegrationStats) => {
    const progressMap: Record<string, IntegrationProgress> = {
      'started': {
        currentStep: 1,
        totalSteps: 5,
        stepDescription: 'Conectando ao servidor ERP...',
        percentage: 20
      },
      'fetching': {
        currentStep: 2,
        totalSteps: 5,
        stepDescription: 'Buscando fornecedores do ERP...',
        percentage: 40
      },
      'comparing': {
        currentStep: 3,
        totalSteps: 5,
        stepDescription: 'Comparando fornecedores com base local...',
        percentage: 60
      },
      'prepared': {
        currentStep: 3,
        totalSteps: 5,
        stepDescription: 'Resultados prontos. Selecione e processe os fornecedores...',
        percentage: 60
      },
      'processing': {
        currentStep: 4,
        totalSteps: 5,
        stepDescription: 'Processando fornecedores selecionados...',
        percentage: 80
      },
      'completed': {
        currentStep: 5,
        totalSteps: 5,
        stepDescription: 'Integração concluída com sucesso!',
        percentage: 100
      },
      'error': {
        currentStep: 0,
        totalSteps: 5,
        stepDescription: 'Erro durante a integração',
        percentage: 0
      }
    };

    const newProgress = progressMap[status] || progress.started;
    
    // Atualizar com estatísticas se disponíveis
    if (stats && status === 'processing') {
      const processedPercentage = stats.total > 0 ? (stats.processed / stats.total) * 100 : 0;
      newProgress.percentage = 60 + (processedPercentage * 0.2); // 60% a 80%
      newProgress.stepDescription = `Processando fornecedores... ${stats.processed} de ${stats.total} concluídos`;
    }
    
    setProgress(newProgress);
  };

  const checkIntegrationStatus = async () => {
    if (!currentIntegrationId) return;
    
    try {
      setLastActivity(new Date());
      const response = await apiRequest(`/api/erp-integration/suppliers/status/${currentIntegrationId}`);
      
      setIntegrationStatus(response.integration.status);
      setStats(response.stats);
      
      // Atualizar progresso
      updateProgress(response.integration.status, response.stats);

      // Enquanto houver dados prontos ou sendo processados, garantir que a comparação seja exibida
      if (['prepared', 'processing'].includes(response.integration.status)) {
        await fetchComparisonData();
      }
      
      // Tratar estados finais: completed, error, cancelled, timeout
      if (['completed', 'error', 'cancelled', 'timeout'].includes(response.integration.status)) {
        stopTimeoutMonitoring();
        
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        if (response.integration.status === 'completed') {
          setSuccess('Integração concluída com sucesso!');
        } else if (response.integration.status === 'cancelled') {
          setSuccess('Operação cancelada com sucesso.');
        } else if (response.integration.status === 'timeout') {
          setError('Operação expirada por timeout. Tente novamente mais tarde.');
        } else {
          setError('Erro durante a integração. Verifique os logs para mais detalhes.');
        }
        
        // Após conclusão/erro, recarregar comparação e histórico
        await fetchComparisonData();
        await fetchHistory();
      }
    } catch (error: any) {
      console.error('Error checking integration status:', error);
      setError('Erro ao verificar status da integração. Verificando novamente...');
    }
  };

  const fetchComparisonData = async () => {
    if (!currentIntegrationId) return;
    
    try {
      setComparisonLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        status: String(statusFilter),
        action_type: String(actionFilter),
        search: String(searchTerm || '')
      });
      const response = await apiRequest(`/api/erp-integration/suppliers/comparison/${currentIntegrationId}?${params.toString()}`);
      
      setComparisonData(Array.isArray(response.items) ? response.items : []);
      
      // Atualizar seleção baseada nos novos dados
      const newSelected = new Set<string>();
      response.items.forEach((item: IntegrationItem) => {
        if (item.status === 'pending' && selectedItems.has(item.erp_supplier_id)) {
          newSelected.add(item.erp_supplier_id);
        }
      });
      setSelectedItems(newSelected);
      
    } catch (error: any) {
      console.error('Error fetching comparison data:', error);
      setError(error?.message || 'Erro ao carregar dados de comparação');
    } finally {
      setComparisonLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        limit: String(10)
      });
      const response = await apiRequest(`/api/erp-integration/history?${params.toString()}`);
      
      setHistory(response.data);
      setHistoryTotal(response.pagination.total);
    } catch (error: any) {
      console.error('Error fetching history:', error);
    }
  };

  const handleStartIntegration = async (type: 'full' | 'incremental') => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    // Resetar estado de progresso
    setProgress({
      currentStep: 0,
      totalSteps: 5,
      stepDescription: 'Iniciando integração...',
      percentage: 0
    });
    
    try {
      const response = await apiRequest('/api/erp-integration/suppliers/fetch', {
        method: 'POST',
        body: {
          sync_type: type,
          filters: {}
        }
      });
      
      setCurrentIntegrationId(response.integration_id);
      setIntegrationStatus('started');
      setSuccess('Integração iniciada. Conectando ao servidor ERP...');
      // Persistir imediatamente
      localStorage.setItem('supplier_integration_id', response.integration_id);
      localStorage.setItem('supplier_integration_status', 'started');
      
      // Iniciar monitoramento de timeout
      startTimeoutMonitoring();
      
      // Atualizar progresso
      updateProgress('started');
      
      // Iniciar polling
      checkIntegrationStatus();
      
    } catch (error: any) {
      setError(error?.message || 'Erro ao iniciar integração');
      stopTimeoutMonitoring();
    } finally {
      setLoading(false);
    }
  };

  const handleProcessIntegration = async () => {
    if (selectedItems.size === 0) {
      setError('Selecione pelo menos um fornecedor para processar');
      return;
    }
    
    setShowConfirmDialog(true);
  };

  const confirmProcessIntegration = async () => {
    if (!currentIntegrationId) return;
    
    setProcessing(true);
    setShowConfirmDialog(false);
    setError(null);
    
    // Atualizar progresso para processamento
    updateProgress('processing', stats);
    
    try {
      const response = await apiRequest('/api/erp-integration/suppliers/process', {
        method: 'POST',
        body: {
          integration_id: currentIntegrationId,
          selected_suppliers: Array.from(selectedItems),
          operation_type: 'both'
        }
      });
      
      setIntegrationStatus('processing');
      setSuccess('Processamento iniciado. Aplicando mudanças nos fornecedores...');
      
      // Limpar seleção
      setSelectedItems(new Set());
      
      // Reiniciar monitoramento de timeout para processamento
      stopTimeoutMonitoring();
      startTimeoutMonitoring();
      
      // Iniciar polling
      checkIntegrationStatus();
      
    } catch (error: any) {
      setError(error?.message || 'Erro ao processar integração');
      stopTimeoutMonitoring();
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectAll = () => {
    const pendingItems = comparisonData.filter(item => item.status === 'pending');
    if (selectedItems.size === pendingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map(item => item.erp_supplier_id)));
    }
  };

  const handleSelectItem = (supplierId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(supplierId)) {
      newSelected.delete(supplierId);
    } else {
      newSelected.add(supplierId);
    }
    setSelectedItems(newSelected);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <Badge className="bg-green-100 text-green-800">Novo</Badge>;
      case 'update':
        return <Badge className="bg-blue-100 text-blue-800">Atualizar</Badge>;
      case 'ignore':
        return <Badge className="bg-gray-100 text-gray-800">Ignorar</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'processed':
        return <Badge className="bg-green-100 text-green-800">Processado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredData = comparisonData.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.supplier_data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier_data.cnpj?.includes(searchTerm) ||
      item.supplier_data.cpf?.includes(searchTerm);
    
    const matchesAction = actionFilter === 'all' || item.action_required === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/suppliers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Integração de Fornecedores com ERP</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistoryDialog(true)}>
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Button>
        </div>
      </div>

      {/* Enhanced Status Card */}
       {currentIntegrationId && (
         <Card>
           <CardHeader>
             <CardTitle>Status da Integração</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <span>ID da Integração:</span>
                 <Badge variant="outline" className="font-mono text-xs">{currentIntegrationId}</Badge>
               </div>
               
               <div className="flex items-center justify-between">
                 <span>Status:</span>
                 <div className="flex items-center space-x-2">
                   <Badge className={
                     integrationStatus === 'completed' ? 'bg-green-100 text-green-800' :
                     integrationStatus === 'error' ? 'bg-red-100 text-red-800' :
                     integrationStatus === 'timeout' ? 'bg-red-100 text-red-800' :
                     integrationStatus === 'cancelled' ? 'bg-orange-100 text-orange-800' :
                     integrationStatus === 'retrying' ? 'bg-purple-100 text-purple-800' :
                     integrationStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                     'bg-yellow-100 text-yellow-800'
                   }>
                     {integrationStatus === 'completed' && 'Concluída'}
                     {integrationStatus === 'error' && 'Erro'}
                     {integrationStatus === 'timeout' && 'Timeout'}
                     {integrationStatus === 'cancelled' && 'Cancelada'}
                     {integrationStatus === 'retrying' && 'Tentando Reconectar'}
                     {integrationStatus === 'processing' && 'Processando'}
                     {integrationStatus === 'started' && 'Iniciada'}
                     {integrationStatus === 'prepared' && 'Preparada'}
                     {integrationStatus === 'fetching' && 'Buscando Dados'}
                     {integrationStatus === 'comparing' && 'Comparando'}
                   </Badge>
                   
                   {(integrationStatus === 'processing' || integrationStatus === 'started' || integrationStatus === 'fetching' || integrationStatus === 'comparing' || integrationStatus === 'retrying') && (
                     <Loader2 className={`h-4 w-4 animate-spin ${
                       integrationStatus === 'retrying' ? 'text-purple-600' : 'text-blue-600'
                     }`} />
                   )}
                 </div>
               </div>
               
               {/* Barra de Progresso Aprimorada */}
               {(integrationStatus === 'processing' || integrationStatus === 'started' || integrationStatus === 'fetching' || integrationStatus === 'comparing') && (
                 <div className="space-y-2">
                   <div className="flex justify-between text-sm text-gray-600">
                     <span>{progress.stepDescription}</span>
                     <span>{progress.percentage.toFixed(0)}%</span>
                   </div>
                   <Progress value={progress.percentage} className="w-full h-2" />
                   <div className="flex justify-between text-xs text-gray-500">
                     <span>Etapa {progress.currentStep} de {progress.totalSteps}</span>
                     <span>Última atividade: {lastActivity.toLocaleTimeString('pt-BR')}</span>
                   </div>
                 </div>
               )}
               
               {/* Botão de Cancelar */}
               {(integrationStatus === 'processing' || integrationStatus === 'started' || integrationStatus === 'fetching' || integrationStatus === 'comparing' || integrationStatus === 'retrying') && (
                 <div className="flex justify-end">
                   <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={handleCancelOperation}
                     disabled={isCancelling}
                     className={`${
                       integrationStatus === 'retrying' 
                         ? 'text-purple-600 border-purple-300 hover:bg-purple-50' 
                         : 'text-red-600 border-red-300 hover:bg-red-50'
                     }`}
                   >
                     {isCancelling ? (
                       <>
                         <Loader2 className={`h-4 w-4 mr-2 animate-spin ${
                           integrationStatus === 'retrying' ? 'text-purple-600' : ''
                         }`} />
                         Cancelando...
                       </>
                     ) : (
                       <>
                         <XCircle className="h-4 w-4 mr-2" />
                         Cancelar Operação
                       </>
                     )}
                   </Button>
                 </div>
               )}
               
               <div className="grid grid-cols-3 gap-4 text-center">
                 <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                   <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                   <div className="text-sm text-gray-600">Total</div>
                 </div>
                 <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                   <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                   <div className="text-sm text-gray-600">Pendentes</div>
                 </div>
                 <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                   <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
                   <div className="text-sm text-gray-600">Processados</div>
                 </div>
               </div>
               
               {/* Detalhes adicionais quando processando */}
               {(integrationStatus === 'processing' || integrationStatus === 'started') && stats.total > 0 && (
                 <div className="bg-gray-50 p-3 rounded-lg">
                   <div className="text-sm text-gray-600 space-y-1">
                     <div className="flex justify-between">
                       <span>Criados:</span>
                       <span className="font-medium text-green-600">{stats.created}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Atualizados:</span>
                       <span className="font-medium text-blue-600">{stats.updated}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Erros:</span>
                       <span className="font-medium text-red-600">{stats.errors}</span>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       )}
       
       {/* Enhanced Loading States */}
       {(loading || processing || integrationStatus === 'fetching' || integrationStatus === 'comparing' || integrationStatus === 'retrying') && (
         <Card>
           <CardHeader>
             <CardTitle>
               {loading ? 'Iniciando Integração' : 
                processing ? 'Processando Fornecedores' :
                integrationStatus === 'fetching' ? 'Buscando Dados' :
                integrationStatus === 'comparing' ? 'Comparando Dados' :
                integrationStatus === 'retrying' ? 'Reconectando ao Servidor' : 'Processando'}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="space-y-4">
               {/* Progress Bar */}
               <div className="w-full bg-gray-200 rounded-full h-2">
                 <div 
                   className={`h-2 rounded-full transition-all duration-300 ease-out ${
                     integrationStatus === 'retrying' ? 'bg-purple-600' : 'bg-blue-600'
                   }`}
                   style={{ width: `${progress.percentage}%` }}
                 ></div>
               </div>
               
               {/* Progress Details */}
               <div className={`flex justify-between text-sm ${
                 integrationStatus === 'retrying' ? 'text-purple-700' : 'text-gray-600'
               }`}>
                 <span>{progress.stepDescription}</span>
                 <span>{progress.percentage.toFixed(0)}% completo</span>
               </div>
               
               {/* Step Counter */}
               <div className="flex items-center justify-center py-4">
                 <div className="text-center">
                   <Loader2 className={`h-12 w-12 animate-spin mx-auto mb-4 ${
                     integrationStatus === 'retrying' ? 'text-purple-600' : 'text-blue-600'
                   }`} />
                   <div className="flex items-center justify-center space-x-2 mb-2">
                     <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                       integrationStatus === 'retrying' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                     }`}>
                       Etapa {progress.currentStep} de {progress.totalSteps}
                     </span>
                   </div>
                   <p className={`font-medium ${
                     integrationStatus === 'retrying' ? 'text-purple-700' : 'text-gray-600'
                   }`}>
                     {loading ? 'Conectando ao sistema de fornecedores...' : 
                      processing ? 'Processando fornecedores selecionados...' :
                      integrationStatus === 'fetching' ? 'Buscando dados dos fornecedores...' :
                      integrationStatus === 'comparing' ? 'Comparando e analisando dados...' :
                      integrationStatus === 'retrying' ? 'Tentando reconectar ao servidor...' : 'Processando...'}
                   </p>
                   <p className="text-sm text-gray-500 mt-2">
                     Por favor, aguarde enquanto a operação é concluída.
                   </p>
                   {lastActivity && (
                     <p className="text-xs text-gray-400 mt-1">
                       Última atividade: {lastActivity.toLocaleTimeString('pt-BR')}
                     </p>
                   )}
                 </div>
               </div>
               
               {/* Retry Status */}
               {integrationStatus === 'retrying' && retryCount > 0 && (
                 <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                   <div className="flex items-center space-x-2 mb-2">
                     <AlertCircle className="h-4 w-4 text-purple-600" />
                     <h4 className="text-sm font-medium text-purple-800">
                       Tentativa de Reconexão {retryCount} de {maxRetries}
                     </h4>
                   </div>
                   <div className="text-sm text-purple-700 mb-2">
                     {retryMessage}
                   </div>
                   <div className="text-xs text-purple-600">
                     Tempo desde a última resposta: {Math.round((Date.now() - (lastActivity || operationStartTime.current)) / 1000)}s
                   </div>
                 </div>
               )}
               
               {/* Operation Statistics */}
               {(stats.pending > 0 || stats.created > 0 || stats.updated > 0 || stats.errors > 0) && (
                 <div className="bg-gray-50 p-3 rounded-lg">
                   <h4 className="text-sm font-medium text-gray-700 mb-2">Progresso da Operação</h4>
                   <div className="grid grid-cols-2 gap-2 text-sm">
                     <div className="flex justify-between">
                       <span className="text-gray-600">Pendentes:</span>
                       <span className="font-medium text-orange-600">{stats.pending}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Criados:</span>
                       <span className="font-medium text-green-600">{stats.created}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Atualizados:</span>
                       <span className="font-medium text-blue-600">{stats.updated}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Erros:</span>
                       <span className="font-medium text-red-600">{stats.errors}</span>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       )}

      {/* Enhanced Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Sucesso</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      {/* Enhanced Timeout Warning Alert */}
      {timeoutWarning && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle>
            {autoRetryCount > 0 ? `Tentativa ${autoRetryCount + 1} de ${timeoutConfig.maxRetries}` : 'Operação Demorando'}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Tempo decorrido:</span>
                <span className="font-medium">{Math.round((Date.now() - operationStartTime.current) / 1000)}s</span>
              </div>
              {autoRetryCount > 0 && lastRetryTime && (
                <div className="flex justify-between text-sm">
                  <span>Última tentativa:</span>
                  <span className="font-medium">{lastRetryTime.toLocaleTimeString()}</span>
                </div>
              )}
              <p>
                {autoRetryCount > 0 ? 
                  'Tentando reconectar automaticamente...' :
                  operationTimeout.timeoutMessage
                }
              </p>
              <div className="bg-orange-100 p-3 rounded-md">
                <p className="text-orange-800 text-sm">
                  <strong>Possíveis causas:</strong>
                </p>
                <ul className="text-orange-700 text-sm mt-1 list-disc list-inside">
                  <li>Grande volume de dados para processar</li>
                  <li>Conexão lenta com o servidor</li>
                  <li>Sistema de origem sobrecarregado</li>
                </ul>
                {autoRetryCount > 0 && (
                  <p className="text-orange-600 text-xs mt-2">
                    <strong>Retry automático:</strong> Tentativa {autoRetryCount} de {timeoutConfig.maxRetries}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  onClick={handleContinueOperation}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Continuar Aguardando (3 min)
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancelOperation}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Cancelar Operação'
                  )}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Ações de Integração</CardTitle>
          <p className="text-sm text-gray-600">
            Escolha o tipo de integração e gerencie o processo de sincronização de fornecedores
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleStartIntegration('full')}
              disabled={loading || processing || (integrationStatus === 'processing') || (integrationStatus === 'started') || (integrationStatus === 'fetching') || (integrationStatus === 'comparing') || (integrationStatus === 'retrying')}
              className="bg-blue-600 hover:bg-blue-700 min-w-[180px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Integração Completa
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => handleStartIntegration('incremental')}
              disabled={loading || processing || (integrationStatus === 'processing') || (integrationStatus === 'started') || (integrationStatus === 'fetching') || (integrationStatus === 'comparing') || (integrationStatus === 'retrying')}
              variant="outline"
              className="min-w-[180px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Integração Incremental
                </>
              )}
            </Button>
            
            {currentIntegrationId && stats.pending > 0 && (
              <Button 
                onClick={handleProcessIntegration}
                disabled={processing || selectedItems.size === 0 || (integrationStatus === 'processing') || (integrationStatus === 'retrying')}
                className="bg-green-600 hover:bg-green-700 min-w-[180px]"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Processar Selecionados ({selectedItems.size})
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Status de operação em andamento */}
          {(integrationStatus === 'processing' || integrationStatus === 'started' || integrationStatus === 'fetching' || integrationStatus === 'comparing') && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <Loader2 className="h-5 w-5 animate-spin mr-3 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">
                    Operação em andamento
                  </p>
                  <p className="text-sm text-blue-600">
                    {progress.stepDescription} - {progress.percentage.toFixed(0)}% completo
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <ErrorBoundary>
        {currentIntegrationId && (integrationStatus === 'prepared' || integrationStatus === 'processing') && (
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar fornecedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Ações</SelectItem>
                    <SelectItem value="create">Novos</SelectItem>
                    <SelectItem value="update">Atualizações</SelectItem>
                    <SelectItem value="ignore">Ignorados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </ErrorBoundary>

      {/* Enhanced Tabela de Comparação */}
      <ErrorBoundary>
        {currentIntegrationId && (integrationStatus === 'prepared' || integrationStatus === 'processing') && (
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fornecedores para Processar</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredData.length} fornecedores encontrados ({selectedItems.size} selecionados)
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoryDialog(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadComparisonReport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Buscar fornecedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processed">Processado</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="create">Criar</SelectItem>
                    <SelectItem value="update">Atualizar</SelectItem>
                    <SelectItem value="ignore">Ignorar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Enhanced Loading State for Table */}
              {(integrationStatus === 'fetching' || integrationStatus === 'comparing' || comparisonLoading) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
                      <h3 className="text-lg font-medium text-blue-900 mb-2">
                        {comparisonLoading
                          ? 'Carregando resultados de comparação'
                          : integrationStatus === 'fetching'
                            ? 'Buscando Dados dos Fornecedores'
                            : 'Comparando e Analisando Dados'}
                      </h3>
                      <p className="text-blue-700 text-sm mb-3">
                        {comparisonLoading
                          ? 'Aguarde enquanto aplicamos seus filtros e carregamos os dados.'
                          : integrationStatus === 'fetching' 
                            ? 'Estamos buscando as informações dos fornecedores no sistema ERP...'
                            : 'Estamos comparando os dados dos fornecedores com o sistema local...'}
                      </p>
                      <div className="bg-blue-100 p-3 rounded-md">
                        <div className="flex justify-between text-sm text-blue-800 mb-2">
                          <span>Progresso:</span>
                          <span>{progress.percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-blue-600 mt-1">
                          <span>Etapa {progress.currentStep} de {progress.totalSteps}</span>
                          <span>{progress.stepDescription}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {integrationStatus === 'prepared' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-green-900 mb-2">Resultados de comparação prontos</h3>
                      <p className="text-green-700 text-sm mb-3">
                        Selecione os fornecedores a serem processados e clique em "Processar Selecionados".
                      </p>
                      <div className="bg-green-100 p-3 rounded-md">
                        <div className="flex justify-between text-sm text-green-800 mb-2">
                          <span>Progresso:</span>
                          <span>{progress.percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-green-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-green-600 mt-1">
                          <span>Etapa {progress.currentStep} de {progress.totalSteps}</span>
                          <span>{progress.stepDescription}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tabela */}
              {integrationStatus !== 'fetching' && integrationStatus !== 'comparing' && !comparisonLoading && (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedItems.size > 0 && selectedItems.size === filteredData.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>CNPJ/CPF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Comparação</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.has(item.erp_supplier_id)}
                              onCheckedChange={() => handleSelectItem(item.erp_supplier_id)}
                              disabled={item.status === 'processed'}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.supplier_data.name}</div>
                              <div className="text-sm text-gray-500">{item.supplier_data.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.supplier_data.cnpj || item.supplier_data.cpf || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              item.status === 'processed' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {item.status === 'pending' && 'Pendente'}
                              {item.status === 'processed' && 'Processado'}
                              {item.status === 'error' && 'Erro'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              item.action_required === 'create' ? 'bg-blue-100 text-blue-800' :
                              item.action_required === 'update' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {item.action_required === 'create' && 'Criar'}
                              {item.action_required === 'update' && 'Atualizar'}
                              {item.action_required === 'ignore' && 'Ignorar'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              item.comparison_result === 'new' ? 'bg-green-100 text-green-800' :
                              item.comparison_result === 'updated' ? 'bg-blue-100 text-blue-800' :
                              item.comparison_result === 'identical' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {item.comparison_result === 'new' && 'Novo'}
                              {item.comparison_result === 'updated' && 'Atualizado'}
                              {item.comparison_result === 'identical' && 'Idêntico'}
                              {item.comparison_result === 'error' && 'Erro'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedItemDetails(item);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
              
              {/* Empty State */}
              {integrationStatus !== 'fetching' && integrationStatus !== 'comparing' && !comparisonLoading && filteredData.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-500">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Nenhum fornecedor encontrado</h3>
                    <p className="text-sm">
                      {searchTerm ? 'Tente ajustar seus filtros de busca' : 'Nenhum dado disponível no momento'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Paginação */}
              {totalPages > 1 && integrationStatus !== 'fetching' && integrationStatus !== 'comparing' && !comparisonLoading && (
                <div className="flex justify-center mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}
      </ErrorBoundary>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Processamento</DialogTitle>
            <DialogDescription>
              Você está prestes a processar {selectedItems.size} fornecedor(es). 
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Criar novos fornecedores no sistema</li>
                <li>Atualizar IDs do ERP para fornecedores existentes</li>
                <li>Registrar todas as operações no histórico</li>
              </ul>
              Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmProcessIntegration} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Histórico de Integrações</DialogTitle>
            <DialogDescription>
              Visualize todas as integrações realizadas anteriormente
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fornecedores</TableHead>
                  <TableHead>Criados</TableHead>
                  <TableHead>Atualizados</TableHead>
                  <TableHead>Erros</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {item.integration_type === 'full' ? 'Completa' : 'Incremental'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        item.status === 'completed' ? 'bg-green-100 text-green-800' :
                        item.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {item.status === 'completed' && 'Concluída'}
                        {item.status === 'error' && 'Erro'}
                        {item.status === 'processing' && 'Processando'}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.total_suppliers}</TableCell>
                    <TableCell>{item.created_suppliers}</TableCell>
                    <TableCell>{item.updated_suppliers}</TableCell>
                    <TableCell>{item.error_count}</TableCell>
                    <TableCell>{new Date(item.started_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{item.user_name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Fornecedor</DialogTitle>
          </DialogHeader>
          {selectedItemDetails && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nome</label>
                  <p className="text-sm">{selectedItemDetails.supplier_data.name}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">ID ERP</label>
                  <p className="text-sm">{selectedItemDetails.erp_supplier_id}</p>
                </div>
                
                {selectedItemDetails.supplier_data.cnpj && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">CNPJ</label>
                    <p className="text-sm">{selectedItemDetails.supplier_data.cnpj}</p>
                  </div>
                )}
                
                {selectedItemDetails.supplier_data.cpf && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">CPF</label>
                    <p className="text-sm">{selectedItemDetails.supplier_data.cpf}</p>
                  </div>
                )}
                
                {selectedItemDetails.supplier_data.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <p className="text-sm">{selectedItemDetails.supplier_data.email}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Status no ERP</label>
                  <p className="text-sm">
                    <Badge className={
                      selectedItemDetails.supplier_data.status === 'active' ? 
                      'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }>
                      {selectedItemDetails.supplier_data.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Ação Requerida</label>
                  <p className="text-sm">{getActionBadge(selectedItemDetails.action_required)}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="text-sm">{getStatusBadge(selectedItemDetails.status)}</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}