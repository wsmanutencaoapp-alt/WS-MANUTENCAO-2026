'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { AtendimentoGSO } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
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
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Search, ClipboardList } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { GSO_TIPO_ATENDIMENTO_OPTIONS, GSO_STATUS_OPTIONS } from '@/lib/options';


const formSchema = z.object({
  dataOcorrencia: z.string().min(1, "A data da ocorrência é obrigatória."),
  localOcorrencia: z.string().min(1, "O local é obrigatório."),
  tipoAtendimento: z.enum(GSO_TIPO_ATENDIMENTO_OPTIONS),
  pessoasEnvolvidas: z.string().min(1, "Informe ao menos uma pessoa."),
  descricaoOcorrencia: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres."),
  medidasIniciais: z.string().min(1, "Descreva as medidas iniciais."),
  status: z.enum(GSO_STATUS_OPTIONS).default('Aberto'),
});

type AtendimentoFormValues = z.infer<typeof formSchema>;

const FichaAtendimentoPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['fichas-atendimento-gso'];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAtendimento, setEditingAtendimento] = useState<WithDocId<AtendimentoGSO> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const atendimentosQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'atendimentos_gso'), orderBy('dataOcorrencia', 'desc')) : null),
    [firestore]
  );

  const { data: atendimentos, isLoading, error } = useCollection<WithDocId<AtendimentoGSO>>(atendimentosQuery, { queryKey });
  
  const form = useForm<AtendimentoFormValues>({
    resolver: zodResolver(formSchema),
  });

  const filteredAtendimentos = useMemo(() => {
    if (!atendimentos) return [];
    if (!searchTerm) return atendimentos;
    const lowerTerm = searchTerm.toLowerCase();
    return atendimentos.filter(a =>
      a.localOcorrencia.toLowerCase().includes(lowerTerm) ||
      a.tipoAtendimento.toLowerCase().includes(lowerTerm) ||
      a.descricaoOcorrencia.toLowerCase().includes(lowerTerm) ||
      a.pessoasEnvolvidas.some(p => p.toLowerCase().includes(lowerTerm))
    );
  }, [atendimentos, searchTerm]);

  const handleOpenDialog = (atendimento: WithDocId<AtendimentoGSO> | null = null) => {
    if (atendimento) {
      setEditingAtendimento(atendimento);
      form.reset({
        ...atendimento,
        dataOcorrencia: format(new Date(atendimento.dataOcorrencia), "yyyy-MM-dd'T'HH:mm"),
        pessoasEnvolvidas: atendimento.pessoasEnvolvidas.join('\n'),
      });
    } else {
      setEditingAtendimento(null);
      form.reset({
        dataOcorrencia: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        localOcorrencia: '',
        tipoAtendimento: 'Primeiros Socorros',
        pessoasEnvolvidas: '',
        descricaoOcorrencia: '',
        medidasIniciais: '',
        status: 'Aberto',
      });
    }
    setDialogOpen(true);
  };
  
  const onSubmit = async (values: AtendimentoFormValues) => {
    if (!firestore || !user) return;

    try {
      const dataToSave: Omit<AtendimentoGSO, 'id' | 'relatorioAnexoUrl'> = {
        dataOcorrencia: new Date(values.dataOcorrencia).toISOString(),
        localOcorrencia: values.localOcorrencia,
        tipoAtendimento: values.tipoAtendimento,
        pessoasEnvolvidas: values.pessoasEnvolvidas.split('\n').filter(p => p.trim() !== ''),
        descricaoOcorrencia: values.descricaoOcorrencia,
        medidasIniciais: values.medidasIniciais,
        status: values.status,
        responsavelAtendimentoId: user.uid,
        responsavelAtendimentoName: user.displayName || user.email || 'Não identificado',
      };

      if (editingAtendimento) {
        const docRef = doc(firestore, 'atendimentos_gso', editingAtendimento.docId);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: 'Sucesso', description: 'Ficha de atendimento atualizada.' });
      } else {
        await addDoc(collection(firestore, 'atendimentos_gso'), dataToSave);
        toast({ title: 'Sucesso', description: 'Nova ficha de atendimento registrada.' });
      }

      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);

    } catch (err: any) {
      console.error('Erro ao salvar ficha de atendimento:', err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar a ficha.' });
    }
  };
  
  const getStatusVariant = (status: AtendimentoGSO['status']): 'default' | 'success' | 'secondary' => {
      switch (status) {
          case 'Aberto': return 'default';
          case 'Em Análise': return 'secondary';
          case 'Concluído': return 'success';
          default: return 'secondary';
      }
  }


  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList />
            Fichas de Atendimento (GSO)
          </h1>
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Atendimento
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Atendimentos</CardTitle>
            <CardDescription>
              Visualize todos os registros de segurança operacional.
            </CardDescription>
            <div className="relative pt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por local, tipo, pessoa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {error && <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">{error.message}</TableCell></TableRow>}
                {!isLoading && filteredAtendimentos.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum atendimento registrado.</TableCell></TableRow>
                )}
                {!isLoading && filteredAtendimentos.map(atd => (
                  <TableRow key={atd.docId}>
                    <TableCell>{format(new Date(atd.dataOcorrencia), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{atd.localOcorrencia}</TableCell>
                    <TableCell>{atd.tipoAtendimento}</TableCell>
                    <TableCell>{atd.responsavelAtendimentoName}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(atd.status)}>{atd.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(atd)}>
                        <Edit className="mr-2 h-4 w-4" /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAtendimento ? 'Editar' : 'Registrar'} Ficha de Atendimento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4 py-4">
                <FormField
                    control={form.control}
                    name="dataOcorrencia"
                    render={({ field }) => (
                        <FormItem><FormLabel>Data e Hora da Ocorrência</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="localOcorrencia"
                    render={({ field }) => (
                        <FormItem><FormLabel>Local da Ocorrência</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="tipoAtendimento"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Atendimento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                    {GSO_TIPO_ATENDIMENTO_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="pessoasEnvolvidas"
                    render={({ field }) => (
                        <FormItem><FormLabel>Pessoa(s) Envolvida(s)</FormLabel><FormControl><Textarea {...field} placeholder="Uma pessoa por linha" /></FormControl><FormMessage /></FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="descricaoOcorrencia"
                    render={({ field }) => (
                        <FormItem><FormLabel>Descrição da Ocorrência</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="medidasIniciais"
                    render={({ field }) => (
                        <FormItem><FormLabel>Medidas Iniciais Tomadas</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                 {editingAtendimento && (
                     <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {GSO_STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 )}
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FichaAtendimentoPage;
