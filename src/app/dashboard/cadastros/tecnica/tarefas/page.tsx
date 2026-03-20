
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useTechFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, orderBy, where } from 'firebase/firestore';
import type { MaintenanceTask, AircraftModel, EngineModel, APUModel, PropellerModel, MaintenanceTaskItem } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Search, Filter, Wrench, Package, Droplets, ArrowRight, Download, FileSpreadsheet, PlayCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

type ModelType = 'Aeronave' | 'Motor' | 'APU' | 'Hélice';

export default function TarefasTecnicaPage() {
  const techFirestore = useTechFirestore();
  const { toast } = useToast();
  
  const [activeModelType, setActiveModelType] = useState<ModelType>('Aeronave');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState<WithDocId<MaintenanceTask> | null>(null);
  
  const [formData, setFormData] = useState<Partial<MaintenanceTask>>({
    code: '',
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

  const { data: aircraftModels } = useCollection<WithDocId<AircraftModel>>(aircraftQuery, { queryKey: ['tech_models_aircraft'] });
  const { data: engineModels } = useCollection<WithDocId<EngineModel>>(engineQuery, { queryKey: ['tech_models_engine'] });
  const { data: apuModels } = useCollection<WithDocId<APUModel>>(apuQuery, { queryKey: ['tech_models_apu'] });
  const { data: propellerModels } = useCollection<WithDocId<PropellerModel>>(propellerQuery, { queryKey: ['tech_models_propeller'] });

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

  // Query para Tarefas baseada no modelo selecionado
  const tasksQuery = useMemoFirebase(() => {
    if (!techFirestore || !selectedModelId) return null;
    return query(collection(techFirestore, 'maintenance_tasks'), where('modelId', '==', selectedModelId));
  }, [techFirestore, selectedModelId]);

  const { data: tasks, isLoading: isLoadingTasks } = useCollection<WithDocId<MaintenanceTask>>(tasksQuery, {
    queryKey: ['tech_tasks_for_model', selectedModelId],
    enabled: !!selectedModelId
  });

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!searchTerm) return tasks;
    const lower = searchTerm.toLowerCase();
    return tasks.filter(t => 
      String(t.code).toLowerCase().includes(lower) || 
      t.tarefa.toLowerCase().includes(lower) ||
      t.procTecn.toLowerCase().includes(lower) ||
      t.refOrigem.toLowerCase().includes(lower) ||
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
        code: '', tarefa: '', refOrigem: '', ata: '', procTecn: '', inspecao: '',
        hhPlanejamento: 0, frequenciaHoras: '', frequenciaCiclos: '', frequenciaCalendario: '',
        frequenciaInicialHoras: '', frequenciaInicialCiclos: '', frequenciaInicialCalendario: '',
        pecas: [], ferramentasEspeciais: [], consumiveis: [],
      });
    }
    setIsDialogOpen(true);
  };

  const addItem = (type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis') => {
    const newItem: MaintenanceTaskItem = { nome: '', partNumber: '', quantidade: 1, unidade: 'UN' };
    setFormData(prev => ({
        ...prev,
        [type]: [...(prev[type] || []), newItem]
    }));
  };

  const updateItem = (type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis', index: number, field: keyof MaintenanceTaskItem, value: any) => {
    setFormData(prev => {
        const list = [...(prev[type] || [])];
        list[index] = { ...list[index], [field]: value };
        return { ...prev, [type]: list };
    });
  };

  const removeItem = (type: 'pecas' | 'ferramentasEspeciais' | 'consumiveis', index: number) => {
    setFormData(prev => ({
        ...prev,
        [type]: (prev[type] || []).filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!techFirestore || !selectedModelId) return;
    if (!formData.code || !formData.tarefa) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Código e Descrição da Tarefa são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    const dataToSave: Omit<MaintenanceTask, 'id'> = {
      ...formData as MaintenanceTask,
      modelId: selectedModelId,
      modelType: activeModelType,
      modelName: selectedModel ? `${(selectedModel as any).manufacturer} ${(selectedModel as any).model}` : 'N/A',
      hhPlanejamento: Number(formData.hhPlanejamento) || 0,
    };

    try {
      if (editingTask) {
        await updateDoc(doc(techFirestore, 'maintenance_tasks', editingTask.docId), dataToSave as any);
        toast({ title: 'Sucesso', description: 'Tarefa técnica atualizada.' });
      } else {
        await addDoc(collection(techFirestore, 'maintenance_tasks'), dataToSave);
        toast({ title: 'Sucesso', description: 'Tarefa cadastrada no catálogo técnico.' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar a tarefa técnica.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Banco de Dados de Tarefas de Manutenção</h1>
        <p className="text-muted-foreground text-sm">Selecione um tipo de item e um modelo para visualizar ou adicionar tarefas de manutenção.</p>
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
                        <CardTitle>Tarefas Cadastradas</CardTitle>
                        <CardDescription>Total de {isLoadingTasks ? '...' : tasks?.length || 0} tarefas encontradas para este modelo.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="text-xs"><PlayCircle className="mr-1 h-3 w-3"/> Tutorial</Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}><PlusCircle className="mr-1 h-3 w-3"/> Adicionar Manualmente</Button>
                        <Button variant="outline" size="sm"><FileSpreadsheet className="mr-1 h-3 w-3"/> Importar Planilha</Button>
                        <Button variant="ghost" size="sm" className="text-xs"><Download className="mr-1 h-3 w-3"/> Baixar Modelo</Button>
                    </div>
                </div>
                <div className="flex gap-4 pt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por tarefa, código, ATA, referência, etc..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4"/> Filtrar por Vencimentos
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-24">Code</TableHead>
                            <TableHead>Tarefa</TableHead>
                            <TableHead>Ref. Origem</TableHead>
                            <TableHead className="text-center">ATA</TableHead>
                            <TableHead>Proc. Técn.</TableHead>
                            <TableHead className="text-center">HH Planej.</TableHead>
                            <TableHead className="text-center">FH</TableHead>
                            <TableHead className="text-center">FC</TableHead>
                            <TableHead className="text-center">MO</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingTasks && <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                        {!isLoadingTasks && filteredTasks.length === 0 && <TableRow><TableCell colSpan={10} className="text-center h-24 text-muted-foreground">Nenhuma tarefa encontrada para este modelo.</TableCell></TableRow>}
                        {!isLoadingTasks && filteredTasks.map(task => (
                            <TableRow key={task.docId} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-mono text-xs font-semibold">{task.code}</TableCell>
                                <TableCell className="max-w-md">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{task.tarefa}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{task.inspecao}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{task.refOrigem}</TableCell>
                                <TableCell className="text-center font-bold text-blue-600">{task.ata}</TableCell>
                                <TableCell className="text-xs font-mono">{task.procTecn}</TableCell>
                                <TableCell className="text-center">{task.hhPlanejamento || 0}</TableCell>
                                <TableCell className="text-center font-mono text-xs">{task.frequenciaHoras || '-'}</TableCell>
                                <TableCell className="text-center font-mono text-xs">{task.frequenciaCiclos || '-'}</TableCell>
                                <TableCell className="text-center font-mono text-xs text-orange-600 font-bold">{task.frequenciaCalendario || '-'}</TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(task)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Excluir Tarefa?</AlertDialogTitle><AlertDialogDescription>Deseja excluir a tarefa {task.code}?</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => deleteDoc(doc(techFirestore!, 'maintenance_tasks', task.docId))}>Excluir</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
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

      {/* DIALOG DE CADASTRO/EDIÇÃO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar' : 'Adicionar Nova'} Tarefa de Manutenção</DialogTitle>
            <DialogDescription>Preencha os campos ou importe uma planilha para adicionar tarefas.</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="geral">Informações da Tarefa</TabsTrigger>
                <TabsTrigger value="intervalos">Intervalos de Frequência</TabsTrigger>
                <TabsTrigger value="pecas">Peças e Ferramentas</TabsTrigger>
                <TabsTrigger value="consumiveis">Consumíveis</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[60vh] mt-4 pr-4">
                <TabsContent value="geral" className="space-y-4 m-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5"><Label>Code</Label><Input value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>Ref. Origem</Label><Input value={formData.refOrigem} onChange={e => setFormData(p => ({...p, refOrigem: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>ATA</Label><Input value={formData.ata} onChange={e => setFormData(p => ({...p, ata: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>Proc. Técn</Label><Input value={formData.procTecn} onChange={e => setFormData(p => ({...p, procTecn: e.target.value}))} /></div>
                        <div className="space-y-1.5 md:col-span-2"><Label>Tarefa</Label><Input value={formData.tarefa} onChange={e => setFormData(p => ({...p, tarefa: e.target.value}))} placeholder="Descreva a tarefa de manutenção..."/></div>
                        <div className="space-y-1.5"><Label>Inspeção</Label><Input value={formData.inspecao} onChange={e => setFormData(p => ({...p, inspecao: e.target.value}))} /></div>
                        <div className="space-y-1.5"><Label>Homem Hora (Planejamento)</Label><Input type="number" value={formData.hhPlanejamento} onChange={e => setFormData(p => ({...p, hhPlanejamento: Number(e.target.value)}))} /></div>
                    </div>
                </TabsContent>

                <TabsContent value="intervalos" className="space-y-6 m-0">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2"><ArrowRight className="h-4 w-4"/> Intervalo Recorrente</h3>
                        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
                            <div className="space-y-1.5"><Label>FH (Horas)</Label><Input value={formData.frequenciaHoras} onChange={e => setFormData(p => ({...p, frequenciaHoras: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>FC (Ciclos)</Label><Input value={formData.frequenciaCiclos} onChange={e => setFormData(p => ({...p, frequenciaCiclos: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>MO (Meses)</Label><Input value={formData.frequenciaCalendario} onChange={e => setFormData(p => ({...p, frequenciaCalendario: e.target.value}))} /></div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground"><ArrowRight className="h-4 w-4"/> Intervalo da Primeira Inspeção (Opcional)</h3>
                        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/10 border-dashed">
                            <div className="space-y-1.5"><Label>FH (Horas)</Label><Input value={formData.frequenciaInicialHoras} onChange={e => setFormData(p => ({...p, frequenciaInicialHoras: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>FC (Ciclos)</Label><Input value={formData.frequenciaInicialCiclos} onChange={e => setFormData(p => ({...p, frequenciaInicialCiclos: e.target.value}))} /></div>
                            <div className="space-y-1.5"><Label>MO (Meses)</Label><Input value={formData.frequenciaInicialCalendario} onChange={e => setFormData(p => ({...p, frequenciaInicialCalendario: e.target.value}))} /></div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="pecas" className="space-y-6 m-0">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-semibold text-sm flex items-center gap-2"><Package className="h-4 w-4"/> Peças</h3><Button variant="outline" size="sm" onClick={() => addItem('pecas')}><PlusCircle className="mr-1 h-3 w-3"/> Adicionar Peça</Button></div>
                        <div className="space-y-2">
                            {formData.pecas?.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-end border p-2 rounded-md">
                                    <div className="col-span-5"><Label className="text-[10px]">Nome</Label><Input className="h-8 text-xs" value={item.nome} onChange={e => updateItem('pecas', idx, 'nome', e.target.value)}/></div>
                                    <div className="col-span-3"><Label className="text-[10px]">P/N</Label><Input className="h-8 text-xs" value={item.partNumber} onChange={e => updateItem('pecas', idx, 'partNumber', e.target.value)}/></div>
                                    <div className="col-span-2"><Label className="text-[10px]">Qtd</Label><Input className="h-8 text-xs" type="number" value={item.quantidade} onChange={e => updateItem('pecas', idx, 'quantidade', Number(e.target.value))}/></div>
                                    <div className="col-span-1"><Label className="text-[10px]">U.M</Label><Input className="h-8 text-xs" value={item.unidade} onChange={e => updateItem('pecas', idx, 'unidade', e.target.value)}/></div>
                                    <div className="col-span-1 text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem('pecas', idx)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Separator/>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4"/> Ferramentas Especiais</h3><Button variant="outline" size="sm" onClick={() => addItem('ferramentasEspeciais')}><PlusCircle className="mr-1 h-3 w-3"/> Adicionar Ferramenta</Button></div>
                        <div className="space-y-2">
                            {formData.ferramentasEspeciais?.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-end border p-2 rounded-md">
                                    <div className="col-span-5"><Label className="text-[10px]">Nome</Label><Input className="h-8 text-xs" value={item.nome} onChange={e => updateItem('ferramentasEspeciais', idx, 'nome', e.target.value)}/></div>
                                    <div className="col-span-3"><Label className="text-[10px]">P/N</Label><Input className="h-8 text-xs" value={item.partNumber} onChange={e => updateItem('ferramentasEspeciais', idx, 'partNumber', e.target.value)}/></div>
                                    <div className="col-span-2"><Label className="text-[10px]">Qtd</Label><Input className="h-8 text-xs" type="number" value={item.quantidade} onChange={e => updateItem('ferramentasEspeciais', idx, 'quantidade', Number(e.target.value))}/></div>
                                    <div className="col-span-1"><Label className="text-[10px]">U.M</Label><Input className="h-8 text-xs" value={item.unidade} onChange={e => updateItem('ferramentasEspeciais', idx, 'unidade', e.target.value)}/></div>
                                    <div className="col-span-1 text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem('ferramentasEspeciais', idx)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="consumiveis" className="space-y-4 m-0">
                    <div className="flex justify-between items-center"><h3 className="font-semibold text-sm flex items-center gap-2"><Droplets className="h-4 w-4"/> Consumíveis</h3><Button variant="outline" size="sm" onClick={() => addItem('consumiveis')}><PlusCircle className="mr-1 h-3 w-3"/> Adicionar Consumível</Button></div>
                    <div className="space-y-2">
                        {formData.consumiveis?.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-end border p-2 rounded-md">
                                <div className="col-span-5"><Label className="text-[10px]">Nome</Label><Input className="h-8 text-xs" value={item.nome} onChange={e => updateItem('consumiveis', idx, 'nome', e.target.value)}/></div>
                                <div className="col-span-3"><Label className="text-[10px]">P/N</Label><Input className="h-8 text-xs" value={item.partNumber} onChange={e => updateItem('consumiveis', idx, 'partNumber', e.target.value)}/></div>
                                <div className="col-span-2"><Label className="text-[10px]">Qtd</Label><Input className="h-8 text-xs" type="number" value={item.quantidade} onChange={e => updateItem('consumiveis', idx, 'quantidade', Number(e.target.value))}/></div>
                                <div className="col-span-1"><Label className="text-[10px]">U.M</Label><Input className="h-8 text-xs" value={item.unidade} onChange={e => updateItem('consumiveis', idx, 'unidade', e.target.value)}/></div>
                                <div className="col-span-1 text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem('consumiveis', idx)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTask ? 'Salvar Alterações' : 'Cadastrar Tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
