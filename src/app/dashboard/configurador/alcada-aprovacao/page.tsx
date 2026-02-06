'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, writeBatch, doc, getDocs } from 'firebase/firestore';
import type { CostCenter, Employee, ApprovalTier } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// Component for a single Cost Center
function CostCenterApprovalCard({
    costCenter,
    employees,
    approvalTiers,
    tierChanges,
    onTierChange
}: {
    costCenter: WithDocId<CostCenter>;
    employees: WithDocId<Employee>[];
    approvalTiers: Map<string, WithDocId<ApprovalTier>>;
    tierChanges: Map<string, { level: 1 | 2; approverId: string; }>;
    onTierChange: (costCenterId: string, level: 1 | 2, approverId: string) => void;
}) {
    const level1Key = `${costCenter.docId}-1`;
    const level2Key = `${costCenter.docId}-2`;

    // Check for pending changes first, then fallback to saved data
    const level1PendingChange = tierChanges.get(level1Key);
    const level2PendingChange = tierChanges.get(level2Key);
    
    const level1SavedTier = approvalTiers.get(level1Key);
    const level2SavedTier = approvalTiers.get(level2Key);

    const level1Value = level1PendingChange ? level1PendingChange.approverId : (level1SavedTier?.approverId || '--none--');
    const level2Value = level2PendingChange ? level2PendingChange.approverId : (level2SavedTier?.approverId || '--none--');

    const handleSelect = (level: 1 | 2, approverId: string) => {
        onTierChange(costCenter.docId, level, approverId);
    };

    return (
        <Card className="mt-6 animate-in fade-in-50">
            <CardHeader>
                <CardTitle>{costCenter.code} - {costCenter.description}</CardTitle>
                <CardDescription>Setor: {costCenter.sector}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Aprovador Nível 1</Label>
                    <Select
                        value={level1Value}
                        onValueChange={(value) => handleSelect(1, value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o aprovador..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="--none--">Nenhum</SelectItem>
                            {employees.map(emp => (
                                <SelectItem key={emp.docId} value={emp.docId}>{emp.firstName} {emp.lastName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Aprovador Nível 2</Label>
                    <Select
                        value={level2Value}
                        onValueChange={(value) => handleSelect(2, value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o aprovador..." />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="--none--">Nenhum</SelectItem>
                            {employees.map(emp => (
                                <SelectItem key={emp.docId} value={emp.docId}>{emp.firstName} {emp.lastName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
}


export default function AlcadaAprovacaoPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(null);
    const [tierChanges, setTierChanges] = useState<Map<string, { level: 1 | 2; approverId: string; }>>(new Map());
    const [isSaving, setIsSaving] = useState(false);

    // Fetch data
    const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(
        useMemoFirebase(() => firestore ? query(collection(firestore, 'cost_centers')) : null, [firestore])
    );
    const { data: employees, isLoading: isLoadingEmployees } = useCollection<WithDocId<Employee>>(
        useMemoFirebase(() => firestore ? query(collection(firestore, 'employees')) : null, [firestore])
    );
    const { data: approvalTiersData, isLoading: isLoadingTiers } = useCollection<WithDocId<ApprovalTier>>(
        useMemoFirebase(() => firestore ? query(collection(firestore, 'approval_tiers')) : null, [firestore]), { queryKey: ['approvalTiers']}
    );

    const approvalTiersMap = useMemo(() => {
        const map = new Map<string, WithDocId<ApprovalTier>>();
        if (!approvalTiersData) return map;
        approvalTiersData.forEach(tier => {
            map.set(`${tier.costCenterId}-${tier.level}`, tier);
        });
        return map;
    }, [approvalTiersData]);

    const handleTierChange = (costCenterId: string, level: 1 | 2, approverId: string) => {
        const key = `${costCenterId}-${level}`;
        setTierChanges(prev => new Map(prev).set(key, { level, approverId }));
    };
    
    const selectedCostCenter = useMemo(() => {
        if (!selectedCostCenterId || !costCenters) return null;
        return costCenters.find(cc => cc.docId === selectedCostCenterId);
    }, [selectedCostCenterId, costCenters]);

    
    const handleSaveChanges = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const batch = writeBatch(firestore);

        try {
            for (const [key, change] of tierChanges.entries()) {
                const [costCenterId, levelStr] = key.split('-');
                const level = parseInt(levelStr) as 1 | 2;
                
                const existingTier = approvalTiersMap.get(key);
                
                if (change.approverId === '--none--') {
                    if (existingTier) {
                        const tierRef = doc(firestore, 'approval_tiers', existingTier.docId);
                        batch.delete(tierRef);
                    }
                } else {
                    const selectedEmployee = employees?.find(e => e.docId === change.approverId);
                    if (!selectedEmployee) continue;

                    const newTierData = {
                        costCenterId,
                        level,
                        approverId: change.approverId,
                        approverName: `${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`,
                    };
                    
                    if (existingTier) {
                        const tierRef = doc(firestore, 'approval_tiers', existingTier.docId);
                        batch.update(tierRef, newTierData);
                    } else {
                        const tierRef = doc(collection(firestore, 'approval_tiers'));
                        batch.set(tierRef, newTierData);
                    }
                }
            }

            await batch.commit();
            toast({ title: 'Sucesso!', description: 'Alçadas de aprovação salvas.' });
            queryClient.invalidateQueries({ queryKey: ['approvalTiers'] });
            setTierChanges(new Map());
        } catch (error: any) {
            console.error("Erro ao salvar alçadas:", error);
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const isLoading = isLoadingCostCenters || isLoadingEmployees || isLoadingTiers;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Configurar Alçada de Aprovação</h1>
                     <p className="text-muted-foreground mt-2">
                        Defina os aprovadores Nível 1 e Nível 2 para cada centro de custo.
                    </p>
                </div>
                <Button onClick={handleSaveChanges} disabled={tierChanges.size === 0 || isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Salvar Alterações
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Selecionar Centro de Custo</CardTitle>
                    <CardDescription>
                        Escolha um centro de custo para visualizar ou editar os aprovadores.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedCostCenterId} disabled={isLoading}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder={isLoading ? "Carregando centros de custo..." : "Selecione um centro de custo"} />
                        </SelectTrigger>
                        <SelectContent>
                            {costCenters?.map(cc => (
                                <SelectItem key={cc.docId} value={cc.docId}>
                                    ({cc.code}) - {cc.description}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
            
            {isLoading && !selectedCostCenter && (
                 <div className="mt-6 space-y-4">
                    <div className="h-40 bg-muted rounded-lg animate-pulse w-full"></div>
                </div>
            )}
            
            {selectedCostCenter && (
                <CostCenterApprovalCard
                    key={selectedCostCenter.docId}
                    costCenter={selectedCostCenter}
                    employees={employees || []}
                    approvalTiers={approvalTiersMap}
                    tierChanges={tierChanges}
                    onTierChange={handleTierChange}
                />
            )}
        </div>
    );
}
