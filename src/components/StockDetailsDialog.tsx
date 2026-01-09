'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import type { Supply, SupplyStock } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { format } from 'date-fns';

interface StockDetailsDialogProps {
  supply: WithDocId<Supply> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function StockDetailsDialog({ supply, isOpen, onClose }: StockDetailsDialogProps) {
  const firestore = useFirestore();

  const stockQuery = useMemoFirebase(() => {
    if (!firestore || !supply) return null;
    return query(
      collection(firestore, 'supply_stock'),
      where('supplyId', '==', supply.docId),
      orderBy('dataEntrada', 'desc')
    );
  }, [firestore, supply]);

  const { data: stockItems, isLoading, error } = useCollection<SupplyStock>(stockQuery, {
    queryKey: ['stockDetails', supply?.docId],
    enabled: isOpen && !!supply,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Estoque</DialogTitle>
          <DialogDescription>
            Lotes em estoque para o item <span className="font-bold">{supply?.codigo} - {supply?.descricao}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Lote Interno</TableHead>
                        <TableHead>Lote Fornecedor</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Data de Entrada</TableHead>
                        <TableHead>Validade</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">
                                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            </TableCell>
                        </TableRow>
                    )}
                    {error && (
                         <TableRow>
                            <TableCell colSpan={6} className="text-center text-destructive">
                                Erro ao carregar os lotes.
                            </TableCell>
                        </TableRow>
                    )}
                    {!isLoading && stockItems?.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">
                                Nenhum lote em estoque para este item.
                            </TableCell>
                        </TableRow>
                    )}
                    {!isLoading && stockItems?.map((item) => (
                        <TableRow key={item.docId}>
                            <TableCell className="font-mono">{item.loteInterno}</TableCell>
                            <TableCell>{item.loteFornecedor || 'N/A'}</TableCell>
                            <TableCell className="font-semibold">{item.quantidade.toLocaleString()}</TableCell>
                            <TableCell>{item.localizacao}</TableCell>
                            <TableCell>{format(new Date(item.dataEntrada), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{item.dataValidade ? format(new Date(item.dataValidade), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
