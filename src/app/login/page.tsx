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
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import Image from 'next/image';

const formSchema = z.object({
  email: z.string().email('Endereço de e-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Check employee status in Firestore
      const employeeDocRef = doc(firestore, 'employees', user.uid);
      const employeeDoc = await getDoc(employeeDocRef);

      if (!employeeDoc.exists()) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Acesso Negado',
          description: 'Perfil de funcionário não encontrado. Contate um administrador.',
        });
        return;
      }

      const employeeData = employeeDoc.data() as Employee;
      
      if (employeeData.status !== 'Ativo') {
         await signOut(auth);
         toast({
          variant: 'destructive',
          title: `Acesso ${employeeData.status}`,
          description: `Sua conta está com o status "${employeeData.status}". Contate um administrador.`,
        });
        return;
      }

      toast({
        title: 'Sucesso!',
        description: 'Login realizado com sucesso. Redirecionando para o painel...',
      });
      router.push('/dashboard');
    } catch (error: any) {
      // Use a generic error message for all login failures
      toast({
        variant: 'destructive',
        title: 'Falha no Login',
        description: 'Credenciais inválidas. Verifique seu e-mail e senha.',
      });
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Acesse seu painel.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="joao.silva@example.com"
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
              {form.formState.isSubmitting ? 'Entrando...' : 'Login'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Link href="/signup" className="underline">
                Cadastre-se
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background sm:bg-muted/40 p-4">
      <div className="mb-8">
        <Image
            src="/logo.png"
            alt="APP WS Logo"
            width={150}
            height={150}
            priority
        />
      </div>
      <LoginForm />
    </div>
  );
}
