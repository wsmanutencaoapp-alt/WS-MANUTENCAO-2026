'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage, useUser } from '@/firebase';
import {
  collection,
  query,
  doc,
  writeBatch,
  getDocs,
  updateDoc,
  addDoc,
  runTransaction,
  getDoc
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
import { Loader2, Search, Upload, FileText, ChevronsUpDown, Check, Info, ShoppingBag, List, Save } from 'lucide-react';
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
import { Alert, AlertTitle, AlertDescription } from './ui/alert';


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
  const { user } = useUser();

  const [quotations, setQuotations] = useState<QuotationFormState[]>([]);
  const [selectedQuotationIndex, setSelectedQuotationIndex] = useState<number | null>(null);
  const [justification, setJustification] = useState('');
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  
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
        const firstItem = items[0];
        const initialQuotesData = firstItem?.quotations && firstItem.quotations.length > 0
          ? firstItem.quotations
          : Array(3).fill(null);

        const initialQuotes: QuotationFormState[] = initialQuotesData.map(q => {
            if (q && q.supplierId) {
                return {
                    supplierId: q.supplierId,
                    supplierName: q.supplierName,
                    totalValue: q.totalValue,
                    deliveryTime: q.deliveryTime,
                    paymentTerms: q.paymentTerms,
                    attachmentUrl: q.attachmentUrl,
                    attachmentFile: null,
                };
            }
            return {...emptyQuotation};
        });

        setQuotations(initialQuotes);
        setSelectedQuotationIndex(firstItem?.selectedQuotationIndex ?? null);
        setJustification('');
        setPurchaseOrderNotes('');
        setIsSaving(false);
        setIsSavingProgress(false);
        setActiveQuotationIndex(null);
        setIsItemsDialogOpen(false);
        setIsJustificationDialogOpen(false);
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
    if (filledQuotations.length === 0) return null;
    let minPrice = Infinity;
    let minIndex: number | null = null;
    quotations.forEach((q, index) => {
        const value = Number(q.totalValue);
        if (q.supplierId && !isNaN(value) && value > 0) {
            if (value < minPrice) {
                minPrice = value;
                minIndex = index;
            }
        }
    });
    return minIndex;
  }, [quotations]);

  const isJustificationRequired = useMemo(() => {
      if (selectedQuotationIndex === null) return false;
      const choseMoreExpensive = cheapestIndex !== null && selectedQuotationIndex !== cheapestIndex;
      const lessThanThreeQuotes = filledQuotations.length > 0 && filledQuotations.length < 3;
      return choseMoreExpensive || lessThanThreeQuotes;
  }, [selectedQuotationIndex, cheapestIndex, filledQuotations.length]);
  
  const getJustificationReason = () => {
    if (selectedQuotationIndex !== null && cheapestIndex !== null && selectedQuotationIndex !== cheapestIndex) {
      return "Sua escolha não é o orçamento mais barato. Por favor, justifique.";
    }
    if (filledQuotations.length > 0 && filledQuotations.length < 3) {
      return "Você preencheu menos de 3 orçamentos. Por favor, justifique.";
    }
    return "É necessário fornecer uma justificativa.";
  };
  
  const saveQuotationsToItems = async (quotes: QuotationFormState[], status: 'Pendente' | 'Em Cotação' | 'Cotado' = 'Em Cotação'): Promise<Quotation[]> => {
      if (!firestore || !storage || !requisition) throw new Error("Serviços ou requisição indisponíveis.");

      const finalQuotations: Quotation[] = [];
      for (const q of quotes) {
          if (!q.supplierId) {
            finalQuotations.push({} as Quotation); // Push empty object to maintain index
            continue;
          };
          let attachmentUrl = q.attachmentUrl || '';
          if (q.attachmentFile) {
            const fileRef = storageRef(storage, `quotations/${requisition.docId}/${q.supplierId}-${q.attachmentFile.name}`);
            await uploadBytes(fileRef, q.attachmentFile);
            attachmentUrl = await getDownloadURL(fileRef);
          }
          finalQuotations.push({
            supplierId: q.supplierId, supplierName: q.supplierName, totalValue: Number(q.totalValue),
            deliveryTime: Number(q.deliveryTime), paymentTerms: q.paymentTerms, attachmentUrl: attachmentUrl
          });
      }

      const batch = writeBatch(firestore);
      for (const item of items) {
          const itemRef = doc(firestore, 'purchase_requisitions', requisition.docId, 'items', item.docId);
          batch.update(itemRef, {
              quotations: finalQuotations,
              selectedQuotationIndex: selectedQuotationIndex,
              status: filledQuotations.length > 0 ? status : 'Pendente',
          });
      }
      
      const scRef = doc(firestore, 'purchase_requisitions', requisition.docId);
      batch.update(scRef, { status: filledQuotations.length > 0 ? 'Em Cotação' : 'Aprovada' });

      await batch.commit();
      return finalQuotations;
  }

  const handleSaveProgress = async () => {
      setIsSavingProgress(true);
      try {
          await saveQuotationsToItems(quotations);
          toast({ title: "Progresso Salvo!", description: "As cotações foram salvas nos itens." });
          onSuccess();
          onClose(); // Close dialog after saving progress
      } catch (err: any) {
          console.error("Erro ao salvar progresso:", err);
          toast({ variant: 'destructive', title: 'Erro ao Salvar', description: err.message });
      } finally {
          setIsSavingProgress(false);
      }
  }


  const handleGenerateOC = async (quotes: Quotation[], justificationText: string) => {
    if (!firestore || !storage || !user || !requisition || !items.length || selectedQuotationIndex === null) {
      throw new Error("Dados insuficientes para gerar a Ordem de Compra.");
    }
    
    const chosenQuotation = quotes[selectedQuotationIndex];
    if (!chosenQuotation || !chosenQuotation.supplierId) {
      throw new Error("A cotação escolhida é inválida ou não possui um fornecedor.");
    }

    setIsSaving(true);
    
    try {
      const counterRef = doc(firestore, 'counters', 'purchaseOrders');
      const newId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const lastId = counterDoc.exists() ? counterDoc.data()?.lastId || 0 : 0;
        const newId = lastId + 1;
        transaction.set(counterRef, { lastId: newId }, { merge: true });
        return newId;
      });
      const ocProtocol = `OC-${new Date().getFullYear()}-${String(newId).padStart(5, '0')}`;
      
      const ocRef = doc(collection(firestore, 'purchase_requisitions'));
            
      const ocData: Omit<PurchaseRequisition, 'id'> = {
        protocol: ocProtocol, originalRequisitionId: requisition.docId,
        requesterId: requisition.requesterId, requesterName: requisition.requesterName,
        costCenterId: requisition.costCenterId, neededByDate: requisition.neededByDate,
        type: 'Ordem de Compra', status: 'Em Aprovação', createdAt: new Date().toISOString(),
        priority: requisition.priority, purchaseReason: requisition.purchaseReason,
        expensiveChoiceJustification: justificationText, purchaseOrderNotes: purchaseOrderNotes,
        supplierId: chosenQuotation.supplierId,
        totalValue: Number(chosenQuotation.totalValue),
        paymentTerms: chosenQuotation.paymentTerms,
      };

      const ocBatch = writeBatch(firestore);
      ocBatch.set(ocRef, ocData);

      for (const item of items) {
        const ocItemRef = doc(collection(ocRef, 'items'));
        const { details, ...baseItem } = item;
        const itemData: Omit<PurchaseRequisitionItem, 'id' | 'quotations' | 'selectedQuotationIndex'> & {quotations: Quotation[], selectedQuotationIndex: number | null} = {
            itemId: baseItem.itemId,
            itemType: baseItem.itemType,
            quantity: baseItem.quantity,
            estimatedPrice: baseItem.estimatedPrice,
            status: 'Pendente',
            notes: baseItem.notes,
            attachmentUrl: baseItem.attachmentUrl,
            quotations: quotes,
            selectedQuotationIndex: selectedQuotationIndex
        }
        ocBatch.set(ocItemRef, itemData);
      }
      await ocBatch.commit();
      
      const scUpdateBatch = writeBatch(firestore);
      for (const item of items) {
          const originalItemRef = doc(firestore, 'purchase_requisitions', requisition.docId, 'items', item.docId);
          scUpdateBatch.update(originalItemRef, { status: 'Cotado' });
      }
      
      await scUpdateBatch.commit();
      
    } catch (err) {
      console.error("Erro ao gerar OC:", err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }


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
        const finalQuotes = await saveQuotationsToItems(quotations, 'Cotado');
        await handleGenerateOC(finalQuotes, '');
        toast({ title: "Sucesso!", description: "Ordem de Compra enviada para aprovação." });
        onSuccess();
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message || 'Não foi possível enviar para aprovação.' });
    }
  }
  
  const handleJustificationSubmit = async () => {
      if (!justification) {
          toast({ variant: 'destructive', title: 'Erro', description: 'A justificativa é obrigatória.' });
          return;
      }
      setIsJustificationDialogOpen(false);
      try {
          const finalQuotes = await saveQuotationsToItems(quotations, 'Cotado');
          await handleGenerateOC(finalQuotes, justification);
          toast({ title: "Sucesso!", description: "Ordem de Compra enviada para aprovação." });
          onSuccess();
      } catch (err: any) {
          toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message || 'Não foi possível enviar para aprovação.' });
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

          <DialogFooter className="sm:justify-between">
             <div>
                <Button variant="secondary" onClick={handleSaveProgress} disabled={isSavingProgress || isSaving}>
                    {isSavingProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Progresso
                </Button>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSaving || isSavingProgress}>Cancelar</Button>
                <Button onClick={handleSendForApproval} disabled={isSaving || isSavingProgress || selectedQuotationIndex === null || filledQuotations.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar e Enviar para Aprovação
                </Button>
            </div>
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
