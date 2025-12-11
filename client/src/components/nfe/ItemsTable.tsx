import type { ItemNFE } from '@/types/nfe';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/currency';

interface ItemsTableProps {
  items: ItemNFE[];
}

export function ItemsTable({ items }: ItemsTableProps) {
  return (
    <div className="rounded-lg border bg-slate-950/30">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>NCM</TableHead>
            <TableHead>CFOP</TableHead>
            <TableHead className="text-center">UN</TableHead>
            <TableHead className="text-center">Qtd.</TableHead>
            <TableHead className="text-right">Vl. Unit.</TableHead>
            <TableHead className="text-right">Vl. Total</TableHead>
            <TableHead>Tributos</TableHead>
            <TableHead>Centro Custo</TableHead>
            <TableHead className="w-28">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, idx) => (
            <TableRow key={idx}>
              <TableCell>{it.numero}</TableCell>
              <TableCell>{it.codigo}</TableCell>
              <TableCell>{it.descricao}</TableCell>
              <TableCell>{it.ncm}</TableCell>
              <TableCell>{it.cfop}</TableCell>
              <TableCell className="text-center">{it.unidade}</TableCell>
              <TableCell className="text-center">{it.quantidade}</TableCell>
              <TableCell className="text-right">{formatCurrency(it.valorUnitario)}</TableCell>
              <TableCell className="text-right">{formatCurrency(it.valorTotal)}</TableCell>
              <TableCell>{formatCurrency(it.impostos.valorTotalTributos)}</TableCell>
              <TableCell>{it.centroCusto || '-'}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <button className="px-2 py-1 text-xs rounded border">Editar</button>
                  <button className="px-2 py-1 text-xs rounded border">Remover</button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
