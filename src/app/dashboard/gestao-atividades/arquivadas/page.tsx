'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Inbox, ArchiveRestore } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function ArquivadasPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const queryKey = ['archivedActivities'];
    const archivedActivitiesQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'activities'), where('status', '==', 'Arquivada'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const { data: archived, isLoading, error } = useCollection<WithDocId<Activity>>(archivedActivitiesQuery, { queryKey });

    const filteredActivities = useMemo(() => {
        if (!archived) return [];
        if (!searchTerm) return archived;
        const lowercasedTerm = searchTerm.toLowerCase();
        return archived.filter(activity =>
            activity.title.toLowerCase().includes(lowercasedTerm) ||
            activity.requesterName.toLowerCase().includes(lowercasedTerm) ||
            activity.assigneeName.toLowerCase().includes(lowercasedTerm)
        );
    }, [archived, searchTerm]);

    const handleUnarchive = async (activityId: string) => {
        if (!firestore) return;
        setIsProcessing(activityId);
        try {
            await updateDoc(doc(firestore, 'activities', activityId), { status: 'Concluída' });
            toast({ title: 'Sucesso', description: 'Atividade restaurada para "Concluída".' });
            queryClient.invalidateQueries({ queryKey: ['archivedActivities'] });
            queryClient.invalidateQueries({ queryKey: ['activities'] }); // Invalidate kanban as well
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível restaurar a atividade.' });
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Atividades Arquivadas</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Atividades Concluídas</CardTitle>
                    <CardDescription>Consulte as atividades que foram marcadas como concluídas e posteriormente arquivadas.</CardDescription>
                    <div className="relative pt-4">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar por título, responsável ou solicitante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead>Solicitante</TableHead>
                                <TableHead>Data Criação</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                            {error && <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">{error.message}</TableCell></TableRow>}
                            {!isLoading && filteredActivities.length === 0 && (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">
                                    <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                                    <p className="text-muted-foreground">Nenhuma atividade arquivada.</p>
                                </TableCell></TableRow>
                            )}
                            {!isLoading && filteredActivities.map(activity => (
                                <TableRow key={activity.docId}>
                                    <TableCell className="font-medium">{activity.title}</TableCell>
                                    <TableCell>{activity.assigneeName}</TableCell>
                                    <TableCell>{activity.requesterName}</TableCell>
                                    <TableCell>{format(new Date(activity.createdAt), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleUnarchive(activity.docId)} disabled={isProcessing === activity.docId}>
                                            {isProcessing === activity.docId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArchiveRestore className="mr-2 h-4 w-4"/>}
                                            Restaurar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
