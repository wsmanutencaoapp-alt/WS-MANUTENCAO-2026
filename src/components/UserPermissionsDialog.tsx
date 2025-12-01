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

const availableScreens = [
    { id: 'ferramentaria', label: 'Ferramentaria (Módulo)' },
    { id: 'suprimentos', label: 'Suprimentos (Módulo)' },
    { id: 'compras', label: 'Compras (Módulo)' },
    { id: 'financeiro', label: 'Financeiro (Módulo)' },
    { id: 'configurador', label: 'Configurador (Módulo)' },
    { id: 'userManagement', label: 'Gerenciar Usuários' },
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
        setCurrentPermissions(newPermissions); // Update local state for immediate UI feedback

        const employeeRef = doc(firestore, 'employees', employee.docId);

        try {
            await updateDoc(employeeRef, {
                permissions: newPermissions
            });
            onPermissionsChange(employee.docId, newPermissions); // Notify parent component
            toast({
                title: "Permissão atualizada!",
                description: `Acesso à tela de ${screenId} foi ${checked ? 'concedido' : 'revogado'}.`,
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gerenciar Permissões de Acesso</DialogTitle>
                    <DialogDescription>
                        Defina quais telas o usuário <span className="font-bold">{`${employee.firstName} ${employee.lastName}`}</span> pode acessar.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <h4 className="mb-4 text-sm font-medium">Módulos e Telas do Sistema</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {availableScreens.map(screen => (
                            <div key={screen.id} className="flex items-center space-x-3 rounded-md border p-3">
                                <Checkbox
                                    id={`${employee.docId}-${screen.id}`}
                                    checked={isUserAdmin || (currentPermissions?.[screen.id] || false)}
                                    onCheckedChange={(checked) => handlePermissionChange(screen.id, checked)}
                                    disabled={isUserAdmin}
                                    aria-label={`Permissão para ${screen.label}`}
                                />
                                <Label
                                    htmlFor={`${employee.docId}-${screen.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {screen.label}
                                </Label>
                            </div>
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
