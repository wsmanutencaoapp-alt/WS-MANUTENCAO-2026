'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  addDoc,
  deleteDoc,
  doc,
  where,
  getDocs,
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
import { Loader2, PlusCircle, Trash2, Printer, Search } from 'lucide-react';
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
  const [startDetalheNum, setStartDetalheNum] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [addressesToPrint, setAddressesToPrint] = useState<WithDocId<Address>[]>([]);
  const [printSize, setPrintSize] = useState<'120mm x 23mm' | '100mm x 60mm'>('120mm x 23mm');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('todos');
  const [unidadeFilter, setUnidadeFilter] = useState('todas');


  const addressesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'addresses')) : null),
    [firestore]
  );

  const { data: addresses, isLoading, error } = useCollection<WithDocId<Address>>(addressesQuery, {
      queryKey: ['addresses']
  });
  
  const uniqueUnidades = useMemo(() => {
    if (!addresses) return [];
    return [...new Set(addresses.map(addr => addr.unidade))].sort();
  }, [addresses]);
  
  const uniqueSectores = useMemo(() => {
    if (!addresses) return [];
    const sectorMap: { [key: string]: string } = {
        '01': 'Ferramentaria',
        '02': 'Suprimentos',
        '03': 'Administrativo',
        '04': 'Financeiro',
        '05': 'Engenharia',
    };
    const sectors = new Set(addresses.map(addr => addr.setor));
    return Array.from(sectors).map(code => ({
        code,
        label: `${code} - ${sectorMap[code] || 'Desconhecido'}`
    })).sort((a,b) => a.code.localeCompare(b.code));
  }, [addresses]);


  const filteredAddresses = useMemo(() => {
    if (!addresses) return [];

    let tempAddresses = addresses;

    // Apply unidade filter
    if (unidadeFilter !== 'todas') {
      tempAddresses = tempAddresses.filter(address => address.unidade === unidadeFilter);
    }

    // Apply sector filter
    if (sectorFilter !== 'todos') {
      tempAddresses = tempAddresses.filter(address => address.setor === sectorFilter);
    }

    // Apply search term filter
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      tempAddresses = tempAddresses.filter(address => 
          (address.codigoCompleto && address.codigoCompleto.toLowerCase().includes(lowercasedTerm)) ||
          (address.unidade && address.unidade.toLowerCase().includes(lowercasedTerm)) ||
          (address.setor && address.setor.toLowerCase().includes(lowercasedTerm)) ||
          (address.rua && address.rua.toLowerCase().includes(lowercasedTerm)) ||
          (address.movel && address.movel.toLowerCase().includes(lowercasedTerm)) ||
          (address.nivel && address.nivel.toLowerCase().includes(lowercasedTerm)) ||
          (address.detalhe && address.detalhe.toLowerCase().includes(lowercasedTerm))
      );
    }
    
    return tempAddresses;
  }, [addresses, searchTerm, sectorFilter, unidadeFilter]);


  const predefinedStates = useMemo(() => ['PR', 'SP', 'SC', 'BA', 'RO', 'CE', 'DF', 'MG', 'RJ', 'AM', 'MT'], []);
  
  useEffect(() => {
    const generateNextDetalhe = async () => {
      const { unidade, unidadeOutro, setor, rua, movel, nivel } = formState;
      const activeUnidade = unidade === 'OUTRA' ? unidadeOutro : unidade;

      if (!firestore || !useDetalhe || !activeUnidade || !setor || !rua || !movel || !nivel) {
        setStartDetalheNum(null);
        return;
      }
      
      try {
        const q = query(
            collection(firestore, 'addresses'),
            where('unidade', '==', activeUnidade.toUpperCase()),
            where('setor', '==', setor),
            where('rua', '==', `R${rua.padStart(2, '0')}`),
            where('movel', '==', `${movel.charAt(0).toUpperCase()}${movel.substring(1).padStart(2, '0')}`),
            where('nivel', '==', `N${nivel.padStart(2, '0')}`)
        );
        const querySnapshot = await getDocs(q);
        
        let lastNumber = 0;
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.detalhe && data.detalhe.startsWith('-D')) {
            const currentNumber = parseInt(data.detalhe.replace('-D', ''), 10);
            if (!isNaN(currentNumber) && currentNumber > lastNumber) {
              lastNumber = currentNumber;
            }
          }
        });
        
        const nextNumber = lastNumber + 1;
        setStartDetalheNum(nextNumber);
      } catch (e) {
        console.error("Erro ao buscar endereços para determinar próximo detalhe:", e);
        toast({ variant: 'destructive', title: 'Erro de Índice', description: 'Ocorreu um erro ao buscar os endereços. Pode ser necessário criar um índice no Firestore. Verifique o console para mais detalhes.' });
        setStartDetalheNum(1); // Fallback
      }
    };
    generateNextDetalhe();
  }, [useDetalhe, formState, firestore, toast]);
  
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
        description: 'Unidade, Setor, Rua, Móvel e Nível são obrigatórios.',
      });
      return;
    }
    if (movel && !/^[A-Z]/i.test(movel)) {
      toast({
        variant: 'destructive',
        title: 'Formato Inválido',
        description: 'O campo "Móvel" deve começar com uma letra (A-Z).',
      });
      return;
    }
    if (!firestore) return;
  
    setIsSaving(true);
  
    try {
      const addressesCollection = collection(firestore, 'addresses');
      const newAddressesForPrinting: WithDocId<Address>[] = [];

      if (useDetalhe) {
        const batch = writeBatch(firestore);
        const numQuantity = Number(quantity);
        const stateIndex = predefinedStates.indexOf(activeUnidade.toUpperCase());
        const unidadeCode = stateIndex !== -1 ? String.fromCharCode(65 + stateIndex) : activeUnidade.toUpperCase().charAt(0);
        
        const baseCodeParts = [
            unidadeCode,
            setor.padStart(2, '0'),
            `R${rua.padStart(2, '0')}`,
            `${movel.charAt(0).toUpperCase()}${movel.substring(1).padStart(2, '0')}`,
            `N${nivel.padStart(2, '0')}`
        ];
        const baseCodigo = baseCodeParts.join('.');

        let currentStartDetalheNum = startDetalheNum;
        if (currentStartDetalheNum === null) {
             try {
                const q = query(
                    collection(firestore, 'addresses'),
                    where('unidade', '==', activeUnidade.toUpperCase()),
                    where('setor', '==', setor),
                    where('rua', '==', `R${rua.padStart(2, '0')}`),
                    where('movel', '==', `${movel.charAt(0).toUpperCase()}${movel.substring(1).padStart(2, '0')}`),
                    where('nivel', '==', `N${nivel.padStart(2, '0')}`)
                );
                const querySnapshot = await getDocs(q);
                let lastNumber = 0;
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.detalhe && data.detalhe.startsWith('-D')) {
                        const currentNumber = parseInt(data.detalhe.replace('-D', ''), 10);
                        if (!isNaN(currentNumber) && currentNumber > lastNumber) {
                            lastNumber = currentNumber;
                        }
                    }
                });
                currentStartDetalheNum = lastNumber + 1;
            } catch (e) {
                console.error("Error in fallback address fetch:", e);
                toast({ variant: 'destructive', title: 'Erro de Índice', description: 'Ocorreu um erro ao buscar os endereços para o contador. Pode ser necessário criar um índice no Firestore. Verifique o console.' });
                setIsSaving(false);
                return;
            }
        }
  
        for (let i = 0; i < numQuantity; i++) {
          const detalheNum = currentStartDetalheNum + i;
          const detalheCode = `-D${String(detalheNum).padStart(3, '0')}`;
          const codigoCompleto = baseCodigo + detalheCode;
  
          const newAddressData: Omit<Address, 'id'> = {
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
          batch.set(newDocRef, newAddressData);
          newAddressesForPrinting.push({ docId: newDocRef.id, ...newAddressData, codigoCompleto: newAddressData.codigoCompleto || '' });
        }
        await batch.commit();
        toast({ title: 'Sucesso!', description: `${numQuantity} novo(s) endereço(s) cadastrado(s).` });

      } else {
        const stateIndex = predefinedStates.indexOf(activeUnidade.toUpperCase());
        const unidadeCode = stateIndex !== -1 ? String.fromCharCode(65 + stateIndex) : activeUnidade.toUpperCase().charAt(0);
        const baseCodeParts = [
            unidadeCode,
            setor.padStart(2, '0'),
            `R${rua.padStart(2, '0')}`,
            `${movel.charAt(0).toUpperCase()}${movel.substring(1).padStart(2, '0')}`,
            `N${nivel.padStart(2, '0')}`
        ];
        const codigoCompleto = baseCodeParts.join('.');
        
        const newAddress: Omit<Address, 'id'> = {
          unidade: activeUnidade.toUpperCase(),
          setor: formState.setor,
          rua: `R${formState.rua.padStart(2, '0')}`,
          movel: `${formState.movel.charAt(0).toUpperCase()}${formState.movel.substring(1).padStart(2, '0')}`,
          nivel: `N${formState.nivel.padStart(2, '0')}`,
          detalhe: '',
          codigoCompleto: codigoCompleto,
          createdAt: new Date().toISOString(),
        };
        const docRef = await addDoc(addressesCollection, newAddress);
        newAddressesForPrinting.push({ docId: docRef.id, ...newAddress, codigoCompleto: newAddress.codigoCompleto || '' });
        toast({ title: 'Sucesso!', description: `Novo endereço cadastrado.` });
      }
  
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      resetForm();
      setAddressesToPrint(newAddressesForPrinting);

    } catch (err) {
      console.error("Erro ao salvar endereço:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar the endereço.' });
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
    setAddressesToPrint([address]);
  };
  
  const closePrintDialog = () => {
    setAddressesToPrint([]);
  };

  const executePrint = () => {
    if (!printableAreaRef.current) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
        printWindow.document.write('<html><head><title>Imprimir Etiquetas</title>');
        
        const styles = `
          @media print {
            @page {
              size: ${printSize === '100mm x 60mm' ? '100mm 60mm' : '120mm 23mm'};
              margin: 0;
            }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: sans-serif; 
              -webkit-print-color-adjust: exact; 
              background-color: white;
            }
          }
        `;
        
        printWindow.document.write(`<style>${styles}</style>`);
        printWindow.document.write('</head><body>');
        
        const baseUrl = window.location.origin;
        const targetPath = '/dashboard/enderecos/consulta';

        let contentToPrint = '';
        addressesToPrint.forEach(address => {
            const qrData = `${baseUrl}${targetPath}?code=${encodeURIComponent(address.codigoCompleto)}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

            if (printSize === '100mm x 60mm') {
                contentToPrint += `
                    <div style="width: 100mm; height: 60mm; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; padding: 2mm 8mm 4mm 8mm; box-sizing: border-box; text-align: center; page-break-after: always;">
                        <img src="/logo.png" alt="Logo" style="height: 10mm; object-fit: contain; margin-bottom: 2mm;" />
                        <p style="font-size: 28px; line-height: 1.1; font-weight: 900; color: rgb(0, 0, 0); margin: 0; padding: 0;">
                            ${address.codigoCompleto}
                        </p>
                        <div style="flex: 1; display: flex; align-items: center; justify-content: center; margin-top: 2mm;">
                            <img src="${qrUrl}" alt="QR Code" style="width: 24mm; height: 24mm;" />
                        </div>
                    </div>`;
            } else {
                 contentToPrint += `
                    <div style="width: 120mm; height: 23mm; display: grid; grid-template-columns: auto 1fr auto; align-items: center; padding: 0 2mm; gap: 8mm; box-sizing: border-box; break-inside: avoid; page-break-after: always;">
                        <img src="/logo.png" alt="Logo" style="height: 18mm; width: auto; object-fit: contain; align-self: center;" />
                        <p style="font-size: 24px; font-weight: 900; text-align: center; color: rgb(0, 0, 0);">
                            ${address.codigoCompleto.replace(/^[A-Z]\.\d{2}\.R\d{2}\./, '')}
                        </p>
                        <img src="${qrUrl}" alt="QR Code" style="width: 20mm; height: 20mm;" />
                    </div>`;
            }
        });

        printWindow.document.write(contentToPrint);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        
        // Aguarda um pouco para as imagens carregarem antes de imprimir
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
  };

  const printableAreaRef = useRef<HTMLDivElement>(null);


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
                 <Select value={formState.unidade} onValueChange={(v) => setFormState(p => ({...p, unidade: v, unidadeOutro: ''}))}>
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
            <CardDescription>Visualize e gerencie os endereços existentes.</CardDescription>
            <div className="flex flex-wrap items-center gap-4 pt-4">
               <div className="relative">
                   <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                       placeholder="Pesquisar por código, setor, rua..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                   />
               </div>
                <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por unidade..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas as Unidades</SelectItem>
                        {uniqueUnidades.map(unidade => (
                           <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Filtrar por setor..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos os Setores</SelectItem>
                         {uniqueSectores.map(sector => (
                           <SelectItem key={sector.code} value={sector.code}>{sector.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
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
                    {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">{error.message}</TableCell></TableRow>}
                    {!isLoading && !error && filteredAddresses?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum endereço encontrado.</TableCell></TableRow>}
                    {!isLoading && !error && filteredAddresses?.map(address => (
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
      
      <Dialog open={addressesToPrint.length > 0} onOpenChange={closePrintDialog}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Imprimir Etiqueta(s)</DialogTitle>
                    <DialogDescription>
                    Escolha o tamanho da etiqueta e clique em imprimir.
                    </DialogDescription>
                    <div className="pt-2">
                        <Label htmlFor="print-size">Tamanho da Etiqueta</Label>
                        <Select value={printSize} onValueChange={(v) => setPrintSize(v as any)}>
                            <SelectTrigger id="print-size" className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="120mm x 23mm">Pequena (120mm x 23mm)</SelectItem>
                                <SelectItem value="100mm x 60mm">Grande (100mm x 60mm)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </DialogHeader>
                <div ref={printableAreaRef} className="flex flex-col items-center gap-4 max-h-96 overflow-y-auto p-4 bg-muted/50 rounded-md">
                    {addressesToPrint.map(address => {
                        const baseUrl = window.location.origin;
                        const targetPath = '/dashboard/enderecos/consulta';
                        const qrData = `${baseUrl}${targetPath}?code=${encodeURIComponent(address.codigoCompleto)}`;
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

                        return printSize === '100mm x 60mm' ? (
                            <div key={address.docId} className="bg-white w-[377px] h-[226px] flex flex-col justify-start items-center p-4 pt-2 pb-2 box-border text-center border">
                                <img src="/logo.png" alt="Logo" className="h-10 object-contain mb-2" />
                                <p className="leading-tight font-black text-black" style={{ fontSize: '28px', color: 'rgb(0, 0, 0)', fontWeight: 900 }}>
                                    {address.codigoCompleto}
                                </p>
                                <div className="flex-1 flex items-center justify-center mt-2">
                                    <img src={qrUrl} alt="QR Code" className="w-[90px] h-[90px]" />
                                </div>
                            </div>
                        ) : (
                            <div key={address.docId} className="bg-white w-[452px] h-[87px] grid grid-cols-[auto_1fr_auto] gap-8 items-center p-2 border">
                                <img src="/logo.png" alt="Logo" className="h-[40px] w-auto object-contain" />
                                <p className="text-2xl font-black text-black text-center" style={{ color: 'rgb(0, 0, 0)', fontWeight: 900 }}>
                                    {address.codigoCompleto.replace(/^[A-Z]\.\d{2}\.R\d{2}\./, '')}
                                </p>
                                <img src={qrUrl} alt="QR Code" className="w-[80px] h-[80px]" />
                            </div>
                        )
                    })}
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

    </div>
  );
}

export default CadastroEnderecosPage;