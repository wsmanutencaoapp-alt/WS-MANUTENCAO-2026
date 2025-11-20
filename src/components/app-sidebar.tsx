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
  ChevronDown,
} from 'lucide-react';
import { NavMenu, type NavItem } from '@/components/nav-menu';
import { cn } from '@/lib/utils';


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
    { href: '/dashboard/settings', icon: Settings, label: 'Seu Perfil' },
]

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="/dashboard"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Send className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">AeroTrack</span>
          </Link>
          <NavMenu items={navItems} pathname={pathname} />
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <NavMenu items={bottomNavItems} pathname={pathname} />
        </nav>
    </aside>
  );
}
