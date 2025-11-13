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
import { doc, setDoc, runTransaction } from 'firebase/firestore';
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

      // 2. Get new sequential ID and save user info in a transaction
      const counterRef = doc(firestore, 'counters', 'employees');
      const newEmployeeId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          // This transaction might fail if rules deny reading the counter.
          // That's a potential source of the permission error.
          throw new Error("Documento do contador não existe ou não pôde ser lido!");
        }
        const newId = counterDoc.data().lastId + 1;
        transaction.update(counterRef, { lastId: newId });
        return newId;
      }).catch(error => {
          // Emit a contextual error if the transaction itself fails.
          // This is common if the rules for the counter document are wrong.
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: counterRef.path,
              operation: 'write', // A transaction is a write operation
              requestResourceData: { lastId: 'newId' }
            })
          );
          // Re-throw to stop execution
          throw error;
      });

      const userDocRef = doc(firestore, 'employees', user.uid);
      const userData = {
        id: newEmployeeId, // Use the new sequential ID
        uid: user.uid, // Keep Firebase Auth UID for reference
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: '', // Phone is optional in this form
        accessLevel: 'Técnico', // Default access level
      };
      
      // We are not awaiting this promise to avoid blocking the UI
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
        description: 'Sua conta foi criada. Redirecionando para o painel...',
      });
      router.push('/dashboard');

    } catch (error: any) {
      // Don't show a toast for permission errors, as they are handled globally.
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
          case 'permission-denied': // This can be thrown by the transaction
             errorMessage = 'Falha ao criar o registro de funcionário devido a permissões.';
             break;
          default:
            errorMessage = error.message;
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
          Crie uma conta para começar a usar o AeroTrack.
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
