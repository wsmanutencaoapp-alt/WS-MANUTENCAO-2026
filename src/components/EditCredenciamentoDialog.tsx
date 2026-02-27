'use client';

import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Employee, Vehicle } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, CalendarIcon } from 'lucide-react';
import { parse, isValid, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditCredenciamentoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: WithDocId<Employee> | WithDocId<Vehicle> | null;
  itemType: 'employee' | 'vehicle' | null;
}

export default function EditCredenciamentoDialog({ isOpen, onClose, onSuccess, item, itemType }: EditCredenciamentoDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [base, setBase] = useState('');
  const [cargo, setCargo] = useState('');
  const [credencialVencimento, setCredencialVencimento] = useState('');
  const [coleteNumero, setColeteNumero] = useState('');
  const [acesso, setAcesso] = useState('');

  useEffect(() => {
    if (item && isOpen) {
      setBase(item.base || '');
      setCredencialVencimento(item.credencialVencimento ? format(new Date(item.credencialVencimento), 'yyyy-MM-dd') : '');

      if (itemType === 'employee') {
        const employeeItem = item as Employee;
        setCargo(employeeItem.cargo || '');
        setColeteNumero(employeeItem.coleteNumero || '');
        setAcesso(employeeItem.acesso || '');
      }
    }
  }, [item, isOpen, itemType]);

  const handleSave = async () => {
    if (!firestore || !item || !itemType) return;

    let vencimentoDate: Date | null = null;
    if (credencialVencimento) {
        vencimentoDate = parse(credencialVencimento, 'yyyy-MM-dd', new Date());
        if (!isValid(vencimentoDate)) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Formato de data de vencimento inválido. Use AAAA-MM-DD.' });
            return;
        }
    }

    setIsSaving(true);
    let dataToUpdate: Partial<Employee & Vehicle> = {
      base,
      credencialVencimento: vencimentoDate ? vencimentoDate.toISOString() : undefined,
    };

    const collectionName = itemType === 'employee' ? 'employees' : 'vehicles';

    if (itemType === 'employee') {
      dataToUpdate = { ...dataToUpdate, cargo, coleteNumero, acesso };
    }

    try {
      const itemRef = doc(firestore, collectionName, item.docId);
      await updateDoc(itemRef, dataToUpdate);
      toast({ title: 'Sucesso!', description: 'Dados de credenciamento atualizados.' });
      onSuccess();
    } catch (err) {
      console.error("Erro ao atualizar credenciamento:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar as alterações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getTitle = () => {
      if (!item) return '';
      if(itemType === 'employee') return `${(item as Employee).firstName} ${(item as Employee).lastName}`;
      return `${(item as Vehicle).prefixo} - ${(item as Vehicle).placa}`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Credenciamento</DialogTitle>
          <DialogDescription>
            Alterando dados para: <span className="font-bold">{getTitle()}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="base">Base / Localidade</Label>
            <Input id="base" value={base} onChange={e => setBase(e.target.value)} placeholder="Ex: SBEG, SBGR" />
          </div>

          {itemType === 'employee' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cargo">Cargo</Label>
                <Input id="cargo" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Mecânico de Manutenção" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acesso">Acesso (Controle Interno)</Label>
                <Input id="acesso" value={acesso} onChange={e => setAcesso(e.target.value)} placeholder="Ex: Nível 1, Geral, etc." />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="credencialVencimento">Vencimento da Credencial</Label>
            <Input id="credencialVencimento" type="date" value={credencialVencimento} onChange={e => setCredencialVencimento(e.target.value)} />
          </div>

          {itemType === 'employee' && (
            <div className="space-y-1.5">
              <Label htmlFor="coleteNumero">Número do Colete</Label>
              <Input id="coleteNumero" value={coleteNumero} onChange={e => setColeteNumero(e.target.value)} placeholder="Ex: 0123" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
