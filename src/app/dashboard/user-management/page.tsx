'use client';

import React from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
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
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Employee } from '@/lib/types';

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
}

function UserRow({ employee }: { employee: Employee }) {
  return (
    <TableRow>
      <TableCell>
        <Avatar>
          <AvatarImage src={employee.photoURL || undefined} alt={`${employee.firstName} ${employee.lastName}`} />
          <AvatarFallback>{getInitials(employee.firstName, employee.lastName)}</AvatarFallback>
        </Avatar>
      </TableCell>
      <TableCell>
        <div className="font-medium">{`${employee.firstName} ${employee.lastName}`}</div>
        <div className="text-sm text-muted-foreground">{employee.email}</div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">{employee.id}</TableCell>
      <TableCell>
        <Badge variant={employee.accessLevel === 'Admin' ? 'default' : 'secondary'}>
          {employee.accessLevel === 'Admin' && <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
          {employee.accessLevel}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function UserListSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[64px]">Avatar</TableHead>
          <TableHead>Usuário</TableHead>
          <TableHead className="hidden sm:table-cell">ID</TableHead>
          <TableHead>Nível de Acesso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(3)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
            <TableCell>
              <div className="space-y-2">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-3 w-[200px]" />
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-[50px]" /></TableCell>
            <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
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

export default function UserManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // 1. Load current user's profile first to determine admin status
  const currentUserDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useDoc<Employee>(currentUserDocRef);

  const isAdmin = currentUserData?.accessLevel === 'Admin';
  
  // 2. Only build the query for all employees if the current user is an admin
  const employeesCollectionRef = useMemoFirebase(
    () => {
      // Do not attempt to query if the current user is still loading or is not an admin
      if (isCurrentUserLoading || !isAdmin) {
        return null;
      }
      return query(collection(firestore, 'employees'), orderBy('id'));
    },
    [firestore, isCurrentUserLoading, isAdmin]
  );

  // 3. Fetch all employees, this will only run if the ref is not null
  const { data: employees, isLoading: areEmployeesLoading, error } = useCollection<Employee>(employeesCollectionRef);

  // Show skeleton while checking for admin permission
  if (isCurrentUserLoading) {
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
  
  // If not an admin after checking, show access denied
  if (!isAdmin) {
      return <AccessDeniedCard />;
  }

  // If admin, show the user management table
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Usuários</CardTitle>
        <CardDescription>
          Visualize e gerencie os usuários do sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
         <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-[64px]">Avatar</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden sm:table-cell">ID</TableHead>
                <TableHead>Nível de Acesso</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {areEmployeesLoading && (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[150px]" />
                          <Skeleton className="h-3 w-[200px]" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-[50px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-destructive">
                    <p>Ocorreu um erro ao carregar os usuários.</p>
                    <p className="text-xs">{error.message}</p>
                    </TableCell>
                </TableRow>
                )}
                {!areEmployeesLoading && !error && employees?.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center">
                    Nenhum usuário encontrado.
                    </TableCell>
                </TableRow>
                )}
                {employees?.map((employee) => (
                    <UserRow key={employee.id} employee={employee} />
                ))}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
