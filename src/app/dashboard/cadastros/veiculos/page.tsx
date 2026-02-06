
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
import type { Vehicle } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const CadastroVeiculosPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['vehicles'];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<WithDocId<Vehicle> | null>(null);
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    prefixo: '',
    placa: '',
    marca: '',
    modelo: '',
    ano: new Date().getFullYear(),
    tipo: 'Carro',
    status: 'Ativo',
  });
  
  const vehiclesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'vehicles')) : null),
    [firestore]
  );
  
  const { data: vehicles, isLoading, error } = useCollection<WithDocId<Vehicle>>(vehiclesQuery, {
      queryKey,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'number' ? Number(value) : value }));
  };

  const handleSelectChange = (id: 'tipo' | 'status', value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const resetForm = () => {
    setFormData({
      prefixo: '',
      placa: '',
      marca: '',
      modelo: '',
      ano: new Date().getFullYear(),
      tipo: 'Carro',
      status: 'Ativo',
    });
    setEditingVehicle(null);
  };
  
  const handleOpenDialog = (vehicle: WithDocId<Vehicle> | null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData(vehicle);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.prefixo || !formData.placa || !formData.marca || !formData.modelo) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Prefixo, Placa, Marca e Modelo são obrigatórios.' });
        return;
    }

    setIsSaving(true);
    
    const dataToSave: Omit<Vehicle, 'id'> = { 
        prefixo: formData.prefixo!,
        placa: formData.placa!,
        marca: formData.marca!,
        modelo: formData.modelo!,
        ano: Number(formData.ano)!,
        tipo: formData.tipo as any,
        status: formData.status as any,
    };

    try {
        if (editingVehicle) {
            const docRef = doc(firestore, 'vehicles', editingVehicle.docId);
            await updateDoc(docRef, dataToSave);
            toast({ title: 'Sucesso!', description: 'Veículo atualizado.' });
        } else {
            await addDoc(collection(firestore, 'vehicles'), dataToSave);
            toast({ title: 'Sucesso!', description: `Veículo ${formData.prefixo} cadastrado.` });
        }

        queryClient.invalidateQueries({ queryKey });
        setIsDialogOpen(false);
        resetForm();
    } catch (e: any) {
        console.error("Erro ao salvar veículo: ", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `vehicles/${editingVehicle?.docId || 'new'}`,
            operation: editingVehicle ? 'update' : 'create',
            requestResourceData: dataToSave
        }));
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'vehicles', vehicleId));
      toast({ title: 'Sucesso!', description: 'Veículo excluído.' });
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `vehicles/${vehicleId}`,
            operation: 'delete',
        }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Veículos</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Veículo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frota de Veículos</CardTitle>
          <CardDescription>
            Gerencie os veículos da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prefixo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={6} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
              {!isLoading && vehicles?.map(v => (
                  <TableRow key={v.docId}>
                    <TableCell className="font-mono">{v.prefixo}</TableCell>
                    <TableCell>{v.placa}</TableCell>
                    <TableCell>{v.marca} {v.modelo}</TableCell>
                    <TableCell>{v.ano}</TableCell>
                    <TableCell>{v.status}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(v)}>
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
                                  Tem certeza que deseja excluir o veículo <span className="font-bold">{v.prefixo} - {v.placa}</span>?
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(v.docId)}>
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
            <DialogTitle>{editingVehicle ? 'Editar Veículo' : 'Adicionar Novo Veículo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="prefixo">Prefixo</Label><Input id="prefixo" value={formData.prefixo || ''} onChange={handleInputChange} /></div>
                <div className="space-y-1"><Label htmlFor="placa">Placa</Label><Input id="placa" value={formData.placa || ''} onChange={handleInputChange} /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="marca">Marca</Label><Input id="marca" value={formData.marca || ''} onChange={handleInputChange} /></div>
            <div className="space-y-1"><Label htmlFor="modelo">Modelo</Label><Input id="modelo" value={formData.modelo || ''} onChange={handleInputChange} /></div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="ano">Ano</Label><Input id="ano" type="number" value={formData.ano || ''} onChange={handleInputChange} /></div>
                <div className="space-y-1"><Label htmlFor="tipo">Tipo</Label>
                    <Select value={formData.tipo} onValueChange={(v) => handleSelectChange('tipo', v as any)}>
                        <SelectTrigger id="tipo"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Carro">Carro</SelectItem>
                            <SelectItem value="Moto">Moto</SelectItem>
                            <SelectItem value="Caminhão">Caminhão</SelectItem>
                            <SelectItem value="Caminhonete">Caminhonete</SelectItem>
                            <SelectItem value="Van">Van</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v as any)}>
                    <SelectTrigger id="status"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                    </SelectContent>
                </Select>
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

export default CadastroVeiculosPage;
