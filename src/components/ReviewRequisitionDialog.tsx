'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, getDocs, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type { Supply, Tool, PurchaseRequisition, PurchaseRequisitionItem } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from './ui/textarea';

type RequisitionableItem = (WithDocId<Supply> | WithDocId<Tool>) & { itemType: 'supply' | 'tool' };
type CartItem = RequisitionableItem & {
    requisitionQuantity: number;
    estimatedPrice?: number;
    notes?: string;
    attachmentUrl?: string;
    existingItemId?: string; // ID of the item in the subcollection
};

interface ReviewRequisitionDialogProps {
  requisition: WithDocId<PurchaseRequisition> | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewRequisitionDialog({ requisition, isOpen, onClose, onSuccess }: ReviewRequisitionDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all master data to map item details
  const suppliesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'supplies')) : null, [firestore]);
  const { data: allSupplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery, {queryKey: ['allSuppliesForReview']});
  const toolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'tools')) : null, [firestore]);
  const { data: allTools, isLoading: isLoadingTools } = useCollection<WithDocId<Tool>>(toolsQuery, {queryKey: ['allToolModelsForReview']});
  
  const masterDataMap = useMemo(() => {
    if (isLoadingSupplies || isLoadingTools) return new Map();
    const items = [
      ...(allSupplies?.map(s => ({...s, itemType: 'supply' as const })) || []),
      ...(allTools?.map(t => ({...t, itemType: 'tool' as const })) || [])
    ];
    return new Map(items.map(item => [item.docId, item]));
  }, [allSupplies, allTools, isLoadingSupplies, isLoadingTools]);
  
  useEffect(() => {
    const fetchRequisitionItems = async () => {
        if (!requisition || !firestore || !masterDataMap.size) return;

        setIsLoading(true);
        try {
            const itemsRef = collection(firestore, 'purchase_requisitions', requisition.docId, 'items');
            const itemsSnapshot = await getDocs(itemsRef);
            
            const fetchedItems: CartItem[] = [];
            itemsSnapshot.forEach(itemDoc => {
                const itemData = itemDoc.data() as PurchaseRequisitionItem;
                const masterDataItem = masterDataMap.get(itemData.itemId);
                
                if (masterDataItem) {
                    fetchedItems.push({
                        ...masterDataItem,
                        requisitionQuantity: itemData.quantity,
                        estimatedPrice: itemData.estimatedPrice,
                        notes: itemData.notes,
                        attachmentUrl: itemData.attachmentUrl,
                        existingItemId: itemDoc.id,
                    });
                }
            });
            setCart(fetchedItems);
            setDeletedItemIds([]); // Reset deleted items on new load
        } catch (error) {
            console.error("Erro ao buscar itens da requisição:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os itens da requisição.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isOpen && masterDataMap.size > 0) {
        fetchRequisitionItems();
    }
  }, [requisition, isOpen, firestore, toast, masterDataMap]);


  const removeFromCart = (docId: string, existingItemId?: string) => {
    setCart(prev => prev.filter(item => item.docId !== docId));
    if (existingItemId) {
      setDeletedItemIds(prev => [...prev, existingItemId]);
    }
  };

  const updateCartItem = (docId: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => item.docId === docId ? { ...item, [field]: value } : item));
  };
  
  const handleSubmitUpdate = async () => {
    if (!firestore || !user || !requisition) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Dados da sessão inválidos.' });
        return;
    }
    if (cart.length === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A requisição não pode ficar sem itens.' });
        return;
    }

    setIsSubmitting(true);
    try {
        const batch = writeBatch(firestore);
        const requisitionRef = doc(firestore, 'purchase_requisitions', requisition.docId);

        // Update requisition status back to 'Em Aprovação' to re-enter the approval flow
        batch.update(requisitionRef, { status: 'Em Aprovação', rejectionReason: '' });

        // Process updated and new items
        for (const item of cart) {
            const itemRef = item.existingItemId
                ? doc(firestore, 'purchase_requisitions', requisition.docId, 'items', item.existingItemId)
                : doc(collection(firestore, 'purchase_requisitions', requisition.docId, 'items')); // For items added during edit
            
            const itemData: Omit<PurchaseRequisitionItem, 'id'> = {
                itemId: item.docId,
                itemType: item.itemType,
                quantity: item.requisitionQuantity,
                estimatedPrice: item.estimatedPrice || 0,
                status: 'Pendente',
                notes: item.notes,
                attachmentUrl: item.attachmentUrl,
            };
            batch.set(itemRef, itemData, { merge: true }); // Use merge to be safe
        }

        // Delete items that were removed
        for (const itemIdToDelete of deletedItemIds) {
            const itemRef = doc(firestore, 'purchase_requisitions', requisition.docId, 'items', itemIdToDelete);
            batch.delete(itemRef);
        }

        await batch.commit();

        toast({ title: 'Sucesso!', description: 'Sua requisição foi atualizada e reenviada para aprovação.' });
        onSuccess();
    } catch(err) {
        console.error("Erro ao atualizar requisição:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar as alterações.' });
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
            <DialogTitle>Revisar Requisição de Compra</DialogTitle>
            <DialogDescription>
                Ajuste os itens da requisição <span className='font-bold'>{requisition?.protocol}</span> e reenvie para aprovação.
                 <br />
                <span className="text-orange-600 dark:text-orange-400">Motivo da revisão: {requisition?.rejectionReason || 'Não especificado.'}</span>
            </DialogDescription>
            </DialogHeader>
            <Card className="w-full border-none shadow-none">
                <CardContent className="p-0">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                        <h3 className="font-semibold text-lg">Itens da Requisição ({cart.length})</h3>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                <p>Nenhum item na requisição.</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-96 border rounded-md">
                                <div className="space-y-3 p-3">
                                {cart.map(item => (
                                    <Card key={item.docId} className="p-3 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <Image
                                                src={item.imageUrl || 'https://picsum.photos/seed/item/64/64'}
                                                alt={item.descricao || 'Item sem descrição'}
                                                width={48}
                                                height={48}
                                                className="rounded-md aspect-square object-cover"
                                            />
                                            <div className="flex-1 text-sm space-y-2">
                                                <p className="font-bold">{item.descricao}</p>
                                                <p className="font-mono text-xs text-muted-foreground">{item.codigo}</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <Input 
                                                        type="number" 
                                                        placeholder="Qtd."
                                                        value={item.requisitionQuantity}
                                                        onChange={(e) => updateCartItem(item.docId, 'requisitionQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="h-8 text-center"
                                                        min="1"
                                                    />
                                                    <Input
                                                        type="number"
                                                        placeholder="Preço Est. (R$)"
                                                        value={item.estimatedPrice || ''}
                                                        onChange={(e) => updateCartItem(item.docId, 'estimatedPrice', parseFloat(e.target.value) || undefined)}
                                                        className="h-8 text-center"
                                                    />
                                                </div>
                                                <Textarea
                                                    placeholder="Observação (opcional)"
                                                    value={item.notes || ''}
                                                    onChange={(e) => updateCartItem(item.docId, 'notes', e.target.value)}
                                                    className="h-16 text-sm"
                                                />
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeFromCart(item.docId, item.existingItemId)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </CardContent>
            </Card>
            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                <Button onClick={handleSubmitUpdate} disabled={isSubmitting || isLoading}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar e Reenviar para Aprovação
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
};
