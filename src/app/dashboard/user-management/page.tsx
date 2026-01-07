'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, orderBy, updateDoc } from 'firebase/firestore';
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
import { AlertTriangle, ShieldCheck, Settings, CheckCircle, Loader2 } from 'lucide-react';
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import UserPermissionsDialog from '@/components/UserPermissionsDialog';
import { useQueryClient } from '@tanstack/react-query';


function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
}

function UserRow({ employee, onEditPermissions, onApprove, isProcessingId }: { employee: WithDocId<Employee>, onEditPermissions: (employee: WithDocId<Employee>) => void, onApprove: (employeeId: string) => void, isProcessingId: string | null }) {
  
  const getAccessLevelBadge = () => {
    if (employee.accessLevel === 'Admin') {
       return (
        <Badge variant={'default'}>
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Admin
        </Badge>
       )
    }
     return (
        <Badge variant={'secondary'}>
          Técnico
        </Badge>
       )
  }

  const getStatusBadge = () => {
      switch (employee.status) {
          case 'Ativo':
              return <Badge variant="success">Ativo</Badge>;
          case 'Pendente':
              return <Badge variant="warning">Pendente</Badge>;
          default:
              return <Badge variant="destructive">{employee.status}</Badge>;
      }
  }


  return (
    <TableRow>
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
      <TableCell>{getAccessLevelBadge()}</TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell className="hidden md:table-cell">{employee.id}</TableCell>
       <TableCell className="text-right space-x-2">
         {employee.status === 'Pendente' && (
            <Button variant="outline" size="sm" onClick={() => onApprove(employee.docId)} disabled={isProcessingId === employee.docId}>
                {isProcessingId === employee.docId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                Aprovar
            </Button>
         )}
        <Button variant="ghost" size="icon" onClick={() => onEditPermissions(employee)} title="Gerenciar permissões" disabled={!!isProcessingId}>
          <Settings className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function UserListSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuário</TableHead>
          <TableHead>Nível de Acesso</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">ID do usuário</TableHead>
           <TableHead>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(3)].map((_, i) => (
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
            <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AccessDeniedCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Gerenciamento de Usuários</CardTitle>
                <CardDescription>
                Visualize e gerencie os usuários do sistema.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <h3 className="text-xl font-semibold">Acesso Negado</h3>
                    <p className="text-muted-foreground">
                    Você não tem permissão para visualizar esta página. Apenas administradores podem gerenciar usuários.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function AdminUserManagement() {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<WithDocId<Employee> | null>(null);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const employeesQueryKey = ['employees'];
  const employeesCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'employees'), orderBy('id')) : null),
    [firestore]
  );

  const { data: employees, isLoading, error } = useCollection<Employee>(employeesCollectionRef, {
    queryKey: employeesQueryKey,
  });

  const handleEditPermissions = (employee: WithDocId<Employee>) => {
    setSelectedEmployee(employee);
    setIsPermissionsDialogOpen(true);
  };
  
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>
            Visualize, aprove e gerencie as permissões dos usuários do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Nível de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">ID do usuário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !error && <UserListSkeleton />}
              {error && (
                <TableRow key="error-row">
                  <TableCell colSpan={5} className="text-center text-destructive">
                    <p>Ocorreu um erro ao carregar os usuários.</p>
                    <p className="text-xs">{error.message}</p>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && employees?.length === 0 && (
                <TableRow key="no-results-row">
                  <TableCell colSpan={5} className="text-center h-24">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
              {employees?.map((employee) => (
                <UserRow
                  key={employee.docId}
                  employee={employee}
                  onEditPermissions={handleEditPermissions}
                  onApprove={handleApproveUser}
                  isProcessingId={isProcessing}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserPermissionsDialog
        isOpen={isPermissionsDialogOpen}
        onClose={() => setIsPermissionsDialogOpen(false)}
        employee={selectedEmployee}
        onPermissionsChange={() => queryClient.invalidateQueries({ queryKey: employeesQueryKey })}
      />
    </>
  );
}


export default function UserManagementPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const currentUserDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useDoc<Employee>(currentUserDocRef);
  
  useEffect(() => {
    if (currentUserData) {
      setIsAdmin(currentUserData.accessLevel === 'Admin');
    }
  }, [currentUserData]);


  if (isCurrentUserLoading || isAdmin === null) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Gerenciamento de Usuários</CardTitle>
                <CardDescription>
                Visualize e gerencie os usuários do sistema.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <UserListSkeleton />
            </CardContent>
        </Card>
    );
  }
  
  if (!isAdmin) {
      return <AccessDeniedCard />;
  }

  return <AdminUserManagement />;
}
