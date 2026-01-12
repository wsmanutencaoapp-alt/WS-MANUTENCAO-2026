'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { PurchaseRequisition, CostCenter } from '@/lib/types';
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
import { Loader2, Search, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';

const getStatusVariant = (status: PurchaseRequisition['status']) => {
  const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
    'Aberta': 'secondary',
    'Em Aprovação': 'default',
    'Em Revisão': 'warning',
    'Aprovada': 'success',
    'Recusada': 'destructive',
    'Concluída': 'secondary',
  };
  return variants[status] || 'secondary';
};

const getPriorityVariant = (priority: PurchaseRequisition['priority']) => {
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
}

const priorityOrder: Record<PurchaseRequisition['priority'], number> = {
    'Muito Urgente': 1,
    'Urgente': 2,
    'Normal': 3,
};

const ControleComprasPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);

  const queryKey = 'approvedPurchaseRequisitions';
  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // We fetch all requisitions that are approved, or any other status relevant for purchasing.
    // Let's assume 'Aprovada' is the trigger.
    return query(collection(firestore, 'purchase_requisitions'), where('status', '==', 'Aprovada'), orderBy('createdAt', 'asc'));
  }, [firestore]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey: [queryKey]
  });

  const costCentersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['allCostCentersForControl']
  });
  
  const costCenterMap = useMemo(() => {
      if (!costCenters) return new Map<string, string>();
      return new Map(costCenters.map(cc => [cc.docId, `${cc.code} - ${cc.description}`]));
  }, [costCenters]);

  const sortedAndFilteredRequisitions = useMemo(() => {
    if (!requisitions) return [];

    let filtered = requisitions;
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        filtered = requisitions.filter(req => 
            (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
            req.requesterName.toLowerCase().includes(lowercasedTerm) ||
            (costCenterMap.get(req.costCenterId) || '').toLowerCase().includes(lowercasedTerm)
        );
    }
    
    // Sort by priority first, then by creation date
    return filtered.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 3;
        const priorityB = priorityOrder[b.priority] || 3;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  }, [requisitions, searchTerm, costCenterMap]);

  const handleStartPurchase = (requisition: WithDocId<PurchaseRequisition>) => {
    // Placeholder for the next step's logic
    toast({
        title: "Iniciando Processo de Compra",
        description: `Processo para a requisição ${requisition.protocol} foi iniciado.`,
    });
  }

  const isLoading = isLoadingRequisitions || isLoadingCostCenters;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Controle de Compras</h1>
        <Card>
          <CardHeader>
            <CardTitle>Requisições Aprovadas</CardTitle>
            <CardDescription>
              Gerencie as requisições de compra aprovadas e inicie o processo de cotação e compra.
            </CardDescription>
            <div className="relative pt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por protocolo, solicitante..."
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
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {requisitionsError && (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-destructive">{requisitionsError.message}</TableCell></TableRow>
                )}
                {!isLoading && sortedAndFilteredRequisitions.length === 0 && (
                   <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhuma requisição aprovada encontrada.</TableCell></TableRow>
                )}
                {!isLoading && sortedAndFilteredRequisitions.map(req => (
                  <TableRow key={req.docId}>
                    <TableCell className="font-mono">{req.protocol}</TableCell>
                    <TableCell>{format(new Date(req.createdAt), 'dd/MM/yyyy')}</TableCell>
                    <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                    <TableCell>{costCenterMap.get(req.costCenterId) || req.costCenterId}</TableCell>
                     <TableCell>
                        <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" onClick={() => handleStartPurchase(req)}>
                           <ShoppingBag className="mr-2 h-4 w-4"/>
                           Iniciar Processo de Compra
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <PurchaseRequisitionDetailsDialog
        requisition={selectedRequisition}
        isOpen={!!selectedRequisition}
        onClose={() => setSelectedRequisition(null)}
      />
    </>
  );
};

export default ControleComprasPage;
