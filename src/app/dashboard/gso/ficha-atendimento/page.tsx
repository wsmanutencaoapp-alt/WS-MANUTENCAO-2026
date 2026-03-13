'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { AtendimentoGSO, Tripulante, Passageiro } from '@/lib/types';
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
import { Loader2, PlusCircle, Edit, Search, ClipboardList, Trash2, UserPlus, Plane } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';

const tripulanteSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  documento: z.string().min(1, "Documento é obrigatório"),
  observacao: z.string().optional(),
});

const passageiroSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  documento: z.string().min(1, "Documento é obrigatório"),
  observacao: z.string().optional(),
});

const formSchema = z.object({
  modeloAeronave: z.string().min(1, "Modelo é obrigatório."),
  prefixo: z.string().min(1, "Prefixo é obrigatório."),
  tipoVoo: z.enum(['TAXI AEREO', 'AVIACAO GERAL']),
  hangar: z.enum(['INTERNO', 'EXTERNO']),
  chegadaData: z.string().min(1, "Data e hora de chegada são obrigatórias."),
  tripulantesCount: z.coerce.number().optional(),
  passageirosCount: z.coerce.number().optional(),
  origem: z.string().optional(),
  saidaData: z.string().optional(),
  escala: z.string().optional(),
  destinoFinal: z.string().optional(),
  tripulacao: z.array(tripulanteSchema).optional(),
  passageiros: z.array(passageiroSchema).optional(),
  observacaoFinal: z.string().optional(),
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
    () => (firestore ? query(collection(firestore, 'atendimentos_gso'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );

  const { data: atendimentos, isLoading, error } = useCollection<WithDocId<AtendimentoGSO>>(atendimentosQuery, { queryKey });
  
  const form = useForm<AtendimentoFormValues>({
    resolver: zodResolver(formSchema),
  });
  
  const { fields: tripulacaoFields, append: appendTripulante, remove: removeTripulante } = useFieldArray({
    control: form.control,
    name: 'tripulacao'
  });
  const { fields: passageirosFields, append: appendPassageiro, remove: removePassageiro } = useFieldArray({
    control: form.control,
    name: 'passageiros'
  });

  const filteredAtendimentos = useMemo(() => {
    if (!atendimentos) return [];
    if (!searchTerm) return atendimentos;
    const lowerTerm = searchTerm.toLowerCase();
    return atendimentos.filter(a =>
      a.prefixo.toLowerCase().includes(lowerTerm) ||
      a.modeloAeronave.toLowerCase().includes(lowerTerm) ||
      a.responsavelName.toLowerCase().includes(lowerTerm)
    );
  }, [atendimentos, searchTerm]);

  const handleOpenDialog = (atendimento: WithDocId<AtendimentoGSO> | null = null) => {
    if (atendimento) {
      setEditingAtendimento(atendimento);
      form.reset({
        ...atendimento,
        chegadaData: format(new Date(atendimento.chegadaData), "yyyy-MM-dd'T'HH:mm"),
        saidaData: atendimento.saidaData ? format(new Date(atendimento.saidaData), "yyyy-MM-dd'T'HH:mm") : '',
      });
    } else {
      setEditingAtendimento(null);
      form.reset({
        modeloAeronave: '',
        prefixo: '',
        tipoVoo: 'AVIACAO GERAL',
        hangar: 'INTERNO',
        chegadaData: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        saidaData: '',
        tripulacao: [],
        passageiros: [],
        observacaoFinal: '',
      });
    }
    setDialogOpen(true);
  };
  
  const onSubmit = async (values: AtendimentoFormValues) => {
    if (!firestore || !user) return;

    try {
      const dataToSave: Omit<AtendimentoGSO, 'id' | 'history'> = {
        ...values,
        chegadaData: new Date(values.chegadaData).toISOString(),
        saidaData: values.saidaData ? new Date(values.saidaData).toISOString() : undefined,
        tripulantesCount: values.tripulacao?.length || 0,
        passageirosCount: values.passageiros?.length || 0,
        responsavelId: user.uid,
        responsavelName: user.displayName || user.email || 'Não identificado',
        createdAt: editingAtendimento?.createdAt || new Date().toISOString(),
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
  

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList />
            Ficha de Atendimento de Rampa
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
              Visualize todos os registros de atendimento a aeronaves.
            </CardDescription>
            <div className="relative pt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por prefixo, modelo..."
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
                  <TableHead>Aeronave</TableHead>
                  <TableHead>Chegada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Tipo de Voo</TableHead>
                  <TableHead>Responsável</TableHead>
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
                    <TableCell>
                      <div className="font-medium">{atd.prefixo}</div>
                      <div className="text-sm text-muted-foreground">{atd.modeloAeronave}</div>
                    </TableCell>
                    <TableCell>{format(new Date(atd.chegadaData), 'dd/MM/yy HH:mm')}</TableCell>
                    <TableCell>{atd.saidaData ? format(new Date(atd.saidaData), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                    <TableCell>{atd.tipoVoo}</TableCell>
                    <TableCell>{atd.responsavelName}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(atd)}>
                        <Edit className="mr-2 h-4 w-4" /> Ver / Editar
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingAtendimento ? 'Editar' : 'Registrar'} Ficha de Atendimento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[80vh] overflow-y-auto pr-4 py-4">
                <div className="space-y-4">
                  {/* Dados do Voo */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><Plane/> Dados do Voo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField control={form.control} name="modeloAeronave" render={({ field }) => ( <FormItem><FormLabel>Modelo Aeronave</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="prefixo" render={({ field }) => ( <FormItem><FormLabel>Prefixo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="tipoVoo" render={({ field }) => ( <FormItem><FormLabel>Tipo de Voo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="TAXI AEREO">TAXI AEREO</SelectItem><SelectItem value="AVIACAO GERAL">AVIACAO GERAL</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="hangar" render={({ field }) => ( <FormItem><FormLabel>Hangar</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="INTERNO">INTERNO</SelectItem><SelectItem value="EXTERNO">EXTERNO</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                    </div>
                  </div>
                  
                   {/* Chegada e Saida */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Movimentação</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="origem" render={({ field }) => ( <FormItem><FormLabel>Origem</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="chegadaData" render={({ field }) => ( <FormItem><FormLabel>Data/Hora Chegada</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="escala" render={({ field }) => ( <FormItem><FormLabel>Escala</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="destinoFinal" render={({ field }) => ( <FormItem><FormLabel>Destino Final</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="saidaData" render={({ field }) => ( <FormItem><FormLabel>Data/Hora Saída</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     </div>
                  </div>

                  {/* Tripulação e Passageiros */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                             <h3 className="font-semibold flex items-center gap-2"><Users/> Tripulação</h3>
                             <Button type="button" size="sm" variant="outline" onClick={() => appendTripulante({ nome: '', documento: '', observacao: ''})}><UserPlus className="mr-2 h-4 w-4"/> Adicionar</Button>
                          </div>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                              {tripulacaoFields.map((field, index) => (
                                  <div key={field.id} className="p-3 bg-background border rounded-md space-y-2 relative">
                                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1" onClick={() => removeTripulante(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                      <FormField control={form.control} name={`tripulacao.${index}.nome`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Nome</FormLabel><FormControl><Input {...field} className="h-8"/></FormControl></FormItem> )}/>
                                      <FormField control={form.control} name={`tripulacao.${index}.documento`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Documento</FormLabel><FormControl><Input {...field} className="h-8"/></FormControl></FormItem> )}/>
                                      <FormField control={form.control} name={`tripulacao.${index}.observacao`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Observação</FormLabel><FormControl><Input {...field} className="h-8"/></FormControl></FormItem> )}/>
                                  </div>
                              ))}
                               {tripulacaoFields.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Nenhum tripulante adicionado.</p>}
                          </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                             <h3 className="font-semibold flex items-center gap-2"><Users/> Passageiros</h3>
                             <Button type="button" size="sm" variant="outline" onClick={() => appendPassageiro({ nome: '', documento: '', observacao: ''})}><UserPlus className="mr-2 h-4 w-4"/> Adicionar</Button>
                          </div>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                              {passageirosFields.map((field, index) => (
                                  <div key={field.id} className="p-3 bg-background border rounded-md space-y-2 relative">
                                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1" onClick={() => removePassageiro(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                      <FormField control={form.control} name={`passageiros.${index}.nome`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Nome</FormLabel><FormControl><Input {...field} className="h-8"/></FormControl></FormItem> )}/>
                                      <FormField control={form.control} name={`passageiros.${index}.documento`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Documento</FormLabel><FormControl><Input {...field} className="h-8"/></FormControl></FormItem> )}/>
                                      <FormField control={form.control} name={`passageiros.${index}.observacao`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Observação</FormLabel><FormControl><Input {...field} className="h-8"/></FormControl></FormItem> )}/>
                                  </div>
                              ))}
                               {passageirosFields.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Nenhum passageiro adicionado.</p>}
                          </div>
                      </div>
                  </div>

                  {/* Observação Final */}
                   <div className="p-4 border rounded-lg">
                        <FormField control={form.control} name="observacaoFinal" render={({ field }) => ( <FormItem><FormLabel>Observação Final</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )}/>
                   </div>
                </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={form.formState.isSubmitting}>Cancelar</Button>
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
