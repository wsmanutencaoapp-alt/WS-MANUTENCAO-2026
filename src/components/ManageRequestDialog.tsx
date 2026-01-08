'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import {
  doc,
  writeBatch,
  updateDoc,
  deleteDoc
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
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, Trash2, Save, X } from 'lucide-react';
import type { ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';

interface ManageRequestDialogProps {
  request: WithDocId<ToolRequest>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ManageRequestDialog({ request, isOpen, onClose, onSuccess }: ManageRequestDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editableRequest, setEditableRequest] = useState({
      osNumber: '',
      requesterName: ''
  });

  useEffect(() => {
    if (request) {
        setEditableRequest({
            osNumber: request.osNumber,
            requesterName: request.requesterName
        });
    }
  }, [request]);

  const handleUpdate = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
        const requestRef = doc(firestore, 'tool_requests', request.docId);
        await updateDoc(requestRef, {
            osNumber: editableRequest.osNumber,
            requesterName: editableRequest.requesterName
        });
        toast({ title: "Sucesso!", description: "A requisição foi atualizada." });
        onSuccess();
    } catch (error) {
        console.error("Erro ao atualizar requisição:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as alterações." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!firestore) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'tool_requests', request.docId);

        // If tools were in use, set them back to available
        if (request.status === 'Em Uso' && request.toolIds.length > 0) {
            request.toolIds.forEach(toolId => {
                const toolRef = doc(firestore, 'tools', toolId);
                batch.update(toolRef, { status: 'Disponível' });
            });
        }
        
        // Mark request as canceled
        batch.update(requestRef, { status: 'Cancelada' });

        await batch.commit();
        toast({ title: "Sucesso!", description: "A requisição foi cancelada." });
        onSuccess();
    } catch (error) {
        console.error("Erro ao cancelar requisição:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível cancelar a requisição." });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditableRequest(prev => ({...prev, [id]: value}));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Requisição</DialogTitle>
          <DialogDescription>
            Edite ou cancele a requisição <span className="font-bold">{request.osNumber}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="space-y-1.5">
                <Label htmlFor="osNumber">Número da OS</Label>
                <Input id="osNumber" value={editableRequest.osNumber} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="requesterName">Nome do Solicitante</Label>
                <Input id="requesterName" value={editableRequest.requesterName} onChange={handleInputChange} />
            </div>
        </div>

        <DialogFooter className="sm:justify-between">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSaving || isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                      Cancelar Requisição
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tem certeza que deseja cancelar esta requisição? Se as ferramentas estiverem "Em Uso", elas voltarão ao status "Disponível".
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelRequest} className="bg-destructive hover:bg-destructive/90">
                        Sim, Cancelar
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          <Button onClick={handleUpdate} disabled={isSaving || isDeleting}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
