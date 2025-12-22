export const allUserPermissions: { id: string; path: string, isModule?: boolean }[] = [
    { id: 'dashboard', path: '/dashboard', isModule: true },
    { id: 'suprimentos', path: '/dashboard/suprimentos', isModule: true },
    { id: 'ferramentaria', path: '/dashboard/ferramentaria', isModule: true },
    { id: 'calibracao', path: '/dashboard/calibracao', isModule: false }, // Part of ferramentaria
    { id: 'cadastros', path: '/dashboard/cadastros', isModule: true },
    { id: 'compras', path: '/dashboard/compras', isModule: true },
    { id: 'engenharia', path: '/dashboard/engenharia', isModule: true },
    { id: 'comercial', path: '/dashboard/comercial', isModule: true },
    { id: 'financeiro', path: '/dashboard/financeiro', isModule: true },
    { id: 'contabilidade', path: '/dashboard/contabilidade', isModule: true },
    { id: 'qualidade', path: '/dashboard/qualidade', isModule: true },
    { id: 'gso', path: '/dashboard/gso', isModule: true },
    { id: 'planejamento', path: '/dashboard/planejamento', isModule: true },
    { id: 'manutencao', path: '/dashboard/manutencao', isModule: true },
    { id: 'userManagement', path: '/dashboard/user-management', isModule: true },
    { id: 'configurador', path: '/dashboard/configurador', isModule: true },
];

export const getRequiredPermissionForPath = (path: string): string | null => {
    // A rota /dashboard/ferramentaria é um alias, então tratamos como /lista-ferramentas
    if (path === '/dashboard/ferramentaria') {
        path = '/dashboard/ferramentaria/lista-ferramentas';
    }
    // A rota /dashboard é a página principal e deve ser acessível se o usuário estiver logado.
    if (path === '/dashboard') {
        return 'dashboard';
    }
    const matchingPermission = allUserPermissions.find(p => path.startsWith(p.path));
    return matchingPermission ? matchingPermission.id : null;
};


/**
 * Finds the required top-level module permission for a given URL path.
 * @param path The URL path to check (e.g., /dashboard/ferramentaria/movimentacao).
 * @returns The permission ID of the parent module (e.g., 'ferramentaria') or null.
 */
export const getModulePermissionForPath = (path: string): string | null => {
    // Split the path into segments
    const segments = path.split('/').filter(Boolean); // "dashboard", "ferramentaria", "movimentacao"

    if (segments.length < 2) {
        // Not a sub-page of the dashboard, or the dashboard itself
        return null;
    }

    // The module name is typically the second segment
    const moduleName = segments[1];

    // Find the corresponding permission ID from the list
    const modulePermission = allUserPermissions.find(p => p.isModule && p.path === `/dashboard/${moduleName}`);

    return modulePermission ? modulePermission.id : null;
};
