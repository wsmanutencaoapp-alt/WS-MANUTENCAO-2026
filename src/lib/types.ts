export type Supply = {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  unit: 'units' | 'liters' | 'kg';
  category: 'Avionics' | 'Mechanical' | 'Consumables' | 'Structural';
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  imageUrl: string;
  imageHint: string;
};

export type Tool = {
  id: string;
  codigo: string;
  tipo: 'STD' | 'ESP' | 'GSE' | 'EQV';
  familia: 'MEC' | 'TRQ' | 'PRE' | 'ELE' | 'RIG' | 'MET' | 'SEG';
  classificacao: 'N' | 'C' | 'L' | 'V';
  sequencial: number;
  descricao: string;
  marca?: string;
  enderecamento?: string;
  pn_fabricante?: string;
  pn_referencia?: string;
  aeronave_aplicavel?: string;
  doc_engenharia_url?: string;
  doc_seguranca_url?: string;
  patrimonio?: string;
  status: 'Disponível' | 'Em Empréstimo' | 'Em Aferição' | 'Em Manutenção' | 'Vencido' | 'Bloqueado' | 'Inoperante' | 'Pendente';
  status_inicial?: 'Ativo' | 'Bloqueado';
  data_vencimento?: string; // date
  data_referencia?: string; // date
  documento_anexo_url?: string;
  label_url?: string;
  imageUrl?: string;
};


export type Permissions = {
  ferramentaria?: boolean;
  suprimentos?: boolean;
  compras?: boolean;
  financeiro?: boolean;
  configurador?: boolean;
  userManagement?: boolean;
  suprimentos_movimentacao?: boolean;
  ferramentaria_lista?: boolean;
  ferramentaria_movimentacao?: boolean;
  calibracao?: boolean;
  compras_aprovacoes?: boolean;
  compras_controle?: boolean;
  financeiro_visao-geral?: boolean;
  financeiro_orcamento?: boolean;
  financeiro_despesas?: boolean;
  contabilidade?: boolean;
  contabilidade_balancete?: boolean;
  contabilidade_relatorios?: boolean;
  'configurador_alcada-aprovacao'?: boolean;
  cadastros?: boolean;
  cadastros_ferramentas?: boolean;
  [key: string]: boolean | undefined;
};


export type Employee = {
  id: number;
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  accessLevel: 'Admin' | 'Técnico' | string;
  photoURL?: string | null;
  permissions?: Permissions;
};

export type Despesa = {
  id?: string;
  description: string;
  amount: number;
  date: string;
  category: 'Suprimentos' | 'Manutenção' | 'Administrativo' | 'Outros';
  paymentProofUrl: string;
  employeeId: string;
  employeeName: string;
};
