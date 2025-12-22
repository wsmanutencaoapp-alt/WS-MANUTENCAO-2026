'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore, useStorage } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  doc,
  limit,
  orderBy,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
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
import { Loader2, Search, Upload, Paperclip, CalendarIcon, ImageIcon, FileText } from 'lucide-react';
import type { Tool } from '@/lib/types';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { Textarea } from './ui/textarea';


interface AddQuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTools: any[]) => void;
}

type FoundTool = Tool & {
  id: string;
};

// Represents a group of tools with the same 'codigo' base
type ToolGroup = FoundTool & {
  unitCount: number;
  lastSequencial: number;
};


export default function AddQuantityDialog({ isOpen, onClose, onSuccess }: AddQuantityDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [enderecamento, setEnderecamento] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [valorEstimado, setValorEstimado] = useState(0);
  const [allLogicTools, setAllLogicTools] = useState<ToolGroup[]>([]);
  const [filteredLogicTools, setFilteredLogicTools] = useState<ToolGroup[]>([]);
  const [selectedToolGroup, setSelectedToolGroup] = useState<ToolGroup | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [descricaoEspecifica, setDescricaoEspecifica] = useState('');
  const [marca, setMarca] = useState('');
  const [toolImage, setToolImage] = useState<string | null>(null);
  const [dataReferencia, setDataReferencia] = useState<Date | undefined>();
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const [docAnexo, setDocAnexo] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docAnexoInputRef = useRef<HTMLInputElement>(null);


  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all logic tools once when the dialog opens
  useEffect(() => {
    const fetchAllLogics = async () => {
        if (!firestore || !isOpen) return;
        setIsSearching(true);
        try {
            const toolsRef = collection(firestore, 'tools');
            // This query now ensures only STD and GSE types marked as LOGICA are fetched.
            const q = query(toolsRef, where('enderecamento', '==', 'LOGICA'), where('tipo', 'in', ['STD', 'GSE']));
            const querySnapshot = await getDocs(q);
            const logics: ToolGroup[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Tool),
                unitCount: 0,
                lastSequencial: 0,
            }));
            setAllLogicTools(logics);
            setFilteredLogicTools(logics); // Show all logics initially
        } catch (error) {
            console.error('Erro ao buscar lógicas:', error);
            toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível carregar as lógicas de ferramentas.' });
        } finally {
            setIsSearching(false);
        }
    };
    
    if (isOpen) {
      fetchAllLogics();
    }
  }, [isOpen, firestore, toast]);

  // Filter logic tools based on search term
  useEffect(() => {
    if (searchTerm.length < 1) {
      setFilteredLogicTools(allLogicTools);
      return;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = allLogicTools.filter(tool => 
        tool.descricao.toLowerCase().includes(lowercasedTerm) || 
        tool.codigo.toLowerCase().includes(lowercasedTerm)
    );
    setFilteredLogicTools(filtered);
  }, [searchTerm, allLogicTools]);


  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
        setDescricaoEspecifica(selectedToolGroup?.descricao || '');
        setValorEstimado(selectedToolGroup?.valor_estimado || 0);
    } else {
      setSearchTerm('');
      setQuantityToAdd(1);
      setEnderecamento('');
      setPatrimonio('');
      setValorEstimado(0);
      setAllLogicTools([]);
      setFilteredLogicTools([]);
      setSelectedToolGroup(null);
      setIsSearching(false);
      setIsSaving(false);
      setToolImage(null);
      setDataReferencia(undefined);
      setDataVencimento(undefined);
      setDocAnexo(null);
      setDescricaoEspecifica('');
      setMarca('');
    }
  }, [isOpen, selectedToolGroup]);
  

    const uploadFile = async (file: File, path: string): Promise<string> => {
        if (!storage) throw new Error("Storage service not available.");
        const fileRef = storageRef(storage, path);
        // We use 'data_url' for both image and file now for simplicity
        const fileAsDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const snapshot = await uploadString(fileRef, fileAsDataUrl, 'data_url');
        return getDownloadURL(snapshot.ref);
    };

    const uploadImage = async (dataUrl: string, path: string): Promise<string> => {
        if (!storage) throw new Error("Storage service not available.");
        const imageRef = storageRef(storage, path);
        const snapshot = await uploadString(imageRef, dataUrl, 'data_url');
        return getDownloadURL(snapshot.ref);
    };

  const handleSave = async () => {
    if (!firestore || !selectedToolGroup || !storage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma lógica de ferramenta selecionada ou serviço indisponível.' });
      return;
    }
    if (quantityToAdd <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A quantidade deve ser maior que zero.' });
      return;
    }
    if (!enderecamento) {
      toast({ variant: 'destructive', title: 'Erro', description: 'O Endereçamento é obrigatório.' });
      return;
    }
    if (!toolImage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A Foto da ferramenta é obrigatória.'});
        return;
    }
    if ((selectedToolGroup.classificacao === 'C' || selectedToolGroup.classificacao === 'L' || selectedToolGroup.classificacao === 'V') && !dataVencimento) {
      toast({ variant: "destructive", description: "Data de Vencimento é obrigatória para esta classificação." }); return;
    }
    if ((selectedToolGroup.classificacao === 'C' || selectedToolGroup.classificacao === 'L') && !docAnexo) {
        toast({ variant: "destructive", description: "Anexo de Certificado/Laudo é obrigatório para esta classificação." }); return;
    }

    setIsSaving(true);
    const { tipo, familia, classificacao } = selectedToolGroup;
    
    try {
      const counterRef = doc(firestore, 'counters', `tool_${tipo}_${familia}_${classificacao}`);
      
      // Step 1: Run transaction ONLY for the counter
      const lastId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentLastId = 0;
        if (!counterDoc.exists()) {
          // If counter doesn't exist, start from 0 and set it to quantityToAdd
          transaction.set(counterRef, { lastId: quantityToAdd });
        } else {
          currentLastId = counterDoc.data().lastId || 0;
          transaction.update(counterRef, { lastId: currentLastId + quantityToAdd });
        }
        return currentLastId;
      });
      
      // Step 2: Use a write batch for creating the new tools
      const batch = writeBatch(firestore);
      const newToolsForPrinting: FoundTool[] = [];

      for (let i = 0; i < quantityToAdd; i++) {
        const newSequencial = lastId + 1 + i;
        const newCode = `${tipo}-${familia}-${classificacao}-${newSequencial.toString().padStart(4, '0')}`;
        const newToolRef = doc(collection(firestore, 'tools'));
        
        const imageUrlPromise = toolImage ? uploadImage(toolImage, `tool_images/${newToolRef.id}.jpg`) : Promise.resolve(selectedToolGroup.imageUrl);
        const docAnexoUrlPromise = docAnexo ? uploadFile(docAnexo, `docs_anexos/${newToolRef.id}_${docAnexo.name}`) : Promise.resolve(undefined);

        const [imageUrl, docAnexoUrl] = await Promise.all([imageUrlPromise, docAnexoUrlPromise]);

        const { id, unitCount, lastSequencial, ...baseData } = selectedToolGroup;
        const newToolData: Omit<Tool, 'id'> = {
          ...baseData,
          codigo: newCode,
          sequencial: newSequencial,
          descricao: descricaoEspecifica || baseData.descricao,
          marca: marca || '',
          valor_estimado: Number(valorEstimado) || 0,
          status: baseData.status === 'Pendente' ? 'Pendente' : 'Disponível',
          enderecamento: enderecamento,
          patrimonio: patrimonio || '',
          imageUrl: imageUrl,
          data_referencia: dataReferencia?.toISOString(),
          data_vencimento: dataVencimento?.toISOString(),
          documento_anexo_url: docAnexoUrl,
        };
        batch.set(newToolRef, newToolData);
        newToolsForPrinting.push({ ...newToolData, id: newToolRef.id });
      }

      await batch.commit();

      toast({ title: 'Sucesso!', description: `${quantityToAdd} nova(s) unidade(s) de ${selectedToolGroup.descricao} foram adicionadas.` });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      onSuccess(newToolsForPrinting);

    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível concluir. Verifique as permissões e tente novamente.' });
      // The error might be from the transaction or the batch, so the path is more generic
      const permissionError = new FirestorePermissionError({
        path: 'tools/{newToolId} or counters/{counterId}',
        operation: 'write', 
        requestResourceData: { info: `Transaction to add ${quantityToAdd} tools for code ${selectedToolGroup.codigo}.` }
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Ferramenta ao Estoque</DialogTitle>
          <DialogDescription>
            Pesquise por um modelo (STD/GSE) e adicione novas unidades ao inventário.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
          <div className="relative">
            <Label htmlFor="searchTerm">Pesquisar Modelo</Label>
            <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchTerm"
              placeholder="Digite a descrição ou código do modelo (ex: Torquímetro, STD-TRQ...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              disabled={!!selectedToolGroup}
            />
             {isSearching && <Loader2 className="absolute right-2.5 bottom-2.5 h-4 w-4 animate-spin" />}
          </div>

          {!isSearching && !selectedToolGroup && (
            <ScrollArea className="h-[200px] border rounded-md p-2">
                {filteredLogicTools.length > 0 ? (
                    <div className="space-y-2">
                        {filteredLogicTools.map((group) => (
                            <button
                                key={group.id}
                                onClick={() => setSelectedToolGroup(group)}
                                className="flex items-start gap-4 p-2 border rounded-lg hover:bg-muted/80 w-full text-left"
                            >
                                <Image
                                    src={group.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                                    alt={group.descricao}
                                    width={48}
                                    height={48}
                                    className="aspect-square rounded-md object-cover"
                                />
                                <div className="text-sm">
                                    <p className="font-bold">{group.descricao}</p>
                                    <p><strong>Código Base:</strong> {group.codigo.substring(0, group.codigo.lastIndexOf('-'))}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        <p>Nenhum modelo encontrado.</p>
                    </div>
                )}
            </ScrollArea>
          )}

          {selectedToolGroup && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4 animate-in fade-in-50">
                <div className="flex justify-between items-start">
                    <h4 className="font-semibold">Modelo Selecionado</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedToolGroup(null)}>Alterar</Button>
                </div>
               <div className="flex items-start gap-4">
                 <Image
                    src={selectedToolGroup.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                    alt={selectedToolGroup.descricao}
                    width={64}
                    height={64}
                    className="aspect-square rounded-md object-cover"
                  />
                  <div className="text-sm">
                      <p className="font-bold">{selectedToolGroup.descricao}</p>
                      <p><strong>Código Base:</strong> {selectedToolGroup.codigo.substring(0, selectedToolGroup.codigo.lastIndexOf('-'))}</p>
                      <p><strong>Classificação:</strong> {selectedToolGroup.classificacao}</p>
                  </div>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-lg">Dados da Instância</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                         <Label htmlFor="descricaoEspecifica">Descrição Específica</Label>
                         <Textarea id="descricaoEspecifica" value={descricaoEspecifica} onChange={(e) => setDescricaoEspecifica(e.target.value)} placeholder={`Ex: ${selectedToolGroup.descricao} 1/2 polegada`} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="marca">Marca</Label>
                        <Input id="marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex: Gedore, Fluke" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="quantityToAdd">Quantidade <span className="text-destructive">*</span></Label>
                        <Input id="quantityToAdd" type="number" min="1" value={quantityToAdd} onChange={(e) => setQuantityToAdd(parseInt(e.target.value, 10) || 1)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="enderecamento">Endereçamento <span className="text-destructive">*</span></Label>
                        <Input id="enderecamento" value={enderecamento} onChange={(e) => setEnderecamento(e.target.value)} placeholder="Ex: GAV-01-A" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="patrimonio">Nº Patrimônio (Opcional)</Label>
                        <Input id="patrimonio" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Definido pela contabilidade" />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="valorEstimado">Valor Estimado (R$)</Label>
                        <Input id="valorEstimado" type="number" value={valorEstimado} onChange={(e) => setValorEstimado(parseFloat(e.target.value) || 0)} placeholder="Ex: 150.00" />
                    </div>
                    <div className="flex items-center gap-4 md:col-span-2">
                        {toolImage ? <Image src={toolImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" /> : <div className="h-12 w-12 flex items-center justify-center bg-muted-foreground/20 rounded-md"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Anexar Foto da Ferramenta<span className='text-destructive ml-1'>*</span></Button>
                        <Input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setToolImage(reader.result as string); reader.readAsDataURL(file); }}} className="hidden" accept="image/*" required/>
                    </div>
                 </CardContent>
              </Card>

              {selectedToolGroup.classificacao !== 'N' && (
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Controle e Validade</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <Label>
                                {selectedToolGroup.classificacao === 'C' ? 'Data Última Calibração' : selectedToolGroup.classificacao === 'L' ? 'Data Último Teste' : 'Data Fabricação/Insp.'}
                           </Label>
                            <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dataReferencia ? format(dataReferencia, 'PPP') : <span>Escolha uma data</span>}</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dataReferencia} onSelect={setDataReferencia} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                        <div>
                           <Label>Data de Vencimento <span className='text-destructive'>*</span></Label>
                           <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dataVencimento ? format(dataVencimento, 'PPP') : <span>Escolha uma data</span>}</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dataVencimento} onSelect={setDataVencimento} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                        {(selectedToolGroup.classificacao === 'C' || selectedToolGroup.classificacao === 'L') && (
                            <div className="flex items-center gap-4 col-span-2">
                                {docAnexo ? <FileText/> : <div className="h-12 w-12 flex items-center justify-center bg-muted-foreground/20 rounded-md"><Paperclip className="h-6 w-6 text-muted-foreground" /></div>}
                                <Button type="button" variant="outline" size="sm" onClick={() => docAnexoInputRef.current?.click()}>Anexar Certificado/Laudo <span className='text-destructive ml-1'>*</span></Button>
                                <Input type="file" ref={docAnexoInputRef} onChange={(e) => setDocAnexo(e.target.files?.[0] || null)} className="hidden" required/>
                                {docAnexo && <span className="text-sm text-muted-foreground truncate">{docAnexo.name}</span>}
                            </div>
                        )}
                    </CardContent>
                  </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedToolGroup || isSaving || isSearching}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar e Imprimir Etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    