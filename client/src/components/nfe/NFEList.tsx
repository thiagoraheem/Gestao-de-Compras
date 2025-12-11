import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NFEViewer } from './NFEViewer';

interface NFEAttachmentRow {
  id: number;
  fileName: string;
  uploadedAt?: string;
  documentNumber?: string;
  documentSeries?: string;
  documentKey?: string;
  supplierName?: string;
  supplierCnpjCpf?: string;
  total?: number;
}

export function NFEList() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<NFEAttachmentRow[]>([]);
  const [selectedXml, setSelectedXml] = useState<string>('');

  const load = async () => {
    const url = `/api/nfe/attachments?search=${encodeURIComponent(search)}&limit=100`;
    const res = await fetch(url);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder="Buscar por número, série, fornecedor, CNPJ" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={load}>Buscar</Button>
      </div>
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NF</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.documentNumber} / {r.documentSeries}</TableCell>
                <TableCell>{r.supplierName} ({r.supplierCnpjCpf})</TableCell>
                <TableCell>{(r.total || 0).toFixed(2)}</TableCell>
                <TableCell>{r.fileName}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    const res = await fetch(`/api/attachments/${r.id}/download`);
                    const text = await res.text();
                    setSelectedXml(text);
                  }}>Carregar</Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm">Visualizar</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl">
                      <DialogTitle>NF-e</DialogTitle>
                      <div className="max-h-[75vh] overflow-y-auto">
                        <NFEViewer xmlString={selectedXml} />
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
