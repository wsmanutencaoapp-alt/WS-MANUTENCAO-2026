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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, User, Hash, Calendar, Package, Undo2 } from 'lucide-react';
import type { Tool, ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';


interface ReturnLoanDialogProps {
  request: WithDocId<ToolRequest>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnLoanDialog({ request, isOpen, onClose, onSuccess }: ReturnLoanDialogProps) {
  const firestore = useFirestore();
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

  const handleReturn = async () => {
    if (!firestore || !tools) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços indisponíveis.' });
      return;
    }
    
    setIsSaving(true);

    try {
        const batch = writeBatch(firestore);

        const requestRef = doc(firestore, 'tool_requests', request.docId);
        batch.update(requestRef, {
            status: 'Devolvida',
            returnedAt: new Date().toISOString(),
        });

        for (const tool of tools) {
            const toolRef = doc(firestore, 'tools', tool.docId);
            batch.update(toolRef, { status: 'Disponível' });
        }

        await batch.commit();

        toast({ title: "Sucesso!", description: `Devolução para a OS ${request.osNumber} registrada.` });
        
        queryClient.invalidateQueries({ queryKey: ['tool_requests_history'] });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
        
        onSuccess();
    } catch (err) {
        console.error("Erro ao registrar devolução:", err);
        toast({ variant: 'destructive', title: "Erro na Operação", description: "Não foi possível registrar a devolução." });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            Confirme os itens devolvidos para o empréstimo da OS <span className="font-bold">{request.osNumber}</span>.
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
                        <p className="text-muted-foreground">Data da Retirada</p>
                        <p className="font-medium">{request.handledAt ? format(new Date(request.handledAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="text-muted-foreground">Itens Emprestados</p>
                        <p className="font-medium">{request.toolIds.length}</p>
                    </div>
                </div>
            </div>

          <p className="text-sm font-medium pt-2">Ferramentas a serem devolvidas:</p>
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
                  <Badge variant="default">{tool.status}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button disabled={isSaving || isLoading}>
                    <Undo2 className="mr-2 h-4 w-4" />
                    Confirmar Devolução
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Devolução</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação registrará a devolução de todos os {tools?.length || 0} itens para a OS {request.osNumber} e atualizará o status deles para "Disponível". Deseja continuar?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReturn} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Sim, confirmar devolução
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
