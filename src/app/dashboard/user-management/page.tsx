'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
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
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';

function UserRow({ employee }: { employee: Employee }) {
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
  };

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

export default function UserManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const currentUserDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useDoc<Employee>(currentUserDocRef);
  const isAdmin = currentUserData?.accessLevel === 'Admin';

  const employeesCollectionRef = useMemoFirebase(
    () => (firestore && isAdmin ? query(collection(firestore, 'employees'), orderBy('id')) : null),
    [firestore, isAdmin]
  );
  const { data: employees, isLoading: areEmployeesLoading, error } = useCollection<Employee>(employeesCollectionRef);


  const renderContent = () => {
    if (isCurrentUserLoading) {
      return <UserListSkeleton />;
    }

    if (!isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="text-xl font-semibold">Acesso Negado</h3>
            <p className="text-muted-foreground">
              Você não tem permissão para visualizar esta página. Apenas administradores podem gerenciar usuários.
            </p>
        </div>
      );
    }
    
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
            {areEmployeesLoading && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <UserListSkeleton />
                  </TableCell>
                </TableRow>
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
            {!areEmployeesLoading && employees?.map((employee) => (
              <UserRow key={employee.uid} employee={employee} />
            ))}
          </TableBody>
        </Table>
    );
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
        {renderContent()}
      </CardContent>
    </Card>
  );
}
