'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadString,
  getDownloadURL,
} from 'firebase/storage';
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Paperclip, Image as ImageIcon, Wallet, ExternalLink, Upload, Search } from 'lucide-react';
import type { Despesa, Employee, CostCenter } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';


const MinhasDespesasIndividuaisPage = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSaving, setIsSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'Outros' as Despesa['category'],
    otherCategoryDetail: '',
    costCenterId: '',
  });
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const expensesQueryKey = ['my_expenses', user?.uid];
  const expensesCollectionRef = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'expenses'), where('employeeId', '==', user.uid), orderBy('date', 'desc')) : null),
    [firestore, user]
  );
  
  const { data: expenses, isLoading, error: firestoreError } = useCollection<WithDocId<Despesa>>(expensesCollectionRef, {
    queryKey: expensesQueryKey,
    enabled: !!user,
  });

  const costCentersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'cost_centers')) : null),
    [firestore]
  );
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['all_cost_centers_for_expenses']
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!searchTerm) return expenses;
    const lowerTerm = searchTerm.toLowerCase();
    return expenses.filter(exp => 
        exp.description.toLowerCase().includes(lowerTerm) ||
        exp.category.toLowerCase().includes(lowerTerm) ||
        (exp.otherCategoryDetail && exp.otherCategoryDetail.toLowerCase().includes(lowerTerm)) ||
        (exp.costCenterCode && exp.costCenterCode.toLowerCase().includes(lowerTerm)) ||
        exp.amount.toString().includes(lowerTerm)
    );
  }, [expenses, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setNewExpense((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: 'category' | 'costCenterId', value: string) => {
    setNewExpense((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
        setAttachmentName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setNewExpense({ description: '', amount: '', category: 'Outros', otherCategoryDetail: '', costCenterId: '' });
    setAttachment(null);
    setAttachmentName('');
  };

  const handleSaveNewExpense = async () => {
    if (!newExpense.description || !newExpense.amount || !newExpense.costCenterId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Descrição, valor e centro de custo são obrigatórios.' });
      return;
    }
    if (newExpense.category === 'Outros' && !newExpense.otherCategoryDetail) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, especifique a categoria "Outros".' });
      return;
    }
    if (!attachment) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O anexo do comprovante é obrigatório.' });
      return;
    }
    if (!user || !firestore || !storage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou falha na conexão.' });
      return;
    }

    setIsSaving(true);
    
    try {
      const amountNumber = parseFloat(newExpense.amount.replace(',', '.'));
      if (isNaN(amountNumber)) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Valor inválido.' });
          setIsSaving(false);
          return;
      }

      const selectedCostCenter = costCenters?.find(cc => cc.docId === newExpense.costCenterId);
      if (!selectedCostCenter) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Centro de custo inválido.' });
          setIsSaving(false);
          return;
      }

      const attachmentRef = storageRef(storage, `expense_proofs/${user.uid}/${Date.now()}-${attachmentName}`);
      const snapshot = await uploadString(attachmentRef, attachment, 'data_url');
      const paymentProofUrl = await getDownloadURL(snapshot.ref);

      const expenseData: Omit<Despesa, 'id'> = {
        description: newExpense.description,
        amount: amountNumber,
        category: newExpense.category,
        otherCategoryDetail: newExpense.category === 'Outros' ? newExpense.otherCategoryDetail : undefined,
        costCenterId: newExpense.costCenterId,
        costCenterCode: selectedCostCenter.code,
        date: new Date().toISOString(),
        paymentProofUrl: paymentProofUrl,
        employeeId: user.uid,
        employeeName: user.displayName || user.email || 'Desconhecido',
      };
      
      await addDoc(collection(firestore, 'expenses'), expenseData);
      
      toast({ title: "Sucesso!", description: "Despesa registrada." });
      queryClient.invalidateQueries({ queryKey: expensesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['all_expenses_admin'] });
      
      resetForm();

    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: `Não foi possível registrar a despesa.` });
      if (error instanceof Error && error.message.includes('permission-denied')) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'expenses/{expenseId}',
          operation: 'create',
          requestResourceData: newExpense
        }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet />
            Minhas Despesas Individuais
      </h1>

      <Card>
        <CardHeader>
            <CardTitle>Registrar Nova Despesa</CardTitle>
            <CardDescription>
                Preencha os detalhes da despesa e anexe o comprovante.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
              <div className="grid items-center gap-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={newExpense.description} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="grid items-center gap-1.5">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input id="amount" value={newExpense.amount} onChange={handleInputChange} placeholder="Ex: 150,00" />
                </div>
                <div className="grid items-center gap-1.5">
                    <Label htmlFor="costCenterId">Centro de Custo</Label>
                    <Select onValueChange={(v) => handleSelectChange('costCenterId', v)} value={newExpense.costCenterId} disabled={isLoadingCostCenters}>
                        <SelectTrigger id="costCenterId">
                            <SelectValue placeholder={isLoadingCostCenters ? "Carregando..." : "Selecione..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {costCenters?.map(cc => (
                                <SelectItem key={cc.docId} value={cc.docId}>({cc.code}) {cc.description}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="grid items-center gap-1.5">
                    <Label htmlFor="category">Categoria</Label>
                    <Select onValueChange={(v) => handleSelectChange('category', v as any)} value={newExpense.category}>
                        <SelectTrigger id="category">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Alimentação">Alimentação</SelectItem>
                            <SelectItem value="Hospedagem">Hospedagem</SelectItem>
                            <SelectItem value="Transporte">Transporte</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {newExpense.category === 'Outros' && (
                    <div className="grid items-center gap-1.5 animate-in fade-in-50">
                        <Label htmlFor="otherCategoryDetail">Especifique</Label>
                        <Input id="otherCategoryDetail" value={newExpense.otherCategoryDetail} onChange={handleInputChange} />
                    </div>
                )}
               </div>
            </div>
            <div className="space-y-2">
                <Label>Comprovante</Label>
                 {attachment ? (
                    <div className="relative group aspect-video w-full border rounded-md overflow-hidden">
                       <Image src={attachment} alt="Preview do comprovante" fill objectFit="contain" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="secondary" size="sm" onClick={() => setAttachment(null)}>Alterar</Button>
                       </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                              <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clique para anexar</span> ou arraste</p>
                              <p className="text-xs text-muted-foreground">PDF, PNG, JPG ou GIF</p>
                          </div>
                          <Input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,.pdf" />
                      </label>
                    </div> 
                )}
            </div>
        </CardContent>
         <CardFooter>
            <Button onClick={handleSaveNewExpense} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Despesa
            </Button>
        </CardFooter>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Meu Histórico de Despesas</CardTitle>
          <CardDescription>
            Visualize as despesas que você registrou no sistema.
          </CardDescription>
           <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar nas suas despesas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Comprovante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : firestoreError ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-destructive h-24">
                        Erro ao carregar despesas. Verifique suas permissões.
                    </TableCell>
                </TableRow>
              ) : filteredExpenses && filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.docId}>
                    <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.costCenterCode}</TableCell>
                    <TableCell>{expense.category === 'Outros' ? expense.otherCategoryDetail : expense.category}</TableCell>
                    <TableCell className="text-right">
                        {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="outline" size="icon">
                        <a href={expense.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                           <ExternalLink className="h-4 w-4" />
                           <span className="sr-only">Ver comprovante</span>
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Nenhuma despesa registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MinhasDespesasIndividuaisPage;
