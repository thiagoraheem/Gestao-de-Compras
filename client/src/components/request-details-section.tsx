import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Paperclip, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  User,
  Calendar,
  FileText,
  Building,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import debug from "@/lib/debug";

interface Attachment {
  id: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy?: {
    firstName?: string;
    lastName?: string;
    username: string;
  };
}

interface ApprovalHistoryItem {
  id: number;
  approverType: string;
  approved: boolean;
  rejectionReason?: string;
  createdAt: string;
  approver?: {
    id: number;
    username: string;
    firstName?: string;
    lastName?: string;
  };
}

interface RequestDetailsProps {
  attachments: Attachment[];
  approvalHistory?: ApprovalHistoryItem[];
  requestData: any;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateTime(dateString: string) {
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
}

function getApproverName(approver?: { firstName?: string; lastName?: string; username: string }) {
  if (!approver) return 'Sistema';
  if (approver.firstName && approver.lastName) {
    return `${approver.firstName} ${approver.lastName}`;
  }
  return approver.username;
}

function getApprovalTypeLabel(type: string) {
  switch (type) {
    case 'A1':
      return 'Aprovação A1';
    case 'A2':
      return 'Aprovação A2';
    default:
      return type;
  }
}

export default function RequestDetailsSection({ 
  attachments, 
  approvalHistory, 
  requestData,
  className 
}: RequestDetailsProps) {
  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(`/api/attachments/${attachment.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      debug.error('Erro ao baixar anexo:', error);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Informações Detalhadas da Solicitação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Informações Detalhadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requestData?.requester && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Solicitante
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {getApproverName(requestData.requester)}
                </p>
              </div>
            )}
            
            {requestData?.department && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="h-4 w-4" />
                  Departamento
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {requestData.department.name}
                </p>
              </div>
            )}
            
            {requestData?.costCenter && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="h-4 w-4" />
                  Centro de Custo
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {requestData.costCenter.name}
                </p>
              </div>
            )}
            
            {requestData?.deliveryLocation && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4" />
                  Local de Entrega
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {requestData.deliveryLocation}
                </p>
              </div>
            )}
          </div>
          
          {requestData?.justification && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                Justificativa
              </div>
              <p className="text-sm text-muted-foreground pl-6 bg-muted/50 p-3 rounded-md">
                {requestData.justification}
              </p>
            </div>
          )}
          
          {requestData?.observations && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                Observações
              </div>
              <p className="text-sm text-muted-foreground pl-6 bg-muted/50 p-3 rounded-md">
                {requestData.observations}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Aprovações Detalhado */}
      {approvalHistory && approvalHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Histórico de Aprovações
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Detalhes de todas as aprovações e reprovações
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvalHistory.map((approval, index) => (
                <div key={approval.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {approval.approved ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <h4 className="font-semibold">
                          {getApprovalTypeLabel(approval.approverType)}
                        </h4>
                        <Badge 
                          variant={approval.approved ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {approval.approved ? "Aprovado" : "Reprovado"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Por: {getApproverName(approval.approver)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDateTime(approval.createdAt)}</span>
                        </div>
                      </div>
                      
                      {approval.rejectionReason && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-800">Motivo da reprovação:</p>
                              <p className="text-sm text-red-700">{approval.rejectionReason}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {index < approvalHistory.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anexos */}
      {attachments && attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Anexos ({attachments.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Documentos e arquivos relacionados à solicitação
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {attachment.originalName}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatFileSize(attachment.fileSize)}</span>
                        <span>{formatDateTime(attachment.uploadedAt)}</span>
                        {attachment.uploadedBy && (
                          <span>por {getApproverName(attachment.uploadedBy)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadAttachment(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
