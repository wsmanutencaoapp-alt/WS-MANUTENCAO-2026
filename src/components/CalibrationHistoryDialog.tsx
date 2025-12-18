
'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { Tool, CalibrationRecord } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

interface HistoryDialogProps {
  tool: WithDocId<Tool>;
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryDialog({ tool, isOpen, onClose }: HistoryDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const historyQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'tools', tool.docId, 'calibration_history'), 
        orderBy('timestamp', 'desc')
    );
  }, [firestore, tool.docId]);

  const { data: history, isLoading, error } = useCollection<CalibrationRecord>(historyQuery, {
      queryKey: ['calibrationHistory', tool.docId]
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-destructive">
                    Erro ao carregar histórico: {error.message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && history?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
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
  );
}
