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
} from 'firebase/firestore';
import type { Budget } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths, format } from 'date-fns';

const BudgetPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBudget, setEditingBudget] = useState<WithDocId<Budget> | null>(null);
  const [formData, setFormData] = useState<Partial<Budget>>({
    costCenter: '',
    sector: '',
    totalAmount: 0,
    spentAmount: 0,
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  });
  const [repeatFor, setRepeatFor] = useState(1);
  
  const budgetsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'budgets')) : null),
    [firestore]
  );
  
  const { data: budgets, isLoading, error } = useCollection<WithDocId<Budget>>(budgetsQuery, {
      queryKey: ['budgets']
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'number' ? Number(value) : value }));
  };

  const handleSelectChange = (id: 'sector' | 'costCenter', value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const resetForm = () => {
    setFormData({
      costCenter: '',
      sector: '',
      totalAmount: 0,
      spentAmount: 0,
      period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    });
    setEditingBudget(null);
    setRepeatFor(1);
  };
  
  const handleOpenDialog = (budget: WithDocId<Budget> | null) => {
    if (budget) {
      setEditingBudget(budget);
      setFormData(budget);
      setRepeatFor(1);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore) return;
    if (!formData.costCenter || !formData.sector || !formData.totalAmount || !formData.period) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Todos os campos são obrigatórios.' });
        return;
    }
    setIsSaving(true);
    
    try {
        if (editingBudget) {
            const dataToSave = { ...formData, spentAmount: formData.spentAmount || 0 };
            const budgetRef = doc(firestore, 'budgets', editingBudget.docId);
            await updateDoc(budgetRef, dataToSave);
            toast({ title: 'Sucesso!', description: 'Orçamento atualizado.' });
        } else {
            // Logic for creating new budgets, potentially in a batch
            const batch = writeBatch(firestore);
            const dataToSave = { 
                costCenter: formData.costCenter,
                sector: formData.sector,
                totalAmount: formData.totalAmount,
                spentAmount: formData.spentAmount || 0,
            };

            const [startYear, startMonth] = (formData.period || '').split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1, 15); // Use mid-month to avoid timezone issues

            for (let i = 0; i < repeatFor; i++) {
                const targetDate = addMonths(startDate, i);
                const period = format(targetDate, 'yyyy-MM');
                const newDocRef = doc(collection(firestore, 'budgets'));
                batch.set(newDocRef, { ...dataToSave, period });
            }
            
            await batch.commit();
            toast({ title: 'Sucesso!', description: `${repeatFor} orçamento(s) cadastrado(s).` });
        }

        queryClient.invalidateQueries({ queryKey: ['budgets'] });
        setIsDialogOpen(false);
        resetForm();
    } catch (e: any) {
        console.error("Erro ao salvar orçamento: ", e);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (budgetId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'budgets', budgetId));
      toast({ title: 'Sucesso!', description: 'Orçamento excluído.' });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (e: any) {
      console.error("Erro ao excluir orçamento: ", e);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: e.message });
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Budget</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Orçamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orçamentos por Setor</CardTitle>
          <CardDescription>
            Defina e acompanhe o orçamento para cada centro de custo e setor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Valor Gasto</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={7} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
              {!isLoading && budgets?.map(budget => {
                const saldo = (budget.totalAmount || 0) - (budget.spentAmount || 0);
                return (
                  <TableRow key={budget.docId}>
                    <TableCell>{budget.period}</TableCell>
                    <TableCell>{budget.costCenter}</TableCell>
                    <TableCell>{budget.sector}</TableCell>
                    <TableCell>{(budget.totalAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell>{(budget.spentAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell className={saldo < 0 ? 'text-destructive' : ''}>{saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(budget)}>
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
                                  Tem certeza que deseja excluir o orçamento para <span className="font-bold">{budget.sector}</span> no período <span className="font-bold">{budget.period}</span>?
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(budget.docId)}>
                                  Sim, Excluir
                              </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Editar Orçamento' : 'Adicionar Novo Orçamento'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="period">Período Inicial (YYYY-MM)</Label>
                    <Input id="period" value={formData.period || ''} onChange={handleInputChange} placeholder="Ex: 2024-08"/>
                </div>
                 {!editingBudget && (
                    <div className="space-y-1">
                        <Label htmlFor="repeatFor">Repetir por (meses)</Label>
                        <Input id="repeatFor" type="number" value={repeatFor} onChange={(e) => setRepeatFor(Math.max(1, Number(e.target.value)))} min="1"/>
                    </div>
                 )}
            </div>
            <div className="space-y-1">
                <Label htmlFor="costCenter">Centro de Custo</Label>
                <Input id="costCenter" value={formData.costCenter || ''} onChange={handleInputChange} placeholder="Ex: Manutenção de Aeronaves"/>
            </div>
             <div className="space-y-1">
                <Label htmlFor="sector">Setor</Label>
                <Select value={formData.sector} onValueChange={(v) => handleSelectChange('sector', v)}>
                    <SelectTrigger id="sector">
                        <SelectValue placeholder="Selecione um setor..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Ferramentaria">Ferramentaria</SelectItem>
                        <SelectItem value="Suprimentos">Suprimentos</SelectItem>
                        <SelectItem value="Engenharia">Engenharia</SelectItem>
                        <SelectItem value="Manutenção">Manutenção</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label htmlFor="totalAmount">Valor Total (R$)</Label>
                <Input id="totalAmount" type="number" value={formData.totalAmount || ''} onChange={handleInputChange} />
            </div>
             <div className="space-y-1">
                <Label htmlFor="spentAmount">Valor Gasto (R$)</Label>
                <Input id="spentAmount" type="number" value={formData.spentAmount || ''} onChange={handleInputChange} disabled={!editingBudget} />
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

export default BudgetPage;
