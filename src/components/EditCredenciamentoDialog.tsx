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
import { Textarea } from './ui/textarea';

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

  // Main form state
  const [matricula, setMatricula] = useState('');
  const [base, setBase] = useState('');
  const [cargo, setCargo] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [coleteNumero, setColeteNumero] = useState('');
  const [acesso, setAcesso] = useState('');
  
  // Dismissal dialog state
  const [isDismissalDialogOpen, setIsDismissalDialogOpen] = useState(false);
  const [dataDevolucao, setDataDevolucao] = useState('');
  const [motivoBaixa, setMotivoBaixa] = useState('');

  useEffect(() => {
    if (item && isOpen) {
      setBase(item.base || '');
      setDataVencimento(item.dataVencimento ? format(new Date(item.dataVencimento), 'yyyy-MM-dd') : '');

      if (itemType === 'employee') {
        const employeeItem = item as Employee;
        setMatricula(employeeItem.id ? String(employeeItem.id) : '');
        setCargo(employeeItem.cargo || '');
        setColeteNumero(employeeItem.coleteNumero || '');
        setAcesso(employeeItem.acesso || '');
      }
    }
  }, [item, isOpen, itemType]);

  const handleSave = async () => {
    if (!firestore || !item || !itemType) return;

    let vencimentoDate: Date | null = null;
    if (dataVencimento) {
        vencimentoDate = parse(dataVencimento, 'yyyy-MM-dd', new Date());
        if (!isValid(vencimentoDate)) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Formato de data de vencimento inválido. Use AAAA-MM-DD.' });
            return;
        }
    }

    setIsSaving(true);
    let dataToUpdate: Partial<Employee & Vehicle> = {
      base,
      dataVencimento: vencimentoDate ? vencimentoDate.toISOString() : undefined,
    };

    const collectionName = itemType === 'employee' ? 'employees' : 'vehicles';

    if (itemType === 'employee') {
      const numMatricula = Number(matricula);
      if (isNaN(numMatricula)) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Matrícula inválida. Deve ser um número.' });
          setIsSaving(false);
          return;
      }
      dataToUpdate = { ...dataToUpdate, id: numMatricula, cargo, coleteNumero, acesso };
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

  const handleOpenDismissalDialog = () => {
    setDataDevolucao(format(new Date(), 'yyyy-MM-dd')); // Pre-fill with today's date
    setMotivoBaixa(''); // Clear reason on open
    setIsDismissalDialogOpen(true);
  };

  const handleConfirmDismissal = async () => {
    if (!firestore || !item) return;
    if (!dataDevolucao) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A data de devolução é obrigatória.' });
        return;
    }
    const devDate = parse(dataDevolucao, 'yyyy-MM-dd', new Date());
    if (!isValid(devDate)) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Data de devolução inválida.' });
        return;
    }

    setIsSaving(true);
    try {
        const itemRef = doc(firestore, 'employees', item.docId);
        await updateDoc(itemRef, {
            status: 'Inativo',
            dataDevolucao: devDate.toISOString(),
            motivoBaixa: motivoBaixa,
        });
        toast({ title: 'Sucesso!', description: 'Baixa de funcionário registrada. O status foi alterado para Inativo.' });
        setIsDismissalDialogOpen(false);
        onSuccess(); // This will close the main dialog and refetch data.
    } catch (err) {
        console.error("Erro ao dar baixa no funcionário:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar a baixa.' });
    } finally {
        setIsSaving(false);
    }
};

  return (
    <>
    <Dialog open={isOpen && !isDismissalDialogOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Credenciamento</DialogTitle>
          <DialogDescription>
            Alterando dados para: <span className="font-bold">{getTitle()}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          
          {itemType === 'employee' && (
            <div className="space-y-1.5">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input id="matricula" value={matricula} onChange={e => setMatricula(e.target.value)} />
            </div>
          )}

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
            <Label htmlFor="dataVencimento">Vencimento da Credencial</Label>
            <Input id="dataVencimento" type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
          </div>

          {itemType === 'employee' && (
            <div className="space-y-1.5">
              <Label htmlFor="coleteNumero">Número do Colete</Label>
              <Input id="coleteNumero" value={coleteNumero} onChange={e => setColeteNumero(e.target.value)} placeholder="Ex: 0123" />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
            <div>
                {itemType === 'employee' && (
                    <Button variant="destructive" onClick={handleOpenDismissalDialog} disabled={isSaving}>
                        Baixa de Funcionário
                    </Button>
                )}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isDismissalDialogOpen} onOpenChange={setIsDismissalDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Baixa de Funcionário</DialogTitle>
                <DialogDescription>
                    Informe a data de devolução da credencial e um motivo (opcional) para alterar o status de {getTitle()} para "Inativo".
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="dataDevolucao">Data Devolução Credencial</Label>
                    <Input
                        id="dataDevolucao"
                        type="date"
                        value={dataDevolucao}
                        onChange={e => setDataDevolucao(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="motivoBaixa">Motivo / Observação</Label>
                    <Textarea 
                        id="motivoBaixa"
                        value={motivoBaixa}
                        onChange={e => setMotivoBaixa(e.target.value)}
                        placeholder="Descreva o motivo da baixa (opcional)"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDismissalDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleConfirmDismissal} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Baixa
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
