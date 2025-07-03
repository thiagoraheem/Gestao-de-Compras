import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface EditableItem {
  id?: number;
  item: string;
  description: string;
  unit: string;
  stockQuantity: number;
  averageMonthlyQuantity: number;
  requestedQuantity: number;
  approvedQuantity?: number;
}

interface EditableItemsTableProps {
  items: EditableItem[];
  onChange: (items: EditableItem[]) => void;
  readonly?: boolean;
  className?: string;
}

export default function EditableItemsTable({ items, onChange, readonly = false, className }: EditableItemsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<EditableItem>({
    item: '',
    description: '',
    unit: '',
    stockQuantity: 0,
    averageMonthlyQuantity: 0,
    requestedQuantity: 0
  });

  const handleAddItem = () => {
    const newItem: EditableItem = {
      id: Date.now(), // Temporary ID for new items
      item: '',
      description: '',
      unit: '',
      stockQuantity: 0,
      averageMonthlyQuantity: 0,
      requestedQuantity: 0
    };
    
    onChange([...items, newItem]);
    setEditingId(newItem.id!);
    setEditingValues(newItem);
  };

  const handleEditItem = (item: EditableItem) => {
    setEditingId(item.id || 0);
    setEditingValues({ ...item });
  };

  const handleSaveItem = () => {
    if (!editingId) return;

    const updatedItems = items.map(item => 
      item.id === editingId ? { ...editingValues, id: editingId } : item
    );
    
    onChange(updatedItems);
    setEditingId(null);
    setEditingValues({
      item: '',
      description: '',
      unit: '',
      stockQuantity: 0,
      averageMonthlyQuantity: 0,
      requestedQuantity: 0
    });
  };

  const handleCancelEdit = () => {
    // If it's a new item (no database ID), remove it
    if (editingId && editingId > 1000000000) { // Temporary ID range
      const filteredItems = items.filter(item => item.id !== editingId);
      onChange(filteredItems);
    }
    
    setEditingId(null);
    setEditingValues({
      item: '',
      description: '',
      unit: '',
      stockQuantity: 0,
      averageMonthlyQuantity: 0,
      requestedQuantity: 0
    });
  };

  const handleDeleteItem = (id: number) => {
    const filteredItems = items.filter(item => item.id !== id);
    onChange(filteredItems);
  };

  const handleInputChange = (field: keyof EditableItem, value: string | number | undefined) => {
    setEditingValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const isValidItem = (item: EditableItem): boolean => {
    return item.item.trim() !== '' && item.description.trim() !== '' && item.unit.trim() !== '';
  };

  const canSave = isValidItem(editingValues);

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Itens da Solicitação</CardTitle>
          <CardDescription>
            Adicione os itens que fazem parte desta solicitação de compra
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Nenhum item foi adicionado ainda. Clique em "Adicionar Item" para começar ou importe um arquivo Excel.
            </AlertDescription>
          </Alert>
          {!readonly && (
            <div className="mt-4">
              <Button onClick={handleAddItem} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Itens da Solicitação</CardTitle>
        <CardDescription>
          {readonly ? 'Visualize os itens desta solicitação' : 'Gerencie os itens desta solicitação'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Item</TableHead>
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead className="w-[80px]">Unid.</TableHead>
                <TableHead className="w-[100px]">Qtd. Estoque</TableHead>
                <TableHead className="w-[120px]">Qtd. Média/mês</TableHead>
                <TableHead className="w-[120px]">Qtd. Requisitada</TableHead>
                <TableHead className="w-[120px]">Qtd. Aprovada</TableHead>
                {!readonly && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        value={editingValues.item}
                        onChange={(e) => handleInputChange('item', e.target.value)}
                        placeholder="Código"
                        className="h-8"
                      />
                    ) : (
                      item.item
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        value={editingValues.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Descrição do item"
                        className="h-8"
                      />
                    ) : (
                      item.description
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        value={editingValues.unit}
                        onChange={(e) => handleInputChange('unit', e.target.value)}
                        placeholder="UN"
                        className="h-8"
                      />
                    ) : (
                      item.unit
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        type="number"
                        value={editingValues.stockQuantity}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('stockQuantity', isNaN(value) ? 0 : value);
                        }}
                        className="h-8"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      formatNumber(item.stockQuantity)
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        type="number"
                        value={editingValues.averageMonthlyQuantity}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('averageMonthlyQuantity', isNaN(value) ? 0 : value);
                        }}
                        className="h-8"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      formatNumber(item.averageMonthlyQuantity)
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        type="number"
                        value={editingValues.requestedQuantity}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('requestedQuantity', isNaN(value) ? 0 : value);
                        }}
                        className="h-8"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      formatNumber(item.requestedQuantity)
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        type="number"
                        value={editingValues.approvedQuantity || 0}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          handleInputChange('approvedQuantity', value === undefined || isNaN(value) ? undefined : value);
                        }}
                        className="h-8"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      item.approvedQuantity ? formatNumber(item.approvedQuantity) : '-'
                    )}
                  </TableCell>
                  {!readonly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingId === item.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveItem}
                              disabled={!canSave}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditItem(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteItem(item.id!)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!readonly && (
          <div className="mt-4 flex justify-between items-center">
            <Button onClick={handleAddItem} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
            <p className="text-sm text-gray-500">
              Total: {items.length} {items.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}