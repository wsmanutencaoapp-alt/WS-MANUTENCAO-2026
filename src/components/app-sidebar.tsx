'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Package,
  History,
  FileSignature,
  FileCog,
  Car,
  DoorOpen,
  Camera,
  Receipt,
  ExternalLink,
  Paintbrush,
  ClipboardList,
  Activity,
  Home,
  Megaphone,
  Settings2,
  ScanSearch,
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

const SUPER_ADMIN_UID = 'SOID8C723XUmlniI3mpjBmBPA5v1';

const allNavItems: NavItem[] = [
  { 
    href: '/dashboard', 
    icon: Home, 
    label: 'Home',
    permission: 'home',
  },
  { 
    href: '/dashboard/overview',
    icon: LayoutDashboard, 
    label: 'Dashboard',
    permission: 'dashboard_overview',
  },
  { 
    href: '/dashboard/gestao-atividades',
    icon: Activity,
    label: 'Gestão de Atividades',
    permission: 'gestao_atividades',
     subItems: [
        { href: '/dashboard/gestao-atividades', label: 'Quadro Kanban' },
        { href: '/dashboard/gestao-atividades/arquivadas', label: 'Arquivadas' },
    ]
  },
  { 
    href: '/dashboard/suprimentos', 
    icon: Box, 
    label: 'Suprimentos',
    permission: 'suprimentos',
    subItems: [
        { href: '/dashboard/suprimentos/lista-itens', icon: List, label: 'Lista de Itens', permission: 'suprimentos_lista' },
        { href: '/dashboard/suprimentos/movimentacao', label: 'Movimentação', permission: 'suprimentos_movimentacao' },
        { href: '/dashboard/suprimentos/inventario', icon: ScanSearch, label: 'Inventário / Contagem', permission: 'suprimentos_inventario' },
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
        { href: '/dashboard/cadastros/veiculos', label: 'Veículos', permission: 'cadastros_veiculos', icon: Car },
        { href: '/dashboard/cadastros/funcionarios', label: 'Funcionários', permission: 'cadastros_funcionarios', icon: Users },
        { href: '/dashboard/cadastros/enderecos', label: 'Endereços', permission: 'cadastros_enderecos' },
        { href: '/dashboard/cadastros/centro-de-custo', label: 'Centro de Custo', permission: 'cadastros_centro_custo' },
        { href: '/dashboard/cadastros/treinamentos', label: 'Treinamentos', permission: 'cadastros_treinamentos', icon: ClipboardList },
        { href: '/dashboard/cadastros/tecnica/modelos', label: 'Técnica: Modelos', permission: 'cadastros_tecnica_modelos', icon: Settings2 },
        { href: '/dashboard/cadastros/tecnica/tarefas', label: 'Técnica: Tarefas', permission: 'cadastros_tecnica_tarefas', icon: ClipboardList },
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
    href: '/dashboard/recursos-humanos', 
    icon: Megaphone, 
    label: 'Recursos Humanos',
    permission: 'recursos_humanos',
    subItems: [
        { href: '/dashboard/recursos-humanos/mural', label: 'Gerenciar Mural', permission: 'recursos_humanos_mural' },
    ]
  },
  { 
    href: '/dashboard/financeiro', 
    icon: Wallet, 
    label: 'Financeiro',
    permission: 'financeiro',
    subItems: [
        { href: '/dashboard/financeiro/despesas-individuais', label: 'Minhas Despesas' },
        { href: '/dashboard/financeiro/despesas', label: 'Gerenciar Despesas', permission: 'financeiro_despesas' },
        { href: '/dashboard/financeiro/budget', label: 'Budget', permission: 'financeiro_budget' },
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
    subItems: [
      { href: '/dashboard/gso/controle-credenciamento', icon: Users, label: 'Controle de Credenciamento', permission: 'gso_controle_credenciamento' },
      { href: '/dashboard/gso/controle-de-casos', icon: Briefcase, label: 'Controle de Casos', permission: 'gso_controle_casos' },
      { href: '/dashboard/gso/ficha-atendimento', icon: ClipboardList, label: 'Ficha de Atendimento', permission: 'gso_ficha_atendimento' },
    ]
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
    subItems: [
        { href: '/dashboard/manutencao/veiculos', label: 'Manutenção de Veículos', permission: 'manutencao_veiculos' },
    ]
  },
   {
    href: '/dashboard/portaria',
    icon: DoorOpen,
    label: 'Portaria',
    permission: 'portaria',
    subItems: [
      { href: '/dashboard/portaria/controle-veiculos', label: 'Controle de Veículos', permission: 'portaria_controle_veiculos' },
      { href: '/dashboard/portaria/controle-pessoas', label: 'Controle de Pessoas', permission: 'portaria_controle_pessoas' },
    ]
  },
  { 
    href: '/dashboard/user-management', 
    icon: Users, 
    label: 'Permissões',
    permission: 'userManagement',
  },
  { 
    href: '/dashboard/configurador', 
    icon: SlidersHorizontal, 
    label: 'Configurador',
    permission: 'configurador',
    subItems: [
        { href: '/dashboard/configurador/alcada-aprovacao', label: 'Alçada de Aprovação', permission: 'configurador_alcada' },
        { href: '/dashboard/configurador/disparo-email', label: 'Disparo de E-mail', permission: 'configurador_disparo_email' },
        { href: '/dashboard/configurador/personalizar', icon: Paintbrush, label: 'Personalizar Aparência', permission: 'configurador_personalizar' }
    ]
  },
];

const allBottomNavItems: NavItem[] = [
    { 
        href: '/dashboard/selfie', 
        icon: Camera, 
        label: 'Self (Público)',
        subItems: [
            { href: '/retirada-veiculo', label: 'Retirada de Veículo', icon: Car },
            { href: '/anexo-comprovante', label: 'Anexo de Comprovante', icon: Receipt },
        ]
    },
];

const filterItemsByPermissions = (items: NavItem[], permissions: Employee['permissions'] | undefined, isAdmin: boolean): NavItem[] => {
  // Always allow Super Admin
  if (isAdmin) return items;
  if (!permissions) return [];

  return items.reduce((acc, item) => {
    const hasViewPermission = !item.permission || (permissions?.[`${item.permission}_view`]);

    if (hasViewPermission) {
      if (item.subItems) {
        const permittedSubItems = item.subItems.filter(subItem => 
          !subItem.permission || (permissions?.[`${subItem.permission}_view`])
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

  const isAdmin = useMemo(() => user?.uid === SUPER_ADMIN_UID || employeeData?.accessLevel === 'Admin', [employeeData, user]);

  const navItems = useMemo(() => {
    // If no employee data yet, but it's Super Admin, allow all items
    if (!employeeData && user?.uid !== SUPER_ADMIN_UID) return [];
    
    const permittedItems = filterItemsByPermissions(allNavItems, employeeData?.permissions, isAdmin);
    
    return filterNavItemsBySearch(permittedItems, searchTerm);

  }, [employeeData, isAdmin, searchTerm, user?.uid]);

  const bottomNavItems = useMemo(() => {
    if (!employeeData && user?.uid !== SUPER_ADMIN_UID) return [];
    const permittedItems = filterItemsByPermissions(allBottomNavItems, employeeData?.permissions, isAdmin);
    return filterNavItemsBySearch(permittedItems, searchTerm);
  }, [employeeData, isAdmin, searchTerm, user?.uid]);

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
