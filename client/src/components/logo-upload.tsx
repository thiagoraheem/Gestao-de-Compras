import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import debug from '@/lib/debug';

interface LogoUploadProps {
  companyId: number;
  currentLogoBase64?: string;
  onUploadSuccess: (logoBase64: string) => void;
  disabled?: boolean;
}

export function LogoUpload({ 
  companyId, 
  currentLogoBase64, 
  onUploadSuccess, 
  disabled = false 
}: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoBase64 || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Erro",
        description: "Apenas arquivos PNG, JPG e JPEG são permitidos",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    
    try {
      // Converter arquivo para base64
      const reader = new FileReader();
      const logoBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const response = await fetch(`/api/companies/${companyId}/upload-logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logoBase64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao fazer upload do logo');
      }

      const data = await response.json();
      onUploadSuccess(data.logoBase64);
      
      toast({
        title: "Sucesso",
        description: "Logo enviado com sucesso!",
      });
    } catch (error: any) {
      debug.error('Error uploading logo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePreview = () => {
    setSelectedFile(null);
    setPreviewUrl(currentLogoBase64 || null);
  };

  return (
    <div className="space-y-4">
      <Label>Logo da Empresa</Label>
      
      {/* Preview atual */}
      {previewUrl && (
        <Card className="w-fit">
          <CardContent className="p-4">
            <div className="relative">
              <img 
                src={previewUrl} 
                alt="Logo da empresa" 
                className="h-20 w-20 object-contain rounded border"
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0"
                  onClick={handleRemovePreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Área de upload */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            className="flex-1"
          />
          {selectedFile && (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="shrink-0"
            >
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          )}
        </div>
        
        {!previewUrl && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Selecione um arquivo PNG, JPG ou JPEG (máx. 5MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}