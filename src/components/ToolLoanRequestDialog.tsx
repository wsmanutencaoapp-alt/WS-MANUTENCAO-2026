'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Tool } from '@/lib/types';

interface ToolLoanRequestDialogProps {
    isOpen: boolean;
    onClose: () => void;
    allAvailableTools: Tool[];
    onActionSuccess: () => void;
}

// Placeholder component
export default function ToolLoanRequestDialog({ isOpen, onClose, allAvailableTools, onActionSuccess }: ToolLoanRequestDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar Empréstimo de Ferramenta</DialogTitle>
           <DialogDescription>
             Esta funcionalidade ainda será implementada.
           </DialogDescription>
        </DialogHeader>
        <div className="p-4 border rounded-lg bg-muted/20">
           <p className="text-sm text-muted-foreground">
            Aqui você poderá selecionar uma ou mais ferramentas disponíveis e criar uma requisição de empréstimo.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Ferramentas disponíveis: {allAvailableTools.length}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onActionSuccess}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
