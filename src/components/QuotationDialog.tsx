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
import { Loader2, Upload, FileText, ChevronsUpDown, Check, Info, ShoppingBag, List, Save, ArrowLeft, ArrowRight } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier, Quotation } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
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

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [quotations, setQuotations] = useState<QuotationFormState[]>([]);
  const [selectedQuotationIndex, setSelectedQuotationIndex] = useState<number | null>(null);
  const [justification, setJustification] = useState('');
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [supplierSelectorOpen, setSupplierSelectorOpen] = useState(false);
  const [activeQuotationIndex, setActiveQuotationIndex] = useState<number | null>(null);
  const [isJustificationDialogOpen, setIsJustificationDialogOpen] = useState(false);

  const currentItem = useMemo(() => items[currentItemIndex], [items, currentItemIndex]);

  useEffect(() => {
    if (isOpen && currentItem) {
        setJustification('');
        setPurchaseOrderNotes('');
        const itemQuotes = currentItem.quotations || [];
        const initialQuotes = Array.from({ length: 3 }).map((_, i) => {
            const q = itemQuotes[i];
            if (q && q.supplierId) {
                return {
                    supplierId: q.supplierId, supplierName: q.supplierName,
                    totalValue: q.totalValue, deliveryTime: q.deliveryTime,
                    paymentTerms: q.paymentTerms, attachmentUrl: q.attachmentUrl,
                    attachmentFile: null,
                };
            }
            return {...emptyQuotation};
        });
        setQuotations(initialQuotes);
        setSelectedQuotationIndex(currentItem.selectedQuotationIndex ?? null);
    }
  }, [isOpen, currentItem]);

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

  const saveCurrentItemQuotations = async (status: PurchaseRequisitionItem['status'] = 'Em Cotação') => {
      if (!firestore || !storage || !requisition || !currentItem) throw new Error("Dados da sessão inválidos.");
      
      const finalQuotations: Quotation[] = [];
      for (const q of quotations) {
          if (!q.supplierId) {
            finalQuotations.push({} as Quotation);
            continue;
          };
          let attachmentUrl = q.attachmentUrl || '';
          if (q.attachmentFile) {
            const fileRef = storageRef(storage, `quotations/${requisition.docId}/${currentItem.docId}-${q.supplierId}-${q.attachmentFile.name}`);
            await uploadBytes(fileRef, q.attachmentFile);
            attachmentUrl = await getDownloadURL(fileRef);
          }
          finalQuotations.push({
            supplierId: q.supplierId, supplierName: q.supplierName, totalValue: Number(q.totalValue),
            deliveryTime: Number(q.deliveryTime), paymentTerms: q.paymentTerms, attachmentUrl: attachmentUrl
          });
      }

      const itemRef = doc(firestore, 'purchase_requisitions', requisition.docId, 'items', currentItem.docId);
      await updateDoc(itemRef, {
          quotations: finalQuotations,
          selectedQuotationIndex: selectedQuotationIndex,
          status: status
      });
      
      return finalQuotations;
  };
  
  const handleSaveProgress = async () => {
      setIsSaving(true);
      try {
          await saveCurrentItemQuotations('Em Cotação');
          // Update the main requisition status if it's the first time
          if (requisition.status !== 'Em Cotação' && requisition.status !== 'Parcialmente Atendida') {
              const reqRef = doc(firestore, 'purchase_requisitions', requisition.docId);
              await updateDoc(reqRef, { status: 'Em Cotação' });
          }
          
          toast({ title: "Progresso Salvo!", description: "As cotações para este item foram salvas." });
          onSuccess();
          // Do not close, allow to continue
      } catch (err: any) {
          console.error("Erro ao salvar progresso:", err);
          toast({ variant: 'destructive', title: 'Erro ao Salvar', description: err.message });
      } finally {
          setIsSaving(false);
      }
  }


  const handleGenerateOC = async (justificationText: string) => {
    // This function will now be responsible for generating the OC for all items, not just one
    // It should be called after all quotations are done.
    // For now, let's assume it's called per-item.
    if (selectedQuotationIndex === null) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione a cotação vencedora para este item.' });
      return;
    }
    
    setIsSaving(true);
    try {
        await saveCurrentItemQuotations('Cotado');
        toast({ title: "Item Finalizado!", description: `O item ${currentItem.details.codigo} foi cotado e marcado como finalizado.` });

        // Check if all items in the original list are now 'Cotado'
        const allItemsRef = collection(firestore, 'purchase_requisitions', requisition.docId, 'items');
        const allItemsSnapshot = await getDocs(allItemsRef);
        const allItemsData = allItemsSnapshot.docs.map(d => d.data() as PurchaseRequisitionItem);
        const allItemsQuoted = allItemsData.every(item => item.status === 'Cotado');
        
        if (allItemsQuoted) {
            // Logic to generate the OC would go here, which is a larger scope
            toast({ title: 'Pronto para OC!', description: "Todos os itens foram cotados. A geração da Ordem de Compra pode ser implementada." });
        }
        
        onSuccess();
        onClose();
        
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message });
    } finally {
        setIsSaving(false);
    }
  }
  
  const handleNext = () => {
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
    }
  };


  return (
    <>
      <Dialog open={isOpen && !isJustificationDialogOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Cotação - {requisition.protocol}</DialogTitle>
            <DialogDescription>
              Preencha os orçamentos para os itens selecionados e, ao final, gere a Ordem de Compra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-4 py-4">
            
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-base font-medium">
                            Item {currentItemIndex + 1} de {items.length}: {currentItem?.details.descricao}
                        </CardTitle>
                        <CardDescription>Código: {currentItem?.details.codigo} | Qtd: {currentItem?.quantity}</CardDescription>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={handlePrev} disabled={currentItemIndex === 0}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleNext} disabled={currentItemIndex === items.length - 1}>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={selectedQuotationIndex?.toString()} onValueChange={(v) => setSelectedQuotationIndex(Number(v))}>
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start pt-4">
                          {quotations.map((q, index) => (
                             <Card key={index} className="p-4 space-y-3 relative">
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
                                    >
                                        {q.supplierName || "Selecione..."}
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
                </CardContent>
            </Card>
            
          </div>

          <DialogFooter className="sm:justify-between">
             <div>
                <Button variant="secondary" onClick={handleSaveProgress} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Progresso do Item
                </Button>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={() => handleGenerateOC('')} disabled={isSaving || selectedQuotationIndex === null || filledQuotations.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Finalizar Cotação do Item
                </Button>
            </div>
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
            <Button onClick={() => handleGenerateOC(justification)} disabled={!justification || isSaving}>Confirmar e Gerar OC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierSelectorDialog 
        isOpen={supplierSelectorOpen}
        onClose={() => setSupplierSelectorOpen(false)}
        onSelect={handleSupplierSelect}
        suppliers={[]}
        isLoading={false}
      />
    </>
  );
}

    