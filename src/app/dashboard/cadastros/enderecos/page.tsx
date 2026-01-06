'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Address } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Checkbox } from '@/components/ui/checkbox';

const CadastroEnderecosPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState({
    unidade: '',
    unidadeOutro: '',
    setor: '',
    rua: '',
    movel: '',
    nivel: '',
  });
  const [useDetalhe, setUseDetalhe] = useState(false);
  const [generatedDetalhe, setGeneratedDetalhe] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const addressesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'addresses'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );

  const { data: addresses, isLoading, error } = useCollection<WithDocId<Address>>(addressesQuery, {
      queryKey: ['addresses']
  });

  const predefinedStates = useMemo(() => ['PR', 'SP', 'SC', 'BA', 'RO', 'CE', 'DF', 'MG', 'RJ', 'AM', 'MT'], []);
  
  useEffect(() => {
    const generateNextDetalhe = async () => {
      if (!firestore || !useDetalhe || !formState.setor) {
        setGeneratedDetalhe(null);
        return;
      }
      
      // Simplified query to only filter by sector
      const q = query(
        collection(firestore, 'addresses'), 
        where('setor', '==', formState.setor)
      );

      const querySnapshot = await getDocs(q);
      let lastNumber = 0;
      
      // Client-side filtering and processing
      querySnapshot.forEach(doc => {
          const data = doc.data();
          // Check if 'detalhe' exists and is not null/undefined
          if (data.detalhe) {
              const detalhe = data.detalhe as string;
              const currentNumber = parseInt(detalhe.replace('-D', ''), 10);
              if (currentNumber > lastNumber) {
                  lastNumber = currentNumber;
              }
          }
      });
      
      const nextNumber = lastNumber + 1;
      setGeneratedDetalhe(`-D${String(nextNumber).padStart(3, '0')}`);
    };
    generateNextDetalhe();
  }, [useDetalhe, formState.setor, firestore]);
  
  const generatedCode = useMemo(() => {
    const activeUnidade = formState.unidade === 'OUTRA' ? formState.unidadeOutro : formState.unidade;
    const { setor, rua, movel, nivel } = formState;

    const stateIndex = predefinedStates.indexOf(activeUnidade.toUpperCase());
    const unidadeCode = stateIndex !== -1 
        ? String.fromCharCode(65 + stateIndex) 
        : activeUnidade ? activeUnidade.toUpperCase().charAt(0) : null;

    const parts = [
        unidadeCode,
        setor ? setor.padStart(2, '0') : null,
        rua ? `R${rua.padStart(2, '0')}` : null,
        movel ? `${movel.charAt(0).toUpperCase()}${movel.substring(1).padStart(2, '0')}` : null,
        nivel ? `N${nivel.padStart(2, '0')}` : null,
    ];
    const mainCode = parts.filter(Boolean).join('.');
    const detailCode = useDetalhe && generatedDetalhe ? generatedDetalhe : '';

    return mainCode + detailCode || 'Aguardando preenchimento...';
  }, [formState, predefinedStates, useDetalhe, generatedDetalhe]);
  
  const resetForm = () => {
    setFormState({ unidade: '', unidadeOutro: '', setor: '', rua: '', movel: '', nivel: '' });
    setUseDetalhe(false);
    setGeneratedDetalhe(null);
  }

  const handleSave = async () => {
    const activeUnidade = formState.unidade === 'OUTRA' ? formState.unidadeOutro : formState.unidade;
    const { setor, rua, movel, nivel } = formState;

    if (!activeUnidade || !setor || !rua || !movel || !nivel) {
        toast({
            variant: 'destructive',
            title: 'Campos Obrigatórios',
            description: 'Unidade, Setor, Rua, Móvel e Nível são obrigatórios.'
        });
        return;
    }
     if (!/^[A-Z]/i.test(movel)) {
      toast({
        variant: 'destructive',
        title: 'Formato Inválido',
        description: 'O campo "Móvel" deve começar com uma letra (A-Z).'
      });
      return;
    }
    if (!firestore) return;

    setIsSaving(true);
    try {
        const newAddress: Omit<Address, 'id'> = {
            unidade: activeUnidade.toUpperCase(), 
            setor: formState.setor,
            rua: `R${formState.rua.padStart(2, '0')}`,
            movel: `${formState.movel.charAt(0).toUpperCase()}${formState.movel.substring(1).padStart(2, '0')}`,
            nivel: `N${formState.nivel.padStart(2, '0')}`,
            detalhe: useDetalhe && generatedDetalhe ? generatedDetalhe : undefined,
            codigoCompleto: generatedCode,
            createdAt: new Date().toISOString(),
        };

        await addDoc(collection(firestore, 'addresses'), newAddress);
        toast({ title: 'Sucesso!', description: 'Novo endereço cadastrado.' });
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        resetForm();
    } catch (err) {
        console.error("Erro ao salvar endereço:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar o endereço.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!firestore) return;
    setIsDeleting(addressId);
    try {
        await deleteDoc(doc(firestore, 'addresses', addressId));
        toast({ title: 'Sucesso!', description: 'Endereço excluído.' });
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
    } catch (err) {
        console.error("Erro ao excluir endereço:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível excluir o endereço.' });
    } finally {
        setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cadastro de Endereçamento Físico</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Endereço</CardTitle>
          <CardDescription>
            Preencha os níveis para gerar o código de endereçamento hierárquico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
             <div>
                <Label>Nível 1: Unidade (Estado)</Label>
                 <Select value={formState.unidade} onValueChange={(v) => setFormState(p => ({...p, unidade: v}))}>
                     <SelectTrigger><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                     <SelectContent>
                        {predefinedStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                         <SelectItem value="OUTRA">Outra (Digitar)...</SelectItem>
                     </SelectContent>
                 </Select>
            </div>
            {formState.unidade === 'OUTRA' && (
                <div className="animate-in fade-in-50">
                    <Label htmlFor="unidadeOutro">Nova Unidade (Sigla)</Label>
                    <Input 
                        id="unidadeOutro"
                        value={formState.unidadeOutro} 
                        onChange={(e) => setFormState(p => ({...p, unidadeOutro: e.target.value.toUpperCase()}))} 
                        placeholder="Ex: GO" 
                        maxLength={2}
                    />
                </div>
            )}
             <div>
                <Label>Nível 2: Setor</Label>
                 <Select value={formState.setor} onValueChange={(v) => setFormState(p => ({...p, setor: v}))}>
                     <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                     <SelectContent>
                         <SelectItem value="01">Ferramentaria</SelectItem>
                         <SelectItem value="02">Suprimentos</SelectItem>
                         <SelectItem value="03">Administrativo</SelectItem>
                         <SelectItem value="04">Financeiro</SelectItem>
                         <SelectItem value="05">Engenharia</SelectItem>
                     </SelectContent>
                 </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
             <div>
                <Label>Nível 3: Rua / Corredor</Label>
                <Input value={formState.rua} onChange={(e) => setFormState(p => ({...p, rua: e.target.value.replace(/\D/g, '')}))} placeholder="Ex: 01" maxLength={2}/>
            </div>
            <div>
                <Label>Nível 4: Móvel / Estante</Label>
                <Input value={formState.movel} onChange={(e) => setFormState(p => ({...p, movel: e.target.value.toUpperCase()}))} placeholder="Ex: E05" maxLength={3}/>
            </div>
            <div>
                <Label>Nível 5: Nível / Vão</Label>
                <Input value={formState.nivel} onChange={(e) => setFormState(p => ({...p, nivel: e.target.value.replace(/\D/g, '')}))} placeholder="Ex: 03" maxLength={2}/>
            </div>
             <div className="flex items-center space-x-2 h-10">
                <Checkbox id="useDetalhe" checked={useDetalhe} onCheckedChange={(checked) => setUseDetalhe(!!checked)} disabled={!formState.setor} />
                <Label htmlFor="useDetalhe" className="font-normal cursor-pointer">Adicionar Detalhe Sequencial</Label>
            </div>
          </div>
           <div className="pt-4 space-y-2">
               <Label className="font-semibold">Código Gerado</Label>
               <div className="p-3 rounded-md bg-muted font-mono text-lg">{generatedCode}</div>
           </div>
           <div className="flex justify-end">
               <Button onClick={handleSave} disabled={isSaving}>
                   {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                   <PlusCircle className="mr-2 h-4 w-4"/>
                   Salvar Endereço
               </Button>
           </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Endereços Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Código Completo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Data de Criação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                    {!isLoading && addresses?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum endereço cadastrado.</TableCell></TableRow>}
                    {!isLoading && addresses?.map(address => (
                        <TableRow key={address.docId}>
                            <TableCell className="font-mono">{address.codigoCompleto}</TableCell>
                            <TableCell>{address.unidade}</TableCell>
                            <TableCell>{address.setor}</TableCell>
                            <TableCell>{new Date(address.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isDeleting === address.docId}>
                                            {isDeleting === address.docId ? <Loader2 className="animate-spin h-4 w-4"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Tem certeza que deseja excluir o endereço <span className="font-bold">{address.codigoCompleto}</span>?
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(address.docId)}>
                                            Sim, Excluir
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

    </div>
  );
}

export default CadastroEnderecosPage;
