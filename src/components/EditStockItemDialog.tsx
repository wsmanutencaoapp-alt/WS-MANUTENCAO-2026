'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where } from 'firebase/firestore';
import type { Supply, SupplyStock, Address } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, FileText, Upload, ChevronsUpDown, Check } from 'lucide-react';
import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
} from 'firebase/storage';
import { parse, isValid, format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandList, CommandItem } from './ui/command';
import { cn } from '@/lib/utils';
import { Switch } from './ui/switch';


type EnrichedStockItem = WithDocId<SupplyStock> & {
    supplyInfo: WithDocId<Supply>;
};

interface EditStockItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stockItem: EnrichedStockItem | null;
}

export default function EditStockItemDialog({ isOpen, onClose, stockItem, onSuccess }: EditStockItemDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const docInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [loteFornecedor, setLoteFornecedor] = useState('');
  const [validade, setValidade] = useState('');
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [localizacao, setLocalizacao] = useState('');

  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [showAllAddresses, setShowAllAddresses] = useState(false);

  const addressesQuery = useMemoFirebase(() => {
    if (!firestore || !isOpen) return null;
    const baseQuery = collection(firestore, 'addresses');
    if (showAllAddresses) {
        return query(baseQuery);
    }
    return query(baseQuery, where('setor', '==', '02')); // Suprimentos
  }, [firestore, isOpen, showAllAddresses]);

  const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, { 
      queryKey: ['addresses_suprimentos', showAllAddresses],
      enabled: isOpen,
  });

  useEffect(() => {
    if (stockItem) {
      setLoteFornecedor(stockItem.loteFornecedor || '');
      setValidade(stockItem.dataValidade ? format(parse(stockItem.dataValidade, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()), 'yyyy-MM-dd') : '');
      setLocalizacao(stockItem.localizacao || '');
      setDocumentoFile(null);
    }
  }, [stockItem, isOpen]);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentoFile(file);
    }
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !storage || !stockItem) return;
    
    if (!localizacao) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A localização é obrigatória.' });
        return;
    }

    let validadeDate: Date | null = null;
    if (stockItem.supplyInfo.exigeValidade) {
        if (!validade) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Data de validade é obrigatória.' });
            return;
        }
        validadeDate = parse(validade, 'yyyy-MM-dd', new Date());
        if (!isValid(validadeDate)) {
             toast({ variant: 'destructive', title: 'Erro', description: 'Formato de data de validade inválido. Use AAAA-MM-DD.' });
             return;
        }
    }

    setIsSaving(true);
    try {
        const stockRef = doc(firestore, 'supplies', stockItem.supplyInfo.docId, 'stock', stockItem.docId);

        let newDocumentoUrl = stockItem.documentoUrl;

        if (documentoFile) {
            if (stockItem.documentoUrl) {
                try {
                    const oldDocRef = storageRef(storage, stockItem.documentoUrl);
                    await deleteObject(oldDocRef);
                } catch(e: any) {
                    if (e.code !== 'storage/object-not-found') throw e;
                }
            }
            const newDocRef = storageRef(storage, `supply_documents/${stockItem.supplyInfo.docId}/${stockItem.docId}/${documentoFile.name}`);
            await uploadBytes(newDocRef, documentoFile);
            newDocumentoUrl = await getDownloadURL(newDocRef);
        }

        const dataToUpdate: Partial<SupplyStock> = {
            loteFornecedor: loteFornecedor,
            documentoUrl: newDocumentoUrl,
            localizacao: localizacao,
        };
        if (validadeDate) {
            dataToUpdate.dataValidade = validadeDate.toISOString();
        }

        await updateDoc(stockRef, dataToUpdate);

        toast({ title: "Sucesso!", description: "Lote atualizado com sucesso." });
        onSuccess();
        onClose();

    } catch (err: any) {
        console.error("Erro ao editar lote:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar as alterações.' });
    } finally {
        setIsSaving(false);
    }

  };

  if (!stockItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Lote de Suprimento</DialogTitle>
          <DialogDescription>
            Alterando dados para o lote <span className="font-bold">{stockItem.loteInterno}</span> do item <span className="font-bold">{stockItem.supplyInfo.descricao}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-1.5">
                <Label htmlFor="loteFornecedor-edit">Lote do Fornecedor</Label>
                <Input id="loteFornecedor-edit" value={loteFornecedor} onChange={(e) => setLoteFornecedor(e.target.value)} />
            </div>

            {stockItem.supplyInfo.exigeValidade && (
                <div className="space-y-1.5">
                    <Label htmlFor="validade-edit">Data de Validade</Label>
                    <Input id="validade-edit" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
                </div>
            )}
            
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <Label htmlFor="localizacao-edit">Localização <span className="text-destructive">*</span></Label>
                    <div className="flex items-center space-x-2">
                        <Switch id="show-all-addresses-edit-stock" checked={showAllAddresses} onCheckedChange={setShowAllAddresses} />
                        <Label htmlFor="show-all-addresses-edit-stock" className="text-xs font-normal">Ver todos</Label>
                    </div>
                </div>
                <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                    <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={isLoadingAddresses}>
                        {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : localizacao || "Selecione um endereço..."}
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
                                        <CommandItem key={addr.docId} value={addr.codigoCompleto} onSelect={(currentValue) => { setLocalizacao(currentValue === localizacao ? '' : currentValue); setIsAddressPopoverOpen(false); }}>
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
                <Label>Documento do Lote (FISPQ, Certificado, etc.)</Label>
                <Button asChild variant="outline" className="w-full">
                    <label className="cursor-pointer flex items-center">
                        {documentoFile ? <FileText className="mr-2 h-4 w-4 text-green-600" /> : <Upload className="mr-2 h-4 w-4" />}
                        <span className="truncate max-w-xs">{documentoFile ? documentoFile.name : 'Anexar/Trocar documento'}</span>
                        <Input type="file" className="sr-only" ref={docInputRef} onChange={handleDocumentChange} />
                    </label>
                </Button>
                {!documentoFile && stockItem.documentoUrl && (
                     <Button asChild variant="link" size="sm" className="p-0 h-auto">
                        <a href={stockItem.documentoUrl} target="_blank" rel="noopener noreferrer">Visualizar documento atual</a>
                    </Button>
                )}
            </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
