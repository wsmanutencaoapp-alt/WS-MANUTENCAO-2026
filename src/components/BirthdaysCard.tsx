'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Cake } from 'lucide-react';
import { getMonth, parseISO, format } from 'date-fns';

function getInitials(firstName?: string, lastName?: string) {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
}

export default function BirthdaysCard() {
    const firestore = useFirestore();

    const employeesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'employees'), orderBy('firstName')) : null
    ), [firestore]);

    const { data: employees, isLoading, error } = useCollection<WithDocId<Employee>>(employeesQuery, {
        queryKey: ['all_employees_for_birthdays']
    });

    const birthdayEmployees = useMemo(() => {
        if (!employees) return [];

        const currentMonth = new Date().getMonth();
        return employees.filter(employee => {
            if (!employee.birthDate) return false;
            try {
                const birthDate = parseISO(employee.birthDate);
                return getMonth(birthDate) === currentMonth;
            } catch (e) {
                return false;
            }
        }).sort((a, b) => {
             const dayA = new Date(a.birthDate!).getDate();
             const dayB = new Date(b.birthDate!).getDate();
             return dayA - dayB;
        });

    }, [employees]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Cake className="h-6 w-6 text-pink-500" />
                    Aniversariantes do Mês
                </CardTitle>
                <CardDescription>Parabéns aos nossos colegas!</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}
                {error && <p className="text-sm text-destructive text-center">Erro ao carregar aniversariantes.</p>}
                {!isLoading && birthdayEmployees.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-48 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum aniversariante este mês.</p>
                    </div>
                )}
                {!isLoading && birthdayEmployees.length > 0 && (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {birthdayEmployees.map(employee => (
                            <div key={employee.docId} className="flex items-center gap-4 p-2 rounded-md hover:bg-muted/50">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={employee.photoURL || undefined} />
                                    <AvatarFallback>{getInitials(employee.firstName, employee.lastName)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{employee.firstName} {employee.lastName}</p>
                                    <p className="text-xs text-muted-foreground">{employee.cargo}</p>
                                </div>
                                <div className="flex flex-col items-center justify-center bg-muted p-2 rounded-md">
                                    <span className="font-bold text-lg leading-none">{format(new Date(employee.birthDate!), 'dd')}</span>
                                    <span className="text-xs text-muted-foreground -mt-1">{format(new Date(employee.birthDate!), 'MMM')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
