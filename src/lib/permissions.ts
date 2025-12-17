export const allUserPermissions: { id: string; path: string }[] = [
    { id: 'suprimentos', path: '/dashboard/suprimentos' },
    { id: 'suprimentos_movimentacao', path: '/dashboard/suprimentos/movimentacao' },
    { id: 'ferramentaria', path: '/dashboard/ferramentaria' },
    { id: 'ferramentaria_lista', path: '/dashboard/ferramentaria/lista-ferramentas' },
    { id: 'ferramentaria_movimentacao', path: '/dashboard/ferramentaria/movimentacao' },
    { id: 'calibracao', path: '/dashboard/calibracao' },
    { id: 'compras', path: '/dashboard/compras' },
    { id: 'compras_aprovacoes', path: '/dashboard/compras/aprovacoes' },
    { id: 'compras_controle', path: '/dashboard/compras/controle' },
    { id: 'financeiro', path: '/dashboard/financeiro' },
    { id: 'financeiro_visao-geral', path: '/dashboard/financeiro/visao-geral' },
    { id: 'financeiro_orcamento', path: '/dashboard/financeiro/orcamento' },
    { id: 'financeiro_despesas', path: '/dashboard/financeiro/despesas' },
    { id: 'contabilidade', path: '/dashboard/contabilidade' },
    { id: 'contabilidade_balancete', path: '/dashboard/contabilidade/balancete' },
    { id: 'contabilidade_relatorios', path: '/dashboard/contabilidade/relatorios' },
    { id: 'userManagement', path: '/dashboard/user-management' },
    { id: 'configurador', path: '/dashboard/configurador' },
    { id: 'configurador_alcada-aprovacao', path: '/dashboard/configurador/alcada-aprovacao' },
    { id: 'cadastros', path: '/dashboard/cadastros' },
    { id: 'cadastros_ferramentas', path: '/dashboard/cadastros/ferramentas' },
    { id: 'engenharia', path: '/dashboard/engenharia' },
    { id: 'engenharia_aprovacoes', path: '/dashboard/engenharia/aprovacoes' },
];

export const getRequiredPermissionForPath = (path: string): string | null => {
    // A rota /dashboard/ferramentaria é um alias, então tratamos como /lista-ferramentas
    if (path === '/dashboard/ferramentaria') {
        path = '/dashboard/ferramentaria/lista-ferramentas';
    }
    const permission = allUserPermissions.find(p => p.path === path);
    return permission ? permission.id : null;
};
