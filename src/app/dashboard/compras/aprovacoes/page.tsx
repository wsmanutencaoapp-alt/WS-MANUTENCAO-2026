
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDocs, documentId, writeBatch, addDoc, onSnapshot } from 'firebase/firestore';
import type { PurchaseRequisition, PurchaseRequisitionItem, CostCenter, Supply, Tool, Notification, Employee, Budget, ApprovalTier } from '@/lib/types';
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
import { Loader2, Search, Eye, CheckCircle, XCircle, MessageSquareWarning, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import ApprovalDetailsDialog from '@/components/ApprovalDetailsDialog';
import { Switch } from '@/components/ui/switch';


type RequisitionWithTotal = WithDocId<PurchaseRequisition> & {
    totalValue: number;
    needsLevel2Approval: boolean;
};

const AprovacoesComprasPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionWithTotal | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<{
      isOpen: boolean;
      requisition: WithDocId<PurchaseRequisition> | null;
      type: 'reject' | 'review';
      reason: string;
  }>({ isOpen: false, requisition: null, type: 'reject', reason: '' });
  
  const [showAllForLevel2, setShowAllForLevel2] = useState(false);
  const [requisitionsWithTotals, setRequisitionsWithTotals] = useState<RequisitionWithTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- DATA FETCHING ---
  const { data: currentUserData } = useDoc<Employee>(useMemoFirebase(() => (firestore && user) ? doc(firestore, 'employees', user.uid) : null, [firestore, user]));
  const { data: approvalTiers, isLoading: isLoadingTiers } = useCollection<WithDocId<ApprovalTier>>(useMemoFirebase(() => firestore ? query(collection(firestore, 'approval_tiers')) : null, [firestore]));
  const { data: budgets, isLoading: isLoadingBudgets } = useCollection<WithDocId<Budget>>(useMemoFirebase(() => firestore ? query(collection(firestore, 'budgets')) : null, [firestore]));

  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), where('status', '==', 'Em Aprovação'));
  }, [firestore]);

  useEffect(() => {
    if (!requisitionsQuery || !budgets) {
        setIsLoading(false);
        return;
    };
    setIsLoading(true);

    const budgetsMap = new Map(budgets.map(b => [`${b.costCenterId}-${b.period}`, b]));
    const currentPeriod = format(new Date(), 'yyyy-MM');

    const unsubscribe = onSnapshot(requisitionsQuery, async (querySnapshot) => {
      const reqs = querySnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() } as WithDocId<PurchaseRequisition>));
      
      const reqsWithTotals: RequisitionWithTotal[] = await Promise.all(
          reqs.map(async (req) => {
              let totalValue = req.totalValue || 0;
              if (req.type === 'Solicitação de Compra') {
                  const itemsRef = collection(firestore, 'purchase_requisitions', req.docId, 'items');
                  const itemsSnapshot = await getDocs(itemsRef);
                  totalValue = itemsSnapshot.docs.reduce((sum, doc) => {
                      const item = doc.data() as PurchaseRequisitionItem;
                      const winningQuote = (item.quotations && item.selectedQuotationIndex !== undefined) ? item.quotations[item.selectedQuotationIndex] : null;
                      return sum + (winningQuote?.totalValue || item.estimatedPrice || 0) * item.quantity;
                  }, 0);
              }
              
              const budgetKey = `${req.costCenterId}-${currentPeriod}`;
              const costCenterBudget = budgetsMap.get(budgetKey);
              const needsLevel2Approval = !costCenterBudget || totalValue > ((costCenterBudget.totalAmount || 0) - (costCenterBudget.spentAmount || 0));

              return { ...req, totalValue, needsLevel2Approval };
          })
      );
      
      setRequisitionsWithTotals(reqsWithTotals);
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching requisitions:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [requisitionsQuery, firestore, budgets]);


  // --- PERMISSION LOGIC ---
  const { isLevel2Approver, level1CostCenterIds } = useMemo(() => {
    if (!approvalTiers || !user) return { isLevel2Approver: false, level1CostCenterIds: new Set() };
    
    const level1CostCenterIds = new Set<string>();
    let isL2 = false;

    approvalTiers.forEach(tier => {
        if (tier.approverId === user.uid) {
            if (tier.level === 1) level1CostCenterIds.add(tier.costCenterId);
            if (tier.level === 2) isL2 = true;
        }
    });
    return { isLevel2Approver: isL2, level1CostCenterIds };

  }, [approvalTiers, user]);
  
  // --- FILTERING LOGIC ---
  const filteredRequisitions = useMemo(() => {
    let displayList = requisitionsWithTotals;
    const isAdmin = currentUserData?.accessLevel === 'Admin' || user?.uid === 'SOID8C723XUmlniI3mpjBmBPA5v1';

    if (!isAdmin) {
        if (isLevel2Approver && showAllForLevel2) {
            // Show all, no extra filtering needed
        } else {
            displayList = requisitionsWithTotals.filter(req => {
                const isL1ForItem = level1CostCenterIds.has(req.costCenterId);
                if (isL1ForItem && !req.needsLevel2Approval) return true;
                if (isLevel2Approver && req.needsLevel2Approval) return true;
                return false;
            });
        }
    }

    if (!searchTerm) return displayList;
    const lowercasedTerm = searchTerm.toLowerCase();
    return displayList.filter(req => 
        (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
        req.requesterName.toLowerCase().includes(lowercasedTerm)
    );
  }, [requisitionsWithTotals, searchTerm, currentUserData, isLevel2Approver, level1CostCenterIds, showAllForLevel2, user]);
  
  
  // --- ACTIONS ---
  const handleDecision = async (req: RequisitionWithTotal, newStatus: 'Aprovada' | 'Recusada' | 'Em Revisão', reason?: string) => {
      if (!firestore) return;
      setIsProcessing(req.docId);
      
      try {
          const batch = writeBatch(firestore);
          const reqRef = doc(firestore, 'purchase_requisitions', req.docId);

          let updateData: { status: string; rejectionReason?: string } = { status: newStatus };
          if (reason) updateData.rejectionReason = reason;
          if (newStatus === 'Aprovada' && req.type === 'Ordem de Compra') {
            updateData.status = 'Aguardando Entrega';
          }

          batch.update(reqRef, updateData);
          
          if (newStatus === 'Aprovada') {
              const currentPeriod = format(new Date(), 'yyyy-MM');
              const budgetQuery = query(collection(firestore, 'budgets'), where('costCenterId', '==', req.costCenterId), where('period', '==', currentPeriod));
              const budgetSnapshot = await getDocs(budgetQuery);

              if (!budgetSnapshot.empty) {
                  const budgetDoc = budgetSnapshot.docs[0];
                  const budgetData = budgetDoc.data() as Budget;
                  batch.update(budgetDoc.ref, { spentAmount: (budgetData.spentAmount || 0) + req.totalValue });
              }
          }
          
          const notificationRef = doc(collection(firestore, `employees/${req.requesterId}/notifications`));
          batch.set(notificationRef, {
              userId: req.requesterId, title: `Requisição ${newStatus}`,
              message: `Sua requisição ${req.protocol} foi marcada como "${newStatus}". ${reason ? `Motivo: ${reason}` : ''}`,
              link: '/dashboard/compras/requisicao', read: false, createdAt: new Date().toISOString(),
          });

          await batch.commit();
          toast({
              title: `Requisição ${newStatus}`, description: `A requisição foi atualizada.`,
              variant: newStatus === 'Recusada' ? 'destructive' : 'default',
          });
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

  const getStatusVariant = (status: PurchaseRequisition['status']) => {
    const variants: { [key: string]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
        'Aberta': 'secondary', 'Em Aprovação': 'default', 'Em Revisão': 'warning', 'Aprovada': 'success',
        'Recusada': 'destructive', 'Concluída': 'secondary', 'Cancelada': 'destructive',
        'Em Cotação': 'default', 'Aguardando Entrega': 'default',
    };
    return variants[status] || 'secondary';
  }

  const userIsMasterAdmin = user?.uid === 'SOID8C723XUmlniI3mpjBmBPA5v1' || currentUserData?.accessLevel === 'Admin';

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Aprovação de Requisições e Ordens</h1>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Requisições e Ordens Pendentes</CardTitle>
                    <CardDescription>Analise, aprove ou recuse documentos que aguardam sua ação.</CardDescription>
                </div>
                {userIsMasterAdmin && (
                    <div className="flex items-center space-x-2">
                        <Switch id="show-all-switch" checked={showAllForLevel2} onCheckedChange={setShowAllForLevel2} />
                        <Label htmlFor="show-all-switch" className="flex items-center gap-1"><ArrowRightLeft className="h-4 w-4"/> Ver Todas</Label>
                    </div>
                )}
            </div>
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
                {!isLoading && filteredRequisitions.length === 0 && (
                   <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma requisição aguardando sua ação.</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.map(req => (
                  <TableRow key={req.docId} className={cn(req.type === 'Ordem de Compra' && 'bg-blue-50 dark:bg-blue-900/20')}>
                    <TableCell>
                      <Badge variant={req.type === 'Ordem de Compra' ? 'default' : 'secondary'}>{req.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{req.protocol || req.docId.substring(0, 8)}</TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                    <TableCell className="font-medium">{(req.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                     <TableCell>
                        <Badge variant={req.needsLevel2Approval ? 'destructive' : 'default'}>{req.needsLevel2Approval ? 'Nível 2' : 'Nível 1'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        {isProcessing === req.docId ? <Loader2 className="animate-spin h-5 w-5 ml-auto"/> : (
                            <>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedRequisition(req)} title="Ver Itens"><Eye className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleDecision(req, 'Aprovada')} title="Aprovar"><CheckCircle className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-600" onClick={() => openDecisionDialog(req, 'review')} title="Pedir Revisão"><MessageSquareWarning className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => openDecisionDialog(req, 'reject')} title="Rejeitar"><XCircle className="h-5 w-5" /></Button>
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

      {selectedRequisition && (
        <ApprovalDetailsDialog
            requisition={selectedRequisition}
            isOpen={!!selectedRequisition}
            onClose={() => setSelectedRequisition(null)}
        />
      )}

       <Dialog open={decisionState.isOpen} onOpenChange={() => setDecisionState(prev => ({...prev, isOpen: false}))}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{decisionState.type === 'reject' ? 'Rejeitar Documento' : 'Pedir Revisão do Documento'}</DialogTitle>
                  <DialogDescription>Por favor, informe o motivo para esta ação. A justificativa será enviada ao solicitante.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                  <Label htmlFor="reason">Justificativa <span className="text-destructive">*</span></Label>
                  <Textarea id="reason" value={decisionState.reason} onChange={(e) => setDecisionState(prev => ({...prev, reason: e.target.value}))} placeholder="Ex: Item fora de especificação, valor acima do orçado, etc."/>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setDecisionState(prev => ({...prev, isOpen: false}))}>Cancelar</Button>
                  <Button onClick={() => handleDecision(decisionState.requisition! as RequisitionWithTotal, decisionState.type === 'reject' ? 'Recusada' : 'Em Revisão', decisionState.reason)} disabled={!decisionState.reason || isProcessing === decisionState.requisition?.docId} variant={decisionState.type === 'reject' ? 'destructive' : 'default'}>
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirmar'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
};

export default AprovacoesComprasPage;
