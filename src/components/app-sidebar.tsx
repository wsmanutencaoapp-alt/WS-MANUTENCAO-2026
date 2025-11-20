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
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar } from '@/components/ui/sidebar';

const navItems: NavItem[] = [
  { 
    href: '/dashboard/suprimentos', 
    icon: Box, 
    label: 'Suprimentos',
    subItems: [
        { href: '/dashboard/suprimentos/movimentacao', label: 'Movimentação' },
    ]
  },
  { 
    href: '/dashboard/ferramentaria', 
    icon: Wrench, 
    label: 'Ferramentaria',
    subItems: [
        { href: '/dashboard/ferramentaria/cadastro', label: 'Cadastro' },
        { href: '/dashboard/ferramentaria/movimentacao', label: 'Entrada e Saída' },
        { href: '/dashboard/calibracao', label: 'Calibração' },
    ]
  },
  { 
    href: '/dashboard/compras', 
    icon: ShoppingCart, 
    label: 'Compras',
    subItems: [
        { href: '/dashboard/compras/aprovacoes', label: 'Aprovações' },
        { href: '/dashboard/compras/controle', label: 'Controle' },
    ]
  },
  { 
    href: '/dashboard/financeiro', 
    icon: Landmark, 
    label: 'Financeiro',
    subItems: [
        { href: '/dashboard/financeiro/visao-geral', label: 'Visão Geral' },
        { href: '/dashboard/financeiro/orcamento', label: 'Orçamento' },
    ]
  },
];

const bottomNavItems: NavItem[] = [
    { href: '/dashboard/user-management', icon: Users, label: 'Usuários' },
    { 
        href: '/dashboard/configurador', 
        icon: SlidersHorizontal, 
        label: 'Configurador',
        subItems: [
            { href: '/dashboard/configurador/alcada-aprovacao', label: 'Alçada de Aprovação' }
        ]
    },
]

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="group-[[data-variant=sidebar]]:border-r group-[[data-variant=sidebar]]:bg-background">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-none border-b bg-background px-4 text-lg font-semibold text-primary sm:justify-start sm:px-6"
        >
          <Send className="h-5 w-5 transition-all group-hover:scale-110" />
          <span className={cn("font-bold", state === 'collapsed' && "hidden")}>AeroTrack</span>
          <span className="sr-only">AeroTrack</span>
        </Link>
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
