export const availableModules: { id: string; label: string, isModule?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', isModule: true },
    { id: 'suprimentos', label: 'Suprimentos (Módulo)', isModule: true },
    { id: 'suprimentos_movimentacao', label: '-> Movimentação', isModule: false },
    { id: 'ferramentaria', label: 'Ferramentaria (Módulo)', isModule: true },
    { id: 'ferramentaria_lista', label: '-> Lista de Ferramentas', isModule: false },
    { id: 'ferramentaria_movimentacao', label: '-> Entrada e Saída', isModule: false },
    { id: 'ferramentaria_kits', label: '-> Gerenciar Kits', isModule: false },
    { id: 'ferramentaria_historico', label: '-> Histórico Não Conformes', isModule: false },
    { id: 'calibracao', label: 'Controle/Calibração', isModule: true }, // Standalone but related
    { id: 'cadastros', label: 'Cadastros (Módulo)', isModule: true },
    { id: 'cadastros_ferramentas', label: '-> Ferramentas', isModule: false },
    { id: 'cadastros_suprimentos', label: '-> Suprimentos', isModule: false },
    { id: 'cadastros_enderecos', label: '-> Endereços', isModule: false },
    { id: 'compras', label: 'Compras (Módulo)', isModule: true },
    { id: 'compras_aprovacoes', label: '-> Aprovações', isModule: false },
    { id: 'compras_controle', label: '-> Controle', isModule: false },
    { id: 'engenharia', label: 'Engenharia (Módulo)', isModule: true },
    { id: 'engenharia_aprovacoes', label: '-> Aprovações', isModule: false },
    { id: 'engenharia_projetos', label: '-> Projetos', isModule: false },
    { id: 'comercial', label: 'Comercial', isModule: true },
    { id: 'financeiro', label: 'Financeiro (Módulo)', isModule: true },
    { id: 'financeiro_visao_geral', label: '-> Visão Geral', isModule: false },
    { id: 'financeiro_budget', label: '-> Budget', isModule: false },
    { id: 'financeiro_despesas', label: '-> Despesas', isModule: false },
    { id: 'contabilidade', label: 'Fiscal/Contábil (Módulo)', isModule: true },
    { id: 'contabilidade_balancete', label: '-> Balancete', isModule: false },
    { id: 'contabilidade_relatorios', label: '-> Relatórios', isModule: false },
    { id: 'contabilidade_classificacao', label: '-> Classificação Contábil', isModule: false },
    { id: 'qualidade', label: 'Qualidade', isModule: true },
    { id: 'gso', label: 'GSO', isModule: true },
    { id: 'planejamento', label: 'Planejamento', isModule: true },
    { id: 'manutencao', label: 'Manutenção', isModule: true },
    { id: 'userManagement', label: 'Gerenciar Usuários', isModule: true },
    { id: 'configurador', label: 'Configurador (Módulo)', isModule: true },
    { id: 'configurador_alcada', label: '-> Alçada de Aprovação', isModule: false },
];

export const getRequiredPermissionForPath = (path: string): string | null => {
    // Find the most specific match first by sorting paths by length descending
    const sortedPermissions = [...availableModules].sort((a, b) => {
        const pathA = a.id.replace(/_/g, '/');
        const pathB = b.id.replace(/_/g, '/');
        return pathB.length - pathA.length;
    });

    const pathSegments = path.split('/').filter(Boolean);
    
    // Example path: /dashboard/ferramentaria/lista-ferramentas
    // We want to match `ferramentaria_lista`
    
    // Find the permission that is the best match for the current path
    for (const p of sortedPermissions) {
        const permissionPath = `/dashboard/${p.id.replace(/_/g, '/')}`;
        if (path.startsWith(permissionPath)) {
            return p.id;
        }
    }
    
    // Fallback for top-level modules if no specific sub-module matches
    if (pathSegments.length >= 2 && pathSegments[0] === 'dashboard') {
        const moduleName = pathSegments[1];
        const modulePermission = availableModules.find(p => p.id === moduleName && p.isModule);
        if (modulePermission) {
            return modulePermission.id;
        }
    }

    if (path === '/dashboard') return 'dashboard';

    return null;
};
