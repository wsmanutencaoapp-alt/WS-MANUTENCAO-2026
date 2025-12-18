'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  documentId,
  doc,
  writeBatch
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
import { ScrollArea } from './ui/scroll-area';
import { Loader2, User, Hash, Calendar, Package } from 'lucide-react';
import type { Tool, ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface FulfillRequestDialogProps {
  request: WithDocId<ToolRequest>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FulfillRequestDialog({ request, isOpen, onClose, onSuccess }: FulfillRequestDialogProps) {
  const firestore = useFirestore();
  const { user: ferramentariaUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const toolsQuery = useMemoFirebase(() => {
    if (!firestore || !request.toolIds || request.toolIds.length === 0) return null;
    return query(collection(firestore, 'tools'), where(documentId(), 'in', request.toolIds));
  }, [firestore, request.toolIds]);

  const { data: tools, isLoading, error } = useCollection<WithDocId<Tool>>(toolsQuery, {
      queryKey: ['tools_for_request', request.docId],
      enabled: isOpen,
  });

  const handleConfirm = async () => {
    if (!firestore || !ferramentariaUser || !tools) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços indisponíveis ou usuário não autenticado.' });
      return;
    }
    
    if (tools.some(tool => tool.status !== 'Disponível')) {
        toast({ variant: 'destructive', title: 'Conflito de Status', description: 'Uma ou mais ferramentas solicitadas não estão mais disponíveis. Cancele e tente novamente.' });
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        // 1. Update the request status
        const requestRef = doc(firestore, 'tool_requests', request.docId);
        batch.update(requestRef, {
            status: 'Em Uso',
            handledBy: ferramentariaUser.uid,
            handledAt: new Date().toISOString(),
        });

        // 2. Update each tool's status
        for (const tool of tools) {
            const toolRef = doc(firestore, 'tools', tool.docId);
            batch.update(toolRef, { status: 'Em Empréstimo' });
        }

        await batch.commit();

        toast({ title: "Sucesso!", description: `Empréstimo para a OS ${request.osNumber} registrado.` });
        queryClient.invalidateQueries({ queryKey: ['tool_requests_pending'] });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
        onSuccess();
    } catch (err) {
        console.error("Erro ao atender requisição:", err);
        toast({ variant: 'destructive', title: "Erro na Operação", description: "Não foi possível registrar o empréstimo." });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Atender Requisição de Empréstimo</DialogTitle>
          <DialogDescription>
            Confirme a retirada das ferramentas para a OS <span className="font-bold">{request.osNumber}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[60vh] flex flex-col">
            <div className="grid grid-cols-2 gap-4 text-sm px-1">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="text-muted-foreground">Solicitante</p>
                        <p className="font-medium">{request.requesterName}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="text-muted-foreground">Nº da OS</p>
                        <p className="font-medium">{request.osNumber}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="text-muted-foreground">Data da Solicitação</p>
                        <p className="font-medium">{format(new Date(request.requestedAt), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="text-muted-foreground">Itens Solicitados</p>
                        <p className="font-medium">{request.toolIds.length}</p>
                    </div>
                </div>
            </div>

          <p className="text-sm font-medium pt-2">Ferramentas a serem retiradas:</p>
          <ScrollArea className="flex-1 border rounded-md">
            <div className="p-2 space-y-2">
              {isLoading && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
              {error && <p className="text-destructive text-center p-4">Erro ao carregar os detalhes das ferramentas.</p>}
              {!isLoading && tools?.map(tool => (
                <div key={tool.docId} className="flex items-center gap-3 p-2 border rounded-md">
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
                  {tool.status !== 'Disponível' ? (
                      <Badge variant="destructive">Indisponível</Badge>
                  ) : (
                      <Badge variant="success">Disponível</Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isSaving || isLoading || tools?.some(t => t.status !== 'Disponível')}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Retirada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
