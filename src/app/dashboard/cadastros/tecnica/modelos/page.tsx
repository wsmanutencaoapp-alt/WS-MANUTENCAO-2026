
'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import type { AircraftModel, EngineModel, APUModel, PropellerModel } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Plane, Settings2, Zap, Wind } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type ModelType = 'Aeronave' | 'Motor' | 'APU' | 'Hélice';

export default function ModelosTecnicaPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ModelType>('Aeronave');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingModel, setEditingModel] = useState<WithDocId<any> | null>(null);
  
  const [formData, setFormData] = useState({
    manufacturer: '',
    name: '',
    numEngines: 0,
    numPropellers: 0,
    numAPUs: 0,
    partNumber: '',
  });

  const getCollectionName = (type: ModelType) => {
    switch (type) {
      case 'Aeronave': return 'aircraft_models';
      case 'Motor': return 'engine_models';
      case 'APU': return 'apu_models';
      case 'Hélice': return 'propeller_models';
    }
  };

  const currentQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, getCollectionName(activeTab)), orderBy('name')) : null
  ), [firestore, activeTab]);

  const { data: models, isLoading } = useCollection<WithDocId<any>>(currentQuery, {
    queryKey: ['models', activeTab]
  });

  const handleOpenDialog = (model: WithDocId<any> | null = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        manufacturer: model.manufacturer,
        name: model.name,
        numEngines: model.numEngines || 0,
        numPropellers: model.numPropellers || 0,
        numAPUs: model.numAPUs || 0,
        partNumber: model.partNumber || '',
      });
    } else {
      setEditingModel(null);
      setFormData({ manufacturer: '', name: '', numEngines: 0, numPropellers: 0, numAPUs: 0, partNumber: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.manufacturer || !formData.name) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Fabricante e Modelo são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    const collectionName = getCollectionName(activeTab);
    
    let dataToSave: any = {
        manufacturer: formData.manufacturer,
        name: formData.name,
    };

    if (activeTab === 'Aeronave') {
        dataToSave = {
            ...dataToSave,
            numEngines: Number(formData.numEngines) || 0,
            numPropellers: Number(formData.numPropellers) || 0,
            numAPUs: Number(formData.numAPUs) || 0,
        };
    } else {
        dataToSave = {
            ...dataToSave,
            partNumber: formData.partNumber || '',
        };
    }

    try {
      if (editingModel) {
        await updateDoc(doc(firestore, collectionName, editingModel.docId), dataToSave);
        toast({ title: 'Sucesso', description: 'Modelo atualizado.' });
      } else {
        await addDoc(collection(firestore, collectionName), dataToSave);
        toast({ title: 'Sucesso', description: 'Modelo cadastrado.' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar o modelo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, getCollectionName(activeTab), id));
      toast({ title: 'Sucesso', description: 'Modelo excluído.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o modelo.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Modelos Técnicos</h1>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Modelo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModelType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="Aeronave"><Plane className="mr-2 h-4 w-4" /> Aeronaves</TabsTrigger>
          <TabsTrigger value="Motor"><Settings2 className="mr-2 h-4 w-4" /> Motores</TabsTrigger>
          <TabsTrigger value="APU"><Zap className="mr-2 h-4 w-4" /> APU</TabsTrigger>
          <TabsTrigger value="Hélice"><Wind className="mr-2 h-4 w-4" /> Hélices</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Modelos de {activeTab}s</CardTitle>
            <CardDescription>Gerencie o catálogo de {activeTab.toLowerCase()}s para controle de tarefas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Modelo</TableHead>
                  {activeTab === 'Aeronave' ? (
                      <>
                        <TableHead className="text-center">Motores</TableHead>
                        <TableHead className="text-center">Hélices</TableHead>
                        <TableHead className="text-center">APU</TableHead>
                      </>
                  ) : (
                      <TableHead>Part Number (PN)</TableHead>
                  )}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={activeTab === 'Aeronave' ? 6 : 4} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                {!isLoading && models?.map((model) => (
                  <TableRow key={model.docId}>
                    <TableCell className="font-medium">{model.manufacturer}</TableCell>
                    <TableCell>{model.name}</TableCell>
                    {activeTab === 'Aeronave' ? (
                        <>
                            <TableCell className="text-center">{model.numEngines || 0}</TableCell>
                            <TableCell className="text-center">{model.numPropellers || 0}</TableCell>
                            <TableCell className="text-center">{model.numAPUs || 0}</TableCell>
                        </>
                    ) : (
                        <TableCell>{model.partNumber || '-'}</TableCell>
                    )}
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(model)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>Deseja excluir o modelo {model.name}?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(model.docId)}>Excluir</AlertDialogAction>
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
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Editar' : 'Adicionar Novo'} Modelo de {activeTab}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" value={formData.manufacturer} onChange={(e) => setFormData(p => ({...p, manufacturer: e.target.value}))} placeholder="Ex: Beechcraft, Pratt & Whitney" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Modelo</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} placeholder="Ex: King Air B200, PT6A-42" />
            </div>
            
            {activeTab === 'Aeronave' ? (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="numEngines">Nº de Motores</Label>
                        <Input id="numEngines" type="number" value={formData.numEngines} onChange={(e) => setFormData(p => ({...p, numEngines: parseInt(e.target.value) || 0}))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="numPropellers">Nº de Hélices</Label>
                        <Input id="numPropellers" type="number" value={formData.numPropellers} onChange={(e) => setFormData(p => ({...p, numPropellers: parseInt(e.target.value) || 0}))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="numAPUs">Nº de APU</Label>
                        <Input id="numAPUs" type="number" value={formData.numAPUs} onChange={(e) => setFormData(p => ({...p, numAPUs: parseInt(e.target.value) || 0}))} />
                    </div>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <Label htmlFor="partNumber">Part Number (PN)</Label>
                    <Input id="partNumber" value={formData.partNumber} onChange={(e) => setFormData(p => ({...p, partNumber: e.target.value}))} placeholder="Ex: 3034500-01" />
                </div>
            )}
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
}
