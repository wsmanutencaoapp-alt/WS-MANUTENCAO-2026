'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, addDoc, writeBatch, doc } from 'firebase/firestore';
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
import type { Supply, CostCenter, PurchaseRequisition, PurchaseRequisitionItem } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

type CartItem = WithDocId<Supply> & { requisitionQuantity: number };

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

  const suppliesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'supplies')) : null, [firestore]);
  const { data: allSupplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery);
  
  const costCentersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery);

  const filteredSupplies = useMemo(() => {
    if (!allSupplies) return [];
    const cartIds = new Set(cart.map(item => item.docId));
    const availableItems = allSupplies.filter(item => !cartIds.has(item.docId));

    if (!searchTerm) return availableItems;
    const lowercasedTerm = searchTerm.toLowerCase();
    return availableItems.filter(item => 
      item.descricao.toLowerCase().includes(lowercasedTerm) || 
      item.codigo.toLowerCase().includes(lowercasedTerm) ||
      (item.partNumber && item.partNumber.toLowerCase().includes(lowercasedTerm))
    );
  }, [allSupplies, cart, searchTerm]);

  const addToCart = (item: WithDocId<Supply>) => {
    setCart(prev => [...prev, { ...item, requisitionQuantity: 1 }]);
  };

  const removeFromCart = (docId: string) => {
    setCart(prev => prev.filter(item => item.docId !== docId));
  };

  const updateQuantity = (docId: string, quantity: number) => {
    const numQuantity = Math.max(1, quantity);
    setCart(prev => prev.map(item => item.docId === docId ? { ...item, requisitionQuantity: numQuantity } : item));
  };

  const handleSubmitRequisition = async () => {
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
        return;
    }
    if (cart.length === 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O carrinho está vazio.' });
        return;
    }
    if (!costCenterId) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um centro de custo.' });
        return;
    }
    if (!neededByDate) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione a data de necessidade.' });
        return;
    }

    setIsSubmitting(true);
    try {
        const batch = writeBatch(firestore);
        const requisitionRef = doc(collection(firestore, 'purchase_requisitions'));

        const requisitionData: Omit<PurchaseRequisition, 'id'> = {
            requesterId: user.uid,
            costCenterId: costCenterId,
            neededByDate: neededByDate.toISOString(),
            status: 'Aberta',
            createdAt: new Date().toISOString(),
        };
        batch.set(requisitionRef, requisitionData);

        for (const item of cart) {
            const itemRef = doc(collection(firestore, 'purchase_requisitions', requisitionRef.id, 'items'));
            const itemData: Omit<PurchaseRequisitionItem, 'id'> = {
                supplyId: item.docId,
                quantity: item.requisitionQuantity,
                // estimatedPrice and notes can be added later
            };
            batch.set(itemRef, itemData);
        }
        
        await batch.commit();

        toast({ title: 'Sucesso!', description: 'Sua requisição de compra foi criada e enviada para o próximo passo.' });
        setCart([]);
        setCostCenterId('');
        setNeededByDate(undefined);
    } catch(err) {
        console.error("Erro ao criar requisição:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível criar a requisição.' });
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna do Catálogo */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Catálogo de Materiais e Serviços</CardTitle>
            <CardDescription>Selecione os itens que você precisa.</CardDescription>
            <div className="relative pt-4">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                   placeholder="Pesquisar por código, P/N ou descrição..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full rounded-lg bg-background pl-8"
               />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh]">
              {isLoadingSupplies ? (
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {filteredSupplies.map(item => (
                    <div key={item.docId} className="flex items-center gap-4 p-2 border rounded-lg">
                      <Image 
                        src={item.imageUrl || 'https://picsum.photos/seed/supply/64/64'}
                        alt={item.descricao}
                        width={48}
                        height={48}
                        className="rounded-md aspect-square object-cover"
                      />
                      <div className="flex-1 text-sm">
                        <p className="font-bold">{item.descricao}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.codigo} / {item.partNumber || 'N/A'}</p>
                      </div>
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

      {/* Coluna do Carrinho */}
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
                <ScrollArea className="h-64 border rounded-md p-2">
                    {cart.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground p-4">Seu carrinho está vazio.</p>
                    ) : (
                        <div className="space-y-3">
                        {cart.map(item => (
                            <div key={item.docId} className="flex items-center gap-2 p-2 border rounded-md">
                                <div className="flex-1 text-sm">
                                    <p className="font-bold truncate">{item.descricao}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{item.codigo}</p>
                                </div>
                                <Input 
                                    type="number" 
                                    value={item.requisitionQuantity}
                                    onChange={(e) => updateQuantity(item.docId, parseInt(e.target.value))}
                                    className="w-16 h-8 text-center"
                                    min="1"
                                />
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeFromCart(item.docId)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        </div>
                    )}
                </ScrollArea>
             </div>
             <div className="space-y-1.5">
                <Label htmlFor="costCenter">Centro de Custo <span className="text-destructive">*</span></Label>
                 <Select value={costCenterId} onValueChange={setCostCenterId} disabled={isLoadingCostCenters}>
                    <SelectTrigger id="costCenter">
                        <SelectValue placeholder={isLoadingCostCenters ? "Carregando..." : "Selecione o C.C."} />
                    </SelectTrigger>
                    <SelectContent>
                        {costCenters?.map(cc => (
                            <SelectItem key={cc.docId} value={cc.docId}>({cc.code}) {cc.description}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
                        onSelect={(date) => {
                            setNeededByDate(date);
                            setIsDatePopoverOpen(false);
                        }}
                        initialFocus
                    />
                  </PopoverContent>
                </Popover>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleSubmitRequisition} disabled={isSubmitting || cart.length === 0 || !costCenterId || !neededByDate}>
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
