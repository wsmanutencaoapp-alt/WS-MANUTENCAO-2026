
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, updateDoc, doc } from 'firebase/firestore';
import type { Activity, Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, ChevronsUpDown, Check, X } from 'lucide-react';
import {
  DndContext,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import KanbanColumn from '@/components/KanbanColumn';
import ActivityCard from '@/components/ActivityCard';
import CreateActivityDialog from '@/components/CreateActivityDialog';
import ActivityDetailsDialog from '@/components/ActivityDetailsDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Archive } from 'lucide-react';

export type ActivityStatus = 'Pendente' | 'Em Andamento' | 'Aguardando Validação' | 'Concluída' | 'Recusada' | 'Arquivada';
export type Column = { id: ActivityStatus; title: string; activities: WithDocId<Activity>[] };

const columnsOrder: ActivityStatus[] = ['Pendente', 'Em Andamento', 'Aguardando Validação', 'Concluída'];

const GestaoAtividadesPage = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<WithDocId<Activity> | null>(null);

    const [columns, setColumns] = useState<Map<ActivityStatus, Column>>(
        new Map(columnsOrder.map(c => [c, { id: c, title: c.replace(/_/g, ' '), activities: [] }]))
    );
    const [activeActivity, setActiveActivity] = useState<WithDocId<Activity> | null>(null);

    // Filters
    const [selectedRequester, setSelectedRequester] = useState<string | null>(null);
    const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
    const [selectedSector, setSelectedSector] = useState<string | null>(null);
    const [isRequesterOpen, setIsRequesterOpen] = useState(false);
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);


    const activitiesQuery = useMemoFirebase(() => (
        firestore ? collection(firestore, 'activities') : null
    ), [firestore]);
    
    const { data: rawActivities, isLoading, error } = useCollection<WithDocId<Activity>>(activitiesQuery, { 
        queryKey: ['activities_board'] 
    });

    const userDocRef = useMemoFirebase(() => (
        firestore && user ? doc(firestore, 'employees', user.uid) : null
    ), [firestore, user]);
    const { data: currentUserData } = useDoc<Employee>(userDocRef);
    const isAdmin = useMemo(() => currentUserData?.accessLevel === 'Admin' || user?.uid === 'SOID8C723XUmlniI3mpjBmBPA5v1', [currentUserData, user]);

    // Client-side filtering to handle private activities without query errors
    const activities = useMemo(() => {
        if (!rawActivities || !user) return [];
        return rawActivities.filter(activity => {
            const isPublic = activity.isPrivate === false || activity.isPrivate === undefined;
            const isInvolved = activity.requesterId === user.uid || 
                               activity.assigneeId === user.uid || 
                               (activity.viewerIds && activity.viewerIds.includes(user.uid));
            
            return isAdmin || isPublic || isInvolved;
        });
    }, [rawActivities, user, isAdmin]);

    const { uniqueRequesters, uniqueAssignees, uniqueSectors } = useMemo(() => {
        if (!activities) return { uniqueRequesters: [], uniqueAssignees: [], uniqueSectors: [] };

        const requesters = new Map<string, string>();
        const assignees = new Map<string, string>();
        const sectors = new Set<string>();

        activities.forEach(activity => {
            if (activity.requesterId && !requesters.has(activity.requesterId)) {
                requesters.set(activity.requesterId, activity.requesterName);
            }
            if (activity.assigneeId && !assignees.has(activity.assigneeId)) {
                assignees.set(activity.assigneeId, activity.assigneeName);
            }
            if (activity.sector) {
                sectors.add(activity.sector);
            }
        });

        return {
            uniqueRequesters: Array.from(requesters.entries()).map(([id, name]) => ({ id, name })),
            uniqueAssignees: Array.from(assignees.entries()).map(([id, name]) => ({ id, name })),
            uniqueSectors: Array.from(sectors)
        };
    }, [activities]);

    const filteredActivities = useMemo(() => {
        if (!activities) return [];
        return activities.filter(activity => {
            const requesterMatch = !selectedRequester || activity.requesterId === selectedRequester;
            const assigneeMatch = !selectedAssignee || activity.assigneeId === selectedAssignee;
            const sectorMatch = !selectedSector || activity.sector === selectedSector;
            const notArchived = activity.status !== 'Arquivada';
            return requesterMatch && assigneeMatch && sectorMatch && notArchived;
        });
    }, [activities, selectedRequester, selectedAssignee, selectedSector]);


    useEffect(() => {
        if (filteredActivities) {
            const newColumns = new Map<ActivityStatus, Column>(
                columnsOrder.map(c => [c, { id: c, title: c.replace(/_/g, ' '), activities: [] }])
            );
            filteredActivities.forEach(activity => {
                const status = activity.status as ActivityStatus;
                if (newColumns.has(status)) {
                    newColumns.get(status)!.activities.push(activity);
                }
            });
            newColumns.forEach(col => col.activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setColumns(newColumns);
        }
    }, [filteredActivities]);

    const clearFilters = () => {
        setSelectedRequester(null);
        setSelectedAssignee(null);
        setSelectedSector(null);
    }

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

    const handleDragStart = (event: any) => {
      const { active } = event;
      const activity = activities?.find(a => a.docId === active.id);
      if (activity) {
        setActiveActivity(activity);
      }
    };
    
    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
    
        const activeColumnId = active.data.current?.sortable.containerId as ActivityStatus;
        const overColumnId = over.data.current?.sortable.containerId as ActivityStatus || over.id as ActivityStatus;
    
        if (activeColumnId !== overColumnId) {
            setColumns(prev => {
                const newColumns = new Map(prev);
                const activeActivities = newColumns.get(activeColumnId)?.activities;
                const overActivities = newColumns.get(overColumnId)?.activities;
                
                if (!activeActivities || !overActivities) {
                    return prev;
                }
                
                const activeIndex = activeActivities.findIndex(a => a?.docId === active.id);
                if (activeIndex === -1) {
                    return prev; 
                }

                const [movedActivity] = activeActivities.splice(activeIndex, 1);
                
                const overIndex = overActivities.findIndex(a => a?.docId === over.id);

                if (overIndex !== -1) {
                    overActivities.splice(overIndex, 0, movedActivity);
                } else {
                    overActivities.push(movedActivity);
                }

                return newColumns;
            });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveActivity(null);
        const { active, over } = event;
        if (!over) return;
        
        const activeColumnId = active.data.current?.sortable.containerId as ActivityStatus;
        const overColumnId = over.data.current?.sortable.containerId as ActivityStatus || over.id as ActivityStatus;
        const activityId = active.id as string;
    
        if (activeColumnId !== overColumnId && columnsOrder.includes(overColumnId)) {
            if (!firestore) return;
            const activityRef = doc(firestore, 'activities', activityId);
            try {
                await updateDoc(activityRef, { status: overColumnId });
            } catch (err) {
                console.error("Failed to update activity status:", err);
            }
        } else if (activeColumnId === overColumnId) {
            const items = columns.get(activeColumnId)?.activities;
            if (!items) return;
            const oldIndex = items.findIndex(item => item?.docId === active.id);
            const newIndex = items.findIndex(item => item?.docId === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const newItems = arrayMove(items, oldIndex, newIndex);
                setColumns(prev => new Map(prev).set(activeColumnId, { ...prev.get(activeColumnId)!, activities: newItems }));
            }
        }
    };
    
    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Gestão de Atividades</h1>
                    <div className="flex items-center gap-2">
                         <Link href="/dashboard/gestao-atividades/arquivadas">
                            <Button variant="outline"><Archive className="mr-2 h-4 w-4"/> Ver Arquivadas</Button>
                        </Link>
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nova Atividade
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Popover open={isRequesterOpen} onOpenChange={setIsRequesterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-[200px] justify-between font-normal">
                                {selectedRequester ? uniqueRequesters.find(u => u.id === selectedRequester)?.name : "Filtrar por solicitante..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar solicitante..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum solicitante.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueRequesters.map(req => (
                                            <CommandItem key={req.id} value={req.name} onSelect={() => { setSelectedRequester(req.id); setIsRequesterOpen(false); }}>
                                                 <Check className={cn("mr-2 h-4 w-4", selectedRequester === req.id ? "opacity-100" : "opacity-0")} />
                                                {req.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-[200px] justify-between font-normal">
                                {selectedAssignee ? uniqueAssignees.find(u => u.id === selectedAssignee)?.name : "Filtrar por responsável..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                             <Command>
                                <CommandInput placeholder="Buscar responsável..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum responsável.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueAssignees.map(res => (
                                            <CommandItem key={res.id} value={res.name} onSelect={() => { setSelectedAssignee(res.id); setIsAssigneeOpen(false); }}>
                                                 <Check className={cn("mr-2 h-4 w-4", selectedAssignee === res.id ? "opacity-100" : "opacity-0")} />
                                                {res.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    
                    <Select value={selectedSector || ''} onValueChange={(value) => setSelectedSector(value === 'todos' ? null : value)}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filtrar por setor..." />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="todos">Todos os Setores</SelectItem>
                            {uniqueSectors.map(sector => (
                                <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {(selectedRequester || selectedAssignee || selectedSector) && (
                        <Button variant="ghost" onClick={clearFilters}>
                            <X className="mr-2 h-4 w-4"/>
                            Limpar Filtros
                        </Button>
                    )}
                </div>
                
                {isLoading && <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                
                {!isLoading && (
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
                        <div className="flex gap-4 overflow-x-auto pb-4">
                            {Array.from(columns.values()).map(column => (
                                <KanbanColumn key={column.id} column={column} onCardClick={setSelectedActivity} />
                            ))}
                        </div>
                        <DragOverlay>
                            {activeActivity ? <ActivityCard activity={activeActivity} isOverlay /> : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>
            
            <CreateActivityDialog 
                isOpen={isCreateDialogOpen} 
                onClose={() => setIsCreateDialogOpen(false)}
            />
            <ActivityDetailsDialog
                isOpen={!!selectedActivity}
                onClose={() => setSelectedActivity(null)}
                activity={selectedActivity}
                currentUser={user}
            />
        </>
    );
}

export default GestaoAtividadesPage;
