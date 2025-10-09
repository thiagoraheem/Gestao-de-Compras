import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ApprovalTypeBadgeProps {
  approvalType: 'single' | 'dual';
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected';
  currentStep?: number;
  totalSteps?: number;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ApprovalTypeBadge({
  approvalType,
  status = 'pending',
  currentStep,
  totalSteps,
  className,
  showIcon = true,
  size = 'md'
}: ApprovalTypeBadgeProps) {
  const isSingle = approvalType === 'single';
  const isDual = approvalType === 'dual';

  // Determine badge variant and colors
  const getBadgeVariant = () => {
    if (status === 'rejected') return 'destructive';
    if (status === 'completed') return 'default';
    if (isSingle) return 'default';
    return 'secondary';
  };

  const getBadgeColors = () => {
    if (status === 'rejected') {
      return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
    }
    if (status === 'completed') {
      return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
    }
    if (isSingle) {
      return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
    }
    return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
  };

  // Get appropriate icon
  const getIcon = () => {
    if (!showIcon) return null;
    
    if (status === 'rejected') {
      return <AlertCircle className="w-3 h-3" />;
    }
    if (status === 'completed') {
      return <CheckCircle className="w-3 h-3" />;
    }
    if (status === 'in_progress') {
      return <Clock className="w-3 h-3" />;
    }
    
    return isSingle ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />;
  };

  // Get badge text
  const getBadgeText = () => {
    if (status === 'rejected') {
      return 'REJEITADO';
    }
    if (status === 'completed') {
      return isSingle ? 'APROVADO' : 'DUPLA APROVAÇÃO CONCLUÍDA';
    }
    
    const baseText = isSingle ? 'APROVAÇÃO SIMPLES' : 'DUPLA APROVAÇÃO';
    
    if (isDual && currentStep && totalSteps) {
      return `${baseText} (${currentStep}/${totalSteps})`;
    }
    
    return baseText;
  };

  // Size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1';
      case 'lg':
        return 'text-sm px-3 py-2';
      default:
        return 'text-xs px-2.5 py-1.5';
    }
  };

  const icon = getIcon();
  const text = getBadgeText();

  return (
    <Badge
      variant={getBadgeVariant()}
      className={cn(
        getBadgeColors(),
        getSizeClasses(),
        'font-medium border transition-colors duration-200',
        'flex items-center gap-1.5',
        className
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{text}</span>
    </Badge>
  );
}

// Convenience component for simple usage
export function SimpleApprovalBadge({ 
  approvalType, 
  className 
}: { 
  approvalType: 'single' | 'dual'; 
  className?: string; 
}) {
  return (
    <ApprovalTypeBadge
      approvalType={approvalType}
      status="pending"
      className={className}
      showIcon={true}
      size="md"
    />
  );
}

// Component for showing approval progress
export function ApprovalProgressBadge({
  approvalType,
  currentStep,
  totalSteps,
  isCompleted = false,
  isRejected = false,
  className
}: {
  approvalType: 'single' | 'dual';
  currentStep?: number;
  totalSteps?: number;
  isCompleted?: boolean;
  isRejected?: boolean;
  className?: string;
}) {
  const getStatus = (): ApprovalTypeBadgeProps['status'] => {
    if (isRejected) return 'rejected';
    if (isCompleted) return 'completed';
    if (currentStep && currentStep > 0) return 'in_progress';
    return 'pending';
  };

  return (
    <ApprovalTypeBadge
      approvalType={approvalType}
      status={getStatus()}
      currentStep={currentStep}
      totalSteps={totalSteps}
      className={className}
      showIcon={true}
      size="md"
    />
  );
}