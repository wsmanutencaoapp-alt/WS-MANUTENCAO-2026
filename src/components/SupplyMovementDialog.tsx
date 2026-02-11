'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter } from '@/firebase';
import {
  collection,
  doc,
  writeBatch,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import {
    uploadBytes,
    getDownloadURL,
    ref as storageRef,
} from 'firebase/storage';
import { useStorage } from '@/firebase/provider';
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
import { Loader2, CalendarIcon, ChevronsUpDown, Upload, FileText } from 'lucide-react';
import type { Supply, SupplyStock, SupplyMovement, Address } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { cn } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';
import { FirestorePermissionError } from '@/firebase/errors';
import { useQueryClient } from '@tanstack/react-query';
import ItemSelectorDialog from './ItemSelectorDialog';

type EnrichedStockItem = WithDocId<SupplyStock> & {
    supplyInfo: WithDocId<Supply>;
};

interface SupplyMovementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem?: EnrichedStockItem) => void;
  type: 'entrada' | 'saida';
  supply: WithDocId<Supply> | null;
}

export default function SupplyMovementDialog({ isOpen, onClose, onSuccess, type, supply: preselectedSupply }: SupplyMovementDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const docInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<WithDocId<Supply> | null>(preselectedSupply);
  
  // Form state
  const [quantity, setQuantity] = useState('');
  const [destination, setDestination] = useState(''); // For 'saida'
  const [origin, setOrigin] = useState(''); // For 'entrada'
  const [loteFornecedor, setLoteFornecedor] = useState('');
  const [validade, setValidade] = useState<string>(''); // Changed to string
  const [unitCost, setUnitCost] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  
  // UI state
  const [selectorOpen, setSelectorOpen] = useState<'supply' | 'address' | 'stock' | null>(null);
  
  // Data Fetching
  const allSuppliesQuery = useMemoFirebase(() => (
      firestore ? query(collection(firestore, 'supplies')) : null
    ), [firestore, isOpen]);
  const { data: allSupplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(allSuppliesQuery, {
    queryKey: ['allSuppliesForMovementDialog'],
    enabled: isOpen,
  });

  const addressesQuery = useMemoFirebase(() => (
      firestore ? query(collection(firestore, 'addresses'), where('setor', '==', '02')) : null
  ), [firestore]);
  const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, {
      queryKey: ['supplyAddressesForMovementDialog'],
      enabled: isOpen && type === 'entrada',
  });

  const availableStockQuery = useMemoFirebase(() => {
    if (firestore && type === 'saida' && selectedSupply) {
      return query(
        collection(firestore, 'supplies', selectedSupply.docId, 'stock'),
        where('quantidade', '>', 0)
      );
    }
    return null;
  }, [firestore, type, selectedSupply]);

  const { data: availableStock, isLoading: isLoadingStock } = useCollection<WithDocId<SupplyStock>>(availableStockQuery, {
    queryKey: ['availableStockForSupply', selectedSupply?.docId],
    enabled: isOpen && type === 'saida' && !!selectedSupply,
  });
  
  const selectedStockItem = useMemo(() => {
    if (!selectedStockId || !availableStock) return null;
    return availableStock.find(stock => stock.docId === selectedStockId) || null;
  }, [selectedStockId, availableStock]);

  const resetState = () => {
    setIsSaving(false);
    setSelectedSupply(null);
    setQuantity('');
    setOrigin('');
    setDestination('');
    setLoteFornecedor('');
    setValidade('');
    setUnitCost('');
    setLocalizacao('');
    setSelectedStockId(null);
    setDocumentoFile(null);
    if(docInputRef.current) docInputRef.current.value = '';
  };
  
  const handleClose = () => {
    resetState();
    onClose();
  }

  useEffect(() => {
    if (isOpen) {
        resetState();
        setSelectedSupply(preselectedSupply);
        setLocalizacao(preselectedSupply?.localizacaoPadrao || '');
    }
  }, [isOpen, preselectedSupply]);
  
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentoFile(file);
    }
  };

  const handleSave = async () => {
    if (!firestore || !user || !selectedSupply || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Item de suprimento não selecionado.' });
        return;
    }
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Quantidade inválida.' });
        return;
    }

    setIsSaving(true);
    
    if (type === 'entrada') {
        if (!localizacao) {
            toast({ variant: 'destructive', title: 'Erro', description: 'A localização é obrigatória para a entrada.' });
            setIsSaving(false);
            return;
        }
        let validadeDate: Date | null = null;
        if (selectedSupply.exigeValidade) {
            if (!validade) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Data de validade é obrigatória.' });
                setIsSaving(false);
                return;
            }
            validadeDate = parse(validade, 'yyyy-MM-dd', new Date());
            if (!isValid(validadeDate)) {
                 toast({ variant: 'destructive', title: 'Erro', description: 'Formato de data de validade inválido. Use AAAA-MM-DD.' });
                 setIsSaving(false);
                 return;
            }
        }
        try {
            const today = new Date();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const year = today.getFullYear();
            const counterId = `loteInterno_${year}_${month}`;
            
            const counterRef = doc(firestore, 'counters', counterId);

            const newSequencial = await runTransaction(firestore, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists()) {
                    transaction.set(counterRef, { lastId: 1 });
                    return 1;
                }
                const newId = (counterDoc.data().lastId || 0) + 1;
                transaction.update(counterRef, { lastId: newId });
                return newId;
            });

            const loteInterno = `${year}${month}${String(newSequencial).padStart(4, '0')}`;
            const newStockRef = doc(collection(firestore, 'supplies', selectedSupply.docId, 'stock'));
            
            let documentoUrl = '';
            if (documentoFile) {
                const docFileRef = storageRef(storage, `supply_documents/${selectedSupply.docId}/${newStockRef.id}/${documentoFile.name}`);
                await uploadBytes(docFileRef, documentoFile);
                documentoUrl = await getDownloadURL(docFileRef);
            }

            const stockData: Omit<SupplyStock, 'id'> = { 
                loteInterno, 
                quantidade: numQuantity, 
                localizacao, 
                dataEntrada: today.toISOString(), 
                custoUnitario: parseFloat(unitCost) || 0, 
                status: 'Disponível', 
                documentoUrl: documentoUrl,
                pesoLiquido: selectedSupply.fatorConversao ? selectedSupply.fatorConversao * numQuantity : undefined,
            };

            if (loteFornecedor) stockData.loteFornecedor = loteFornecedor;
            if (validadeDate) stockData.dataValidade = validadeDate.toISOString();

            const movementData: Omit<SupplyMovement, 'id'> = { supplyId: selectedSupply.docId, supplyStockId: newStockRef.id, supplyCodigo: selectedSupply.codigo, type: 'entrada', quantity: numQuantity, responsibleId: user.uid, responsibleName: user.displayName || user.email || 'Desconhecido', date: today.toISOString(), origin };

            const batch = writeBatch(firestore);
            batch.set(newStockRef, stockData);
            batch.set(doc(collection(firestore, 'supply_movements')), movementData);
            
            await batch.commit();

            toast({ title: 'Sucesso!', description: `Entrada registrada no lote ${loteInterno}.` });
            
            const newStockItemForPrint: EnrichedStockItem = {
              ...(stockData as SupplyStock), // cast because id is optional on Omit
              docId: newStockRef.id,
              supplyInfo: selectedSupply,
            };

            onSuccess(newStockItemForPrint);
            handleClose();

        } catch (err: any) {
            console.error("Erro na entrada:", err);
            toast({ variant: 'destructive', title: 'Erro na Operação', description: err.message || 'Não foi possível registrar a entrada.' });
        } finally {
            setIsSaving(false);
        }
    } else { // Handle 'saida'
        if (!selectedStockId || !selectedStockItem) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Lote de saída não selecionado.' });
            setIsSaving(false); return;
        }

        const isConsumable = !!selectedSupply.fatorConversao;
        const currentStockAmount = isConsumable ? selectedStockItem.pesoLiquido || 0 : selectedStockItem.quantidade;

        if (numQuantity > currentStockAmount) {
            toast({ variant: 'destructive', title: 'Erro de Quantidade', description: `A quantidade a ser retirada (${numQuantity}) é maior que a disponível no lote (${currentStockAmount}).` });
            setIsSaving(false); return;
        }

        try {
            const stockRef = doc(firestore, 'supplies', selectedSupply.docId, 'stock', selectedStockId);
            
            await runTransaction(firestore, async (transaction) => {
                const stockDoc = await transaction.get(stockRef);
                if (!stockDoc.exists()) throw new Error("O lote selecionado não existe mais.");

                let updateData: Partial<SupplyStock> = {};

                if (isConsumable) {
                    const currentPesoLiquido = stockDoc.data().pesoLiquido || 0;
                    updateData.pesoLiquido = currentPesoLiquido - numQuantity;
                    // Check if the item is fully consumed
                    if (updateData.pesoLiquido <= 0) {
                        updateData.quantidade = stockDoc.data().quantidade - 1;
                    }
                } else {
                    updateData.quantidade = stockDoc.data().quantidade - numQuantity;
                }
                
                transaction.update(stockRef, updateData);

                const movementData: Omit<SupplyMovement, 'id'> = { 
                    supplyId: selectedSupply.docId, 
                    supplyStockId: selectedStockId, 
                    supplyCodigo: selectedSupply.codigo, 
                    type: 'saida', 
                    quantity: numQuantity, 
                    responsibleId: user.uid, 
                    responsibleName: user.displayName || user.email || 'Desconhecido', 
                    date: new Date().toISOString(), 
                    destination 
                };
                transaction.set(doc(collection(firestore, 'supply_movements')), movementData);
            });
            
            toast({ title: 'Sucesso!', description: `Saída de ${numQuantity} ${isConsumable ? selectedSupply.unidadeSecundaria : selectedSupply.unidadeMedida} registrada.` });
            onSuccess();
            handleClose();

        } catch(err: any) {
            console.error("Erro na saída:", err);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `supplies/${selectedSupply.docId}/stock/${selectedStockId}`, operation: 'write', requestResourceData: { quantity: `decrement by ${numQuantity}` } }));
        } finally {
            setIsSaving(false);
        }
    }
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose} modal={false}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar {type === 'entrada' ? 'Entrada' : 'Saída'} de Suprimento</DialogTitle>
            <DialogDescription>
              {type === 'entrada' ? 'Adicione itens ao estoque, criando um novo lote.' : 'Retire itens do estoque consumindo de um lote existente.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
              {!preselectedSupply ? (
                   <div className="space-y-1.5">
                      <Label>Item de Suprimento <span className="text-destructive">*</span></Label>
                      <Button variant="outline" className="w-full justify-between font-normal" onClick={() => setSelectorOpen('supply')} disabled={isLoadingSupplies}>
                        {isLoadingSupplies ? <Loader2 className="h-4 w-4 animate-spin"/> : selectedSupply ? `${selectedSupply.codigo} - ${selectedSupply.descricao}` : "Selecione um item..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                   </div>
              ) : (
                  <div className="p-3 rounded-md bg-muted/50 border">
                      <p className="text-sm font-semibold">{selectedSupply?.descricao}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedSupply?.codigo}</p>
                  </div>
              )}
              
              {selectedSupply && (
                  <div className="space-y-4 animate-in fade-in-50">
                      {type === 'saida' && !!selectedSupply.fatorConversao ? (
                           <div className="space-y-1.5">
                              <Label htmlFor="quantity">Quantidade a Consumir ({selectedSupply.unidadeSecundaria}) <span className="text-destructive">*</span></Label>
                              <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                                {selectedStockItem && <p className="text-xs text-muted-foreground">Disponível: {selectedStockItem.pesoLiquido?.toLocaleString()} {selectedSupply.unidadeSecundaria}</p>}
                           </div>
                      ) : (
                          <div className="space-y-1.5">
                              <Label htmlFor="quantity">Quantidade ({selectedSupply.unidadeMedida}) <span className="text-destructive">*</span></Label>
                              <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                               {type === 'saida' && selectedStockItem && <p className="text-xs text-muted-foreground">Disponível: {selectedStockItem.quantidade.toLocaleString()}</p>}
                          </div>
                      )}

                      {type === 'entrada' ? (
                          <>
                             <div className="space-y-1.5">
                                  <Label htmlFor="origin">Origem <span className="text-destructive">*</span></Label>
                                  <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Ex: NF-e 12345, OC-678, Devolução..." />
                              </div>
                              <div className="space-y-1.5">
                                  <Label>Localização <span className="text-destructive">*</span></Label>
                                  <Button variant="outline" className="w-full justify-between font-normal" onClick={() => setSelectorOpen('address')} disabled={isLoadingAddresses}>
                                    {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : localizacao || "Selecione..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
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
                                      <Label htmlFor="validade">Data de Validade <span className="text-destructive">*</span></Label>
                                       <Input
                                        id="validade"
                                        type="date"
                                        value={validade}
                                        onChange={(e) => setValidade(e.target.value)}
                                        className="w-full"
                                      />
                                  </div>
                              )}
                              <div className="space-y-1.5">
                                <Label>Documento do Lote (Opcional)</Label>
                                <Button asChild variant="outline" className="w-full">
                                    <label className="cursor-pointer flex items-center">
                                        {documentoFile ? <FileText className="mr-2 h-4 w-4 text-green-600" /> : <Upload className="mr-2 h-4 w-4" />}
                                        <span className="truncate max-w-xs">{documentoFile ? documentoFile.name : 'Anexar documento'}</span>
                                        <Input type="file" className="sr-only" ref={docInputRef} onChange={handleDocumentChange} />
                                    </label>
                                </Button>
                              </div>
                          </>
                      ) : (
                           <>
                              <div className="space-y-1.5">
                                  <Label>Lote de Saída <span className="text-destructive">*</span></Label>
                                  <Button variant="outline" className="w-full justify-between font-normal" onClick={() => setSelectorOpen('stock')} disabled={isLoadingStock}>
                                    {isLoadingStock ? <Loader2 className="h-4 w-4 animate-spin"/> : selectedStockItem ? `${selectedStockItem.loteInterno} (Qtd: ${selectedSupply.fatorConversao ? `${selectedStockItem.pesoLiquido} ${selectedSupply.unidadeSecundaria}` : selectedStockItem.quantidade})` : "Selecione um lote..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                              </div>
                              <div className="space-y-1.5">
                                  <Label htmlFor="destination">Destino <span className="text-destructive">*</span></Label>
                                  <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: OS-987, Centro de Custo, etc." />
                              </div>
                           </>
                      )}
                  </div>
              )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving || !selectedSupply || !quantity || (type === 'saida' && !selectedStockId)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar {type === 'entrada' ? 'Entrada' : 'Saída'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ItemSelectorDialog
        isOpen={selectorOpen === 'supply'}
        onClose={() => setSelectorOpen(null)}
        items={allSupplies || []}
        onSelect={(item) => {
          setSelectedSupply(item);
          setLocalizacao(item.localizacaoPadrao || '');
          setSelectedStockId(null);
        }}
        filterFunction={(items, term) => 
            items.filter(item => 
                item.codigo.toLowerCase().includes(term.toLowerCase()) || 
                item.descricao.toLowerCase().includes(term.toLowerCase())
            )
        }
        renderItem={(item) => (
            <div className="flex flex-col items-start">
                <p>{item.codigo} - {item.descricao}</p>
                <p className="text-xs text-muted-foreground">{item.partNumber}</p>
            </div>
        )}
        title="Selecionar Item de Suprimento"
        description="Pesquise e selecione o item para a movimentação."
        isLoading={isLoadingSupplies}
      />
      
      <ItemSelectorDialog
        isOpen={selectorOpen === 'address'}
        onClose={() => setSelectorOpen(null)}
        items={addresses || []}
        onSelect={(item) => setLocalizacao(item.codigoCompleto)}
        filterFunction={(items, term) => 
            items.filter(item => item.codigoCompleto.toLowerCase().includes(term.toLowerCase()))
        }
        renderItem={(item) => <p>{item.codigoCompleto}</p>}
        title="Selecionar Endereço"
        description="Pesquise e selecione o endereço de destino no estoque."
        isLoading={isLoadingAddresses}
      />

       <ItemSelectorDialog
        isOpen={selectorOpen === 'stock'}
        onClose={() => setSelectorOpen(null)}
        items={availableStock || []}
        onSelect={(item) => setSelectedStockId(item.docId)}
        filterFunction={(items, term) => 
            items.filter(item => item.loteInterno.toLowerCase().includes(term.toLowerCase()))
        }
        renderItem={(item) => (
            <div className="flex flex-col items-start">
                <p>Lote: {item.loteInterno} (Qtd: {selectedSupply?.fatorConversao ? `${item.pesoLiquido} ${selectedSupply.unidadeSecundaria}`: item.quantidade})</p>
                <p className="text-xs text-muted-foreground">Local: {item.localizacao} - Validade: {item.dataValidade ? format(new Date(item.dataValidade), 'dd/MM/yy') : 'N/A'}</p>
            </div>
        )}
        title="Selecionar Lote de Saída"
        description={`Selecione um dos lotes disponíveis para ${selectedSupply?.descricao}.`}
        isLoading={isLoadingStock}
      />
    </>
  );
}
