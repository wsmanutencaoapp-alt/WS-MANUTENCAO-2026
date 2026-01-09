'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { doc, writeBatch, collection, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, Undo } from 'lucide-react';
import type { Supply, SupplyStock, SupplyMovement } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

type EnrichedStockItem = WithDocId<SupplyStock> & {
    supplyInfo: WithDocId<Supply>;
};

interface ReturnMovementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: EnrichedStockItem | null;
  onSuccess: () => void;
}

export default function ReturnMovementDialog({ isOpen, onClose, stockItem, onSuccess }: ReturnMovementDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState('');
  const [origin, setOrigin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity('');
      setOrigin('');
    }
  }, [isOpen]);

  const handleReturn = async () => {
    if (!firestore || !user || !stockItem) return;
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A quantidade de devolução é inválida.' });
      return;
    }
     if (!origin) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A origem da devolução é obrigatória.' });
      return;
    }

    setIsSaving(true);
    try {
      const stockRef = doc(firestore, 'supplies', stockItem.supplyInfo.docId, 'stock', stockItem.docId);
      
      await runTransaction(firestore, async (transaction) => {
          const stockDoc = await transaction.get(stockRef);
          if (!stockDoc.exists()) {
              throw new Error("O lote de estoque original não foi encontrado.");
          }
          const currentQuantity = stockDoc.data().quantidade;
          const newQuantity = currentQuantity + numQuantity;
          transaction.update(stockRef, { quantidade: newQuantity });
          
          const newMovementData: Omit<SupplyMovement, 'id'> = {
            supplyId: stockItem.supplyInfo.docId,
            supplyStockId: stockItem.docId,
            supplyCodigo: stockItem.supplyInfo.codigo,
            type: 'devolucao',
            quantity: numQuantity,
            responsibleId: user.uid,
            responsibleName: user.displayName || user.email || 'Desconhecido',
            date: new Date().toISOString(),
            origin: origin,
          };
          
          const newMovementRef = doc(collection(firestore, 'supply_movements'));
          transaction.set(newMovementRef, newMovementData);
      });

      toast({ title: "Sucesso!", description: "Devolução registrada com sucesso." });
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error("Erro ao registrar devolução:", error);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!stockItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver Material ao Estoque</DialogTitle>
          <DialogDescription>
            Registrando a devolução de itens não utilizados para o lote <span className="font-bold">{stockItem.loteInterno}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-md bg-muted/50 border">
              <p className="text-sm font-semibold">{stockItem.supplyInfo?.descricao}</p>
              <p className="text-xs text-muted-foreground font-mono">{stockItem.supplyInfo?.codigo}</p>
              <p className="text-xs text-muted-foreground">Qtd. Atual: {stockItem.quantidade}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantidade a Devolver</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="origin">Origem da Devolução (Ex: Devolução OS)</Label>
            <Input
              id="origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Ex: Devolução OS-12345"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleReturn} disabled={isSaving || !quantity || !origin}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Undo className="mr-2 h-4 w-4" />
            Confirmar Devolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
