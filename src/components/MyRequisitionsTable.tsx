'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import type { PurchaseRequisition, CostCenter, Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Eye, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';

const getStatusVariant = (status: PurchaseRequisition['status']) => {
  const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
    'Aberta': 'secondary',
    'Em Aprovação': 'default',
    'Em Revisão': 'warning',
    'Aprovada': 'success',
    'Recusada': 'destructive',
    'Concluída': 'secondary',
  };
  return variants[status] || 'secondary';
};

const getPriorityVariant = (priority: PurchaseRequisition['priority']) => {
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
}

export default function MyRequisitionsTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);

  const canViewAll = useMemo(() => {
    if (!employeeData) return false;
    return employeeData.accessLevel === 'Admin' || (employeeData.permissions?.compras ?? false);
  }, [employeeData]);


  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || isEmployeeLoading) return null;
    
    if (canViewAll) {
        return query(collection(firestore, 'purchase_requisitions'), orderBy('createdAt', 'desc'));
    } else {
        return query(
            collection(firestore, 'purchase_requisitions'),
            where('requesterId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
    }
  }, [firestore, user, canViewAll, isEmployeeLoading]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey: ['myPurchaseRequisitions', canViewAll, user?.uid],
      enabled: !isEmployeeLoading && !!user,
  });

  const costCenterIds = useMemo(() => {
    if (!requisitions) return [];
    return [...new Set(requisitions.map(r => r.costCenterId))];
  }, [requisitions]);

  const costCentersQuery = useMemoFirebase(() => {
      if (!firestore || costCenterIds.length === 0) return null;
      return query(collection(firestore, 'cost_centers'), where(doc.name, 'in', costCenterIds));
  }, [firestore, costCenterIds]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['costCentersForMyReqs', costCenterIds.join(',')],
      enabled: costCenterIds.length > 0,
  });
  
  const costCenterMap = useMemo(() => {
      if (!costCenters) return new Map<string, string>();
      return new Map(costCenters.map(cc => [cc.docId, `${cc.code} - ${cc.description}`]));
  }, [costCenters]);


  const filteredRequisitions = useMemo(() => {
    if (!requisitions) return [];
    if (!searchTerm) return requisitions;
    const lowercasedTerm = searchTerm.toLowerCase();
    return requisitions.filter(req => 
        (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
        req.status.toLowerCase().includes(lowercasedTerm) ||
        (costCenterMap.get(req.costCenterId) || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [requisitions, searchTerm, costCenterMap]);

  const isLoading = isLoadingRequisitions || isLoadingCostCenters || isEmployeeLoading;

  return (
    <>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Histórico de Solicitações</CardTitle>
            <CardDescription>
              Acompanhe o status e os detalhes de suas requisições de compra.
            </CardDescription>
            <div className="relative pt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por protocolo, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data da Requisição</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {requisitionsError && (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">{requisitionsError.message}</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.length === 0 && (
                   <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma requisição encontrada.</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.map(req => (
                  <TableRow key={req.docId}>
                    <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                    <TableCell className="font-mono">{req.protocol || req.docId.substring(0, 8)}</TableCell>
                    <TableCell>{format(new Date(req.createdAt), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{costCenterMap.get(req.costCenterId) || req.costCenterId}</TableCell>
                    <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                       {req.status === 'Em Revisão' && (
                        <Button variant="secondary" size="sm">
                            <Edit className="mr-2 h-4 w-4" />
                            Revisar
                        </Button>
                       )}
                      <Button variant="outline" size="sm" onClick={() => setSelectedRequisition(req)}>
                         <Eye className="mr-2 h-4 w-4" />
                         Ver Itens
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      <PurchaseRequisitionDetailsDialog
        requisition={selectedRequisition}
        isOpen={!!selectedRequisition}
        onClose={() => setSelectedRequisition(null)}
      />
    </>
  );
};
