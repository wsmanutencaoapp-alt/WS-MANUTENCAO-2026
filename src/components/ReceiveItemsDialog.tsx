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
import { useFirestore, useStorage, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, updateDoc, arrayUnion, writeBatch, collection, query, getDocs, where, runTransaction, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, FileText, Package, AlertTriangle, ChevronsUpDown, Check, CalendarIcon } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supply, Tool, Delivery, Address, SupplyStock, SupplyMovement, CalibrationRecord, Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { RequisitionItemWithDetails } from './PurchaseRequisitionDetailsDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { parse, isValid, format } from 'date-fns';
import { Switch } from './ui/switch';
import { sendItemsReceivedEmail } from '@/lib/email';


interface ReceiveItemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: WithDocId<PurchaseRequisition>;
  onSuccess: () => void;
}

interface ItemReceiveDetails {
  quantity: number;
  // Supply fields are now optional
  localizacao?: string;
  custoUnitario?: number;
  loteFornecedor?: string;
  dataValidade?: string;
  documentoFile?: File | null;
  // Tool fields are now optional
  marca?: string;
  patrimonio?: string;
  data_referencia?: string;
  data_vencimento?: string;
  certificateFile?: File | null;
}

export default function ReceiveItemsDialog({ isOpen, onClose, purchaseOrder, onSuccess }: ReceiveItemsDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [items, setItems] = useState<RequisitionItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [nfNumber, setNfNumber] = useState('');
  const [nfFile, setNfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [itemDetails, setItemDetails] = useState<Record<string, Partial<ItemReceiveDetails>>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // No changes to UI state management needed

  useEffect(() => {
    if (!isOpen || !firestore || !purchaseOrder) return;

    const fetchItems = async () => {
      setIsLoading(true);
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
        
        const initialDetails: Record<string, Partial<ItemReceiveDetails>> = {};
        enriched.forEach(item => {
            const remaining = item.quantity - (item.receivedQuantity || 0);
            initialDetails[item.docId] = {
                quantity: remaining > 0 ? remaining : 0,
            };
        });
        setItemDetails(initialDetails);

      } catch (error) {
        console.error("Error fetching PO items:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os itens da OC.' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchItems();
  }, [isOpen, firestore, purchaseOrder, toast]);
  
  const handleDetailChange = (itemId: string, field: keyof ItemReceiveDetails, value: any) => {
    setItemDetails(prev => {
        const currentItem = items.find(i => i.docId === itemId);
        if (!currentItem) return prev;
        
        let processedValue = value;
        if (field === 'quantity') {
            const maxReceivable = currentItem.quantity - (currentItem.receivedQuantity || 0);
            let numValue = parseInt(value, 10);
            if (isNaN(numValue) || numValue < 0) numValue = 0;
            if (numValue > maxReceivable) numValue = maxReceivable;
            processedValue = numValue;
        }

        return {
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: processedValue
            }
        };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNfFile(e.target.files[0]);
    }
  };
  
  const resetAndClose = () => {
    setNfNumber('');
    setNfFile(null);
    setItemDetails({});
    setIsSaving(false);
    onClose();
  };

  const handleSave = async () => {
    if (!firestore || !storage || !user) return;
    if (!nfNumber || !nfFile) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Número e anexo da Nota Fiscal são obrigatórios.' });
        return;
    }
    
    const itemsToReceive = Object.entries(itemDetails).filter(([_, details]) => (details.quantity || 0) > 0);
    if (itemsToReceive.length === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma quantidade foi informada para recebimento.' });
        return;
    }

    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        const poRef = doc(firestore, 'purchase_requisitions', purchaseOrder.docId);
        
        const nfFileRef = storageRef(storage, `notas_fiscais/${purchaseOrder.docId}/${nfNumber}-${nfFile.name}`);
        await uploadBytes(nfFileRef, nfFile);
        const nfUrl = await getDownloadURL(nfFileRef);
        
        const newDelivery: Delivery = {
            id: doc(collection(firestore, 'temp')).id,
            nfNumber, nfUrl, receivedAt: new Date().toISOString(), items: [],
        };
        
        let allItemsFullyReceived = true;
        let anyItemReceived = false;

        for (const item of items) {
            const details = itemDetails[item.docId];
            const receivedQty = details?.quantity || 0;
            const isFullyReceived = (item.receivedQuantity || 0) + receivedQty >= item.quantity;
            
            if (!isFullyReceived) {
                allItemsFullyReceived = false;
            }

            if (receivedQty > 0) {
                anyItemReceived = true;
                const itemRef = doc(firestore, 'purchase_requisitions', purchaseOrder.docId, 'items', item.docId);
                const newTotalReceived = (item.receivedQuantity || 0) + receivedQty;
                
                batch.update(itemRef, { receivedQuantity: newTotalReceived });
                
                newDelivery.items.push({
                    itemId: item.itemId,
                    itemName: item.details.descricao || 'N/A',
                    quantityReceived: receivedQty,
                });

                if (item.itemType === 'supply') {
                    let validadeDate: Date | null = null;
                    if ((item.details as Supply).exigeValidade) {
                        if (!details.dataValidade) throw new Error(`Data de validade obrigatória para ${item.details.descricao}`);
                        validadeDate = parse(details.dataValidade, 'yyyy-MM-dd', new Date());
                        if (!isValid(validadeDate)) throw new Error(`Data de validade inválida para ${item.details.descricao}`);
                    }

                    const counterRef = doc(firestore, 'counters', `loteInterno_${new Date().getFullYear()}_${String(new Date().getMonth() + 1).padStart(2, '0')}`);
                    const newSequencial = await runTransaction(firestore, async (t) => {
                        const counterDoc = await t.get(counterRef);
                        const lastId = counterDoc.exists() ? counterDoc.data().lastId : 0;
                        const newId = lastId + 1;
                        t.set(counterRef, { lastId: newId }, { merge: true });
                        return newId;
                    });
                    const loteInterno = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(newSequencial).padStart(4, '0')}`;

                    let docUrl = '';
                    if (details.documentoFile) {
                        const docRef = storageRef(storage, `supply_documents/${item.itemId}/${loteInterno}/${details.documentoFile.name}`);
                        await uploadBytes(docRef, details.documentoFile);
                        docUrl = await getDownloadURL(docRef);
                    }

                    const stockData: Omit<SupplyStock, 'id'> = {
                        loteInterno, loteFornecedor: details.loteFornecedor || '',
                        quantidade: receivedQty, 
                        localizacao: 'RECEBIMENTO', // <<< CHANGE HERE
                        dataEntrada: new Date().toISOString(),
                        dataValidade: validadeDate ? validadeDate.toISOString() : undefined,
                        custoUnitario: details.custoUnitario || 0,
                        status: 'Em Recebimento', // <<< CHANGE HERE
                        documentoUrl: docUrl,
                        pesoLiquido: (item.details as Supply).fatorConversao ? (item.details as Supply).fatorConversao! * receivedQty : undefined,
                    };

                    const newStockRef = doc(collection(firestore, 'supplies', item.itemId, 'stock'));
                    batch.set(newStockRef, stockData);

                    const movementData: Omit<SupplyMovement, 'id'> = {
                        supplyId: item.itemId, supplyStockId: newStockRef.id,
                        supplyCodigo: item.details.codigo!, type: 'entrada',
                        quantity: receivedQty, responsibleId: user.uid,
                        responsibleName: user.displayName || 'Sistema',
                        date: new Date().toISOString(),
                        origin: `OC: ${purchaseOrder.protocol} / NF-e: ${nfNumber}`
                    };
                    batch.set(doc(collection(firestore, 'supply_movements')), movementData);

                } else if (item.itemType === 'tool') {
                    const modelTool = item.details as WithDocId<Tool>;
                    const { tipo, familia, classificacao } = modelTool;
                    
                    const isCalibratable = ['C', 'L', 'V'].includes(classificacao);
                    if (isCalibratable && (!details.data_referencia || !details.data_vencimento || !details.certificateFile)) {
                        throw new Error(`Dados de calibração são obrigatórios para a ferramenta ${modelTool.descricao}`);
                    }
                    
                    const counterRef = doc(firestore, 'counters', `${tipo}-${familia}-${classificacao}`);
                    const seqNumbers = await runTransaction(firestore, async (t) => {
                        const counterDoc = await t.get(counterRef);
                        const lastId = counterDoc.exists() ? counterDoc.data().lastId : 0;
                        const newLastId = lastId + receivedQty;
                        t.set(counterRef, { lastId: newLastId }, { merge: true });
                        return Array.from({ length: receivedQty }, (_, i) => lastId + 1 + i);
                    });
                    
                    let certificateUrl = '';
                    if (isCalibratable && details.certificateFile) {
                        const certFileRef = storageRef(storage, `calibration_certificates/${purchaseOrder.docId}/${item.docId}-${Date.now()}-${details.certificateFile.name}`);
                        await uploadBytes(certFileRef, details.certificateFile);
                        certificateUrl = await getDownloadURL(certFileRef);
                    }

                    for (const sequencial of seqNumbers) {
                        const newToolRef = doc(collection(firestore, 'tools'));
                        const { docId, sequencial: modelSeq, ...baseData } = modelTool; 
                        const newToolData: Omit<Tool, 'id'> = {
                            ...baseData,
                            codigo: `${tipo}-${familia}-${classificacao}-${sequencial.toString().padStart(4, '0')}`,
                            sequencial: sequencial,
                            status: 'Em Recebimento', // <<< CHANGE HERE
                            enderecamento: 'RECEBIMENTO', // <<< CHANGE HERE
                            marca: details.marca || modelTool.marca || '',
                            patrimonio: details.patrimonio || '',
                            data_referencia: details.data_referencia,
                            data_vencimento: details.data_vencimento,
                            documento_anexo_url: certificateUrl || undefined,
                        };
                        batch.set(newToolRef, newToolData);

                        if (isCalibratable && certificateUrl && details.data_referencia && details.data_vencimento) {
                            const historyRef = doc(collection(newToolRef, 'calibration_history'));
                            const historyRecord: Omit<CalibrationRecord, 'id'> = {
                                toolId: newToolRef.id,
                                calibrationDate: new Date(details.data_referencia).toISOString(),
                                dueDate: new Date(details.data_vencimento).toISOString(),
                                certificateUrl: certificateUrl,
                                calibratedBy: 'Entrada via OC',
                                timestamp: new Date().toISOString(),
                            };
                            batch.set(historyRef, historyRecord);
                        }
                    }
                }
            }
        }
        
        if (!anyItemReceived) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma quantidade foi informada para recebimento.' });
            setIsSaving(false);
            return;
        }

        const newStatus = allItemsFullyReceived ? 'Recebimento Concluído' : 'Recebimento Parcial';
        batch.update(poRef, { status: newStatus, deliveries: arrayUnion(newDelivery) });

        await batch.commit();
        
        try {
            const recipients = ['suprimento@manutencaows.com'];
            
            const requesterDocRef = doc(firestore, 'employees', purchaseOrder.requesterId);
            const requesterDoc = await getDoc(requesterDocRef);
            if (requesterDoc.exists()) {
                const requesterData = requesterDoc.data() as Employee;
                if (requesterData.email) {
                    recipients.push(requesterData.email);
                }
            }

            await sendItemsReceivedEmail(recipients, purchaseOrder, newDelivery);

        } catch (emailError) {
            console.error("Falha ao enviar e-mail de notificação de recebimento:", emailError);
        }
        
        toast({ title: "Sucesso!", description: "Recebimento registrado com sucesso. Os itens estão no estoque de recebimento." });
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
    <Dialog open={isOpen} onOpenChange={resetAndClose} modal={false}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Registrar Recebimento de Itens</DialogTitle>
                <DialogDescription>
                    Confirme as quantidades recebidas para a OC <span className="font-bold">{purchaseOrder.protocol}</span> e anexe a NF-e. Os itens serão movidos para a área de recebimento para posterior armazenamento.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] py-4 pr-2">
                 <div className="grid grid-cols-2 gap-4 px-2">
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

                <ScrollArea className="h-96 border rounded-md">
                    <Accordion type="multiple" className="w-full">
                        {isLoading ? <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin"/> : null}
                        {!isLoading && items.map(item => {
                            const remaining = item.quantity - (item.receivedQuantity || 0);
                            if(remaining <= 0) return null;
                            const isSupply = item.itemType === 'supply';
                            const isTool = item.itemType === 'tool';
                            const isCalibratable = isTool && ['C', 'L', 'V'].includes((item.details as Tool).classificacao);

                            return (
                                <AccordionItem value={item.docId} key={item.docId} className="px-2 border-b">
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-4 text-left w-full">
                                            <Package className="h-6 w-6 text-muted-foreground shrink-0"/>
                                            <div className="flex-1 text-sm">
                                                <p className="font-bold">{item.details.descricao}</p>
                                                <p className="text-xs text-muted-foreground">Pedido: {item.quantity} | Recebido: {item.receivedQuantity || 0} | Restante: {remaining}</p>
                                            </div>
                                            <div className="w-24">
                                                <Label htmlFor={`qty-${item.docId}`} className="sr-only">Qtd Recebida</Label>
                                                <Input
                                                    id={`qty-${item.docId}`}
                                                    type="number"
                                                    value={itemDetails[item.docId]?.quantity || ''}
                                                    onChange={(e) => { e.stopPropagation(); handleDetailChange(item.docId, 'quantity', e.target.value); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-24 h-8 text-center"
                                                    max={remaining}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 bg-muted/50 rounded-b-md">
                                        {isSupply && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in-50">
                                                <div className="space-y-1.5"><Label>Custo Unitário (R$)</Label><Input type="number" value={itemDetails[item.docId]?.custoUnitario || ''} onChange={(e) => handleDetailChange(item.docId, 'custoUnitario', e.target.value)} /></div>
                                                <div className="space-y-1.5"><Label>Lote do Fornecedor</Label><Input value={itemDetails[item.docId]?.loteFornecedor || ''} onChange={(e) => handleDetailChange(item.docId, 'loteFornecedor', e.target.value)} /></div>
                                                {(item.details as Supply).exigeValidade && <div className="space-y-1.5"><Label>Data de Validade <span className="text-destructive">*</span></Label><Input type="date" value={itemDetails[item.docId]?.dataValidade || ''} onChange={(e) => handleDetailChange(item.docId, 'dataValidade', e.target.value)} /></div>}
                                                <div className="space-y-1.5 col-span-2"><Label>Anexo do Lote (Certificado, etc.)</Label>
                                                    <Button asChild variant="outline" className="w-full bg-background">
                                                        <label className="cursor-pointer flex items-center">
                                                            {itemDetails[item.docId]?.documentoFile ? <FileText className="mr-2 h-4 w-4 text-green-600"/> : <Upload className="mr-2 h-4 w-4" />}
                                                            <span className="truncate max-w-xs">{itemDetails[item.docId]?.documentoFile?.name || 'Anexar documento'}</span>
                                                            <Input type="file" className="sr-only" onChange={(e) => handleDetailChange(item.docId, 'documentoFile', e.target.files?.[0] || null)} />
                                                        </label>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {isTool && (
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in-50">
                                                <div className="space-y-1.5"><Label>Marca</Label><Input value={itemDetails[item.docId]?.marca || ''} onChange={(e) => handleDetailChange(item.docId, 'marca', e.target.value)} /></div>
                                                <div className="space-y-1.5"><Label>Nº Patrimônio</Label><Input value={itemDetails[item.docId]?.patrimonio || ''} onChange={(e) => handleDetailChange(item.docId, 'patrimonio', e.target.value)} /></div>
                                                {isCalibratable && (
                                                    <>
                                                        <div className="space-y-1.5"><Label>Data de Referência <span className="text-destructive">*</span></Label>
                                                           <Input type="date" value={itemDetails[item.docId]?.data_referencia ? format(new Date(itemDetails[item.docId]!.data_referencia!), 'yyyy-MM-dd') : ''} onChange={(e) => handleDetailChange(item.docId, 'data_referencia', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1.5"><Label>Data de Vencimento <span className="text-destructive">*</span></Label>
                                                           <Input type="date" value={itemDetails[item.docId]?.data_vencimento ? format(new Date(itemDetails[item.docId]!.data_vencimento!), 'yyyy-MM-dd') : ''} onChange={(e) => handleDetailChange(item.docId, 'data_vencimento', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1.5 col-span-2"><Label>Certificado <span className="text-destructive">*</span></Label>
                                                            <Button asChild variant="outline" className="w-full bg-background"><label className="cursor-pointer flex items-center">
                                                                {itemDetails[item.docId]?.certificateFile ? <FileText className="mr-2 h-4 w-4 text-green-600"/> : <Upload className="mr-2 h-4 w-4" />}
                                                                <span className="truncate max-w-xs">{itemDetails[item.docId]?.certificateFile?.name || 'Anexar certificado'}</span>
                                                                <Input type="file" className="sr-only" onChange={(e) => handleDetailChange(item.docId, 'certificateFile', e.target.files?.[0] || null)} />
                                                            </label></Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Recebimento
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
