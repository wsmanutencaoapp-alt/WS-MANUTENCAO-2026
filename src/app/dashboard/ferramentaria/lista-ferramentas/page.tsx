'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Repeat2, MoreHorizontal, ZoomIn, Search, PlusSquare, PackagePlus, Box, AlertTriangle, AlertCircle } from 'lucide-react';
import LabelPrintDialog from '@/components/LabelPrintDialog';
import type { Tool, Kit } from '@/lib/types';
import Image from 'next/image';
import ToolDetailsDialog from '@/components/ToolDetailsDialog';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import ReprintDialog from '@/components/ReprintDialog';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import KitDetailsDialog from '@/components/KitDetailsDialog';
import { ToolingAlertHeader } from '@/components/ToolingAlertHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NaoConformeTable from '@/components/NaoConformeTable';
import QuickAddDialog from '@/components/QuickAddDialog';
import SectorBudgetStatus from '@/components/SectorBudgetStatus';

interface Ferramenta extends Tool {
  docId: string;
}
interface KitComDocId extends Kit {
    docId: string;
}
type InventarioItem = (Ferramenta | KitComDocId) & { isKit?: boolean };


const ListaFerramentasPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [isLabelPrintDialogOpen, setIsLabelPrintDialogOpen] = useState(false);
  const [isAddQuantityDialogOpen, setIsAddQuantityDialogOpen] = useState(false);
  const [toolsToPrint, setToolsToPrint] = useState<any[]>([]);
  const [selectedToolForDetails, setSelectedToolForDetails] = useState<Ferramenta | null>(null);
  const [selectedKitForDetails, setSelectedKitForDetails] = useState<KitComDocId | null>(null);
  const [selectedItemForReprint, setSelectedItemForReprint] = useState<WithDocId<Tool | Kit> | null>(null);
  
  const ferramentasQueryKey = 'ferramentas';
  const kitsQueryKey = 'kits';

  const ferramentasCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), orderBy('codigo')) : null),
    [firestore]
  );
  
  const { data: todasAsFerramentas, isLoading: isLoadingTools, error: firestoreError } = useCollection<Ferramenta>(ferramentasCollectionRef, {
    queryKey: [ferramentasQueryKey]
  });

  const kitsCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'kits'), orderBy('codigo')) : null),
    [firestore]
  );
  
  const { data: todosOsKits, isLoading: isLoadingKits, error: kitsError } = useCollection<KitComDocId>(kitsCollectionRef, {
    queryKey: [kitsQueryKey]
  });
  
  const inventarioVisivel = useMemo(() => {
    const ferramentas = todasAsFerramentas?.filter(ferramenta => ferramenta.enderecamento !== 'LOGICA') || [];
    const kits = todosOsKits?.map(kit => ({ ...kit, isKit: true, tipo: 'KIT' as const })) || [];
    return [...ferramentas, ...kits].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [todasAsFerramentas, todosOsKits]);

  const filteredInventario = useMemo(() => {
    if (!inventarioVisivel) return [];
    const filteredByStatus = inventarioVisivel.filter(item => item.status !== 'Refugo');

    if (!searchTerm) return filteredByStatus;

    const lowercasedTerm = searchTerm.toLowerCase();
    return filteredByStatus.filter(item => 
        (item.descricao && item.descricao.toLowerCase().includes(lowercasedTerm)) ||
        (item.codigo && item.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [inventarioVisivel, searchTerm]);
  
  const getDynamicStatus = (item: InventarioItem): { status: string; variant: 'success' | 'destructive' | 'default' | 'attention' | 'warning' | 'critical' } => {
    
    if (item.isKit) {
         const statusMap: { [key: string]: 'success' | 'default' } = {
            'Disponível': 'success',
            'Em Empréstimo': 'default',
        }
        return { status: item.status, variant: statusMap[item.status] || 'default' };
    }
    
    const tool = item as Ferramenta;
    
    if (tool.status === 'Em Kit' || tool.status === 'Liberado Condicional') {
      return { status: tool.status, variant: 'attention' };
    }

    if (!['C', 'L', 'V'].includes(tool.classificacao)) {
        const statusMap: { [key: string]: 'success' | 'destructive' | 'default' } = {
            'Disponível': 'success', 'Vencido': 'destructive', 'Bloqueado': 'destructive', 'Inoperante': 'destructive',
            'Pendente': 'default', 'Em Empréstimo': 'default', 'Em Aferição': 'default', 'Em Manutenção': 'default'
        }
        return { status: tool.status, variant: statusMap[tool.status] || 'default' };
    }

    if (!tool.data_vencimento) {
        return { status: 'Cal. Pendente', variant: 'destructive' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(tool.data_vencimento);
    const daysUntilDue = differenceInDays(dueDate, today);

    if (daysUntilDue < 0) {
        return { status: 'Vencido', variant: 'destructive' };
    }
    
    if (tool.status === 'Disponível') {
        if (daysUntilDue <= 5) return { status: 'Disponível', variant: 'critical' };
        if (daysUntilDue <= 15) return { status: 'Disponível', variant: 'warning' };
        if (daysUntilDue <= 30) return { status: 'Disponível', variant: 'attention' };
        return { status: 'Disponível', variant: 'success' };
    }
    
    return { status: tool.status, variant: 'default' };
};

const getBadgeVariant = (variant: 'success' | 'destructive' | 'default' | 'attention' | 'warning' | 'critical') => {
    switch(variant) {
        case 'success': return 'success';
        case 'attention': return 'secondary'; // Amarelo
        case 'warning': return 'default'; // Laranja
        case 'critical': return 'destructive'; // Vermelho
        case 'destructive': return 'destructive';
        default: return 'secondary';
    }
};

  const handleReprintConfirmed = (items: WithDocId<Tool | Kit>[]) => {
    setSelectedItemForReprint(null);
    setToolsToPrint(items);
    setIsLabelPrintDialogOpen(true);
  }
  
  const handleToolUpdate = (updatedTool: WithDocId<Tool>) => {
    queryClient.setQueryData([ferramentasQueryKey], (oldData: WithDocId<Tool>[] | undefined) => {
      if (!oldData) return [];
      return oldData.map(t => t.docId === updatedTool.docId ? updatedTool : t);
    });
    toast({ title: "Sucesso", description: "Ferramenta atualizada." });
    setSelectedToolForDetails(null);
  };
  
  const handleToolDelete = (toolId: string) => {
     queryClient.setQueryData([ferramentasQueryKey], (oldData: WithDocId<Tool>[] | undefined) => {
      if (!oldData) return [];
      return oldData.filter(t => t.docId !== toolId);
    });
    toast({ title: "Sucesso", description: "Ferramenta excluída." });
    setSelectedToolForDetails(null);
  }
  
  const handleAddSuccess = (newTools: any[]) => {
      setIsAddQuantityDialogOpen(false);
      setToolsToPrint(newTools);
      setIsLabelPrintDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
  }

  const isLoading = isLoadingTools || isLoadingKits;
  const anyError = firestoreError || kitsError;

  return (
    <div className="space-y-6">
      <ToolingAlertHeader />
      <SectorBudgetStatus sector="Ferramentaria" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Lista de Ferramentas e Kits</h1>
        <div className="flex gap-2">
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsAddQuantityDialogOpen(true)}>
              Adicionar Ferramenta!!
            </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/ferramentaria/kits')}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Gerenciar Kits
          </Button>
          <Button variant="default" onClick={() => router.push('/dashboard/cadastros/ferramentas')}>
              <PlusSquare className="mr-2 h-4 w-4" />
              Cadastrar Modelo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory">Inventário Geral</TabsTrigger>
          <TabsTrigger value="non-conforming">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Não Conformes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventário Geral</CardTitle>
              <CardDescription>
                Pesquise e gerencie os equipamentos e kits cadastrados no sistema.
              </CardDescription>
                <div className="relative pt-4">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Pesquisar por descrição ou código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                  />
                </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[64px] sm:table-cell">Item</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Endereçamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
                  ) : anyError ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-destructive">Erro: {anyError.message}</TableCell></TableRow>
                  ) : filteredInventario && filteredInventario.length > 0 ? (
                    filteredInventario.map((item) => {
                      const { status, variant } = getDynamicStatus(item);
                      const isKit = item.isKit;
                      return (
                        <TableRow key={item.docId} className={cn(
                            !isKit && (item as Ferramenta).status === 'Liberado Condicional' && 'bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-100/80 dark:hover:bg-orange-900/50',
                            isKit && 'bg-purple-100/70 dark:bg-purple-900/30 hover:bg-purple-100/80 dark:hover:bg-purple-900/50'
                        )}>
                          <TableCell className="hidden sm:table-cell">
                              <button className="relative group focus:outline-none" onClick={() => !isKit && setSelectedToolForDetails(item as Ferramenta)}>
                                <Image
                                    alt={item.descricao}
                                    className="aspect-square rounded-md object-cover"
                                    height="64"
                                    src={item.imageUrl || (isKit ? "https://picsum.photos/seed/kit/64/64" : "https://picsum.photos/seed/tool/64/64")}
                                    width="64"
                                />
                                {(item as Ferramenta).status === 'Liberado Condicional' && (
                                    <div className="absolute top-0 right-0 p-0.5 bg-orange-500 rounded-bl-md rounded-tr-md">
                                        <AlertCircle className="h-3 w-3 text-white" />
                                    </div>
                                )}
                                {!isKit && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity rounded-md">
                                    <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                )}
                                {isKit && (
                                    <div className="absolute bottom-0 right-0 p-0.5 bg-purple-600 rounded-tl-md rounded-br-md">
                                        <Box className="h-3 w-3 text-white" />
                                    </div>
                                )}
                              </button>
                          </TableCell>
                          <TableCell className="font-medium">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell>{item.enderecamento}</TableCell>
                          <TableCell>
                            <Badge variant={getBadgeVariant(variant)}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!isKit ? (
                                <>
                                    <Button variant="ghost" size="icon" title="Detalhes" onClick={() => setSelectedToolForDetails(item as Ferramenta)}>
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" title="Reimprimir Etiqueta" onClick={() => setSelectedItemForReprint(item as WithDocId<Tool>)}>
                                    <Repeat2 className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                  <div className="flex justify-end items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedKitForDetails(item as KitComDocId)}>
                                      <ZoomIn className="mr-2 h-4 w-4" />
                                      Ver Itens
                                    </Button>
                                    <Button variant="ghost" size="icon" title="Reimprimir Etiqueta do Kit" onClick={() => setSelectedItemForReprint(item as WithDocId<Kit>)}>
                                        <Repeat2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center">Nenhum item encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="non-conforming">
           <NaoConformeTable />
        </TabsContent>
      </Tabs>
      
       <QuickAddDialog
        isOpen={isAddQuantityDialogOpen}
        onClose={() => setIsAddQuantityDialogOpen(false)}
        onSuccess={handleAddSuccess}
      />

      <LabelPrintDialog
        isOpen={isLabelPrintDialogOpen}
        onClose={() => setIsLabelPrintDialogOpen(false)}
        tools={toolsToPrint}
      />

       <ReprintDialog 
        isOpen={!!selectedItemForReprint}
        onClose={() => setSelectedItemForReprint(null)}
        tool={selectedItemForReprint}
        onReprintConfirmed={handleReprintConfirmed}
      />

      <ToolDetailsDialog
        tool={selectedToolForDetails}
        isOpen={!!selectedToolForDetails}
        onClose={() => setSelectedToolForDetails(null)}
        onToolUpdated={handleToolUpdate}
        onToolDeleted={handleToolDelete}
      />

      <KitDetailsDialog
        kit={selectedKitForDetails}
        isOpen={!!selectedKitForDetails}
        onClose={() => setSelectedKitForDetails(null)}
      />

    </div>
  );
};

export default ListaFerramentasPage;
