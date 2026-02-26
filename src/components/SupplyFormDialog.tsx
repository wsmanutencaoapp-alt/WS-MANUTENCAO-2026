'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
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
import { ref as storageRef, uploadString, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
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
import { Loader2, Upload, ImageIcon, FileText, ExternalLink, ChevronsUpDown, Check } from 'lucide-react';
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
import Image from 'next/image';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandList, CommandItem } from './ui/command';
import { cn } from '@/lib/utils';

const familyCodes: Record<Supply['familia'], string> = {
  MP: '10',
  PA: '20',
  CG: '30',
  CT: '40',
  CP: '50',
};

const formSchema = z.object({
  // Aba 1: Identificação
  familia: z.enum(['MP', 'CT', 'CG', 'CP', 'PA']),
  descricao: z.string().min(3, { message: "A descrição é obrigatória." }),
  partNumber: z.string(),
  unidadeMedida: z.enum(['UN', 'KG', 'MT', 'LT', 'CX']),
  imageUrl: z.string().optional(),
  documentoUrl: z.string().optional(),
  
  // Aba 2: Rastreabilidade
  exigeLote: z.boolean().default(false),
  exigeSerialNumber: z.boolean().default(false),
  exigeValidade: z.boolean().default(false),
  tipoMaterial: z.enum(['Metal', 'Polímero', 'Tecido', 'Outro']).optional(),

  // Aba 3: Estoque
  estoqueMinimo: z.coerce.number().min(0).default(0),
  estoqueMaximo: z.coerce.number().min(0).default(0),
  localizacaoPadrao: z.string().min(1, { message: "A localização é obrigatória." }),
  
  // Aba 4: Conversão
  unidadeSecundaria: z.enum(['G', 'ML', 'CM', 'MM']).optional(),
  fatorConversao: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.coerce.number().optional()
  ),
  pesoBruto: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.coerce.number().optional()
  ),

}).refine(data => {
    if (data.familia !== 'CG') {
        return data.partNumber.length > 0;
    }
    return true;
}, {
    message: "O Part Number é obrigatório para esta família.",
    path: ["partNumber"],
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
  const storage = useStorage();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  
  const addressesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const baseQuery = collection(firestore, 'addresses');
    if (showAllAddresses) {
        return query(baseQuery);
    }
    return query(baseQuery, where('setor', '==', '02'));
  }, [firestore, showAllAddresses]);
    
  const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, { 
      queryKey: ['addresses_suprimentos', showAllAddresses],
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
      imageUrl: '',
      documentoUrl: '',
    },
  });

  const familia = form.watch('familia');

  const resetFormAndClose = () => {
    form.reset();
    setPreviewImage(null);
    setDocumentoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
    setShowAllAddresses(false);
    onClose();
  }

  useEffect(() => {
    if (supply) {
      form.reset(supply);
      setPreviewImage(supply.imageUrl || null);
    } else {
      form.reset({
        descricao: '', partNumber: '', unidadeMedida: 'UN', familia: 'CT',
        exigeLote: false, exigeSerialNumber: false, exigeValidade: false,
        estoqueMinimo: 0, estoqueMaximo: 0, localizacaoPadrao: '',
        imageUrl: '', documentoUrl: '',
      });
      setPreviewImage(null);
    }
    setDocumentoFile(null);
    setShowAllAddresses(false);
  }, [supply, form, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
        form.setValue('exigeSerialNumber', false);
        break;
      case 'CG':
        form.setValue('exigeLote', false);
        form.setValue('exigeSerialNumber', false);
        break;
      default:
        if (!supply) {
           form.setValue('exigeLote', false);
           form.setValue('exigeSerialNumber', false);
           form.setValue('exigeValidade', false);
        }
    }
  }, [familia, form.setValue, isOpen, supply]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentoFile(file);
    }
  };


  const handleSave = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !storage) return;
    setIsSaving(true);
    const tempId = supply?.docId || doc(collection(firestore, 'temp')).id;

    try {
      let finalImageUrl = supply?.imageUrl || '';
      if (previewImage && previewImage !== (supply?.imageUrl || '')) {
          const imageRef = storageRef(storage, `supply_images/${tempId}.jpg`);
          const snapshot = await uploadString(imageRef, previewImage, 'data_url');
          finalImageUrl = await getDownloadURL(snapshot.ref);
      }
      
      let finalDocumentoUrl = supply?.documentoUrl || '';
      if (documentoFile) {
        if(supply?.documentoUrl) {
            try {
                const oldDocRef = storageRef(storage, supply.documentoUrl);
                await deleteObject(oldDocRef);
            } catch(e: any) {
                if(e.code !== 'storage/object-not-found') throw e;
            }
        }
        const docRef = storageRef(storage, `supply_master_docs/${tempId}/${documentoFile.name}`);
        await uploadBytes(docRef, documentoFile);
        finalDocumentoUrl = await getDownloadURL(docRef);
      }
      
      const rawData = { ...values, imageUrl: finalImageUrl, documentoUrl: finalDocumentoUrl };
      
      // Clean the object to remove undefined fields
      const dataToSave: { [key: string]: any } = {};
      Object.keys(rawData).forEach(key => {
        const value = (rawData as any)[key];
        if (value !== undefined) {
          dataToSave[key] = value;
        }
      });


      if (supply) {
        // Edit mode
        const supplyRef = doc(firestore, 'supplies', supply.docId);
        await updateDoc(supplyRef, dataToSave);
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
          ...dataToSave,
          codigo: codigo,
        });
        toast({ title: "Sucesso!", description: `Item ${codigo} criado.` });
      }
      onSuccess();
      resetFormAndClose();
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
  const isPartNumberRequired = useMemo(() => familia !== 'CG', [familia]);

  return (
    <Dialog open={isOpen} onOpenChange={resetFormAndClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{supply ? 'Editar Item de Suprimento' : 'Novo Item de Suprimento'}</DialogTitle>
          <DialogDescription>
            Preencha os dados mestre do item. As regras de rastreabilidade mudam conforme a família.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)}>
            <Tabs defaultValue="identificacao" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                <TabsTrigger value="rastreabilidade">Rastreabilidade</TabsTrigger>
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="conversao">Conversão</TabsTrigger>
              </TabsList>
              
              <div className="max-h-[60vh] overflow-y-auto pr-4 mt-4">
              <TabsContent value="identificacao" className="space-y-4 m-0">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                   <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="familia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Família</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                          <FormLabel>Part Number (P/N){isPartNumberRequired && <span className="text-destructive">*</span>}</FormLabel>
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
                          <Select onValueChange={field.onChange} value={field.value}>
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
                   </div>
                   <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Foto do Item</Label>
                            <div className="flex justify-center items-center h-40 w-full bg-muted rounded-md relative">
                                {previewImage ? <Image src={previewImage} alt="Preview" fill className="object-contain rounded-md" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Carregar Foto</Button>
                            <Input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*"/>
                        </div>
                         <div className="space-y-2">
                            <Label>Documento Principal (FISPQ, Ficha, etc.)</Label>
                             <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => docInputRef.current?.click()}>
                                {documentoFile ? <FileText className="mr-2 text-green-600"/> : <Upload className="mr-2"/>}
                                <span className='truncate'>{documentoFile ? documentoFile.name : 'Anexar/Trocar Documento'}</span>
                             </Button>
                            <Input type="file" ref={docInputRef} onChange={handleDocumentChange} className="hidden"/>
                            {!documentoFile && supply?.documentoUrl && (
                                <Button asChild variant="link" size="sm" className="p-0 h-auto">
                                    <a href={supply.documentoUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-1 h-3 w-3"/>
                                        Ver documento atual
                                    </a>
                                </Button>
                            )}
                        </div>
                   </div>
                 </div>
              </TabsContent>

              <TabsContent value="rastreabilidade" className="space-y-4 m-0">
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
                        <Select onValueChange={field.onChange} value={field.value}>
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

              <TabsContent value="estoque" className="space-y-4 m-0">
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
                          <div className="flex justify-between items-center">
                            <FormLabel>Localização Padrão <span className="text-destructive">*</span></FormLabel>
                            <div className="flex items-center space-x-2">
                                <Switch id="show-all-addresses-supply" checked={showAllAddresses} onCheckedChange={setShowAllAddresses} />
                                <Label htmlFor="show-all-addresses-supply" className="text-xs font-normal">Ver todos</Label>
                            </div>
                          </div>
                          <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                >
                                  {isLoadingAddresses ? "Carregando..." : field.value ? field.value : "Selecione a localização"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                <CommandInput placeholder="Pesquisar endereço..." />
                                <CommandList>
                                  {isLoadingAddresses && <div className="p-4 text-center text-sm"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
                                  {!isLoadingAddresses && (
                                    <>
                                      <CommandEmpty>Nenhum endereço encontrado.</CommandEmpty>
                                      <CommandGroup>
                                        {addresses?.map((addr) => (
                                          <CommandItem
                                            value={addr.codigoCompleto}
                                            key={addr.docId}
                                            onSelect={() => {
                                              form.setValue("localizacaoPadrao", addr.codigoCompleto);
                                              setIsAddressPopoverOpen(false);
                                            }}
                                          >
                                            <Check
                                              className={cn("mr-2 h-4 w-4", addr.codigoCompleto === field.value ? "opacity-100" : "opacity-0")}
                                            />
                                            {addr.codigoCompleto}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </>
                                  )}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
              </TabsContent>

              <TabsContent value="conversao" className="space-y-4 m-0">
                <p className="text-sm text-muted-foreground">Opcional. Use para itens comprados em uma unidade, mas consumidos em outra (ex: comprado em UN, consumido em G).</p>
                <div className="space-y-4 rounded-md border p-4">
                    <FormField
                      control={form.control}
                      name="unidadeSecundaria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade de Consumo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="G">G (Grama)</SelectItem>
                              <SelectItem value="ML">ML (Mililitro)</SelectItem>
                              <SelectItem value="CM">CM (Centímetro)</SelectItem>
                              <SelectItem value="MM">MM (Milímetro)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fatorConversao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fator de Conversão</FormLabel>
                          <FormControl><Input type="number" {...field} placeholder={`Qtd. de ${form.getValues('unidadeSecundaria') || 'unid.'} por ${form.getValues('unidadeMedida')}`}/></FormControl>
                          <FormDescription>Ex: Se 1 UN tem 500g, o fator é 500.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pesoBruto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Bruto Total</FormLabel>
                          <FormControl><Input type="number" {...field} placeholder={`Peso em ${form.getValues('unidadeSecundaria') || 'unid.'}, incluindo embalagem`}/></FormControl>
                           <FormDescription>Peso total do item com embalagem, na unidade de consumo.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </TabsContent>
              </div>

             <DialogFooter className='pt-4'>
                <Button variant="outline" onClick={resetFormAndClose} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
             </DialogFooter>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
