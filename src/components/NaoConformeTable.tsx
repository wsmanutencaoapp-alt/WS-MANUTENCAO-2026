'use client';

import { useMemo, useState } from 'react';
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
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Tool as ToolIcon, Trash2, CheckSquare } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Input } from './ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

type NonConformingTool = WithDocId<Tool>;

const statusVariantMap: { [key: string]: 'default' | 'destructive' | 'secondary' } = {
    'Em Manutenção': 'default',
    'Com Avaria': 'default',
    'Em Conserto': 'default',
    'Inoperante': 'destructive',
    'Bloqueado': 'destructive',
    'Vencido': 'destructive',
    'Refugo': 'destructive',
};

const NaoConformeTable = () => {
    const firestore = useFirestore();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const nonConformingStatuses: Tool['status'][] = [
        'Em Manutenção',
        'Em Conserto',
        'Inoperante',
        'Bloqueado',
        'Vencido',
        'Refugo',
        'Com Avaria',
    ];

    const queryKey = ['nonConformingTools'];
    const toolsQuery = useMemoFirebase(
        () => (firestore ? query(
            collection(firestore, 'tools'),
            where('status', 'in', nonConformingStatuses)
        ) : null),
        [firestore]
    );

    const { data: tools, isLoading, error } = useCollection<NonConformingTool>(toolsQuery, {
        queryKey,
    });

    const filteredTools = useMemo(() => {
        if (!tools) return [];
        
        const sortedTools = [...tools].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

        if (!searchTerm) return sortedTools;

        const lowercasedTerm = searchTerm.toLowerCase();
        return sortedTools.filter(tool =>
            (tool.codigo && tool.codigo.toLowerCase().includes(lowercasedTerm)) ||
            (tool.descricao && tool.descricao.toLowerCase().includes(lowercasedTerm)) ||
            (tool.observacao && tool.observacao.toLowerCase().includes(lowercasedTerm))
        );
    }, [tools, searchTerm]);

    const handleSuccess = (message: string) => {
        toast({
            title: 'Sucesso!',
            description: message,
        });
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
    }
    
    const handleAction = async (tool: NonConformingTool, action: 'repair' | 'discard') => {
        if (!firestore) return;
        setProcessingId(tool.docId);
        const toolRef = doc(firestore, 'tools', tool.docId);

        try {
            let dataToUpdate: Partial<Tool> = {};
            let successMessage = '';
            
            if (action === 'repair') {
                dataToUpdate = {
                    status: 'Disponível',
                    observacao: '' // Limpa a observação de não conformidade
                };
                successMessage = `A ferramenta ${tool.codigo} foi reparada e está disponível.`;
            } else { // discard
                dataToUpdate = {
                    status: 'Refugo',
                    motivo_descarte: tool.observacao || 'Descartado por avaria/não conformidade.',
                    data_descarte: new Date().toISOString()
                };
                successMessage = `A ferramenta ${tool.codigo} foi movida para refugo.`;
            }
            
            await updateDoc(toolRef, dataToUpdate);
            handleSuccess(successMessage);

        } catch(err) {
            console.error("Erro ao processar ação: ", err);
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Não foi possível atualizar o status da ferramenta.'
            });
        } finally {
            setProcessingId(null);
        }
    }


    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Ferramentas Não Conformes</CardTitle>
                    <CardDescription>
                        Gerencie ferramentas que precisam de atenção, como manutenção, conserto ou descarte.
                    </CardDescription>
                    <div className="relative pt-4">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Pesquisar por código, descrição, observação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                    />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="hidden sm:table-cell">Foto</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Observação</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                        Erro ao carregar ferramentas: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredTools.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Nenhuma ferramenta não conforme encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredTools.map((tool) => (
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
                                        <Badge variant={statusVariantMap[tool.status] || 'secondary'}>
                                            {tool.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{tool.observacao || 'N/A'}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {tool.status !== 'Refugo' && (
                                            <>
                                            <Button 
                                                variant="success" 
                                                size="sm"
                                                onClick={() => handleAction(tool, 'repair')}
                                                disabled={processingId === tool.docId}
                                                title="Finalizar manutenção e retornar ao estoque"
                                            >
                                                {processingId === tool.docId 
                                                    ? <Loader2 className="h-4 w-4 animate-spin"/>
                                                    : <CheckSquare className="h-4 w-4"/>
                                                }
                                            </Button>

                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={processingId === tool.docId} title="Descartar ferramenta">
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Descarte</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja descartar a ferramenta <span className="font-bold">"{tool.codigo}"</span>? Esta ação mudará seu status para "Refugo" e não pode ser facilmente desfeita.
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={processingId === tool.docId}>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleAction(tool, 'discard')} disabled={processingId === tool.docId}>
                                                        {processingId === tool.docId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                        Sim, Descartar
                                                    </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </>
    );
};

export default NaoConformeTable;
