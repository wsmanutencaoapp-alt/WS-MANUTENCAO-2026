'use client';

import { useState, useMemo, useRef } from 'react';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { addMonths, parse, isValid } from 'date-fns';
import type { Employee, Training, EmployeeTraining } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

interface AddTrainingRecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee: WithDocId<Employee>;
}

export default function AddTrainingRecordDialog({ isOpen, onClose, onSuccess, employee }: AddTrainingRecordDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedTrainingId, setSelectedTrainingId] = useState('');
  const [completionDate, setCompletionDate] = useState<string>(''); // yyyy-MM-dd format
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  const trainingsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'trainings')) : null), [firestore]);
  const { data: allTrainings, isLoading: isLoadingTrainings } = useCollection<WithDocId<Training>>(trainingsQuery, {
      queryKey: ['allTrainingsForSelection'],
      enabled: isOpen,
  });

  const resetForm = () => {
    setSelectedTrainingId('');
    setCompletionDate('');
    setCertificateFile(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleClose = () => {
      resetForm();
      onClose();
  }

  const handleSave = async () => {
    if (!firestore || !storage) return;
    if (!selectedTrainingId || !completionDate) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Treinamento e data de conclusão são obrigatórios.' });
      return;
    }

    const selectedTraining = allTrainings?.find(t => t.docId === selectedTrainingId);
    if (!selectedTraining) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Treinamento selecionado não encontrado.' });
      return;
    }

    const completionDateObj = parse(completionDate, 'yyyy-MM-dd', new Date());
    if (!isValid(completionDateObj)) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Data de conclusão inválida.' });
      return;
    }

    setIsSaving(true);
    try {
      let certificateUrl = '';
      if (certificateFile) {
        const certRef = storageRef(storage, `training_certificates/${employee.docId}/${selectedTrainingId}-${Date.now()}`);
        await uploadBytes(certRef, certificateFile);
        certificateUrl = await getDownloadURL(certRef);
      }
      
      const expiryDate = addMonths(completionDateObj, selectedTraining.validityPeriod);
      
      const newRecord: Omit<EmployeeTraining, 'id'> = {
          employeeId: employee.docId,
          trainingId: selectedTraining.docId,
          trainingName: selectedTraining.name,
          completionDate: completionDateObj.toISOString(),
          expiryDate: expiryDate.toISOString(),
          certificateUrl: certificateUrl || undefined,
      };

      const employeeTrainingsRef = collection(firestore, 'employees', employee.docId, 'trainings');
      await addDoc(employeeTrainingsRef, newRecord);
      
      toast({ title: "Sucesso!", description: "Treinamento registrado para o funcionário." });
      onSuccess();

    } catch (err) {
      console.error("Erro ao adicionar treinamento:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar o registro.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} modal={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Registro de Treinamento</DialogTitle>
          <DialogDescription>
            Selecione o treinamento e a data de conclusão para {employee.firstName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="training">Treinamento</Label>
            <Select value={selectedTrainingId} onValueChange={setSelectedTrainingId} disabled={isLoadingTrainings}>
                <SelectTrigger id="training">
                    <SelectValue placeholder={isLoadingTrainings ? "Carregando..." : "Selecione um treinamento"} />
                </SelectTrigger>
                <SelectContent>
                    {allTrainings?.map(t => (
                        <SelectItem key={t.docId} value={t.docId}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="completionDate">Data de Conclusão</Label>
            <Input
              id="completionDate"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Certificado (Opcional)</Label>
            <Button asChild variant="outline" className="w-full">
                <label className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    {certificateFile ? <span className="truncate max-w-xs">{certificateFile.name}</span> : 'Anexar arquivo'}
                    <Input type="file" className="sr-only" ref={fileInputRef} onChange={(e) => setCertificateFile(e.target.files?.[0] || null)} />
                </label>
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedTrainingId || !completionDate}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
