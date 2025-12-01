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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


interface AddQuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTools: any[]) => void;
}

type FoundTool = Tool & {
  id: string;
};

// Represents a group of tools with the same 'codigo'
type ToolGroup = FoundTool & {
  unitCount: number;
  lastUnitCode: string;
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
        const searchTermUpper = searchTerm.toUpperCase();
        
        // Query 1: by exact code
        const codeQuery = query(toolsRef, where('codigo', '==', searchTermUpper));
        
        // Query 2: by name (prefix search)
        const nameQuery = query(
          toolsRef, 
          where('name', '>=', searchTerm),
          where('name', '<=', searchTerm + '\uf8ff'),
          limit(25) // Limit results for performance
        );

        const [codeSnapshot, nameSnapshot] = await Promise.all([getDocs(codeQuery), getDocs(nameQuery)]);

        const allTools = new Map<string, FoundTool>();
        codeSnapshot.docs.forEach(doc => allTools.set(doc.id, { id: doc.id, ...doc.data() } as FoundTool));
        nameSnapshot.docs.forEach(doc => allTools.set(doc.id, { id: doc.id, ...doc.data() } as FoundTool));
        
        // Group tools by 'codigo'
        const groups = new Map<string, FoundTool[]>();
        allTools.forEach(tool => {
            if (tool.codigo) {
                if (!groups.has(tool.codigo)) {
                    groups.set(tool.codigo, []);
                }
                groups.get(tool.codigo)!.push(tool);
            }
        });

        const aggregatedGroups: ToolGroup[] = [];
        groups.forEach((toolsInGroup, codigo) => {
            toolsInGroup.sort((a, b) => (a.unitCode || '').localeCompare(b.unitCode || ''));
            const representative = toolsInGroup[toolsInGroup.length - 1]; // Get the last one
            aggregatedGroups.push({
                ...representative,
                unitCount: toolsInGroup.length,
                lastUnitCode: representative.unitCode || 'A0000',
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
    const { lastUnitCode } = selectedToolGroup;
    const lastUnitNumber = parseInt(lastUnitCode.replace('A', ''), 10);

    try {
      await runTransaction(firestore, async (transaction) => {
        for (let i = 0; i < quantityToAdd; i++) {
          const newUnitNumber = lastUnitNumber + 1 + i;
          const newUnitCode = `A${newUnitNumber.toString().padStart(4, '0')}`;
          
          const newToolDocRef = doc(collection(firestore, 'tools'));
          
          const { id, unitCount, lastUnitCode, ...baseData } = selectedToolGroup;

          const newToolData: Omit<FoundTool, 'id'> = {
            ...baseData,
            unitCode: newUnitCode,
            status: 'Disponível',
          };
          
          transaction.set(newToolDocRef, newToolData);
          newTools.push({ ...newToolData, id: newToolDocRef.id });
        }
      });
      
      toast({ title: 'Sucesso!', description: `${quantityToAdd} nova(s) unidade(s) de ${selectedToolGroup.name} foram adicionadas.` });
      onSuccess(newTools);

    } catch (error) {
      if (error instanceof FirestorePermissionError) {
        // If it's already a contextual error, just re-throw it for the listener
        throw error;
      }
       // Create and emit a contextual error for permission issues
      const permissionError = new FirestorePermissionError({
        path: `tools`, // Path for the collection where the transaction runs
        operation: 'write', 
        requestResourceData: { info: `Transaction to add ${quantityToAdd} tools.` }
      });
      errorEmitter.emit('permission-error', permissionError);

      // We don't show a toast here, as the global listener will handle it.
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
            Pesquise por nome ou código e adicione novas unidades a uma ferramenta.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="relative">
            <Label htmlFor="searchTerm">Pesquisar por Nome ou Código</Label>
            <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchTerm"
              placeholder="Digite o nome ou código (ex: Martelo, FE000001)"
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
                                    alt={group.name}
                                    width={48}
                                    height={48}
                                    className="aspect-square rounded-md object-cover"
                                />
                                <div className="text-sm">
                                    <p className="font-bold">{group.name}</p>
                                    <p><strong>Código:</strong> {group.codigo}</p>
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
                    alt={selectedToolGroup.name}
                    width={64}
                    height={64}
                    className="aspect-square rounded-md object-cover"
                  />
                  <div className="text-sm">
                      <p className="font-bold">{selectedToolGroup.name}</p>
                      <p><strong>Código:</strong> {selectedToolGroup.codigo}</p>
                      <p><strong>Último Lote:</strong> {selectedToolGroup.lastUnitCode}</p>
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
