'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { SupplyStock, Tool, Address, Supply } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { Loader2, PackageCheck, Search, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Switch } from './ui/switch';

type ReceivingItem = (WithDocId<SupplyStock> | WithDocId<Tool>) & { 
    itemType: 'supply' | 'tool',
    descricao?: string,
    codigo?: string,
    loteInterno?: string,
    dataEntrada?: string,
    imageUrl?: string,
};

export const StoreItemDialog = ({
  item,
  isOpen,
  onClose,
  onSuccess
}: {
  item: ReceivingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [finalLocation, setFinalLocation] = useState('');
    const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
    const [showAllAddresses, setShowAllAddresses] = useState(false);
    
    const addressesQuery = useMemoFirebase(() => {
        if (!firestore || !item) return null;
        let sector = '01'; // Default to Ferramentaria for tools
        if (item.itemType === 'supply') {
            const supplyItem = item as WithDocId<SupplyStock> & { supplyInfo?: { familia?: string } };
            if (supplyItem.supplyInfo?.familia) {
                sector = '02'; // Suprimentos
            }
        }
        
        if (showAllAddresses) {
            return collection(firestore, 'addresses');
        }
        
        return query(collection(firestore, 'addresses'), where('setor', '==', sector));
    }, [firestore, item, showAllAddresses]);

    const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, {
        queryKey: ['addressesForStoring', item?.itemType, showAllAddresses],
        enabled: isOpen && !!item,
    });

    useEffect(() => {
        if (item) {
            const defaultLocation = (item as any).localizacaoPadrao || '';
            setFinalLocation(defaultLocation);
        } else {
            setFinalLocation('');
        }
    }, [item]);

    const handleStoreItem = async () => {
        if (!firestore || !item || !finalLocation) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Localização final é obrigatória.' });
            return;
        }
        setIsSaving(true);
        try {
            const collectionPath = item.itemType === 'supply' ? `supplies/${(item as any).supplyId}/stock` : 'tools';
            const itemRef = doc(firestore, collectionPath, item.docId);

            await updateDoc(itemRef, {
                status: 'Disponível',
                localizacao: finalLocation
            });

            toast({ title: 'Sucesso!', description: 'Item guardado no estoque.' });
            onSuccess();
        } catch (err) {
            console.error("Erro ao guardar item:", err);
            toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível guardar o item.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Guardar Item no Estoque</DialogTitle>
                    <DialogDescription>
                        Defina a localização final para o item <span className='font-bold'>{(item as any).descricao || (item as any).loteInterno}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm"><strong>Item:</strong> {item.descricao || item.itemType}</p>
                    <p className="text-sm font-mono"><strong>Lote/Código:</strong> {item.loteInterno || item.codigo}</p>
                     <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="finalLocation">Localização Final <span className="text-destructive">*</span></Label>
                            <div className="flex items-center space-x-2">
                                <Switch id="show-all-addresses-store" checked={showAllAddresses} onCheckedChange={setShowAllAddresses} />
                                <Label htmlFor="show-all-addresses-store" className="text-xs font-normal">Ver todos</Label>
                            </div>
                        </div>
                        <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={isLoadingAddresses}>
                              {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : finalLocation || "Selecione um endereço..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                  <CommandInput placeholder="Pesquisar endereço..." />
                                  <CommandList>
                                      <CommandEmpty>Nenhum endereço disponível.</CommandEmpty>
                                      <CommandGroup>
                                          {addresses?.map((addr) => (
                                              <CommandItem key={addr.docId} value={addr.codigoCompleto} onSelect={(currentValue) => { setFinalLocation(currentValue === finalLocation ? '' : currentValue); setIsAddressPopoverOpen(false); }}>
                                                  <Check className={cn("mr-2 h-4 w-4", finalLocation === addr.codigoCompleto ? "opacity-100" : "opacity-0")} />
                                                  {addr.codigoCompleto}
                                              </CommandItem>
                                          ))}
                                      </CommandGroup>
                                  </CommandList>
                              </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleStoreItem} disabled={isSaving || !finalLocation}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar e Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
