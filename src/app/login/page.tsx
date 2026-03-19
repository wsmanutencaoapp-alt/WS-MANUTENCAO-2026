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
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { Employee, AppAppearance } from '@/lib/types';
import Image from 'next/image';

const formSchema = z.object({
  email: z.string().email('Endereço de e-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

const SUPER_ADMIN_UID = 'SOID8C723XUmlniI3mpjBmBPA5v1';

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

      // Allow Super Admin to bypass profile checks
      if (user.uid === SUPER_ADMIN_UID) {
        toast({
          title: 'Bem-vindo, Super Admin!',
          description: 'Login realizado com sucesso.',
        });
        router.push('/dashboard');
        return;
      }

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
        description: 'Login realizado com sucesso. Redirecionando...',
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha no Login',
        description: 'Credenciais inválidas. Verifique seu e-mail e senha.',
      });
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm bg-card/80 backdrop-blur-sm">
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
                  <div className="flex items-center">
                    <FormLabel>Senha</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="ml-auto inline-block text-sm underline"
                    >
                      Esqueceu sua senha?
                    </Link>
                  </div>
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

const CONFIG_DOC_ID = 'appearance';

export default function LoginPage() {
    const firestore = useFirestore();
    const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_config', CONFIG_DOC_ID) : null, [firestore]);
    const { data: appearanceConfig } = useDoc<AppAppearance>(configRef);

    const backgroundStyle = appearanceConfig?.loginBackgroundUrl
        ? { backgroundImage: `url(${appearanceConfig.loginBackgroundUrl})` }
        : { backgroundImage: "url(/login-background.jpg)" };

  return (
    <div 
        className="flex min-h-screen flex-col items-center justify-center p-4 bg-cover bg-center transition-all duration-500"
        style={backgroundStyle}
    >
        <div className="absolute inset-0 bg-black/50 z-0" />
        <div className="z-10 flex flex-col items-center justify-center">
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
    </div>
  );
}