'use client';

import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const ClassificacaoContabilPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTool, setSelectedTool] = useState<WithDocId<Tool> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ natureza_item: '', classificacao_contabil: '' });

  const accountingToolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Buscamos todas as ferramentas que não estão pendentes.
    // A lógica de ESP/EQV vs STD/GSE é que ESP/EQV só chegam aqui depois de não estarem mais 'Pendente'.
    return query(
      collection(firestore, 'tools'),
      where('status', '!=', 'Pendente')
    );
  }, [firestore]);

  const queryKey = ['accountingTools'];

  const { data: tools, isLoading, error } = useCollection<WithDocId<Tool>>(accountingToolsQuery, {
    queryKey,
  });

  const handleEditClick = (tool: WithDocId<Tool>) => {
    setSelectedTool(tool);
    setFormData({
      natureza_item: tool.natureza_item || '',
      classificacao_contabil: tool.classificacao_contabil || '',
    });
    setIsDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveChanges = async () => {
    if (!firestore || !selectedTool) return;

    setIsSaving(true);
    const toolRef = doc(firestore, 'tools', selectedTool.docId);

    try {
      await updateDoc(toolRef, {
        natureza_item: formData.natureza_item,
        classificacao_contabil: formData.classificacao_contabil,
      });

      toast({
        title: 'Sucesso!',
        description: `Dados contábeis da ferramenta ${selectedTool.codigo} atualizados.`,
      });

      queryClient.invalidateQueries({ queryKey });
      setIsDialogOpen(false);
      setSelectedTool(null);
    } catch (err: any) {
      console.error("Erro ao atualizar dados contábeis:", err);
      toast({
        variant: 'destructive',
        title: 'Erro na Operação',
        description: `Não foi possível salvar os dados. Verifique suas permissões.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Classificação Contábil de Ferramentas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ferramentas para Classificação</CardTitle>
          <CardDescription>
            Atribua a natureza do item e a classificação contábil para cada ferramenta do inventário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro de Permissão</AlertTitle>
              <AlertDescription>
                Você não tem permissão para visualizar estes dados. Contate o administrador do sistema.
              </AlertDescription>
            </Alert>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Natureza do Item</TableHead>
                <TableHead>Class. Contábil</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && tools?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Nenhuma ferramenta aguardando classificação contábil.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && tools?.map((tool) => (
                <TableRow key={tool.docId}>
                  <TableCell className="font-mono">{tool.codigo}</TableCell>
                  <TableCell>{tool.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={tool.tipo === 'STD' || tool.tipo === 'GSE' ? 'secondary' : 'default'}>
                      {tool.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{tool.natureza_item || <span className="text-muted-foreground">Não definido</span>}</TableCell>
                  <TableCell>{tool.classificacao_contabil || <span className="text-muted-foreground">Não definido</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(tool)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Classificar Ferramenta</DialogTitle>
            <DialogDescription>
              Editando dados contábeis para <span className="font-bold">{selectedTool?.codigo}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="natureza_item">Natureza do Item</Label>
              <Input
                id="natureza_item"
                value={formData.natureza_item}
                onChange={handleInputChange}
                placeholder="Ex: Ativo Imobilizado, Consumo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classificacao_contabil">Classificação Contábil</Label>
              <Input
                id="classificacao_contabil"
                value={formData.classificacao_contabil}
                onChange={handleInputChange}
                placeholder="Ex: 1.02.04.01.001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassificacaoContabilPage;
