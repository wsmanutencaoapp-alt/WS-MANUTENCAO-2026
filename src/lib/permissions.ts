
export const permissionActions = ['view', 'create', 'update', 'delete'] as const;
export type PermissionAction = typeof permissionActions[number];

export const actionLabels: Record<PermissionAction, string> = {
    view: 'Visualizar',
    create: 'Criar',
    update: 'Editar',
    delete: 'Excluir',
};

// This new structure drives the permission dialog UI and navigation.
export const permissionStructure = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        isModule: true,
        actions: ['view'],
    },
    {
        id: 'suprimentos',
        label: 'Suprimentos',
        path: '/dashboard/suprimentos',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'suprimentos_lista', label: 'Lista de Itens (Estoque)', path: '/dashboard/suprimentos/lista-itens', actions: ['view', 'update', 'delete'] },
            { id: 'suprimentos_movimentacao', label: 'Histórico de Movimentação', path: '/dashboard/suprimentos/movimentacao', actions: ['view', 'create'] },
        ],
    },
    {
        id: 'ferramentaria',
        label: 'Ferramentaria',
        path: '/dashboard/ferramentaria',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'ferramentaria_lista', label: 'Lista de Ferramentas', path: '/dashboard/ferramentaria/lista-ferramentas', actions: ['view', 'update', 'delete'] },
            { id: 'ferramentaria_movimentacao', label: 'Entrada e Saída', path: '/dashboard/ferramentaria/movimentacao', actions: ['view', 'create'] },
            { id: 'ferramentaria_kits', label: 'Gerenciar Kits', path: '/dashboard/ferramentaria/kits', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'calibracao', label: 'Controle/Calibração', path: '/dashboard/calibracao', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'ferramentaria_historico', label: 'Histórico Não Conformes', path: '/dashboard/ferramentaria/historico-nao-conformes', actions: ['view'] },
        ],
    },
    {
        id: 'cadastros',
        label: 'Cadastros',
        path: '/dashboard/cadastros',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'cadastros_ferramentas', label: 'Ferramentas', path: '/dashboard/cadastros/ferramentas', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'cadastros_suprimentos', label: 'Suprimentos', path: '/dashboard/cadastros/suprimentos', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'cadastros_fornecedores', label: 'Fornecedores', path: '/dashboard/cadastros/fornecedores', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'cadastros_veiculos', label: 'Veículos', path: '/dashboard/cadastros/veiculos', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'cadastros_funcionarios', label: 'Funcionários', path: '/dashboard/cadastros/funcionarios', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'cadastros_enderecos', label: 'Endereços', path: '/dashboard/cadastros/enderecos', actions: ['view', 'create', 'delete'] },
            { id: 'cadastros_centro_custo', label: 'Centro de Custo', path: '/dashboard/cadastros/centro-de-custo', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'cadastros_treinamentos', label: 'Treinamentos', path: '/dashboard/cadastros/treinamentos', actions: ['view', 'create', 'update', 'delete'] },
        ]
    },
    {
        id: 'compras',
        label: 'Compras',
        path: '/dashboard/compras',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'compras_requisicao', label: 'Requisição de Compra', path: '/dashboard/compras/requisicao', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'compras_aprovacoes', label: 'Aprovações', path: '/dashboard/compras/aprovacoes', actions: ['view', 'update'] },
            { id: 'compras_controle', label: 'Controle de Compras', path: '/dashboard/compras/controle-compras', actions: ['view', 'create', 'update', 'delete'] },
        ],
    },
    {
        id: 'engenharia',
        label: 'Engenharia',
        path: '/dashboard/engenharia',
        isModule: true,
        actions: ['view'],
        submodules: [
          { id: 'engenharia_aprovacoes', label: 'Aprovações', path: '/dashboard/engenharia/aprovacoes', actions: ['view', 'update', 'delete'] },
          { id: 'engenharia_projetos', label: 'Projetos', path: '/dashboard/engenharia/projetos', actions: ['view', 'create', 'update', 'delete'] },
        ]
    },
    {
        id: 'financeiro',
        label: 'Financeiro',
        path: '/dashboard/financeiro',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'financeiro_despesas', label: 'Gerenciar Despesas', path: '/dashboard/financeiro/despesas', actions: ['view', 'update', 'delete'] },
            { id: 'financeiro_budget', label: 'Budget', path: '/dashboard/financeiro/budget', actions: ['view', 'create', 'update', 'delete'] },
        ]
    },
     {
        id: 'contabilidade',
        label: 'Fiscal/Contábil',
        path: '/dashboard/contabilidade',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'contabilidade_classificacao', label: 'Classificação Contábil', path: '/dashboard/contabilidade/classificacao', actions: ['view', 'update'] },
        ]
    },
    {
        id: 'portaria',
        label: 'Portaria',
        path: '/dashboard/portaria',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'portaria_controle_veiculos', label: 'Controle de Veículos', path: '/dashboard/portaria/controle-veiculos', actions: ['view', 'create', 'update', 'delete'] },
            { id: 'portaria_controle_pessoas', label: 'Controle de Pessoas', path: '/dashboard/portaria/controle-pessoas', actions: ['view', 'create', 'update'] },
        ]
    },
    {
        id: 'self',
        label: 'Self (Público)',
        path: '/retirada-veiculo',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'self_retirada', label: 'Retirada de Veículo', path: '/retirada-veiculo', actions: ['view'] },
            { id: 'self_comprovante', label: 'Anexo de Comprovante', path: '/anexo-comprovante', actions: ['view'] },
        ],
    },
    {
        id: 'manutencao',
        label: 'Manutenção',
        path: '/dashboard/manutencao',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'manutencao_veiculos', label: 'Manutenção de Veículos', path: '/dashboard/manutencao/veiculos', actions: ['view', 'create', 'update', 'delete'] },
        ]
    },
    {
        id: 'gso',
        label: 'GSO',
        path: '/dashboard/gso',
        isModule: true,
        actions: ['view'],
        submodules: [
          { id: 'gso_controle_credenciamento', label: 'Controle de Credenciamento', path: '/dashboard/gso/controle-credenciamento', actions: ['view', 'create', 'update', 'delete'] },
          { id: 'gso_controle_casos', label: 'Controle de Casos', path: '/dashboard/gso/controle-de-casos', actions: ['view', 'create', 'update', 'delete'] },
        ]
    },
    {
        id: 'userManagement',
        label: 'Gerenciar Usuários',
        path: '/dashboard/user-management',
        isModule: true,
        actions: ['view', 'update', 'create'],
    },
    {
        id: 'configurador',
        label: 'Configurador',
        path: '/dashboard/configurador',
        isModule: true,
        actions: ['view'],
        submodules: [
            { id: 'configurador_alcada', label: 'Alçada de Aprovação', path: '/dashboard/configurador/alcada-aprovacao', actions: ['view', 'update'] },
            { id: 'configurador_disparo_email', label: 'Disparo de E-mail', path: '/dashboard/configurador/disparo-email', actions: ['view', 'update'] },
            { id: 'configurador_personalizar', label: 'Personalizar Aparência', path: '/dashboard/configurador/personalizar', actions: ['view', 'update'] },
        ],
    },
];

// Generates a flat list of all possible permission IDs
export const allPermissionIDs = permissionStructure.flatMap(module => {
    const mainPermissions = module.actions ? module.actions.map(action => `${module.id}_${action}`) : [];
    const subPermissions = module.submodules ? module.submodules.flatMap(sub => 
        sub.actions.map(action => `${sub.id}_${action}`)
    ) : [];
    return [...mainPermissions, ...subPermissions];
});


export const getRequiredPermissionForPath = (path: string): string | null => {
    if (path.startsWith('/retirada-veiculo') || path.startsWith('/anexo-comprovante')) return null; // Public page
    if (path === '/dashboard' || path === '/dashboard/') return 'dashboard_view';
    if (path === '/dashboard/settings') return null; // All users can see their own settings
    if (path === '/dashboard/financeiro/despesas-individuais') return null;

    // Find the most specific submodule path match first
    for (const module of permissionStructure) {
        if (module.submodules) {
            for (const sub of module.submodules) {
                if (path.startsWith(sub.path)) {
                    return `${sub.id}_view`;
                }
            }
        }
    }
    
    // Then check top-level modules
    for (const module of permissionStructure) {
        if (path.startsWith(module.path)) {
            return `${module.id}_view`;
        }
    }

    return null;
};
