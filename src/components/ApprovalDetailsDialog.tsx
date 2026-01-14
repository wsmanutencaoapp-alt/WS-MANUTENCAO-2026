'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, documentId, doc, onSnapshot, getDocs } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import Image from 'next/image';
import { format } from 'date-fns';
import { Loader2, User, Calendar, Briefcase, Info, DollarSign, FileText, ExternalLink } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, CostCenter } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

export type RequisitionItemWithDetails = WithDocId<PurchaseRequisitionItem> & {
  details: Partial<WithDocId<Supply> | WithDocId<Tool>>;
};

interface ApprovalDetailsDialogProps {
  requisition: WithDocId<PurchaseRequisition> & { totalValue: number } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApprovalDetailsDialog({ requisition, isOpen, onClose }: ApprovalDetailsDialogProps) {
  const firestore = useFirestore();

  const [enrichedItems, setEnrichedItems] = useState<RequisitionItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const costCenterQuery = useMemoFirebase(() => {
    if (!firestore || !requisition) return null;
    return doc(firestore, 'cost_centers', requisition.costCenterId);
  }, [firestore, requisition]);
  
  const { data: costCenter } = useDoc<CostCenter>(costCenterQuery, {
      queryKey: ['costCenterForApproval', requisition?.costCenterId],
      enabled: !!requisition && isOpen,
  });

  useEffect(() => {
    if (!firestore || !requisition || !isOpen) {
        setIsLoading(false);
        return;
    };

    setIsLoading(true);
    const itemsQuery = query(collection(firestore, 'purchase_requisitions', requisition.docId, 'items'));

    const unsubscribe = onSnapshot(itemsQuery, async (itemsSnapshot) => {
        const items = itemsSnapshot.docs.map(d => ({ ...d.data() as PurchaseRequisitionItem, docId: d.id }));

        if(items.length === 0) {
            setEnrichedItems([]);
            setIsLoading(false);
            return;
        }

        const supplyIds = items.filter(i => i.itemType === 'supply').map(i => i.itemId);
        const toolIds = items.filter(i => i.itemType === 'tool').map(i => i.itemId);

        const supplyMasterData = supplyIds.length > 0 ? (await getDocs(query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIds)))).docs.map(d => ({ ...d.data() as Supply, docId: d.id })) : [];
        const toolMasterData = toolIds.length > 0 ? (await getDocs(query(collection(firestore, 'tools'), where(documentId(), 'in', toolIds)))).docs.map(d => ({ ...d.data() as Tool, docId: d.id })) : [];

        const masterDataMap = new Map([...supplyMasterData.map(d => [d.docId, d]), ...toolMasterData.map(d => [d.docId, d])]);

        const newEnrichedItems = items.map(item => ({
          ...item,
          details: masterDataMap.get(item.itemId) || { descricao: 'Item não encontrado', codigo: 'N/A' },
        }));
        
        setEnrichedItems(newEnrichedItems);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching items in real-time:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
    
  }, [requisition, firestore, isOpen]);

  const getPriorityVariant = (priority?: PurchaseRequisition['priority']) => {
    if (!priority) return 'secondary';
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes para Aprovação</DialogTitle>
          <DialogDescription>
            Protocolo: <span className="font-mono font-bold">{requisition?.protocol || 'N/A'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-4">
          <Card className="bg-muted/50">
             <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <p className="font-semibold text-muted-foreground text-sm">Valor Total Estimado</p>
                        <p className="font-bold text-2xl text-primary flex items-center gap-2">
                            {(requisition?.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="font-semibold text-muted-foreground">Solicitante</p>
                      <p className="flex items-center gap-2"><User className="h-4 w-4"/> {requisition?.requesterName}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">Centro de Custo</p>
                      <p className="flex items-center gap-2"><Briefcase className="h-4 w-4"/> {costCenter?.description || '...'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">Data de Necessidade</p>
                      <p className="flex items-center gap-2"><Calendar className="h-4 w-4"/> {requisition ? format(new Date(requisition.neededByDate), 'dd/MM/yyyy') : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">Prioridade</p>
                      <p><Badge variant={getPriorityVariant(requisition?.priority)}>{requisition?.priority}</Badge></p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-semibold text-muted-foreground">Motivo da Compra</p>
                      <p className="flex items-start gap-2"><Info className="h-4 w-4 mt-0.5 shrink-0"/> {requisition?.purchaseReason}</p>
                    </div>
                </div>
             </CardContent>
          </Card>


          <h3 className="font-semibold text-base pt-2">Itens da Solicitação</h3>
          {isLoading && <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {!isLoading && enrichedItems.length === 0 && <p className="text-muted-foreground text-center text-sm">Nenhum item encontrado.</p>}
          
          <div className="space-y-3">
              {enrichedItems.map(item => {
                  const subtotal = (item.estimatedPrice || 0) * item.quantity;
                  return (
                    <div key={item.docId} className="flex items-start gap-4 rounded-lg border p-3">
                        <Image
                            src={item.details.imageUrl || 'https://picsum.photos/seed/item/64/64'}
                            alt={item.details.descricao || 'Item'}
                            width={64}
                            height={64}
                            className="aspect-square rounded-md object-cover"
                        />
                        <div className="flex-1 text-sm space-y-1">
                            <p className="font-bold">{item.details.descricao}</p>
                            <p className="font-mono text-xs text-muted-foreground">{item.details.codigo}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {item.quantity} {item.details.unidadeMedida}</p>
                            {item.attachmentUrl && (
                                <Button asChild variant="link" size="sm" className="p-0 h-auto text-xs">
                                  <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-1 h-3 w-3" /> Ver Anexo do Item
                                  </a>
                                </Button>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-lg">{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-xs text-muted-foreground">
                                {item.quantity} x { (item.estimatedPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
                            </p>
                        </div>
                    </div>
                  )
                })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
