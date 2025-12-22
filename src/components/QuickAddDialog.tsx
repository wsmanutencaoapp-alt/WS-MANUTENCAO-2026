'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  limit,
  orderBy
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
import { Loader2, Search } from 'lucide-react';
import type { Tool } from '@/lib/types';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';

interface QuickAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTools: any[]) => void;
}

type ModelTool = Tool & {
  docId: string;
};

export default function QuickAddDialog({ isOpen, onClose, onSuccess }: QuickAddDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allModels, setAllModels] = useState<ModelTool[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelTool[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelTool | null>(null);
  const [enderecamento, setEnderecamento] = useState('');
  
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all models when the dialog opens
  useEffect(() => {
    const fetchModels = async () => {
        if (!firestore || !isOpen) return;
        setIsSearching(true);
        try {
            const toolsRef = collection(firestore, 'tools');
            const q = query(toolsRef, where('enderecamento', '==', 'LOGICA'), where('tipo', 'in', ['STD', 'GSE']));
            const querySnapshot = await getDocs(q);
            const models = querySnapshot.docs.map(doc => ({
                ...(doc.data() as Tool),
                docId: doc.id,
            }));
            setAllModels(models);
            setFilteredModels(models);
        } catch (error) {
            console.error('Erro ao buscar modelos:', error);
            toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível carregar os modelos de ferramentas.' });
        } finally {
            setIsSearching(false);
        }
    };
    
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen, firestore, toast]);

  // Filter models based on search term
  useEffect(() => {
    if (searchTerm.length < 1) {
      setFilteredModels(allModels);
      return;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = allModels.filter(tool => 
        tool.descricao.toLowerCase().includes(lowercasedTerm) || 
        tool.codigo.toLowerCase().includes(lowercasedTerm)
    );
    setFilteredModels(filtered);
  }, [searchTerm, allModels]);


  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setAllModels([]);
      setFilteredModels([]);
      setSelectedModel(null);
      setEnderecamento('');
      setIsSearching(false);
      setIsSaving(false);
    }
  }, [isOpen]);
  

  const handleSave = async () => {
    if (!firestore || !selectedModel) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum modelo selecionado.' });
      return;
    }
    if (!enderecamento) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O Endereçamento é obrigatório.' });
      return;
    }

    setIsSaving(true);
    
    try {
      const { tipo, familia, classificacao } = selectedModel;
      const toolsCollectionRef = collection(firestore, 'tools');

      // STEP 1: Find the last sequencial number using a simple query
      const q = query(
        toolsCollectionRef,
        where('tipo', '==', tipo),
        where('familia', '==', familia),
        where('classificacao', '==', classificacao),
        orderBy('sequencial', 'desc'),
        limit(1)
      );
      const lastToolSnapshot = await getDocs(q);
      const lastSequencial = lastToolSnapshot.empty ? -1 : (lastToolSnapshot.docs[0].data().sequencial ?? -1);
      const newSequencial = lastSequencial + 1;

      // STEP 2: Batch write to Firestore
      const newToolRef = doc(toolsCollectionRef);
      const batch = writeBatch(firestore);

      const { docId, ...baseData } = selectedModel;
      const finalToolData: Omit<Tool, 'id'> = {
        ...baseData,
        codigo: `${tipo}-${familia}-${classificacao}-${newSequencial.toString().padStart(4, '0')}`,
        sequencial: newSequencial,
        status: 'Disponível', 
        enderecamento: enderecamento,
      };
        
      batch.set(newToolRef, finalToolData);
      
      await batch.commit();

      const newToolForPrinting = { ...finalToolData, docId: newToolRef.id };
      toast({ title: 'Sucesso!', description: `Ferramenta ${finalToolData.codigo} adicionada ao estoque.` });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      onSuccess([newToolForPrinting]);

    } catch (error: any) {
        console.error("Erro ao salvar:", error);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível concluir. Verifique as permissões e tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar Unidade ao Estoque</DialogTitle>
          <DialogDescription>
            Selecione um modelo e defina o endereço para adicionar a nova ferramenta.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
          {!selectedModel ? (
            <>
              <div className="relative">
                <Label htmlFor="searchTerm">Pesquisar Modelo (STD/GSE)</Label>
                <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="searchTerm"
                  placeholder="Digite a descrição ou código do modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
                {isSearching && <Loader2 className="absolute right-2.5 bottom-2.5 h-4 w-4 animate-spin" />}
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                  {filteredModels.length > 0 ? (
                      <div className="space-y-2">
                          {filteredModels.map((model) => (
                              <button
                                  key={model.docId}
                                  onClick={() => setSelectedModel(model)}
                                  className="flex items-start gap-4 p-2 border rounded-lg hover:bg-muted/80 w-full text-left"
                              >
                                  <Image
                                      src={model.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                                      alt={model.descricao}
                                      width={48}
                                      height={48}
                                      className="aspect-square rounded-md object-cover"
                                  />
                                  <div className="text-sm">
                                      <p className="font-bold">{model.descricao}</p>
                                      <p><strong>Código Base:</strong> {model.codigo.substring(0, model.codigo.lastIndexOf('-'))}</p>
                                  </div>
                              </button>
                          ))}
                      </div>
                  ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                          <p>{isSearching ? 'Buscando...' : 'Nenhum modelo encontrado.'}</p>
                      </div>
                  )}
              </ScrollArea>
            </>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4 animate-in fade-in-50">
                <div className="flex justify-between items-start">
                    <h4 className="font-semibold">Modelo Selecionado</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedModel(null)}>Alterar</Button>
                </div>
               <div className="flex items-start gap-4">
                 <Image
                    src={selectedModel.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                    alt={selectedModel.descricao}
                    width={64}
                    height={64}
                    className="aspect-square rounded-md object-cover"
                  />
                  <div className="text-sm">
                      <p className="font-bold">{selectedModel.descricao}</p>
                      <p><strong>Código Base:</strong> {selectedModel.codigo.substring(0, selectedModel.codigo.lastIndexOf('-'))}</p>
                  </div>
              </div>
              <div className="space-y-1.5">
                  <Label htmlFor="enderecamento">Endereçamento <span className="text-destructive">*</span></Label>
                  <Input id="enderecamento" value={enderecamento} onChange={(e) => setEnderecamento(e.target.value)} placeholder="Ex: GAV-01-A" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedModel || isSaving || isSearching || !enderecamento}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar e Imprimir Etiqueta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
