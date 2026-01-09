'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  doc,
  writeBatch,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
} from 'firebase/firestore';
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
import { Loader2, CalendarIcon, Check, ChevronsUpDown, Hash, Building } from 'lucide-react';
import type { Supply, SupplyStock, SupplyMovement, Address } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';

interface SupplyMovementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'entrada' | 'saida';
  supply: WithDocId<Supply> | null;
}

export default function SupplyMovementDialog({ isOpen, onClose, onSuccess, type, supply: preselectedSupply }: SupplyMovementDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<WithDocId<Supply> | null>(preselectedSupply);
  
  // Form state
  const [quantity, setQuantity] = useState('');
  const [origin, setOrigin] = useState(''); // For 'entrada'
  const [destination, setDestination] = useState(''); // For 'saida'
  const [loteFornecedor, setLoteFornecedor] = useState('');
  const [validade, setValidade] = useState<Date | undefined>();
  const [unitCost, setUnitCost] = useState('');
  const [localizacao, setLocalizacao] = useState('');

  const [isValidadeOpen, setIsValidadeOpen] = useState(false);
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [isSupplyPopoverOpen, setIsSupplyPopoverOpen] = useState(false);
  
  const allSuppliesQuery = useMemoFirebase(() => (
      firestore && !preselectedSupply ? query(collection(firestore, 'supplies')) : null
    ), [firestore, preselectedSupply, isOpen]);
    
  const { data: allSupplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(allSuppliesQuery);

  const addressesQuery = useMemoFirebase(() => (
      firestore ? query(collection(firestore, 'addresses'), where('setor', '==', '02')) : null
  ), [firestore]);
  const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery);
  
  useEffect(() => {
    if (isOpen) {
        // Reset state when dialog opens
        setIsSaving(false);
        setSelectedSupply(preselectedSupply);
        setQuantity('');
        setOrigin('');
        setDestination('');
        setLoteFornecedor('');
        setValidade(undefined);
        setUnitCost('');
        setLocalizacao(preselectedSupply?.localizacaoPadrao || '');
    }
  }, [isOpen, preselectedSupply]);

  const handleSave = async () => {
    if (!firestore || !user || !selectedSupply) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Dados incompletos.' });
        return;
    }
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Quantidade inválida.' });
        return;
    }

    if (type === 'entrada' && !localizacao) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A localização é obrigatória para a entrada.' });
        return;
    }

    setIsSaving(true);
    
    if (type === 'entrada') {
        try {
            const newStockRef = doc(collection(firestore, 'supply_stock'));
            const loteInterno = `LOTE-${Date.now()}`;
            
            const stockData: SupplyStock = {
                supplyId: selectedSupply.docId,
                supplyCodigo: selectedSupply.codigo,
                loteInterno: loteInterno,
                loteFornecedor: loteFornecedor || undefined,
                quantidade: numQuantity,
                localizacao: localizacao,
                dataEntrada: new Date().toISOString(),
                dataValidade: validade ? validade.toISOString() : undefined,
                custoUnitario: parseFloat(unitCost) || 0,
                status: 'Disponível'
            };

            const movementData: Omit<SupplyMovement, 'id'> = {
                supplyId: selectedSupply.docId,
                supplyStockId: newStockRef.id,
                supplyCodigo: selectedSupply.codigo,
                type: 'entrada',
                quantity: numQuantity,
                responsibleId: user.uid,
                responsibleName: user.displayName || user.email || 'Desconhecido',
                date: new Date().toISOString(),
                origin: origin,
            };

            const batch = writeBatch(firestore);
            batch.set(newStockRef, stockData);
            batch.set(doc(collection(firestore, 'supply_movements')), movementData);
            
            await batch.commit();

            toast({ title: 'Sucesso!', description: `Entrada registrada no lote ${loteInterno}.` });
            onSuccess();
            onClose();

        } catch (err: any) {
            console.error("Erro na entrada:", err);
            toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message || 'Não foi possível registrar a entrada.' });
        } finally {
            setIsSaving(false);
        }
    } else {
        // TODO: Implementar lógica de saída que consome dos lotes existentes
        toast({ title: 'Em breve', description: 'A lógica de saída de estoque por lote será implementada na próxima etapa.' });
        setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar {type === 'entrada' ? 'Entrada' : 'Saída'} de Suprimento</DialogTitle>
          <DialogDescription>
            {type === 'entrada' ? 'Adicione itens ao estoque, criando um novo lote.' : 'Retire itens do estoque.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            {!preselectedSupply ? (
                 <div className="space-y-1.5">
                    <Label>Item de Suprimento <span className="text-destructive">*</span></Label>
                     <Popover open={isSupplyPopoverOpen} onOpenChange={setIsSupplyPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isSupplyPopoverOpen}
                            className="w-full justify-between font-normal"
                            disabled={isLoadingSupplies}
                            >
                            {isLoadingSupplies ? <Loader2 className="h-4 w-4 animate-spin"/> : selectedSupply
                                ? `${selectedSupply.codigo} - ${selectedSupply.descricao}`
                                : "Selecione um item..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                            <Command>
                                <CommandInput placeholder="Buscar por código ou descrição..." />
                                <CommandList>
                                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {allSupplies?.map((item) => (
                                    <CommandItem
                                        key={item.docId}
                                        value={`${item.codigo} ${item.descricao}`}
                                        onSelect={() => {
                                            setSelectedSupply(item);
                                            setIsSupplyPopoverOpen(false);
                                        }}
                                    >
                                        <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedSupply?.docId === item.docId ? "opacity-100" : "opacity-0"
                                        )}
                                        />
                                        {item.codigo} - {item.descricao}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                 </div>
            ) : (
                <div className="p-3 rounded-md bg-muted/50 border">
                    <p className="text-sm font-semibold">{selectedSupply?.descricao}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedSupply?.codigo}</p>
                </div>
            )}
            
            {selectedSupply && (
                <div className="space-y-4 animate-in fade-in-50">
                     <div className="space-y-1.5">
                        <Label htmlFor="quantity">Quantidade <span className="text-destructive">*</span></Label>
                        <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                    </div>

                    {type === 'entrada' ? (
                        <>
                           <div className="space-y-1.5">
                                <Label htmlFor="origin">Origem <span className="text-destructive">*</span></Label>
                                <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Ex: NF-e 12345, OC-678, Devolução..." />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Localização <span className="text-destructive">*</span></Label>
                                <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={isLoadingAddresses}>
                                    {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : localizacao || "Selecione..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar endereço..." />
                                        <CommandList>
                                            <CommandEmpty>Nenhum endereço encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {addresses?.map(addr => (
                                                <CommandItem key={addr.docId} value={addr.codigoCompleto} onSelect={(val) => { setLocalizacao(val); setIsAddressPopoverOpen(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", localizacao === addr.codigoCompleto ? "opacity-100" : "opacity-0")} />
                                                    {addr.codigoCompleto}
                                                </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                                </Popover>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="unitCost">Custo Unitário (R$)</Label>
                                <Input id="unitCost" type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Ex: 25.50"/>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="loteFornecedor">Lote do Fornecedor (Opcional)</Label>
                                <Input id="loteFornecedor" value={loteFornecedor} onChange={(e) => setLoteFornecedor(e.target.value)} />
                            </div>
                            {selectedSupply.exigeValidade && (
                                 <div className="space-y-1.5">
                                    <Label>Data de Validade <span className="text-destructive">*</span></Label>
                                    <Popover open={isValidadeOpen} onOpenChange={setIsValidadeOpen}>
                                        <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {validade ? format(validade, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={validade} onSelect={setValidade} initialFocus onDayClick={() => setIsValidadeOpen(false)} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </>
                    ) : (
                         <div className="space-y-1.5">
                            <Label htmlFor="destination">Destino <span className="text-destructive">*</span></Label>
                            <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: OS-987, Centro de Custo, etc." />
                        </div>
                    )}
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedSupply || !quantity}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar {type === 'entrada' ? 'Entrada' : 'Saída'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
