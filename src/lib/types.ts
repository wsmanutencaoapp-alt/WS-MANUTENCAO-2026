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
  id: string; // This is the Firestore document ID for new tools from forms.
  name: string;
  serialNumber: string;
  status: 'Available' | 'In Use' | 'In Calibration' | 'Disponível';
  lastCalibration: string;
  calibratedBy: string;
  imageUrl: string;
  imageHint: string;
  // Campos adicionados do app do usuário
  marca?: string;
  codigo?: string;
  unitCode?: string; // Lote sequencial por unidade
  enderecamento?: string;
  is_calibrable?: boolean;
  tipos?: 'Comuns' | 'Especiais' | 'GSEs' | string;
  aeronave_principal?: string | null;
  label_url?: string | null;
  quantidade_estoque?: number;
};

export type Permissions = {
  ferramentaria?: boolean;
  suprimentos?: boolean;
  compras?: boolean;
  financeiro?: boolean;
  configurador?: boolean;
  userManagement?: boolean;
  suprimentos_movimentacao?: boolean;
  ferramentaria_cadastro?: boolean;
  ferramentaria_movimentacao?: boolean;
  calibracao?: boolean;
  compras_aprovacoes?: boolean;
  compras_controle?: boolean;
  financeiro_visao-geral?: boolean;
  financeiro_orcamento?: boolean;
  financeiro_despesas?: boolean;
  'configurador_alcada-aprovacao'?: boolean;
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
