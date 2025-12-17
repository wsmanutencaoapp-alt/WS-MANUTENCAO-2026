'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Separator } from './ui/separator';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const availableScreens = [
    { id: 'suprimentos', label: 'Suprimentos (Módulo)', isParent: true },
    { id: 'suprimentos_movimentacao', label: 'Movimentação', isParent: false, parentId: 'suprimentos' },
    { id: 'ferramentaria', label: 'Ferramentaria (Módulo)', isParent: true },
    { id: 'ferramentaria_movimentacao', label: 'Entrada e Saída', isParent: false, parentId: 'ferramentaria' },
    { id: 'calibracao', label: 'Calibração', isParent: false, parentId: 'ferramentaria' },
    { id: 'compras', label: 'Compras (Módulo)', isParent: true },
    { id: 'compras_aprovacoes', label: 'Aprovações', isParent: false, parentId: 'compras' },
    { id: 'compras_controle', label: 'Controle', isParent: false, parentId: 'compras' },
    { id: 'engenharia', label: 'Engenharia (Módulo)', isParent: true },
    { id: 'engenharia_aprovacoes', label: 'Aprovações', isParent: false, parentId: 'engenharia' },
    { id: 'engenharia_projetos', label: 'Projetos', isParent: false, parentId: 'engenharia' },
    { id: 'comercial', label: 'Comercial (Módulo)', isParent: true },
    { id: 'financeiro', label: 'Financeiro (Módulo)', isParent: true },
    { id: 'financeiro_visao-geral', label: 'Visão Geral', isParent: false, parentId: 'financeiro' },
    { id: 'financeiro_orcamento', label: 'Orçamento', isParent: false, parentId: 'financeiro' },
    { id: 'financeiro_despesas', label: 'Despesas', isParent: false, parentId: 'financeiro' },
    { id: 'userManagement', label: 'Gerenciar Usuários', isParent: true },
    { id: 'configurador', label: 'Configurador (Módulo)', isParent: true },
    { id: 'configurador_alcada-aprovacao', label: 'Alçada de Aprovação', isParent: false, parentId: 'configurador' },
    { id: 'cadastros', label: 'Cadastros (Módulo)', isParent: true },
    { id: 'cadastros_ferramentas', label: 'Ferramentas', isParent: false, parentId: 'cadastros' },
    { id: 'contabilidade', label: 'Fiscal/Contábil (Módulo)', isParent: true },
    { id: 'contabilidade_balancete', label: 'Balancete', isParent: false, parentId: 'contabilidade' },
    { id: 'contabilidade_relatorios', label: 'Relatórios', isParent: false, parentId: 'contabilidade' },
    { id: 'qualidade', label: 'Qualidade (Módulo)', isParent: true },
    { id: 'gso', label: 'GSO (Módulo)', isParent: true },
    { id: 'planejamento', label: 'Planejamento (Módulo)', isParent: true },
    { id: 'manutencao', label: 'Manutenção (Módulo)', isParent: true },
];


interface UserPermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    employee: WithDocId<Employee> | null;
    onPermissionsChange: (employeeId: string, permissions: { [key: string]: boolean }) => void;
}

export default function UserPermissionsDialog({ isOpen, onClose, employee, onPermissionsChange }: UserPermissionsDialogProps) {
    const [currentPermissions, setCurrentPermissions] = useState<{[key: string]: boolean}>({});
    const [isSaving, setIsSaving] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (employee) {
            setCurrentPermissions(employee.permissions || {});
        } else {
            setCurrentPermissions({});
        }
    }, [employee]);

    const updatePermissionsInFirestore = async (newPermissions: { [key: string]: boolean }) => {
        if (!firestore || !employee) return;
        setIsSaving(true);
        const employeeRef = doc(firestore, 'employees', employee.docId);
        try {
            await updateDoc(employeeRef, { permissions: newPermissions });
            toast({
                title: 'Sucesso!',
                description: `Permissões de ${employee.firstName} atualizadas.`,
            });
            // This is the call that updates the parent component's state
            onPermissionsChange(employee.docId, newPermissions);
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            onClose();
        } catch (error) {
             errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: employeeRef.path,
                    operation: 'update',
                    requestResourceData: { permissions: newPermissions },
                })
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleParentPermissionChange = (moduleId: string, checked: boolean) => {
        const newPermissions = { ...currentPermissions, [moduleId]: checked };
        const subModules = availableScreens.filter(s => s.parentId === moduleId);
        subModules.forEach(sub => {
            newPermissions[sub.id] = checked;
        });
        setCurrentPermissions(newPermissions);
    };

    const handleChildPermissionChange = (childId: string, parentId: string, checked: boolean) => {
        const newPermissions = { ...currentPermissions, [childId]: checked };
        
        if (checked) {
            // Se um filho é marcado, garante que o pai também esteja marcado.
            newPermissions[parentId] = true;
        } else {
            // Se um filho é desmarcado, verifica se algum outro filho ainda está marcado.
            // Se nenhum outro filho estiver marcado, desmarca o pai.
            const subModules = availableScreens.filter(s => s.parentId === parentId);
            const anyOtherChildChecked = subModules.some(sub => newPermissions[sub.id] && sub.id !== childId);
            
            // Se nenhum outro filho estiver selecionado, e o que estamos desmarcando é o ultimo, desmarcamos o pai também
            const allChildrenWillBeUnchecked = subModules.every(sub => !newPermissions[sub.id]);
            if (allChildrenWillBeUnchecked) {
                newPermissions[parentId] = false;
            }
        }
    
        setCurrentPermissions(newPermissions);
    };
    
    const handleSave = () => {
        updatePermissionsInFirestore(currentPermissions);
    };

    if (!employee) return null;

    const isUserAdmin = employee.accessLevel === 'Admin' || employee.id === 1001;
    const moduleGroups = availableScreens.filter(s => s.isParent);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Gerenciar Permissões de Acesso</DialogTitle>
                    <DialogDescription>
                        Defina quais telas o usuário <span className="font-bold">{`${employee.firstName} ${employee.lastName}`}</span> pode acessar.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 max-h-[60vh] overflow-y-auto pr-4">
                    {isUserAdmin ? (
                        <p className="text-sm text-center text-muted-foreground p-4 bg-muted/50 rounded-md">
                            Administradores têm acesso irrestrito a todas as telas por padrão. As permissões não podem ser alteradas.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {moduleGroups.map((module, index) => {
                                const subModules = availableScreens.filter(s => s.parentId === module.id);
                                const isModuleChecked = currentPermissions?.[module.id] || false;

                                return (
                                <React.Fragment key={module.id}>
                                    {index > 0 && <Separator className="my-3" />}
                                    <div className="space-y-3">
                                        <div className={`flex items-center space-x-3 rounded-md p-2`}>
                                            <Checkbox
                                                id={`${employee.docId}-${module.id}`}
                                                checked={isModuleChecked}
                                                onCheckedChange={(checked) => handleParentPermissionChange(module.id, !!checked)}
                                                aria-label={`Permissão para ${module.label}`}
                                            />
                                            <Label
                                                htmlFor={`${employee.docId}-${module.id}`}
                                                className="text-sm font-semibold leading-none"
                                            >
                                                {module.label}
                                            </Label>
                                        </div>
                                        {subModules.length > 0 && (
                                        <div className="pl-8 space-y-3 animate-in fade-in-0 duration-300">
                                                {subModules.map(sub => (
                                                    <div key={sub.id} className="flex items-center space-x-3">
                                                        <Checkbox
                                                            id={`${employee.docId}-${sub.id}`}
                                                            checked={currentPermissions?.[sub.id] || false}
                                                            onCheckedChange={(checked) => handleChildPermissionChange(sub.id, module.id, !!checked)}
                                                            aria-label={`Permissão para ${sub.label}`}
                                                        />
                                                        <Label htmlFor={`${employee.docId}-${sub.id}`} className="text-sm leading-none">
                                                            {sub.label}
                                                        </Label>
                                                    </div>
                                                ))}
                                        </div>
                                        )}
                                    </div>
                                </React.Fragment>
                                )
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving || isUserAdmin}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
