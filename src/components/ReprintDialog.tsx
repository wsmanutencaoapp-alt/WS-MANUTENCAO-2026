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

interface ReprintDialogProps {
  tool: { id: string; codigo?: string; nome?: string; label_url?: string | null } | null;
  isOpen: boolean;
  onClose: () => void;
  onReprintConfirmed: (tool: any) => void;
}


export default function ReprintDialog({ tool, isOpen, onClose, onReprintConfirmed }: ReprintDialogProps) {

  const handleConfirm = () => {
    if (tool) {
        onReprintConfirmed([tool]); // Pass as an array to match PrintDialog's expectation
    }
  }
  return (
     <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reimprimir Etiqueta</DialogTitle>
                 <DialogDescription>
                    Deseja gerar e imprimir novamente a etiqueta para o item abaixo? Uma nova etiqueta será gerada.
                </DialogDescription>
            </DialogHeader>
            {tool && (
                <div className="p-4 border rounded-md bg-muted/50">
                    <p><strong>Código:</strong> {tool.codigo}</p>
                    <p><strong>Nome:</strong> {tool.nome}</p>
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
