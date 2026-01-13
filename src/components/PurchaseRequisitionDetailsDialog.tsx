'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, documentId, doc, getDoc, onSnapshot } from 'firebase/firestore';
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
import { Loader2, ShoppingBag, User, Calendar, Briefcase, Info } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, CostCenter, Quotation } from '@/lib/types';
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

export default function PurchaseRequisitionDetailsDialog({ requisition: initialRequisition, isOpen, onClose, onActionSuccess }: PurchaseRequisitionDetailsDialogProps) {
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const [requisition, setRequisition] = useState<WithDocId<PurchaseRequisition> | null>(initialRequisition);
  const [enrichedItems, setEnrichedItems] = useState<RequisitionItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedItemsForQuotation, setSelectedItemsForQuotation] = useState<RequisitionItemWithDetails[]>([]);
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false);
  
  useEffect(() => {
    if (!firestore || !initialRequisition?.docId) {
        setRequisition(initialRequisition);
        return;
    };
    
    // Listen for real-time updates on the main requisition document
    const unsub = onSnapshot(doc(firestore, 'purchase_requisitions', initialRequisition.docId), (doc) => {
        if (doc.exists()) {
            setRequisition({ docId: doc.id, ...doc.data() as PurchaseRequisition });
        }
    });

    return () => unsub();
  }, [initialRequisition, firestore]);

  const costCenterQuery = useMemoFirebase(() => {
    if (!firestore || !requisition) return null;
    return doc(firestore, 'cost_centers', requisition.costCenterId);
  }, [firestore, requisition]);
  
  const { data: costCenter } = useDoc<CostCenter>(costCenterQuery, {
      queryKey: ['costCenterForReq', requisition?.costCenterId],
      enabled: !!requisition && isOpen,
  });

  // Effect to fetch and enrich items whenever the requisition or dialog state changes
  useEffect(() => {
    const fetchAndEnrichItems = async () => {
        if (!firestore || !requisition || !isOpen) {
          setIsLoading(false);
          return;
        };

        setIsLoading(true);

        // Fetch items
        const itemsQuery = query(collection(firestore, 'purchase_requisitions', requisition.docId, 'items'));
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(d => ({ ...d.data() as PurchaseRequisitionItem, docId: d.id }));

        // Fetch master data
        const supplyIds = items.filter(i => i.itemType === 'supply').map(i => i.itemId);
        const toolIds = items.filter(i => i.itemType === 'tool').map(i => i.itemId);

        const supplyMasterData = supplyIds.length > 0
            ? (await getDocs(query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIds)))).docs.map(d => ({ ...d.data() as Supply, docId: d.id }))
            : [];
        
        const toolMasterData = toolIds.length > 0
            ? (await getDocs(query(collection(firestore, 'tools'), where(documentId(), 'in', toolIds)))).docs.map(d => ({ ...d.data() as Tool, docId: d.id }))
            : [];

        const masterDataMap = new Map([
            ...supplyMasterData.map(d => [d.docId, d]),
            ...toolMasterData.map(d => [d.docId, d])
        ]);

        const newEnrichedItems = items.map(item => ({
          ...item,
          details: masterDataMap.get(item.itemId) || { descricao: 'Item não encontrado', codigo: 'N/A' },
        }));
        
        setEnrichedItems(newEnrichedItems);
        setIsLoading(false);
    };
    
    fetchAndEnrichItems();
  }, [requisition, firestore, isOpen]);


  const handleItemSelection = (item: RequisitionItemWithDetails) => {
    if (item.status !== 'Pendente' && item.status !== 'Em Cotação') return;
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
    
    // Manually refetch related data
    queryClient.invalidateQueries({ queryKey: ['requisitionItems', requisition?.docId] });
    queryClient.invalidateQueries({ queryKey: ['allPurchaseRequisitionsForControl'] });
    if (onActionSuccess) onActionSuccess();
  }
  
  const handleDialogClose = () => {
    onClose();
    setSelectedItemsForQuotation([]);
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
  
  const isPurchaseOrder = requisition?.type === 'Ordem de Compra';

  return (
    <>
    <Dialog open={isOpen && !isQuotationDialogOpen} onOpenChange={(open) => { if(!open) { handleDialogClose(); }}}>
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
                <div>
                  <p className="font-semibold text-muted-foreground">Solicitante</p>
                  <p className="flex items-center gap-2"><User className="h-4 w-4"/> {requisition?.requesterName}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Centro de Custo</p>
                  <p className="flex items-center gap-2"><Briefcase className="h-4 w-4"/> {costCenter?.description || 'Carregando...'}</p>
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
          </div>

          <div className="flex justify-between items-center mt-4">
            <h3 className="font-semibold text-base">Itens Solicitados</h3>
          </div>
          {isLoading && (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {!isLoading && enrichedItems.length === 0 && <p className="text-muted-foreground text-center text-sm">Nenhum item nesta requisição.</p>}
          
          <div className="space-y-3">
              {enrichedItems.map(item => {
                  const quotationCount = (item.quotations || []).filter(q => q?.totalValue > 0).length;
                  return (
                      <div key={item.docId} className="flex items-start gap-4 rounded-lg border p-3">
                          {!isPurchaseOrder && (
                              <Checkbox 
                                id={`select-item-${item.docId}`}
                                checked={selectedItemsForQuotation.some(i => i.docId === item.docId)}
                                onCheckedChange={() => handleItemSelection(item)}
                                disabled={item.status !== 'Pendente' && item.status !== 'Em Cotação'}
                                className="mt-1"
                              />
                          )}
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
                              <Badge variant={item.status === 'Pendente' ? 'default' : item.status === 'Em Cotação' ? 'warning' : 'success'}>
                                {item.status}
                              </Badge>
                          </div>
                          <div className="text-right">
                              <p className="font-bold text-lg">{item.quantity} {item.details.unidadeMedida}</p>
                              <Badge variant="outline">Cotações: {quotationCount}/3</Badge>
                          </div>
                      </div>
                  )
                })}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={handleDialogClose}>Fechar</Button>
          {!isPurchaseOrder && (
            <Button onClick={handleStartQuotation} disabled={selectedItemsForQuotation.length === 0}>
                <ShoppingBag className="mr-2 h-4 w-4"/>
                Realizar Cotação para Itens Selecionados ({selectedItemsForQuotation.length})
            </Button>
          )}
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