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
  Wallet,
  FilePlus2,
  List,
  Briefcase,
  DollarSign,
  ShieldCheck,
  Plane,
  CalendarCheck,
  HardHat,
  LayoutDashboard,
  Search,
  Package,
  History,
} from 'lucide-react';
import { NavMenu, type NavItem } from '@/components/nav-menu';
import { cn } from '@/lib/utils';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Employee } from '@/lib/types';
import { useMemo, useState } from 'react';
import { doc } from 'firebase/firestore';
import Image from 'next/image';
import { Input } from '@/components/ui/input';


const allNavItems: NavItem[] = [
  { 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    label: 'Dashboard',
    permission: 'dashboard',
  },
  { 
    href: '/dashboard/suprimentos', 
    icon: Box, 
    label: 'Suprimentos',
    permission: 'suprimentos',
    subItems: [
        { href: '/dashboard/suprimentos/movimentacao', label: 'Movimentação' },
    ]
  },
  { 
    href: '/dashboard/ferramentaria', 
    icon: Wrench, 
    label: 'Ferramentaria',
    permission: 'ferramentaria',
    subItems: [
        { href: '/dashboard/ferramentaria/lista-ferramentas', icon: List, label: 'Lista de Ferramentas' },
        { href: '/dashboard/ferramentaria/movimentacao', label: 'Entrada e Saída' },
        { href: '/dashboard/ferramentaria/kits', icon: Package, label: 'Gerenciar Kits' },
        { href: '/dashboard/calibracao', label: 'Controle/Calibração' },
        { href: '/dashboard/ferramentaria/historico-nao-conformes', icon: History, label: 'Histórico Não Conformes' },
    ]
  },
  {
    href: '/dashboard/cadastros',
    icon: FilePlus2,
    label: 'Cadastros',
    permission: 'cadastros',
    subItems: [
        { href: '/dashboard/cadastros/ferramentas', label: 'Ferramentas' },
        { href: '/dashboard/cadastros/suprimentos', label: 'Suprimentos' },
        { href: '/dashboard/cadastros/enderecos', label: 'Endereços' },
    ]
  },
  { 
    href: '/dashboard/compras', 
    icon: ShoppingCart, 
    label: 'Compras',
    permission: 'compras',
    subItems: [
        { href: '/dashboard/compras/aprovacoes', label: 'Aprovações' },
        { href: '/dashboard/compras/controle', label: 'Controle' },
    ]
  },
  {
    href: '/dashboard/engenharia',
    icon: Briefcase,
    label: 'Engenharia',
    permission: 'engenharia',
    subItems: [
      { href: '/dashboard/engenharia/aprovacoes', label: 'Aprovações' },
      { href: '/dashboard/engenharia/projetos', label: 'Projetos' },
    ]
  },
  {
    href: '/dashboard/comercial',
    icon: DollarSign,
    label: 'Comercial',
    permission: 'comercial',
  },
  { 
    href: '/dashboard/financeiro', 
    icon: Wallet, 
    label: 'Financeiro',
    permission: 'financeiro',
    subItems: [
        { href: '/dashboard/financeiro/visao-geral', label: 'Visão Geral' },
        { href: '/dashboard/financeiro/budget', label: 'Budget' },
        { href: '/dashboard/financeiro/despesas', label: 'Despesas' },
    ]
  },
  { 
    href: '/dashboard/contabilidade', 
    icon: Landmark, 
    label: 'Fiscal/Contábil',
    permission: 'contabilidade',
    subItems: [
        { href: '/dashboard/contabilidade/balancete', label: 'Balancete' },
        { href: '/dashboard/contabilidade/relatorios', label: 'Relatórios' },
        { href: '/dashboard/contabilidade/classificacao', label: 'Classificação Contábil' },
    ]
  },
  {
    href: '/dashboard/qualidade',
    icon: ShieldCheck,
    label: 'Qualidade',
    permission: 'qualidade',
  },
  {
    href: '/dashboard/gso',
    icon: Plane,
    label: 'GSO',
    permission: 'gso',
  },
  {
    href: '/dashboard/planejamento',
    icon: CalendarCheck,
    label: 'Planejamento',
    permission: 'planejamento',
  },
  {
    href: '/dashboard/manutencao',
    icon: HardHat,
    label: 'Manutenção',
    permission: 'manutencao',
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
            { href: '/dashboard/configurador/alcada-aprovacao', label: 'Alçada de Aprovação' }
        ]
    },
]

const filterItemsByPermissions = (items: NavItem[], permissions: Employee['permissions'], isAdmin: boolean): NavItem[] => {
    if (isAdmin) return items;
    if (!permissions) return [];

    return items.filter(item => item.permission && permissions[item.permission]);
};

const filterNavItemsBySearch = (items: NavItem[], searchTerm: string): NavItem[] => {
    if (!searchTerm) {
        return items;
    }

    const lowercasedTerm = searchTerm.toLowerCase();

    return items.reduce((acc, item) => {
        const itemLabelMatch = item.label.toLowerCase().includes(lowercasedTerm);

        if (itemLabelMatch) {
            acc.push(item);
            return acc;
        }

        if (item.subItems) {
            const matchingSubItems = item.subItems.filter(subItem =>
                subItem.label.toLowerCase().includes(lowercasedTerm)
            );

            if (matchingSubItems.length > 0) {
                acc.push({ ...item, subItems: matchingSubItems });
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
  const [searchTerm, setSearchTerm] = useState('');

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData } = useDoc<Employee>(userDocRef);

  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  const navItems = useMemo(() => {
    if (!employeeData) return [];
    // The dashboard link is always visible for logged-in users.
    const baseItems = allNavItems.filter(item => item.permission === 'dashboard');
    const permittedItems = filterItemsByPermissions(allNavItems.filter(item => item.permission !== 'dashboard'), employeeData.permissions || {}, isAdmin);
    return filterNavItemsBySearch([...baseItems, ...permittedItems], searchTerm);
  }, [employeeData, isAdmin, searchTerm]);

  const bottomNavItems = useMemo(() => {
    if (!employeeData) return [];
    const permittedItems = filterItemsByPermissions(allBottomNavItems, employeeData.permissions || {}, isAdmin);
    return filterNavItemsBySearch(permittedItems, searchTerm);
  }, [employeeData, isAdmin, searchTerm]);

  return (
    <Sidebar collapsible="icon" className="group-[[data-variant=sidebar]]:border-r group-[[data-variant=sidebar]]:bg-sidebar">
      <SidebarHeader className="flex h-14 shrink-0 items-center justify-center rounded-none border-b px-4">
         <div className="flex items-center gap-2 text-lg font-semibold text-primary">
          <img src="/logo.png" alt="APP WS Logo" className={cn("w-auto transition-all", state === 'collapsed' ? 'h-10' : 'h-12' )} />
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-2 p-2 sm:p-4">
        <div className={cn("relative", state === 'collapsed' && "hidden")}>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Pesquisar módulos..."
            className="w-full rounded-lg bg-background pl-8 text-blue-600 dark:text-blue-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
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
