'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { Employee, EmployeeTraining } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, PlusCircle, Trash2, ExternalLink } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import AddTrainingRecordDialog from './AddTrainingRecordDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


interface EmployeeTrainingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: WithDocId<Employee> | null;
}

const getTrainingStatus = (expiryDate: string): { text: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(expiryDate);
    const daysUntilDue = differenceInDays(date, today);

    if (daysUntilDue < 0) return { text: 'Vencido', variant: 'destructive' };
    if (daysUntilDue <= 30) return { text: `Vence em ${daysUntilDue + 1} dias`, variant: 'warning' };
    return { text: 'Válido', variant: 'success' };
};

export default function EmployeeTrainingsDialog({ isOpen, onClose, employee }: EmployeeTrainingsDialogProps) {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const trainingsQueryKey = ['employeeTrainings', employee?.docId];
  const trainingsQuery = useMemoFirebase(() => {
    if (!firestore || !employee) return null;
    return query(collection(firestore, 'employees', employee.docId, 'trainings'), orderBy('completionDate', 'desc'));
  }, [firestore, employee]);

  const { data: trainings, isLoading, error } = useCollection<WithDocId<EmployeeTraining>>(trainingsQuery, {
      queryKey: trainingsQueryKey,
      enabled: isOpen && !!employee,
  });

  const handleAddSuccess = () => {
    queryClient.invalidateQueries({ queryKey: trainingsQueryKey });
    setIsAddDialogOpen(false);
  };
  
  const handleDelete = async (trainingRecordId: string) => {
    if (!firestore || !employee) return;
    setIsDeleting(trainingRecordId);
    try {
        const recordRef = doc(firestore, 'employees', employee.docId, 'trainings', trainingRecordId);
        await deleteDoc(recordRef);
        toast({ title: "Sucesso", description: "Registro de treinamento excluído." });
        queryClient.invalidateQueries({ queryKey: trainingsQueryKey });
    } catch(err) {
        console.error("Erro ao excluir treinamento:", err);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o registro.' });
    } finally {
        setIsDeleting(null);
    }
  }

  return (
    <>
      <Dialog open={isOpen && !isAddDialogOpen} onOpenChange={onClose} modal={false}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Treinamentos</DialogTitle>
            <DialogDescription>
              Visualize e adicione registros de treinamento para <span className="font-bold">{employee?.firstName} {employee?.lastName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="flex justify-end">
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Treinamento
                </Button>
            </div>
            {isLoading && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {error && <p className="text-destructive text-center">Erro ao carregar treinamentos.</p>}
            {!isLoading && (!trainings || trainings.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum treinamento registrado para este funcionário.</p>
            )}
            <div className="space-y-3">
                {trainings?.map(training => {
                    const status = getTrainingStatus(training.expiryDate);
                    return (
                        <div key={training.docId} className="flex items-center gap-4 rounded-md border p-3">
                            <div className="flex-1">
                                <p className="font-bold">{training.trainingName}</p>
                                <p className="text-sm text-muted-foreground">
                                    Concluído em: {format(new Date(training.completionDate), 'dd/MM/yyyy')} | 
                                    Vence em: {format(new Date(training.expiryDate), 'dd/MM/yyyy')}
                                </p>
                                <Badge variant={status.variant} className="mt-1">{status.text}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                {training.certificateUrl && (
                                    <Button asChild variant="ghost" size="icon">
                                        <a href={training.certificateUrl} target="_blank" rel="noopener noreferrer" title="Ver Certificado">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isDeleting === training.docId}>
                                            {isDeleting === training.docId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Tem certeza que deseja excluir o registro do treinamento <span className="font-bold">{training.trainingName}</span>?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(training.docId)}>Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {employee && (
          <AddTrainingRecordDialog
            isOpen={isAddDialogOpen}
            onClose={() => setIsAddDialogOpen(false)}
            onSuccess={handleAddSuccess}
            employee={employee}
          />
      )}
    </>
  );
}
