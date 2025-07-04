import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ApprovalItemData {
  id: number;
  itemNumber: string;
  description: string;
  unit: string;
  requestedQuantity: string | number;
}

interface ApprovalItemsViewerProps {
  items: ApprovalItemData[];
  requestId: number;
  requestNumber?: string;
  className?: string;
}

export default function ApprovalItemsViewer({ items, requestId, requestNumber, className }: ApprovalItemsViewerProps) {
  const formatNumber = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    return numValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleExportToExcel = () => {
    if (items.length === 0) {
      alert('Não há itens para exportar');
      return;
    }

    // Prepare data for Excel
    const excelData = items.map(item => ({
      'Item': item.itemNumber,
      'Descrição': item.description,
      'Unid.': item.unit,
      'Qtd. Requisitada': item.requestedQuantity
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Item
      { wch: 40 }, // Descrição
      { wch: 8 },  // Unid.
      { wch: 18 }  // Qtd. Requisitada
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Itens');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save file
    const fileName = `itens_aprovacao_${requestNumber || requestId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(data, fileName);
  };

  const getTotalRequested = () => {
    return items.reduce((total, item) => total + Number(item.requestedQuantity || 0), 0);
  };

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Itens da Solicitação
          </CardTitle>
          <CardDescription>
            Visualize os itens desta solicitação de compra
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Esta solicitação não possui itens cadastrados.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Itens da Solicitação
            </CardTitle>
            <CardDescription>
              {items.length} {items.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
            </CardDescription>
          </div>
          <Button onClick={handleExportToExcel} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Item</TableHead>
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead className="w-[80px]">Unid.</TableHead>
                <TableHead className="w-[120px]">Qtd. Requisitada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemNumber}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(item.requestedQuantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">Total de Itens:</span>
            <span className="font-bold text-lg">{items.length}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="font-medium text-gray-700">Qtd. Total Requisitada:</span>
            <span className="font-bold text-lg">{formatNumber(getTotalRequested())}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}