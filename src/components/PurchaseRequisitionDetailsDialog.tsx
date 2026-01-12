
'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import Image from 'next/image';
import { format } from 'date-fns';
import { Loader2, StickyNote, Link as LinkIcon, User, Calendar, Briefcase, AlertTriangle, Info } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, CostCenter } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

interface PurchaseRequisitionDetailsDialogProps {
  requisition: WithDocId<PurchaseRequisition> | null;
  isOpen: boolean;
  onClose: () => void;
}

type RequisitionItemWithDetails = WithDocId<PurchaseRequisitionItem> & {
  details: Partial<WithDocId<Supply> | WithDocId<Tool>>;
};

export default function PurchaseRequisitionDetailsDialog({ requisition, isOpen, onClose }: PurchaseRequisitionDetailsDialogProps) {
  const firestore = useFirestore();

  // Fetch requisition items
  const itemsQuery = useMemoFirebase(() => {
    if (!firestore || !requisition) return null;
    return query(collection(firestore, 'purchase_requisitions', requisition.docId, 'items'));
  }, [firestore, requisition]);
  
  const { data: items, isLoading: isLoadingItems, error: itemsError } = useCollection<WithDocId<PurchaseRequisitionItem>>(itemsQuery, {
      queryKey: ['requisitionItems', requisition?.docId],
      enabled: !!requisition && isOpen,
  });

  const supplyIds = useMemo(() => items?.filter(i => i.itemType === 'supply').map(i => i.itemId) || [], [items]);
  const toolIds = useMemo(() => items?.filter(i => i.itemType === 'tool').map(i => i.itemId) || [], [items]);

  // Fetch supply master data
  const { data: supplyMasterData, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(
    useMemoFirebase(() => {
      if (!firestore || supplyIds.length === 0) return null;
      return query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIds));
    }, [firestore, supplyIds.join(',')]), { enabled: supplyIds.length > 0 && isOpen }
  );

  // Fetch tool master data
  const { data: toolMasterData, isLoading: isLoadingTools } = useCollection<WithDocId<Tool>>(
    useMemoFirebase(() => {
      if (!firestore || toolIds.length === 0) return null;
      return query(collection(firestore, 'tools'), where(documentId(), 'in', toolIds));
    }, [firestore, toolIds.join(',')]), { enabled: toolIds.length > 0 && isOpen }
  );


  const costCenterQuery = useMemoFirebase(() => {
    if (!firestore || !requisition) return null;
    return query(collection(firestore, 'cost_centers'), where(documentId(), '==', requisition.costCenterId));
  }, [firestore, requisition]);
  const { data: costCenterData } = useCollection<WithDocId<CostCenter>>(costCenterQuery, { queryKey: ['costCenterForReq', requisition?.costCenterId], enabled: !!requisition && isOpen });
  const costCenter = useMemo(() => costCenterData?.[0], [costCenterData]);


  const enrichedItems = useMemo((): RequisitionItemWithDetails[] => {
    if (!items) return [];
    const masterDataMap = new Map([
        ...(supplyMasterData?.map(d => [d.docId, d]) || []),
        ...(toolMasterData?.map(d => [d.docId, d]) || [])
    ]);

    return items.map(item => ({
      ...item,
      details: masterDataMap.get(item.itemId) || { descricao: 'Item não encontrado', codigo: 'N/A' },
    }));
  }, [items, supplyMasterData, toolMasterData]);


  const getPriorityVariant = (priority?: PurchaseRequisition['priority']) => {
    if (!priority) return 'secondary';
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
  }

  const isLoading = isLoadingItems || isLoadingSupplies || isLoadingTools;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Requisição</DialogTitle>
          <DialogDescription>
            Protocolo: <span className="font-mono font-bold">{requisition?.protocol || requisition?.docId.substring(0, 8)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-4">
          {/* Header Info */}
          <div className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground"/>
                    <div>
                        <p className="text-muted-foreground">Solicitante</p>
                        <p className="font-medium">{requisition?.requesterName}</p>
                    </div>
                  </div>
                   <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground"/>
                    <div>
                        <p className="text-muted-foreground">Data da Necessidade</p>
                        <p className="font-medium">{requisition ? format(new Date(requisition.neededByDate), 'dd/MM/yyyy') : 'N/A'}</p>
                    </div>
                  </div>
                   <div className="flex items-start gap-2">
                    <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground"/>
                    <div>
                        <p className="text-muted-foreground">Centro de Custo</p>
                        <p className="font-medium">{costCenter?.code ? `${costCenter.code} - ${costCenter.description}` : requisition?.costCenterId}</p>
                    </div>
                  </div>
                   <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground"/>
                    <div>
                        <p className="text-muted-foreground">Prioridade</p>
                        <Badge variant={getPriorityVariant(requisition?.priority)}>{requisition?.priority}</Badge>
                    </div>
                  </div>
              </div>
               <div className="flex items-start gap-2 text-sm">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground"/>
                    <div>
                        <p className="text-muted-foreground">Motivo da Compra</p>
                        <p className="font-medium">{requisition?.purchaseReason}</p>
                    </div>
                </div>
                {requisition?.rejectionReason && (
                    <>
                        <Separator />
                        <div className="flex items-start gap-2 text-sm text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0"/>
                            <div>
                                <p className="font-semibold">Motivo da Revisão/Recusa</p>
                                <p className="font-medium">{requisition.rejectionReason}</p>
                            </div>
                        </div>
                    </>
                )}
          </div>
          
          {/* Items List */}
          <h3 className="font-semibold text-base">Itens Solicitados</h3>
          {isLoading && (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {itemsError && <p className="text-destructive text-center">Erro ao carregar itens.</p>}
          {!isLoading && enrichedItems.length === 0 && <p className="text-muted-foreground text-center text-sm">Nenhum item nesta requisição.</p>}
          
          <div className="space-y-3">
              {enrichedItems.map(item => (
                  <div key={item.docId} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start gap-4">
                          <Image
                              src={item.details.imageUrl || 'https://picsum.photos/seed/item/64/64'}
                              alt={item.details.descricao || 'Item'}
                              width={48}
                              height={48}
                              className="aspect-square rounded-md object-cover"
                          />
                          <div className="flex-1 text-sm">
                              <p className="font-bold">{item.details.descricao}</p>
                              <p className="font-mono text-xs text-muted-foreground">{item.details.codigo}</p>
                          </div>
                          <div className="text-right">
                              <p className="font-bold text-lg">{item.quantity} {item.details.unidadeMedida}</p>
                              {item.estimatedPrice && <p className="text-xs text-muted-foreground">Est: {(item.estimatedPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / un.</p>}
                          </div>
                      </div>
                      {(item.notes || item.attachmentUrl) && <Separator/>}
                      {item.notes && (
                          <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0"/>
                              <p className="flex-1"><strong>Obs:</strong> {item.notes}</p>
                          </div>
                      )}
                      {item.attachmentUrl && (
                          <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <LinkIcon className="h-3.5 w-3.5 mt-0.5 shrink-0"/>
                              <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-1 truncate">
                                  {item.attachmentUrl}
                               </a>
                          </div>
                      )}
                  </div>
              ))}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
