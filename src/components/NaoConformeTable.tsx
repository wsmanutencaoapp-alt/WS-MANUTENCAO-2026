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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Tool as ToolIcon, Edit, CheckSquare } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Input } from './ui/input';
import ManageNonConformingDialog from './ManageNonConformingDialog';
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
    const [selectedTool, setSelectedTool] = useState<NonConformingTool | null>(null);
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

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] });
        setSelectedTool(null);
    }
    
    const handleFinishMaintenance = async (tool: NonConformingTool) => {
        if (!firestore) return;
        setProcessingId(tool.docId);
        const toolRef = doc(firestore, 'tools', tool.docId);
        try {
            await updateDoc(toolRef, {
                status: 'Disponível',
                observacao: '' // Limpa a observação de não conformidade
            });
            toast({
                title: 'Manutenção Finalizada',
                description: `A ferramenta ${tool.codigo} está disponível novamente.`,
            });
            handleSuccess();
        } catch(err) {
            console.error("Erro ao finalizar manutenção: ", err);
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
                                        {tool.status === 'Em Manutenção' && (
                                            <Button 
                                                variant="success" 
                                                size="sm"
                                                onClick={() => handleFinishMaintenance(tool)}
                                                disabled={processingId === tool.docId}
                                            >
                                                {processingId === tool.docId 
                                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                    : <CheckSquare className="mr-2 h-4 w-4"/>
                                                }
                                                Finalizar Manutenção
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => setSelectedTool(tool)}>
                                            <Edit className="mr-2 h-4 w-4"/>
                                            Gerenciar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <ManageNonConformingDialog
                isOpen={!!selectedTool}
                onClose={() => setSelectedTool(null)}
                tool={selectedTool}
                onSuccess={handleSuccess}
            />
        </>
    );
};

export default NaoConformeTable;
