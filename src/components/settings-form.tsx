'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useUser, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { doc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { useEffect, useState, useRef } from 'react';
import { Loader2, User as UserIcon } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const formSchema = z.object({
  id: z.number().optional().nullable(),
  accessLevel: z.string().optional(),
  firstName: z.string().min(1, 'O nome é obrigatório'),
  lastName: z.string().min(1, 'O sobrenome é obrigatório'),
  email: z.string().email('Endereço de e-mail inválido').optional(),
  phone: z.string().optional(),
  photoURL: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function SettingsForm() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);


  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      accessLevel: '',
      photoURL: '',
    },
  });

  const isFormLoading = form.formState.isSubmitting || isUserLoading;

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'employees', user.uid);
  }, [firestore, user]);

  const fetchUserData = async () => {
    if (userDocRef) {
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            form.reset({
              id: data.id || null,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: data.email || user?.email || '',
              phone: data.phone || '',
              accessLevel: data.accessLevel || '',
              photoURL: data.photoURL || '',
            });
            if (data.photoURL) {
              setPreviewImage(data.photoURL);
            }
          }
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userDocRef, user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const assignId = async () => {
    if (!firestore || !userDocRef || !user) return;
    try {
      const counterRef = doc(firestore, 'counters', 'employees');
      const newEmployeeId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let newId = 1001; // Default starting ID
        if (counterDoc.exists() && counterDoc.data()?.lastId) {
            newId = counterDoc.data().lastId + 1;
        }

        // Special case for the first admin user
        if (user.email === 'grupodallax@gmail.com' && (!counterDoc.exists() || counterDoc.data()?.lastId < 1001)) {
            newId = 1001;
            transaction.set(counterRef, { lastId: 1001 });
        } else {
             if (!counterDoc.exists()) {
                throw new Error("Contador de funcionários não encontrado. O cadastro está desabilitado.");
            }
             transaction.update(counterRef, { lastId: newId });
        }

        transaction.update(userDocRef, { id: newId });
        return newId;
      });

      toast({
        title: 'Sucesso!',
        description: `Seu ID de funcionário (${newEmployeeId}) foi atribuído.`,
      });
      // Re-busca os dados para atualizar o formulário
      fetchUserData();
    } catch (e: any) {
       toast({
        variant: "destructive",
        title: 'Erro ao atribuir ID',
        description: e.message || 'Não foi possível atribuir o ID. Verifique as permissões.',
      });
    }
  };

  async function onSubmit(values: FormData) {
    if (!userDocRef || !user) {
      toast({
        variant: 'destructive',
        title: 'Ops! Algo deu errado.',
        description: 'Usuário não encontrado.',
      });
      return;
    }
    
    let photoURL = values.photoURL;

    if (previewImage && previewImage !== values.photoURL) {
        if (!storage) {
            toast({ variant: "destructive", title: "Erro", description: "O serviço de armazenamento não está disponível." });
            return;
        }
        const imageRef = storageRef(storage, `profile_pictures/${user.uid}`);
        try {
            await uploadString(imageRef, previewImage, 'data_url');
            photoURL = await getDownloadURL(imageRef);
        } catch (error) {
            console.error("Erro ao fazer upload da imagem:", error);
            toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível fazer upload da sua foto de perfil." });
            return;
        }
    }

    const dataToUpdate = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      photoURL: photoURL,
      accessLevel: values.accessLevel,
    };

    updateDoc(userDocRef, dataToUpdate).then(() => {
      toast({
        title: 'Sucesso!',
        description: 'Seu perfil foi atualizado.',
      });
    }).catch((error) => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: dataToUpdate,
        })
      );
    });
  }

  if (isUserLoading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const hasNumericId = typeof form.getValues('id') === 'number';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {!hasNumericId && (
            <Alert>
                <AlertTitle>Atribuir ID de Funcionário</AlertTitle>
                <AlertDescription>
                    Seu usuário ainda não tem um ID numérico. Clique no botão para atribuir o próximo ID disponível.
                </AlertDescription>
                <Button type="button" onClick={assignId} className="mt-4">
                    Obter meu ID
                </Button>
            </Alert>
        )}

        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={previewImage || undefined} />
              <AvatarFallback>
                <UserIcon className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Trocar Foto
            </Button>
            <Input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" 
              accept="image/png, image/jpeg"
            />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID do Funcionário</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? 'Não atribuído'} readOnly className="bg-muted/50 cursor-not-allowed" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accessLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nível de Acesso</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''}  />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  placeholder="seu@email.com"
                  {...field}
                  value={field.value ?? ''}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input placeholder="(99) 99999-9999" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isFormLoading || !hasNumericId}>
            {isFormLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
