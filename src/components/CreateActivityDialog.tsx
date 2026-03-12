'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from './ui/command';
import { Calendar } from './ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, ChevronsUpDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';

interface CreateActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const sectors = ['Ferramentaria', 'Suprimentos', 'Engenharia', 'Manutenção', 'TI', 'Qualidade', 'GSO', 'Administrativo', 'Financeiro', 'Outro'] as const;

const formSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "É necessário designar um responsável."),
  sector: z.enum(sectors),
  priority: z.enum(['Normal', 'Média', 'Urgente']).default('Normal'),
  dueDate: z.date().optional(),
});

export default function CreateActivityDialog({ isOpen, onClose }: CreateActivityDialogProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false);

  const { data: employees, isLoading: isLoadingEmployees } = useCollection<WithDocId<Employee>>(
    useMemoFirebase(() => firestore ? collection(firestore, 'employees') : null, [firestore])
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', description: '', assigneeId: '', priority: 'Normal', sector: 'Administrativo' },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !currentUser) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }
    const assignee = employees?.find(e => e.docId === values.assigneeId);
    if (!assignee) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Responsável não encontrado.' });
        return;
    }

    try {
      await addDoc(collection(firestore, 'activities'), {
        ...values,
        requesterId: currentUser.uid,
        requesterName: currentUser.displayName || currentUser.email,
        assigneeName: `${assignee.firstName} ${assignee.lastName}`,
        status: 'Pendente',
        createdAt: new Date().toISOString(),
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        history: [{
            action: 'Criação',
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            timestamp: new Date().toISOString(),
            details: `Atividade criada e atribuída a ${assignee.firstName}.`
        }]
      });
      toast({ title: 'Sucesso', description: 'Atividade criada.' });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      onClose();
      form.reset();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a atividade.' });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Nova Atividade</DialogTitle>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Título <span className="text-destructive">*</span></FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Setor</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um setor" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {sectors.map(sector => (
                                        <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Responsável <span className="text-destructive">*</span></FormLabel>
                            <Popover open={isAssigneePopoverOpen} onOpenChange={setIsAssigneePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={isLoadingEmployees}>
                                            {field.value ? employees?.find(e => e.docId === field.value)?.firstName + ' ' + employees?.find(e => e.docId === field.value)?.lastName : "Selecione um colaborador..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar por nome..." />
                                        <CommandList>
                                            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {employees?.map(employee => (
                                                    <CommandItem 
                                                        key={employee.docId} 
                                                        value={`${employee.firstName} ${employee.lastName}`} 
                                                        onSelect={() => {
                                                            form.setValue('assigneeId', employee.docId);
                                                            setIsAssigneePopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", field.value === employee.docId ? "opacity-100" : "opacity-0")} />
                                                        {employee.firstName} {employee.lastName}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Prioridade</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Defina a prioridade" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Normal">Normal</SelectItem>
                                        <SelectItem value="Média">Média</SelectItem>
                                        <SelectItem value="Urgente">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Prazo (Opcional)</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Criar Atividade
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
