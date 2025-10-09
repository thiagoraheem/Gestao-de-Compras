import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ApprovalStep {
  id: number;
  step: number;
  approverType: string;
  approverId?: number;
  approverName?: string;
  approverEmail?: string;
  approved?: boolean;
  rejectionReason?: string;
  createdAt?: string;
  status: 'pending' | 'approved' | 'rejected' | 'current';
  isCEO?: boolean;
  isDirector?: boolean;
}

export interface ApprovalTimelineProps {
  steps: ApprovalStep[];
  currentStep: number;
  totalSteps: number;
  approvalType: 'single' | 'dual';
  className?: string;
  compact?: boolean;
}

export function ApprovalTimeline({
  steps,
  currentStep,
  totalSteps,
  approvalType,
  className,
  compact = false
}: ApprovalTimelineProps) {
  const getStepIcon = (step: ApprovalStep) => {
    switch (step.status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'current':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepStatus = (step: ApprovalStep) => {
    switch (step.status) {
      case 'approved':
        return 'Aprovado';
      case 'rejected':
        return 'Rejeitado';
      case 'current':
        return 'Aguardando';
      default:
        return 'Pendente';
    }
  };

  const getStepColor = (step: ApprovalStep) => {
    switch (step.status) {
      case 'approved':
        return 'border-green-200 bg-green-50';
      case 'rejected':
        return 'border-red-200 bg-red-50';
      case 'current':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getApproverRole = (step: ApprovalStep) => {
    if (step.isCEO) return 'CEO';
    if (step.isDirector) return 'Diretor';
    return 'Aprovador A2';
  };

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Progresso da Aprovação
          </span>
          <Badge variant="outline" className="text-xs">
            {currentStep}/{totalSteps}
          </Badge>
        </div>
        
        <div className="flex space-x-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'flex-1 h-2 rounded-full transition-colors',
                step.status === 'approved' ? 'bg-green-500' :
                step.status === 'rejected' ? 'bg-red-500' :
                step.status === 'current' ? 'bg-orange-500' :
                'bg-gray-200'
              )}
            />
          ))}
        </div>
        
        <div className="flex justify-between text-xs text-gray-500">
          {steps.map((step, index) => (
            <span key={step.id} className="text-center">
              {getApproverRole(step)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg font-semibold">Timeline de Aprovação</span>
          <Badge 
            variant="outline" 
            className={cn(
              approvalType === 'single' 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : 'bg-orange-100 text-orange-800 border-orange-200'
            )}
          >
            {approvalType === 'single' ? 'APROVAÇÃO SIMPLES' : 'DUPLA APROVAÇÃO'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'relative flex items-start space-x-4 p-4 rounded-lg border transition-colors',
                getStepColor(step)
              )}
            >
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-300" />
              )}
              
              {/* Step icon */}
              <div className="flex-shrink-0 mt-1">
                {getStepIcon(step)}
              </div>
              
              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">
                      Etapa {step.step}: {getApproverRole(step)}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs',
                        step.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                        step.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                        step.status === 'current' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      )}
                    >
                      {getStepStatus(step)}
                    </Badge>
                  </div>
                </div>
                
                {/* Approver info */}
                {step.approverName && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                    <User className="w-4 h-4" />
                    <span>{step.approverName}</span>
                    {step.approverEmail && (
                      <span className="text-gray-500">({step.approverEmail})</span>
                    )}
                  </div>
                )}
                
                {/* Date info */}
                {step.createdAt && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(new Date(step.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                        locale: ptBR
                      })}
                    </span>
                  </div>
                )}
                
                {/* Rejection reason */}
                {step.status === 'rejected' && step.rejectionReason && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      <strong>Motivo da rejeição:</strong> {step.rejectionReason}
                    </p>
                  </div>
                )}
                
                {/* Current step info */}
                {step.status === 'current' && (
                  <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <p className="text-sm text-orange-800">
                      Aguardando aprovação deste aprovador
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Progresso: {currentStep} de {totalSteps} etapas
            </span>
            <div className="flex space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-gray-600">Aprovado</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span className="text-gray-600">Em andamento</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-300 rounded-full" />
                <span className="text-gray-600">Pendente</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Simplified timeline for inline display
export function InlineApprovalTimeline({
  steps,
  currentStep,
  totalSteps,
  className
}: {
  steps: ApprovalStep[];
  currentStep: number;
  totalSteps: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
              step.status === 'approved' 
                ? 'bg-green-500 border-green-500 text-white'
                : step.status === 'rejected'
                ? 'bg-red-500 border-red-500 text-white'
                : step.status === 'current'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-gray-100 border-gray-300 text-gray-500'
            )}
          >
            {step.status === 'approved' ? (
              <CheckCircle className="w-4 h-4" />
            ) : step.status === 'rejected' ? (
              <XCircle className="w-4 h-4" />
            ) : (
              step.step
            )}
          </div>
          
          {index < steps.length - 1 && (
            <div 
              className={cn(
                'w-8 h-0.5 transition-colors',
                step.status === 'approved' ? 'bg-green-500' : 'bg-gray-300'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}