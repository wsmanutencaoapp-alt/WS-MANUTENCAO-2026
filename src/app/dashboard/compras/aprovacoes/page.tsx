'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDocs, documentId } from 'firebase/firestore';
import type { PurchaseRequisition, PurchaseRequisitionItem, CostCenter, Supply, Tool } from '@/lib/types';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';


type RequisitionWithTotal = WithDocId<PurchaseRequisition> & {
    totalValue: number;
};

const AprovacoesComprasPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionsWithTotals, setRequisitionsWithTotals] = useState<RequisitionWithTotal[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const queryKey = 'pendingPurchaseRequisitions';
  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Por enquanto, vamos pegar as "Abertas" para simular o fluxo. O ideal seria ter um status "Em Aprovação"
    return query(collection(firestore, 'purchase_requisitions'), where('status', '==', 'Aberta'));
  }, [firestore]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey: [queryKey]
  });

  const costCentersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['allCostCentersForApprovals']
  });
  
  const costCenterMap = useMemo(() => {
      if (!costCenters) return new Map<string, string>();
      return new Map(costCenters.map(cc => [cc.docId, `${cc.code} - ${cc.description}`]));
  }, [costCenters]);

  // Efeito para calcular os totais quando as requisições ou itens mudarem
  useMemo(() => {
    if (!requisitions || !firestore) return;

    const calculateTotals = async () => {
        const enrichedReqs: RequisitionWithTotal[] = [];
        for (const req of requisitions) {
            const itemsRef = collection(firestore, 'purchase_requisitions', req.docId, 'items');
            const itemsSnapshot = await getDocs(itemsRef);
            let totalValue = 0;
            itemsSnapshot.forEach(doc => {
                const item = doc.data() as PurchaseRequisitionItem;
                totalValue += (item.estimatedPrice || 0) * item.quantity;
            });
            enrichedReqs.push({ ...req, totalValue });
        }
        setRequisitionsWithTotals(enrichedReqs);
    };

    calculateTotals();
  }, [requisitions, firestore]);

  const handleDecision = async (requisitionId: string, decision: 'Aprovada' | 'Recusada') => {
      if (!firestore) return;
      setIsProcessing(requisitionId);
      const reqRef = doc(firestore, 'purchase_requisitions', requisitionId);
      try {
          await updateDoc(reqRef, { status: decision });
          toast({
              title: `Requisição ${decision}`,
              description: `A requisição foi marcada como ${decision.toLowerCase()}.`,
              variant: decision === 'Recusada' ? 'destructive' : 'default',
          });
          queryClient.invalidateQueries({ queryKey: [queryKey] });
          queryClient.invalidateQueries({ queryKey: ['allPurchaseRequisitions'] });
      } catch (err) {
          console.error("Erro ao atualizar requisição:", err);
          toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível processar a sua decisão.' });
      } finally {
          setIsProcessing(null);
      }
  }


  const filteredRequisitions = useMemo(() => {
    if (!requisitionsWithTotals) return [];
    if (!searchTerm) return requisitionsWithTotals;
    const lowercasedTerm = searchTerm.toLowerCase();
    return requisitionsWithTotals.filter(req => 
        (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
        req.requesterName.toLowerCase().includes(lowercasedTerm) ||
        (costCenterMap.get(req.costCenterId) || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [requisitionsWithTotals, searchTerm, costCenterMap]);

  const isLoading = isLoadingRequisitions || isLoadingCostCenters;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Aprovação de Requisições de Compra</h1>
        <Card>
          <CardHeader>
            <CardTitle>Requisições Pendentes</CardTitle>
            <CardDescription>
              Analise, aprove ou recuse as requisições de compra pendentes.
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
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Data de Necessidade</TableHead>
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
                   <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma requisição pendente de aprovação.</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.map(req => (
                  <TableRow key={req.docId}>
                    <TableCell className="font-mono">{req.protocol || req.docId.substring(0, 8)}</TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                    <TableCell>{costCenterMap.get(req.costCenterId) || req.costCenterId}</TableCell>
                    <TableCell className="font-medium">{req.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell>{format(new Date(req.neededByDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right space-x-2">
                        {isProcessing === req.docId ? <Loader2 className="animate-spin h-5 w-5 ml-auto"/> : (
                            <>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedRequisition(req)}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleDecision(req.docId, 'Aprovada')}>
                                    <CheckCircle className="h-5 w-5" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700">
                                            <XCircle className="h-5 w-5" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Recusa</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Tem certeza que deseja <span className="font-bold text-destructive">recusar</span> esta requisição de compra? Esta ação não poderá ser desfeita.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDecision(req.docId, 'Recusada')}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            Sim, Recusar
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
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

export default AprovacoesComprasPage;
