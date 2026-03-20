'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { useCollection, useTechFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import type { MaintenanceTask, AircraftModel, EngineModel, APUModel, PropellerModel, MaintenanceTaskItem } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Search, Wrench, Package, Droplets, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type ModelType = 'Aeronave' | 'Motor' | 'APU' | 'Hélice';

// Componente para gerenciar os itens dentro da sanfona
function TaskDetailsAccordion({ task, onSaveSuccess }: { task: WithDocId<MaintenanceTask>, onSaveSuccess: () => void }) {
  const techFirestore = useTechFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [localItems, setLocalItems] = useState({
    pecas: task.pecas || [],
    ferramentasEspeciais: task.ferramentasEspeciais || [],
    consumiveis: task.consumiveis || []
  });

  const addItem = (type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis') => {
    const newItem: MaintenanceTaskItem = { nome: '', partNumber: '', quantidade: 1, unidade: 'UN' };
    setLocalItems(prev => ({ ...prev, [type]: [...prev[type], newItem] }));
  };

  const updateItem = (type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis', index: number, field: keyof MaintenanceTaskItem, value: any) => {
    setLocalItems(prev => {
      const list = [...prev[type]];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [type]: list };
    });
  };

  const removeItem = (type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis', index: number) => {
    setLocalItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const handleSaveDetails = async () => {
    if (!techFirestore) return;
    setIsSaving(true);
    try {
      const taskRef = doc(techFirestore, 'maintenanceTasks', task.docId);
      await updateDoc(taskRef, localItems);
      toast({ title: 'Sucesso', description: 'Itens relacionados da tarefa atualizados.' });
      onSaveSuccess();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar detalhes.' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderSection = (title: string, type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis', icon: React.ReactNode) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          {icon} {title}
        </h4>
        <Button variant="outline" size="sm" onClick={() => addItem(type)} className="h-7 text-xs">
          <PlusCircle className="mr-1 h-3 w-3" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {localItems[type].length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-md">
            Nenhum item necessário.
          </p>
        )}
        {localItems[type].map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2 rounded-md border">
            <div className="col-span-5">
              <Label className="text-[10px] uppercase text-muted-foreground ml-1">Descrição</Label>
              <Input 
                className="h-8 text-xs" 
                value={item.nome} 
                onChange={e => updateItem(type, idx, 'nome', e.target.value)} 
                placeholder="Ex: O-ring"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-[10px] uppercase text-muted-foreground ml-1">P/N</Label>
              <Input 
                className="h-8 text-xs font-mono" 
                value={item.partNumber} 
                onChange={e => updateItem(type, idx, 'partNumber', e.target.value)} 
                placeholder="PN"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] uppercase text-muted-foreground ml-1">Qtd</Label>
              <Input 
                className="h-8 text-xs" 
                type="number" 
                value={item.quantidade} 
                onChange={e => updateItem(type, idx, 'quantidade', Number(e.target.value))} 
              />
            </div>
            <div className="col-span-1">
              <Label className="text-[10px] uppercase text-muted-foreground ml-1">U.M</Label>
              <Select value={item.unidade} onValueChange={v => updateItem(type, idx, 'unidade', v)}>
                <SelectTrigger className="h-8 text-[10px] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UN">UN</SelectItem>
                  <SelectItem value="KG">KG</SelectItem>
                  <SelectItem value="LT">LT</SelectItem>
                  <SelectItem value="MT">MT</SelectItem>
                  <SelectItem value="AR">AR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 text-right pt-4">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(type, idx)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-muted/20 border-t space-y-6 animate-in slide-in-from-top-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderSection("Peças", "pecas", <Package className="h-4 w-4 text-blue-500" />)}
        {renderSection("Ferramentas Especiais", "ferramentasEspeciais", <Wrench className="h-4 w-4 text-orange-500" />)}
        {renderSection("Consumíveis", "consumiveis", <Droplets className="h-4 w-4 text-green-500" />)}
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSaveDetails} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações nos Detalhes
        </Button>
      </div>
    </div>
  );
}

export default function TarefasTecnicaPage() {
  const techFirestore = useTechFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeModelType, setActiveModelType] = useState<ModelType>('Aeronave');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState<WithDocId<MaintenanceTask> | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<MaintenanceTask>>({
    code: 0,
    tarefa: '',
    refOrigem: '',
    ata: '',
    procTecn: '',
    inspecao: '',
    hhPlanejamento: 0,
    frequenciaHoras: '',
    frequenciaCiclos: '',
    frequenciaCalendario: '',
    frequenciaInicialHoras: '',
    frequenciaInicialCiclos: '',
    frequenciaInicialCalendario: '',
    pecas: [],
    ferramentasEspeciais: [],
    consumiveis: [],
  });

  // Queries para Modelos
  const aircraftQuery = useMemoFirebase(() => (techFirestore ? query(collection(techFirestore, 'aircraftModels')) : null), [techFirestore]);
  const engineQuery = useMemoFirebase(() => (techFirestore ? query(collection(techFirestore, 'engineModels')) : null), [techFirestore]);
  const apuQuery = useMemoFirebase(() => (techFirestore ? query(collection(techFirestore, 'apuModels')) : null), [techFirestore]);
  const propellerQuery = useMemoFirebase(() => (techFirestore ? query(collection(techFirestore, 'propellerModels')) : null), [techFirestore]);

  const { data: aircraftModels } = useCollection<WithDocId<AircraftModel>>(aircraftQuery, { queryKey: ['tech_models_aircraft_v3'] });
  const { data: engineModels } = useCollection<WithDocId<EngineModel>>(engineQuery, { queryKey: ['tech_models_engine_v3'] });
  const { data: apuModels } = useCollection<WithDocId<APUModel>>(apuQuery, { queryKey: ['tech_models_apu_v3'] });
  const { data: propellerModels } = useCollection<WithDocId<PropellerModel>>(propellerQuery, { queryKey: ['tech_models_propeller_v3'] });

  const availableModels = useMemo(() => {
    switch (activeModelType) {
      case 'Aeronave': return aircraftModels || [];
      case 'Motor': return engineModels || [];
      case 'APU': return apuModels || [];
      case 'Hélice': return propellerModels || [];
      default: return [];
    }
  }, [activeModelType, aircraftModels, engineModels, apuModels, propellerModels]);

  const selectedModel = useMemo(() => availableModels.find(m => m.docId === selectedModelId), [availableModels, selectedModelId]);

  // Query para Tarefas
  const tasksQuery = useMemoFirebase(() => {
    if (!techFirestore || !selectedModelId) return null;
    return query(collection(techFirestore, 'maintenanceTasks'), where('modelId', '==', selectedModelId));
  }, [techFirestore, selectedModelId]);

  const { data: tasks, isLoading: isLoadingTasks } = useCollection<WithDocId<MaintenanceTask>>(tasksQuery, {
    queryKey: ['tech_tasks_live_v2', selectedModelId],
    enabled: !!selectedModelId && !!techFirestore
  });

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let sorted = [...tasks].sort((a, b) => Number(a.code) - Number(b.code));
    if (!searchTerm) return sorted;
    const lower = searchTerm.toLowerCase();
    return sorted.filter(t => 
      String(t.code).toLowerCase().includes(lower) || 
      t.tarefa.toLowerCase().includes(lower) ||
      t.procTecn.toLowerCase().includes(lower) ||
      t.ata.toLowerCase().includes(lower)
    );
  }, [tasks, searchTerm]);

  const handleOpenDialog = (task: WithDocId<MaintenanceTask> | null = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
          ...task,
          pecas: task.pecas || [],
          ferramentasEspeciais: task.ferramentasEspeciais || [],
          consumiveis: task.consumiveis || [],
      });
    } else {
      setEditingTask(null);
      setFormData({
        code: 0, tarefa: '', refOrigem: '', ata: '', procTecn: '', inspecao: '',
        hhPlanejamento: 0, frequenciaHoras: '', frequenciaCiclos: '', frequenciaCalendario: '',
        frequenciaInicialHoras: '', frequenciaInicialCiclos: '', frequenciaInicialCalendario: '',
        pecas: [], ferramentasEspeciais: [], consumiveis: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!techFirestore || !selectedModelId) return;
    setIsSaving(true);
    const dataToSave: Omit<MaintenanceTask, 'id'> = {
      ...formData as MaintenanceTask,
      code: Number(formData.code) || 0,
      modelId: selectedModelId,
      modelType: activeModelType,
      modelName: selectedModel ? `${(selectedModel as any).manufacturer} ${(selectedModel as any).model}` : 'N/A',
    };

    try {
      if (editingTask) {
        await updateDoc(doc(techFirestore, 'maintenanceTasks', editingTask.docId), dataToSave as any);
        toast({ title: 'Sucesso', description: 'Tarefa técnica atualizada.' });
      } else {
        await addDoc(collection(techFirestore, 'maintenanceTasks'), dataToSave);
        toast({ title: 'Sucesso', description: 'Tarefa cadastrada.' });
      }
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tech_tasks_live_v2', selectedModelId] });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar a tarefa técnica.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!techFirestore) return;
    try {
      await deleteDoc(doc(techFirestore, 'maintenanceTasks', id));
      toast({ title: 'Sucesso', description: 'Tarefa removida.' });
      queryClient.invalidateQueries({ queryKey: ['tech_tasks_live_v2', selectedModelId] });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao excluir.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Banco de Dados de Tarefas de Manutenção</h1>
        <p className="text-muted-foreground text-sm">Gerencie o plano de manutenção na instância <strong>operation-manager</strong>.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
            <Label>Tipo de Item</Label>
            <Select value={activeModelType} onValueChange={(v: ModelType) => { setActiveModelType(v); setSelectedModelId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Aeronave">Aeronave</SelectItem>
                    <SelectItem value="Motor">Motor</SelectItem>
                    <SelectItem value="APU">APU</SelectItem>
                    <SelectItem value="Hélice">Hélice</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-1.5">
            <Label>Modelo de {activeModelType}</Label>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo..." /></SelectTrigger>
                <SelectContent>
                    {availableModels.map(m => (
                        <SelectItem key={m.docId} value={m.docId}>{(m as any).manufacturer} {(m as any).model}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      {selectedModelId ? (
        <Card>
            <CardHeader className="border-b bg-muted/20">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Tarefas: {(selectedModel as any)?.model}</CardTitle>
                        <CardDescription>Total de {isLoadingTasks ? '...' : tasks?.length || 0} tarefas encontradas.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}><PlusCircle className="mr-1 h-3 w-3"/> Adicionar</Button>
                    </div>
                </div>
                <div className="flex gap-4 pt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por tarefa, código, ATA..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="w-24">Code</TableHead>
                            <TableHead>Tarefa</TableHead>
                            <TableHead className="text-center">ATA</TableHead>
                            <TableHead>Proc. Técn.</TableHead>
                            <TableHead className="text-center">HH</TableHead>
                            <TableHead className="text-center">FH</TableHead>
                            <TableHead className="text-center">FC</TableHead>
                            <TableHead className="text-center">MO</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingTasks && <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                        {!isLoadingTasks && filteredTasks.map(task => {
                            const isExpanded = expandedTaskId === task.docId;
                            return (
                                <Fragment key={task.docId}>
                                    <TableRow 
                                        className={cn("hover:bg-muted/50 transition-colors cursor-pointer", isExpanded && "bg-muted/30 border-b-0")}
                                        onClick={() => setExpandedTaskId(isExpanded ? null : task.docId)}
                                    >
                                        <TableCell>
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-semibold">{task.code}</TableCell>
                                        <TableCell className="max-w-md">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{task.tarefa}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{task.inspecao}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-blue-600">{task.ata}</TableCell>
                                        <TableCell className="text-xs font-mono">{task.procTecn}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{task.hhPlanejamento || 0}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{task.frequenciaHoras || '-'}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{task.frequenciaCiclos || '-'}</TableCell>
                                        <TableCell className="text-center font-mono text-xs text-orange-600 font-bold">{task.frequenciaCalendario || '-'}</TableCell>
                                        <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(task)}><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Excluir Tarefa?</AlertDialogTitle><AlertDialogDescription>Deseja excluir a tarefa {task.code}?</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(task.docId)}>Excluir</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableCell colSpan={10} className="p-0 border-b">
                                                <TaskDetailsAccordion 
                                                    task={task} 
                                                    onSaveSuccess={() => queryClient.invalidateQueries({ queryKey: ['tech_tasks_live_v2', selectedModelId] })} 
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/10">
            <Search className="h-12 w-12 text-muted-foreground mb-2"/>
            <p className="text-muted-foreground">Selecione um modelo para visualizar o catálogo de tarefas.</p>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar' : 'Adicionar Nova'} Tarefa de Manutenção</DialogTitle>
            <DialogDescription>Dados da tarefa para {(selectedModel as any)?.model}</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="geral">Informações da Tarefa</TabsTrigger>
                <TabsTrigger value="intervalos">Intervalos de Frequência</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[60vh] mt-4 pr-4">
                <TabsContent value="geral" className="space-y-4 m-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5"><Label>Code (Numérico)</Label><Input type="number" value={formData.code} onChange={e => setFormData(p => ({...p, code: Number(e.target.value)}))} /></div>
                        <div className="space-y-1.5"><Label>Ref. Origem</Label><Input value={formData.refOrigem} onChange={e => setFormData(p => ({...p, refOrigem: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>ATA</Label><Input value={formData.ata} onChange={e => setFormData(p => ({...p, ata: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>Proc. Técn</Label><Input value={formData.procTecn} onChange={e => setFormData(p => ({...p, procTecn: e.target.value}))} /></div>
                        <div className="space-y-1.5 md:col-span-2"><Label>Tarefa</Label><Input value={formData.tarefa} onChange={e => setFormData(p => ({...p, tarefa: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>Inspeção</Label><Input value={formData.inspecao} onChange={e => setFormData(p => ({...p, inspecao: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>HH (Planejamento)</Label><Input type="number" value={formData.hhPlanejamento} onChange={e => setFormData(p => ({...p, hhPlanejamento: Number(e.target.value)}))} /></div>
                    </div>
                </TabsContent>

                <TabsContent value="intervalos" className="space-y-6 m-0">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Intervalo Recorrente</h3>
                        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
                            <div className="space-y-1.5"><Label>FH (Horas)</Label><Input value={formData.frequenciaHoras} onChange={e => setFormData(p => ({...p, frequenciaHoras: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>FC (Ciclos)</Label><Input value={formData.frequenciaCiclos} onChange={e => setFormData(p => ({...p, frequenciaCiclos: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>MO (Meses)</Label><Input value={formData.frequenciaCalendario} onChange={e => setFormData(p => ({...p, frequenciaCalendario: e.target.value}))} /></div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Intervalo da Primeira Inspeção (Opcional)</h3>
                        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
                            <div className="space-y-1.5"><Label>FH (Horas)</Label><Input value={formData.frequenciaInicialHoras} onChange={e => setFormData(p => ({...p, frequenciaInicialHoras: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>FC (Ciclos)</Label><Input value={formData.frequenciaInicialCiclos} onChange={e => setFormData(p => ({...p, frequenciaInicialCiclos: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>MO (Meses)</Label><Input value={formData.frequenciaInicialCalendario} onChange={e => setFormData(p => ({...p, frequenciaInicialCalendario: e.target.value}))} /></div>
                        </div>
                    </div>
                </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTask ? 'Salvar Alterações' : 'Cadastrar Tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}