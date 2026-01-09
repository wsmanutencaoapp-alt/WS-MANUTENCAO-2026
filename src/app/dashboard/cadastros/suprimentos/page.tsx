'use client';

import React, { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import type { Supply } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Loader2, PlusCircle, Trash2, Edit, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import SupplyFormDialog from '@/components/SupplyFormDialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const CadastroSuprimentosPage = () => {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<WithDocId<Supply> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const suppliesQueryKey = ['suppliesMasterData'];
  const suppliesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'supplies'), orderBy('codigo')) : null),
    [firestore]
  );
  
  const { data: supplies, isLoading, error } = useCollection<WithDocId<Supply>>(suppliesQuery, {
    queryKey: suppliesQueryKey
  });

  const filteredSupplies = useMemo(() => {
    if (!supplies) return [];
    if (!searchTerm) return supplies;

    const lowercasedTerm = searchTerm.toLowerCase();
    return supplies.filter(supply => 
      supply.descricao.toLowerCase().includes(lowercasedTerm) ||
      supply.partNumber.toLowerCase().includes(lowercasedTerm) ||
      supply.codigo.toLowerCase().includes(lowercasedTerm)
    );
  }, [supplies, searchTerm]);

  const handleOpenDialog = (supply: WithDocId<Supply> | null = null) => {
    setEditingSupply(supply);
    setIsDialogOpen(true);
  };
  
  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
    setIsDialogOpen(false);
    setEditingSupply(null);
  };
  
  const handleDelete = async (supplyId: string) => {
    if (!firestore) return;
    setIsDeleting(supplyId);
    try {
      await deleteDoc(doc(firestore, 'supplies', supplyId));
      toast({ title: 'Sucesso', description: 'Item de suprimento excluído.' });
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
    } catch(err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o item.' });
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Suprimentos (Master Data)</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os dados mestre de todos os itens de suprimento.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por código, P/N ou descrição..."
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
                <TableHead className="hidden w-[64px] sm:table-cell">Foto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Família</TableHead>
                <TableHead>U.M.</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              )}
              {error && (
                <TableRow><TableCell colSpan={7} className="text-center text-destructive h-24">Erro ao carregar dados.</TableCell></TableRow>
              )}
              {!isLoading && filteredSupplies.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhum item encontrado.</TableCell></TableRow>
              )}
              {!isLoading && filteredSupplies.map(item => (
                <TableRow key={item.docId}>
                   <TableCell className="hidden sm:table-cell">
                      <Image
                        alt={item.descricao}
                        className="aspect-square rounded-md object-cover"
                        height="48"
                        src={item.imageUrl || 'https://picsum.photos/seed/supply/48/48'}
                        width="48"
                      />
                    </TableCell>
                  <TableCell className="font-mono">{item.codigo}</TableCell>
                  <TableCell className="font-medium">{item.descricao}</TableCell>
                  <TableCell>{item.partNumber}</TableCell>
                  <TableCell><Badge variant="outline">{item.familia}</Badge></TableCell>
                  <TableCell>{item.unidadeMedida}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" disabled={isDeleting === item.docId}>
                            {isDeleting === item.docId ? <Loader2 className="animate-spin h-4 w-4"/> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                              Tem certeza que deseja excluir o item <span className="font-bold">{item.descricao}</span>?
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.docId)}>
                              Sim, Excluir
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SupplyFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={handleSuccess}
        supply={editingSupply}
      />
    </div>
  );
};

export default CadastroSuprimentosPage;
