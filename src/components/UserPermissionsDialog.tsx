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

const availableScreens = [
    { id: 'suprimentos', label: 'Suprimentos (Módulo)', isParent: true },
    { id: 'suprimentos_movimentacao', label: 'Movimentação', isParent: false },
    { id: 'ferramentaria', label: 'Ferramentaria (Módulo)', isParent: true },
    { id: 'ferramentaria_cadastro', label: 'Cadastro', isParent: false },
    { id: 'ferramentaria_movimentacao', label: 'Entrada e Saída', isParent: false },
    { id: 'calibracao', label: 'Calibração', isParent: false, isSeparate: true },
    { id: 'compras', label: 'Compras (Módulo)', isParent: true },
    { id: 'compras_aprovacoes', label: 'Aprovações', isParent: false },
    { id: 'compras_controle', label: 'Controle', isParent: false },
    { id: 'financeiro', label: 'Financeiro (Módulo)', isParent: true },
    { id: 'financeiro_visao-geral', label: 'Visão Geral', isParent: false },
    { id: 'financeiro_orcamento', label: 'Orçamento', isParent: false },
    { id: 'userManagement', label: 'Gerenciar Usuários', isParent: true },
    { id: 'configurador', label: 'Configurador (Módulo)', isParent: true },
    { id: 'configurador_alcada-aprovacao', label: 'Alçada de Aprovação', isParent: false },
];


interface UserPermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    employee: WithDocId<Employee> | null;
    onPermissionsChange: (employeeId: string, permissions: any) => void;
}

export default function UserPermissionsDialog({ isOpen, onClose, employee, onPermissionsChange }: UserPermissionsDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [currentPermissions, setCurrentPermissions] = useState<{[key: string]: boolean}>({});

    useEffect(() => {
        if (employee) {
            setCurrentPermissions(employee.permissions || {});
        }
    }, [employee]);

    if (!employee) return null;

    const handlePermissionChange = async (screenId: string, checked: boolean | 'indeterminate') => {
        if (typeof checked !== 'boolean' || !firestore) return;

        const newPermissions = { ...currentPermissions, [screenId]: checked };
        
        // Logic to handle parent/child checkbox behavior
        const isParent = availableScreens.find(s => s.id === screenId)?.isParent;
        if (isParent) {
            // If parent is unchecked, uncheck all children
            if (!checked) {
                availableScreens.forEach(s => {
                    if (s.id.startsWith(screenId + '_')) {
                        newPermissions[s.id] = false;
                    }
                });
            }
        } else {
            // If a child is checked, ensure the parent is checked
            const parentId = screenId.split('_')[0];
            if (checked && parentId && availableScreens.some(s => s.id === parentId && s.isParent)) {
                newPermissions[parentId] = true;
            }
        }
        
        setCurrentPermissions(newPermissions); // Update local state for immediate UI feedback

        const employeeRef = doc(firestore, 'employees', employee.docId);

        try {
            await updateDoc(employeeRef, {
                permissions: newPermissions
            });
            onPermissionsChange(employee.docId, newPermissions); // Notify parent component
            toast({
                title: "Permissão atualizada!",
                description: `O acesso foi ${checked ? 'concedido' : 'revogado'}.`,
            });
        } catch (error) {
            errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: employeeRef.path,
                    operation: 'update',
                    requestResourceData: { permissions: newPermissions },
                })
            );
            // Revert optimistic UI update on error
            setCurrentPermissions(employee.permissions || {});
        }
    };
    
    const isUserAdmin = employee.accessLevel === 'Admin' || employee.id === 1001;

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
                    <div className="space-y-4">
                        {availableScreens.map((screen, index) => (
                           <React.Fragment key={screen.id}>
                             { (screen.isParent || screen.isSeparate) && index > 0 && <Separator className="my-3" />}
                             <div className={`flex items-center space-x-3 rounded-md p-2 ${!screen.isParent ? 'ml-6' : ''}`}>
                                <Checkbox
                                    id={`${employee.docId}-${screen.id}`}
                                    checked={isUserAdmin || (currentPermissions?.[screen.id] || false)}
                                    onCheckedChange={(checked) => handlePermissionChange(screen.id, checked)}
                                    disabled={isUserAdmin}
                                    aria-label={`Permissão para ${screen.label}`}
                                />
                                <Label
                                    htmlFor={`${employee.docId}-${screen.id}`}
                                    className={`text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${screen.isParent ? 'font-semibold' : ''}`}
                                >
                                    {screen.label}
                                </Label>
                            </div>
                           </React.Fragment>
                        ))}
                    </div>
                     {isUserAdmin && (
                        <p className="text-xs text-muted-foreground mt-4">
                            Administradores têm acesso a todas as telas por padrão.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
