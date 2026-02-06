'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { Visit } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogOut, Users } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type VisitWithId = WithDocId<Visit>;

const ControlePessoasPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitWithId | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    documentNumber: '',
    company: '',
    personToVisit: '',
    reason: '',
  });

  const visitsQueryKey = 'visits';
  const visitsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'visits'), orderBy('entryTimestamp', 'desc')) : null),
    [firestore]
  );
  
  const { data: visits, isLoading, error } = useCollection<VisitWithId>(visitsQuery, { queryKey: [visitsQueryKey] });

  const currentVisitors = useMemo(() => visits?.filter(v => v.status === 'Dentro') || [], [visits]);
  const visitHistory = useMemo(() => visits?.filter(v => v.status === 'Fora') || [], [visits]);

  const resetForm = () => {
    setFormData({ name: '', documentNumber: '', company: '', personToVisit: '', reason: '' });
    setSelectedVisitor(null);
  };

  const handleOpenEntryDialog = () => {
    resetForm();
    setIsEntryDialogOpen(true);
  };
  
  const handleOpenExitDialog = (visitor: VisitWithId) => {
    setSelectedVisitor(visitor);
    setIsExitDialogOpen(true);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleEntry = async () => {
    if (!firestore) return;
    const { name, documentNumber, company, personToVisit, reason } = formData;
    if (!name || !documentNumber || !company || !personToVisit || !reason) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Todos os campos são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    const newVisit: Omit<Visit, 'id'> = {
      name,
      documentNumber,
      company,
      personToVisit,
      reason,
      entryTimestamp: new Date().toISOString(),
      status: 'Dentro',
    };

    try {
      await addDoc(collection(firestore, 'visits'), newVisit);
      toast({ title: 'Sucesso!', description: 'Entrada de visitante registrada.' });
      queryClient.invalidateQueries({ queryKey: [visitsQueryKey] });
      setIsEntryDialogOpen(false);
    } catch (e: any) {
      console.error("Erro ao registrar entrada:", e);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar a entrada.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleExit = async () => {
      if (!firestore || !selectedVisitor) return;
      setIsSaving(true);
      
      try {
          const visitRef = doc(firestore, 'visits', selectedVisitor.docId);
          await updateDoc(visitRef, {
              status: 'Fora',
              exitTimestamp: new Date().toISOString()
          });
          toast({ title: 'Sucesso!', description: 'Saída de visitante registrada.' });
          queryClient.invalidateQueries({ queryKey: [visitsQueryKey] });
          setIsExitDialogOpen(false);
      } catch (e: any) {
          console.error("Erro ao registrar saída:", e);
          toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar a saída.' });
      } finally {
          setIsSaving(false);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Controle de Pessoas</h1>
        <Button onClick={handleOpenEntryDialog}>
          <UserPlus className="mr-2 h-4 w-4" />
          Registrar Entrada
        </Button>
      </div>
      
      <Tabs defaultValue="presentes">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presentes">
                <Users className="mr-2 h-4 w-4"/> Visitantes Presentes ({currentVisitors.length})
            </TabsTrigger>
            <TabsTrigger value="historico">
                Histórico de Visitas
            </TabsTrigger>
        </TabsList>
        <TabsContent value="presentes">
            <Card>
                <CardHeader>
                <CardTitle>Visitantes Atualmente no Local</CardTitle>
                <CardDescription>Pessoas que registraram entrada e ainda não saíram.</CardDescription>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Empresa</TableHead><TableHead>Visitando</TableHead><TableHead>Entrada</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                        {!isLoading && currentVisitors.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum visitante presente.</TableCell></TableRow>}
                        {!isLoading && currentVisitors.map(v => (
                            <TableRow key={v.docId}>
                                <TableCell><div className="font-medium">{v.name}</div><div className="text-sm text-muted-foreground">{v.documentNumber}</div></TableCell>
                                <TableCell>{v.company}</TableCell>
                                <TableCell>{v.personToVisit}</TableCell>
                                <TableCell>{format(new Date(v.entryTimestamp), 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleOpenExitDialog(v)}><LogOut className="mr-2 h-4 w-4" /> Registrar Saída</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>
         <TabsContent value="historico">
            <Card>
                <CardHeader><CardTitle>Histórico de Visitas</CardTitle><CardDescription>Registros de visitantes que já saíram.</CardDescription></CardHeader>
                <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Empresa</TableHead><TableHead>Entrada</TableHead><TableHead>Saída</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                        {!isLoading && visitHistory.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum registro no histórico.</TableCell></TableRow>}
                        {!isLoading && visitHistory.map(v => (
                            <TableRow key={v.docId}>
                                <TableCell><div className="font-medium">{v.name}</div><div className="text-sm text-muted-foreground">{v.documentNumber}</div></TableCell>
                                <TableCell>{v.company}</TableCell>
                                <TableCell>{format(new Date(v.entryTimestamp), 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell>{v.exitTimestamp ? format(new Date(v.exitTimestamp), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      {/* Entry Dialog */}
      <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Registrar Entrada de Visitante</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={formData.name} onChange={handleInputChange} /></div>
                    <div className="space-y-1"><Label htmlFor="documentNumber">Documento (RG/CPF)</Label><Input id="documentNumber" value={formData.documentNumber} onChange={handleInputChange} /></div>
                </div>
                <div className="space-y-1"><Label htmlFor="company">Empresa</Label><Input id="company" value={formData.company} onChange={handleInputChange} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label htmlFor="personToVisit">Pessoa a Visitar</Label><Input id="personToVisit" value={formData.personToVisit} onChange={handleInputChange} /></div>
                    <div className="space-y-1"><Label htmlFor="reason">Motivo da Visita</Label><Input id="reason" value={formData.reason} onChange={handleInputChange} /></div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEntryDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleEntry} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Entrada
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Exit Dialog */}
      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Registrar Saída</DialogTitle></DialogHeader>
            <div className="py-4">
                <p>Confirmar a saída de <span className="font-bold">{selectedVisitor?.name}</span> da empresa <span className="font-bold">{selectedVisitor?.company}</span>?</p>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsExitDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleExit} disabled={isSaving}>
                     {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Saída
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ControlePessoasPage;
