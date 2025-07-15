import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import debug from '@/lib/debug';

export interface ExcelItem {
  item: string;
  description: string;
  unit: string;
  stockQuantity: number;
  averageMonthlyQuantity: number;
  requestedQuantity: number;
  approvedQuantity?: number;
}

interface ExcelImporterProps {
  onImport: (items: ExcelItem[]) => void;
  className?: string;
}

export default function ExcelImporter({ onImport, className }: ExcelImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.');
      return;
    }

    processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Get first worksheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      clearInterval(progressInterval);
      setProgress(100);

      // Map data to our format
      const items: ExcelItem[] = jsonData.map((row: any, index: number) => {
        // Support various column name formats
        const getColumnValue = (possibleNames: string[]) => {
          for (const name of possibleNames) {
            if (row[name] !== undefined) {
              return row[name];
            }
          }
          return '';
        };

        const item = getColumnValue(['Item', 'item', 'ITEM', 'Código', 'codigo', 'Cod']);
        const description = getColumnValue(['Descrição', 'Descricao', 'Description', 'description', 'DESC']);
        const unit = getColumnValue(['Unid.', 'Unidade', 'Unit', 'unit', 'UN']);
        const stockQuantity = parseFloat(getColumnValue(['Quant. Estoque', 'Qtd Estoque', 'Stock Quantity', 'stock', 'Estoque']) || '0');
        const averageMonthlyQuantity = parseFloat(getColumnValue(['Quant. Média/mês', 'Qtd Média', 'Average Monthly', 'Media Mensal']) || '0');
        const requestedQuantity = parseFloat(getColumnValue(['Quant. Requisitada', 'Qtd Requisitada', 'Requested Quantity', 'Requisitada']) || '0');
        const approvedQuantity = parseFloat(getColumnValue(['Quant. Aprovado', 'Qtd Aprovada', 'Approved Quantity', 'Aprovado']) || '0');

        // Validate required fields
        if (!item || !description || !unit) {
          throw new Error(`Linha ${index + 2}: Item, Descrição e Unidade são obrigatórios`);
        }

        return {
          item: String(item),
          description: String(description),
          unit: String(unit),
          stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
          averageMonthlyQuantity: isNaN(averageMonthlyQuantity) ? 0 : averageMonthlyQuantity,
          requestedQuantity: isNaN(requestedQuantity) ? 0 : requestedQuantity,
          approvedQuantity: isNaN(approvedQuantity) ? undefined : approvedQuantity
        };
      });

      if (items.length === 0) {
        throw new Error('Nenhum item válido encontrado no arquivo');
      }

      // Call the callback with processed items
      onImport(items);
      setSuccess(true);

      // Reset after success
      setTimeout(() => {
        setSuccess(false);
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error) {
      debug.error('Error processing file:', error);
      setError(error instanceof Error ? error.message : 'Erro ao processar arquivo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Itens do Excel
        </CardTitle>
        <CardDescription>
          Faça upload de um arquivo Excel ou CSV com os itens da solicitação
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          {isProcessing ? (
            <div className="space-y-4">
              <div className="animate-spin mx-auto">
                <FileSpreadsheet className="h-12 w-12 text-blue-500" />
              </div>
              <p className="text-lg font-medium">Processando arquivo...</p>
              <Progress value={progress} className="w-full max-w-xs mx-auto" />
            </div>
          ) : success ? (
            <div className="space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-medium text-green-700 dark:text-green-300">
                Arquivo importado com sucesso!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <div>
                <p className="text-lg font-medium">
                  Arraste e solte seu arquivo aqui
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  ou clique para selecionar
                </p>
              </div>
              <Button onClick={handleBrowseClick} variant="outline">
                Selecionar Arquivo
              </Button>
              <p className="text-xs text-gray-500">
                Suporta arquivos .xlsx, .xls e .csv
              </p>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-2">
          <h4 className="font-medium text-sm">Formato esperado das colunas:</h4>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>• <strong>Item:</strong> Código ou número do item</div>
            <div>• <strong>Descrição:</strong> Descrição detalhada do item</div>
            <div>• <strong>Unid.:</strong> Unidade de medida (ex: UN, KG, M)</div>
            <div>• <strong>Quant. Estoque:</strong> Quantidade em estoque</div>
            <div>• <strong>Quant. Média/mês:</strong> Quantidade média mensal</div>
            <div>• <strong>Quant. Requisitada:</strong> Quantidade solicitada</div>
            <div>• <strong>Quant. Aprovado:</strong> Quantidade aprovada (opcional)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}