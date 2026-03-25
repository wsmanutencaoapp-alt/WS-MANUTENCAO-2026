'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { CorporateCommunication, Activity } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Megaphone, ClipboardList, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function MuralWidget({ sector }: { sector?: string }) {
  const firestore = useFirestore();
  const communicationsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'communications'), orderBy('createdAt', 'desc'), limit(5)) : null
  , [firestore]);

  const { data: communications, isLoading } = useCollection<WithDocId<CorporateCommunication>>(communicationsQuery);

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl flex items-center gap-3 text-[#3091ff]">
          <Megaphone className="h-8 w-8" />
          Mural Corporativo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {communications?.map((item, index) => (
          <div key={item.docId} className={cn(
            "p-4 rounded-xl border-l-4 transition-all duration-300",
            index === 0 ? "bg-blue-50/50 border-blue-500 scale-105" : "bg-white border-gray-200"
          )}>
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold">{item.title}</h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {item.category}
              </span>
            </div>
            <p className="mt-2 text-lg text-gray-700 line-clamp-3">{item.content}</p>
            <p className="mt-3 text-sm text-gray-400">
              {format(parseISO(item.createdAt), "eeee, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        ))}
        {(!communications || communications.length === 0) && !isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground italic">
            Nenhum aviso no momento.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OSWidget({ sector }: { sector?: string }) {
  const firestore = useFirestore();
  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let baseQuery = query(collection(firestore, 'activities'), orderBy('createdAt', 'desc'), limit(10));
    if (sector && sector !== 'Geral') {
        baseQuery = query(collection(firestore, 'activities'), where('sector', '==', sector), orderBy('createdAt', 'desc'), limit(10));
    }
    return baseQuery;
  }, [firestore, sector]);

  const { data: activities, isLoading } = useCollection<WithDocId<Activity>>(activitiesQuery);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgente': return 'text-red-600 bg-red-100 border-red-200';
      case 'Média': return 'text-amber-600 bg-amber-100 border-amber-200';
      default: return 'text-green-600 bg-green-100 border-green-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em Andamento': return 'bg-blue-500';
      case 'Concluída': return 'bg-green-500';
      case 'Pendente': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  }

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl flex items-center gap-3 text-[#3091ff]">
          <ClipboardList className="h-8 w-8" />
          Atividades / OS {sector && sector !== 'Geral' ? `- ${sector}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                <th className="px-6 py-4">Atividade</th>
                <th className="px-6 py-4">Setor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Prioridade</th>
                <th className="px-6 py-4 text-right">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities?.map((activity) => (
                <tr key={activity.docId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-lg text-gray-900">{activity.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-md">{activity.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{activity.sector}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className={cn("h-3 w-3 rounded-full", getStatusColor(activity.status))} />
                       <span className="text-sm font-medium">{activity.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", getPriorityColor(activity.priority))}>
                      {activity.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      {activity.dueDate ? format(parseISO(activity.dueDate), 'dd/MM/yy') : '--/--/--'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!activities || activities.length === 0) && !isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground italic">
            Nenhuma atividade registrada.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
