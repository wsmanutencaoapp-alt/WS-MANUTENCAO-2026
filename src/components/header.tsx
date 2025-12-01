'use client';

import Link from 'next/link';
import {
  Send,
  Box,
  Wrench,
  PanelLeft,
  Search,
  Settings,
  LogIn,
  LogOut,
  UserPlus,
  Thermometer,
  ShoppingCart,
  Landmark,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc } from 'firebase/firestore';
import { NavMenu, NavItem } from '@/components/nav-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { Employee } from '@/lib/types';
import { useMemo } from 'react';

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
  { 
    href: '/dashboard/user-management', 
    icon: Users, 
    label: 'Usuários',
    permission: 'userManagement',
  },
  { 
    href: '/dashboard/configurador', 
    icon: SlidersHorizontal, 
    label: 'Configurador',
    permission: 'configurador',
    subItems: [
        { href: '/dashboard/configurador/alcada-aprovacao', label: 'Alçada de Aprovação', permission: 'configurador_alcada-aprovacao' }
    ]
  },
  { 
    href: '/dashboard/settings', 
    icon: Settings, 
    label: 'Seu Perfil' 
  },
];


const filterItemsByPermissions = (items: NavItem[], permissions: Employee['permissions'], isAdmin: boolean): NavItem[] => {
    if (isAdmin) return items;
    if (!permissions) return [];

    return items.reduce((acc, item) => {
        // Items sem 'permission' são sempre visíveis (ex: 'Seu Perfil')
        if (!item.permission || permissions[item.permission]) {
            const newItem = { ...item };
            if (item.subItems) {
                newItem.subItems = item.subItems.filter(subItem => !subItem.permission || permissions[subItem.permission]);
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


export function Header() {
  const pathname = usePathname();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'employees', user.uid);
  }, [firestore, user?.uid]);

  const { data: employeeData } = useDoc<Employee>(userDocRef);
  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  const navItems = useMemo(() => {
    return filterItemsByPermissions(allNavItems, employeeData?.permissions, isAdmin);
  }, [employeeData, isAdmin]);


  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };
  
  const userAvatarImage = employeeData?.photoURL;
  const userAvatarFallback = user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Alternar Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/dashboard"
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <Send className="h-5 w-5 transition-all group-hover:scale-110" />
              <span className="sr-only">AeroTrack</span>
            </Link>
            <NavMenu items={navItems} pathname={pathname} isMobile={true} />
          </nav>
        </SheetContent>
      </Sheet>
      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Search bar removed */}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Avatar>
              <AvatarImage src={userAvatarImage} alt="Avatar do usuário" />
              <AvatarFallback>
                {userAvatarFallback}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isUserLoading ? (
            <DropdownMenuLabel>Carregando...</DropdownMenuLabel>
          ) : user ? (
            <>
              <DropdownMenuLabel>
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                 <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Suporte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuLabel>Não Conectado</DropdownMenuLabel>
              <DropdownMenuSeparator />
               <DropdownMenuItem asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </DropdownMenuItem>
               <DropdownMenuItem asChild>
                <Link href="/signup">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Cadastre-se
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
