'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { writeBatch, doc, query, collection, where, getDocs, limit } from 'firebase/firestore';
import type { Tool, ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, Search, Undo2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ManualCheckInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allLoanedTools: WithDocId<Tool>[];
  onActionSuccess: () => void;
}

export default function ManualCheckInDialog({ isOpen, onClose, allLoanedTools, onActionSuccess }: ManualCheckInDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredTools = useMemo(() => {
    if (!allLoanedTools) return [];
    if (!searchTerm) return allLoanedTools;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allLoanedTools.filter(
      tool =>
        (tool.descricao && tool.descricao.toLowerCase().includes(lowercasedTerm)) ||
        (tool.codigo && tool.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [allLoanedTools, searchTerm]);

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

  const resetAndClose = () => {
    setSelectedToolIds(new Set());
    setSearchTerm('');
    setIsSaving(false);
    onClose();
  };

  const handleReturn = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
      return;
    }
    if (selectedToolIds.size === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione pelo menos uma ferramenta para devolver.' });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const toolIdsArray = Array.from(selectedToolIds);

      // Find the active request for these tools
      const requestsRef = collection(firestore, 'tool_requests');
      const q = query(
        requestsRef,
        where('toolIds', 'array-contains-any', toolIdsArray),
        where('status', '==', 'Em Uso'),
        limit(1) // Assuming one tool is only in one active request
      );

      const requestSnapshot = await getDocs(q);
      
      if (requestSnapshot.empty) {
          throw new Error("Não foi possível encontrar a requisição de empréstimo ativa para as ferramentas selecionadas.");
      }
      
      const requestDoc = requestSnapshot.docs[0];
      const requestRef = doc(firestore, 'tool_requests', requestDoc.id);

      // Update the request status
      batch.update(requestRef, {
        status: 'Devolvida',
        returnedAt: new Date().toISOString(),
      });

      // Update tools status
      for (const toolId of toolIdsArray) {
        const toolRef = doc(firestore, 'tools', toolId);
        batch.update(toolRef, { status: 'Disponível' });
      }

      await batch.commit();

      toast({ title: 'Sucesso', description: `${toolIdsArray.length} ferramenta(s) devolvida(s).` });
      
      // Invalidate queries to refetch data across the app
      queryClient.invalidateQueries({ queryKey: ['tool_requests_active'] });
      queryClient.invalidateQueries({ queryKey: ['tool_requests_history_completed'] });
      queryClient.invalidateQueries({ queryKey: ['loanedTools'] });
      queryClient.invalidateQueries({ queryKey: ['availableTools'] });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });

      onActionSuccess();
      resetAndClose();
    } catch (error: any) {
      console.error('Erro ao registrar devolução:', error);
      toast({ variant: 'destructive', title: 'Erro na Devolução', description: error.message || 'Não foi possível registrar a devolução.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Entrada (Devolução)</DialogTitle>
          <DialogDescription>
            Selecione as ferramentas que estão sendo devolvidas ao estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[70vh] flex flex-col">
          <div className="space-y-1.5">
            <Label htmlFor="toolSearch-checkin">Buscar Ferramenta Emprestada ({selectedToolIds.size} selecionadas)</Label>
            <div className="relative">
              <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="toolSearch-checkin"
                placeholder="Pesquisar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="h-72 border rounded-md flex-1">
            <div className="p-2 space-y-2">
              {!allLoanedTools && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
              {allLoanedTools && allLoanedTools.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma ferramenta emprestada no momento.</p>}
              {filteredTools && filteredTools.map(tool => (
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
                    alt={tool.descricao || 'Ferramenta'}
                    width={40}
                    height={40}
                    className="aspect-square rounded-md object-cover"
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-bold">{tool.descricao}</p>
                    <p className="font-mono text-xs text-muted-foreground">{tool.codigo}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleReturn} disabled={isSaving || selectedToolIds.size === 0}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
            Confirmar Devolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
