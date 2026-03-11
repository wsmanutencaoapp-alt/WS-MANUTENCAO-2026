'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { Column, ActivityStatus } from '@/app/dashboard/gestao-atividades/page';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import type { Activity } from '@/lib/types';
import ActivityCard from './ActivityCard';
import { ScrollArea } from './ui/scroll-area';

interface KanbanColumnProps {
    column: Column;
    onCardClick: (activity: WithDocId<Activity>) => void;
}

export default function KanbanColumn({ column, onCardClick }: KanbanColumnProps) {
    const { setNodeRef } = useDroppable({ id: column.id });

    return (
        <div ref={setNodeRef} className="w-80 flex-shrink-0">
            <div className="bg-muted rounded-lg h-full flex flex-col">
                <div className="p-3 border-b">
                    <h3 className="font-semibold text-lg">{column.title} ({column.activities.length})</h3>
                </div>
                <ScrollArea className="flex-1">
                    <SortableContext id={column.id} items={column.activities.map(a => a.docId)} strategy={verticalListSortingStrategy}>
                        <div className="p-2 space-y-2">
                            {column.activities.map(activity => (
                                <ActivityCard key={activity.docId} activity={activity} onClick={() => onCardClick(activity)} />
                            ))}
                        </div>
                    </SortableContext>
                </ScrollArea>
            </div>
        </div>
    );
}
