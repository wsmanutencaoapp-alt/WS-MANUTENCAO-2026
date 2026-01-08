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

const availableModules = [
    { id: 'suprimentos', label: 'Suprimentos' },
    { id: 'ferramentaria', label: 'Ferramentaria' },
    { id: 'compras', label: 'Compras' },
    { id: 'engenharia', label: 'Engenharia' },
    { id: 'comercial', label: 'Comercial' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'userManagement', label: 'Gerenciar Usuários' },
    { id: 'configurador', label: 'Configurador' },
    { id: 'cadastros', label: 'Cadastros' },
    { id: 'contabilidade', label: 'Fiscal/Contábil' },
    { id: 'qualidade', label: 'Qualidade' },
    { id: 'gso', label: 'GSO' },
    { id: 'planejamento', label: 'Planejamento' },
    { id: 'manutencao', label: 'Manutenção' },
];


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
    
    const handlePermissionChange = (moduleId: string, checked: boolean) => {
        setCurrentPermissions(prev => ({
            ...prev,
            [moduleId]: checked
        }));
    };
    
    const handleSave = () => {
        updatePermissionsInFirestore(currentPermissions);
    };

    if (!employee) return null;

    const isUserAdmin = employee.accessLevel === 'Admin';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
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
                        <div className="space-y-3">
                            {availableModules.map((module) => (
                                <div key={module.id} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`${employee.docId}-${module.id}`}
                                        checked={currentPermissions?.[module.id] || false}
                                        onCheckedChange={(checked) => handlePermissionChange(module.id, !!checked)}
                                        aria-label={`Permissão para ${module.label}`}
                                    />
                                    <Label
                                        htmlFor={`${employee.docId}-${module.id}`}
                                        className="text-sm font-medium leading-none"
                                    >
                                        {module.label}
                                    </Label>
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
