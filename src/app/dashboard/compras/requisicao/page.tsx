'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, addDoc, writeBatch, doc, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ShoppingCart, PlusCircle, Trash2, CalendarIcon } from 'lucide-react';
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
import type { Supply, CostCenter, PurchaseRequisition, PurchaseRequisitionItem, Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

type RequisitionableItem = (WithDocId<Supply> | WithDocId<Tool>) & { itemType: 'supply' | 'tool' };
type CartItem = RequisitionableItem & { 
    requisitionQuantity: number;
    estimatedPrice?: number;
    notes?: string;
};

const RequisicaoCompraPage = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [neededByDate, setNeededByDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('supplies');

  // New state for header fields
  const [priority, setPriority] = useState<'Normal' | 'Urgente' | 'Muito Urgente'>('Normal');
  const [purchaseReason, setPurchaseReason] = useState('');

  const suppliesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'supplies')) : null, [firestore]);
  const { data: allSupplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery);
  
  const toolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'tools'), where('sequencial', '==', 0)) : null, [firestore]);
  const { data: allTools, isLoading: isLoadingTools } = useCollection<WithDocId<Tool>>(toolsQuery);

  const costCentersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery);

  const catalogItems = useMemo((): RequisitionableItem[] => {
    const suppliesWithType = allSupplies?.map(s => ({...s, itemType: 'supply' as const })) || [];
    const toolsWithType = allTools?.map(t => ({...t, itemType: 'tool' as const })) || [];
    return [...suppliesWithType, ...toolsWithType];
  }, [allSupplies, allTools]);

  const filteredItems = useMemo(() => {
    if (!catalogItems) return [];
    const cartIds = new Set(cart.map(item => item.docId));
    
    let availableItems = catalogItems.filter(item => !cartIds.has(item.docId));

    if(activeTab === 'supplies') {
        availableItems = availableItems.filter(item => item.itemType === 'supply');
    } else {
        availableItems = availableItems.filter(item => item.itemType === 'tool');
    }

    if (!searchTerm) return availableItems;

    const lowercasedTerm = searchTerm.toLowerCase();
    return availableItems.filter(item => 
      item.descricao.toLowerCase().includes(lowercasedTerm) || 
      item.codigo.toLowerCase().includes(lowercasedTerm) ||
      (item.itemType === 'supply' && (item as Supply).partNumber && (item as Supply).partNumber.toLowerCase().includes(lowercasedTerm)) ||
      (item.itemType === 'tool' && (item as Tool).pn_fabricante && (item as Tool).pn_fabricante.toLowerCase().includes(lowercasedTerm))
    );
  }, [catalogItems, cart, searchTerm, activeTab]);

  const addToCart = (item: RequisitionableItem) => {
    setCart(prev => [...prev, { ...item, requisitionQuantity: 1, estimatedPrice: 0, notes: '' }]);
  };

  const removeFromCart = (docId: string) => {
    setCart(prev => prev.filter(item => item.docId !== docId));
  };

  const updateCartItem = (docId: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => item.docId === docId ? { ...item, [field]: value } : item));
  };

  const handleSubmitRequisition = async () => {
    if (!firestore || !user) {
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
        const requisitionRef = doc(collection(firestore, 'purchase_requisitions'));

        const requisitionData: Omit<PurchaseRequisition, 'id'> = {
            requesterId: user.uid,
            requesterName: user.displayName || user.email || 'Desconhecido',
            costCenterId: costCenterId,
            neededByDate: neededByDate.toISOString(),
            status: 'Aberta',
            createdAt: new Date().toISOString(),
            priority: priority,
            purchaseReason: purchaseReason,
        };
        batch.set(requisitionRef, requisitionData);

        for (const item of cart) {
            const itemRef = doc(collection(firestore, 'purchase_requisitions', requisitionRef.id, 'items'));
            const itemData: Omit<PurchaseRequisitionItem, 'id'> = {
                itemId: item.docId,
                itemType: item.itemType,
                quantity: item.requisitionQuantity,
                estimatedPrice: item.estimatedPrice,
                notes: item.notes,
            };
            batch.set(itemRef, itemData);
        }
        
        await batch.commit();

        toast({ title: 'Sucesso!', description: 'Sua requisição de compra foi criada.' });
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Catálogo de Materiais e Ferramentas</CardTitle>
            <CardDescription>Selecione os itens que você precisa.</CardDescription>
            <div className="pt-4 flex flex-col gap-4">
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Pesquisar por código, P/N ou descrição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg bg-background pl-8"
                    />
                 </div>
                 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="supplies">Suprimentos</TabsTrigger>
                        <TabsTrigger value="tools">Ferramentas (Modelos)</TabsTrigger>
                    </TabsList>
                 </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh]">
              {(isLoadingSupplies || isLoadingTools) ? (
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map(item => (
                    <div key={item.docId} className="flex items-center gap-4 p-2 border rounded-lg">
                      <Image 
                        src={item.imageUrl || 'https://picsum.photos/seed/item/64/64'}
                        alt={item.descricao}
                        width={48}
                        height={48}
                        className="rounded-md aspect-square object-cover"
                      />
                      <div className="flex-1 text-sm">
                        <p className="font-bold">{item.descricao}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                            {item.codigo} / {item.itemType === 'supply' ? (item as WithDocId<Supply>).partNumber : (item as WithDocId<Tool>).pn_fabricante || 'N/A'}
                        </p>
                      </div>
                      <Badge variant="outline">{item.itemType === 'supply' ? 'Suprimento' : 'Ferramenta'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => addToCart(item)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart />
              Sua Requisição
            </CardTitle>
            <CardDescription>Revise os itens e informações antes de enviar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-1.5">
                <Label>Itens no Carrinho ({cart.length})</Label>
                <ScrollArea className="h-48 border rounded-md p-2">
                    {cart.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground p-4">Seu carrinho está vazio.</p>
                    ) : (
                        <div className="space-y-3">
                        {cart.map(item => (
                            <div key={item.docId} className="p-2 border rounded-md space-y-2">
                                <div className="flex items-start gap-2">
                                    <div className="flex-1 text-sm">
                                        <p className="font-bold truncate">{item.descricao}</p>
                                        <p className="font-mono text-xs text-muted-foreground">{item.codigo}</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeFromCart(item.docId)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                     <Input 
                                        type="number" 
                                        placeholder="Qtd."
                                        value={item.requisitionQuantity}
                                        onChange={(e) => updateCartItem(item.docId, 'requisitionQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                                        className="h-8 text-center"
                                        min="1"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Preço Est. (R$)"
                                        value={item.estimatedPrice}
                                        onChange={(e) => updateCartItem(item.docId, 'estimatedPrice', parseFloat(e.target.value) || 0)}
                                        className="h-8 text-center"
                                     />
                                </div>
                                <Input
                                    placeholder="Observação / Link de referência..."
                                    value={item.notes}
                                    onChange={(e) => updateCartItem(item.docId, 'notes', e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                        ))}
                        </div>
                    )}
                </ScrollArea>
             </div>
              <div className="space-y-1.5">
                <Label htmlFor="purchaseReason">Motivo da Compra <span className="text-destructive">*</span></Label>
                <Textarea id="purchaseReason" value={purchaseReason} onChange={(e) => setPurchaseReason(e.target.value)} placeholder="Ex: Item para manutenção corretiva da aeronave PR-ABC." />
            </div>
             <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="space-y-1.5">
                <Label>Data de Necessidade <span className="text-destructive">*</span></Label>
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
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
                        onSelect={(date) => { setNeededByDate(date); setIsDatePopoverOpen(false); }}
                        initialFocus
                    />
                  </PopoverContent>
                </Popover>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleSubmitRequisition} disabled={isSubmitting || cart.length === 0 || !costCenterId || !neededByDate || !purchaseReason}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Requisição
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default RequisicaoCompraPage;
