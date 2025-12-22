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
  runTransaction
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import { Loader2, Search, Upload, ImageIcon, CalendarIcon, FileText } from 'lucide-react';
import type { Tool, CalibrationRecord } from '@/lib/types';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar } from './ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    const fetchModels = async () => {
        if (!firestore || !isOpen) return;
        setIsSearching(true);
        try {
            const toolsRef = collection(firestore, 'tools');
            const q = query(toolsRef, where('enderecamento', '==', 'LOGICA'), where('tipo', 'in', ['STD', 'GSE']));
            const querySnapshot = await getDocs(q);
            const models = querySnapshot.docs.map(doc => ({
                ...(doc.data() as Tool),
                docId: doc.id,
            }));
            setAllModels(models);
            setFilteredModels(models);
        } catch (error) {
            console.error('Erro ao buscar modelos:', error);
            toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível carregar os modelos de ferramentas.' });
        } finally {
            setIsSearching(false);
        }
    };
    
    if (isOpen) {
      fetchModels();
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
      const counterId = `${tipo}-${familia}-${classificacao}`;
      const numQuantity = parseInt(quantidade, 10) || 1;
      const newToolsForPrinting = [];

      // Upload files once, before the loop
      let imageUrl = selectedModel.imageUrl || '';
      if (toolImage && toolImage.startsWith('data:')) {
          const imageRef = storageRef(storage, `tool_images/${doc(collection(firestore, 'temp')).id}.jpg`);
          const snapshot = await uploadString(imageRef, toolImage, 'data_url');
          imageUrl = await getDownloadURL(snapshot.ref);
      }

      let certificateUrl = '';
      if (isCalibratable && certificateFile) {
          const certRef = storageRef(storage, `calibration_certificates/${doc(collection(firestore, 'temp')).id}_${certificateFile.name}`);
          await uploadBytes(certRef, certificateFile);
          certificateUrl = await getDownloadURL(certRef);
      }
      
      const batch = writeBatch(firestore);

      for (let i = 0; i < numQuantity; i++) {
        const counterRef = doc(firestore, 'counters', counterId);
        const lastId = await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { lastId: 1 });
                return 0;
            }
            const currentLastId = counterDoc.data().lastId || 0;
            transaction.update(counterRef, { lastId: currentLastId + 1 });
            return currentLastId;
        });
        
        const newSequencial = lastId + 1;
        const newToolRef = doc(collection(firestore, 'tools'));
        
        const { docId, ...baseData } = selectedModel;
        const finalToolData: Omit<Tool, 'id'> = {
          ...baseData,
          codigo: `${tipo}-${familia}-${classificacao}-${newSequencial.toString().padStart(4, '0')}`,
          sequencial: newSequencial,
          status: 'Disponível', 
          enderecamento: enderecamento,
          descricao: descricao,
          valor_estimado: Number(valorEstimado) || 0,
          marca: marca,
          patrimonio: patrimonio,
          imageUrl: imageUrl,
          data_referencia: isCalibratable && calibrationDate ? calibrationDate.toISOString() : undefined,
          data_vencimento: isCalibratable && dueDate ? dueDate.toISOString() : undefined,
          documento_anexo_url: isCalibratable ? certificateUrl : undefined,
        };
          
        batch.set(newToolRef, finalToolData);
        newToolsForPrinting.push({ ...finalToolData, docId: newToolRef.id });

        // If calibratable, add initial record to history subcollection
        if (isCalibratable && calibrationDate && dueDate && certificateUrl) {
            const historyRef = doc(collection(firestore, newToolRef.path, 'calibration_history'));
            const historyRecord: Omit<CalibrationRecord, 'id'> = {
                toolId: newToolRef.id,
                calibrationDate: calibrationDate.toISOString(),
                dueDate: dueDate.toISOString(),
                certificateUrl: certificateUrl,
                calibratedBy: 'Registro Inicial', // Or some other signifier
                timestamp: new Date().toISOString(),
            };
            batch.set(historyRef, historyRecord);
        }
      }

      await batch.commit();

      toast({ title: 'Sucesso!', description: `${numQuantity} ferramenta(s) adicionada(s) ao estoque.` });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      onSuccess(newToolsForPrinting);

    } catch (error: any) {
        console.error("Erro ao salvar:", error);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível concluir. Verifique as permissões e tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
                        <Input id="enderecamento" value={enderecamento} onChange={(e) => setEnderecamento(e.target.value)} placeholder="Ex: GAV-01-A" />
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
