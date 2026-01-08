'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import {
  collection,
  runTransaction,
  doc,
  writeBatch,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
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
import { Loader2, Search, Upload, ImageIcon, Check, ChevronsUpDown } from 'lucide-react';
import type { Tool, Address, Kit } from '@/lib/types';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';

interface CreateKitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateKitDialog({ isOpen, onClose, onSuccess }: CreateKitDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [kitDescription, setKitDescription] = useState('');
  const [kitEnderecamento, setKitEnderecamento] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [kitImage, setKitImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [availableAddresses, setAvailableAddresses] = useState<{value: string, label: string}[]>([]);
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [isPrerequisitesLoading, setIsPrerequisitesLoading] = useState(false);

  // This query correctly gets all tools that could POTENTIALLY be in a kit.
  const availableToolsQuery = useMemoFirebase(
    () => (firestore && isOpen ? query(collection(firestore, 'tools'), where('status', '==', 'Disponível')) : null),
    [firestore, isOpen]
  );

  const { data: allAvailableTools, isLoading: isLoadingTools } = useCollection<WithDocId<Tool>>(availableToolsQuery);

  // We add another client-side filter to remove the logic templates.
  const toolsForKit = useMemo(() => {
    return allAvailableTools?.filter(tool => tool.enderecamento !== 'LOGICA') || [];
  }, [allAvailableTools]);

  useEffect(() => {
    const fetchPrerequisites = async () => {
      if (!firestore || !isOpen) return;
      setIsPrerequisitesLoading(true);
      try {
        const toolsSnapshot = await getDocs(collection(firestore, 'tools'));
        const kitsSnapshot = await getDocs(collection(firestore, 'kits'));
        const occupiedAddresses = new Set([
            ...toolsSnapshot.docs.map(doc => doc.data().enderecamento),
            ...kitsSnapshot.docs.map(doc => doc.data().enderecamento)
        ]);
        
        const addressesRef = collection(firestore, 'addresses');
        const qAddresses = query(addressesRef, where('setor', '==', '01'));
        const addressesSnapshot = await getDocs(qAddresses);
        
        const unoccupied = addressesSnapshot.docs
            .map(doc => doc.data() as Address)
            .filter(addr => addr.codigoCompleto && !occupiedAddresses.has(addr.codigoCompleto))
            .map(addr => ({ value: addr.codigoCompleto, label: addr.codigoCompleto }));
            
        setAvailableAddresses(unoccupied);
      } catch (error) {
        console.error("Erro ao buscar endereços disponíveis:", error);
        toast({ variant: "destructive", title: "Erro de Busca", description: "Não foi possível carregar os endereços." });
      } finally {
        setIsPrerequisitesLoading(false);
      }
    };

    if (isOpen) {
      fetchPrerequisites();
    }
  }, [isOpen, firestore, toast]);


  const filteredTools = useMemo(() => {
    if (!toolsForKit) return [];
    if (!searchTerm) return toolsForKit;
    const lowercasedTerm = searchTerm.toLowerCase();
    return toolsForKit.filter(
      tool => tool.descricao.toLowerCase().includes(lowercasedTerm) || tool.codigo.toLowerCase().includes(lowercasedTerm)
    );
  }, [toolsForKit, searchTerm]);
  
  const handleToolSelect = (toolId: string) => {
    setSelectedToolIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setKitImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetState = () => {
    setKitDescription('');
    setKitEnderecamento('');
    setSearchTerm('');
    setSelectedToolIds(new Set());
    setIsSaving(false);
    setKitImage(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSave = async () => {
    if (!firestore || !storage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
      return;
    }
    if (!kitDescription) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A descrição do kit é obrigatória.' });
      return;
    }
    if (!kitEnderecamento) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O endereçamento do kit é obrigatório.' });
        return;
    }
    if (selectedToolIds.size === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione pelo menos uma ferramenta.' });
      return;
    }

    setIsSaving(true);

    try {
      // 1. Get new Kit ID
      const counterRef = doc(firestore, 'counters', 'kits');
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
      const kitCode = `KIT-${newSequencial.toString().padStart(4, '0')}`;

      // 2. Create Kit and Update Tools in a Batch
      const batch = writeBatch(firestore);

      const kitRef = doc(collection(firestore, 'kits'));

      let imageUrl;
      if (kitImage) {
        const imageRef = storageRef(storage, `kit_images/${kitRef.id}.jpg`);
        const snapshot = await uploadString(imageRef, kitImage, 'data_url');
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      batch.set(kitRef, {
        codigo: kitCode,
        descricao: kitDescription,
        enderecamento: kitEnderecamento,
        toolIds: Array.from(selectedToolIds),
        createdAt: new Date().toISOString(),
        status: 'Disponível',
        imageUrl: imageUrl || "https://picsum.photos/seed/kit/400/400", // Placeholder if no image
      });

      selectedToolIds.forEach(toolId => {
        const toolRef = doc(firestore, 'tools', toolId);
        batch.update(toolRef, {
          status: 'Em Kit',
          enderecamento: kitCode,
        });
      });

      await batch.commit();

      toast({
        title: 'Sucesso!',
        description: `Kit ${kitCode} criado com ${selectedToolIds.size} ferramentas.`,
      });
      
      resetState();
      onSuccess();

    } catch (error) {
      console.error('Erro ao criar kit:', error);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível criar o kit.' });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose} modal={false}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar Novo Kit de Ferramentas</DialogTitle>
          <DialogDescription>
            Agrupe ferramentas disponíveis para criar um kit. O kit será exibido como um item único no inventário.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[70vh] flex flex-col">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <Label htmlFor="kitDescription">Descrição do Kit</Label>
                <Input
                  id="kitDescription"
                  placeholder="Ex: Kit de Manutenção Aviônica"
                  value={kitDescription}
                  onChange={(e) => setKitDescription(e.target.value)}
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="kitEnderecamento">Endereçamento do Kit <span className="text-destructive">*</span></Label>
                 <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isAddressPopoverOpen}
                      className="w-full justify-between font-normal"
                      disabled={isPrerequisitesLoading}
                    >
                      {isPrerequisitesLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : kitEnderecamento
                        ? availableAddresses.find((addr) => addr.value === kitEnderecamento)?.label
                        : "Selecione um endereço..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                      <Command>
                      <CommandInput placeholder="Pesquisar endereço..." />
                      <CommandList>
                          <CommandEmpty>Nenhum endereço disponível encontrado.</CommandEmpty>
                          <CommandGroup>
                          {availableAddresses.map((addr) => (
                              <CommandItem
                              key={addr.value}
                              value={addr.value}
                              onSelect={(currentValue) => {
                                  setKitEnderecamento(currentValue === kitEnderecamento ? "" : currentValue)
                                  setIsAddressPopoverOpen(false)
                              }}
                              >
                              <Check
                                  className={cn(
                                  "mr-2 h-4 w-4",
                                  kitEnderecamento === addr.value ? "opacity-100" : "opacity-0"
                                  )}
                              />
                              {addr.label}
                              </CommandItem>
                          ))}
                          </CommandGroup>
                      </CommandList>
                      </Command>
                  </PopoverContent>
                </Popover>
            </div>
             <div className="col-span-1 md:col-span-2 flex items-center gap-4">
                {kitImage ? <Image src={kitImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" /> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Foto do Kit (Opcional)</Button>
                <Input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*"/>
            </div>
           </div>

          <div className="space-y-1.5">
            <Label htmlFor="toolSearch">Selecionar Ferramentas ({selectedToolIds.size} selecionadas)</Label>
             <div className="relative">
                <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    id="toolSearch"
                    placeholder="Pesquisar ferramentas disponíveis..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                />
            </div>
          </div>
          
          <ScrollArea className="h-64 border rounded-md flex-1">
             <div className="p-2 space-y-2">
              {isLoadingTools && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
              {!isLoadingTools && filteredTools.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma ferramenta disponível encontrada.</p>
              )}
              {!isLoadingTools && filteredTools.map(tool => (
                <div 
                  key={tool.docId}
                  className="flex items-center gap-4 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleToolSelect(tool.docId)}
                >
                    <Checkbox
                        checked={selectedToolIds.has(tool.docId)}
                        onCheckedChange={() => handleToolSelect(tool.docId)}
                        aria-label={`Selecionar ${tool.descricao}`}
                    />
                    <Image
                        src={tool.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                        alt={tool.descricao}
                        width={40}
                        height={40}
                        className="aspect-square rounded-md object-cover"
                    />
                    <div className="flex-1 text-sm">
                        <p className="font-bold">{tool.descricao}</p>
                        <p className="font-mono text-xs text-muted-foreground">{tool.codigo}</p>
                    </div>
                     <Badge variant="outline">{tool.enderecamento}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoadingTools || isPrerequisitesLoading}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Kit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}