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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import type { Tool, ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface ToolLoanRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allAvailableTools: WithDocId<Tool>[];
  onActionSuccess: () => void;
}

export default function ToolLoanRequestDialog({ isOpen, onClose, allAvailableTools, onActionSuccess }: ToolLoanRequestDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [osNumber, setOsNumber] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
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
    setDueDate(undefined);
    setSelectedToolIds(new Set());
    setSearchTerm('');
    setIsSaving(false);
    onClose();
  };

  const handleSaveRequest = async () => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }
    if (!osNumber) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O número da OS é obrigatório.' });
      return;
    }
    if (!dueDate) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A data de devolução prevista é obrigatória.' });
      return;
    }
    if (selectedToolIds.size === 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione pelo menos uma ferramenta.' });
      return;
    }

    setIsSaving(true);
    try {
      const newRequest: Omit<ToolRequest, 'id'> = {
        osNumber,
        requesterId: user.uid,
        requesterName: user.displayName || user.email || 'Desconhecido',
        status: 'Pendente',
        requestedAt: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
        toolIds: Array.from(selectedToolIds),
      };

      const requestsCollectionRef = collection(firestore, 'tool_requests');
      await addDoc(requestsCollectionRef, newRequest);
      
      toast({ title: 'Sucesso', description: 'Sua requisição de ferramentas foi enviada.' });
      
      queryClient.invalidateQueries({ queryKey: ['tool_requests'] });
      
      onActionSuccess();
      resetAndClose();
    } catch (error) {
      console.error('Erro ao salvar requisição:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a requisição.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitar Empréstimo de Ferramenta(s)</DialogTitle>
          <DialogDescription>
            Preencha os dados da OS e selecione as ferramentas que você precisa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[70vh] flex flex-col">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="osNumber">Número da OS <span className="text-destructive">*</span></Label>
              <Input
                id="osNumber"
                placeholder="Ex: 2024-00123"
                value={osNumber}
                onChange={(e) => setOsNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data Prev. Devolução <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar 
                    mode="single" 
                    selected={dueDate} 
                    onSelect={setDueDate}
                    initialFocus 
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Solicitante</Label>
            <Input value={user?.displayName || user?.email || 'Carregando...'} readOnly className="bg-muted" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="toolSearch">Selecionar Ferramentas ({selectedToolIds.size} selecionadas)</Label>
            <div className="relative">
              <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="toolSearch"
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
          <Button onClick={handleSaveRequest} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
