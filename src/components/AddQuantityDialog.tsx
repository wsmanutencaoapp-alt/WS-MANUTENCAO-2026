'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  doc,
  limit,
  orderBy,
  addDoc
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useQueryClient } from '@tanstack/react-query';


interface AddQuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTools: any[]) => void;
}

type FoundTool = Tool & {
  id: string;
};

// Represents a group of tools with the same 'codigo' base
type ToolGroup = FoundTool & {
  unitCount: number;
  lastSequencial: number;
};


export default function AddQuantityDialog({ isOpen, onClose, onSuccess }: AddQuantityDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [enderecamento, setEnderecamento] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [foundToolGroups, setFoundToolGroups] = useState<ToolGroup[]>([]);
  const [selectedToolGroup, setSelectedToolGroup] = useState<ToolGroup | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setQuantityToAdd(1);
      setEnderecamento('');
      setPatrimonio('');
      setFoundToolGroups([]);
      setSelectedToolGroup(null);
      setIsSearching(false);
      setIsSaving(false);
    }
  }, [isOpen]);
  
  // Debounced search effect
  useEffect(() => {
    const handleSearch = async () => {
      if (!firestore || searchTerm.length < 3) {
        setFoundToolGroups([]);
        return;
      }
      setIsSearching(true);
      setSelectedToolGroup(null);
      
      try {
        const toolsRef = collection(firestore, 'tools');
        
        // Query logic templates, which are marked with 'LOGICA'
        const logicQuery = query(
          toolsRef, 
          where('enderecamento', '==', 'LOGICA'),
          // This part is tricky without composite indexes for every field.
          // For now, we will filter client-side after getting the templates.
        );
        const codeQuery = query(
          toolsRef, 
          where('enderecamento', '==', 'LOGICA'),
          where('codigo', '>=', searchTerm.toUpperCase()),
          where('codigo', '<=', searchTerm.toUpperCase() + '\uf8ff'),
          limit(25)
        );

        const [logicSnapshot, codeSnapshot] = await Promise.all([getDocs(logicQuery), getDocs(codeQuery)]);

        const logicTools = new Map<string, FoundTool>();
        logicSnapshot.docs.forEach(doc => {
            const toolData = { id: doc.id, ...doc.data() } as FoundTool;
            const lowerCaseSearch = searchTerm.toLowerCase();
            if (toolData.descricao.toLowerCase().includes(lowerCaseSearch) || toolData.codigo.toLowerCase().includes(lowerCaseSearch)) {
                 logicTools.set(doc.id, toolData);
            }
        });
        codeSnapshot.docs.forEach(doc => logicTools.set(doc.id, { id: doc.id, ...doc.data() } as FoundTool));
        
        // Templates/Logics are unique, so no grouping needed. We just list them.
        // The 'ToolGroup' type can be simplified or used as is.
        const aggregatedGroups: ToolGroup[] = Array.from(logicTools.values()).map(tool => ({
            ...tool,
            unitCount: 0, // This is a logic, no real unit count
            lastSequencial: 0, // Not relevant for the template search view
        }));
        
        setFoundToolGroups(aggregatedGroups);

      } catch (error) {
        console.error('Erro ao pesquisar lógica:', error);
        toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível realizar a busca de lógicas.' });
      } finally {
        setIsSearching(false);
      }
    };

    const debounceSearch = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(debounceSearch);
  }, [searchTerm, firestore, toast]);


  const handleSave = async () => {
    if (!firestore || !selectedToolGroup) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma lógica de ferramenta selecionada.' });
      return;
    }
    if (quantityToAdd <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A quantidade deve ser maior que zero.' });
      return;
    }
    if (!enderecamento) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O Endereçamento é obrigatório.' });
      return;
    }

    setIsSaving(true);
    const newTools: FoundTool[] = [];
    const { tipo, familia, classificacao } = selectedToolGroup;
    const baseCode = `${tipo}-${familia}-${classificacao}`;
    
    try {
      const counterRef = doc(firestore, 'counters', `tool_${tipo}_${familia}_${classificacao}`);

      const newLastId = await runTransaction(firestore, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists()) {
              throw new Error(`Contador para a lógica ${baseCode} não encontrado. Cadastre a lógica primeiro.`);
          }
          const currentId = counterDoc.data().lastId || 0;
          const newId = currentId + quantityToAdd;
          transaction.update(counterRef, { lastId: newId });
          return currentId;
      });

      // Exclude logic-specific fields from the new tool instance
      const { id, unitCount, lastSequencial, ...baseData } = selectedToolGroup;

      for (let i = 0; i < quantityToAdd; i++) {
        const newSequencial = newLastId + 1 + i;
        const newCode = `${baseCode}-${newSequencial.toString().padStart(4, '0')}`;
        
        const newToolData: Omit<Tool, 'id'> = {
          ...baseData,
          codigo: newCode,
          sequencial: newSequencial,
          status: baseData.status === 'Pendente' ? 'Pendente' : 'Disponível', // Respect initial status
          enderecamento: enderecamento,
          patrimonio: patrimonio || '',
        };
        
        const docRef = await addDoc(collection(firestore, 'tools'), newToolData);
        newTools.push({ ...newToolData, id: docRef.id });
      }
      
      toast({ title: 'Sucesso!', description: `${quantityToAdd} nova(s) unidade(s) de ${selectedToolGroup.descricao} foram adicionadas.` });
      
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      
      onSuccess(newTools);

    } catch (error) {
      console.error(error);
      const permissionError = new FirestorePermissionError({
        path: 'tools/{newToolId}',
        operation: 'create', 
        requestResourceData: { info: `Transaction to add ${quantityToAdd} tools for code ${selectedToolGroup.codigo}.` }
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: 'destructive', title: 'Erro na Transação', description: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Ferramenta ao Estoque</DialogTitle>
          <DialogDescription>
            Pesquise por uma lógica de ferramenta e adicione novas unidades ao inventário.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="relative">
            <Label htmlFor="searchTerm">Pesquisar Lógica</Label>
            <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchTerm"
              placeholder="Digite a descrição ou código da lógica (ex: Torquímetro, STD-TRQ...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              disabled={!!selectedToolGroup}
            />
             {isSearching && <Loader2 className="absolute right-2.5 bottom-2.5 h-4 w-4 animate-spin" />}
          </div>

          {!isSearching && searchTerm.length > 2 && !selectedToolGroup && (
            <ScrollArea className="h-[200px] border rounded-md p-2">
                {foundToolGroups.length > 0 ? (
                    <div className="space-y-2">
                        {foundToolGroups.map((group) => (
                            <button
                                key={group.id}
                                onClick={() => setSelectedToolGroup(group)}
                                className="flex items-start gap-4 p-2 border rounded-lg hover:bg-muted/80 w-full text-left"
                            >
                                <Image
                                    src={group.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                                    alt={group.descricao}
                                    width={48}
                                    height={48}
                                    className="aspect-square rounded-md object-cover"
                                />
                                <div className="text-sm">
                                    <p className="font-bold">{group.descricao}</p>
                                    <p><strong>Código Base:</strong> {group.codigo.substring(0, group.codigo.lastIndexOf('-'))}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        <p>Nenhuma lógica encontrada.</p>
                    </div>
                )}
            </ScrollArea>
          )}

          {selectedToolGroup && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3 animate-in fade-in-50">
                <div className="flex justify-between items-start">
                    <h4 className="font-semibold">Lógica Selecionada</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedToolGroup(null)}>Alterar</Button>
                </div>
               <div className="flex items-start gap-4">
                 <Image
                    src={selectedToolGroup.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                    alt={selectedToolGroup.descricao}
                    width={64}
                    height={64}
                    className="aspect-square rounded-md object-cover"
                  />
                  <div className="text-sm">
                      <p className="font-bold">{selectedToolGroup.descricao}</p>
                      <p><strong>Código Base:</strong> {selectedToolGroup.codigo.substring(0, selectedToolGroup.codigo.lastIndexOf('-'))}</p>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <div className="space-y-1.5">
                    <Label htmlFor="quantityToAdd">Quantidade <span className="text-destructive">*</span></Label>
                    <Input
                        id="quantityToAdd"
                        type="number"
                        min="1"
                        value={quantityToAdd}
                        onChange={(e) => setQuantityToAdd(parseInt(e.target.value, 10) || 1)}
                    />
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="enderecamento">Endereçamento <span className="text-destructive">*</span></Label>
                    <Input
                        id="enderecamento"
                        value={enderecamento}
                        onChange={(e) => setEnderecamento(e.target.value)}
                        placeholder="Ex: GAV-01-A"
                    />
                </div>
                <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="patrimonio">Nº Patrimônio (Opcional)</Label>
                    <Input
                        id="patrimonio"
                        value={patrimonio}
                        onChange={(e) => setPatrimonio(e.target.value)}
                        placeholder="Definido pela contabilidade"
                    />
                </div>
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedToolGroup || isSaving || isSearching}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar e Imprimir Etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
