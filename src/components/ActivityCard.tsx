'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from './ui/card';
import type { Activity } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Avatar, AvatarFallback } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';

interface ActivityCardProps {
    activity: WithDocId<Activity>;
    isOverlay?: boolean;
    onClick?: () => void;
}

export default function ActivityCard({ activity, isOverlay, onClick }: ActivityCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: activity.docId,
        data: {
            type: 'Activity',
            activity,
        }
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    const firestore = useFirestore();

    const assigneeDocRef = useMemoFirebase(() => (
        firestore && activity?.assigneeId ? doc(firestore, 'employees', activity.assigneeId) : null
    ), [firestore, activity?.assigneeId]);

    const { data: assignee } = useDoc<Employee>(assigneeDocRef);

    const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

    const priorityStyles = {
        'Normal': 'border-l-blue-500',
        'Média': 'border-l-orange-500',
        'Urgente': 'border-l-destructive',
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={cn(
                "p-3 cursor-grab hover:shadow-md border-l-4",
                priorityStyles[activity.priority] || 'border-l-transparent',
                isDragging && "opacity-50 ring-2 ring-primary",
                isOverlay && "ring-2 ring-primary shadow-lg"
            )}
        >
            <p className="font-semibold text-base mb-2">{activity.title}</p>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{assignee?.firstName || ''}</span>
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(assignee?.firstName)}</AvatarFallback>
                    </Avatar>
                </div>
            </div>
        </Card>
    );
}
