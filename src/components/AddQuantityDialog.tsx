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
        
        // Query by 'descricao' (name) or 'codigo'
        const nameQuery = query(
          toolsRef, 
          where('descricao', '>=', searchTerm),
          where('descricao', '<=', searchTerm + '\uf8ff'),
          limit(25)
        );
        const codeQuery = query(
          toolsRef, 
          where('codigo', '>=', searchTerm.toUpperCase()),
          where('codigo', '<=', searchTerm.toUpperCase() + '\uf8ff'),
          limit(25)
        );

        const [nameSnapshot, codeSnapshot] = await Promise.all([getDocs(nameQuery), getDocs(codeQuery)]);

        const allTools = new Map<string, FoundTool>();
        nameSnapshot.docs.forEach(doc => allTools.set(doc.id, { id: doc.id, ...doc.data() } as FoundTool));
        codeSnapshot.docs.forEach(doc => allTools.set(doc.id, { id: doc.id, ...doc.data() } as FoundTool));
        
        // Group tools by base code (TIPO-FAMILIA-CLASSIFICACAO)
        const groups = new Map<string, FoundTool[]>();
        allTools.forEach(tool => {
            if (tool.codigo) {
                const baseCode = tool.codigo.substring(0, tool.codigo.lastIndexOf('-'));
                if (!groups.has(baseCode)) {
                    groups.set(baseCode, []);
                }
                groups.get(baseCode)!.push(tool);
            }
        });

        const aggregatedGroups: ToolGroup[] = [];
        groups.forEach((toolsInGroup) => {
            const representative = toolsInGroup.reduce((latest, current) => 
                (current.sequencial > latest.sequencial) ? current : latest
            );
            aggregatedGroups.push({
                ...representative,
                unitCount: toolsInGroup.length,
                lastSequencial: representative.sequencial,
            });
        });
        
        setFoundToolGroups(aggregatedGroups);

      } catch (error) {
        console.error('Erro ao pesquisar ferramenta:', error);
        toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível realizar a busca.' });
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
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma ferramenta selecionada.' });
      return;
    }
    if (quantityToAdd <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A quantidade deve ser maior que zero.' });
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
          const currentId = counterDoc.data().lastId;
          const newId = currentId + quantityToAdd;
          transaction.update(counterRef, { lastId: newId });
          return currentId;
      });

      const { id, unitCount, lastSequencial: ls, ...baseData } = selectedToolGroup;

      for (let i = 0; i < quantityToAdd; i++) {
        const newSequencial = newLastId + 1 + i;
        const newCode = `${baseCode}-${newSequencial.toString().padStart(4, '0')}`;
        
        const newToolData: Omit<Tool, 'id'> = {
          ...baseData,
          codigo: newCode,
          sequencial: newSequencial,
          status: 'Disponível',
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
          <DialogTitle>Adicionar Quantidade a Item Existente</DialogTitle>
          <DialogDescription>
            Pesquise por descrição ou código e adicione novas unidades a uma ferramenta.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="relative">
            <Label htmlFor="searchTerm">Pesquisar por Descrição ou Código</Label>
            <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchTerm"
              placeholder="Digite a descrição ou código (ex: Martelo, STD-MEC-N...)"
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
                                key={group.codigo}
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
                                    <p className="text-xs text-muted-foreground">{group.unitCount} unidade(s) em estoque</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        <p>Nenhuma ferramenta encontrada.</p>
                    </div>
                )}
            </ScrollArea>
          )}

          {selectedToolGroup && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3 animate-in fade-in-50">
                <div className="flex justify-between items-start">
                    <h4 className="font-semibold">Ferramenta Selecionada</h4>
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
                      <p><strong>Último Seq.:</strong> {selectedToolGroup.lastSequencial.toString().padStart(4, '0')}</p>
                  </div>
              </div>
              <div className="grid w-full max-w-sm items-center gap-1.5 pt-2">
                  <Label htmlFor="quantityToAdd">Quantidade a Adicionar</Label>
                  <Input
                    id="quantityToAdd"
                    type="number"
                    min="1"
                    value={quantityToAdd}
                    onChange={(e) => setQuantityToAdd(parseInt(e.target.value, 10) || 1)}
                  />
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedToolGroup || isSaving || isSearching}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar e Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
