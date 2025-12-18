'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Thermometer, History, PlusCircle, Loader2 } from 'lucide-react';
import { addDays, format, isBefore, isAfter } from 'date-fns';
import CalibrationDialog from '@/components/CalibrationDialog';
import HistoryDialog from '@/components/CalibrationHistoryDialog';
import type { WithDocId } from '@/firebase/firestore/use-collection';

const CalibracaoPage = () => {
  const firestore = useFirestore();
  const [selectedTool, setSelectedTool] = useState<WithDocId<Tool> | null>(null);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const controllableToolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'tools'),
      where('classificacao', 'in', ['C', 'L', 'V'])
    );
  }, [firestore]);

  const { data: tools, isLoading, error } = useCollection<Tool>(controllableToolsQuery);

  const getStatus = (dueDate: string | undefined): { text: string; variant: 'success' | 'warning' | 'destructive' } => {
    if (!dueDate) return { text: 'Sem data', variant: 'warning' };
    const today = new Date();
    const dueDateObj = new Date(dueDate);
    const thirtyDaysFromNow = addDays(today, 30);

    if (isBefore(dueDateObj, today)) {
      return { text: 'Vencido', variant: 'destructive' };
    }
    if (isBefore(dueDateObj, thirtyDaysFromNow)) {
      return { text: 'Vence em breve', variant: 'warning' };
    }
    return { text: 'Válido', variant: 'success' };
  };
  
  const getBadgeVariant = (variant: 'success' | 'warning' | 'destructive') => {
      switch(variant) {
          case 'success': return 'success';
          case 'warning': return 'default';
          case 'destructive': return 'destructive';
          default: return 'secondary';
      }
  }

  const handleOpenCalibration = (tool: WithDocId<Tool>) => {
    setSelectedTool(tool);
    setIsCalibrationOpen(true);
  };
  
  const handleOpenHistory = (tool: WithDocId<Tool>) => {
    setSelectedTool(tool);
    setIsHistoryOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center">
            <Thermometer className="mr-2"/>
            Controle de Calibração e Validade
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ferramentas Controladas</CardTitle>
          <CardDescription>
            Gerencie o ciclo de vida de calibração e validade das suas ferramentas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Foto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-destructive">
                        Erro ao carregar ferramentas: {error.message}
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && tools?.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center">
                       Nenhuma ferramenta com controle de validade encontrada.
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && tools?.map((tool) => {
                  const status = getStatus(tool.data_vencimento);
                  return (
                    <TableRow key={tool.docId}>
                        <TableCell className="hidden sm:table-cell">
                          <Image
                            alt={tool.descricao}
                            className="aspect-square rounded-md object-cover"
                            height="48"
                            src={tool.imageUrl || 'https://picsum.photos/seed/tool/48/48'}
                            width="48"
                          />
                        </TableCell>
                        <TableCell className="font-mono">{tool.codigo}</TableCell>
                        <TableCell>{tool.descricao}</TableCell>
                        <TableCell>{tool.data_vencimento ? format(new Date(tool.data_vencimento), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(status.variant)}>{status.text}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="mr-2" onClick={() => handleOpenCalibration(tool)}>
                                <PlusCircle className="mr-1 h-4 w-4" /> Registrar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenHistory(tool)}>
                                <History className="mr-1 h-4 w-4" /> Histórico
                            </Button>
                        </TableCell>
                    </TableRow>
                  )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {isCalibrationOpen && selectedTool && (
        <CalibrationDialog 
            isOpen={isCalibrationOpen}
            onClose={() => setIsCalibrationOpen(false)}
            tool={selectedTool}
        />
      )}
      
       {isHistoryOpen && selectedTool && (
        <HistoryDialog 
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            tool={selectedTool}
        />
      )}

    </div>
  );
};

export default CalibracaoPage;
