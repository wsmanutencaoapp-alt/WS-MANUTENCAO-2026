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
import { useUser, useFirestore, useMemoFirebase, useStorage, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { useEffect, useState, useRef } from 'react';
import { Loader2, User as UserIcon, ShieldCheck } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';

const formSchema = z.object({
  id: z.number().optional().nullable(),
  accessLevel: z.string().optional().nullable(),
  firstName: z.string().min(1, 'O nome é obrigatório'),
  lastName: z.string().min(1, 'O sobrenome é obrigatório'),
  email: z.string().email('Endereço de e-mail inválido').optional(),
  phone: z.string().optional().nullable(),
  photoURL: z.string().optional().nullable(),
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

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'employees', user.uid);
  }, [firestore, user]);

  const { data: employeeData, isLoading: isEmployeeDataLoading } = useDoc<FormData>(userDocRef);

  const isAdmin = employeeData?.accessLevel === 'Admin';
  
  useEffect(() => {
    if (employeeData) {
      form.reset({
        id: employeeData.id,
        firstName: employeeData.firstName || '',
        lastName: employeeData.lastName || '',
        email: user?.email || employeeData.email || '',
        phone: employeeData.phone || '',
        accessLevel: employeeData.accessLevel || '',
        photoURL: employeeData.photoURL || '',
      });
      if (employeeData.photoURL) {
        setPreviewImage(employeeData.photoURL);
      }
    }
  }, [employeeData, user, form]);
  
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

    const dataToUpdate: Partial<FormData> = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      photoURL: photoURL,
    };
    
    // Only an admin can change the access level.
    // This check is also enforced by security rules, but it's good practice
    // to control the UI as well.
    if (isAdmin && values.accessLevel) {
      dataToUpdate.accessLevel = values.accessLevel;
    }


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

  if (isUserLoading || isEmployeeDataLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const isSubmitting = form.formState.isSubmitting;
  const hasNumericId = typeof form.watch('id') === 'number';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={previewImage || undefined} />
              <AvatarFallback>
                <UserIcon className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{form.watch('firstName')} {form.watch('lastName')}</h2>
                    {isAdmin && (
                        <Badge variant="secondary" className="gap-1 pl-2">
                           <ShieldCheck className="h-4 w-4 text-primary" />
                           Admin
                        </Badge>
                    )}
                </div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Trocar Foto
                </Button>
            </div>
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
                    <Input {...field} value={field.value ?? ''} readOnly={!isAdmin} className={!isAdmin ? "bg-muted/50 cursor-not-allowed" : ""}  />
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
          <Button type="submit" disabled={isSubmitting || !hasNumericId}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
