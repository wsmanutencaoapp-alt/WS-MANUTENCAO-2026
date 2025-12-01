'use client';

import React, { useMemo } from 'react';
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
      <TableCell>{employee.id}</TableCell>
      <TableCell>
        <Badge variant={employee.accessLevel === 'Admin' ? 'default' : 'secondary'}>
          {employee.accessLevel === 'Admin' && <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
          {employee.accessLevel}
        </Badge>
      </TableCell>
      <TableCell>{employee.id}</TableCell>
    </TableRow>
  );
}

function UserListSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuário</TableHead>
          <TableHead>EMPLOYEE</TableHead>
          <TableHead>Nível de Acesso</TableHead>
          <TableHead>ID do usuário</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(3)].map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-3 w-[200px]" />
                </div>
              </div>
            </TableCell>
            <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
            <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
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

  const currentUserDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useDoc<Employee>(currentUserDocRef);
  
  const isAdmin = useMemo(() => currentUserData?.accessLevel === 'Admin', [currentUserData]);

  const employeesCollectionRef = useMemoFirebase(
    () => {
      // Only return a query if the user is confirmed to be an admin
      if (!isCurrentUserLoading && isAdmin && firestore) {
        return query(collection(firestore, 'employees'), orderBy('id'));
      }
      return null; // Return null if not admin or still loading
    },
    [firestore, isCurrentUserLoading, isAdmin]
  );

  const { data: employees, isLoading: areEmployeesLoading, error } = useCollection<Employee>(employeesCollectionRef);

  // Show skeleton while checking current user's permission
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
  
  // Show access denied if not an admin
  if (!isAdmin) {
      return <AccessDeniedCard />;
  }

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
                  <TableHead>Usuário</TableHead>
                  <TableHead>EMPLOYEE</TableHead>
                  <TableHead>Nível de Acesso</TableHead>
                  <TableHead>ID do usuário</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {(areEmployeesLoading || !employees) && !error && (
                  [...Array(3)].map((_, i) => (
                     <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[150px]" />
                            <Skeleton className="h-3 w-[200px]" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
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
