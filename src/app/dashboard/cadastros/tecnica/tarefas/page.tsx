
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, orderBy, getDocs } from 'firebase/firestore';
import type { MaintenanceTask, AircraftModel, EngineModel, APUModel, PropellerModel } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Search, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function TarefasTecnicaPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState<WithDocId<MaintenanceTask> | null>(null);
  
  const [formData, setFormData] = useState<Partial<MaintenanceTask>>({
    code: '',
    description: '',
    modelType: 'Aeronave',
    modelId: '',
    intervalHours: 0,
    intervalCycles: 0,
    intervalDays: 0,
  });

  const tasksQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'maintenance_tasks'), orderBy('code')) : null
  ), [firestore]);

  const { data: tasks, isLoading } = useCollection<WithDocId<MaintenanceTask>>(tasksQuery, {
    queryKey: ['maintenance_tasks']
  });

  // Fetch all possible models for the selector
  const aircraftQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'aircraftModels'), orderBy('model')) : null), [firestore]);
  const engineQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'engineModels'), orderBy('model')) : null), [firestore]);
  const apuQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'apuModels'), orderBy('model')) : null), [firestore]);
  const propellerQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'propellerModels'), orderBy('model')) : null), [firestore]);

  const { data: aircraftModels } = useCollection<WithDocId<AircraftModel>>(aircraftQuery);
  const { data: engineModels } = useCollection<WithDocId<EngineModel>>(engineQuery);
  const { data: apuModels } = useCollection<WithDocId<APUModel>>(apuQuery);
  const { data: propellerModels } = useCollection<WithDocId<PropellerModel>>(propellerQuery);

  const availableModels = useMemo(() => {
    switch (formData.modelType) {
      case 'Aeronave': return aircraftModels || [];
      case 'Motor': return engineModels || [];
      case 'APU': return apuModels || [];
      case 'Hélice': return propellerModels || [];
      default: return [];
    }
  }, [formData.modelType, aircraftModels, engineModels, apuModels, propellerModels]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!searchTerm) return tasks;
    const lower = searchTerm.toLowerCase();
    return tasks.filter(t => 
      t.code.toLowerCase().includes(lower) || 
      t.description.toLowerCase().includes(lower) ||
      t.modelName?.toLowerCase().includes(lower)
    );
  }, [tasks, searchTerm]);

  const handleOpenDialog = (task: WithDocId<MaintenanceTask> | null = null) => {
    if (task) {
      setEditingTask(task);
      setFormData(task);
    } else {
      setEditingTask(null);
      setFormData({
        code: '', description: '', modelType: 'Aeronave', modelId: '',
        intervalHours: 0, intervalCycles: 0, intervalDays: 0
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.code || !formData.description || !formData.modelId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha os campos obrigatórios.' });
      return;
    }

    setIsSaving(true);
    const selectedModel = availableModels.find(m => m.docId === formData.modelId);
    const dataToSave = {
      ...formData,
      modelName: selectedModel ? `${selectedModel.manufacturer} ${selectedModel.model}` : 'Modelo desconhecido',
      intervalHours: Number(formData.intervalHours) || 0,
      intervalCycles: Number(formData.intervalCycles) || 0,
      intervalDays: Number(formData.intervalDays) || 0,
    };

    try {
      if (editingTask) {
        await updateDoc(doc(firestore, 'maintenance_tasks', editingTask.docId), dataToSave);
        toast({ title: 'Sucesso', description: 'Tarefa atualizada.' });
      } else {
        await addDoc(collection(firestore, 'maintenance_tasks'), dataToSave);
        toast({ title: 'Sucesso', description: 'Tarefa cadastrada.' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar a tarefa.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'maintenance_tasks', id));
      toast({ title: 'Sucesso', description: 'Tarefa excluída.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao excluir.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Tarefas de Manutenção</h1>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Tarefas</CardTitle>
          <CardDescription>Defina as tarefas padrão e seus intervalos por modelo.</CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por código, descrição ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-background pl-8 md:w-[350px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Intervalos (H/C/D)</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
              {!isLoading && filteredTasks.map((task) => (
                <TableRow key={task.docId}>
                  <TableCell className="font-mono">{task.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{task.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Badge variant="secondary" className="w-fit mb-1">{task.modelType}</Badge>
                      <span className="text-xs text-muted-foreground">{task.modelName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {task.intervalHours || 0}H / {task.intervalCycles || 0}C / {task.intervalDays || 0}D
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(task)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Tarefa?</AlertDialogTitle>
                          <AlertDialogDescription>Deseja excluir a tarefa {task.code}?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(task.docId)}>Excluir</AlertDialogAction>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar' : 'Nova'} Tarefa de Manutenção</DialogTitle>
            <DialogDescription>As tarefas são vinculadas a modelos específicos para garantir a padronização.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tipo de Modelo <span className="text-destructive">*</span></Label>
              <Select value={formData.modelType} onValueChange={(v: any) => setFormData(p => ({...p, modelType: v, modelId: ''}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aeronave">Aeronave</SelectItem>
                  <SelectItem value="Motor">Motor</SelectItem>
                  <SelectItem value="APU">APU</SelectItem>
                  <SelectItem value="Hélice">Hélice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5 md:col-span-2">
              <Label>Modelo Específico <span className="text-destructive">*</span></Label>
              <Select value={formData.modelId} onValueChange={(v) => setFormData(p => ({...p, modelId: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo..." /></SelectTrigger>
                <SelectContent>
                  {availableModels.map(m => (
                    <SelectItem key={m.docId} value={m.docId}>{m.manufacturer} {m.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">Código ATA / Tarefa <span className="text-destructive">*</span></Label>
              <Input id="code" value={formData.code} onChange={(e) => setFormData(p => ({...p, code: e.target.value.toUpperCase()}))} placeholder="Ex: 24-10-01" />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição <span className="text-destructive">*</span></Label>
              <Input id="description" value={formData.description} onChange={(e) => setFormData(p => ({...p, description: e.target.value}))} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intervalHours">Intervalo Horas (H)</Label>
              <Input id="intervalHours" type="number" value={formData.intervalHours} onChange={(e) => setFormData(p => ({...p, intervalHours: Number(e.target.value)}))} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intervalCycles">Intervalo Ciclos (C)</Label>
              <Input id="intervalCycles" type="number" value={formData.intervalCycles} onChange={(e) => setFormData(p => ({...p, intervalCycles: Number(e.target.value)}))} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intervalDays">Intervalo Dias (D)</Label>
              <Input id="intervalDays" type="number" value={formData.intervalDays} onChange={(e) => setFormData(p => ({...p, intervalDays: Number(e.target.value)}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
