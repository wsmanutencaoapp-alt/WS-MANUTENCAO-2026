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
import { Loader2, Search, Upload, FileText, ChevronsUpDown, Check, Info, ShoppingBag, List } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier, Quotation } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
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
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [isJustificationDialogOpen, setIsJustificationDialogOpen] = useState(false);


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
    handleQuotationChange(activeQuotationIndex, 'supplierId', supplier.docId);
    handleQuotationChange(activeQuotationIndex, 'supplierName', supplier.name);
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
  }, [quotations]);

  const isJustificationRequired = useMemo(() => {
      if (selectedQuotationIndex === null) return false;
      const choseMoreExpensive = selectedQuotationIndex !== cheapestIndex;
      const lessThanThreeQuotes = filledQuotations.length > 0 && filledQuotations.length < 3;
      return choseMoreExpensive || lessThanThreeQuotes;
  }, [selectedQuotationIndex, cheapestIndex, filledQuotations.length]);
  
  const getJustificationReason = () => {
    if (selectedQuotationIndex !== null && selectedQuotationIndex !== cheapestIndex) {
      return "Sua escolha não é o orçamento mais barato. Por favor, justifique.";
    }
    if (filledQuotations.length > 0 && filledQuotations.length < 3) {
      return "Você preencheu menos de 3 orçamentos. Por favor, justifique.";
    }
    return "É necessário fornecer uma justificativa.";
  };


  const proceedToGenerateOC = async (justificationText: string) => {
     if (!firestore || !storage || !requisition || !items || items.length === 0) return Promise.reject("Dados inválidos.");
     if (selectedQuotationIndex === null) return Promise.reject("Nenhum orçamento vencedor selecionado.");
     
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
        
        const chosenQuotation = finalQuotations.find((q, i) => i === selectedQuotationIndex);

        const ocData: Omit<PurchaseRequisition, 'id'> = {
            protocol: ocProtocol, originalRequisitionId: requisition.docId,
            requesterId: requisition.requesterId, requesterName: requisition.requesterName,
            costCenterId: requisition.costCenterId, neededByDate: requisition.neededByDate,
            type: 'Ordem de Compra', status: 'Em Aprovação', createdAt: new Date().toISOString(),
            priority: requisition.priority, purchaseReason: requisition.purchaseReason,
            quotations: finalQuotations, selectedQuotationIndex: selectedQuotationIndex,
            expensiveChoiceJustification: justificationText, purchaseOrderNotes: purchaseOrderNotes,
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
    // This function logic would be different, it would save the current state without full validation or OC creation
    toast({ title: "Funcionalidade pendente", description: "Salvar como rascunho ainda não foi implementado." });
  };
  
  const handleSendForApproval = async () => {
    if (selectedQuotationIndex === null) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um orçamento vencedor.' });
        return;
    }
     if (isJustificationRequired) {
        setIsJustificationDialogOpen(true);
        return;
    }
    
    try {
        await proceedToGenerateOC(''); // Pass empty justification if not required
        toast({ title: "Sucesso!", description: "Ordem de Compra enviada para aprovação." });
        onSuccess();
    } catch (err: any) {
        console.error("Erro ao enviar para aprovação:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível enviar para aprovação.' });
    }
  }
  
  const handleJustificationSubmit = async () => {
      if (!justification) {
          toast({ variant: 'destructive', title: 'Erro', description: 'A justificativa é obrigatória.' });
          return;
      }
      setIsJustificationDialogOpen(false);
      try {
          await proceedToGenerateOC(justification);
          toast({ title: "Sucesso!", description: "Ordem de Compra enviada para aprovação." });
          onSuccess();
      } catch (err: any) {
          console.error("Erro ao enviar para aprovação com justificativa:", err);
          toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível enviar para aprovação.' });
      }
  }


  return (
    <>
      <Dialog open={isOpen && !isItemsDialogOpen && !isJustificationDialogOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Cotação - {requisition.protocol}</DialogTitle>
            <DialogDescription>
              Insira os orçamentos para os itens selecionados e gere a Ordem de Compra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-4 py-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Resumo da Cotação</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Itens para cotar</p>
                        <p className="text-xl font-bold">{items.length}</p>
                    </div>
                    <Button variant="outline" onClick={() => setIsItemsDialogOpen(true)}>
                        <List className="mr-2 h-4 w-4" />
                        Ver Itens da Cotação
                    </Button>
                </CardContent>
            </Card>

            <div className="space-y-4">
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
            <Button onClick={handleSendForApproval} disabled={isSaving || selectedQuotationIndex === null}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Itens da Cotação</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96 my-4">
            <div className="space-y-2 pr-6">
              {items.map(item => (
                <div key={item.docId} className="text-sm border rounded-md p-3">
                  <p className="font-bold">{item.details?.descricao || 'Item não encontrado'}</p>
                  <p>Código: <span className="font-mono text-muted-foreground">{item.details?.codigo}</span></p>
                  <p>Quantidade: <span className="font-medium">{item.quantity}</span></p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsItemsDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isJustificationDialogOpen} onOpenChange={setIsJustificationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificativa Necessária</DialogTitle>
            <DialogDescription>{getJustificationReason()}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="justification-dialog">Justificativa <span className="text-destructive">*</span></Label>
            <Textarea
              id="justification-dialog"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="mt-1"
              placeholder="Forneça uma justificativa clara para sua escolha."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJustificationDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleJustificationSubmit} disabled={!justification}>Confirmar e Enviar</Button>
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
