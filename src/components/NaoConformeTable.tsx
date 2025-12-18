'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
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
import { Loader2, Search, Tool as ToolIcon, Edit } from 'lucide-react';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Input } from './ui/input';

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
    const [searchTerm, setSearchTerm] = useState('');

    const nonConformingStatuses: Tool['status'][] = [
        'Em Manutenção',
        'Em Conserto',
        'Inoperante',
        'Bloqueado',
        'Vencido',
        'Refugo',
        'Com Avaria',
    ];

    const toolsQuery = useMemoFirebase(
        () => (firestore ? query(
            collection(firestore, 'tools'),
            where('status', 'in', nonConformingStatuses)
        ) : null),
        [firestore]
    );

    const { data: tools, isLoading, error } = useCollection<NonConformingTool>(toolsQuery, {
        queryKey: ['nonConformingTools']
    });

    const filteredTools = useMemo(() => {
        if (!tools) return [];
        
        // Client-side sorting
        const sortedTools = [...tools].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

        if (!searchTerm) return sortedTools;

        const lowercasedTerm = searchTerm.toLowerCase();
        return sortedTools.filter(tool =>
            (tool.codigo && tool.codigo.toLowerCase().includes(lowercasedTerm)) ||
            (tool.descricao && tool.descricao.toLowerCase().includes(lowercasedTerm)) ||
            (tool.observacao && tool.observacao.toLowerCase().includes(lowercasedTerm))
        );
    }, [tools, searchTerm]);


    return (
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
                                 <TableCell className="text-right">
                                    <Button variant="outline" size="sm">
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
    );
};

export default NaoConformeTable;
