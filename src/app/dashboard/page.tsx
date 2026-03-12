'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { CorporateCommunication, Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { format, parseISO, getMonth, getDate } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Newspaper, CalendarDays, Shield, Megaphone, Gift, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Helper component for a single communication item
const CommunicationItem = ({ title, content, date }: { title: string; content: string; date?: string }) => (
  <div className="space-y-1">
    <p className="font-semibold">{title}</p>
    <p className="text-sm text-muted-foreground">{content}</p>
    {date && <p className="text-xs text-blue-600 font-medium mt-1">Data do Evento: {date}</p>}
  </div>
);

// Helper component for loading state
const LoadingCardContent = () => (
  <CardContent className="flex-1">
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  </CardContent>
);

export default function HomePage() {
  const firestore = useFirestore();
  const communicationsQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'communications'), orderBy('createdAt', 'desc')) : null,
    [firestore]
  );
  const { data: communications, isLoading: isLoadingCommunications } = useCollection<WithDocId<CorporateCommunication>>(communicationsQuery);

  const employeesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'employees'), where('status', '==', 'Ativo')) : null,
    [firestore]
  );
  const { data: employees, isLoading: isLoadingEmployees } = useCollection<WithDocId<Employee>>(employeesQuery);

  const monthlyBirthdays = useMemo(() => {
    if (!employees) return [];
    
    const currentMonth = getMonth(new Date());
    
    return employees
      .filter(employee => {
        if (!employee.birthDate) return false;
        // The date is stored as 'yyyy-MM-dd' or ISO string, which Date constructor handles
        const birthMonth = getMonth(new Date(employee.birthDate));
        return birthMonth === currentMonth;
      })
      .map(employee => ({
        name: `${employee.firstName} ${employee.lastName}`,
        day: getDate(new Date(employee.birthDate)),
      }))
      .sort((a, b) => a.day - b.day);

  }, [employees]);


  const groupedCommunications = useMemo(() => {
    const groups: { [key in 'Avisos' | 'Eventos' | 'Seguranca' | 'RH']: WithDocId<CorporateCommunication>[] } = {
      Avisos: [],
      Eventos: [],
      Seguranca: [],
      RH: [],
    };
    communications?.forEach(item => {
      const category = item.category as keyof typeof groups;
      if (groups[category]) {
        groups[category].push(item);
      }
    });
    return groups;
  }, [communications]);
  
  const isLoading = isLoadingCommunications || isLoadingEmployees;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="text-center my-8">
        <h1 className="text-4xl font-bold tracking-tight">Bem-vindo ao Portal Interno</h1>
        <p className="text-muted-foreground mt-2 text-lg">Suas informações centralizadas em um só lugar.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Últimos Avisos</CardTitle>
            <Newspaper className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          {isLoading ? <LoadingCardContent /> : (
            <CardContent className="flex-1">
              <div className="space-y-4">
                {groupedCommunications.Avisos.length > 0 ? (
                  groupedCommunications.Avisos.map(item => (
                    <CommunicationItem key={item.docId} title={item.title} content={item.content} />
                  ))
                ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum aviso no momento.</p>}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Próximos Eventos</CardTitle>
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          {isLoading ? <LoadingCardContent /> : (
            <CardContent className="flex-1">
               <div className="space-y-4">
                 {groupedCommunications.Eventos.length > 0 ? (
                    groupedCommunications.Eventos.map(item => (
                      <CommunicationItem
                        key={item.docId}
                        title={item.title}
                        content={item.content}
                        date={item.eventDate ? format(parseISO(item.eventDate), 'dd/MM/yyyy') : undefined}
                      />
                    ))
                 ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento agendado.</p>}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Aniversariantes do Mês</CardTitle>
            <Gift className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
           {isLoadingEmployees ? <LoadingCardContent /> : (
            <CardContent className="flex-1">
              {monthlyBirthdays.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {monthlyBirthdays.map(b => (
                    <li key={b.name}>{b.name} - Dia {String(b.day).padStart(2, '0')}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversariante este mês.</p>
              )}
            </CardContent>
          )}
        </Card>
        
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Publicações de Segurança (SGSO)</CardTitle>
            <Shield className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
           {isLoading ? <LoadingCardContent /> : (
            <CardContent className="flex-1">
              <div className="space-y-4">
                 {groupedCommunications.Seguranca.length > 0 ? (
                    groupedCommunications.Seguranca.map(item => (
                      <CommunicationItem key={item.docId} title={item.title} content={item.content} />
                    ))
                 ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma publicação de segurança.</p>}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Comunicados do RH</CardTitle>
            <Megaphone className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          {isLoading ? <LoadingCardContent /> : (
            <CardContent className="flex-1">
                <div className="space-y-4">
                 {groupedCommunications.RH.length > 0 ? (
                    groupedCommunications.RH.map(item => (
                      <CommunicationItem key={item.docId} title={item.title} content={item.content} />
                    ))
                 ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum comunicado do RH.</p>}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
