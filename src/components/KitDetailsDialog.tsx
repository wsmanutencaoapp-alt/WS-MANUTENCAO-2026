'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId, doc, writeBatch } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, Edit, Save, X, PlusCircle, MinusCircle, Search } from 'lucide-react';
import type { Kit, Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Separator } from './ui/separator';

interface KitDetailsDialogProps {
  kit: WithDocId<Kit> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function KitDetailsDialog({ kit, isOpen, onClose }: KitDetailsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableKit, setEditableKit] = useState<Partial<Kit>>({});
  
  const [currentToolIds, setCurrentToolIds] = useState<Set<string>>(new Set());
  const [availableToolsSearchTerm, setAvailableToolsSearchTerm] = useState('');
  const [kitToolsSearchTerm, setKitToolsSearchTerm] = useState('');


  // Fetch tools currently IN this kit
  const toolsInKitQuery = useMemoFirebase(() => {
    if (!firestore || !kit || currentToolIds.size === 0) return null;
    return query(collection(firestore, 'tools'), where(documentId(), 'in', Array.from(currentToolIds)));
  }, [firestore, kit, currentToolIds]);
  
  const { data: toolsInKit, isLoading: isLoadingKitTools, error: toolsInKitError } = useCollection<WithDocId<Tool>>(toolsInKitQuery, {
      queryKey: ['kitTools', kit?.docId, Array.from(currentToolIds)],
      enabled: !!kit && currentToolIds.size > 0,
  });

  // Fetch ALL available tools for adding
  const availableToolsQuery = useMemoFirebase(() => {
    if (!firestore || !isEditing) return null;
    return query(collection(firestore, 'tools'), where('status', '==', 'Disponível'));
  }, [firestore, isEditing]);

  const { data: availableTools, isLoading: isLoadingAvailableTools } = useCollection<WithDocId<Tool>>(availableToolsQuery, {
      queryKey: ['availableToolsForKitEditing'],
      enabled: isEditing,
  });
  
  const filteredAvailableTools = useMemo(() => {
      if (!availableTools) return [];
      const lowercasedTerm = availableToolsSearchTerm.toLowerCase();
      return availableTools.filter(tool => 
          !currentToolIds.has(tool.docId) &&
          ((tool.descricao?.toLowerCase().includes(lowercasedTerm)) || 
           (tool.codigo?.toLowerCase().includes(lowercasedTerm)))
      );
  }, [availableTools, availableToolsSearchTerm, currentToolIds]);

  const filteredToolsInKit = useMemo(() => {
    if (!toolsInKit) return [];
    const lowercasedTerm = kitToolsSearchTerm.toLowerCase();
    return toolsInKit.filter(tool => 
        ((tool.descricao?.toLowerCase().includes(lowercasedTerm)) || 
         (tool.codigo?.toLowerCase().includes(lowercasedTerm)))
    );
  }, [toolsInKit, kitToolsSearchTerm]);


  useEffect(() => {
    if (kit) {
      setEditableKit({
        descricao: kit.descricao,
        enderecamento: kit.enderecamento,
      });
      setCurrentToolIds(new Set(kit.toolIds || []));
    }
    // Reset states when dialog opens or kit changes
    setIsEditing(false);
    setIsSaving(false);
    setAvailableToolsSearchTerm('');
    setKitToolsSearchTerm('');
  }, [kit, isOpen]);

  const handleToolAction = (toolId: string, action: 'add' | 'remove') => {
      setCurrentToolIds(prev => {
          const newSet = new Set(prev);
          if (action === 'add') {
              newSet.add(toolId);
          } else {
              newSet.delete(toolId);
          }
          return newSet;
      });
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !kit) return;
    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        const kitRef = doc(firestore, 'kits', kit.docId);

        // Update kit details
        batch.update(kitRef, {
            descricao: editableKit.descricao,
            enderecamento: editableKit.enderecamento,
            toolIds: Array.from(currentToolIds),
        });

        const originalToolIds = new Set(kit.toolIds || []);
        const newToolIds = currentToolIds;

        // Tools to be added: in new set but not in original
        const addedIds = Array.from(newToolIds).filter(id => !originalToolIds.has(id));
        for (const toolId of addedIds) {
            const toolRef = doc(firestore, 'tools', toolId);
            batch.update(toolRef, { status: 'Em Kit', enderecamento: kit.codigo });
        }

        // Tools to be removed: in original set but not in new
        const removedIds = Array.from(originalToolIds).filter(id => !newToolIds.has(id));
        for (const toolId of removedIds) {
            const toolRef = doc(firestore, 'tools', toolId);
            batch.update(toolRef, { status: 'Disponível', enderecamento: '' }); // Reset location or set to a default
        }
        
        await batch.commit();

        toast({ title: "Sucesso!", description: "O kit foi atualizado." });
        queryClient.invalidateQueries({ queryKey: ['kits'] });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
        queryClient.invalidateQueries({ queryKey: ['kitTools', kit.docId] });
        queryClient.invalidateQueries({ queryKey: ['availableToolsForKitEditing'] });
        setIsEditing(false);
        onClose();
    } catch(err) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível salvar as alterações." });
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditableKit(prev => ({ ...prev, [id]: value }));
  };
  
  const handleCancelEdit = () => {
      setIsEditing(false);
      // Reset changes by re-applying the original kit data
      if (kit) {
          setCurrentToolIds(new Set(kit.toolIds || []));
          setEditableKit({ descricao: kit.descricao, enderecamento: kit.enderecamento });
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Kit" : "Itens do Kit"}: {kit?.codigo}</DialogTitle>
          {!isEditing && <DialogDescription>{kit?.descricao}</DialogDescription>}
        </DialogHeader>

        {isEditing ? (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6" style={{ height: '60vh' }}>
                {/* Coluna 1: Dados do kit e Ferramentas no Kit */}
                <div className="flex flex-col gap-4 overflow-hidden">
                    <div className="space-y-4 p-1">
                        <div className="space-y-1">
                            <Label htmlFor="descricao">Descrição do Kit</Label>
                            <Input id="descricao" value={editableKit.descricao || ''} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="enderecamento">Endereçamento do Kit</Label>
                            <Input id="enderecamento" value={editableKit.enderecamento || ''} onChange={handleInputChange} />
                        </div>
                    </div>
                    <Separator />
                     <div className="relative">
                        <Label htmlFor="kitToolsSearchTerm">Ferramentas no Kit ({filteredToolsInKit?.length || 0})</Label>
                        <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="kitToolsSearchTerm" placeholder="Buscar no kit..." value={kitToolsSearchTerm} onChange={(e) => setKitToolsSearchTerm(e.target.value)} className="pl-8" />
                    </div>
                    <ScrollArea className="flex-1 border rounded-md">
                        <div className="p-2 space-y-2">
                             {isLoadingKitTools && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
                             {!isLoadingKitTools && filteredToolsInKit.map(tool => (
                                <div key={tool.docId} className="flex items-center gap-2 p-2 border rounded-md">
                                    <Image src={tool.imageUrl || "https://picsum.photos/seed/tool/40/40"} alt={tool.descricao} width={32} height={32} className="aspect-square rounded-md object-cover"/>
                                    <div className="flex-1 text-xs"><p className="font-bold truncate">{tool.descricao}</p><p className="font-mono text-muted-foreground">{tool.codigo}</p></div>
                                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => handleToolAction(tool.docId, 'remove')}><MinusCircle className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                             {!isLoadingKitTools && filteredToolsInKit.length === 0 && <p className="text-muted-foreground text-center text-sm p-4">Nenhuma ferramenta no kit.</p>}
                        </div>
                    </ScrollArea>
                </div>

                {/* Coluna 2: Ferramentas Disponíveis */}
                <div className="flex flex-col gap-4 overflow-hidden">
                     <div className="relative">
                        <Label htmlFor="availableToolsSearchTerm">Adicionar Ferramentas Disponíveis</Label>
                        <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="availableToolsSearchTerm" placeholder="Buscar por código ou descrição..." value={availableToolsSearchTerm} onChange={(e) => setAvailableToolsSearchTerm(e.target.value)} className="pl-8" />
                    </div>
                    <ScrollArea className="flex-1 border rounded-md">
                        <div className="p-2 space-y-2">
                           {isLoadingAvailableTools && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
                           {!isLoadingAvailableTools && filteredAvailableTools.map(tool => (
                                <div key={tool.docId} className="flex items-center gap-2 p-2 border rounded-md">
                                    <Image src={tool.imageUrl || "https://picsum.photos/seed/tool/40/40"} alt={tool.descricao} width={32} height={32} className="aspect-square rounded-md object-cover"/>
                                    <div className="flex-1 text-xs"><p className="font-bold truncate">{tool.descricao}</p><p className="font-mono text-muted-foreground">{tool.codigo}</p></div>
                                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => handleToolAction(tool.docId, 'add')}><PlusCircle className="h-4 w-4 text-green-600" /></Button>
                                </div>
                            ))}
                           {!isLoadingAvailableTools && filteredAvailableTools.length === 0 && <p className="text-muted-foreground text-center text-sm p-4">Nenhuma ferramenta disponível encontrada.</p>}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        ) : (
          <div className="flex flex-col gap-4" style={{ height: '60vh' }}>
            <div className="relative">
              <Label htmlFor="kitToolsSearchTermView">Pesquisar Itens no Kit</Label>
              <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="kitToolsSearchTermView" 
                placeholder="Buscar por código ou descrição..." 
                value={kitToolsSearchTerm} 
                onChange={(e) => setKitToolsSearchTerm(e.target.value)} 
                className="pl-8" 
              />
            </div>
            <ScrollArea className="flex-1 border rounded-md">
            <div className="p-4 space-y-3">
                {isLoadingKitTools && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
                {toolsInKitError && <p className="text-destructive text-center">Erro ao carregar ferramentas.</p>}
                {!isLoadingKitTools && filteredToolsInKit.length === 0 && (
                    <p className="text-muted-foreground text-center">Nenhuma ferramenta encontrada neste kit.</p>
                )}
                {!isLoadingKitTools && filteredToolsInKit.map(tool => (
                    <div key={tool.docId} className="flex items-center gap-4 p-2 border rounded-md">
                        <Image
                            src={tool.imageUrl || "https://picsum.photos/seed/tool/40/40"}
                            alt={tool.descricao}
                            width={40}
                            height={40}
                            className="aspect-square rounded-md object-cover"
                        />
                        <div className="flex-1 text-sm">
                            <p className="font-bold">{tool.descricao}</p>
                            <p className="font-mono text-xs text-muted-foreground">{tool.codigo}</p>
                        </div>
                        <Badge variant="secondary">{tool.status}</Badge>
                    </div>
                ))}
            </div>
            </ScrollArea>
          </div>
        )}
        
        <DialogFooter className="pt-4">
            {isEditing ? (
                <div className="flex w-full justify-end gap-2">
                    <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" /> Cancelar
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Alterações
                    </Button>
                </div>
            ) : (
                <div className="flex w-full justify-between">
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4"/> Editar Kit
                    </Button>
                    <Button onClick={onClose}>Fechar</Button>
                </div>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
