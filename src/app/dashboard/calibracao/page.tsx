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
import { Thermometer, History, PlusCircle, Loader2, Search } from 'lucide-react';
import { addDays, format, isBefore, differenceInDays } from 'date-fns';
import CalibrationDialog from '@/components/CalibrationDialog';
import HistoryDialog from '@/components/CalibrationHistoryDialog';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CalibracaoPage = () => {
  const firestore = useFirestore();
  const [selectedTool, setSelectedTool] = useState<WithDocId<Tool> | null>(null);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [classificacaoFilter, setClassificacaoFilter] = useState('todos');

  const controllableToolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'tools'),
      where('classificacao', 'in', ['C', 'L', 'V'])
    );
  }, [firestore]);

  const { data: tools, isLoading, error } = useCollection<Tool>(controllableToolsQuery, {
      queryKey: ['controllableTools']
  });

  const filteredTools = useMemo(() => {
    if (!tools) return [];
    
    let tempTools = tools;

    if (classificacaoFilter !== 'todos') {
        tempTools = tempTools.filter(tool => tool.classificacao === classificacaoFilter);
    }
    
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        tempTools = tempTools.filter(tool => 
            tool.codigo.toLowerCase().includes(lowercasedTerm) ||
            tool.descricao.toLowerCase().includes(lowercasedTerm)
        );
    }

    return tempTools;
  }, [tools, searchTerm, classificacaoFilter]);


  const getStatus = (dueDate: string | undefined): { text: string; variant: 'success' | 'warning' | 'destructive' | 'attention' | 'critical' } => {
    if (!dueDate) return { text: 'Sem data', variant: 'warning' };

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignore time part
    const dueDateObj = new Date(dueDate);
    
    const daysUntilDue = differenceInDays(dueDateObj, today);

    if (daysUntilDue < 0) {
      return { text: 'Vencido', variant: 'destructive' };
    }
    if (daysUntilDue <= 5) {
      return { text: `Vence em ${daysUntilDue + 1} dia(s)`, variant: 'critical' };
    }
    if (daysUntilDue <= 15) {
      return { text: `Vence em ${daysUntilDue + 1} dias`, variant: 'warning' };
    }
     if (daysUntilDue <= 30) {
      return { text: 'Vence em breve', variant: 'attention' };
    }
    return { text: 'Válido', variant: 'success' };
  };
  
  const getBadgeVariant = (variant: 'success' | 'warning' | 'destructive' | 'attention' | 'critical') => {
      switch(variant) {
          case 'success': return 'success';
          case 'attention': return 'secondary'; // Amarelo/Padrão
          case 'warning': return 'default'; // Laranja/Primário
          case 'critical': return 'destructive'; // Vermelho
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
           <div className="flex items-center gap-4 pt-4">
               <div className="relative">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input
                     placeholder="Pesquisar por código ou descrição..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                 />
              </div>
              <Select value={classificacaoFilter} onValueChange={setClassificacaoFilter}>
                  <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="todos">Todos os Tipos</SelectItem>
                      <SelectItem value="C">Calibrável (C)</SelectItem>
                      <SelectItem value="L">Teste de Carga (L)</SelectItem>
                      <SelectItem value="V">Vencimento (V)</SelectItem>
                  </SelectContent>
              </Select>
            </div>
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
              {!isLoading && filteredTools.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center">
                       Nenhuma ferramenta com controle de validade encontrada.
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredTools.map((tool) => {
                  const status = getStatus(tool.data_vencimento);
                  const displayStatus = status.text;
                  
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
                          <Badge variant={getBadgeVariant(status.variant)}>{displayStatus}</Badge>
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
