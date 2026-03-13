'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { CorporateCommunication } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Loader2, Megaphone, Calendar, Shield, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const categoryConfig: Record<string, { icon: React.ElementType, color: string }> = {
  Avisos: { icon: Megaphone, color: 'bg-blue-500' },
  Eventos: { icon: Calendar, color: 'bg-purple-500' },
  Seguranca: { icon: Shield, color: 'bg-red-500' },
  RH: { icon: Users, color: 'bg-green-500' },
};


export default function CorporateMural() {
  const firestore = useFirestore();
  const communicationsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'communications'), orderBy('createdAt', 'desc'), limit(20)) : null
  , [firestore]);

  const { data: communications, isLoading, error } = useCollection<WithDocId<CorporateCommunication>>(communicationsQuery);

  const groupedCommunications = useMemo(() => {
    if (!communications) return {};
    return communications.reduce((acc, item) => {
      const category = item.category || 'Avisos';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, WithDocId<CorporateCommunication>[]>);
  }, [communications]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return <p className="text-destructive text-center">Erro ao carregar o mural de comunicações.</p>;
  }
  
  if (!communications || communications.length === 0) {
      return (
          <div className="text-center py-10">
              <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma comunicação recente</h3>
              <p className="mt-1 text-sm text-muted-foreground">O mural de avisos está vazio no momento.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(groupedCommunications).map(([category, items]) => {
          const config = categoryConfig[category] || { icon: Megaphone, color: 'bg-gray-500' };
          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={cn("p-2 rounded-full text-white", config.color)}>
                     <config.icon className="h-5 w-5" />
                  </span>
                  {category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map(item => (
                  <div key={item.docId} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <p className="font-semibold">{item.title}</p>
                    {item.category === 'Eventos' && item.eventDate && (
                       <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-1">
                          Data do Evento: {format(parseISO(item.eventDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                       </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.content}</p>
                     <p className="text-xs text-muted-foreground/80 mt-2">
                      Publicado em {format(parseISO(item.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
