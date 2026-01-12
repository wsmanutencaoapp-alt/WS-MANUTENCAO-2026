'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import {
  collection,
  query,
  where,
  documentId,
  doc,
  writeBatch,
  getDocs,
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
import { Loader2, Search, Upload, FileText, ChevronsUpDown, Check, Trash2, Info } from 'lucide-react';
import type { PurchaseRequisition, PurchaseRequisitionItem, Supplier, Tool, Supply } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Textarea } from './ui/textarea';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from './ui/card';
import { Separator } from './ui/separator';

interface QuotationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requisition: WithDocId<PurchaseRequisition>;
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

export default function QuotationDialog({ isOpen, onClose, onSuccess, requisition }: QuotationDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quotations, setQuotations] = useState<QuotationFormState[]>([emptyQuotation, emptyQuotation, emptyQuotation]);
  const [selectedQuotationIndex, setSelectedQuotationIndex] = useState<number | null>(null);
  const [justification, setJustification] = useState('');
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activePopover, setActivePopover] = useState<number | null>(null);

  const suppliersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'suppliers')) : null), [firestore]);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<WithDocId<Supplier>>(suppliersQuery, {
    queryKey: ['allSuppliersForQuotation'],
    enabled: isOpen,
  });

  const itemsQuery = useMemoFirebase(() => {
    if (!firestore || !requisition) return null;
    return query(collection(firestore, 'purchase_requisitions', requisition.docId, 'items'));
  }, [firestore, requisition]);
  
  const { data: items, isLoading: isLoadingItems } = useCollection<WithDocId<PurchaseRequisitionItem>>(itemsQuery, {
      queryKey: ['requisitionItemsForQuotation', requisition?.docId],
      enabled: !!requisition && isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setQuotations([emptyQuotation, emptyQuotation, emptyQuotation]);
      setSelectedQuotationIndex(null);
      setJustification('');
      setPurchaseOrderNotes('');
    }
  }, [isOpen, requisition]);

  const handleQuotationChange = (index: number, field: keyof QuotationFormState, value: any) => {
    const updatedQuotations = [...quotations];
    updatedQuotations[index] = { ...updatedQuotations[index], [field]: value };
    setQuotations(updatedQuotations);
  };
  
  const handleSupplierSelect = (index: number, supplier: WithDocId<Supplier>) => {
    const updatedQuotations = [...quotations];
    updatedQuotations[index] = { 
        ...updatedQuotations[index], 
        supplierId: supplier.docId,
        supplierName: supplier.name,
    };
    setQuotations(updatedQuotations);
    setActivePopover(null);
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


  const handleSave = async () => {
    if (!firestore || !storage || !requisition) return;

    if (filledQuotations.length === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Preencha pelo menos um orçamento completo.' });
        return;
    }
    if (selectedQuotationIndex === null) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um orçamento vencedor.' });
        return;
    }
     if (filledQuotations.length < 3 && !justification) {
        toast({ variant: 'destructive', title: 'Erro', description: 'É necessário justificar por que não há 3 orçamentos.' });
        return;
    }
    if (isJustificationRequired && !justification) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Justifique a escolha do orçamento que não é o mais barato.' });
        return;
    }

    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        const ocRef = doc(firestore, 'purchase_requisitions', requisition.docId);

        const finalQuotations = [];
        for (const [index, q] of quotations.entries()) {
            if (!q.supplierId) continue;
            
            let attachmentUrl = q.attachmentUrl || '';
            if (q.attachmentFile) {
                const fileRef = storageRef(storage, `quotations/${requisition.docId}/${q.supplierId}-${q.attachmentFile.name}`);
                await uploadBytes(fileRef, q.attachmentFile);
                attachmentUrl = await getDownloadURL(fileRef);
            }
            finalQuotations.push({
                supplierId: q.supplierId,
                supplierName: q.supplierName,
                totalValue: Number(q.totalValue),
                deliveryTime: Number(q.deliveryTime),
                paymentTerms: q.paymentTerms,
                attachmentUrl: attachmentUrl
            });
        }
        
        batch.update(ocRef, {
            type: 'Ordem de Compra',
            status: 'Em Aprovação',
            quotations: finalQuotations,
            selectedQuotationIndex: selectedQuotationIndex,
            expensiveChoiceJustification: justification,
            purchaseOrderNotes: purchaseOrderNotes,
        });

        await batch.commit();

        toast({ title: "Sucesso!", description: "Ordem de Compra enviada para aprovação." });
        onSuccess();
    } catch (err: any) {
        console.error("Erro ao salvar cotação: ", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar a cotação.' });
    } finally {
        setIsSaving(false);
    }

  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Cotação - {requisition.protocol}</DialogTitle>
          <DialogDescription>
            Insira os orçamentos recebidos dos fornecedores para os itens da requisição.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[75vh] py-4">
          
          <div className="md:col-span-1 space-y-4">
            <h3 className="font-semibold text-lg">Itens da Requisição</h3>
            <ScrollArea className="h-full border rounded-md p-4">
                {isLoadingItems && <Loader2 className="animate-spin mx-auto"/>}
                {items?.map((item, index) => (
                    <div key={item.docId} className="text-sm">
                        <p className="font-bold">{item.details?.descricao || 'Carregando...'}</p>
                        <p>Quantidade: <span className="font-medium">{item.quantity}</span></p>
                        {item.notes && <p className="text-xs text-muted-foreground">Obs: {item.notes}</p>}
                        {index < items.length - 1 && <Separator className="my-2"/>}
                    </div>
                ))}
            </ScrollArea>
          </div>
          
          <div className="md:col-span-2 space-y-4">
             <h3 className="font-semibold text-lg">Orçamentos</h3>
             <RadioGroup value={selectedQuotationIndex?.toString()} onValueChange={(v) => setSelectedQuotationIndex(Number(v))}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
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
                               <Popover open={activePopover === index} onOpenChange={(isOpen) => setActivePopover(isOpen ? index : null)}>
                                   <PopoverTrigger asChild>
                                   <Button variant="outline" className="w-full justify-between font-normal" disabled={isLoadingSuppliers}>
                                       {isLoadingSuppliers ? <Loader2 className="h-4 w-4 animate-spin"/> : q.supplierName || "Selecione..."}
                                       <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                   </Button>
                                   </PopoverTrigger>
                                   <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                                       <Command><CommandInput placeholder="Pesquisar..."/><CommandList><CommandEmpty>Nenhum fornecedor.</CommandEmpty><CommandGroup>
                                        {suppliers?.map(s => (
                                            <CommandItem key={s.docId} value={s.name} onSelect={() => handleSupplierSelect(index, s)}>
                                                <Check className={cn("mr-2 h-4 w-4", q.supplierId === s.docId ? "opacity-100" : "opacity-0")}/>
                                                {s.name}
                                            </CommandItem>
                                        ))}
                                       </CommandGroup></CommandList></Command>
                                   </PopoverContent>
                               </Popover>
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
                {(isJustificationRequired || filledQuotations.length < 3) && (
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
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar e Enviar para Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
