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
  FileText,
  BadgeDollarSign,
  HeartHandshake,
  Map as MapIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc } from 'firebase/firestore';
import { NavMenu, type NavItem } from '@/components/nav-menu';
import type { Employee } from '@/lib/types';
import { useMemo } from 'react';
import { ThemeToggle } from './theme-toggle';
import Notifications from './Notifications';

const SUPER_ADMIN_UID = 'SOID8C723XUmlniI3mpjBmBPA5v1';

const allNavItems: NavItem[] = [
  { 
    href: '/dashboard', 
    icon: Home, 
    label: 'Home',
    permission: 'home',
  },
  { 
    href: '/dashboard/ordem-servico', 
    icon: FileText, 
    label: 'Ordem de Serviço',
    permission: 'ordem_servico',
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
        { href: '/dashboard/cadastros/aeronaves', label: 'Aeronaves', permission: 'cadastros_aeronaves', icon: Plane },
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
    href: '/dashboard/comercial',
    icon: BadgeDollarSign,
    label: 'Comercial',
    permission: 'comercial',
    subItems: [
        { href: '/dashboard/comercial/aeronaves', label: 'Aeronaves Cadastradas', permission: 'comercial_aeronaves', icon: Plane },
        { href: '/dashboard/comercial/orcamentos', label: 'Orçamentos', permission: 'comercial_orcamentos', icon: FileText },
        { href: '/dashboard/comercial/faturamento', label: 'Faturamento de Serviço', permission: 'comercial_faturamento', icon: DollarSign },
        { href: '/dashboard/comercial/relacionamento', label: 'Relacionamento Cliente', permission: 'comercial_relacionamento', icon: HeartHandshake },
        { href: '/dashboard/comercial/mapeamento', label: 'Mapeamento Clientes', permission: 'comercial_mapeamento', icon: MapIcon },
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
  const isAdmin = useMemo(() => user?.uid === SUPER_ADMIN_UID || employeeData?.accessLevel === 'Admin', [employeeData, user]);

  const navItems = useMemo(() => {
    if (!employeeData && user?.uid !== SUPER_ADMIN_UID) return [];
    const mainPermitted = filterItemsByPermissions(allNavItems, employeeData?.permissions, isAdmin);
    const bottomPermitted = filterItemsByPermissions(allBottomNavItems, employeeData?.permissions, isAdmin);
    return [...mainPermitted, ...bottomPermitted];
  }, [employeeData, isAdmin, user?.uid]);


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
          <SheetTitle className="sr-only">Menu Principal</SheetTitle>
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/dashboard"
              className="flex h-10 items-center gap-2 text-lg font-semibold"
            >
              <img src="/logo.png" alt="APP WS Logo" className="h-10 w-auto" />
              <span className="sr-only">APP WS</span>
            </Link>
            <NavMenu items={navItems} pathname={pathname} isMobile={true} />
          </nav>
        </SheetContent>
      </Sheet>
      <div className="relative ml-auto flex items-center gap-2 md:grow-0">
        <Link href="/dashboard/financeiro/despesas-individuais">
          <Button>
            <Wallet className="mr-2 h-4 w-4" />
            Registro de despesas
          </Button>
        </Link>
        <ThemeToggle />
        <Notifications />
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
      </div>
    </header>
  );
}