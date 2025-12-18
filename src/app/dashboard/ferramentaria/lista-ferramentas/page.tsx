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
import { Repeat2, MoreHorizontal, ZoomIn, Search, PlusSquare } from 'lucide-react';
import LabelPrintDialog from '@/components/LabelPrintDialog';
import AddQuantityDialog from '@/components/AddQuantityDialog';
import type { Tool } from '@/lib/types';
import Image from 'next/image';
import ToolDetailsDialog from '@/components/ToolDetailsDialog';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import ReprintDialog from '@/components/ReprintDialog';
import { cn } from '@/lib/utils';


interface Ferramenta extends Tool {
  docId: string;
}

const ListaFerramentasPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddQuantityDialogOpen, setIsAddQuantityDialogOpen] = useState(false);
  const [isLabelPrintDialogOpen, setIsLabelPrintDialogOpen] = useState(false);
  const [isReprintDialogOpen, setIsReprintDialogOpen] = useState(false);
  const [toolsToPrint, setToolsToPrint] = useState<any[]>([]);
  const [selectedToolForDetails, setSelectedToolForDetails] = useState<Ferramenta | null>(null);
  const [selectedToolForReprint, setSelectedToolForReprint] = useState<Ferramenta | null>(null);
  
  const ferramentasQueryKey = 'ferramentas';

  // Corrected Query: Fetch all tools and filter on the client-side.
  const ferramentasCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), orderBy('codigo')) : null),
    [firestore]
  );
  
  const { data: todasAsFerramentas, isLoading, error: firestoreError } = useCollection<Ferramenta>(ferramentasCollectionRef, {
    queryKey: [ferramentasQueryKey]
  });
  
  // Filter out logic templates on the client-side
  const ferramentasVisiveis = useMemo(() => {
    return todasAsFerramentas?.filter(ferramenta => ferramenta.enderecamento !== 'LOGICA') || [];
  }, [todasAsFerramentas]);

  const filteredFerramentas = useMemo(() => {
    if (!ferramentasVisiveis) return [];
    if (!searchTerm) return ferramentasVisiveis;

    const lowercasedTerm = searchTerm.toLowerCase();
    return ferramentasVisiveis.filter(ferramenta => 
        (ferramenta.descricao && ferramenta.descricao.toLowerCase().includes(lowercasedTerm)) ||
        (ferramenta.codigo && ferramenta.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [ferramentasVisiveis, searchTerm]);

  const getStatusVariant = (status: string) => {
    const statusMap: { [key: string]: 'success' | 'destructive' | 'default' } = {
        'Disponível': 'success', 'Vencido': 'destructive', 'Bloqueado': 'destructive', 'Inoperante': 'destructive',
        'Pendente': 'default', 'Em Empréstimo': 'default', 'Em Aferição': 'default'
    }
    return statusMap[status] || 'default';
  };
  
  const handleAddQuantitySuccess = (newTools: any[]) => {
      setIsAddQuantityDialogOpen(false);
      setToolsToPrint(newTools);
      setIsLabelPrintDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
  }

  const handleReprintConfirmed = (tools: any[]) => {
    setIsReprintDialogOpen(false);
    setToolsToPrint(tools);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lista de Ferramentas</h1>
        <Button variant="default" onClick={() => setIsAddQuantityDialogOpen(true)}>
            <PlusSquare className="mr-2 h-4 w-4" />
            Adicionar Ferramenta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventário de Ferramentas</CardTitle>
          <CardDescription>
            Pesquise e gerencie os equipamentos cadastrados no sistema.
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
                <TableHead className="w-[64px] sm:table-cell">Foto</TableHead>
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
              ) : firestoreError ? (
                 <TableRow><TableCell colSpan={6} className="text-center text-destructive">Erro: {firestoreError.message}</TableCell></TableRow>
              ) : filteredFerramentas && filteredFerramentas.length > 0 ? (
                filteredFerramentas.map((ferramenta) => (
                  <TableRow key={ferramenta.docId} className={cn((ferramenta.tipo === 'EQV' || ferramenta.tipo === 'ESP') && 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/50')}>
                    <TableCell className="hidden sm:table-cell">
                        <button className="relative group focus:outline-none" onClick={() => setSelectedToolForDetails(ferramenta)}>
                          <Image
                              alt={ferramenta.descricao}
                              className="aspect-square rounded-md object-cover"
                              height="64"
                              src={ferramenta.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                              width="64"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity rounded-md">
                            <ZoomIn className="h-6 w-6 text-white" />
                          </div>
                        </button>
                    </TableCell>
                    <TableCell className="font-medium">{ferramenta.codigo}</TableCell>
                    <TableCell>{ferramenta.descricao}</TableCell>
                    <TableCell>{ferramenta.enderecamento}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(ferramenta.status)}>
                        {ferramenta.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" title="Detalhes" onClick={() => setSelectedToolForDetails(ferramenta)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Reimprimir Etiqueta" onClick={() => setSelectedToolForReprint(ferramenta)}>
                        <Repeat2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center">Nenhuma ferramenta encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AddQuantityDialog 
        isOpen={isAddQuantityDialogOpen}
        onClose={() => setIsAddQuantityDialogOpen(false)}
        onSuccess={handleAddQuantitySuccess}
      />
      
      <LabelPrintDialog
        isOpen={isLabelPrintDialogOpen}
        onClose={() => setIsLabelPrintDialogOpen(false)}
        tools={toolsToPrint}
      />

       <ReprintDialog 
        isOpen={!!selectedToolForReprint}
        onClose={() => setSelectedToolForReprint(null)}
        tool={selectedToolForReprint}
        onReprintConfirmed={handleReprintConfirmed}
      />

      <ToolDetailsDialog
        tool={selectedToolForDetails}
        isOpen={!!selectedToolForDetails}
        onClose={() => setSelectedToolForDetails(null)}
        onToolUpdated={handleToolUpdate}
        onToolDeleted={handleToolDelete}
      />

    </div>
  );
};

export default ListaFerramentasPage;
