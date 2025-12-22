'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, AlertTriangle, Settings, Trash2, Wrench, CheckCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';

interface ManageNonConformingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tool: WithDocId<Tool>;
  onActionSuccess: () => void;
}

type Action = 'conditional_release' | 'send_to_maintenance' | 'discard' | 'repair_complete';

export default function ManageNonConformingDialog({ isOpen, onClose, tool, onActionSuccess }: ManageNonConformingDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [conditionalNote, setConditionalNote] = useState('');
  const [discardReason, setDiscardReason] = useState(tool.observacao || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedAction(null);
      setConditionalNote('');
      setDiscardReason(tool.observacao || '');
    }
  }, [isOpen, tool]);

  const handleSave = async () => {
    if (!firestore || !selectedAction) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma ação selecionada.' });
      return;
    }
    
    if (selectedAction === 'conditional_release' && !conditionalNote) {
         toast({ variant: 'destructive', title: 'Erro', description: 'A condição para liberação é obrigatória.' });
         return;
    }
    if (selectedAction === 'discard' && !discardReason) {
         toast({ variant: 'destructive', title: 'Erro', description: 'O motivo do descarte é obrigatório.' });
         return;
    }

    setIsSaving(true);
    const toolRef = doc(firestore, 'tools', tool.docId);
    let dataToUpdate: Partial<Tool> = {};

    try {
        switch(selectedAction) {
            case 'conditional_release':
                dataToUpdate = { status: 'Liberado Condicional', observacao_condicional: conditionalNote };
                break;
            case 'send_to_maintenance':
                dataToUpdate = { status: 'Em Manutenção' };
                break;
            case 'discard':
                dataToUpdate = { status: 'Refugo', motivo_descarte: discardReason, data_descarte: new Date().toISOString() };
                break;
            case 'repair_complete':
                dataToUpdate = { status: 'Disponível', observacao: '', observacao_condicional: '' }; // Clear notes
                break;
        }

        await updateDoc(toolRef, dataToUpdate);
        onActionSuccess();
        
    } catch(err) {
        console.error("Erro ao gerenciar não conformidade: ", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível atualizar o status da ferramenta.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const isInitialEvaluation = tool.status === 'Com Avaria';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Ferramenta Não Conforme</DialogTitle>
          <DialogDescription>
            Decida o próximo passo para <span className="font-bold">{tool.codigo}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
            <div className="p-3 rounded-md bg-muted/50 border">
                <p className="text-sm font-semibold">{tool.descricao}</p>
                <p className="text-xs text-muted-foreground">Status Atual: <span className="font-medium">{tool.status}</span></p>
                {tool.observacao && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Motivo da Avaria: {tool.observacao}</p>}
            </div>
        
            <RadioGroup onValueChange={(value) => setSelectedAction(value as Action)} value={selectedAction || ''}>
                <p className="font-medium text-sm mb-2">Ações Disponíveis:</p>
                {isInitialEvaluation ? (
                    <>
                       <div className="flex items-center space-x-2">
                           <RadioGroupItem value="conditional_release" id="conditional_release" />
                           <Label htmlFor="conditional_release" className="font-normal flex items-center gap-2"><AlertTriangle className="text-orange-500"/> Liberar com Desvio (Condicional)</Label>
                       </div>
                       <div className="flex items-center space-x-2">
                           <RadioGroupItem value="send_to_maintenance" id="send_to_maintenance" />
                           <Label htmlFor="send_to_maintenance" className="font-normal flex items-center gap-2"><Wrench className="text-blue-600"/> Enviar para Manutenção</Label>
                       </div>
                       <div className="flex items-center space-x-2">
                           <RadioGroupItem value="discard" id="discard" />
                           <Label htmlFor="discard" className="font-normal flex items-center gap-2"><Trash2 className="text-destructive"/> Descartar Ferramenta</Label>
                       </div>
                     </>
                ) : ( // Actions for tools "Em Manutenção" or "Em Conserto"
                     <>
                        <div className="flex items-center space-x-2">
                           <RadioGroupItem value="repair_complete" id="repair_complete" />
                           <Label htmlFor="repair_complete" className="font-normal flex items-center gap-2"><CheckCircle className="text-green-600"/> Manutenção Concluída (Disponível)</Label>
                       </div>
                        <div className="flex items-center space-x-2">
                           <RadioGroupItem value="discard" id="discard_from_maint" />
                           <Label htmlFor="discard_from_maint" className="font-normal flex items-center gap-2"><Trash2 className="text-destructive"/> Descartar Ferramenta</Label>
                       </div>
                    </>
                )}

            </RadioGroup>

            {selectedAction === 'conditional_release' && (
                <div className="pt-2 space-y-1 animate-in fade-in-50">
                    <Label htmlFor="conditional_note">Condição de Liberação <span className="text-destructive">*</span></Label>
                    <Textarea id="conditional_note" value={conditionalNote} onChange={(e) => setConditionalNote(e.target.value)} placeholder="Ex: Usar apenas para torques abaixo de 50 Nm."/>
                </div>
            )}
             {selectedAction === 'discard' && (
                <div className="pt-2 space-y-1 animate-in fade-in-50">
                    <Label htmlFor="discard_reason">Motivo do Descarte <span className="text-destructive">*</span></Label>
                    <Textarea id="discard_reason" value={discardReason} onChange={(e) => setDiscardReason(e.target.value)} placeholder="Descreva por que a ferramenta está sendo descartada."/>
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedAction || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
