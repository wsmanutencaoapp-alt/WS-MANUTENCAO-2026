'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import type { PurchaseRequisition, PurchaseRequisitionItem, CostCenter } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getStatusVariant = (status: PurchaseRequisition['status']) => {
  switch (status) {
    case 'Aberta':
      return 'default';
    case 'Em Aprovação':
      return 'secondary';
    case 'Aprovada':
      return 'success';
    case 'Recusada':
      return 'destructive';
    case 'Concluída':
      return 'outline';
    default:
      return 'secondary';
  }
};

const getPriorityVariant = (priority: PurchaseRequisition['priority']) => {
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
}

const GestaoDeComprasPage = () => {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey: ['allPurchaseRequisitions']
  });

  const costCentersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['allCostCentersForCompras']
  });
  
  const costCenterMap = useMemo(() => {
      if (!costCenters) return new Map<string, string>();
      return new Map(costCenters.map(cc => [cc.docId, `${cc.code} - ${cc.description}`]));
  }, [costCenters]);


  const filteredRequisitions = useMemo(() => {
    if (!requisitions) return [];
    if (!searchTerm) return requisitions;
    const lowercasedTerm = searchTerm.toLowerCase();
    return requisitions.filter(req => 
        (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
        req.requesterName.toLowerCase().includes(lowercasedTerm) ||
        (costCenterMap.get(req.costCenterId) || '').toLowerCase().includes(lowercasedTerm) ||
        req.status.toLowerCase().includes(lowercasedTerm)
    );
  }, [requisitions, searchTerm, costCenterMap]);

  const isLoading = isLoadingRequisitions || isLoadingCostCenters;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Compras</h1>
      <Card>
        <CardHeader>
          <CardTitle>Painel de Requisições</CardTitle>
          <CardDescription>
            Acompanhe e gerencie todas as requisições de compra da empresa.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por protocolo, solicitante, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data da Requisição</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Data de Necessidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              )}
              {requisitionsError && (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-destructive">{requisitionsError.message}</TableCell></TableRow>
              )}
              {!isLoading && filteredRequisitions.length === 0 && (
                 <TableRow><TableCell colSpan={8} className="h-24 text-center">Nenhuma requisição encontrada.</TableCell></TableRow>
              )}
              {!isLoading && filteredRequisitions.map(req => (
                <TableRow key={req.docId}>
                  <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                  <TableCell className="font-mono">{req.protocol || req.docId.substring(0, 8)}</TableCell>
                  <TableCell>{format(new Date(req.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{req.requesterName}</TableCell>
                  <TableCell>{costCenterMap.get(req.costCenterId) || req.costCenterId}</TableCell>
                  <TableCell>{format(new Date(req.neededByDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                       <Eye className="mr-2 h-4 w-4" />
                       Ver Itens
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestaoDeComprasPage;
