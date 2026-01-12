'use client';

import { useMemo, useState } from 'react';
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
import { Loader2, StickyNote, Link as LinkIcon, User, Calendar, Briefcase, AlertTriangle, Info, ShoppingBag } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, CostCenter } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import QuotationDialog from './QuotationDialog';
import { useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';


interface PurchaseRequisitionDetailsDialogProps {
  requisition: WithDocId<PurchaseRequisition> | null;
  isOpen: boolean;
  onClose: () => void;
  onActionSuccess?: () => void; 
}

export type RequisitionItemWithDetails = WithDocId<PurchaseRequisitionItem> & {
  details: Partial<WithDocId<Supply> | WithDocId<Tool>>;
};

export default function PurchaseRequisitionDetailsDialog({ requisition, isOpen, onClose, onActionSuccess }: PurchaseRequisitionDetailsDialogProps) {
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const [selectedItemsForQuotation, setSelectedItemsForQuotation] = useState<RequisitionItemWithDetails[]>([]);
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false);

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

  const suppliesQuery = useMemoFirebase(() => {
      if (!firestore || supplyIds.length === 0) return null;
      return query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIds));
  }, [firestore, supplyIds.join(',')]);
  const { data: supplyMasterData, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery, { enabled: supplyIds.length > 0 && isOpen });

  const toolsQuery = useMemoFirebase(() => {
    if (!firestore || toolIds.length === 0) return null;
    return query(collection(firestore, 'tools'), where(documentId(), 'in', toolIds));
  }, [firestore, toolIds.join(',')]);
  const { data: toolMasterData, isLoading: isLoadingTools } = useCollection<WithDocId<Tool>>(toolsQuery, { enabled: toolIds.length > 0 && isOpen });

  const costCenterQuery = useMemoFirebase(() => {
    if (!firestore || !requisition) return null;
    return query(collection(firestore, 'cost_centers'), where(documentId(), '==', requisition.costCenterId));
  }, [firestore, requisition]);
  const { data: costCenterData, isLoading: isLoadingCostCenter } = useCollection<WithDocId<CostCenter>>(costCenterQuery, { queryKey: ['costCenterForReq', requisition?.costCenterId], enabled: !!requisition && isOpen });
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

  const handleItemSelection = (item: RequisitionItemWithDetails) => {
    setSelectedItemsForQuotation(prev => {
        const isSelected = prev.some(i => i.docId === item.docId);
        if (isSelected) {
            return prev.filter(i => i.docId !== item.docId);
        } else {
            return [...prev, item];
        }
    });
  };

  const handleStartQuotation = () => {
      if (selectedItemsForQuotation.length > 0) {
          setIsQuotationDialogOpen(true);
      }
  };

  const handleQuotationSuccess = () => {
    setIsQuotationDialogOpen(false);
    setSelectedItemsForQuotation([]);
    queryClient.invalidateQueries({ queryKey: ['requisitionItems', requisition?.docId] });
    onActionSuccess?.();
    onClose();
  }

  const getPriorityVariant = (priority?: PurchaseRequisition['priority']) => {
    if (!priority) return 'secondary';
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
  }

  const isLoading = isLoadingItems || isLoadingSupplies || isLoadingTools || isLoadingCostCenter;

  return (
    <>
    <Dialog open={isOpen && !isQuotationDialogOpen} onOpenChange={(open) => { if(!open) { onClose(); setSelectedItemsForQuotation([]); }}}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Requisição</DialogTitle>
          <DialogDescription>
            Protocolo: <span className="font-mono font-bold">{requisition?.protocol || requisition?.docId.substring(0, 8)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {/* Header Info */}
              </div>
          </div>
          
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
                  <div key={item.docId} className="flex items-start gap-4 rounded-lg border p-3">
                      <Checkbox 
                        id={`select-item-${item.docId}`}
                        checked={selectedItemsForQuotation.some(i => i.docId === item.docId)}
                        onCheckedChange={() => handleItemSelection(item)}
                        className="mt-1"
                      />
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
                          <Badge variant={item.status === 'Pendente' ? 'default' : 'success'}>{item.status}</Badge>
                      </div>
                      <div className="text-right">
                          <p className="font-bold text-lg">{item.quantity} {item.details.unidadeMedida}</p>
                          {item.estimatedPrice && <p className="text-xs text-muted-foreground">Est: {(item.estimatedPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / un.</p>}
                      </div>
                  </div>
              ))}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleStartQuotation} disabled={selectedItemsForQuotation.length === 0}>
            <ShoppingBag className="mr-2 h-4 w-4"/>
            Realizar Cotação para Itens Selecionados ({selectedItemsForQuotation.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {requisition && isQuotationDialogOpen && (
      <QuotationDialog
        isOpen={isQuotationDialogOpen}
        onClose={() => setIsQuotationDialogOpen(false)}
        requisition={requisition}
        items={selectedItemsForQuotation}
        onSuccess={handleQuotationSuccess}
      />
    )}
    </>
  );
}
