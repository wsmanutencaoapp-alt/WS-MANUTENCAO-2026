'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { Training } from '@/lib/types';
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
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, CalendarIcon } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const formSchema = z.object({
  name: z.string().min(1, "O nome do treinamento é obrigatório."),
  application: z.string().min(1, "A aplicação é obrigatória."),
  validityPeriod: z.coerce.number().min(0, "O prazo deve ser 0 ou maior."),
  isSgso: z.boolean().default(false),
  isAvsec: z.boolean().default(false),
  sgsoDate: z.date().optional(),
  avsecDate: z.date().optional(),
  triggersAccessChange: z.boolean().default(false),
  accessChangeDate: z.date().optional(),
});


const CadastroTreinamentosPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['trainings'];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<WithDocId<Training> | null>(null);

  const trainingsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'trainings')) : null),
    [firestore]
  );
  
  const { data: trainings, isLoading, error } = useCollection<WithDocId<Training>>(trainingsQuery, {
      queryKey,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      application: '',
      validityPeriod: 12,
      isSgso: false,
      isAvsec: false,
      triggersAccessChange: false,
    },
  });

  const watchIsSgso = form.watch('isSgso');
  const watchIsAvsec = form.watch('isAvsec');
  const watchTriggersAccessChange = form.watch('triggersAccessChange');

  const handleOpenDialog = (training: WithDocId<Training> | null) => {
    if (training) {
      setEditingTraining(training);
      form.reset({
        ...training,
        sgsoDate: training.sgsoDate ? new Date(training.sgsoDate) : undefined,
        avsecDate: training.avsecDate ? new Date(training.avsecDate) : undefined,
        accessChangeDate: training.accessChangeDate ? new Date(training.accessChangeDate) : undefined,
      });
    } else {
      setEditingTraining(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;

    const dataToSave = {
      ...values,
      sgsoDate: values.sgsoDate?.toISOString(),
      avsecDate: values.avsecDate?.toISOString(),
      accessChangeDate: values.accessChangeDate?.toISOString(),
    };

    try {
        if (editingTraining) {
            const docRef = doc(firestore, 'trainings', editingTraining.docId);
            await updateDoc(docRef, dataToSave);
            toast({ title: 'Sucesso!', description: 'Treinamento atualizado.' });
        } else {
            await addDoc(collection(firestore, 'trainings'), dataToSave);
            toast({ title: 'Sucesso!', description: 'Novo treinamento cadastrado.' });
        }

        queryClient.invalidateQueries({ queryKey });
        setIsDialogOpen(false);
    } catch (e: any) {
        console.error("Erro ao salvar treinamento: ", e);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: e.message });
    }
  };

  const handleDelete = async (trainingId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'trainings', trainingId));
      toast({ title: 'Sucesso!', description: 'Treinamento excluído.' });
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
       console.error("Erro ao excluir treinamento:", e);
       toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível excluir.' });
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Treinamentos</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Treinamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Treinamentos Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os treinamentos disponíveis, suas validades e regras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Aplicação</TableHead>
                <TableHead>Validade (meses)</TableHead>
                <TableHead>SGSO/AVSEC</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
              {!isLoading && trainings?.map(t => (
                  <TableRow key={t.docId}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="max-w-sm truncate">{t.application}</TableCell>
                    <TableCell>{t.validityPeriod}</TableCell>
                    <TableCell>{t.isSgso && "SGSO"} {t.isAvsec && "AVSEC"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(t)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Tem certeza que deseja excluir o treinamento <span className="font-bold">{t.name}</span>?
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(t.docId)}>
                                  Sim, Excluir
                              </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTraining ? 'Editar Treinamento' : 'Adicionar Novo Treinamento'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome do Treinamento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="application" render={({ field }) => (
                  <FormItem><FormLabel>Aplicação</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="validityPeriod" render={({ field }) => (
                  <FormItem><FormLabel>Prazo de Validade (meses)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>

              <div className="space-y-4 rounded-md border p-4">
                <FormField control={form.control} name="isSgso" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between"><FormLabel>É um treinamento SGSO?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )}/>
                {watchIsSgso && (
                  <FormField control={form.control} name="sgsoDate" render={({ field }) => (
                      <FormItem className="flex flex-col animate-in fade-in-50"><FormLabel>Data SGSO</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className="pl-3 text-left font-normal">
                                {field.value ? format(field.value, "PPP") : <span>Escolha a data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                      <FormMessage /></FormItem>
                  )}/>
                )}

                <FormField control={form.control} name="isAvsec" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between"><FormLabel>É um treinamento AVSEC?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )}/>
                {watchIsAvsec && (
                  <FormField control={form.control} name="avsecDate" render={({ field }) => (
                      <FormItem className="flex flex-col animate-in fade-in-50"><FormLabel>Data AVSEC</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className="pl-3 text-left font-normal">
                                {field.value ? format(field.value, "PPP") : <span>Escolha a data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                      <FormMessage /></FormItem>
                  )}/>
                )}
              </div>

               <div className="space-y-4 rounded-md border p-4">
                <FormField control={form.control} name="triggersAccessChange" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between"><FormLabel>Muda Nível de Acesso/Permissão?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )}/>
                {watchTriggersAccessChange && (
                   <FormField control={form.control} name="accessChangeDate" render={({ field }) => (
                      <FormItem className="flex flex-col animate-in fade-in-50"><FormLabel>Data para Alteração</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className="pl-3 text-left font-normal">
                                {field.value ? format(field.value, "PPP") : <span>Escolha a data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                      <FormMessage /></FormItem>
                  )}/>
                )}
               </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)} disabled={form.formState.isSubmitting}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CadastroTreinamentosPage;
