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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, ChevronsUpDown, Check, ShoppingBag, Save, ArrowLeft, ArrowRight, PlusCircle, Trash2, Crown, AlertTriangle, Edit, ExternalLink } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier, Quotation } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './ui/card';
import SupplierSelectorDialog from './SupplierSelectorDialog';
import { cn } from '@/lib/utils';
import { RequisitionItemWithDetails } from './PurchaseRequisitionDetailsDialog';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';


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
  const [savedQuotations, setSavedQuotations] = useState<QuotationFormState[]>([]);
  const [newQuotation, setNewQuotation] = useState<QuotationFormState>(emptyQuotation);
  const [selectedQuotationIndex, setSelectedQuotationIndex] = useState<number | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSupplierSelectorOpen, setSupplierSelectorOpen] = useState(false);
  const [isJustificationDialogOpen, setIsJustificationDialogOpen] = useState(false);
  const [justification, setJustification] = useState('');

  const currentItem = useMemo(() => items[currentItemIndex], [items, currentItemIndex]);

  useEffect(() => {
    if (isOpen && currentItem) {
        const itemQuotes = currentItem.quotations || [];
        const initialQuotes = itemQuotes.filter(q => q && q.supplierId).map(q => ({
            supplierId: q.supplierId, supplierName: q.supplierName,
            totalValue: q.totalValue, deliveryTime: q.deliveryTime,
            paymentTerms: q.paymentTerms, attachmentUrl: q.attachmentUrl,
            attachmentFile: null,
        }));
        setSavedQuotations(initialQuotes);
        setNewQuotation(emptyQuotation);
        setSelectedQuotationIndex(currentItem.selectedQuotationIndex ?? null);
    }
  }, [isOpen, currentItem]);

  const handleNewQuotationChange = (field: keyof QuotationFormState, value: any) => {
    setNewQuotation(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSupplierSelect = (supplier: WithDocId<Supplier>) => {
    handleNewQuotationChange('supplierId', supplier.docId);
    handleNewQuotationChange('supplierName', supplier.name);
    setSupplierSelectorOpen(false);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          handleNewQuotationChange('attachmentFile', e.target.files[0]);
      }
  }
  
  const handleAddQuotation = () => {
    if (!newQuotation.supplierId || !newQuotation.totalValue) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Fornecedor e Valor Total são obrigatórios.' });
        return;
    }
    setSavedQuotations(prev => [...prev, newQuotation]);
    setNewQuotation(emptyQuotation);
  }
  
  const removeQuotation = (index: number) => {
    setSavedQuotations(prev => prev.filter((_, i) => i !== index));
    if(selectedQuotationIndex === index) {
        setSelectedQuotationIndex(null);
    } else if (selectedQuotationIndex !== null && index < selectedQuotationIndex) {
        setSelectedQuotationIndex(selectedQuotationIndex - 1);
    }
  }

  const handleEditQuotation = (index: number) => {
    const quoteToEdit = savedQuotations[index];
    setNewQuotation(quoteToEdit);
    removeQuotation(index);
  };


  const saveCurrentItemQuotations = async () => {
      if (!firestore || !storage || !requisition || !currentItem) throw new Error("Dados da sessão inválidos.");
      
      const finalQuotations: Quotation[] = [];
      for (const q of savedQuotations) {
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
      const updateData: any = {
        quotations: finalQuotations,
        selectedQuotationIndex: selectedQuotationIndex,
      };
      
      if (finalQuotations.length > 0) {
        updateData.status = 'Em Cotação';
      } else {
        updateData.status = 'Pendente';
      }
      
      if (selectedQuotationIndex !== null) {
          updateData.status = 'Cotado';
      }
      
      await updateDoc(itemRef, updateData);

      // Update the main requisition status if needed
      if (requisition.status === 'Aprovada' || requisition.status === 'Aberta') {
          if (finalQuotations.length > 0) {
            const reqRef = doc(firestore, 'purchase_requisitions', requisition.docId);
            await updateDoc(reqRef, { status: 'Em Cotação' });
          }
      }
  };
  
  const handleSaveProgress = async () => {
      setIsSaving(true);
      try {
          await saveCurrentItemQuotations();
          toast({ title: "Progresso Salvo!", description: "As cotações para este item foram salvas." });
          onSuccess(); // Triggers a refetch
      } catch (err: any) {
          console.error("Erro ao salvar progresso:", err);
          toast({ variant: 'destructive', title: 'Erro ao Salvar', description: err.message });
      } finally {
          setIsSaving(false);
      }
  }
  
  const handleGenerateOC = async () => {
    if (selectedQuotationIndex === null) {
        toast({
            variant: 'destructive',
            title: 'Ação Incompleta',
            description: 'Você precisa selecionar uma cotação vencedora para este item antes de gerar a Ordem de Compra.',
        });
        return;
    }

    const expensiveChoiceJustification = justification || requisition.expensiveChoiceJustification || '';
    
    const requiresJustification = (savedQuotations || []).length > 1 &&
        savedQuotations[selectedQuotationIndex].totalValue >= Math.max(...savedQuotations.map(q => Number(q.totalValue)));

    if (requiresJustification && !expensiveChoiceJustification) {
        setIsJustificationDialogOpen(true);
        return;
    }

    await finishApprovalProcess(expensiveChoiceJustification);
  }

  const finishApprovalProcess = async (finalJustification?: string) => {
    if (!firestore || !currentItem || selectedQuotationIndex === null) return;
    setIsSaving(true);
    setIsJustificationDialogOpen(false); 
    
    try {
        const winningQuote = savedQuotations[selectedQuotationIndex];
        
        await runTransaction(firestore, async (transaction) => {
            const counterRef = doc(firestore, 'counters', 'purchaseOrders');
            const counterDoc = await transaction.get(counterRef);

            let lastId = 0;
            if(counterDoc.exists()){
                lastId = counterDoc.data().lastId || 0;
            }
            const newId = lastId + 1;
            const ocProtocol = `OC-${new Date().getFullYear()}-${String(newId).padStart(5, '0')}`;
            
            const newOcRef = doc(collection(firestore, 'purchase_requisitions'));
            const ocData: Omit<PurchaseRequisition, 'id'> = {
                protocol: ocProtocol,
                originalRequisitionId: requisition.docId,
                requesterId: requisition.requesterId,
                requesterName: requisition.requesterName,
                costCenterId: requisition.costCenterId,
                neededByDate: requisition.neededByDate,
                type: 'Ordem de Compra',
                status: 'Em Aprovação',
                createdAt: new Date().toISOString(),
                priority: requisition.priority,
                purchaseReason: `Item: ${currentItem.details.descricao} (da SC ${requisition.protocol})`,
                expensiveChoiceJustification: finalJustification,
                supplierId: winningQuote.supplierId,
                supplierName: winningQuote.supplierName,
                totalValue: Number(winningQuote.totalValue),
                paymentTerms: winningQuote.paymentTerms,
            };
            transaction.set(newOcRef, ocData);

            const newItemRef = doc(collection(newOcRef, 'items'));
            const newItemData: Omit<PurchaseRequisitionItem, 'id'> = {
                itemId: currentItem.itemId,
                itemType: currentItem.itemType,
                quantity: currentItem.quantity,
                status: 'Pendente', 
                notes: currentItem.notes,
                estimatedPrice: Number(winningQuote.totalValue),
            };
            transaction.set(newItemRef, newItemData);

            // Update original item
            const originalItemRef = doc(firestore, 'purchase_requisitions', requisition.docId, 'items', currentItem.docId);
            transaction.update(originalItemRef, { status: 'Recebido' }); // Or another final status
            
            // Check if all items in original SC are now done
            const allItemsSnapshot = await getDocs(collection(firestore, 'purchase_requisitions', requisition.docId, 'items'));
            const allItems = allItemsSnapshot.docs.map(d => ({...d.data() as PurchaseRequisitionItem, docId: d.id}));
            
            // Exclude the current item from the check, as it's being updated in this transaction
            const otherItems = allItems.filter(i => i.docId !== currentItem.docId);
            const allOthersDone = otherItems.every(i => i.status === 'Recebido' || i.status === 'Cancelado');

            const originalReqRef = doc(firestore, 'purchase_requisitions', requisition.docId);
            if (allOthersDone) {
                transaction.update(originalReqRef, { status: 'Totalmente Atendida' });
            } else {
                transaction.update(originalReqRef, { status: 'Parcialmente Atendida' });
            }

            if (counterDoc.exists()) {
                transaction.update(counterRef, { lastId: newId });
            } else {
                transaction.set(counterRef, { lastId: newId });
            }
        });

        toast({ title: "Ordem de Compra Gerada!", description: `Uma OC para o item foi enviada para aprovação.` });
        
        onSuccess();
        onClose(); 
        
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message });
    } finally {
        setIsSaving(false);
    }
  }
  
  const handleNext = async () => {
    await handleSaveProgress();
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
    }
  };

  const handlePrev = async () => {
    await handleSaveProgress();
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
    }
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Cotação - {requisition.protocol}</DialogTitle>
            <DialogDescription>
              Adicione orçamentos para os itens e, ao final, escolha o vencedor para gerar a Ordem de Compra.
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
                        <Button variant="outline" size="icon" onClick={handlePrev} disabled={currentItemIndex === 0 || isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleNext} disabled={currentItemIndex === items.length - 1 || isSaving}>
                           {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowRight className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                    <Card className="p-4 space-y-3 bg-muted/50 border-dashed">
                        <h3 className="font-semibold">Adicionar Novo Orçamento</h3>
                         <div className="space-y-1.5">
                             <Label>Fornecedor</Label>
                             <Button 
                                variant="outline" 
                                className="w-full justify-between font-normal bg-background" 
                                onClick={() => setSupplierSelectorOpen(true)}
                            >
                                {newQuotation.supplierName || "Selecione..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1.5"><Label>Valor Total (R$)</Label><Input type="number" value={newQuotation.totalValue} onChange={(e) => handleNewQuotationChange('totalValue', e.target.value)} className="bg-background"/></div>
                             <div className="space-y-1.5"><Label>Prazo (dias)</Label><Input type="number" value={newQuotation.deliveryTime} onChange={(e) => handleNewQuotationChange('deliveryTime', e.target.value)} className="bg-background"/></div>
                         </div>
                          <div className="space-y-1.5"><Label>Cond. Pagamento</Label><Input value={newQuotation.paymentTerms} onChange={(e) => handleNewQuotationChange('paymentTerms', e.target.value)} placeholder="Ex: 30/60/90" className="bg-background"/></div>
                          <div className="space-y-1.5"><Label>Anexo</Label>
                              <Button asChild variant="outline" size="sm" className="w-full bg-background">
                                  <label className="cursor-pointer"><Upload className="mr-2"/>{newQuotation.attachmentFile ? <span className='truncate'>{newQuotation.attachmentFile.name}</span> : 'Anexar Orçamento'}<Input type="file" className="sr-only" onChange={handleFileChange}/></label>
                              </Button>
                          </div>
                          <Button className="w-full" onClick={handleAddQuotation} disabled={savedQuotations.length >= 3}>
                              <PlusCircle className="mr-2 h-4 w-4"/>
                              Adicionar Orçamento
                          </Button>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="font-semibold">Orçamentos Criados ({savedQuotations.length})</h3>
                        {savedQuotations.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento adicionado para este item.</p>
                        )}
                        {savedQuotations.map((q, index) => (
                           <Card key={index} className={cn("p-3 relative", selectedQuotationIndex === index && "border-primary ring-2 ring-primary")}>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold pr-10">{q.supplierName}</p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1" onClick={() => removeQuotation(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                      <div><Label className="text-muted-foreground">Valor:</Label> <p>{Number(q.totalValue).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div>
                                      <div><Label className="text-muted-foreground">Prazo:</Label> <p>{q.deliveryTime} dias</p></div>
                                      <div className="col-span-2"><Label className="text-muted-foreground">Pagamento:</Label> <p>{q.paymentTerms}</p></div>
                                  </div>
                                   <div className="flex justify-between items-center pt-2">
                                       <div>
                                        {(q.attachmentUrl || q.attachmentFile) && (
                                            <Button asChild variant="link" size="sm" className="p-0 h-auto">
                                                <a href={q.attachmentUrl || (q.attachmentFile ? URL.createObjectURL(q.attachmentFile) : '#')} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="mr-1 h-3 w-3"/> Ver Anexo
                                                </a>
                                            </Button>
                                        )}
                                       </div>
                                       <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => handleEditQuotation(index)}><Edit className="mr-2 h-4 w-4"/>Editar</Button>
                                            {selectedQuotationIndex !== index ? (
                                                <Button size="sm" variant="outline" onClick={() => setSelectedQuotationIndex(index)}>
                                                    <Check className="mr-2 h-4 w-4"/>
                                                    Selecionar
                                                </Button>
                                            ) : (
                                                    <Badge variant="success" className="gap-1"><Crown className="h-3 w-3"/>Vencedor</Badge>
                                            )}
                                       </div>
                                   </div>
                                </div>
                           </Card>
                        ))}
                    </div>
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
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Fechar</Button>
                <Button onClick={handleGenerateOC} disabled={isSaving || selectedQuotationIndex === null}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <ShoppingBag className="mr-2 h-4 w-4"/>
                    Gerar Ordem de Compra
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SupplierSelectorDialog 
        isOpen={isSupplierSelectorOpen}
        onClose={() => setSupplierSelectorOpen(false)}
        onSelect={handleSupplierSelect}
      />

       <Dialog open={isJustificationDialogOpen} onOpenChange={setIsJustificationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar Escolha Mais Cara</DialogTitle>
            <DialogDescription className="flex items-start gap-2 pt-2">
              <AlertTriangle className="h-6 w-6 text-orange-500 shrink-0" />
              Você selecionou a cotação de maior valor para um ou mais itens. Por favor, forneça uma justificativa geral para esta escolha.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="justification">Justificativa <span className="text-destructive">*</span></Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Menor prazo de entrega, melhor condição de pagamento, única opção disponível, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJustificationDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => finishApprovalProcess(justification)} disabled={!justification || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar e Gerar OC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
