'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  where,
  getDocs,
} from 'firebase/firestore';
import type { CostCenter } from '@/lib/types';
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
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const CadastroCentroDeCustoPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['cost_centers'];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<WithDocId<CostCenter> | null>(null);
  const [formData, setFormData] = useState<Partial<CostCenter>>({
    code: '',
    description: '',
  });
  
  const costCentersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'cost_centers')) : null),
    [firestore]
  );
  
  const { data: costCenters, isLoading, error } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const resetForm = () => {
    setFormData({ code: '', description: '' });
    setEditingCostCenter(null);
  };
  
  const handleOpenDialog = (costCenter: WithDocId<CostCenter> | null) => {
    if (costCenter) {
      setEditingCostCenter(costCenter);
      setFormData(costCenter);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.code || !formData.description) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Código e descrição são obrigatórios.' });
        return;
    }

    // Check for duplicate code
    const q = query(collection(firestore, 'cost_centers'), where('code', '==', formData.code));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty && querySnapshot.docs.some(doc => doc.id !== editingCostCenter?.docId)) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Este código de centro de custo já existe.' });
        return;
    }

    setIsSaving(true);
    
    try {
        if (editingCostCenter) {
            const docRef = doc(firestore, 'cost_centers', editingCostCenter.docId);
            await updateDoc(docRef, formData);
            toast({ title: 'Sucesso!', description: 'Centro de custo atualizado.' });
        } else {
            const dataToSave = { 
                code: formData.code,
                description: formData.description,
            };
            await addDoc(collection(firestore, 'cost_centers'), dataToSave);
            toast({ title: 'Sucesso!', description: `Centro de custo ${formData.code} cadastrado.` });
        }

        queryClient.invalidateQueries({ queryKey });
        setIsDialogOpen(false);
        resetForm();
    } catch (e: any) {
        console.error("Erro ao salvar centro de custo: ", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `cost_centers/${editingCostCenter?.docId || 'new'}`,
            operation: 'write',
            requestResourceData: formData
        }));
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (costCenterId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'cost_centers', costCenterId));
      toast({ title: 'Sucesso!', description: 'Centro de custo excluído.' });
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `cost_centers/${costCenterId}`,
            operation: 'delete',
        }));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Centros de Custo</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Centro de Custo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Centros de Custo Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os centros de custo para requisições e alocação de despesas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={3} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
              {!isLoading && costCenters?.map(cc => (
                  <TableRow key={cc.docId}>
                    <TableCell className="font-mono">{cc.code}</TableCell>
                    <TableCell>{cc.description}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(cc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Tem certeza que deseja excluir o centro de custo <span className="font-bold">{cc.code} - {cc.description}</span>?
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(cc.docId)}>
                                  Sim, Excluir
                              </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
       <Dialog open={isDialogOpen} onOpenChange={(open) => {
           if (!open) resetForm();
           setIsDialogOpen(open);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCostCenter ? 'Editar Centro de Custo' : 'Adicionar Novo Centro de Custo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
                <Label htmlFor="code">Código</Label>
                <Input id="code" value={formData.code || ''} onChange={handleInputChange} placeholder="Ex: MNT-01"/>
            </div>
             <div className="space-y-1">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Ex: Manutenção de Células"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CadastroCentroDeCustoPage;
