'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Send,
  Box,
  Wrench,
  Thermometer,
  Settings,
  ShoppingCart,
  Landmark,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { NavMenu, type NavItem } from '@/components/nav-menu';
import { cn } from '@/lib/utils';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Employee } from '@/lib/types';
import { useMemo } from 'react';
import { doc } from 'firebase/firestore';


const allNavItems: NavItem[] = [
  { 
    href: '/dashboard/suprimentos', 
    icon: Box, 
    label: 'Suprimentos',
    permission: 'suprimentos',
    subItems: [
        { href: '/dashboard/suprimentos/movimentacao', label: 'Movimentação', permission: 'suprimentos_movimentacao' },
    ]
  },
  { 
    href: '/dashboard/ferramentaria', 
    icon: Wrench, 
    label: 'Ferramentaria',
    permission: 'ferramentaria',
    subItems: [
        { href: '/dashboard/ferramentaria/cadastro', label: 'Cadastro', permission: 'ferramentaria_cadastro' },
        { href: '/dashboard/ferramentaria/movimentacao', label: 'Entrada e Saída', permission: 'ferramentaria_movimentacao' },
        { href: '/dashboard/calibracao', label: 'Calibração', permission: 'calibracao' },
    ]
  },
  { 
    href: '/dashboard/compras', 
    icon: ShoppingCart, 
    label: 'Compras',
    permission: 'compras',
    subItems: [
        { href: '/dashboard/compras/aprovacoes', label: 'Aprovações', permission: 'compras_aprovacoes' },
        { href: '/dashboard/compras/controle', label: 'Controle', permission: 'compras_controle' },
    ]
  },
  { 
    href: '/dashboard/financeiro', 
    icon: Landmark, 
    label: 'Financeiro',
    permission: 'financeiro',
    subItems: [
        { href: '/dashboard/financeiro/visao-geral', label: 'Visão Geral', permission: 'financeiro_visao-geral' },
        { href: '/dashboard/financeiro/orcamento', label: 'Orçamento', permission: 'financeiro_orcamento' },
    ]
  },
];

const allBottomNavItems: NavItem[] = [
    { href: '/dashboard/user-management', icon: Users, label: 'Usuários', permission: 'userManagement' },
    { 
        href: '/dashboard/configurador', 
        icon: SlidersHorizontal, 
        label: 'Configurador',
        permission: 'configurador',
        subItems: [
            { href: '/dashboard/configurador/alcada-aprovacao', label: 'Alçada de Aprovação', permission: 'configurador_alcada-aprovacao' }
        ]
    },
]

const filterItemsByPermissions = (items: NavItem[], permissions: Employee['permissions'], isAdmin: boolean): NavItem[] => {
    if (isAdmin) return items;
    if (!permissions) return [];

    return items.reduce((acc, item) => {
        if (permissions[item.permission!]) {
            const newItem = { ...item };
            if (item.subItems) {
                newItem.subItems = item.subItems.filter(subItem => permissions[subItem.permission!]);
                // Se o item principal tem permissão, mas nenhum subitem tem, não mostramos o item principal
                // a menos que a rota principal seja um destino válido por si só.
                if (newItem.subItems.length > 0) {
                   acc.push(newItem);
                }
            } else {
              acc.push(newItem);
            }
        }
        return acc;
    }, [] as NavItem[]);
};


export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData } = useDoc<Employee>(userDocRef);

  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  const navItems = useMemo(() => {
    return filterItemsByPermissions(allNavItems, employeeData?.permissions, isAdmin);
  }, [employeeData, isAdmin]);

  const bottomNavItems = useMemo(() => {
    return filterItemsByPermissions(allBottomNavItems, employeeData?.permissions, isAdmin);
  }, [employeeData, isAdmin]);

  return (
    <Sidebar collapsible="icon" className="group-[[data-variant=sidebar]]:border-r group-[[data-variant=sidebar]]:bg-background">
      <SidebarHeader className="flex h-14 shrink-0 items-center justify-between rounded-none border-b bg-background px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold text-primary"
        >
          <Send className="h-5 w-5 transition-all group-hover:scale-110" />
          <span className={cn("font-bold", state === 'collapsed' && "hidden")}>AeroTrack</span>
          <span className="sr-only">AeroTrack</span>
        </Link>
        <SidebarTrigger className="hidden md:flex" />
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-2 p-2 sm:p-4">
        <SidebarMenu className='flex-1'>
            <NavMenu items={navItems} pathname={pathname} />
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-2 sm:p-4">
        <SidebarMenu>
            <NavMenu items={bottomNavItems} pathname={pathname} />
            <SidebarMenuItem>
              <Link href="/dashboard/settings">
                  <SidebarMenuButton 
                      isActive={pathname === '/dashboard/settings'} 
                      tooltip={{children: 'Seu Perfil'}}
                  >
                      <Settings />
                      <span className={cn(state === 'collapsed' && "hidden")}>Seu Perfil</span>
                  </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
