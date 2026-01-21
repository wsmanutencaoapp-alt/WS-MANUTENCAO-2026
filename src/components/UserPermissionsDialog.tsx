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
import { permissionStructure, actionLabels } from '@/lib/permissions';

interface UserPermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    employee: WithDocId<Employee> | null;
    onPermissionsChange: () => void;
}

export default function UserPermissionsDialog({ isOpen, onClose, employee, onPermissionsChange }: UserPermissionsDialogProps) {
    const [currentPermissions, setCurrentPermissions] = useState<{[key: string]: boolean}>({});
    const [isSaving, setIsSaving] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

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
            onPermissionsChange();
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
    
    const handlePermissionChange = (permissionId: string, checked: boolean) => {
        setCurrentPermissions(prev => ({
            ...prev,
            [permissionId]: checked
        }));
    };
    
    const handleSave = () => {
        updatePermissionsInFirestore(currentPermissions);
    };

    if (!employee) return null;

    const isUserAdmin = employee.accessLevel === 'Admin';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Gerenciar Permissões de Acesso</DialogTitle>
                    <DialogDescription>
                        Defina quais módulos o usuário <span className="font-bold">{`${employee.firstName} ${employee.lastName}`}</span> pode acessar.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 max-h-[60vh] overflow-y-auto pr-4">
                    {isUserAdmin ? (
                        <p className="text-sm text-center text-muted-foreground p-4 bg-muted/50 rounded-md">
                            Administradores têm acesso irrestrito a todos os módulos por padrão.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {permissionStructure.map((module) => (
                                <div key={module.id} className="space-y-3 rounded-lg border p-4">
                                    <h4 className="font-semibold">{module.label}</h4>
                                    {module.actions && (
                                         <div className="flex items-center space-x-4 pl-2">
                                            {module.actions.map(action => (
                                                <div key={`${module.id}_${action}`} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`${module.id}_${action}`}
                                                        checked={currentPermissions[`${module.id}_${action}`] || false}
                                                        onCheckedChange={(checked) => handlePermissionChange(`${module.id}_${action}`, !!checked)}
                                                    />
                                                    <Label htmlFor={`${module.id}_${action}`} className="font-normal">{actionLabels[action as keyof typeof actionLabels]}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {module.submodules && module.submodules.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            {module.submodules.map(sub => (
                                                <div key={sub.id} className="pl-4">
                                                    <p className="font-medium text-sm">{sub.label}</p>
                                                    <div className="flex items-center space-x-4 pt-1 pl-2">
                                                        {sub.actions.map(action => (
                                                            <div key={`${sub.id}_${action}`} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`${sub.id}_${action}`}
                                                                    checked={currentPermissions[`${sub.id}_${action}`] || false}
                                                                    onCheckedChange={(checked) => handlePermissionChange(`${sub.id}_${action}`, !!checked)}
                                                                />
                                                                <Label htmlFor={`${sub.id}_${action}`} className="font-normal">{actionLabels[action as keyof typeof actionLabels]}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
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
