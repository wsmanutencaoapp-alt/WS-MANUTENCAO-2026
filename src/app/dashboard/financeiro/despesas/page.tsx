'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Search } from 'lucide-react';
import type { Despesa } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { format } from 'date-fns';

const GerenciarDespesasPage = () => {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const expensesQueryKey = 'all_expenses_admin';
  const expensesCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'expenses'), orderBy('date', 'desc')) : null),
    [firestore]
  );
  
  const { data: expenses, isLoading, error: firestoreError } = useCollection<WithDocId<Despesa>>(expensesCollectionRef, {
    queryKey: [expensesQueryKey],
  });
  
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!searchTerm) return expenses;
    const lowerTerm = searchTerm.toLowerCase();
    return expenses.filter(exp => 
        exp.description.toLowerCase().includes(lowerTerm) ||
        exp.employeeName.toLowerCase().includes(lowerTerm) ||
        exp.category.toLowerCase().includes(lowerTerm)
    );
  }, [expenses, searchTerm]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gerenciamento de Despesas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Relatório Geral de Despesas</CardTitle>
          <CardDescription>
            Visualize e administre todas as despesas registradas no sistema.
          </CardDescription>
          <div className="relative pt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Pesquisar por descrição, funcionário ou categoria..."
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
                <TableHead>Funcionário</TableHead>
                <TableHead>Descrição</TableHead>
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
                        Erro ao carregar despesas: {firestoreError.message}
                    </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Nenhuma despesa encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.docId}>
                    <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{expense.employeeName}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.category}</TableCell>
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
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GerenciarDespesasPage;
