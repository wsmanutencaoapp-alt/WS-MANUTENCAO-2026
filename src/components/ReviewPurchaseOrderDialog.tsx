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
  documentId,
  getDoc,
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
import { Loader2, Upload, FileText, ChevronsUpDown, Check, ShoppingBag, Save, Trash2, Crown, Edit, ExternalLink, PlusCircle } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier, Quotation, Supply, Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './ui/card';
import SupplierSelectorDialog from './SupplierSelectorDialog';
import { cn } from '@/lib/utils';
import { RequisitionItemWithDetails } from './PurchaseRequisitionDetailsDialog';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';


interface ReviewPurchaseOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchaseOrder: WithDocId<PurchaseRequisition>;
}

type QuotationFormState = {
  supplierId: string;
  supplierName: string;
  totalValue: number | string;
  currency: 'BRL' | 'USD';
  isImported: boolean;
  deliveryTime: number | string;
  paymentTerms: string;
  attachmentUrl?: string;
  attachmentFile?: File | null;
};

const emptyQuotation: QuotationFormState = {
  supplierId: '',
  supplierName: '',
  totalValue: '',
  currency: 'BRL',
  isImported: false,
  deliveryTime: '',
  paymentTerms: '',
  attachmentFile: null,
};

export default function ReviewPurchaseOrderDialog({ isOpen, onClose, onSuccess, purchaseOrder }: ReviewPurchaseOrderDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(true);
  const [item, setItem] = useState<RequisitionItemWithDetails | null>(null);
  const [savedQuotations, setSavedQuotations] = useState<QuotationFormState[]>([]);
  const [newQuotation, setNewQuotation] = useState<QuotationFormState>(emptyQuotation);
  const [selectedQuotationIndex, setSelectedQuotationIndex] = useState<number | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSupplierSelectorOpen, setSupplierSelectorOpen] = useState(false);

  // Fetch the single item from the Purchase Order and its master data
  useEffect(() => {
    if (!firestore || !purchaseOrder || !isOpen) return;
    
    const fetchItemAndDetails = async () => {
        setIsLoading(true);
        try {
            const itemsRef = collection(firestore, 'purchase_requisitions', purchaseOrder.docId, 'items');
            const itemsSnapshot = await getDocs(itemsRef);
            
            if (itemsSnapshot.empty) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum item encontrado nesta Ordem de Compra.' });
                setIsLoading(false);
                return;
            }

            const itemDoc = itemsSnapshot.docs[0];
            const itemData = { ...itemDoc.data(), docId: itemDoc.id } as WithDocId<PurchaseRequisitionItem>;

            // Fetch master data for the item
            const masterCollectionName = itemData.itemType === 'supply' ? 'supplies' : 'tools';
            const masterDataRef = doc(firestore, masterCollectionName, itemData.itemId);
            const masterDataSnapshot = await getDoc(masterDataRef);
            
            if (!masterDataSnapshot.exists()) {
                 toast({ variant: 'destructive', title: 'Erro', description: 'Dados mestre do item não encontrados.' });
                 setIsLoading(false);
                 return;
            }
            
            const masterData = {...masterDataSnapshot.data() as (Supply | Tool), docId: masterDataSnapshot.id};

            const enrichedItem: RequisitionItemWithDetails = {
                ...itemData,
                details: masterData
            };
            
            setItem(enrichedItem);
            
            const itemQuotes = itemData.quotations || [];
            const initialQuotes = itemQuotes.map(q => ({
                supplierId: q.supplierId, supplierName: q.supplierName,
                totalValue: q.totalValue, deliveryTime: q.deliveryTime,
                paymentTerms: q.paymentTerms, attachmentUrl: q.attachmentUrl,
                currency: q.currency || 'BRL',
                isImported: q.isImported || false,
                attachmentFile: null,
            }));
            setSavedQuotations(initialQuotes);
            setSelectedQuotationIndex(itemData.selectedQuotationIndex ?? null);

        } catch (error) {
            console.error("Error fetching item details:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os detalhes do item.' });
        } finally {
            setIsLoading(false);
        }
    };

    fetchItemAndDetails();

  }, [firestore, purchaseOrder, isOpen, toast]);

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

  const handleResubmit = async () => {
      if (!firestore || !storage || !purchaseOrder || !item || selectedQuotationIndex === null) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Dados incompletos para reenviar.' });
          return;
      }
      
      setIsSaving(true);
      const batch = writeBatch(firestore);

      try {
          // 1. Update the item in the OC subcollection with new quotations
          const finalQuotations: Quotation[] = [];
          for (const q of savedQuotations) {
              let attachmentUrl = q.attachmentUrl || '';
              if (q.attachmentFile) {
                const fileRef = storageRef(storage, `quotations/${purchaseOrder.docId}/${item.docId}-${q.supplierId}-${q.attachmentFile.name}`);
                await uploadBytes(fileRef, q.attachmentFile);
                attachmentUrl = await getDownloadURL(fileRef);
              }
              finalQuotations.push({
                supplierId: q.supplierId, supplierName: q.supplierName, totalValue: Number(q.totalValue),
                currency: q.currency,
                isImported: q.isImported,
                deliveryTime: Number(q.deliveryTime), paymentTerms: q.paymentTerms, attachmentUrl: attachmentUrl
              });
          }

          const itemRef = doc(firestore, 'purchase_requisitions', purchaseOrder.docId, 'items', item.docId);
          batch.update(itemRef, {
              quotations: finalQuotations,
              selectedQuotationIndex: selectedQuotationIndex,
          });

          // 2. Update the main OC document with the new winner and reset status
          const winningQuote = savedQuotations[selectedQuotationIndex];
          const ocRef = doc(firestore, 'purchase_requisitions', purchaseOrder.docId);
          batch.update(ocRef, {
              status: 'Em Aprovação', // Send back to approval
              rejectionReason: '', // Clear the rejection reason
              supplierId: winningQuote.supplierId,
              supplierName: winningQuote.supplierName,
              totalValue: Number(winningQuote.totalValue),
              paymentTerms: winningQuote.paymentTerms,
          });

          await batch.commit();
          toast({ title: 'Sucesso!', description: 'Ordem de Compra foi atualizada e reenviada para aprovação.' });
          onSuccess();
          onClose();

      } catch (err: any) {
          console.error("Erro ao reenviar OC:", err);
          toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message });
      } finally {
          setIsSaving(false);
      }
  };
  

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Revisar Ordem de Compra - {purchaseOrder.protocol}</DialogTitle>
            <DialogDescription>
              A OC foi devolvida. Ajuste as cotações, selecione um novo vencedor e reenvie para aprovação.
              <br/>
              <span className="text-orange-500 font-medium">Motivo: {purchaseOrder.rejectionReason || 'N/A'}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-4 py-4">
            
             <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium">
                         Item: {item?.details.descricao || (isLoading ? 'Carregando...' : 'Não encontrado')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                    <Card className="p-4 space-y-3 bg-muted/50 border-dashed">
                        <h3 className="font-semibold">Adicionar/Editar Orçamento</h3>
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
                        <div className="grid grid-cols-[2fr,1fr] gap-2">
                            <div className="space-y-1.5">
                                <Label>Valor Total</Label>
                                <Input type="number" value={newQuotation.totalValue} onChange={(e) => handleNewQuotationChange('totalValue', e.target.value)} className="bg-background"/>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Moeda</Label>
                                <Select value={newQuotation.currency} onValueChange={(value) => handleNewQuotationChange('currency', value as 'BRL' | 'USD')}>
                                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BRL">BRL (R$)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-center">
                            <div className="space-y-1.5">
                                <Label>Prazo (dias)</Label>
                                <Input type="number" value={newQuotation.deliveryTime} onChange={(e) => handleNewQuotationChange('deliveryTime', e.target.value)} className="bg-background"/>
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch id="isImported-review" checked={newQuotation.isImported} onCheckedChange={(checked) => handleNewQuotationChange('isImported', checked)} />
                                <Label htmlFor="isImported-review">Importado</Label>
                            </div>
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
                        <h3 className="font-semibold">Orçamentos Atuais ({savedQuotations.length})</h3>
                        {isLoading && <Loader2 className='mx-auto h-6 w-6 animate-spin'/>}
                        {!isLoading && savedQuotations.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento encontrado para este item.</p>
                        )}
                        {!isLoading && savedQuotations.map((q, index) => (
                           <Card key={index} className={cn("p-3 relative", selectedQuotationIndex === index && "border-primary ring-2 ring-primary")}>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold pr-10">{q.supplierName}</p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1" onClick={() => removeQuotation(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                      <div><Label className="text-muted-foreground">Valor:</Label> <p>{Number(q.totalValue).toLocaleString('pt-BR', {style: 'currency', currency: q.currency || 'BRL'})}</p></div>
                                      <div><Label className="text-muted-foreground">Prazo:</Label> <p>{q.deliveryTime} dias {q.isImported && <Badge variant="outline" className="ml-1">Importado</Badge>}</p></div>
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

          <DialogFooter>
             <div className="flex w-full justify-between">
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleResubmit} disabled={isSaving || selectedQuotationIndex === null || isLoading}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4"/>
                    Salvar Alterações e Reenviar
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
    </>
  );
}
