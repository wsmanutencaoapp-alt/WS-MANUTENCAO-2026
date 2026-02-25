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
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import Image from 'next/image';

const formSchema = z.object({
  email: z.string().email('Endereço de e-mail inválido'),
});

function ForgotPasswordForm() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Ops! Algo deu errado.',
        description: 'O serviço de autenticação não está disponível.',
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'E-mail Enviado!',
        description: 'Verifique sua caixa de entrada para o link de redefinição de senha.',
      });
      router.push('/login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha no Envio',
        description: 'Não foi possível enviar o e-mail. Verifique se o endereço está correto.',
      });
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Esqueceu a Senha?</CardTitle>
        <CardDescription>
          Digite seu e-mail para receber um link de redefinição.
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
                      placeholder="seu.email@exemplo.com"
                      {...field}
                    />
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
              {form.formState.isSubmitting ? 'Enviando...' : 'Enviar E-mail de Redefinição'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Lembrou a senha?{' '}
              <Link href="/login" className="underline hover:text-primary">
                Fazer Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </div>
  );
}
