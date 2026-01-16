'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, addDoc, writeBatch, doc, where, getDocs, orderBy, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShoppingCart, PlusCircle, Trash2, CalendarIcon, PackageSearch, ListChecks, Upload, FileText } from 'lucide-react';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Supply, CostCenter, PurchaseRequisition, PurchaseRequisitionItem, Tool, Employee, Notification } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Textarea } from '@/components/ui/textarea';
import ItemSelectorDialog from '@/components/ItemSelectorDialog';
import MyRequisitionsTable from '@/components/MyRequisitionsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useStorage } from '@/firebase/provider';


type RequisitionableItem = (WithDocId<Supply> | WithDocId<Tool>) & { itemType: 'supply' | 'tool' };
type CartItem = RequisitionableItem & { 
    requisitionQuantity: number;
    estimatedPrice?: number;
    notes?: string;
    attachmentFile?: File | null;
};

const RequisicaoCompraPage = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [costCenterId, setCostCenterId] = useState('');
  const [neededByDate, setNeededByDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  
  const [priority, setPriority] = useState<PurchaseRequisition['priority']>('Normal');
  const [purchaseReason, setPurchaseReason] = useState('');


  const suppliesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'supplies')) : null, [firestore]);
  const { data: allSupplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery, {queryKey: ['allSuppliesForReq']});
  
  const toolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'tools'), where('enderecamento', '==', 'LOGICA')) : null, [firestore]);
  const { data: allTools, isLoading: isLoadingTools } = useCollection<WithDocId<Tool>>(toolsQuery, {queryKey: ['allToolModelsForReq']});

  const costCentersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery);

  const catalogItems = useMemo((): RequisitionableItem[] => {
    if (isLoadingSupplies || isLoadingTools) return [];
    const suppliesWithType = allSupplies?.map(s => ({...s, itemType: 'supply' as const })) || [];
    const toolsWithType = allTools?.map(t => ({...t, itemType: 'tool' as const })) || [];
    const cartIds = new Set(cart.map(item => item.docId));
    return [...suppliesWithType, ...toolsWithType].filter(item => !cartIds.has(item.docId));
  }, [allSupplies, allTools, cart, isLoadingSupplies, isLoadingTools]);
  
  const addToCart = (item: RequisitionableItem) => {
    setCart(prev => [...prev, { 
        ...item, 
        requisitionQuantity: 1, 
        estimatedPrice: item.valor_estimado || 0, 
        notes: '', 
        attachmentFile: null 
    }]);
  };

  const removeFromCart = (docId: string) => {
    setCart(prev => prev.filter(item => item.docId !== docId));
  };

  const updateCartItem = (docId: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => item.docId === docId ? { ...item, [field]: value } : item));
  };
  
  const handleFileChange = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    updateCartItem(docId, 'attachmentFile', file);
  }

  const handleSubmitRequisition = async () => {
    if (!firestore || !user || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
        return;
    }
    if (cart.length === 0) { toast({ variant: 'destructive', title: 'Erro', description: 'O carrinho está vazio.' }); return; }
    if (!costCenterId) { toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um centro de custo.' }); return; }
    if (!neededByDate) { toast({ variant: 'destructive', title: 'Erro', description: 'Selecione a data de necessidade.' }); return; }
    if (!purchaseReason) { toast({ variant: 'destructive', title: 'Erro', description: 'O motivo da compra é obrigatório.' }); return; }

    setIsSubmitting(true);
    try {
        const batch = writeBatch(firestore);
        
        const counterRef = doc(firestore, 'counters', 'purchaseRequisitions');
        const counterSnapshot = await getDoc(counterRef);

        let lastId = 0;
        if (counterSnapshot.exists()) {
            lastId = counterSnapshot.data().lastId || 0;
        }
        const newId = lastId + 1;
        const year = new Date().getFullYear().toString().slice(-2);
        const protocol = `SC${year}${String(newId).padStart(5, '0')}`;

        
        const requisitionRef = doc(collection(firestore, 'purchase_requisitions'));

        const requisitionData: Omit<PurchaseRequisition, 'id'> = {
            protocol: protocol,
            requesterId: user.uid,
            requesterName: user.displayName || user.email || 'Desconhecido',
            costCenterId: costCenterId,
            neededByDate: neededByDate.toISOString(),
            status: 'Em Aprovação',
            createdAt: new Date().toISOString(),
            priority: priority,
            purchaseReason: purchaseReason,
            type: 'Solicitação de Compra',
        };
        batch.set(requisitionRef, requisitionData);
        
        for (const item of cart) {
            let attachmentUrl = '';
            if(item.attachmentFile) {
                const fileRef = storageRef(storage, `requisition_attachments/${requisitionRef.id}/${item.docId}-${item.attachmentFile.name}`);
                await uploadBytes(fileRef, item.attachmentFile);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            const itemRef = doc(collection(firestore, 'purchase_requisitions', requisitionRef.id, 'items'));
            const itemData: Omit<PurchaseRequisitionItem, 'id'> = {
                itemId: item.docId,
                itemType: item.itemType,
                quantity: item.requisitionQuantity,
                estimatedPrice: item.estimatedPrice || 0,
                status: 'Pendente',
                notes: item.notes,
                attachmentUrl: attachmentUrl,
            };
            batch.set(itemRef, itemData);
        }
        
        if (counterSnapshot.exists()) {
            batch.update(counterRef, { lastId: newId });
        } else {
            batch.set(counterRef, { lastId: newId });
        }

        // Create notifications for approvers
        const approversQuery = query(collection(firestore, 'employees'), where('permissions.compras', '==', true));
        const approversSnapshot = await getDocs(approversQuery);

        if (!approversSnapshot.empty) {
            approversSnapshot.forEach(approverDoc => {
                const approverId = approverDoc.id;
                const notificationRef = doc(collection(firestore, `employees/${approverId}/notifications`));
                const notificationData: Omit<Notification, 'id'> = {
                    userId: approverId,
                    title: 'Nova Requisição para Aprovação',
                    message: `A solicitação ${protocol} de ${user.displayName || user.email} aguarda sua aprovação.`,
                    link: '/dashboard/compras/aprovacoes',
                    read: false,
                    createdAt: new Date().toISOString(),
                };
                batch.set(notificationRef, notificationData);
            });
        }
        
        await batch.commit();

        toast({ title: 'Sucesso!', description: 'Sua requisição de compra foi enviada para aprovação.' });
        setCart([]);
        setCostCenterId('');
        setNeededByDate(undefined);
        setPurchaseReason('');
        setPriority('Normal');
    } catch(err) {
        console.error("Erro ao criar requisição:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível criar a requisição.' });
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Requisição de Compra</h1>
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">
                <ShoppingCart className="mr-2 h-4 w-4"/>
                Nova Requisição
            </TabsTrigger>
            <TabsTrigger value="history">
                <ListChecks className="mr-2 h-4 w-4"/>
                Minhas Solicitações
            </TabsTrigger>
        </TabsList>
        <TabsContent value="new">
            <Card className="w-full mt-4">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Nova Solicitação de Compra
                </CardTitle>
                <CardDescription>Preencha os dados da solicitação e adicione os itens necessários.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                {/* Header Fields */}
                <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="font-semibold text-lg">Detalhes da Solicitação</h3>
                    <div className="space-y-1.5">
                        <Label htmlFor="purchaseReason">Motivo da Compra <span className="text-destructive">*</span></Label>
                        <Textarea id="purchaseReason" value={purchaseReason} onChange={(e) => setPurchaseReason(e.target.value)} placeholder="Ex: Item para manutenção corretiva da aeronave PR-ABC." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="costCenter">Centro de Custo <span className="text-destructive">*</span></Label>
                            <Select value={costCenterId} onValueChange={setCostCenterId} disabled={isLoadingCostCenters}>
                                <SelectTrigger id="costCenter">
                                    <SelectValue placeholder={isLoadingCostCenters ? "Carregando..." : "Selecione"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {costCenters?.map(cc => (
                                        <SelectItem key={cc.docId} value={cc.docId}>({cc.code}) {cc.description}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="priority">Prioridade <span className="text-destructive">*</span></Label>
                            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                                <SelectTrigger id="priority"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Normal">Normal</SelectItem>
                                    <SelectItem value="Urgente">Urgente</SelectItem>
                                    <SelectItem value="Muito Urgente">Muito Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Data de Necessidade <span className="text-destructive">*</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {neededByDate ? format(neededByDate, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={neededByDate}
                                    onSelect={setNeededByDate}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
                
                {/* Cart Items */}
                <div className="space-y-4">
                    <div className='flex justify-between items-center'>
                        <h3 className="font-semibold text-lg">Itens da Solicitação ({cart.length})</h3>
                        <Button variant="outline" onClick={() => setIsSelectorOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar Item ao Carrinho
                        </Button>
                    </div>
                    <ScrollArea className="h-64 border rounded-md">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <PackageSearch className="h-10 w-10 mb-2"/>
                                <p>Seu carrinho está vazio.</p>
                                <p className="text-sm">Clique em "Adicionar Item" para começar.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 p-3">
                            {cart.map(item => (
                                <Card key={item.docId} className="p-3 shadow-none">
                                    <div className="flex items-start gap-4">
                                        <Image
                                            src={item.imageUrl || 'https://picsum.photos/seed/item/64/64'}
                                            alt={item.descricao}
                                            width={48}
                                            height={48}
                                            className="rounded-md aspect-square object-cover"
                                        />
                                        <div className="flex-1 text-sm space-y-2">
                                            <p className="font-bold">{item.descricao}</p>
                                            <p className="font-mono text-xs text-muted-foreground">{item.codigo}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                 <div>
                                                    <Label htmlFor={`quantity-${item.docId}`} className="text-xs text-muted-foreground">Quantidade</Label>
                                                    <Input 
                                                        id={`quantity-${item.docId}`}
                                                        type="number" 
                                                        placeholder="Qtd."
                                                        value={item.requisitionQuantity}
                                                        onChange={(e) => updateCartItem(item.docId, 'requisitionQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="h-8 text-center"
                                                        min="1"
                                                    />
                                                 </div>
                                                 <div>
                                                     <Label htmlFor={`price-${item.docId}`} className="text-xs text-muted-foreground">Preço Estimado (R$)</Label>
                                                    <Input
                                                        id={`price-${item.docId}`}
                                                        type="number"
                                                        placeholder="Preço Est. (R$)"
                                                        value={item.estimatedPrice || ''}
                                                        onChange={(e) => updateCartItem(item.docId, 'estimatedPrice', parseFloat(e.target.value) || undefined)}
                                                        className="h-8 text-center"
                                                    />
                                                 </div>
                                            </div>
                                            <Input
                                                placeholder="Observação (opcional)"
                                                value={item.notes || ''}
                                                onChange={(e) => updateCartItem(item.docId, 'notes', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                            <Button asChild variant="outline" size="sm" className="w-full h-8 text-sm">
                                                <label htmlFor={`file-${item.docId}`} className="cursor-pointer">
                                                    {item.attachmentFile ? <FileText className="mr-2 h-4 w-4 text-green-600"/> : <Upload className="mr-2 h-4 w-4"/>}
                                                    <span className="truncate">{item.attachmentFile ? item.attachmentFile.name : 'Anexar Referência'}</span>
                                                    <Input id={`file-${item.docId}`} type="file" className="sr-only" onChange={(e) => handleFileChange(item.docId, e)} />
                                                </label>
                                            </Button>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeFromCart(item.docId)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
                </CardContent>
                <CardFooter>
                <Button className="w-full" onClick={handleSubmitRequisition} disabled={isSubmitting || cart.length === 0 || !costCenterId || !neededByDate || !purchaseReason}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar para Aprovação
                </Button>
                </CardFooter>
            </Card>
        </TabsContent>
        <TabsContent value="history">
            <MyRequisitionsTable />
        </TabsContent>
      </Tabs>


       <ItemSelectorDialog
          isOpen={isSelectorOpen}
          onClose={() => setIsSelectorOpen(false)}
          items={catalogItems}
          onSelect={addToCart}
          filterFunction={(items, term) => {
              if (!term) return []; // Don't show anything if no search term
              const lowercasedTerm = term.toLowerCase();
              return items.filter(item => 
                item.descricao.toLowerCase().includes(lowercasedTerm) || 
                item.codigo.toLowerCase().includes(lowercasedTerm) ||
                (item.itemType === 'supply' && (item as Supply).partNumber && (item as Supply).partNumber.toLowerCase().includes(lowercasedTerm)) ||
                (item.itemType === 'tool' && (item as Tool).pn_fabricante && (item as Tool).pn_fabricante.toLowerCase().includes(lowercasedTerm))
            );
          }}
          renderItem={(item) => (
             <div className="flex items-center gap-4 w-full">
                <Image 
                    src={item.imageUrl || 'https://picsum.photos/seed/item/64/64'}
                    alt={item.descricao}
                    width={40}
                    height={40}
                    className="rounded-md aspect-square object-cover"
                />
                <div className="flex-1 text-sm text-left">
                    <p className="font-bold">{item.descricao}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                        {item.codigo} / {item.itemType === 'supply' ? (item as WithDocId<Supply>).partNumber : (item as WithDocId<Tool>).pn_fabricante || 'N/A'}
                    </p>
                </div>
            </div>
          )}
          title="Selecionar Item para Requisição"
          description="Pesquise no catálogo e clique em um item para adicioná-lo ao seu carrinho."
          isLoading={isLoadingSupplies || isLoadingTools}
       />
    </>
  );
};

export default RequisicaoCompraPage;
