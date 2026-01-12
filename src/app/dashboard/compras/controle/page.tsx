
'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, runTransaction, doc } from 'firebase/firestore';
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
import { Loader2, Search, Eye, FileSync } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
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

export default function GestaoDeComprasPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [isConverting, setIsConverting] = useState<string | null>(null);

  const queryKey = 'allPurchaseRequisitions';
  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey: [queryKey]
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
  
  const handleConvertToOC = async (req: WithDocId<PurchaseRequisition>) => {
      if (!firestore) return;
      setIsConverting(req.docId);

      try {
          const counterRef = doc(firestore, 'counters', 'purchaseOrders');
          const newProtocolNumber = await runTransaction(firestore, async (transaction) => {
              const counterDoc = await transaction.get(counterRef);
              let lastId = 0;
              if (counterDoc.exists()) {
                  lastId = counterDoc.data().lastId || 0;
              }
              const newId = lastId + 1;
              const newProtocol = `OC-${new Date().getFullYear()}-${String(newId).padStart(5, '0')}`;
              
              if(counterDoc.exists()) {
                transaction.update(counterRef, { lastId: newId });
              } else {
                transaction.set(counterRef, { lastId: newId });
              }

              return newProtocol;
          });

          const reqRef = doc(firestore, 'purchase_requisitions', req.docId);
          await runTransaction(firestore, async (transaction) => {
            transaction.update(reqRef, {
                type: 'Ordem de Compra',
                originalProtocol: req.protocol,
                protocol: newProtocolNumber,
            });
          });

          toast({
              title: "Sucesso!",
              description: `Requisição ${req.protocol} convertida para Ordem de Compra ${newProtocolNumber}.`
          });
          queryClient.invalidateQueries({ queryKey: [queryKey] });

      } catch (err) {
          console.error("Erro ao converter para OC:", err);
          toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível converter a requisição.' });
      } finally {
          setIsConverting(null);
      }
  };

  const isLoading = isLoadingRequisitions || isLoadingCostCenters;

  return (
    <>
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
                  <TableHead>Prioridade</TableHead>
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
                {!isLoading && filteredRequisitions.length === 0 && (
                   <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma requisição encontrada.</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.map(req => (
                  <TableRow key={req.docId}>
                    <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                    <TableCell className="font-mono">
                      {req.protocol || req.docId.substring(0, 8)}
                      {req.originalProtocol && <p className="text-xs text-muted-foreground font-sans">(Origem: {req.originalProtocol})</p>}
                    </TableCell>
                    <TableCell>{format(new Date(req.createdAt), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                    <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" onClick={() => setSelectedRequisition(req)} title="Ver Itens">
                         <Eye className="h-4 w-4" />
                      </Button>
                      {req.status === 'Aprovada' && req.type === 'Solicitação de Compra' && (
                          <Button variant="default" size="icon" onClick={() => handleConvertToOC(req)} disabled={isConverting === req.docId} title="Converter para Ordem de Compra">
                              {isConverting === req.docId ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileSync className="h-4 w-4"/>}
                          </Button>
                      )}
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
