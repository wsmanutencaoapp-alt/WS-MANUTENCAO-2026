'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import type { Tool, Kit } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';


interface ReprintDialogProps {
  tool: WithDocId<Tool | Kit> | null;
  isOpen: boolean;
  onClose: () => void;
  onReprintConfirmed: (tools: WithDocId<Tool | Kit>[]) => void;
}


export default function ReprintDialog({ tool, isOpen, onClose, onReprintConfirmed }: ReprintDialogProps) {

  const handleConfirm = () => {
    if (tool) {
        onReprintConfirmed([tool]); // Pass the whole tool/kit object in an array
    }
  }
  return (
     <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reimprimir Etiqueta</DialogTitle>
                 <DialogDescription>
                    Deseja gerar e imprimir novamente a etiqueta para o item abaixo? Uma nova etiqueta será gerada com os dados atuais.
                </DialogDescription>
            </DialogHeader>
            {tool && (
                <div className="p-4 border rounded-md bg-muted/50">
                    <p><strong>Código:</strong> {tool.codigo}</p>
                    <p><strong>Descrição:</strong> {tool.descricao}</p>
                </div>
            )}
            <DialogFooter>
                 <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleConfirm}>Confirmar Reimpressão</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
