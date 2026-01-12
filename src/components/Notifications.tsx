'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, CheckCheck } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { Notification } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export default function Notifications() {
  const { user } = useUser();
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const notificationsQueryKey = ['notifications', user?.uid];

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, `employees/${user.uid}/notifications`),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: notifications, isLoading } = useCollection<WithDocId<Notification>>(notificationsQuery, {
    queryKey: notificationsQueryKey,
    enabled: !!user
  });

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const handleNotificationClick = async (notification: WithDocId<Notification>) => {
    if (!firestore || !user || notification.read) return;

    const notifRef = doc(firestore, `employees/${user.uid}/notifications`, notification.docId);
    try {
      await updateDoc(notifRef, { read: true });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };
  
  const markAllAsRead = async () => {
    if (!firestore || !user || !notifications) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    if(unreadNotifications.length === 0) return;

    const batch = writeBatch(firestore);
    unreadNotifications.forEach(n => {
        const notifRef = doc(firestore, `employees/${user.uid}/notifications`, n.docId);
        batch.update(notifRef, { read: true });
    });

    try {
        await batch.commit();
        queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    } catch (error) {
        console.error("Error marking all as read:", error);
    }
  }


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs text-white">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Abrir notificações</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex items-center justify-between pb-2">
            <h4 className="font-medium text-sm">Notificações</h4>
            {unreadCount > 0 && (
                 <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={markAllAsRead}>
                    <CheckCheck className="mr-1 h-3.5 w-3.5"/>
                    Marcar todas como lidas
                </Button>
            )}
        </div>
        <Separator />
        <ScrollArea className="h-80">
          {isLoading && <p className="p-4 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && (!notifications || notifications.length === 0) && (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação nova.</p>
          )}
          <div className="space-y-1 p-1">
            {notifications?.map(n => (
              <Link
                key={n.docId}
                href={n.link}
                className={cn(
                  'block rounded-md p-2 hover:bg-accent',
                  !n.read && 'bg-blue-50 dark:bg-blue-900/20'
                )}
                onClick={() => handleNotificationClick(n)}
              >
                <p className="font-semibold text-sm">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                </p>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

    