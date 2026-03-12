'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import type { CorporateCommunication } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Category = 'Avisos' | 'Eventos' | 'Seguranca' | 'RH';

const categoryLabels: Record<Category, string> = {
  Avisos: 'Avisos Gerais',
  Eventos: 'Próximos Eventos',
  Seguranca: 'Publicações de Segurança',
  RH: 'Comunicados do RH',
};

export default function MuralManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    editingItem: WithDocId<CorporateCommunication> | null;
    category?: Category;
  }>({ isOpen: false, editingItem: null });
  
  const [formData, setFormData] = useState<Partial<CorporateCommunication>>({});

  const communicationsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'communications'), orderBy('createdAt', 'desc')) : null
  , [firestore]);

  const { data: communications, isLoading, error } = useCollection<WithDocId<CorporateCommunication>>(communicationsQuery, {
    queryKey: ['corporate_communications']
  });

  const groupedCommunications = useMemo(() => {
    const groups: Record<Category, WithDocId<CorporateCommunication>[]> = {
      Avisos: [], Eventos: [], Seguranca: [], RH: [],
    };
    communications?.forEach(item => {
      if (groups[item.category as Category]) {
        groups[item.category as Category].push(item);
      }
    });
    return groups;
  }, [communications]);

  const handleOpenDialog = (category: Category, item: WithDocId<CorporateCommunication> | null = null) => {
    setDialogState({ isOpen: true, editingItem: item, category });
    if (item) {
      setFormData({
        ...item,
        eventDate: item.eventDate ? format(parseISO(item.eventDate), 'yyyy-MM-dd') : undefined,
      });
    } else {
      setFormData({ category });
    }
  };

  const handleCloseDialog = () => {
    setDialogState({ isOpen: false, editingItem: null });
    setFormData({});
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.title || !formData.content) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Título e conteúdo são obrigatórios.' });
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        eventDate: formData.category === 'Eventos' && formData.eventDate ? new Date(formData.eventDate).toISOString() : null,
      };

      if (dialogState.editingItem) {
        const docRef = doc(firestore, 'communications', dialogState.editingItem.docId);
        await updateDoc(docRef, dataToSave);
        toast({ title: 'Sucesso!', description: 'Comunicação atualizada.' });
      } else {
        await addDoc(collection(firestore, 'communications'), {
          ...dataToSave,
          createdAt: new Date().toISOString(),
        });
        toast({ title: 'Sucesso!', description: 'Nova comunicação criada.' });
      }
      queryClient.invalidateQueries({ queryKey: ['corporate_communications'] });
      handleCloseDialog();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e.message });
    }
  };

  const handleDelete = async (itemId: string) => {
      if(!firestore) return;
      try {
        await deleteDoc(doc(firestore, 'communications', itemId));
        toast({ title: 'Sucesso!', description: 'Comunicação excluída.' });
        queryClient.invalidateQueries({ queryKey: ['corporate_communications'] });
      } catch (e: any) {
         toast({ variant: 'destructive', title: 'Erro ao excluir', description: e.message });
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold">Gerenciamento do Mural</h1>
            <p className="text-muted-foreground">Adicione e edite os comunicados exibidos na página Home.</p>
        </div>
         <Button onClick={() => handleOpenDialog('Avisos')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Comunicação
        </Button>
      </div>
      
      <Tabs defaultValue="Avisos">
        <TabsList className="grid w-full grid-cols-4">
          {(Object.keys(categoryLabels) as Category[]).map(cat => (
            <TabsTrigger key={cat} value={cat}>{categoryLabels[cat]}</TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(categoryLabels) as Category[]).map(category => (
            <TabsContent key={category} value={category}>
                <Card>
                    <CardHeader>
                        <CardTitle>{categoryLabels[category]}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
                         {error && <p className="text-destructive text-center">Erro ao carregar dados.</p>}
                         {!isLoading && groupedCommunications[category].length === 0 && (
                            <p className="text-center text-sm text-muted-foreground py-4">Nenhum item nesta categoria.</p>
                         )}
                         {groupedCommunications[category].map(item => (
                            <div key={item.docId} className="flex items-center justify-between p-3 border rounded-md">
                                <div>
                                    <p className="font-semibold">{item.title}</p>
                                    <p className="text-sm text-muted-foreground truncate max-w-md">{item.content}</p>
                                    {item.category === 'Eventos' && item.eventDate && (
                                        <p className="text-xs text-blue-600 font-medium mt-1">Data do Evento: {format(parseISO(item.eventDate), 'dd/MM/yyyy')}</p>
                                    )}
                                </div>
                                <div className="space-x-2">
                                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(category, item)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                          <AlertDialogDescription>Tem certeza que deseja excluir o item "{item.title}"?</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(item.docId)}>Sim, Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                         ))}
                    </CardContent>
                </Card>
            </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogState.isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{dialogState.editingItem ? 'Editar' : 'Adicionar'} Comunicação</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={formData.category || ''} onValueChange={(v) => setFormData(p => ({...p, category: v as Category}))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(categoryLabels) as Category[]).map(cat => (
                            <SelectItem key={cat} value={cat}>{categoryLabels[cat]}</SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="title">Título</Label>
                    <Input id="title" value={formData.title || ''} onChange={(e) => setFormData(p => ({...p, title: e.target.value}))}/>
                </div>
                {formData.category === 'Eventos' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="eventDate">Data do Evento</Label>
                    <Input id="eventDate" type="date" value={formData.eventDate || ''} onChange={(e) => setFormData(p => ({...p, eventDate: e.target.value}))}/>
                </div>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="content">Conteúdo</Label>
                    <Textarea id="content" value={formData.content || ''} onChange={(e) => setFormData(p => ({...p, content: e.target.value}))} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
