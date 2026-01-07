'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, runTransaction, getDocs, collection, query, orderBy, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  firstName: z.string().min(1, 'O nome é obrigatório'),
  lastName: z.string().min(1, 'O sobrenome é obrigatório'),
  email: z.string().email('Endereço de e-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

export function SignUpForm() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Ops! Algo deu errado.',
        description: 'O Firebase não foi inicializado.',
      });
      return;
    }
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      // 2. Get new sequential ID
      const employeesRef = collection(firestore, 'employees');
      const q = query(employeesRef, orderBy('id', 'desc'), limit(1));
      const lastEmployeeSnapshot = await getDocs(q);
      const lastId = lastEmployeeSnapshot.empty ? 1000 : (lastEmployeeSnapshot.docs[0].data().id || 1000);
      const newEmployeeId = lastId + 1;

      const userDocRef = doc(firestore, 'employees', user.uid);
      
      const isFirstUser = newEmployeeId === 1001;
      const accessLevel = isFirstUser ? 'Admin' : 'Técnico';
      const status = isFirstUser ? 'Ativo' : 'Pendente';

      const userData = {
        id: newEmployeeId,
        uid: user.uid,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: '',
        accessLevel: accessLevel,
        status: status,
      };
      
      setDoc(userDocRef, userData).catch((error) => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'create',
            requestResourceData: userData,
          })
        );
      });

      toast({
        title: 'Sucesso!',
        description: isFirstUser 
            ? 'Sua conta de Administrador foi criada. Redirecionando...'
            : 'Sua conta foi criada e aguarda aprovação de um administrador.',
      });
      router.push('/login');

    } catch (error: any) {
      if (error instanceof FirestorePermissionError) {
        return;
      }
      
      let errorMessage = 'Ocorreu um erro inesperado.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Este endereço de e-mail já está em uso.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'O endereço de e-mail não é válido.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Contas de e-mail/senha não estão habilitadas.';
            break;
          case 'auth/weak-password':
            errorMessage = 'A senha é muito fraca.';
            break;
          default:
            errorMessage = error.message || 'Falha ao criar conta.';
        }
      }
      toast({
        variant: 'destructive',
        title: 'Ops! Algo deu errado.',
        description: errorMessage,
      });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Cadastre-se</CardTitle>
        <CardDescription>
          Crie uma conta para começar a usar o APP WS.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="João" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sobrenome</FormLabel>
                    <FormControl>
                      <Input placeholder="Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="joao.silva@exemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Criando Conta...' : 'Cadastre-se'}
            </Button>
             <p className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
