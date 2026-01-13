'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs, writeBatch, serverTimestamp, addDoc, orderBy, documentId, updateDoc } from 'firebase/firestore';
import type { PurchaseRequisition, CostCenter, Tool, Supply, PurchaseRequisitionItem } from '@/lib/types';
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
import { Loader2, Search, ShoppingBag, Eye, XCircle, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';
import { useQueryClient } from '@tanstack/react-query';
import QuotationDialog from '@/components/QuotationDialog';
import { Progress } from '@/components/ui/progress';

type RequisitionWithProgress = WithDocId<PurchaseRequisition> & {
    progress: number;
    totalItems: number;
};

const getStatusVariant = (status: PurchaseRequisition['status']) => {
  const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
    'Aberta': 'secondary',
    'Em Cotação': 'default',
    'Em Aprovação': 'default',
    'Aprovada': 'success',
    'Recusada': 'destructive',
    'Concluída': 'secondary',
    'Em Revisão': 'warning',
    'Parcialmente Atendida': 'warning',
    'Totalmente Atendida': 'success',
    'Cancelada': 'destructive'
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
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionsWithProgress, setRequisitionsWithProgress] = useState<RequisitionWithProgress[]>([]);


  const queryKey = 'allPurchaseRequisitionsForControl';
  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), where('type', '==', 'Solicitação de Compra'));
  }, [firestore]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey: [queryKey]
  });
  
  useEffect(() => {
    if (!requisitions || !firestore) return;

    const fetchProgress = async () => {
      const enrichedReqs: RequisitionWithProgress[] = [];
      for (const req of requisitions) {
        const itemsRef = collection(firestore, 'purchase_requisitions', req.docId, 'items');
        const itemsSnapshot = await getDocs(itemsRef);
        const totalItems = itemsSnapshot.size;
        let attendedItems = 0;
        
        itemsSnapshot.forEach(doc => {
          const item = doc.data() as PurchaseRequisitionItem;
          if (['Em Cotação', 'Cotado', 'Recebido', 'Cancelado'].includes(item.status)) {
            attendedItems++;
          }
        });
        
        const progress = totalItems > 0 ? (attendedItems / totalItems) * 100 : 0;
        enrichedReqs.push({ ...req, progress, totalItems });
      }
      setRequisitionsWithProgress(enrichedReqs);
    };

    fetchProgress();
  }, [requisitions, firestore]);

  const costCenterIds = useMemo(() => {
    if (!requisitions || requisitions.length === 0) return [];
    return [...new Set(requisitions.map(r => r.costCenterId))];
  }, [requisitions]);

  const costCentersQuery = useMemoFirebase(() => {
      if (!firestore || costCenterIds.length === 0) return null;
      return query(collection(firestore, 'cost_centers'), where(documentId(), 'in', costCenterIds));
  }, [firestore, costCenterIds.join(',')]);

  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['costCentersForControl', costCenterIds.join(',')],
      enabled: costCenterIds.length > 0,
  });
  
  const costCenterMap = useMemo(() => {
      if (!costCenters) return new Map<string, string>();
      return new Map(costCenters.map(cc => [cc.docId, `${cc.code} - ${cc.description}`]));
  }, [costCenters]);

  const sortedAndFilteredRequisitions = useMemo(() => {
    if (!requisitionsWithProgress) return [];

    // Filter client-side
    let relevantRequisitions = requisitionsWithProgress.filter(req => ['Aprovada', 'Parcialmente Atendida', 'Em Cotação'].includes(req.status));

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        relevantRequisitions = relevantRequisitions.filter(req => 
            (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
            req.requesterName.toLowerCase().includes(lowercasedTerm) ||
            (costCenterMap.get(req.costCenterId) || '').toLowerCase().includes(lowercasedTerm)
        );
    }
    
    return relevantRequisitions.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 3;
        const priorityB = priorityOrder[b.priority] || 3;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  }, [requisitionsWithProgress, searchTerm, costCenterMap]);
  
  const handleSuccess = () => {
    setSelectedRequisition(null);
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: 'pendingPurchaseRequisitions' });
  };


  const isLoading = isLoadingRequisitions || isLoadingCostCenters;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Controle de Compras</h1>
        <Card>
          <CardHeader>
            <CardTitle>Requisições Aprovadas e Em Cotação</CardTitle>
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
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[20%]">Atendimento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {requisitionsError && (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">{requisitionsError.message}</TableCell></TableRow>
                )}
                {!isLoading && sortedAndFilteredRequisitions.length === 0 && (
                   <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma requisição aprovada ou em cotação encontrada.</TableCell></TableRow>
                )}
                {!isLoading && sortedAndFilteredRequisitions.map(req => (
                  <TableRow key={req.docId}>
                    <TableCell className="font-mono">{req.protocol}</TableCell>
                    <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                     <TableCell>
                        <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                    </TableCell>
                    <TableCell>
                        {req.totalItems > 0 ? (
                           <div className="flex flex-col">
                             <Progress value={req.progress} className="h-2" />
                             <span className="text-xs text-muted-foreground text-right">{Math.round(req.progress)}%</span>
                           </div>
                        ) : <span className="text-xs text-muted-foreground">N/A</span> }
                      </TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="default" size="sm" onClick={() => setSelectedRequisition(req)}>
                           <Eye className="mr-2 h-4 w-4"/>
                           Ver e Atender Itens
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selectedRequisition && (
        <PurchaseRequisitionDetailsDialog
          requisition={selectedRequisition}
          isOpen={!!selectedRequisition}
          onClose={() => setSelectedRequisition(null)}
          onActionSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default ControleComprasPage;
