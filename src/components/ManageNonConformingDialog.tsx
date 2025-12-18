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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

type Destination = 'conditional_release' | 'maintenance' | 'discard';

interface ManageNonConformingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tool: WithDocId<Tool> | null;
  onSuccess: () => void;
}

export default function ManageNonConformingDialog({ isOpen, onClose, tool, onSuccess }: ManageNonConformingDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [condition, setCondition] = useState('');
  const [discardReason, setDiscardReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDestination(null);
      setCondition('');
      setDiscardReason('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!firestore || !tool || !destination) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Seleção inválida.' });
      return;
    }

    if (destination === 'conditional_release' && !condition) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A condição é obrigatória para liberação condicional.' });
      return;
    }
    if (destination === 'discard' && !discardReason) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O motivo do descarte é obrigatório.' });
      return;
    }

    setIsSaving(true);
    const toolRef = doc(firestore, 'tools', tool.docId);

    try {
      let dataToUpdate: Partial<Tool> = {};
      let successMessage = '';

      switch (destination) {
        case 'conditional_release':
          dataToUpdate = { 
            status: 'Liberado Condicional',
            observacao_condicional: condition,
            observacao: '' // Clear previous observation
          };
          successMessage = 'Ferramenta liberada com condição.';
          break;
        case 'maintenance':
          dataToUpdate = { status: 'Em Manutenção' };
          successMessage = 'Ferramenta encaminhada para manutenção.';
          break;
        case 'discard':
          dataToUpdate = { 
            status: 'Refugo',
            motivo_descarte: discardReason,
            data_descarte: new Date().toISOString()
           };
          successMessage = 'Ferramenta marcada como refugo/descartada.';
          break;
      }
      
      await updateDoc(toolRef, dataToUpdate);

      toast({ title: 'Sucesso!', description: successMessage });
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao gerenciar ferramenta:', error);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Ferramenta Não Conforme</DialogTitle>
          <DialogDescription>
            Defina o próximo passo para <span className="font-bold">{tool?.codigo}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
            <div className='p-2 border rounded-md bg-muted/30'>
                <p className="text-sm font-semibold">{tool?.descricao}</p>
                <p className="text-sm text-muted-foreground">Status atual: <span className='font-medium text-foreground'>{tool?.status}</span></p>
                {tool?.observacao && <p className="text-sm text-destructive mt-1">Obs: {tool.observacao}</p>}
            </div>

            <div>
                <Label className='font-semibold'>Escolha o Destino</Label>
                <RadioGroup value={destination || ''} onValueChange={(value) => setDestination(value as Destination)} className="mt-2 space-y-1">
                    <Alert className='data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary'>
                        <RadioGroupItem value="conditional_release" id="conditional_release" />
                        <Label htmlFor="conditional_release" className="ml-2 font-semibold">Liberar Condicional</Label>
                        <AlertDescription className="text-xs ml-8 text-muted-foreground">
                            A ferramenta volta ao inventário com um alerta laranja e uma observação de condição.
                        </AlertDescription>
                    </Alert>
                    <Alert className='data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary'>
                        <RadioGroupItem value="maintenance" id="maintenance" />
                        <Label htmlFor="maintenance" className="ml-2 font-semibold">Realizar Manutenção</Label>
                         <AlertDescription className="text-xs ml-8 text-muted-foreground">
                            Mantém a ferramenta como "Em Manutenção" para acompanhamento.
                        </AlertDescription>
                    </Alert>
                     <Alert className='data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary'>
                        <RadioGroupItem value="discard" id="discard" />
                        <Label htmlFor="discard" className="ml-2 font-semibold">Descartar (Refugo)</Label>
                         <AlertDescription className="text-xs ml-8 text-muted-foreground">
                           Muda o status para "Refugo" e remove a ferramenta das listas ativas.
                        </AlertDescription>
                    </Alert>
                </RadioGroup>
            </div>

            {destination === 'conditional_release' && (
                <div className="space-y-2 animate-in fade-in-50">
                    <Label htmlFor="condition">Condição para Liberação <span className='text-destructive'>*</span></Label>
                    <Textarea 
                        id="condition"
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        placeholder="Ex: Usar apenas para torques abaixo de 50Nm."
                    />
                </div>
            )}
             {destination === 'discard' && (
                <div className="space-y-2 animate-in fade-in-50">
                    <Label htmlFor="discardReason">Motivo do Descarte <span className='text-destructive'>*</span></Label>
                    <Textarea 
                        id="discardReason"
                        value={discardReason}
                        onChange={(e) => setDiscardReason(e.target.value)}
                        placeholder="Ex: Quebra irreparável da carcaça."
                    />
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !destination}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Destino
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
