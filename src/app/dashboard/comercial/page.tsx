'use client';

import { ReorderSuggestions } from '@/components/reorder-suggestions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Wrench, Box, Activity } from 'lucide-react';
import type { Tool, Supply } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const firestore = useFirestore();

  const toolsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), where('sequencial', '>', 0)) : null),
    [firestore]
  );
  const { data: tools, isLoading: isLoadingTools, error: toolsError } = useCollection<Tool>(toolsQuery);

  const suppliesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'supplies') : null),
    [firestore]
  );
  const { data: supplies, isLoading: isLoadingSupplies, error: suppliesError } = useCollection<Supply>(suppliesQuery);

  const activeLoansQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), where('status', '==', 'Em Empréstimo')) : null),
    [firestore]
  );
  const { data: loanedTools, isLoading: isLoadingLoans, error: loansError } = useCollection<Tool>(activeLoansQuery);

  const overdueToolsQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'tools'), where('status', '==', 'Vencido')) : null),
      [firestore]
  );
  const { data: overdueTools, isLoading: isLoadingOverdue, error: overdueError } = useCollection<Tool>(overdueToolsQuery);


  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total de Ferramentas
          </CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoadingTools ? (
            <Skeleton className="h-8 w-1/2" />
          ) : toolsError ? (
            <div className="text-sm font-bold text-muted-foreground">N/A</div>
          ) : (
            <div className="text-2xl font-bold">{tools?.length || 0}</div>
          )}
          <p className="text-xs text-muted-foreground">
            Total de ferramentas no inventário
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Itens de Suprimento
          </CardTitle>
          <Box className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           {isLoadingSupplies ? (
            <Skeleton className="h-8 w-1/2" />
          ) : suppliesError ? (
            <div className="text-sm font-bold text-muted-foreground">N/A</div>
          ) : (
             <div className="text-2xl font-bold">{supplies?.length || 0}</div>
          )}
          <p className="text-xs text-muted-foreground">
            Tipos de suprimentos cadastrados
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Empréstimos Ativos</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           {isLoadingLoans ? (
            <Skeleton className="h-8 w-1/2" />
          ) : loansError ? (
            <div className="text-sm font-bold text-muted-foreground">N/A</div>
          ) : (
            <div className="text-2xl font-bold">{loanedTools?.length || 0}</div>
          )}
          <p className="text-xs text-muted-foreground">
            Ferramentas emprestadas no momento
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Aferições Vencidas</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           {isLoadingOverdue ? (
            <Skeleton className="h-8 w-1/2" />
          ) : overdueError ? (
             <div className="text-sm font-bold text-muted-foreground">N/A</div>
          ) : (
             <div className="text-2xl font-bold text-destructive">{overdueTools?.length || 0}</div>
          )}
          <p className="text-xs text-muted-foreground">
            Ferramentas com calibração vencida
          </p>
        </CardContent>
      </Card>
      <div className="col-span-1 lg:col-span-4">
        <ReorderSuggestions />
      </div>
    </div>
  );
}
