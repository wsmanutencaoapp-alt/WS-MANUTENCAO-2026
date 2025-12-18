'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { writeBatch, doc, query, collection, where, getDocs, limit, updateDoc } from 'firebase/firestore';
import type { Tool, ToolRequest, InspectionResult } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Loader2, Search, Undo2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';

type InspectionStatus = 'ok' | 'nok';
interface InspectionState {
  visual: InspectionStatus | null;
  funcional: InspectionStatus | null;
  observacao: string;
}

interface ManualCheckInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allLoanedTools: WithDocId<Tool>[];
  onActionSuccess: () => void;
  preselectedToolIds?: string[];
  isRequestReturn?: boolean;
}

export default function ManualCheckInDialog({ 
    isOpen, 
    onClose, 
    allLoanedTools, 
    onActionSuccess, 
    preselectedToolIds = [],
    isRequestReturn = false 
}: ManualCheckInDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [inspectionData, setInspectionData] = useState<Record<string, InspectionState>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const preselectedIdsString = useMemo(() => preselectedToolIds.sort().join(','), [preselectedToolIds]);

  useEffect(() => {
    if (isOpen) {
        const initialIds = new Set(preselectedToolIds);
        setSelectedToolIds(initialIds);

        const newInspectionData: Record<string, InspectionState> = {};
        initialIds.forEach(id => {
            newInspectionData[id] = { visual: null, funcional: null, observacao: '' };
        });
        setInspectionData(newInspectionData);
    }
  }, [isOpen, preselectedIdsString]);


  const filteredTools = useMemo(() => {
    if (!allLoanedTools) return [];
    if (!searchTerm) return allLoanedTools;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allLoanedTools.filter(
      tool =>
        (tool.descricao && tool.descricao.toLowerCase().includes(lowercasedTerm)) ||
        (tool.codigo && tool.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [allLoanedTools, searchTerm]);

  const handleToolSelect = (toolId: string) => {
    // Cannot deselect tools when returning from a specific request
    if (isRequestReturn) return;

    setSelectedToolIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
        // Also remove inspection data when unchecking
        const newInspectionData = { ...inspectionData };
        delete newInspectionData[toolId];
        setInspectionData(newInspectionData);
      } else {
        newSet.add(toolId);
         // Initialize inspection data for the new tool
        setInspectionData(prevInsp => ({...prevInsp, [toolId]: { visual: null, funcional: null, observacao: '' }}));
      }
      return newSet;
    });
  };

  const handleInspectionChange = (toolId: string, type: 'visual' | 'funcional', value: InspectionStatus) => {
    setInspectionData(prev => ({
      ...prev,
      [toolId]: { ...prev[toolId], [type]: value },
    }));
  };
   const handleObservacaoChange = (toolId: string, value: string) => {
    setInspectionData(prev => ({
      ...prev,
      [toolId]: { ...prev[toolId], observacao: value },
    }));
  };

  const resetAndClose = () => {
    setSelectedToolIds(new Set());
    setInspectionData({});
    setSearchTerm('');
    setIsSaving(false);
    onClose();
  };

  const isReturnDisabled = useMemo(() => {
    if (isSaving || selectedToolIds.size === 0) return true;
    // Check if all checklists are filled for the selected tools
    for (const toolId of selectedToolIds) {
      const inspection = inspectionData[toolId];
      if (!inspection || !inspection.visual || !inspection.funcional) {
        return true; // Disable if any checklist is not filled
      }
      // If NOK, observation is mandatory
      if ((inspection.visual === 'nok' || inspection.funcional === 'nok') && !inspection.observacao) {
        return true;
      }
    }
    return false;
  }, [isSaving, selectedToolIds, inspectionData]);

  const handleReturn = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
      return;
    }
    if (isReturnDisabled) {
      toast({ variant: 'destructive', title: 'Ação Bloqueada', description: 'Preencha todos os checklists e observações (se houver NOK) antes de continuar.' });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const toolIdsArray = Array.from(selectedToolIds);

      // Find active requests for these tools
      const requestsRef = collection(firestore, 'tool_requests');
      const q = query(
        requestsRef,
        where('toolIds', 'array-contains-any', toolIdsArray),
        where('status', '==', 'Em Uso')
      );
      const requestSnapshot = await getDocs(q);

      // We might have multiple requests if tools from different loans are returned together.
      const requestUpdates: Map<string, { returnedTools: string[], allTools: string[], existingConditions: Record<string, InspectionResult> }> = new Map();

      toolIdsArray.forEach(toolId => {
        const reqDoc = requestSnapshot.docs.find(doc => (doc.data() as ToolRequest).toolIds.includes(toolId));
        if (reqDoc) {
            if (!requestUpdates.has(reqDoc.id)) {
                requestUpdates.set(reqDoc.id, { 
                    returnedTools: [], 
                    allTools: (reqDoc.data() as ToolRequest).toolIds,
                    existingConditions: (reqDoc.data() as ToolRequest).returnConditions || {}
                });
            }
            requestUpdates.get(reqDoc.id)!.returnedTools.push(toolId);
        }
      });
      
      // Update requests and tools
      for(const [reqId, update] of requestUpdates.entries()) {
          
          const remainingToolsInRequest = update.allTools.filter(id => !update.returnedTools.includes(id));
          const allToolsForThisRequestReturned = remainingToolsInRequest.length === 0;

          const requestRef = doc(firestore, 'tool_requests', reqId);

          // Prepare the return conditions object
          const newReturnConditions = { ...update.existingConditions };
          for (const toolId of update.returnedTools) {
              const inspection = inspectionData[toolId];
              if (inspection && inspection.visual && inspection.funcional) {
                  newReturnConditions[toolId] = {
                      visual: inspection.visual,
                      funcional: inspection.funcional,
                      observacao: inspection.observacao
                  };
              }
          }

          if (allToolsForThisRequestReturned) {
              batch.update(requestRef, { 
                  status: 'Devolvida', 
                  returnedAt: new Date().toISOString(),
                  returnConditions: newReturnConditions
              });
          } else {
              // Partial return: remove returned tools from the request's list
              batch.update(requestRef, { 
                  toolIds: remainingToolsInRequest,
                  returnConditions: newReturnConditions 
              });
          }
      }

      // Update tools status based on inspection
      for (const toolId of toolIdsArray) {
        const toolRef = doc(firestore, 'tools', toolId);
        const inspection = inspectionData[toolId];
        const isNonConforming = inspection.visual === 'nok' || inspection.funcional === 'nok';
        
        if (isNonConforming) {
          batch.update(toolRef, { 
            status: 'Em Manutenção',
            observacao: inspection.observacao
          });
        } else {
          batch.update(toolRef, { 
            status: 'Disponível',
            observacao: '' // Clear observation if OK
          });
        }
      }

      await batch.commit();

      toast({ title: 'Sucesso', description: `${toolIdsArray.length} ferramenta(s) processada(s) na devolução.` });
      
      // Invalidate queries to refetch data across the app
      queryClient.invalidateQueries({ queryKey: ['tool_requests_active'] });
      queryClient.invalidateQueries({ queryKey: ['tool_requests_history_completed'] });
      queryClient.invalidateQueries({ queryKey: ['loanedToolsForMovement'] });
      queryClient.invalidateQueries({ queryKey: ['availableToolsForMovement'] });
      queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
      queryClient.invalidateQueries({ queryKey: ['nonConformingTools'] });

      onActionSuccess();
      resetAndClose();
    } catch (error: any) {
      console.error('Erro ao registrar devolução:', error);
      toast({ variant: 'destructive', title: 'Erro na Devolução', description: error.message || 'Não foi possível registrar a devolução.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Registrar Entrada (Devolução e Inspeção)</DialogTitle>
          <DialogDescription>
            {isRequestReturn ? "Realize o checklist de conformidade para as ferramentas desta requisição." : "Selecione as ferramentas e realize o checklist de conformidade."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh]">
          {/* Coluna da Esquerda: Lista de Ferramentas */}
          <div className="flex flex-col gap-4">
             <div className="space-y-1.5">
                <Label htmlFor="toolSearch-checkin">Buscar Ferramenta Emprestada</Label>
                <div className="relative">
                <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    id="toolSearch-checkin"
                    placeholder="Pesquisar por código ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    disabled={isRequestReturn}
                />
                </div>
            </div>
            <ScrollArea className="h-96 border rounded-md">
                <div className="p-2 space-y-2">
                {!allLoanedTools && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
                {allLoanedTools && allLoanedTools.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma ferramenta emprestada no momento.</p>}
                {filteredTools && filteredTools.map(tool => (
                    <div 
                    key={tool.docId}
                    className="flex items-center gap-4 p-2 border rounded-lg hover:bg-muted/50 data-[state=checked]:bg-blue-100 dark:data-[state=checked]:bg-blue-900/30"
                    data-state={selectedToolIds.has(tool.docId) ? 'checked' : 'unchecked'}
                    onClick={() => handleToolSelect(tool.docId)}
                    style={{ cursor: isRequestReturn ? 'default' : 'pointer' }}
                    >
                    <Checkbox
                        checked={selectedToolIds.has(tool.docId)}
                        onCheckedChange={() => handleToolSelect(tool.docId)}
                        aria-label={`Selecionar ${tool.descricao}`}
                        disabled={isRequestReturn}
                    />
                    <Image
                        src={tool.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                        alt={tool.descricao || 'Ferramenta'}
                        width={40}
                        height={40}
                        className="aspect-square rounded-md object-cover"
                    />
                    <div className="flex-1 text-sm">
                        <p className="font-bold">{tool.descricao}</p>
                        <p className="font-mono text-xs text-muted-foreground">{tool.codigo}</p>
                    </div>
                    </div>
                ))}
                </div>
            </ScrollArea>
          </div>
          
          {/* Coluna da Direita: Checklist */}
          <div className="flex flex-col gap-4">
            <Label>Checklist de Conformidade ({selectedToolIds.size} selecionadas)</Label>
            <ScrollArea className="h-96 border rounded-md">
              <div className="p-4 space-y-4">
                {selectedToolIds.size === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">Selecione uma ou mais ferramentas para inspecionar.</p>
                )}
                {Array.from(selectedToolIds).map((toolId, index) => {
                  const tool = allLoanedTools.find(t => t.docId === toolId);
                  const inspection = inspectionData[toolId];
                  const showObservation = inspection?.visual === 'nok' || inspection?.funcional === 'nok';
                  if (!tool || !inspection) return null;

                  return (
                    <div key={toolId}>
                      <div className="font-semibold text-sm mb-2">{tool.codigo} - {tool.descricao}</div>
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                          <Label className="text-xs">Aspecto Visual</Label>
                          <RadioGroup value={inspection.visual || ''} onValueChange={(value) => handleInspectionChange(toolId, 'visual', value as InspectionStatus)} className="flex gap-4 mt-1">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="ok" id={`${toolId}-v-ok`} /><Label htmlFor={`${toolId}-v-ok`} className="text-xs">OK</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="nok" id={`${toolId}-v-nok`} /><Label htmlFor={`${toolId}-v-nok`} className="text-xs">NOK</Label></div>
                          </RadioGroup>
                        </div>
                        <div>
                          <Label className="text-xs">Aspecto Funcional</Label>
                           <RadioGroup value={inspection.funcional || ''} onValueChange={(value) => handleInspectionChange(toolId, 'funcional', value as InspectionStatus)} className="flex gap-4 mt-1">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="ok" id={`${toolId}-f-ok`} /><Label htmlFor={`${toolId}-f-ok`} className="text-xs">OK</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="nok" id={`${toolId}-f-nok`} /><Label htmlFor={`${toolId}-f-nok`} className="text-xs">NOK</Label></div>
                          </RadioGroup>
                        </div>
                      </div>
                      {showObservation && (
                        <div className="space-y-1 animate-in fade-in-50">
                          <Label htmlFor={`${toolId}-obs`} className="text-xs">Observação (Obrigatório para NOK) <span className="text-destructive">*</span></Label>
                          <Textarea id={`${toolId}-obs`} value={inspection.observacao} onChange={(e) => handleObservacaoChange(toolId, e.target.value)} placeholder="Descreva a avaria encontrada..." />
                        </div>
                      )}
                      {index < selectedToolIds.size - 1 && <Separator className="mt-4" />}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleReturn} disabled={isReturnDisabled}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
            Confirmar Devolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
