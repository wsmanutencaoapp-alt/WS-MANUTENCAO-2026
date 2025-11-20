'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';

// Placeholder component
export default function LabelConfirmationDialog({ tool, isOpen, onConfirm, onCancel }: { tool: any, isOpen: boolean, onConfirm: () => void, onCancel: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Impressão de Etiqueta</DialogTitle>
                <DialogDescription>
                    O equipamento foi cadastrado. Deseja imprimir a etiqueta agora?
                </DialogDescription>
            </DialogHeader>
             <div className="p-4 border rounded-md">
                <p><strong>Código:</strong> {tool?.codigo}</p>
                <p><strong>Nome:</strong> {tool?.name}</p>
             </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={onConfirm}>Imprimir e Finalizar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
