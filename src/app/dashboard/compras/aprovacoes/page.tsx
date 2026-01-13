'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDocs, documentId, writeBatch, addDoc } from 'firebase/firestore';
import type { PurchaseRequisition, PurchaseRequisitionItem, CostCenter, Supply, Tool, Notification, Employee } from '@/lib/types';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Eye, CheckCircle, XCircle, MessageSquareWarning } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';


type RequisitionWithTotal = WithDocId<PurchaseRequisition> & {
    totalValue: number;
};

const AprovacoesComprasPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionsWithTotals, setRequisitionsWithTotals] = useState<RequisitionWithTotal[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<{
      isOpen: boolean;
      requisition: WithDocId<PurchaseRequisition> | null;
      type: 'reject' | 'review';
      reason: string;
  }>({ isOpen: false, requisition: null, type: 'reject', reason: '' });

  const queryKey = 'pendingPurchaseRequisitions';
  // Query for requisitions that need some form of approval/action by a manager.
  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), where('status', 'in', ['Em Aprovação', 'Aberta']));
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

  useMemo(() => {
    if (!requisitions || !firestore) return;

    const calculateTotals = async () => {
        const enrichedReqs: RequisitionWithTotal[] = [];
        for (const req of requisitions) {
            // For OCs, the total is already on the document. For SCs, we calculate it.
            if (req.type === 'Ordem de Compra') {
                enrichedReqs.push({ ...req, totalValue: req.totalValue || 0 });
            } else {
                const itemsRef = collection(firestore, 'purchase_requisitions', req.docId, 'items');
                const itemsSnapshot = await getDocs(itemsRef);
                let totalValue = 0;
                itemsSnapshot.forEach(doc => {
                    const item = doc.data() as PurchaseRequisitionItem;
                    totalValue += (item.estimatedPrice || 0) * item.quantity;
                });
                enrichedReqs.push({ ...req, totalValue });
            }
        }
        setRequisitionsWithTotals(enrichedReqs);
    };

    calculateTotals();
  }, [requisitions, firestore]);

  const handleDecision = async (req: WithDocId<PurchaseRequisition>, newStatus: 'Aprovada' | 'Recusada' | 'Em Revisão', reason?: string) => {
      if (!firestore) return;
      setIsProcessing(req.docId);
      
      const batch = writeBatch(firestore);
      const reqRef = doc(firestore, 'purchase_requisitions', req.docId);

      const updateData: { status: string; rejectionReason?: string } = { status: newStatus };
      if (reason) {
          updateData.rejectionReason = reason;
      }
      batch.update(reqRef, updateData);
      
      // Create notification
      const notificationRef = doc(collection(firestore, `employees/${req.requesterId}/notifications`));
      const notification: Omit<Notification, 'id'> = {
          userId: req.requesterId,
          title: `Requisição ${newStatus}`,
          message: `Sua requisição ${req.protocol} foi marcada como "${newStatus}". ${reason ? `Motivo: ${reason}` : ''}`,
          link: '/dashboard/compras/requisicao',
          read: false,
          createdAt: new Date().toISOString(),
      };
      batch.set(notificationRef, notification);

      try {
          await batch.commit();
          toast({
              title: `Requisição ${newStatus}`,
              description: `A requisição foi atualizada e o solicitante notificado.`,
              variant: newStatus === 'Recusada' ? 'destructive' : 'default',
          });
          queryClient.invalidateQueries({ queryKey: [queryKey] });
          queryClient.invalidateQueries({ queryKey: ['allPurchaseRequisitions'] });
      } catch (err) {
          console.error("Erro ao atualizar requisição:", err);
          toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível processar a sua decisão.' });
      } finally {
          setIsProcessing(null);
          setDecisionState({ isOpen: false, requisition: null, type: 'reject', reason: '' });
      }
  }

  const openDecisionDialog = (req: WithDocId<PurchaseRequisition>, type: 'reject' | 'review') => {
      setDecisionState({ isOpen: true, requisition: req, type, reason: '' });
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

  const getStatusVariant = (status: PurchaseRequisition['status']) => {
    const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
        'Aberta': 'secondary',
        'Em Aprovação': 'default',
        'Em Revisão': 'warning',
        'Aprovada': 'success',
        'Recusada': 'destructive',
        'Concluída': 'secondary',
        'Parcialmente Atendida': 'warning',
        'Totalmente Atendida': 'success',
        'Cancelada': 'destructive',
        'Em Cotação': 'default',
    };
    return variants[status] || 'secondary';
  }

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Aprovação de Requisições e Ordens</h1>
        <Card>
          <CardHeader>
            <CardTitle>Requisições e Ordens Pendentes</CardTitle>
            <CardDescription>
              Analise, aprove ou recuse documentos que aguardam sua ação.
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
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
                  <TableRow key={req.docId} className={cn(req.type === 'Ordem de Compra' && 'bg-blue-50 dark:bg-blue-900/20')}>
                    <TableCell>
                      <Badge variant={req.type === 'Ordem de Compra' ? 'default' : 'secondary'}>{req.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{req.protocol || req.docId.substring(0, 8)}</TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                    <TableCell className="font-medium">{req.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                     <TableCell>
                        <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        {isProcessing === req.docId ? <Loader2 className="animate-spin h-5 w-5 ml-auto"/> : (
                            <>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedRequisition(req)} title="Ver Itens">
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleDecision(req, 'Aprovada')} title="Aprovar">
                                    <CheckCircle className="h-5 w-5" />
                                </Button>
                                 <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-600" onClick={() => openDecisionDialog(req, 'review')} title="Pedir Revisão">
                                    <MessageSquareWarning className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => openDecisionDialog(req, 'reject')} title="Rejeitar">
                                    <XCircle className="h-5 w-5" />
                                </Button>
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

       <Dialog open={decisionState.isOpen} onOpenChange={() => setDecisionState(prev => ({...prev, isOpen: false}))}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>
                      {decisionState.type === 'reject' ? 'Rejeitar Documento' : 'Pedir Revisão do Documento'}
                  </DialogTitle>
                  <DialogDescription>
                      Por favor, informe o motivo para esta ação. A justificativa será enviada ao solicitante.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                  <Label htmlFor="reason">Justificativa <span className="text-destructive">*</span></Label>
                  <Textarea
                      id="reason"
                      value={decisionState.reason}
                      onChange={(e) => setDecisionState(prev => ({...prev, reason: e.target.value}))}
                      placeholder="Ex: Item fora de especificação, valor acima do orçado, etc."
                  />
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setDecisionState(prev => ({...prev, isOpen: false}))}>Cancelar</Button>
                  <Button
                      onClick={() => handleDecision(decisionState.requisition!, decisionState.type === 'reject' ? 'Recusada' : 'Em Revisão', decisionState.reason)}
                      disabled={!decisionState.reason || isProcessing === decisionState.requisition?.docId}
                      variant={decisionState.type === 'reject' ? 'destructive' : 'default'}
                  >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirmar'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
};

export default AprovacoesComprasPage;
