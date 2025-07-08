import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ItemData {
  id: number;
  description: string;
  unit: string;
  stockQuantity: number;
  averageMonthlyQuantity: number;
  requestedQuantity: number;
  approvedQuantity?: number;
}

interface ItemsViewerProps {
  items: ItemData[];
  requestId: number;
  requestNumber?: string;
  className?: string;
}

export default function ItemsViewer({ items, requestId, requestNumber, className }: ItemsViewerProps) {
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleExportToExcel = () => {
    if (items.length === 0) {
      alert('Não há itens para exportar');
      return;
    }

    // Prepare data for Excel
    const excelData = items.map(item => ({
      'Descrição': item.description,
      'Unid.': item.unit,
      'Qtd. Estoque': item.stockQuantity,
      'Qtd. Média/mês': item.averageMonthlyQuantity,
      'Qtd. Requisitada': item.requestedQuantity,
      'Qtd. Aprovada': item.approvedQuantity || 0
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 40 }, // Descrição
      { wch: 8 },  // Unid.
      { wch: 15 }, // Qtd. Estoque
      { wch: 18 }, // Qtd. Média/mês
      { wch: 18 }, // Qtd. Requisitada
      { wch: 15 }  // Qtd. Aprovada
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Itens');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save file
    const fileName = `itens_solicitacao_${requestNumber || requestId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(data, fileName);
  };

  const getTotalRequested = () => {
    return items.reduce((total, item) => total + item.requestedQuantity, 0);
  };

  const getTotalApproved = () => {
    return items.reduce((total, item) => total + (item.approvedQuantity || 0), 0);
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
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead className="w-[80px]">Unid.</TableHead>
                <TableHead className="w-[100px]">Qtd. Estoque</TableHead>
                <TableHead className="w-[120px]">Qtd. Média/mês</TableHead>
                <TableHead className="w-[120px]">Qtd. Requisitada</TableHead>
                <TableHead className="w-[120px]">Qtd. Aprovada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{formatNumber(item.stockQuantity)}</TableCell>
                  <TableCell className="text-right">{formatNumber(item.averageMonthlyQuantity)}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(item.requestedQuantity)}</TableCell>
                  <TableCell className="text-right">
                    {item.approvedQuantity !== undefined && item.approvedQuantity !== null ? 
                      formatNumber(item.approvedQuantity) : 
                      <span className="text-gray-400">-</span>
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground">
                Total de Itens
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatNumber(getTotalRequested())}</div>
              <p className="text-xs text-muted-foreground">
                Qtd. Total Requisitada
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {getTotalApproved() > 0 ? formatNumber(getTotalApproved()) : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                Qtd. Total Aprovada
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}