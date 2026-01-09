'use client';
import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  runTransaction,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Supply, Address } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from './ui/separator';

const familyCodes: Record<Supply['familia'], string> = {
  MP: '10',
  PA: '20',
  CG: '30',
  CT: '40',
  CP: '50',
};

const formSchema = z.object({
  // Aba 1: Identificação
  descricao: z.string().min(3, { message: "A descrição é obrigatória." }),
  partNumber: z.string().min(1, { message: "O Part Number é obrigatório." }),
  unidadeMedida: z.enum(['UN', 'KG', 'MT', 'LT', 'CX']),
  familia: z.enum(['MP', 'CT', 'CG', 'CP', 'PA']),
  
  // Aba 2: Rastreabilidade
  exigeLote: z.boolean().default(false),
  exigeSerialNumber: z.boolean().default(false),
  exigeValidade: z.boolean().default(false),
  tipoMaterial: z.enum(['Metal', 'Polímero', 'Tecido', 'Outro']).optional(),

  // Aba 3: Estoque
  estoqueMinimo: z.coerce.number().min(0).default(0),
  estoqueMaximo: z.coerce.number().min(0).default(0),
  localizacaoPadrao: z.string().min(1, { message: "A localização é obrigatória." })
}).refine(data => data.estoqueMaximo >= data.estoqueMinimo, {
    message: "Estoque máximo deve ser maior ou igual ao mínimo.",
    path: ["estoqueMaximo"],
});


interface SupplyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supply: WithDocId<Supply> | null;
}

export default function SupplyFormDialog({ isOpen, onClose, onSuccess, supply }: SupplyFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const addressesQuery = useMemoFirebase(() => (
      firestore ? query(collection(firestore, 'addresses'), where('setor', '==', '02')) : null
    ), [firestore]);
    
  const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, { 
      queryKey: ['addresses_suprimentos'],
      enabled: isOpen,
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: '',
      partNumber: '',
      unidadeMedida: 'UN',
      familia: 'CT',
      exigeLote: false,
      exigeSerialNumber: false,
      exigeValidade: false,
      estoqueMinimo: 0,
      estoqueMaximo: 0,
      localizacaoPadrao: '',
    },
  });

  const familia = form.watch('familia');

  useEffect(() => {
    if (supply) {
      form.reset(supply);
    } else {
      form.reset({
        descricao: '',
        partNumber: '',
        unidadeMedida: 'UN',
        familia: 'CT',
        exigeLote: false,
        exigeSerialNumber: false,
        exigeValidade: false,
        estoqueMinimo: 0,
        estoqueMaximo: 0,
        localizacaoPadrao: '',
      });
    }
  }, [supply, form, isOpen]);

  // Lógica para desabilitar/setar campos de rastreabilidade
  useEffect(() => {
    if (!isOpen) return; // Don't run effect if dialog is closed
    switch (familia) {
      case 'MP':
        form.setValue('exigeLote', true);
        form.setValue('exigeSerialNumber', false);
        break;
      case 'PA':
      case 'CP':
        form.setValue('exigeLote', true);
        form.setValue('exigeSerialNumber', true);
        break;
      case 'CT':
        form.setValue('exigeLote', true);
        form.setValue('exigeSerialNumber', false); // Can be optional as per blueprint
        break;
      case 'CG':
        form.setValue('exigeLote', false);
        form.setValue('exigeSerialNumber', false);
        break;
      default:
        // Set to default for new items
        if (!supply) {
           form.setValue('exigeLote', false);
           form.setValue('exigeSerialNumber', false);
           form.setValue('exigeValidade', false);
        }
    }
  }, [familia, form.setValue, isOpen, supply]);
  
  const handleSave = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;
    setIsSaving(true);

    try {
      if (supply) {
        // Edit mode
        const supplyRef = doc(firestore, 'supplies', supply.docId);
        await updateDoc(supplyRef, values);
        toast({ title: "Sucesso!", description: "Item atualizado." });
      } else {
        // Create mode
        const prefix = familyCodes[values.familia];
        const counterRef = doc(firestore, 'counters', `supply_${prefix}`);
        
        const newSequencial = await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { lastId: 1 });
                return 1;
            }
            const newId = (counterDoc.data().lastId || 0) + 1;
            transaction.update(counterRef, { lastId: newId });
            return newId;
        });

        const codigo = `${prefix}${newSequencial.toString().padStart(4, '0')}`;
        
        await addDoc(collection(firestore, 'supplies'), {
          ...values,
          codigo: codigo,
        });
        toast({ title: "Sucesso!", description: `Item ${codigo} criado.` });
      }
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao salvar item:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar o item.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const isLoteDisabled = useMemo(() => ['MP', 'PA', 'CP', 'CT'].includes(familia), [familia]);
  const isSerialDisabled = useMemo(() => ['MP', 'CG', 'CT'].includes(familia), [familia]);
  const isSerialMandatory = useMemo(() => ['PA', 'CP'].includes(familia), [familia]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supply ? 'Editar Item de Suprimento' : 'Novo Item de Suprimento'}</DialogTitle>
          <DialogDescription>
            Preencha os dados mestre do item. As regras de rastreabilidade mudam conforme a família.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)}>
            <Tabs defaultValue="identificacao" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                <TabsTrigger value="rastreabilidade">Rastreabilidade</TabsTrigger>
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
              </TabsList>
              
              <TabsContent value="identificacao" className="space-y-4 py-4">
                 <FormField
                  control={form.control}
                  name="familia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Família</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="MP">MP - Matéria-Prima</SelectItem>
                          <SelectItem value="CT">CT - Consumível Técnico</SelectItem>
                          <SelectItem value="CG">CG - Consumível Geral</SelectItem>
                          <SelectItem value="CP">CP - Componente</SelectItem>
                          <SelectItem value="PA">PA - Produto Acabado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="partNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Number (P/N)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unidadeMedida"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade de Medida</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="UN">UN (Unidade)</SelectItem>
                          <SelectItem value="KG">KG (Quilograma)</SelectItem>
                          <SelectItem value="MT">MT (Metro)</SelectItem>
                          <SelectItem value="LT">LT (Litro)</SelectItem>
                          <SelectItem value="CX">CX (Caixa)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="rastreabilidade" className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">Regras definidas pela família <span className='font-bold'>{familia}</span>:</p>
                <div className="space-y-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="exigeLote"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <FormLabel>Exige Lote?</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isLoteDisabled} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <Separator/>
                   <FormField
                    control={form.control}
                    name="exigeSerialNumber"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <FormLabel>Exige Serial Number?</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSerialDisabled || isSerialMandatory} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <Separator/>
                  <FormField
                    control={form.control}
                    name="exigeValidade"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <FormLabel>Exige Validade?</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                 {familia === 'MP' && (
                    <FormField
                    control={form.control}
                    name="tipoMaterial"
                    render={({ field }) => (
                      <FormItem className='animate-in fade-in-50'>
                        <FormLabel>Tipo de Material</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo..."/></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Metal">Metal</SelectItem>
                            <SelectItem value="Polímero">Polímero</SelectItem>
                            <SelectItem value="Tecido">Tecido</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 )}
              </TabsContent>

              <TabsContent value="estoque" className="space-y-4 py-4">
                 <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="estoqueMinimo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Mínimo</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="estoqueMaximo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Máximo</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
                  <FormField
                      control={form.control}
                      name="localizacaoPadrao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localização Padrão</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value} >
                            <FormControl>
                              <SelectTrigger disabled={isLoadingAddresses}>
                                <SelectValue placeholder={isLoadingAddresses ? "Carregando endereços..." : "Selecione a localização"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {addresses?.map(addr => (
                                <SelectItem key={addr.docId} value={addr.codigoCompleto}>{addr.codigoCompleto}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
              </TabsContent>
            </Tabs>
             <DialogFooter className='pt-4'>
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
             </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
