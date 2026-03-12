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
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2 } from 'lucide-react';
import { parse, isValid, format } from 'date-fns';

interface EditFuncionarioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee: WithDocId<Employee> | null;
}

export default function EditFuncionarioDialog({ isOpen, onClose, onSuccess, employee }: EditFuncionarioDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      birthDate: '',
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        birthDate: employee.birthDate ? format(new Date(employee.birthDate), 'yyyy-MM-dd') : '',
      });
    }
  }, [employee]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleSave = async () => {
    if (!firestore || !employee) return;

    let birthDateISO: string | undefined = undefined;
    if (formData.birthDate) {
        const parsedDate = parse(formData.birthDate, 'yyyy-MM-dd', new Date());
        if (!isValid(parsedDate)) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Data de nascimento inválida.' });
            return;
        }
        birthDateISO = parsedDate.toISOString();
    }

    setIsSaving(true);
    try {
      const employeeRef = doc(firestore, 'employees', employee.docId);
      await updateDoc(employeeRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthDate: birthDateISO,
      });
      toast({ title: 'Sucesso!', description: 'Dados do funcionário atualizados.' });
      onSuccess();
    } catch (err) {
      console.error("Erro ao atualizar funcionário:", err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as alterações.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Funcionário</DialogTitle>
          <DialogDescription>
            Alterando dados de {employee.firstName} {employee.lastName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" value={formData.firstName} onChange={handleInputChange} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input id="lastName" value={formData.lastName} onChange={handleInputChange} />
            </div>
          </div>
           <div className="space-y-1">
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input id="birthDate" type="date" value={formData.birthDate} onChange={handleInputChange} />
            </div>
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

    