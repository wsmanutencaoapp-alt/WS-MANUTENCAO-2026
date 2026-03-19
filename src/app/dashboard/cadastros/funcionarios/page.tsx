
'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, orderBy, updateDoc, setDoc, getDocs, limit, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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
import { ShieldCheck, Loader2, PlusCircle, User, Search, Edit } from 'lucide-react';
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import EditFuncionarioDialog from '@/components/EditFuncionarioDialog';

const formSchema = z.object({
  firstName: z.string().min(1, 'O nome é obrigatório'),
  lastName: z.string().min(1, 'O sobrenome é obrigatório'),
  email: z.string().email('Endereço de e-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
}

export default function CadastroFuncionariosPage() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<WithDocId<Employee> | null>(null);

  const employeesQueryKey = ['employees'];
  const employeesCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'employees'), orderBy('id')) : null),
    [firestore]
  );

  const { data: employees, isLoading, error } = useCollection<WithDocId<Employee>>(employeesCollectionRef, {
    queryKey: employeesQueryKey,
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!searchTerm) return employees;
    const lowercasedTerm = searchTerm.toLowerCase();
    return employees.filter(
      (e) =>
        (e.firstName && e.firstName.toLowerCase().includes(lowercasedTerm)) ||
        (e.lastName && e.lastName.toLowerCase().includes(lowercasedTerm)) ||
        (e.email && e.email.toLowerCase().includes(lowercasedTerm))
    );
  }, [employees, searchTerm]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  });

  async function onCreateUser(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) {
      toast({ variant: 'destructive', title: 'Ops! Algo deu errado.', description: 'O Firebase não foi inicializado.' });
      return;
    }

    try {
      const tempUserCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = tempUserCredential.user;

      const employeesRef = collection(firestore, 'employees');
      const q = query(employeesRef, orderBy('id', 'desc'), limit(1));
      const lastEmployeeSnapshot = await getDocs(q);
      const lastId = lastEmployeeSnapshot.empty ? 1000 : (lastEmployeeSnapshot.docs[0].data().id || 1000);
      const newEmployeeId = lastId + 1;

      const userDocRef = doc(firestore, 'employees', user.uid);
      
      const userData = {
        id: newEmployeeId,
        uid: user.uid,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: '',
        accessLevel: 'Técnico', // Default access level
        status: 'Ativo',
        birthDate: null,
        motivoBaixa: '',
      };
      
      await setDoc(userDocRef, userData);

      toast({ title: 'Sucesso!', description: 'Novo funcionário cadastrado e ativado.' });
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['employeesForManagement'] }); // Invalidate other page
      setIsCreateDialogOpen(false);
      form.reset();

    } catch (error: any) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Este endereço de e-mail já está em uso.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'O endereço de e-mail não é válido.';
            break;
          case 'auth/weak-password':
            errorMessage = 'A senha é muito fraca.';
            break;
          default:
            errorMessage = 'Falha ao criar conta.';
        }
      }
      toast({ variant: 'destructive', title: 'Ops! Algo deu errado.', description: errorMessage });
    }
  }

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

  const isSuperAdmin = (uid: string) => uid === 'SOID8C723XUmlniI3mpjBmBPA5v1';

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Funcionários</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Funcionário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Funcionários</CardTitle>
          <CardDescription>
            Visualize os funcionários da empresa e seus status.
          </CardDescription>
           <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, sobrenome ou e-mail..."
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
                        <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                ))
              )}
              {!isLoading && filteredEmployees?.map((employee) => (
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
                        {isSuperAdmin(employee.uid) || employee.accessLevel === 'Admin' ? <Badge variant={'default'}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Admin</Badge> : <Badge variant={'secondary'}>Técnico</Badge>}
                    </TableCell>
                    <TableCell>{getStatusBadge(employee.status)}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono">{employee.id}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="outline" size="icon" onClick={() => setEditingEmployee(employee)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adicionar Novo Funcionário</DialogTitle>
                <DialogDescription>
                    Crie uma nova conta de usuário. O nível de acesso padrão será 'Técnico'.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreateUser)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="João" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Sobrenome</FormLabel><FormControl><Input placeholder="Silva" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    </div>
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="joao.silva@exemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Senha Temporária</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Criar Funcionário
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
    <EditFuncionarioDialog
      isOpen={!!editingEmployee}
      onClose={() => setEditingEmployee(null)}
      employee={editingEmployee}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: employeesQueryKey });
        setEditingEmployee(null);
      }}
    />
    </>
  );
}
