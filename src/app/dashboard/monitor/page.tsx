'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { Monitor, MonitorWidget } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Monitor as MonitorIcon, Eye, Settings, Trash2, Layout, Maximize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const SECTORS = [
  'Geral',
  'Ferramentaria',
  'Suprimentos',
  'Engenharia',
  'Manutenção',
  'TI',
  'Qualidade',
  'GSO',
  'Administrativo',
  'Financeiro',
  'Outro'
];

const WIDGET_TYPES = [
  { id: 'mural', name: 'Mural Corporativo' },
  { id: 'os', name: 'Ordens de Serviço / Atividades' },
  { id: 'inventory', name: 'Resumo de Estoque' }
];

export default function MonitoPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // States for new monitor
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('Geral');
  const [newWidgets, setNewWidgets] = useState<MonitorWidget[]>([
    { type: 'mural' },
    { type: 'os' }
  ]);

  const monitorsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'monitors'), orderBy('createdAt', 'desc')) : null
  , [firestore]);

  const { data: monitors, isLoading, error } = useCollection<Monitor>(monitorsQuery);

  const handleCreateMonitor = async () => {
    if (!firestore) {
      toast({
        title: 'Erro',
        description: 'Serviço de banco de dados não disponível.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!newName) {
       toast({
        title: 'Erro',
        description: 'O nome do monitor é obrigatório.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    console.log('Criando monitor...', { name: newName, sector: newSector, widgets: newWidgets });
    
    try {
      const docRef = await addDoc(collection(firestore, 'monitors'), {
        name: newName,
        sector: newSector,
        widgets: newWidgets,
        active: true,
        createdAt: new Date().toISOString()
      });
      console.log('Monitor criado com sucesso ID:', docRef.id);
      
      toast({
        title: 'Sucesso',
        description: 'Monitor criado com sucesso!',
      });
      
      setIsCreateOpen(false);
      setNewName('');
      setNewSector('Geral');
      setNewWidgets([{ type: 'mural' }, { type: 'os' }]);
    } catch (err: any) {
      console.error('Error creating monitor:', err);
      toast({
        title: 'Erro ao criar monitor',
        description: err.message || 'Ocorreu um erro desconhecido.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!firestore || !confirm('Deseja realmente excluir este monitor?')) return;
    try {
      await deleteDoc(doc(firestore, 'monitors', id));
    } catch (err) {
      console.error('Error deleting monitor:', err);
    }
  };

  const toggleWidget = (type: MonitorWidget['type']) => {
    setNewWidgets(prev => {
      const exists = prev.find(w => w.type === type);
      if (exists) {
        return prev.filter(w => w.type !== type);
      } else {
        return [...prev, { type }];
      }
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Módulo Monitor</h1>
          <p className="text-muted-foreground">
            Gerencie seus monitores e as informações exibidas em tempo real.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#3091ff] hover:bg-[#2570cc]">
              <Plus className="h-4 w-4 mr-2" />
              Novo Monitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Configurar Novo Monitor</DialogTitle>
              <DialogDescription>
                Defina o nome, setor e quais widgets estarão ativos neste monitor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Monitor</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Monitor Recepção" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sector">Setor</Label>
                <Select value={newSector} onValueChange={setNewSector}>
                  <SelectTrigger id="sector">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Widgets Ativos</Label>
                <div className="grid grid-cols-1 gap-2 border p-3 rounded-md">
                  {WIDGET_TYPES.map(w => (
                    <div key={w.id} className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id={`w-${w.id}`}
                        checked={newWidgets.some(nw => nw.type === w.id)}
                        onChange={() => toggleWidget(w.id as any)}
                        className="h-4 w-4 rounded border-gray-300 text-[#3091ff] focus:ring-[#3091ff]"
                      />
                      <label 
                        htmlFor={`w-${w.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {w.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button 
                onClick={handleCreateMonitor} 
                className="bg-[#3091ff] hover:bg-[#2570cc]"
                disabled={isSubmitting || !newName}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Monitor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {monitors?.map(monitor => (
          <Card key={monitor.docId} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MonitorIcon className="h-5 w-5 text-[#3091ff]" />
                    {monitor.name}
                  </CardTitle>
                  <CardDescription>{monitor.sector}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleDeleteMonitor(monitor.docId)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Widgets:</p>
                <div className="flex flex-wrap gap-2">
                   {monitor.widgets?.map(w => (
                     <span key={w.type} className="px-2 py-1 bg-[#f2faff] text-[#3091ff] text-xs rounded-full border border-[#3091ff]/20">
                       {WIDGET_TYPES.find(wt => wt.id === w.type)?.name || w.type}
                     </span>
                   ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button asChild className="flex-1 bg-[#3091ff] hover:bg-[#2570cc]">
                <Link href={`/dashboard/monitor/${monitor.docId}/view`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </Link>
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {(!monitors || monitors.length === 0) && (
        <div className="text-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
          <Layout className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Nenhum monitor configurado</h3>
          <p className="mt-1 text-sm text-muted-foreground">Clique em "Novo Monitor" para começar.</p>
        </div>
      )}
    </div>
  );
}
