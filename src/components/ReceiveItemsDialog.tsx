'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, writeBatch, collection, query, getDocs, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, FileText, Package } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, Delivery } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { RequisitionItemWithDetails } from './PurchaseRequisitionDetailsDialog';

interface ReceiveItemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: WithDocId<PurchaseRequisition>;
  onSuccess: () => void;
}

export default function ReceiveItemsDialog({ isOpen, onClose, purchaseOrder, onSuccess }: ReceiveItemsDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [items, setItems] = useState<RequisitionItemWithDetails[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  
  const [nfNumber, setNfNumber] = useState('');
  const [nfFile, setNfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !firestore || !purchaseOrder) return;

    const fetchItems = async () => {
      setIsLoadingItems(true);
      try {
        const itemsRef = collection(firestore, 'purchase_requisitions', purchaseOrder.docId, 'items');
        const itemsSnapshot = await getDocs(itemsRef);
        const poItems = itemsSnapshot.docs.map(d => ({ ...d.data() as PurchaseRequisitionItem, docId: d.id }));

        const supplyIds = poItems.filter(i => i.itemType === 'supply').map(i => i.itemId);
        const toolIds = poItems.filter(i => i.itemType === 'tool').map(i => i.itemId);

        const [supplyDocs, toolDocs] = await Promise.all([
          supplyIds.length > 0 ? getDocs(query(collection(firestore, 'supplies'), where('__name__', 'in', supplyIds))) : Promise.resolve({ docs: [] }),
          toolIds.length > 0 ? getDocs(query(collection(firestore, 'tools'), where('__name__', 'in', toolIds))) : Promise.resolve({ docs: [] }),
        ]);
        
        const masterDataMap = new Map();
        supplyDocs.docs.forEach(d => masterDataMap.set(d.id, { ...d.data(), docId: d.id }));
        toolDocs.docs.forEach(d => masterDataMap.set(d.id, { ...d.data(), docId: d.id }));

        const enriched = poItems.map(item => ({
          ...item,
          details: masterDataMap.get(item.itemId) || {},
        }));

        setItems(enriched);
        
        // Initialize received quantities
        const initialQuantities: Record<string, number> = {};
        enriched.forEach(item => {
            const remaining = item.quantity - (item.receivedQuantity || 0);
            initialQuantities[item.docId] = remaining > 0 ? remaining : 0;
        });
        setReceivedQuantities(initialQuantities);

      } catch (error) {
        console.error("Error fetching PO items:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os itens da OC.' });
      } finally {
        setIsLoadingItems(false);
      }
    };
    
    fetchItems();
  }, [isOpen, firestore, purchaseOrder, toast]);
  
  const handleQuantityChange = (itemId: string, value: string) => {
    const originalItem = items.find(i => i.docId === itemId);
    if (!originalItem) return;
    
    const maxReceivable = originalItem.quantity - (originalItem.receivedQuantity || 0);
    let numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) numValue = 0;
    if (numValue > maxReceivable) numValue = maxReceivable;

    setReceivedQuantities(prev => ({ ...prev, [itemId]: numValue }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNfFile(e.target.files[0]);
    }
  };
  
  const resetAndClose = () => {
    setNfNumber('');
    setNfFile(null);
    setReceivedQuantities({});
    setIsSaving(false);
    onClose();
  };

  const handleSave = async () => {
    if (!firestore || !storage) return;
    if (!nfNumber) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O número da Nota Fiscal é obrigatório.' });
      return;
    }
    if (!nfFile) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O anexo da Nota Fiscal é obrigatório.' });
        return;
    }
     const totalReceived = Object.values(receivedQuantities).reduce((sum, qty) => sum + qty, 0);
    if (totalReceived === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma quantidade foi recebida.' });
        return;
    }

    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        const poRef = doc(firestore, 'purchase_requisitions', purchaseOrder.docId);
        
        // 1. Upload NF-e
        const nfFileRef = storageRef(storage, `notas_fiscais/${purchaseOrder.docId}/${nfNumber}-${nfFile.name}`);
        await uploadBytes(nfFileRef, nfFile);
        const nfUrl = await getDownloadURL(nfFileRef);
        
        // 2. Create Delivery object
        const newDelivery: Delivery = {
            id: doc(collection(firestore, 'temp')).id,
            nfNumber,
            nfUrl,
            receivedAt: new Date().toISOString(),
            items: [],
        };
        
        let allItemsFullyReceived = true;

        // 3. Update each item
        for (const item of items) {
            const receivedQty = receivedQuantities[item.docId] || 0;
            if (receivedQty > 0) {
                const itemRef = doc(firestore, 'purchase_requisitions', purchaseOrder.docId, 'items', item.docId);
                const currentReceived = item.receivedQuantity || 0;
                const newTotalReceived = currentReceived + receivedQty;
                
                batch.update(itemRef, { receivedQuantity: newTotalReceived });
                
                newDelivery.items.push({
                    itemId: item.itemId,
                    itemName: item.details.descricao || 'N/A',
                    quantityReceived: receivedQty,
                });
            }
             if ((item.receivedQuantity || 0) + receivedQty < item.quantity) {
                allItemsFullyReceived = false;
            }
        }
        
        // 4. Update the Purchase Order itself
        const newStatus = allItemsFullyReceived ? 'Recebimento Concluído' : 'Recebimento Parcial';
        batch.update(poRef, {
            status: newStatus,
            deliveries: arrayUnion(newDelivery)
        });

        await batch.commit();
        
        toast({ title: "Sucesso!", description: "Recebimento registrado com sucesso." });
        onSuccess();
        resetAndClose();

    } catch (err: any) {
        console.error("Erro ao salvar recebimento:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message || 'Não foi possível salvar o recebimento.' });
    } finally {
        setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Registrar Recebimento de Itens</DialogTitle>
                <DialogDescription>
                    Confirme as quantidades recebidas para a OC <span className="font-bold">{purchaseOrder.protocol}</span> e anexe a NF-e.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] py-4">
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="nfNumber">Número da NF-e <span className="text-destructive">*</span></Label>
                        <Input id="nfNumber" value={nfNumber} onChange={e => setNfNumber(e.target.value)} />
                    </div>
                     <div className="space-y-1.5">
                        <Label>Anexo da NF-e <span className="text-destructive">*</span></Label>
                         <Button asChild variant="outline" className="w-full">
                            <label className="cursor-pointer flex items-center">
                                {nfFile ? <FileText className="mr-2 h-4 w-4 text-green-600" /> : <Upload className="mr-2 h-4 w-4" />}
                                <span className="truncate max-w-xs">{nfFile ? nfFile.name : 'Anexar NF-e'}</span>
                                <Input type="file" className="sr-only" ref={fileInputRef} onChange={handleFileChange} />
                            </label>
                        </Button>
                    </div>
                </div>

                <ScrollArea className="h-72 border rounded-md">
                    <div className="p-2 space-y-2">
                        {isLoadingItems ? <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin"/> : null}
                        {!isLoadingItems && items.map(item => {
                            const remaining = item.quantity - (item.receivedQuantity || 0);
                            if(remaining <= 0) return null;
                            return (
                                <div key={item.docId} className="flex items-center gap-4 p-2 border rounded-lg bg-background">
                                    <Package className="h-6 w-6 text-muted-foreground"/>
                                    <div className="flex-1 text-sm">
                                        <p className="font-bold">{item.details.descricao}</p>
                                        <p className="text-xs text-muted-foreground">Pedido: {item.quantity} | Recebido: {item.receivedQuantity || 0} | Restante: {remaining}</p>
                                    </div>
                                    <div>
                                        <Label htmlFor={`qty-${item.docId}`} className="sr-only">Quantidade Recebida</Label>
                                        <Input
                                            id={`qty-${item.docId}`}
                                            type="number"
                                            value={receivedQuantities[item.docId] || ''}
                                            onChange={(e) => handleQuantityChange(item.docId, e.target.value)}
                                            className="w-24 h-8 text-center"
                                            max={remaining}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving || isLoadingItems}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Recebimento
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
