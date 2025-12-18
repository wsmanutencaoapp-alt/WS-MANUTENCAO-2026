'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  writeBatch,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import type { Kit, Tool } from '@/lib/types';
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
import { Loader2, Package, Trash2, Edit, ZoomIn, PlusSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import KitDetailsDialog from '@/components/KitDetailsDialog';
import { ToolingAlertHeader } from '@/components/ToolingAlertHeader';
import CreateKitDialog from '@/components/CreateKitDialog';

type KitWithDocId = WithDocId<Kit>;

const KitsPage = () => {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedKit, setSelectedKit] = useState<KitWithDocId | null>(null);
  const [isCreateKitOpen, setIsCreateKitOpen] = useState(false);
  const { toast } = useToast();

  const kitsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'kits'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  
  const { data: kits, isLoading, error } = useCollection<KitWithDocId>(kitsQuery, {
      queryKey: ['kits']
  });
  
  const handleSuccess = () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      setIsCreateKitOpen(false);
  }

  const handleDisassembleKit = async (kit: KitWithDocId) => {
    if (!firestore) return;
    setIsProcessing(kit.docId);

    try {
        const batch = writeBatch(firestore);

        // Update status of all tools in the kit
        if (kit.toolIds && kit.toolIds.length > 0) {
            for (const toolId of kit.toolIds) {
                const toolRef = doc(firestore, 'tools', toolId);
                batch.update(toolRef, { status: 'Disponível', enderecamento: '' });
            }
        }

        // Delete the kit document
        const kitRef = doc(firestore, 'kits', kit.docId);
        batch.delete(kitRef);

        await batch.commit();

        toast({ title: "Sucesso!", description: `O kit ${kit.codigo} foi desmontado.` });
        
        handleSuccess();

    } catch (err) {
        console.error("Erro ao desmontar o kit:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível desmontar o kit.' });
    } finally {
        setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <ToolingAlertHeader />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package />
            Kits de Ferramentas
        </h1>
        <Button onClick={() => setIsCreateKitOpen(true)}>
            <PlusSquare className="mr-2 h-4 w-4"/>
            Criar Novo Kit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kits Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os conjuntos de ferramentas montados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Nº de Itens</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive">
                    Erro ao carregar kits: {error.message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && kits?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Nenhum kit cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && kits?.map(kit => (
                <TableRow key={kit.docId}>
                  <TableCell className="font-mono">{kit.codigo}</TableCell>
                  <TableCell>{kit.descricao}</TableCell>
                  <TableCell>{kit.toolIds?.length || 0}</TableCell>
                  <TableCell>{format(new Date(kit.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedKit(kit)}>
                        <ZoomIn className="mr-2 h-4 w-4" />
                        Ver Itens
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isProcessing === kit.docId}
                        >
                          {isProcessing === kit.docId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                          Desmontar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja desmontar o kit <span className="font-bold">{kit.codigo}</span>? As ferramentas retornarão ao status "Disponível".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDisassembleKit(kit)}>
                            Confirmar
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
      
      {selectedKit && (
          <KitDetailsDialog
            kit={selectedKit}
            isOpen={!!selectedKit}
            onClose={() => setSelectedKit(null)}
           />
      )}
      
       <CreateKitDialog
        isOpen={isCreateKitOpen}
        onClose={() => setIsCreateKitOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default KitsPage;
