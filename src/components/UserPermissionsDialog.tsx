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
    { id: 'suprimentos_movimentacao', label: 'Movimentação', isParent: false, parentId: 'suprimentos' },
    { id: 'ferramentaria', label: 'Ferramentaria (Módulo)', isParent: true },
    { id: 'ferramentaria_cadastro', label: 'Cadastro', isParent: false, parentId: 'ferramentaria' },
    { id: 'ferramentaria_movimentacao', label: 'Entrada e Saída', isParent: false, parentId: 'ferramentaria' },
    { id: 'calibracao', label: 'Calibração', isParent: false, parentId: 'ferramentaria' },
    { id: 'compras', label: 'Compras (Módulo)', isParent: true },
    { id: 'compras_aprovacoes', label: 'Aprovações', isParent: false, parentId: 'compras' },
    { id: 'compras_controle', label: 'Controle', isParent: false, parentId: 'compras' },
    { id: 'financeiro', label: 'Financeiro (Módulo)', isParent: true },
    { id: 'financeiro_visao-geral', label: 'Visão Geral', isParent: false, parentId: 'financeiro' },
    { id: 'financeiro_orcamento', label: 'Orçamento', isParent: false, parentId: 'financeiro' },
    { id: 'userManagement', label: 'Gerenciar Usuários', isParent: true },
    { id: 'configurador', label: 'Configurador (Módulo)', isParent: true },
    { id: 'configurador_alcada-aprovacao', label: 'Alçada de Aprovação', isParent: false, parentId: 'configurador' },
];


interface UserPermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    employee: WithDocId<Employee> | null;
    onPermissionsChange: (employeeId: string, permissions: any) => void;
}

export default function UserPermissionsDialog({ isOpen, onClose, employee, onPermissionsChange }: UserPermissionsDialogProps) {
    const [currentPermissions, setCurrentPermissions] = useState<{[key: string]: boolean}>({});

    useEffect(() => {
        if (employee) {
            setCurrentPermissions(employee.permissions || {});
        }
    }, [employee]);

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
                    <div className="space-y-4">
                        {moduleGroups.map((module, index) => {
                            const subModules = availableScreens.filter(s => s.parentId === module.id);
                            const isModuleChecked = isUserAdmin || (currentPermissions?.[module.id] || false);

                            return (
                               <React.Fragment key={module.id}>
                                 {index > 0 && <Separator className="my-3" />}
                                 <div className="space-y-3">
                                    <div className={`flex items-center space-x-3 rounded-md p-2`}>
                                        <Checkbox
                                            id={`${employee.docId}-${module.id}`}
                                            checked={isModuleChecked}
                                            disabled={true} // Campo desabilitado
                                            aria-label={`Permissão para ${module.label}`}
                                        />
                                        <Label
                                            htmlFor={`${employee.docId}-${module.id}`}
                                            className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {module.label}
                                        </Label>
                                    </div>
                                    {isModuleChecked && subModules.length > 0 && (
                                       <div className="pl-8 space-y-3 animate-in fade-in-0 duration-300">
                                            {subModules.map(sub => (
                                                <div key={sub.id} className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id={`${employee.docId}-${sub.id}`}
                                                        checked={currentPermissions?.[sub.id] || false}
                                                        disabled={true} // Campo desabilitado
                                                        aria-label={`Permissão para ${sub.label}`}
                                                    />
                                                    <Label htmlFor={`${employee.docId}-${sub.id}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
