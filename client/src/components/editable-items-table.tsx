import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface EditableItem {
  id?: number | string;
  description: string;
  unit: string;
  requestedQuantity: number;
}

interface EditableItemsTableProps {
  items: EditableItem[];
  onChange: (items: EditableItem[]) => void;
  readonly?: boolean;
  className?: string;
}

export default function EditableItemsTable({ items, onChange, readonly = false, className }: EditableItemsTableProps) {
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editingValues, setEditingValues] = useState<EditableItem>({
    description: '',
    unit: '',
    requestedQuantity: 0
  });

  const handleAddItem = () => {
    const newItem: EditableItem = {
      id: `temp_${Date.now()}` as any, // Temporary ID for new items - using string to avoid confusion with real IDs
      description: '',
      unit: '',
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
      description: '',
      unit: '',
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
      description: '',
      unit: '',
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
    return (item.description || '').trim() !== '' && (item.unit || '').trim() !== '';
  };

  const canSave = isValidItem(editingValues);

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Itens da Solicitação</CardTitle>
          <CardDescription>
            {readonly ? 'Visualize os itens desta solicitação' : 'Gerencie os itens desta solicitação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Nenhum item foi adicionado ainda. {!readonly && 'Clique no botão abaixo para adicionar um item.'}
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
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead className="w-[80px]">Unid.</TableHead>
                <TableHead className="w-[120px]">Qtd. Solicitada</TableHead>
                {!readonly && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        value={editingValues.description || ''}
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
                        value={editingValues.unit || ''}
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
                        value={editingValues.requestedQuantity || 0}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleInputChange('requestedQuantity', isNaN(value) ? 0 : value);
                        }}
                        placeholder="0"
                        className="h-8"
                      />
                    ) : (
                      formatNumber(item.requestedQuantity)
                    )}
                  </TableCell>
                  {!readonly && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {editingId === item.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveItem}
                              disabled={!canSave}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id!)}
                              className="h-8 w-8 p-0"
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