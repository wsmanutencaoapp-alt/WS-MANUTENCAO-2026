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
  where,
  getDocs,
} from 'firebase/firestore';
import type { Supplier } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const CadastroFornecedoresPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['suppliers'];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<WithDocId<Supplier> | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    cnpj: '',
    contactEmail: '',
    contactPhone: '',
    rating: 0,
  });
  
  const suppliersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'suppliers')) : null),
    [firestore]
  );
  
  const { data: suppliers, isLoading, error } = useCollection<WithDocId<Supplier>>(suppliersQuery, {
      queryKey,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'number' ? Number(value) : value }));
  };

  const resetForm = () => {
    setFormData({ name: '', cnpj: '', contactEmail: '', contactPhone: '', rating: 0 });
    setEditingSupplier(null);
  };
  
  const handleOpenDialog = (supplier: WithDocId<Supplier> | null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData(supplier);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.name || !formData.cnpj || !formData.contactEmail) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nome, CNPJ e E-mail de contato são obrigatórios.' });
        return;
    }

    setIsSaving(true);
    
    try {
        const dataToSave = { 
            name: formData.name,
            cnpj: formData.cnpj,
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone || '',
            rating: formData.rating || 0,
        };

        if (editingSupplier) {
            const docRef = doc(firestore, 'suppliers', editingSupplier.docId);
            updateDoc(docRef, dataToSave).catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path, operation: 'update', requestResourceData: dataToSave
                }));
            });
            toast({ title: 'Sucesso!', description: 'Fornecedor atualizado.' });
        } else {
            addDoc(collection(firestore, 'suppliers'), dataToSave).catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'suppliers', operation: 'create', requestResourceData: dataToSave
                }));
            });
            toast({ title: 'Sucesso!', description: `Fornecedor ${formData.name} cadastrado.` });
        }

        queryClient.invalidateQueries({ queryKey });
        setIsDialogOpen(false);
        resetForm();
    } catch (e: any) {
        // This catch block might not be reached if the promise is not awaited,
        // but it's good practice to keep it.
        console.error("Erro ao salvar fornecedor: ", e);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'suppliers', supplierId));
      toast({ title: 'Sucesso!', description: 'Fornecedor excluído.' });
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
           path: `suppliers/${supplierId}`, operation: 'delete'
       }));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Fornecedores</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Fornecedor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fornecedores Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os fornecedores para o processo de cotação e compra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
              {!isLoading && suppliers?.map(s => (
                  <TableRow key={s.docId}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.cnpj}</TableCell>
                    <TableCell>{s.contactEmail}</TableCell>
                    <TableCell>{s.contactPhone}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(s)}>
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
                                  Tem certeza que deseja excluir o fornecedor <span className="font-bold">{s.name}</span>?
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(s.docId)}>
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
            <DialogTitle>{editingSupplier ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1"><Label htmlFor="name">Nome</Label><Input id="name" value={formData.name || ''} onChange={handleInputChange}/></div>
             <div className="space-y-1"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={formData.cnpj || ''} onChange={handleInputChange}/></div>
            <div className="space-y-1"><Label htmlFor="contactEmail">E-mail</Label><Input id="contactEmail" type="email" value={formData.contactEmail || ''} onChange={handleInputChange}/></div>
            <div className="space-y-1"><Label htmlFor="contactPhone">Telefone</Label><Input id="contactPhone" value={formData.contactPhone || ''} onChange={handleInputChange}/></div>
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

export default CadastroFornecedoresPage;
