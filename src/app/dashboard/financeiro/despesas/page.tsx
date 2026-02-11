'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
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
import { PlusCircle, Loader2, Paperclip, Image as ImageIcon, Wallet, ExternalLink, Upload } from 'lucide-react';
import type { Despesa, Employee } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { format } from 'date-fns';

const DespesasPage = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'Outros' as Despesa['category'],
  });
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string>('');

  const expensesQueryKey = 'despesas';
  const expensesCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'expenses'), orderBy('date', 'desc')) : null),
    [firestore]
  );
  
  const { data: expenses, isLoading, error: firestoreError } = useCollection<Despesa>(expensesCollectionRef, {
    queryKey: [expensesQueryKey]
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewExpense((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (value: Despesa['category']) => {
    setNewExpense((prev) => ({ ...prev, category: value }));
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
    setNewExpense({ description: '', amount: '', category: 'Outros' });
    setAttachment(null);
    setAttachmentName('');
  };

  const handleSaveNewExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Descrição e valor são obrigatórios.' });
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

      const attachmentRef = storageRef(storage, `expense_proofs/${user.uid}/${Date.now()}-${attachmentName}`);
      const snapshot = await uploadString(attachmentRef, attachment, 'data_url');
      const paymentProofUrl = await getDownloadURL(snapshot.ref);

      const expenseData: Omit<Despesa, 'id'> = {
        description: newExpense.description,
        amount: amountNumber,
        category: newExpense.category,
        date: new Date().toISOString(),
        paymentProofUrl: paymentProofUrl,
        employeeId: user.uid,
        employeeName: user.displayName || user.email || 'Desconhecido',
      };
      
      const docRef = await addDoc(collection(firestore, 'expenses'), expenseData);
      
      toast({ title: "Sucesso!", description: "Despesa registrada." });
      
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
            Registro de Despesas
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
                    <Label htmlFor="category">Categoria</Label>
                    <Select onValueChange={handleSelectChange} defaultValue={newExpense.category}>
                        <SelectTrigger id="category">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Suprimentos">Suprimentos</SelectItem>
                            <SelectItem value="Manutenção">Manutenção</SelectItem>
                            <SelectItem value="Administrativo">Administrativo</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
                <Label>Comprovante</Label>
                 {attachment ? (
                    <div className="relative group aspect-video w-full border rounded-md overflow-hidden">
                       <Image src={attachment} alt="Preview do comprovante" layout="fill" objectFit="contain" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="secondary" size="sm" onClick={() => setAttachment(null)}>Alterar</Button>
                       </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80">
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
          <CardTitle>Histórico de Despesas</CardTitle>
          <CardDescription>
            Visualize as últimas despesas registradas no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Comprovante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : firestoreError ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-destructive">
                        Erro ao carregar despesas. Verifique suas permissões.
                    </TableCell>
                </TableRow>
              ) : expenses && expenses.length > 0 ? (
                expenses.map((expense) => (
                  <TableRow key={expense.docId}>
                    <TableCell className="hidden md:table-cell">{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{expense.employeeName}</TableCell>
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
                  <TableCell colSpan={6} className="text-center">
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

export default DespesasPage;
