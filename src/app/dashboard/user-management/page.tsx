'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/firebase';
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ShieldCheck, Settings, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import UserPermissionsDialog from '@/components/UserPermissionsDialog';

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
}

export default function UserManagementPage() {
  const firestore = useFirestore();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [permissionsEmployee, setPermissionsEmployee] = useState<WithDocId<Employee> | null>(null);

  const employeesQueryKey = ['employeesForManagement'];
  const employeesCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'employees'), orderBy('id')) : null),
    [firestore]
  );

  const { data: employees, isLoading, error } = useCollection<WithDocId<Employee>>(employeesCollectionRef, {
    queryKey: employeesQueryKey,
  });

  const handleApproveUser = async (employeeId: string) => {
    if (!firestore) return;
    setIsProcessing(employeeId);
    try {
        const employeeRef = doc(firestore, 'employees', employeeId);
        await updateDoc(employeeRef, { status: 'Ativo' });
        toast({ title: 'Sucesso!', description: 'Usuário aprovado e ativado.' });
        queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    } catch (err) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível aprovar o usuário.' });
        console.error(err);
    } finally {
        setIsProcessing(null);
    }
  }

  const handleDeleteUser = async (employee: WithDocId<Employee>) => {
    if (!firestore) return;
    setIsProcessing(employee.docId);
    try {
        const employeeRef = doc(firestore, 'employees', employee.docId);
        await deleteDoc(employeeRef);
        // Note: This does not delete the user from Firebase Auth to avoid accidental permanent deletion.
        // That should be a separate, more deliberate action.
        toast({ title: 'Sucesso!', description: 'Registro de funcionário excluído. A conta de autenticação ainda existe.' });
        queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    } catch (err) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o funcionário.' });
        console.error(err);
    } finally {
        setIsProcessing(null);
    }
  }

  const handlePermissionsChanged = () => {
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
  };

  const getStatusBadge = (status?: string) => {
      const currentStatus = status || 'Pendente';
      switch (currentStatus) {
          case 'Ativo':
              return <Badge variant="success">Ativo</Badge>;
          case 'Pendente':
              return <Badge variant="warning">Pendente</Badge>;
          default:
              return <Badge variant="destructive">{currentStatus}</Badge>;
      }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gerenciamento de Usuários e Permissões</h1>

      <Card>
        <CardHeader>
          <CardTitle>Controle de Acesso</CardTitle>
          <CardDescription>
            Gerencie o status e as permissões de acesso de cada funcionário no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Nível de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Matrícula</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                [...Array(5)].map((_, i) => (
                    <TableRow key={`skeleton-row-${i}`}>
                        <TableCell>
                          <div className="flex items-center gap-4">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-[150px]" />
                                <Skeleton className="h-3 w-[200px]" />
                              </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                    </TableRow>
                ))
              )}
              {!isLoading && employees?.map((employee) => (
                <TableRow key={employee.docId}>
                    <TableCell>
                        <div className="flex items-center gap-4">
                        <Avatar>
                            <AvatarImage src={employee.photoURL || undefined} alt={`${employee.firstName} ${employee.lastName}`} />
                            <AvatarFallback>{getInitials(employee.firstName, employee.lastName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium">{`${employee.firstName} ${employee.lastName}`}</div>
                            <div className="text-sm text-muted-foreground">{employee.email}</div>
                        </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        {employee.accessLevel === 'Admin' ? <Badge variant={'default'}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Admin</Badge> : <Badge variant={'secondary'}>Técnico</Badge>}
                    </TableCell>
                    <TableCell>{getStatusBadge(employee.status)}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono">{employee.id}</TableCell>
                    <TableCell className="text-right space-x-2">
                        {employee.status !== 'Ativo' && (
                            <Button variant="outline" size="sm" onClick={() => handleApproveUser(employee.docId)} disabled={isProcessing === employee.docId}>
                                {isProcessing === employee.docId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                                Aprovar
                            </Button>
                        )}
                         <Button variant="outline" size="icon" title="Gerenciar Permissões" onClick={() => setPermissionsEmployee(employee)} disabled={isProcessing === employee.docId}>
                            <Settings className="h-4 w-4" />
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" disabled={isProcessing === employee.docId}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem certeza que deseja excluir o registro de <span className="font-bold">{employee.firstName}</span>? A conta de autenticação do usuário não será removida.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(employee)}>Sim, Excluir</AlertDialogAction>
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
      
      <UserPermissionsDialog
        isOpen={!!permissionsEmployee}
        onClose={() => setPermissionsEmployee(null)}
        employee={permissionsEmployee}
        onPermissionsChange={handlePermissionsChanged}
      />
    </div>
  );
}