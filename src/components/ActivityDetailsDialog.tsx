'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import type { User } from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Milestone, Check, RefreshCcw, MessageSquarePlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { Separator } from './ui/separator';

interface ActivityDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activity: WithDocId<Activity> | null;
  currentUser: User | null;
}

export default function ActivityDetailsDialog({ isOpen, onClose, activity, currentUser }: ActivityDetailsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [justification, setJustification] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (activity) {
        setJustification('');
        setProgressNote('');
        setDueDate(activity.dueDate ? format(new Date(activity.dueDate), 'yyyy-MM-dd') : '');
    }
  }, [activity]);

  const handleLogProgress = async () => {
    if (!firestore || !activity || !currentUser || !progressNote) return;

    setIsProcessing(true);
    const activityRef = doc(firestore, 'activities', activity.docId);

    try {
        const historyEntry = {
            action: 'Progresso',
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            timestamp: new Date().toISOString(),
            details: progressNote
        };

        await updateDoc(activityRef, {
            history: arrayUnion(historyEntry)
        });

        toast({ title: 'Sucesso', description: 'Progresso adicionado à atividade.' });
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        setProgressNote(''); // Clear the textarea
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível adicionar a nota de progresso.' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'complete' | 'validate_ok' | 'validate_nok') => {
    if (!firestore || !activity || !currentUser) return;

    if (action === 'reject' && !justification) {
        toast({ variant: 'destructive', title: 'Justificativa obrigatória' });
        return;
    }
    if (action === 'accept' && !dueDate) {
        toast({ variant: 'destructive', title: 'Prazo obrigatório' });
        return;
    }

    setIsProcessing(true);
    const activityRef = doc(firestore, 'activities', activity.docId);
    let newStatus: Activity['status'] | undefined;
    let details = '';

    switch(action) {
        case 'accept': 
            newStatus = 'Em Andamento'; 
            details = `Atividade aceita. Prazo definido para ${format(new Date(dueDate), 'dd/MM/yyyy')}.`;
            break;
        case 'reject': 
            newStatus = 'Recusada';
            details = `Atividade recusada. Motivo: ${justification}`;
            break;
        case 'complete': 
            newStatus = 'Aguardando Validação';
            details = `Atividade marcada como concluída pelo responsável.`;
            break;
        case 'validate_ok': 
            newStatus = 'Concluída';
            details = `Atividade validada como eficaz pelo solicitante.`;
            break;
        case 'validate_nok': 
            newStatus = 'Pendente';
            details = `Atividade devolvida para reexecução. Motivo: ${justification}`;
            break;
    }
    
    try {
        const historyEntry = {
            action: action,
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            timestamp: new Date().toISOString(),
            details: details
        };

        const updateData: any = {
            status: newStatus,
            history: arrayUnion(historyEntry)
        };
        
        if(action === 'accept') updateData.dueDate = new Date(dueDate).toISOString();
        if(action === 'reject' || action === 'validate_nok') updateData.refusalJustification = justification;
        if(action === 'validate_ok') updateData.isEffective = true;


        await updateDoc(activityRef, updateData);
        toast({ title: 'Sucesso!', description: 'Status da atividade atualizado.' });
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        onClose();
    } catch(err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a atividade.' });
    } finally {
        setIsProcessing(false);
    }
  }

  const isAssignee = currentUser?.uid === activity?.assigneeId;
  const isRequester = currentUser?.uid === activity?.requesterId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
          <DialogDescription>
            Atribuída a <span className='font-medium'>{activity?.assigneeName}</span> por <span className='font-medium'>{activity?.requesterName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 py-4">
            <p className="text-sm whitespace-pre-wrap">{activity?.description || 'Nenhuma descrição fornecida.'}</p>
            <div className="flex justify-between items-center text-sm">
                <Badge>{activity?.status}</Badge>
                {activity?.dueDate && <span>Prazo: {format(new Date(activity.dueDate), 'dd/MM/yyyy')}</span>}
            </div>

            {/* Actions for Assignee */}
            {isAssignee && activity?.status === 'Pendente' && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                    <h4 className="font-semibold">Sua Ação é Necessária</h4>
                    <div className="space-y-2">
                        <Label htmlFor="dueDate">Defina o prazo para conclusão <span className="text-destructive">*</span></Label>
                        <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="justification">Justificativa (se recusar)</Label>
                        <Textarea id="justification" value={justification} onChange={(e) => setJustification(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="destructive" onClick={() => handleAction('reject')} disabled={isProcessing}><XCircle className="mr-2"/> Recusar</Button>
                        <Button variant="default" onClick={() => handleAction('accept')} disabled={isProcessing}><CheckCircle className="mr-2"/> Aceitar e Iniciar</Button>
                    </div>
                </div>
            )}
            {isAssignee && activity?.status === 'Em Andamento' && (
                 <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                    <h4 className="font-semibold">Acompanhamento da Execução</h4>
                    <div className="space-y-2">
                        <Label htmlFor="progressNote">Adicionar nota de progresso</Label>
                        <Textarea id="progressNote" value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder="Ex: Contatei o fornecedor X, aguardando resposta." />
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <Button variant="secondary" onClick={handleLogProgress} disabled={isProcessing || !progressNote}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MessageSquarePlus className="mr-2"/>}
                             Adicionar Progresso
                        </Button>
                        <Button className="" onClick={() => handleAction('complete')} disabled={isProcessing}>
                            <Milestone className="mr-2"/> Marcar como Concluída
                        </Button>
                    </div>
                </div>
            )}

             {/* Actions for Requester */}
            {isRequester && activity?.status === 'Aguardando Validação' && (
                 <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                    <h4 className="font-semibold">Validar Conclusão</h4>
                     <div className="space-y-2">
                        <Label htmlFor="justification">Observação (se for refazer)</Label>
                        <Textarea id="justification" value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Ex: Faltou anexar o relatório."/>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="secondary" onClick={() => handleAction('validate_nok')} disabled={isProcessing}><RefreshCcw className="mr-2"/> Refazer Atividade</Button>
                        <Button variant="default" onClick={() => handleAction('validate_ok')} disabled={isProcessing}><Check className="mr-2"/> Validar e Concluir</Button>
                    </div>
                 </div>
            )}

            <div>
                <h4 className="font-semibold mb-2">Histórico</h4>
                <ScrollArea className="h-40 border rounded-md p-2">
                    <div className="space-y-3">
                    {activity?.history?.slice().reverse().map((log, i) => (
                        <React.Fragment key={i}>
                            <div className="text-xs text-muted-foreground">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold">{log.userName}</span>
                                    <span className="text-muted-foreground/80">{format(new Date(log.timestamp), 'dd/MM HH:mm', { locale: ptBR })}</span>
                                </div>
                                <div className="flex items-start gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs whitespace-nowrap">{log.action}</Badge>
                                    <p className="flex-1 whitespace-pre-wrap">{log.details}</p>
                                </div>
                            </div>
                            {i < activity.history.length - 1 && <Separator />}
                        </React.Fragment>
                    ))}
                    </div>
                </ScrollArea>
            </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
