
'use client';

import { useState } from 'react';
import { useCollection, useTechFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Plane, Settings2, Zap, Wind, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type ModelType = 'Aeronave' | 'Motor' | 'APU' | 'Hélice';

export default function ModelosTecnicaPage() {
  const techFirestore = useTechFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ModelType>('Aeronave');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingModel, setEditingModel] = useState<WithDocId<any> | null>(null);
  
  const [formData, setFormData] = useState({
    manufacturer: '',
    model: '',
    engineCount: 0,
    propellerCount: 0,
    apuCount: 0,
    partNumber: '',
  });

  const getCollectionName = (type: ModelType) => {
    switch (type) {
      case 'Aeronave': return 'aircraftModels';
      case 'Motor': return 'engineModels';
      case 'APU': return 'apuModels';
      case 'Hélice': return 'propellerModels';
    }
  };

  const currentCollectionRef = useMemoFirebase(() => (
    techFirestore ? collection(techFirestore, getCollectionName(activeTab)) : null
  ), [techFirestore, activeTab]);

  const { data: models, isLoading, error } = useCollection<WithDocId<any>>(currentCollectionRef, {
    queryKey: ['tech_models_v5', activeTab],
    enabled: !!techFirestore
  });

  const handleOpenDialog = (model: WithDocId<any> | null = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        manufacturer: model.manufacturer || '',
        model: model.model || '',
        engineCount: model.engineCount || 0,
        propellerCount: model.propellerCount || 0,
        apuCount: model.apuCount || 0,
        partNumber: model.partNumber || '',
      });
    } else {
      setEditingModel(null);
      setFormData({ manufacturer: '', model: '', engineCount: 0, propellerCount: 0, apuCount: 0, partNumber: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!techFirestore) return;
    if (!formData.manufacturer || !formData.model) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Fabricante e Modelo são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    const collectionName = getCollectionName(activeTab);
    
    let dataToSave: any = {
        manufacturer: formData.manufacturer,
        model: formData.model,
    };

    if (activeTab === 'Aeronave') {
        dataToSave = {
            ...dataToSave,
            engineCount: Number(formData.engineCount) || 0,
            propellerCount: Number(formData.propellerCount) || 0,
            apuCount: Number(formData.apuCount) || 0,
        };
    } else {
        dataToSave = {
            ...dataToSave,
            partNumber: formData.partNumber || '',
        };
    }

    try {
      if (editingModel) {
        await updateDoc(doc(techFirestore, collectionName, editingModel.docId), dataToSave);
        toast({ title: 'Sucesso', description: 'Modelo atualizado.' });
      } else {
        await addDoc(collection(techFirestore, collectionName), dataToSave);
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
    if (!techFirestore) return;
    try {
      await deleteDoc(doc(techFirestore, getCollectionName(activeTab), id));
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
            <CardDescription>Gerencie o catálogo técnico na instância operation-manager.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro de Permissão</AlertTitle>
                    <AlertDescription>
                        O acesso ao banco <strong>operation-manager</strong> foi negado. 
                        Certifique-se de que as novas regras de segurança foram publicadas para este banco de dados no Console do Firebase.
                    </AlertDescription>
                </Alert>
            )}

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
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                {!isLoading && models?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Nenhum modelo encontrado no banco operation-manager.</TableCell></TableRow>}
                {!isLoading && models?.map((model) => (
                  <TableRow key={model.docId}>
                    <TableCell className="font-medium">{model.manufacturer}</TableCell>
                    <TableCell>{model.model}</TableCell>
                    {activeTab === 'Aeronave' ? (
                        <>
                            <TableCell className="text-center">{model.engineCount || 0}</TableCell>
                            <TableCell className="text-center">{model.propellerCount || 0}</TableCell>
                            <TableCell className="text-center">{model.apuCount || 0}</TableCell>
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
                            <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
                            <AlertDialogDescription>Deseja excluir o modelo {model.model}?</AlertDialogDescription>
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
            <DialogTitle>{editingModel ? 'Editar' : 'Adicionar'} Modelo de {activeTab}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" value={formData.manufacturer} onChange={(e) => setFormData(p => ({...p, manufacturer: e.target.value.toUpperCase()}))} placeholder="Ex: CESSNA, BEECHCRAFT" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" value={formData.model} onChange={(e) => setFormData(p => ({...p, model: e.target.value.toUpperCase()}))} placeholder="Ex: 525, B200" />
            </div>
            
            {activeTab === 'Aeronave' ? (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="engineCount">Nº de Motores</Label>
                        <Input id="engineCount" type="number" value={formData.engineCount} onChange={(e) => setFormData(p => ({...p, engineCount: parseInt(e.target.value) || 0}))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="propellerCount">Nº de Hélices</Label>
                        <Input id="propellerCount" type="number" value={formData.propellerCount} onChange={(e) => setFormData(p => ({...p, propellerCount: parseInt(e.target.value) || 0}))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="apuCount">Nº de APU</Label>
                        <Input id="apuCount" type="number" value={formData.apuCount} onChange={(e) => setFormData(p => ({...p, apuCount: parseInt(e.target.value) || 0}))} />
                    </div>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <Label htmlFor="partNumber">Part Number (PN)</Label>
                    <Input id="partNumber" value={formData.partNumber} onChange={(e) => setFormData(p => ({...p, partNumber: e.target.value.toUpperCase()}))} placeholder="Ex: 3034500-01" />
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
