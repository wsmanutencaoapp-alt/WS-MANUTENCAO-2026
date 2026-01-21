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
  FileSignature,
  FileCog,
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
        { href: '/dashboard/suprimentos/lista-itens', icon: List, label: 'Lista de Itens', permission: 'suprimentos_lista' },
        { href: '/dashboard/suprimentos/movimentacao', label: 'Movimentação', permission: 'suprimentos_movimentacao' },
    ]
  },
  { 
    href: '/dashboard/ferramentaria', 
    icon: Wrench, 
    label: 'Ferramentaria',
    permission: 'ferramentaria',
    subItems: [
        { href: '/dashboard/ferramentaria/lista-ferramentas', icon: List, label: 'Lista de Ferramentas', permission: 'ferramentaria_lista' },
        { href: '/dashboard/ferramentaria/movimentacao', label: 'Entrada e Saída', permission: 'ferramentaria_movimentacao' },
        { href: '/dashboard/ferramentaria/kits', icon: Package, label: 'Gerenciar Kits', permission: 'ferramentaria_kits' },
        { href: '/dashboard/calibracao', label: 'Controle/Calibração', permission: 'calibracao' },
        { href: '/dashboard/ferramentaria/historico-nao-conformes', icon: History, label: 'Histórico Não Conformes', permission: 'ferramentaria_historico' },
    ]
  },
  {
    href: '/dashboard/cadastros',
    icon: FilePlus2,
    label: 'Cadastros',
    permission: 'cadastros',
    subItems: [
        { href: '/dashboard/cadastros/ferramentas', label: 'Ferramentas', permission: 'cadastros_ferramentas' },
        { href: '/dashboard/cadastros/suprimentos', label: 'Suprimentos', permission: 'cadastros_suprimentos' },
        { href: '/dashboard/cadastros/fornecedores', label: 'Fornecedores', permission: 'cadastros_fornecedores' },
        { href: '/dashboard/cadastros/enderecos', label: 'Endereços', permission: 'cadastros_enderecos' },
        { href: '/dashboard/cadastros/centro-de-custo', label: 'Centro de Custo', permission: 'cadastros_centro_custo' },
    ]
  },
  { 
    href: '/dashboard/compras', 
    icon: ShoppingCart, 
    label: 'Compras',
    permission: 'compras',
    subItems: [
        { href: '/dashboard/compras/requisicao', label: 'Requisição de Compra', permission: 'compras_requisicao', icon: FileSignature },
        { href: '/dashboard/compras/aprovacoes', label: 'Aprovações', permission: 'compras_aprovacoes' },
        { href: '/dashboard/compras/controle-compras', icon: FileCog, label: 'Controle de Compras', permission: 'compras_controle' },
    ]
  },
  {
    href: '/dashboard/engenharia',
    icon: Briefcase,
    label: 'Engenharia',
    permission: 'engenharia',
    subItems: [
      { href: '/dashboard/engenharia/aprovacoes', label: 'Aprovações', permission: 'engenharia_aprovacoes' },
      { href: '/dashboard/engenharia/projetos', label: 'Projetos', permission: 'engenharia_projetos' },
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
        { href: '/dashboard/financeiro/visao-geral', label: 'Visão Geral', permission: 'financeiro_visao_geral' },
        { href: '/dashboard/financeiro/budget', label: 'Budget', permission: 'financeiro_budget' },
        { href: '/dashboard/financeiro/despesas', label: 'Despesas', permission: 'financeiro_despesas' },
    ]
  },
  { 
    href: '/dashboard/contabilidade', 
    icon: Landmark, 
    label: 'Fiscal/Contábil',
    permission: 'contabilidade',
    subItems: [
        { href: '/dashboard/contabilidade/balancete', label: 'Balancete', permission: 'contabilidade_balancete' },
        { href: '/dashboard/contabilidade/relatorios', label: 'Relatórios', permission: 'contabilidade_relatorios' },
        { href: '/dashboard/contabilidade/classificacao', label: 'Classificação Contábil', permission: 'contabilidade_classificacao' },
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
            { href: '/dashboard/configurador/alcada-aprovacao', label: 'Alçada de Aprovação', permission: 'configurador_alcada' },
            { href: '/dashboard/configurador/disparo-email', label: 'Disparo de E-mail', permission: 'configurador_disparo_email' }
        ]
    },
]

const filterItemsByPermissions = (items: NavItem[], permissions: Employee['permissions'] | undefined, isAdmin: boolean): NavItem[] => {
  if (!permissions && !isAdmin) return [];

  return items.reduce((acc, item) => {
    const hasViewPermission = isAdmin || !item.permission || (permissions?.[`${item.permission}_view`]);

    if (hasViewPermission) {
      if (item.subItems) {
        const permittedSubItems = item.subItems.filter(subItem => 
          isAdmin || !subItem.permission || (permissions?.[`${subItem.permission}_view`])
        );
        
        if (permittedSubItems.length > 0) {
          acc.push({ ...item, subItems: permittedSubItems });
        }
      } else {
        acc.push(item);
      }
    }
    return acc;
  }, [] as NavItem[]);
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
    const baseItems = allNavItems.filter(item => item.permission === 'dashboard');
    const permittedItems = filterItemsByPermissions(allNavItems.filter(item => item.permission !== 'dashboard'), employeeData.permissions, isAdmin);
    return filterNavItemsBySearch([...baseItems, ...permittedItems], searchTerm);
  }, [employeeData, isAdmin, searchTerm]);

  const bottomNavItems = useMemo(() => {
    if (!employeeData) return [];
    const permittedItems = filterItemsByPermissions(allBottomNavItems, employeeData.permissions, isAdmin);
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
