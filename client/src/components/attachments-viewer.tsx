import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Paperclip, 
  Download, 
  Eye, 
  FileText, 
  Image, 
  File,
  X
} from "lucide-react";

interface AttachmentsViewerProps {
  attachments: any[];
  requestId: any;
  requestNumber: any;
  readonly?: boolean;
}

export default function AttachmentsViewer({ 
  attachments, 
  requestId, 
  requestNumber, 
  readonly = false 
}: AttachmentsViewerProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image className="h-4 w-4" />;
      case 'pdf':
      case 'doc':
      case 'docx':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getFileTypeColor = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'bg-blue-100 text-blue-800';
      case 'pdf':
        return 'bg-red-100 text-red-800';
      case 'doc':
      case 'docx':
        return 'bg-blue-100 text-blue-800';
      case 'xls':
      case 'xlsx':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!attachments || attachments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Anexos ({attachments?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum anexo encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Anexos ({attachments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {attachments.map((attachment: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getFileIcon(attachment.fileName || attachment.name || `file${index}`)}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">
                      {attachment.fileName || attachment.name || `Anexo ${index + 1}`}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getFileTypeColor(attachment.fileName || attachment.name || '')}`}
                      >
                        {(attachment.fileName || attachment.name || '').split('.').pop()?.toUpperCase() || 'FILE'}
                      </Badge>
                      {attachment.size && (
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAttachment(attachment)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Handle download
                      if (attachment.url) {
                        window.open(attachment.url, '_blank');
                      }
                    }}
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* File Preview Modal */}
      {selectedAttachment && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedAttachment(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {selectedAttachment.fileName || selectedAttachment.name || 'Anexo'}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAttachment(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge 
                    variant="secondary"
                    className={getFileTypeColor(selectedAttachment.fileName || selectedAttachment.name || '')}
                  >
                    {(selectedAttachment.fileName || selectedAttachment.name || '').split('.').pop()?.toUpperCase() || 'FILE'}
                  </Badge>
                  {selectedAttachment.size && (
                    <span className="text-sm text-muted-foreground">
                      {formatFileSize(selectedAttachment.size)}
                    </span>
                  )}
                </div>
                
                <div className="bg-muted/50 p-4 rounded-lg text-center">
                  <div className="text-muted-foreground">
                    {getFileIcon(selectedAttachment.fileName || selectedAttachment.name || '')}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Pré-visualização não disponível
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use o botão de download para abrir o arquivo
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedAttachment(null)}
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAttachment.url) {
                      window.open(selectedAttachment.url, '_blank');
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}