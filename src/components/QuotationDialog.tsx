'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import {
  collection,
  query,
  doc,
  writeBatch,
  getDocs,
  updateDoc,
  addDoc,
  runTransaction
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Upload, FileText, ChevronsUpDown, Check, Info, ShoppingBag } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier, Quotation } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from '@/components/ui/badge';
import { RequisitionItemWithDetails } from './PurchaseRequisitionDetailsDialog';
import SupplierSelectorDialog from './SupplierSelectorDialog';


interface QuotationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requisition: WithDocId<PurchaseRequisition>;
  items: RequisitionItemWithDetails[];
}

type QuotationFormState = {
  supplierId: string;
  supplierName: string;
  totalValue: number | string;
  deliveryTime: number | string;
  paymentTerms: string;
  attachmentUrl?: string;
  attachmentFile?: File | null;
};

const emptyQuotation: QuotationFormState = {
  supplierId: '',
  supplierName: '',
  totalValue: '',
  deliveryTime: '',
  paymentTerms: '',
  attachmentFile: null,
};

export default function QuotationDialog({ isOpen, onClose, onSuccess, requisition, items }: QuotationDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quotations, setQuotations] = useState<QuotationFormState[]>([
    {...emptyQuotation}, {...emptyQuotation}, {...emptyQuotation}
  ]);
  const [selectedQuotationIndex, setSelectedQuotationIndex] = useState<number | null>(null);
  const [justification, setJustification] = useState('');
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [supplierSelectorOpen, setSupplierSelectorOpen] = useState(false);
  const [activeQuotationIndex, setActiveQuotationIndex] = useState<number | null>(null);

  const suppliersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'suppliers')) : null), [firestore]);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<WithDocId<Supplier>>(suppliersQuery, {
    queryKey: ['allSuppliersForQuotation'],
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
        setQuotations([
            {...emptyQuotation}, {...emptyQuotation}, {...emptyQuotation}
        ]);
        setSelectedQuotationIndex(null);
        setJustification('');
        setPurchaseOrderNotes('');
    }
  }, [isOpen, items]);

  const handleQuotationChange = (index: number, field: keyof QuotationFormState, value: any) => {
    const updatedQuotations = [...quotations];
    updatedQuotations[index] = { ...updatedQuotations[index], [field]: value };
    setQuotations(updatedQuotations);
  };
  
  const handleSupplierSelect = (supplier: WithDocId<Supplier>) => {
    if (activeQuotationIndex === null) return;
    const updatedQuotations = [...quotations];
    updatedQuotations[activeQuotationIndex] = {
      ...updatedQuotations[activeQuotationIndex],
      supplierId: supplier.docId,
      supplierName: supplier.name,
    };
    setQuotations(updatedQuotations);
    setSupplierSelectorOpen(false);
    setActiveQuotationIndex(null);
  };
  
  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          handleQuotationChange(index, 'attachmentFile', e.target.files[0]);
      }
  }
  
  const filledQuotations = useMemo(() => quotations.filter(q => q.supplierId && q.totalValue && q.deliveryTime && q.paymentTerms), [quotations]);
  
  const cheapestIndex = useMemo(() => {
    if (filledQuotations.length === 0) return -1;
    let minPrice = Infinity;
    let minIndex = -1;
    quotations.forEach((q, index) => {
        if (!q.supplierId) return;
        const value = Number(q.totalValue);
        if(!isNaN(value) && value > 0 && value < minPrice) {
            minPrice = value;
            minIndex = index;
        }
    });
    return minIndex;
  }, [quotations, filledQuotations]);

  const isJustificationRequired = useMemo(() => {
      if(selectedQuotationIndex === null || cheapestIndex === -1) return false;
      return selectedQuotationIndex !== cheapestIndex;
  }, [selectedQuotationIndex, cheapestIndex]);
  
  const generateOC = async (finalStatus: 'Em Cotação' | 'Em Aprovação'): Promise<void> => {
     if (!firestore || !storage || !requisition || !items || items.length === 0) return Promise.reject("Dados inválidos.");
     setIsSaving(true);
     try {
        const batch = writeBatch(firestore);

        const itemIdsBeingProcessed = new Set(items.map(item => item.docId));
        itemIdsBeingProcessed.forEach(itemId => {
            const originalItemRef = doc(firestore, 'purchase_requisitions', requisition.docId, 'items', itemId);
            batch.update(originalItemRef, { status: 'Em Cotação' });
        });
        
        const counterRef = doc(firestore, 'counters', 'purchaseOrders');
        let newId;

        await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let lastId = 0;
            if (counterDoc.exists()) {
                lastId = counterDoc.data()?.lastId || 0;
            }
            newId = lastId + 1;
            transaction.set(counterRef, { lastId: newId }, { merge: true });
        });

        if (newId === undefined) {
          throw new Error("Não foi possível gerar um novo número de protocolo para a OC.");
        }

        const ocProtocol = `OC-${new Date().getFullYear()}-${String(newId).padStart(5, '0')}`;
        
        const ocRef = doc(collection(firestore, 'purchase_requisitions'));

        const finalQuotations: Quotation[] = [];
        for (const q of quotations) {
            if (!q.supplierId) continue;
            let attachmentUrl = q.attachmentUrl || '';
            if (q.attachmentFile) {
                const fileRef = storageRef(storage, `quotations/${ocRef.id}/${q.supplierId}-${q.attachmentFile.name}`);
                await uploadBytes(fileRef, q.attachmentFile);
                attachmentUrl = await getDownloadURL(fileRef);
            }
            finalQuotations.push({
                supplierId: q.supplierId, supplierName: q.supplierName, totalValue: Number(q.totalValue),
                deliveryTime: Number(q.deliveryTime), paymentTerms: q.paymentTerms, attachmentUrl: attachmentUrl
            });
        }
        
        const chosenQuotation = selectedQuotationIndex !== null ? finalQuotations.find((q, i) => i === selectedQuotationIndex) : null;

        const ocData: Omit<PurchaseRequisition, 'id'> = {
            protocol: ocProtocol, originalRequisitionId: requisition.docId,
            requesterId: requisition.requesterId, requesterName: requisition.requesterName,
            costCenterId: requisition.costCenterId, neededByDate: requisition.neededByDate,
            type: 'Ordem de Compra', status: finalStatus, createdAt: new Date().toISOString(),
            priority: requisition.priority, purchaseReason: requisition.purchaseReason,
            quotations: finalQuotations, selectedQuotationIndex: selectedQuotationIndex ?? undefined,
            expensiveChoiceJustification: justification, purchaseOrderNotes: purchaseOrderNotes,
            supplierId: chosenQuotation?.supplierId, totalValue: chosenQuotation?.totalValue,
            paymentTerms: chosenQuotation?.paymentTerms,
        };
        batch.set(ocRef, ocData);
        
        for (const item of items) {
            const ocItemRef = doc(collection(ocRef, 'items'));
            const { details, ...baseItem } = item;
            batch.set(ocItemRef, { ...baseItem, status: 'Pendente' });
        }

        await batch.commit();

     } catch(err) {
        throw err;
     } finally {
        setIsSaving(false);
     }
  }

  const handleSaveDraft = async () => {
    try {
        await generateOC('Em Cotação');
        toast({ title: "Rascunho Salvo!", description: "A Ordem de Compra foi salva como rascunho." });
        onSuccess();
    } catch(err: any) {
        console.error("Erro ao salvar rascunho:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar a Ordem de Compra.' });
    }
  };
  
  const handleSendForApproval = async () => {
    if (selectedQuotationIndex === null) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um orçamento vencedor.' });
        return;
    }
     if (filledQuotations.length > 0 && filledQuotations.length < 3 && !justification) {
        toast({ variant: 'destructive', title: 'Erro', description: 'É necessário justificar por que não há 3 orçamentos.' });
        return;
    }
    if (isJustificationRequired && !justification) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Justifique a escolha do orçamento que não é o mais barato.' });
        return;
    }
    
    try {
        await generateOC('Em Aprovação');
        toast({ title: "Sucesso!", description: "Ordem de Compra enviada para aprovação." });
        onSuccess();
    } catch (err: any) {
        console.error("Erro ao enviar para aprovação:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível enviar para aprovação.' });
    }
  }


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Cotação - {requisition.protocol}</DialogTitle>
            <DialogDescription>
              Insira os orçamentos para os itens selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[75vh] py-4">
            <div className="md:col-span-1 space-y-4">
              <h3 className="font-semibold text-lg">Itens para Cotação</h3>
              <ScrollArea className='h-96'>
                  <div className="space-y-2">
                      {items.map(item => (
                          <div key={item.docId} className="text-sm border rounded-md p-3">
                              <p className="font-bold">{item.details?.descricao || 'Item não encontrado'}</p>
                              <p>Quantidade: <span className="font-medium">{item.quantity}</span></p>
                          </div>
                      ))}
                  </div>
              </ScrollArea>
            </div>
            
            <div className="md:col-span-2 space-y-4">
               <div className="flex flex-col">
                  <h3 className="font-semibold text-lg">Orçamentos</h3>
                  <p className="text-sm text-muted-foreground">* Selecione o orçamento vencedor</p>
               </div>
               <RadioGroup value={selectedQuotationIndex?.toString()} onValueChange={(v) => setSelectedQuotationIndex(Number(v))}>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                      {quotations.map((q, index) => (
                         <Card key={index} className="p-4 space-y-3">
                             <div className="flex items-center justify-between">
                                 <Label htmlFor={`q-${index}`} className="font-bold text-base flex items-center gap-2">
                                    <RadioGroupItem value={index.toString()} id={`q-${index}`} />
                                    Orçamento #{index + 1}
                                 </Label>
                                 {index === cheapestIndex && <Badge variant="success">Mais Barato</Badge>}
                             </div>
                             <Separator />
                             <div className="space-y-1.5">
                                 <Label>Fornecedor</Label>
                                 <Button 
                                    variant="outline" 
                                    className="w-full justify-between font-normal" 
                                    onClick={() => { setActiveQuotationIndex(index); setSupplierSelectorOpen(true); }}
                                    disabled={isLoadingSuppliers}
                                >
                                    {isLoadingSuppliers ? <Loader2 className="h-4 w-4 animate-spin"/> : q.supplierName || "Selecione..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1.5"><Label>Valor Total (R$)</Label><Input type="number" value={q.totalValue} onChange={(e) => handleQuotationChange(index, 'totalValue', e.target.value)} /></div>
                                 <div className="space-y-1.5"><Label>Prazo (dias)</Label><Input type="number" value={q.deliveryTime} onChange={(e) => handleQuotationChange(index, 'deliveryTime', e.target.value)} /></div>
                             </div>
                              <div className="space-y-1.5"><Label>Cond. Pagamento</Label><Input value={q.paymentTerms} onChange={(e) => handleQuotationChange(index, 'paymentTerms', e.target.value)} placeholder="Ex: 30/60/90" /></div>
                              <div className="space-y-1.5"><Label>Anexo</Label>
                                  <Button asChild variant="outline" size="sm" className="w-full">
                                      <label className="cursor-pointer"><Upload className="mr-2"/>{q.attachmentFile ? <span className='truncate'>{q.attachmentFile.name}</span> : 'Anexar Orçamento'}<Input type="file" className="sr-only" onChange={(e) => handleFileChange(index, e)}/></label>
                                  </Button>
                              </div>
                         </Card>
                      ))}
                  </div>
              </RadioGroup>
              
              <div className="space-y-2 mt-4">
                  {(isJustificationRequired || (filledQuotations.length > 0 && filledQuotations.length < 3)) && (
                      <div className="space-y-1.5 animate-in fade-in-50">
                          <Label htmlFor="justification" className={cn(isJustificationRequired && "text-destructive", "flex items-center gap-1")}>
                              <Info className="h-4 w-4" /> Justificativa <span className="text-destructive">*</span>
                          </Label>
                          <Textarea id="justification" value={justification} onChange={(e) => setJustification(e.target.value)} placeholder={isJustificationRequired ? "Justifique a escolha pelo orçamento que não é o mais barato." : "Justifique por que há menos de 3 orçamentos."} />
                      </div>
                  )}
                  <div className="space-y-1.5">
                      <Label htmlFor="purchaseOrderNotes">Observações da Ordem de Compra</Label>
                      <Textarea id="purchaseOrderNotes" value={purchaseOrderNotes} onChange={(e) => setPurchaseOrderNotes(e.target.value)} placeholder="Informações adicionais para a OC, como dados de entrega, contato, etc." />
                  </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={isSaving || filledQuotations.length === 0}>
               {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Salvar Rascunho
            </Button>
            <Button onClick={handleSendForApproval} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SupplierSelectorDialog 
        isOpen={supplierSelectorOpen}
        onClose={() => setSupplierSelectorOpen(false)}
        onSelect={handleSupplierSelect}
        suppliers={suppliers || []}
        isLoading={isLoadingSuppliers}
      />
    </>
  );
}
