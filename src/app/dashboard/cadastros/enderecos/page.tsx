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
  writeBatch,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Printer } from 'lucide-react';
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
import Image from 'next/image';

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
  const [startDetalheNum, setStartDetalheNum] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedAddressForPrint, setSelectedAddressForPrint] = useState<WithDocId<Address> | null>(null);


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
        setStartDetalheNum(null);
        return;
      }
      
      const q = query(
        collection(firestore, 'addresses'), 
        where('setor', '==', formState.setor)
      );

      const querySnapshot = await getDocs(q);
      let lastNumber = 0;
      
      querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.detalhe) {
              const detalhe = data.detalhe as string;
              // Extrai o número do detalhe (ex: "-D004" -> 4)
              const currentNumber = parseInt(detalhe.replace('-D', ''), 10);
              if (!isNaN(currentNumber) && currentNumber > lastNumber) {
                  lastNumber = currentNumber;
              }
          }
      });
      
      const nextNumber = lastNumber + 1;
      setStartDetalheNum(nextNumber);
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
    
    if (useDetalhe && startDetalheNum !== null) {
      const numQuantity = Number(quantity);
      if (numQuantity > 1) {
          const endDetalheNum = startDetalheNum + numQuantity - 1;
          const startCode = `-D${String(startDetalheNum).padStart(3, '0')}`;
          const endCode = `-D${String(endDetalheNum).padStart(3, '0')}`;
          return `${mainCode}${startCode} até ${endCode}`;
      }
      const detailCode = `-D${String(startDetalheNum).padStart(3, '0')}`;
      return mainCode + detailCode;
    }
    
    return mainCode || 'Aguardando preenchimento...';
  }, [formState, predefinedStates, useDetalhe, startDetalheNum, quantity]);
  
  const resetForm = () => {
    setFormState({ unidade: '', unidadeOutro: '', setor: '', rua: '', movel: '', nivel: '' });
    setUseDetalhe(false);
    setStartDetalheNum(null);
    setQuantity(1);
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
        const batch = writeBatch(firestore);
        const addressesCollection = collection(firestore, 'addresses');
        const numQuantity = useDetalhe ? Number(quantity) : 1;
        
        let currentStartDetalheNum = startDetalheNum;
        if (useDetalhe && currentStartDetalheNum === null) {
            // Recalculate just in case it wasn't ready
             const q = query(collection(firestore, 'addresses'), where('setor', '==', formState.setor));
             const querySnapshot = await getDocs(q);
             let lastNumber = 0;
             querySnapshot.forEach(doc => {
                 const data = doc.data();
                 if (data.detalhe) {
                     const currentNumber = parseInt(data.detalhe.replace('-D', ''), 10);
                     if (!isNaN(currentNumber) && currentNumber > lastNumber) {
                         lastNumber = currentNumber;
                     }
                 }
             });
             currentStartDetalheNum = lastNumber + 1;
        }

        for (let i = 0; i < numQuantity; i++) {
            const detalheNum = useDetalhe && currentStartDetalheNum !== null ? currentStartDetalheNum + i : null;
            const detalheCode = detalheNum !== null ? `-D${String(detalheNum).padStart(3, '0')}` : undefined;

            const baseCodeParts = [
                predefinedStates.includes(activeUnidade.toUpperCase()) ? String.fromCharCode(65 + predefinedStates.indexOf(activeUnidade.toUpperCase())) : activeUnidade.toUpperCase().charAt(0),
                setor.padStart(2, '0'),
                `R${rua.padStart(2, '0')}`,
                `${movel.charAt(0).toUpperCase()}${movel.substring(1).padStart(2, '0')}`,
                `N${nivel.padStart(2, '0')}`
            ];
            const codigoCompleto = baseCodeParts.join('.') + (detalheCode || '');

            const newAddress: Omit<Address, 'id'> = {
                unidade: activeUnidade.toUpperCase(), 
                setor: formState.setor,
                rua: `R${formState.rua.padStart(2, '0')}`,
                movel: `${formState.movel.charAt(0).toUpperCase()}${formState.movel.substring(1).padStart(2, '0')}`,
                nivel: `N${formState.nivel.padStart(2, '0')}`,
                detalhe: detalheCode,
                codigoCompleto: codigoCompleto,
                createdAt: new Date().toISOString(),
            };
            
            const newDocRef = doc(addressesCollection);
            batch.set(newDocRef, newAddress);
        }

        await batch.commit();

        toast({ title: 'Sucesso!', description: `${numQuantity} novo(s) endereço(s) cadastrado(s).` });
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

  const handlePrint = (address: WithDocId<Address>) => {
    setSelectedAddressForPrint(address);
  };
  
  const closePrintDialog = () => {
    setSelectedAddressForPrint(null);
  };

  const executePrint = () => {
    const printableContent = document.getElementById('printable-label-area');
    if (printableContent) {
      const printWindow = window.open('', '', 'height=100,width=400');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Imprimir Etiqueta</title>');
        printWindow.document.write('<style>@media print { @page { size: 30mm 6mm; margin: 0; } body { margin: 0; display: flex; align-items: center; justify-content: center; } }</style>');
        printWindow.document.write('</head><body style="margin: 0;">');
        printWindow.document.write(printableContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
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
           {useDetalhe && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end animate-in fade-in-50">
               <div>
                  <Label htmlFor="quantity">Quantidade de Itens</Label>
                  <Input 
                      id="quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                      min="1"
                      placeholder="1"
                  />
               </div>
             </div>
           )}
           <div className="pt-4 space-y-2">
               <Label className="font-semibold">Código Gerado</Label>
               <div className="p-3 rounded-md bg-muted font-mono text-lg">{generatedCode}</div>
           </div>
           <div className="flex justify-end">
               <Button onClick={handleSave} disabled={isSaving}>
                   {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                   <PlusCircle className="mr-2 h-4 w-4"/>
                   Salvar Endereço(s)
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
                            <TableCell className="text-right space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => handlePrint(address)}>
                                    <Printer className="h-4 w-4" />
                                    <span className="sr-only">Imprimir Etiqueta</span>
                                </Button>
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
      
      {selectedAddressForPrint && (
        <Dialog open={!!selectedAddressForPrint} onOpenChange={closePrintDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Etiqueta de Endereçamento</DialogTitle>
                    <DialogDescription>
                        Confirme a etiqueta e clique em imprimir.
                    </DialogDescription>
                </DialogHeader>
                <div id="printable-label-area" className="flex items-center justify-between p-1 border rounded-lg" style={{ width: '113px', height: '23px' }}>
                   <div style={{ width: '20px', height: '20px' }}>
                        <Image
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=20x20&data=${encodeURIComponent(selectedAddressForPrint.codigoCompleto)}`}
                            alt={`QR Code for ${selectedAddressForPrint.codigoCompleto}`}
                            width={20}
                            height={20}
                        />
                   </div>
                   <p className="text-center font-mono font-bold text-[8px]">
                       {selectedAddressForPrint.movel}.{selectedAddressForPrint.nivel}{selectedAddressForPrint.detalhe || ''}
                   </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={closePrintDialog}>Cancelar</Button>
                    <Button onClick={executePrint}>
                        <Printer className="mr-2 h-4 w-4"/>
                        Imprimir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

export default CadastroEnderecosPage;
