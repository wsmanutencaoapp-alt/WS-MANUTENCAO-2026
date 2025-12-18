'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Image from 'next/image';
import { Check, X, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';

const AprovacoesEngenhariaPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const pendingToolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'tools'),
      where('tipo', 'in', ['ESP', 'EQV']),
      where('status', '==', 'Pendente')
    );
  }, [firestore]);

  const queryKey = ['pendingApprovalTools'];

  const { data: tools, isLoading, error } = useCollection<WithDocId<Tool>>(pendingToolsQuery, {
    queryKey
  });

  const handleDecision = async (toolId: string, isApproved: boolean) => {
    if (!firestore) return;
    
    setIsProcessing(toolId);
    
    const toolRef = doc(firestore, 'tools', toolId);

    try {
      if (isApproved) {
        // Change status to 'Available'
        await updateDoc(toolRef, { status: 'Disponível' });
        toast({
          title: 'Ferramenta Aprovada!',
          description: 'O status foi atualizado para "Disponível".',
        });
      } else {
        // Reject: Delete the tool record
        await deleteDoc(toolRef);
         toast({
          title: 'Ferramenta Reprovada',
          description: 'O registro da ferramenta foi removido.',
          variant: 'destructive',
        });
      }
      
      // Manually update the react-query cache to remove the item instantly
      queryClient.setQueryData(queryKey, (oldData: WithDocId<Tool>[] | undefined) => 
        oldData ? oldData.filter(t => t.docId !== toolId) : []
      );

    } catch (err: any) {
      console.error(`Erro ao ${isApproved ? 'aprovar' : 'reprovar'} ferramenta:`, err);
      toast({
        variant: 'destructive',
        title: 'Erro na Operação',
        description: `Não foi possível concluir a ação. Verifique suas permissões.`,
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Aprovações de Engenharia</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ferramentas Pendentes</CardTitle>
          <CardDescription>
            Aprove ou reprove as ferramentas do tipo <span className="font-semibold">ESP</span> e <span className="font-semibold">EQV</span> que aguardam validação.
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
                <TableHead className="hidden sm:table-cell">Foto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Doc.</TableHead>
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
              {!isLoading && !error && tools && tools.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                       Nenhuma ferramenta pendente de aprovação.
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && tools?.map((tool) => {
                  return (
                    <TableRow key={tool.docId}>
                        <TableCell className="hidden sm:table-cell">
                          <Image
                            alt={tool.descricao}
                            className="aspect-square rounded-md object-cover"
                            height="48"
                            src={tool.imageUrl || 'https://picsum.photos/seed/tool/48/48'}
                            width="48"
                          />
                        </TableCell>
                        <TableCell className="font-mono">{tool.codigo}</TableCell>
                        <TableCell>{tool.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={tool.tipo === 'EQV' ? 'default' : 'secondary'}>{tool.tipo}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {tool.doc_engenharia_url ? (
                              <Button asChild variant="outline" size="icon">
                                <a href={tool.doc_engenharia_url} target="_blank" rel="noopener noreferrer">
                                  <FileText className="h-4 w-4" />
                                </a>
                              </Button>
                          ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            {isProcessing === tool.docId ? (
                                <Loader2 className="h-5 w-5 animate-spin ml-auto" />
                            ) : (
                                <>
                                    <Button variant="ghost" size="icon" onClick={() => handleDecision(tool.docId, true)} title="Aprovar">
                                        <Check className="h-5 w-5 text-green-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDecision(tool.docId, false)} title="Reprovar">
                                        <X className="h-5 w-5 text-red-600" />
                                    </Button>
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                  )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AprovacoesEngenhariaPage;
