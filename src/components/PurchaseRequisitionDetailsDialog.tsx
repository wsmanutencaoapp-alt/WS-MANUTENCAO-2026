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
import { Loader2, StickyNote, Link as LinkIcon, User, Calendar, Briefcase, AlertTriangle, Info, ShoppingBag, Award, FileText } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, CostCenter, Quotation } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import QuotationDialog from './QuotationDialog';
import { useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';


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
    if (item.status !== 'Pendente') return; // Block selection if not pending
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
  
  const quotationCount = requisition?.quotations?.length || 0;

  const isLoading = isLoadingItems || isLoadingSupplies || isLoadingTools || isLoadingCostCenter;
  const isPurchaseOrder = requisition?.type === 'Ordem de Compra';

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

           {isPurchaseOrder && requisition?.quotations && (
             <div className="space-y-3">
                <h3 className="font-semibold text-base">Cotações Realizadas</h3>
                {requisition.expensiveChoiceJustification && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Justificativa da Escolha</AlertTitle>
                      <AlertDescription>
                        {requisition.expensiveChoiceJustification}
                      </AlertDescription>
                    </Alert>
                )}
                 <div className="grid grid-cols-1 gap-3">
                    {requisition.quotations.filter(q => q.totalValue > 0).map((quote, index) => (
                        <div key={index} className={cn("rounded-lg border p-3", requisition.selectedQuotationIndex === index && "bg-blue-50 dark:bg-blue-900/30 border-blue-400")}>
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold">{quote.supplierName}</h4>
                                {requisition.selectedQuotationIndex === index && <Badge variant="default"><Award className="mr-1 h-3 w-3"/>Vencedor</Badge>}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                <div>
                                    <p className="text-muted-foreground">Valor Total</p>
                                    <p className="font-semibold">{quote.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                 <div>
                                    <p className="text-muted-foreground">Prazo</p>
                                    <p className="font-semibold">{quote.deliveryTime} dias</p>
                                </div>
                                 <div>
                                    <p className="text-muted-foreground">Pagamento</p>
                                    <p className="font-semibold">{quote.paymentTerms}</p>
                                </div>
                            </div>
                            {quote.attachmentUrl && (
                                <Button asChild variant="link" size="sm" className="p-0 h-auto mt-2 text-xs">
                                    <a href={quote.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                        <FileText className="mr-1 h-3 w-3"/>
                                        Ver anexo da cotação
                                    </a>
                                </Button>
                            )}
                        </div>
                    ))}
                 </div>
             </div>
          )}
          
          <h3 className="font-semibold text-base mt-4">Itens Solicitados</h3>
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
                      {!isPurchaseOrder && (
                          <Checkbox 
                            id={`select-item-${item.docId}`}
                            checked={selectedItemsForQuotation.some(i => i.docId === item.docId)}
                            onCheckedChange={() => handleItemSelection(item)}
                            disabled={item.status !== 'Pendente'}
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
                          <Badge variant={item.status === 'Pendente' ? 'default' : 'success'}>
                            {item.status === 'Pendente' ? 'Pendente Cotação' : item.status}
                          </Badge>
                      </div>
                      <div className="text-right">
                          <p className="font-bold text-lg">{item.quantity} {item.details.unidadeMedida}</p>
                          {item.estimatedPrice && <p className="text-xs text-muted-foreground">Est: {(item.estimatedPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / un.</p>}
                           {!isPurchaseOrder && (
                            <Badge variant="outline" className="mt-2">Cotações: {quotationCount}/3</Badge>
                          )}
                      </div>
                  </div>
              ))}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
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
