'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';

interface EditCalibrationDialogProps {
  tool: WithDocId<Tool>;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditCalibrationDialog({ tool, isOpen, onClose }: EditCalibrationDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isSaving, setIsSaving] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [referenceDate, setReferenceDate] = useState<Date | undefined>();
  const [isRefDateOpen, setIsRefDateOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);

  useEffect(() => {
    if (tool) {
        setNewDueDate(tool.data_vencimento ? new Date(tool.data_vencimento) : undefined);
        setReferenceDate(tool.data_referencia ? new Date(tool.data_referencia) : undefined);
    }
  }, [tool]);

  const handleSave = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
      return;
    }
    if (!newDueDate || !referenceDate) {
      toast({ variant: 'destructive', title: 'Erro', description: 'As datas de referência e vencimento são obrigatórias.' });
      return;
    }

    setIsSaving(true);
    try {
      const toolRef = doc(firestore, 'tools', tool.docId);
      await updateDoc(toolRef, {
        data_referencia: referenceDate.toISOString(),
        data_vencimento: newDueDate.toISOString(),
      });

      toast({ title: 'Sucesso!', description: `Datas de calibração da ferramenta ${tool.codigo} atualizadas.` });
      
      queryClient.invalidateQueries({ queryKey: ['controllableTools'] });
      onClose();

    } catch (error: any) {
      console.error('Erro ao editar datas de calibração:', error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Datas de Controle</DialogTitle>
          <DialogDescription>
            Ajuste rápido para a ferramenta <span className="font-bold">{tool.codigo}</span>. Esta ação não cria um registro no histórico.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Collapsible open={isRefDateOpen} onOpenChange={setIsRefDateOpen}>
              <div className="space-y-2">
                <Label>Data de Referência</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {referenceDate ? format(referenceDate, 'PPP') : <span>Escolha uma data</span>}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <Calendar
                    mode="single"
                    selected={referenceDate}
                    onSelect={(day) => { setReferenceDate(day); setIsRefDateOpen(false); }}
                    initialFocus
                  />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible open={isDueDateOpen} onOpenChange={setIsDueDateOpen}>
              <div className="space-y-2">
                <Label>Nova Data de Vencimento</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDueDate ? format(newDueDate, 'PPP') : <span>Escolha uma data</span>}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <Calendar
                    mode="single"
                    selected={newDueDate}
                    onSelect={(day) => { setNewDueDate(day); setIsDueDateOpen(false); }}
                    initialFocus
                  />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Datas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
