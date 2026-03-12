'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, updateDoc, doc } from 'firebase/firestore';
import type { Activity, Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
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

export type ActivityStatus = 'Pendente' | 'Em Andamento' | 'Aguardando Validação' | 'Concluída' | 'Recusada';
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

    const activitiesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'activities')) : null
    ), [firestore]);
    const { data: activities, isLoading, error } = useCollection<WithDocId<Activity>>(activitiesQuery, { queryKey: ['activities'] });

    useEffect(() => {
        if (activities) {
            const newColumns = new Map<ActivityStatus, Column>(
                columnsOrder.map(c => [c, { id: c, title: c.replace(/_/g, ' '), activities: [] }])
            );
            activities.forEach(activity => {
                const status = activity.status as ActivityStatus;
                if (newColumns.has(status)) {
                    newColumns.get(status)!.activities.push(activity);
                } else if (status === 'Recusada') {
                    // Ignored in Kanban view for now
                }
            });
            // Sort activities within columns by creation date or another metric if needed
            newColumns.forEach(col => col.activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setColumns(newColumns);
        }
    }, [activities]);

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
                
                const activeIndex = activeActivities.findIndex(a => a && a.docId === active.id);
                if (activeIndex === -1) {
                    return prev; // Item not found, do nothing
                }

                const [movedActivity] = activeActivities.splice(activeIndex, 1);
                
                const overIndex = overActivities.findIndex(a => a && a.docId === over.id);

                if (overIndex !== -1) {
                    overActivities.splice(overIndex, 0, movedActivity);
                } else {
                    // Dropping on column, not a specific item
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
                // Revert state on failure if needed
            }
        } else if (activeColumnId === overColumnId) {
             // Reordering within the same column
            const items = columns.get(activeColumnId)?.activities;
            if (!items) return; // Guard clause
            const oldIndex = items.findIndex(item => item && item.docId === active.id);
            const newIndex = items.findIndex(item => item && item.docId === over.id);
            
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
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Atividade
                    </Button>
                </div>
                
                {isLoading && <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                
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
