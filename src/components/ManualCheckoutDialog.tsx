'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { addDoc, collection, writeBatch, doc } from 'firebase/firestore';
import type { Tool, ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ManualCheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allAvailableTools: WithDocId<Tool>[];
  onActionSuccess: () => void;
}

export default function ManualCheckoutDialog({ isOpen, onClose, allAvailableTools, onActionSuccess }: ManualCheckoutDialogProps) {
  const { user: ferramentariaUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [osNumber, setOsNumber] = useState('');
  const [requesterName, setRequesterName] = useState(''); // New state for manual name
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredTools = useMemo(() => {
    if (!allAvailableTools) return [];
    if (!searchTerm) return allAvailableTools;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allAvailableTools.filter(
      tool =>
        (tool.descricao && tool.descricao.toLowerCase().includes(lowercasedTerm)) ||
        (tool.codigo && tool.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [allAvailableTools, searchTerm]);

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
    setOsNumber('');
    setRequesterName('');
    setSelectedToolIds(new Set());
    setSearchTerm('');
    setIsSaving(false);
    onClose();
  };

  const handleSaveCheckout = async () => {
    if (!firestore || !ferramentariaUser) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }
    if (!osNumber) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O número da OS é obrigatório.' });
      return;
    }
    if (!requesterName) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O nome do solicitante é obrigatório.' });
      return;
    }
    if (selectedToolIds.size === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione pelo menos uma ferramenta.' });
      return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        const requestCollectionRef = collection(firestore, 'tool_requests');
        const newRequestRef = doc(requestCollectionRef);

      const newRequestData: Omit<ToolRequest, 'id'> = {
        osNumber,
        requesterId: ferramentariaUser.uid, // The tool manager is the requester in this flow
        requesterName: requesterName, // Manual name
        status: 'Em Uso', // Directly to "In Use"
        requestedAt: new Date().toISOString(),
        handledBy: ferramentariaUser.uid,
        handledAt: new Date().toISOString(),
        toolIds: Array.from(selectedToolIds),
      };
      batch.set(newRequestRef, newRequestData);
      
      // Update tools status
      for (const toolId of selectedToolIds) {
          const toolRef = doc(firestore, 'tools', toolId);
          batch.update(toolRef, { status: 'Em Empréstimo' });
      }

      await batch.commit();
      
      toast({ title: 'Sucesso', description: 'Saída de ferramenta registrada.' });
      
      queryClient.invalidateQueries({ queryKey: ['tool_requests_active'] });
      queryClient.invalidateQueries({ queryKey: ['availableTools'] });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      
      onActionSuccess();
      resetAndClose();
    } catch (error) {
      console.error('Erro ao registrar saída:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível registrar a saída.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Saída Manual</DialogTitle>
          <DialogDescription>
            Registre a retirada imediata de ferramentas para uma Ordem de Serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[70vh] flex flex-col">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="osNumber-manual">Número da OS <span className="text-destructive">*</span></Label>
              <Input
                id="osNumber-manual"
                placeholder="Ex: 2024-00123"
                value={osNumber}
                onChange={(e) => setOsNumber(e.target.value)}
              />
            </div>
             <div className="space-y-1.5">
              <Label htmlFor="requesterName-manual">Nome do Solicitante <span className="text-destructive">*</span></Label>
              <Input
                id="requesterName-manual"
                placeholder="Ex: João da Silva"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="toolSearch-manual">Selecionar Ferramentas Disponíveis ({selectedToolIds.size} selecionadas)</Label>
            <div className="relative">
              <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="toolSearch-manual"
                placeholder="Pesquisar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="h-64 border rounded-md flex-1">
            <div className="p-2 space-y-2">
              {allAvailableTools && allAvailableTools.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma ferramenta disponível.</p>}
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
                  <Badge variant="outline">{tool.enderecamento}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSaveCheckout} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Saída
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
