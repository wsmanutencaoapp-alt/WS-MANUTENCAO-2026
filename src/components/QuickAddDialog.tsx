'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore, useStorage } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  runTransaction,
  limit,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
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
import { Loader2, Search, Upload, ImageIcon, CalendarIcon, FileText, Check, ChevronsUpDown } from 'lucide-react';
import type { Tool, CalibrationRecord, Address } from '@/lib/types';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar } from './ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';

interface QuickAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTools: any[]) => void;
}

type ModelTool = Tool & {
  docId: string;
};

export default function QuickAddDialog({ isOpen, onClose, onSuccess }: QuickAddDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allModels, setAllModels] = useState<ModelTool[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelTool[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelTool | null>(null);
  
  const [descricao, setDescricao] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [toolImage, setToolImage] = useState<string | null>(null);
  const [enderecamento, setEnderecamento] = useState('');
  const [marca, setMarca] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [quantidade, setQuantidade] = useState('1');

  // State for calibration fields
  const [calibrationDate, setCalibrationDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  
  // State for Collapsible controls
  const [isCalDateOpen, setIsCalDateOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [availableAddresses, setAvailableAddresses] = useState<{value: string, label: string}[]>([]);
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const certificateInputRef = useRef<HTMLInputElement>(null);
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isCalibratable = useMemo(() => {
    if (!selectedModel) return false;
    return ['C', 'L', 'V'].includes(selectedModel.classificacao);
  }, [selectedModel]);

  useEffect(() => {
    const fetchPrerequisites = async () => {
        if (!firestore || !isOpen) return;
        setIsSearching(true);
        try {
            // Fetch models
            const modelsRef = collection(firestore, 'tools');
            const qModels = query(modelsRef, where('enderecamento', '==', 'LOGICA'), where('tipo', 'in', ['STD', 'GSE']));
            const modelsSnapshot = await getDocs(qModels);
            const models = modelsSnapshot.docs.map(doc => ({
                ...(doc.data() as Tool),
                docId: doc.id,
            }));
            setAllModels(models);
            setFilteredModels(models);

            // Fetch addresses and tools to determine available addresses
            const addressesRef = collection(firestore, 'addresses');
            const qAddresses = query(addressesRef, where('setor', '==', '01'));
            const addressesSnapshot = await getDocs(qAddresses);
            const allFerramentariaAddresses = addressesSnapshot.docs.map(doc => doc.data() as Address);

            const toolsRef = collection(firestore, 'tools');
            const toolsSnapshot = await getDocs(toolsRef);
            const occupiedAddresses = new Set(toolsSnapshot.docs.map(doc => doc.data().enderecamento));
            
            const unoccupied = allFerramentariaAddresses
                .filter(addr => !occupiedAddresses.has(addr.codigoCompleto))
                .map(addr => ({ value: addr.codigoCompleto, label: addr.codigoCompleto }));
            
            setAvailableAddresses(unoccupied);

        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível carregar os dados necessários.' });
        } finally {
            setIsSearching(false);
        }
    };
    
    if (isOpen) {
      fetchPrerequisites();
    }
  }, [isOpen, firestore, toast]);

  useEffect(() => {
    if (searchTerm.length < 1) {
      setFilteredModels(allModels);
      return;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = allModels.filter(tool => 
        tool.descricao.toLowerCase().includes(lowercasedTerm) || 
        tool.codigo.toLowerCase().includes(lowercasedTerm)
    );
    setFilteredModels(filtered);
  }, [searchTerm, allModels]);
  
  useEffect(() => {
    if (selectedModel) {
      setDescricao(selectedModel.descricao);
      setToolImage(selectedModel.imageUrl || null);
      setMarca(selectedModel.marca || '');
      setValorEstimado('');
      setEnderecamento('');
      setPatrimonio('');
      setQuantidade('1');
      setCalibrationDate(undefined);
      setDueDate(undefined);
      setCertificateFile(null);
    }
  }, [selectedModel]);


  const resetFormState = () => {
      setSearchTerm('');
      setAllModels([]);
      setFilteredModels([]);
      setSelectedModel(null);
      setEnderecamento('');
      setDescricao('');
      setValorEstimado('');
      setToolImage(null);
      setMarca('');
      setPatrimonio('');
      setQuantidade('1');
      setCalibrationDate(undefined);
      setDueDate(undefined);
      setCertificateFile(null);
      setIsSearching(false);
      setIsSaving(false);
      setAvailableAddresses([]);
      if(fileInputRef.current) fileInputRef.current.value = '';
      if(certificateInputRef.current) certificateInputRef.current.value = '';
  }

  useEffect(() => {
    if (!isOpen) {
      resetFormState();
    }
  }, [isOpen]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setToolImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCertificateFile(file);
  }

  const handleSave = async () => {
    if (!firestore || !storage || !selectedModel) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum modelo selecionado.' });
      return;
    }
    if (!enderecamento) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O Endereçamento é obrigatório.' });
      return;
    }
    if (!descricao) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A Descrição é obrigatória.' });
        return;
    }
    if (isCalibratable) {
        if (!calibrationDate || !dueDate || !certificateFile) {
            toast({ variant: 'destructive', title: 'Erro de Calibração', description: 'Para itens calibráveis, as datas e o certificado são obrigatórios.' });
            return;
        }
    }

    setIsSaving(true);
    
    try {
        const { tipo, familia, classificacao } = selectedModel;
        const numQuantity = parseInt(quantidade, 10) || 1;
        const toolsRef = collection(firestore, "tools");
        const counterRef = doc(firestore, 'counters', `${tipo}-${familia}-${classificacao}`);

        const seqNumbers = await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let lastId = -1;
            if (counterDoc.exists()) {
                lastId = counterDoc.data()?.lastId ?? -1;
            } else {
                // If the counter doesn't exist, we can't assume lastId is -1 if we start with numQuantity
                transaction.set(counterRef, { lastId: numQuantity - 1 });
                lastId = -1; // so the first id is 0
            }
            
            const newLastId = lastId + numQuantity;
            if (counterDoc.exists()) {
              transaction.update(counterRef, { lastId: newLastId });
            } else {
              transaction.set(counterRef, { lastId: newLastId });
            }


            const numbers: number[] = [];
            for (let i = 0; i < numQuantity; i++) {
                numbers.push(lastId + 1 + i);
            }
            return numbers;
        });

        const newToolsForPrinting = [];
        const toolRefsAndData = [];
        const batch = writeBatch(firestore);

        let imageUrl = selectedModel.imageUrl || '';
        if (toolImage && toolImage.startsWith('data:')) {
            const imageRef = storageRef(storage, `tool_images/${doc(collection(firestore, 'temp')).id}.jpg`);
            const snapshot = await uploadString(imageRef, toolImage, 'data_url');
            imageUrl = await getDownloadURL(snapshot.ref);
        }
        
        for (const sequencial of seqNumbers) {
            const newToolRef = doc(toolsRef);
            const { docId, ...baseData } = selectedModel;
            
            const finalToolData: Partial<Tool> = {
                ...baseData,
                codigo: `${tipo}-${familia}-${classificacao}-${sequencial.toString().padStart(4, '0')}`,
                sequencial: sequencial,
                status: 'Disponível',
                enderecamento: enderecamento,
                descricao: descricao,
                valor_estimado: Number(valorEstimado) || 0,
                marca: marca,
                patrimonio: patrimonio,
                imageUrl: imageUrl,
            };
            
            if (isCalibratable && calibrationDate && dueDate) {
              finalToolData.data_referencia = calibrationDate.toISOString();
              finalToolData.data_vencimento = dueDate.toISOString();
            }
            
            batch.set(newToolRef, finalToolData);
            const toolForPrinting = { ...finalToolData, docId: newToolRef.id };
            newToolsForPrinting.push(toolForPrinting);
            toolRefsAndData.push({ ref: newToolRef, data: toolForPrinting });
        }

        await batch.commit();

        if (isCalibratable && calibrationDate && dueDate && certificateFile) {
            const historyBatch = writeBatch(firestore);
            
            for (const { ref: toolRef, data: toolData } of toolRefsAndData) {
                const certRef = storageRef(storage, `calibration_certificates/${toolRef.id}/${Date.now()}_${certificateFile.name}`);
                const certSnapshot = await uploadBytes(certRef, certificateFile);
                const certificateUrl = await getDownloadURL(certSnapshot.ref);

                await updateDoc(toolRef, { documento_anexo_url: certificateUrl });

                const historyRef = doc(collection(toolRef, 'calibration_history'));
                const historyRecord: Omit<CalibrationRecord, 'id'> = {
                    toolId: toolRef.id,
                    calibrationDate: calibrationDate.toISOString(),
                    dueDate: dueDate.toISOString(),
                    certificateUrl: certificateUrl,
                    calibratedBy: 'Registro Inicial',
                    timestamp: new Date().toISOString(),
                };
                historyBatch.set(historyRef, historyRecord);
            }
            await historyBatch.commit();
        }

        toast({ title: 'Sucesso!', description: `${numQuantity} ferramenta(s) adicionada(s) ao estoque.` });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
        onSuccess(newToolsForPrinting);

    } catch (error: any) {
        console.error("Erro ao salvar:", error);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: `Não foi possível concluir. Verifique as permissões e tente novamente. Detalhe: ${error.message}` });
    } finally {
        setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar Unidade ao Estoque</DialogTitle>
          <DialogDescription>
            Selecione um modelo e defina os detalhes para adicionar a nova ferramenta.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] -mr-3 pr-6">
        <div className="space-y-4 py-4">
          {!selectedModel ? (
            <>
              <div className="relative">
                <Label htmlFor="searchTerm">Pesquisar Modelo (STD/GSE)</Label>
                <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="searchTerm"
                  placeholder="Digite a descrição ou código do modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
                {isSearching && <Loader2 className="absolute right-2.5 bottom-2.5 h-4 w-4 animate-spin" />}
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                  {filteredModels.length > 0 ? (
                      <div className="space-y-2">
                          {filteredModels.map((model) => (
                              <button
                                  key={model.docId}
                                  onClick={() => setSelectedModel(model)}
                                  className="flex items-start gap-4 p-2 border rounded-lg hover:bg-muted/80 w-full text-left"
                              >
                                  <Image
                                      src={model.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                                      alt={model.descricao}
                                      width={48}
                                      height={48}
                                      className="aspect-square rounded-md object-cover"
                                  />
                                  <div className="text-sm">
                                      <p className="font-bold">{model.descricao}</p>
                                      <p><strong>Código Base:</strong> {model.codigo.substring(0, model.codigo.lastIndexOf('-'))}</p>
                                  </div>
                              </button>
                          ))}
                      </div>
                  ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                          <p>{isSearching ? 'Buscando...' : 'Nenhum modelo encontrado.'}</p>
                      </div>
                  )}
              </ScrollArea>
            </>
          ) : (
            <div className="p-1 space-y-4 animate-in fade-in-50">
                <div className="flex justify-between items-start p-2 border rounded-lg bg-muted/50">
                   <div className="flex items-start gap-4">
                     <Image
                        src={selectedModel.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                        alt={selectedModel.descricao}
                        width={64}
                        height={64}
                        className="aspect-square rounded-md object-cover"
                      />
                      <div className="text-sm">
                          <p className="font-semibold text-muted-foreground">Modelo Selecionado</p>
                          <p className="font-bold">{selectedModel.descricao}</p>
                          <p><strong>Código Base:</strong> {selectedModel.codigo.substring(0, selectedModel.codigo.lastIndexOf('-'))}</p>
                      </div>
                  </div>
                   <Button variant="ghost" size="sm" onClick={() => setSelectedModel(null)}>Alterar</Button>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="descricao">Descrição Específica <span className="text-destructive">*</span></Label>
                    <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Chave de Fenda Philips #2 com cabo emborrachado" />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="enderecamento">Endereçamento <span className="text-destructive">*</span></Label>
                         <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isAddressPopoverOpen}
                              className="w-full justify-between font-normal"
                            >
                              {enderecamento
                                ? availableAddresses.find((addr) => addr.value === enderecamento)?.label
                                : "Selecione um endereço..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                              <Command>
                              <CommandInput placeholder="Pesquisar endereço..." />
                              <CommandList>
                                  <CommandEmpty>Nenhum endereço disponível encontrado.</CommandEmpty>
                                  <CommandGroup>
                                  {availableAddresses.map((addr) => (
                                      <CommandItem
                                      key={addr.value}
                                      value={addr.value}
                                      onSelect={(currentValue) => {
                                          setEnderecamento(currentValue === enderecamento ? "" : currentValue)
                                          setIsAddressPopoverOpen(false)
                                      }}
                                      >
                                      <Check
                                          className={cn(
                                          "mr-2 h-4 w-4",
                                          enderecamento === addr.value ? "opacity-100" : "opacity-0"
                                          )}
                                      />
                                      {addr.label}
                                      </CommandItem>
                                  ))}
                                  </CommandGroup>
                              </CommandList>
                              </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="marca">Marca</Label>
                        <Input id="marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex: Gedore" />
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="valorEstimado">Valor Estimado (R$)</Label>
                        <Input id="valorEstimado" type="number" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} placeholder="Ex: 150.00" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="patrimonio">Patrimônio</Label>
                        <Input id="patrimonio" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Ex: 123456" />
                    </div>
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="quantidade">Quantidade a Adicionar</Label>
                    <Input id="quantidade" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="1" min="1" />
                 </div>
                 <div className="space-y-1.5">
                    <Label>Foto da Ferramenta</Label>
                    <div className="flex items-center gap-4">
                        {toolImage ? <Image src={toolImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" /> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Carregar Foto</Button>
                        <Input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*"/>
                    </div>
                </div>
                 {isCalibratable && (
                   <div className="space-y-4 pt-4 border-t mt-4">
                        <h3 className="text-sm font-semibold text-primary">Dados de Calibração (Obrigatório)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Collapsible open={isCalDateOpen} onOpenChange={setIsCalDateOpen}>
                              <div className="space-y-2">
                                <Label>Data da Calibração</Label>
                                <CollapsibleTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {calibrationDate ? format(calibrationDate, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                                  </Button>
                                </CollapsibleTrigger>
                              </div>
                              <CollapsibleContent>
                                  <Calendar
                                      mode="single"
                                      selected={calibrationDate}
                                      onSelect={(day) => { setCalibrationDate(day); setIsCalDateOpen(false); }}
                                      initialFocus
                                  />
                              </CollapsibleContent>
                            </Collapsible>
                             <Collapsible open={isDueDateOpen} onOpenChange={setIsDueDateOpen}>
                               <div className="space-y-2">
                                 <Label>Data de Vencimento</Label>
                                 <CollapsibleTrigger asChild>
                                   <Button variant="outline" className="w-full justify-start text-left font-normal">
                                     <CalendarIcon className="mr-2 h-4 w-4" />
                                     {dueDate ? format(dueDate, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                                   </Button>
                                 </CollapsibleTrigger>
                               </div>
                               <CollapsibleContent>
                                   <Calendar
                                       mode="single"
                                       selected={dueDate}
                                       onSelect={(day) => { setDueDate(day); setIsDueDateOpen(false); }}
                                       initialFocus
                                   />
                               </CollapsibleContent>
                             </Collapsible>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Certificado / Laudo</Label>
                            <Button asChild variant="outline" className="w-full">
                                <label className="cursor-pointer flex items-center">
                                    {certificateFile ? <FileText className="mr-2 h-4 w-4 text-green-600" /> : <Upload className="mr-2 h-4 w-4" />}
                                    <span className="truncate max-w-xs">{certificateFile ? certificateFile.name : 'Anexar certificado'}</span>
                                    <Input type="file" className="sr-only" ref={certificateInputRef} onChange={handleCertificateChange} />
                                </label>
                            </Button>
                        </div>
                   </div>
                )}
            </div>
          )}
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedModel || isSaving || isSearching || !enderecamento || !descricao}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar e Imprimir Etiqueta(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
