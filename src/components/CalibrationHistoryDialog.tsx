
'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Tool, CalibrationRecord } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import EditHistoryRecordDialog from './EditHistoryRecordDialog';

interface HistoryDialogProps {
  tool: WithDocId<Tool>;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

type CalibrationRecordWithDocId = WithDocId<CalibrationRecord>;

export default function HistoryDialog({ tool, isOpen, onClose, isAdmin }: HistoryDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [recordToEdit, setRecordToEdit] = useState<CalibrationRecordWithDocId | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const historyQueryKey = ['calibrationHistory', tool.docId];
  const historyQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'tools', tool.docId, 'calibration_history'), 
        orderBy('timestamp', 'desc')
    );
  }, [firestore, tool.docId]);

  const { data: history, isLoading, error } = useCollection<CalibrationRecordWithDocId>(historyQuery, {
      queryKey: historyQueryKey
  });

  const handleDelete = async (record: CalibrationRecordWithDocId) => {
    if (!firestore || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
        return;
    }
    setIsDeleting(record.docId);
    try {
        // 1. Delete Firestore document
        const recordRef = doc(firestore, 'tools', tool.docId, 'calibration_history', record.docId);
        await deleteDoc(recordRef);

        // 2. Delete certificate from Storage
        if (record.certificateUrl) {
            try {
                const certFileRef = storageRef(storage, record.certificateUrl);
                await deleteObject(certFileRef);
            } catch (storageError: any) {
                // If the file doesn't exist, we don't need to throw an error, just warn.
                if (storageError.code !== 'storage/object-not-found') {
                    throw storageError; // Re-throw other storage errors
                }
                console.warn(`Certificate file not found for deletion: ${record.certificateUrl}`);
            }
        }

        toast({ title: 'Sucesso', description: 'Registro do histórico excluído.' });
        queryClient.invalidateQueries({ queryKey: historyQueryKey });

    } catch (err: any) {
        console.error("Erro ao excluir registro:", err);
        toast({ variant: 'destructive', title: 'Erro na Exclusão', description: err.message });
    } finally {
        setIsDeleting(null);
    }
  }
  
  const handleEditSuccess = () => {
    setRecordToEdit(null); // Close the edit dialog
    queryClient.invalidateQueries({ queryKey: historyQueryKey }); // Refetch history
  }

  return (
    <>
      <Dialog open={isOpen && !recordToEdit} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de Calibração</DialogTitle>
            <DialogDescription>
              Exibindo todos os registros para a ferramenta <span className="font-bold">{tool.codigo}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Calib.</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center">Certificado</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-destructive">
                      Erro ao carregar histórico: {error.message}
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && history?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center">
                      Nenhum registro de calibração encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && history?.map((record) => (
                  <TableRow key={record.docId}>
                    <TableCell>{format(new Date(record.calibrationDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(record.dueDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{record.calibratedBy}</TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="outline" size="icon">
                        <a href={record.certificateUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Ver Certificado</span>
                        </a>
                      </Button>
                    </TableCell>
                    {isAdmin && (
                        <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => setRecordToEdit(record)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isDeleting === record.docId}>
                                      {isDeleting === record.docId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem certeza que deseja excluir este registro do histórico? O certificado associado também será removido.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(record)}>
                                        Sim, Excluir
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {recordToEdit && (
        <EditHistoryRecordDialog
            isOpen={!!recordToEdit}
            onClose={() => setRecordToEdit(null)}
            tool={tool}
            record={recordToEdit}
            onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
