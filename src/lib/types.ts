

export type Supply = {
  id?: string;
  // Identificação
  codigo: string; // Gerado automaticamente
  descricao: string;
  partNumber: string;
  unidadeMedida: 'UN' | 'KG' | 'MT' | 'LT' | 'CX';
  familia: 'MP' | 'CT' | 'CG' | 'CP' | 'PA';
  
  // Rastreabilidade
  exigeLote: boolean;
  exigeSerialNumber: boolean;
  exigeValidade: boolean;
  
  // Dados específicos da família
  tipoMaterial?: 'Metal' | 'Polímero' | 'Tecido' | 'Outro'; // Para MP
  
  // Parâmetros de Estoque
  estoqueMinimo: number;
  estoqueMaximo: number;
  localizacaoPadrao: string; // Mantido como sugestão
  
  // Dados de controle (agora calculados a partir do supply_stock)
  saldoAtual?: number; // Este será um campo calculado/agregado
  
  // Imagem
  imageUrl?: string;
};

export type SupplyStock = {
    id?: string;
    loteInterno: string; // Lote gerado pelo sistema para cada entrada
    loteFornecedor?: string; // Lote informado pelo fornecedor (opcional)
    quantidade: number;
    localizacao: string; // Endereço físico deste lote
    dataEntrada: string; // ISO date string
    dataValidade?: string; // ISO date string
    custoUnitario?: number;
    status: 'Disponível' | 'Reservado' | 'Bloqueado';
};

export type SupplyMovement = {
    id?: string;
    supplyId: string;
    supplyStockId: string; // Referência ao lote específico movimentado
    supplyCodigo: string;
    loteFornecedor?: string;
    type: 'entrada' | 'saida' | 'ajuste';
    quantity: number;
    responsibleId: string;
    responsibleName: string;
    date: string; // ISO date string
    origin?: string; // Ex: "OC-123", "NF-456"
    destination?: string; // Ex: "OS-123", "CC-MANUTENCAO"
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
  status: 'Disponível' | 'Em Empréstimo' | 'Em Aferição' | 'Em Manutenção' | 'Vencido' | 'Bloqueado' | 'Inoperante' | 'Pendente' | 'Em Kit' | 'Em Conserto' | 'Refugo' | 'Com Avaria' | 'Liberado Condicional';
  status_inicial?: 'Ativo' | 'Bloqueado';
  data_vencimento?: string; // date
  data_referencia?: string; // date
  documento_anexo_url?: string;
  label_url?: string;
  imageUrl?: string;
  natureza_item?: string;
  classificacao_contabil?: string;
  valor_estimado?: number;
  observacao?: string;
  observacao_condicional?: string;
  data_descarte?: string; // ISO date string
  motivo_descarte?: string;
};

export type Kit = {
  id?: string;
  codigo: string;
  descricao: string;
  toolIds: string[];
  createdAt: string;
  enderecamento: string;
  status: 'Disponível' | 'Em Empréstimo';
  // Kits não têm os mesmos campos que ferramentas, mas adicionamos os necessários para a lista
  tipo: 'KIT'; 
  imageUrl?: string;
};

export type CalibrationRecord = {
  id?: string;
  toolId: string;
  calibrationDate: string; // date
  dueDate: string; // date
  certificateUrl: string;
  calibratedBy: string; // employeeId or external company name
  timestamp: string; // ISO date string of when the record was created
};

export type InspectionResult = {
  visual: 'ok' | 'nok';
  funcional: 'ok' | 'nok';
  observacao: string;
};

export type ToolRequest = {
  id?: string;
  osNumber: string;
  requesterId: string;
  requesterName: string;
  status: 'Pendente' | 'Em Uso' | 'Devolvida' | 'Cancelada';
  requestedAt: string; // ISO date string
  dueDate?: string; // ISO date string
  toolIds: string[];
  handledBy?: string; // UID of ferramentaria user
  handledAt?: string; // ISO date string
  returnedAt?: string; // ISO date string
  returnConditions?: Record<string, InspectionResult>; // toolId -> inspection data
};

export type Permissions = {
  dashboard?: boolean;
  ferramentaria?: boolean;
  suprimentos?: boolean;
  compras?: boolean;
  financeiro?: boolean;
  configurador?: boolean;
  userManagement?: boolean;
  suprimentos_lista?: boolean;
  suprimentos_movimentacao?: boolean;
  ferramentaria_lista?: boolean;
  ferramentaria_movimentacao?: boolean;
  calibracao?: boolean;
  compras_aprovacoes?: boolean;
  compras_controle?: boolean;
  financeiro_visao-geral?: boolean;
  financeiro_orcamento?: boolean;
  financeiro_budget?: boolean;
  financeiro_despesas?: boolean;
  contabilidade?: boolean;
  contabilidade_balancete?: boolean;
  contabilidade_relatorios?: boolean;
  'configurador_alcada-aprovacao'?: boolean;
  cadastros?: boolean;
  cadastros_ferramentas?: boolean;
  cadastros_suprimentos?: boolean;
  cadastros_enderecos?: boolean;
  engenharia?: boolean;
  engenharia_aprovacoes?: boolean;
  engenharia_projetos?: boolean;
  comercial?: boolean;
  qualidade?: boolean;
  gso?: boolean;
  planejamento?: boolean;
  manutencao?: boolean;
  contabilidade_classificacao?: boolean;
  suprimentos_controle_almoxarifado?: boolean;
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
  status: 'Ativo' | 'Pendente' | 'Inativo';
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

export type Budget = {
    id?: string;
    costCenter: string;
    sector: string;
    totalAmount: number;
    spentAmount: number;
    period: string; // YYYY-MM
};

export type Address = {
  id?: string;
  unidade: string;
  setor: string;
  rua: string;
  movel: string;
  nivel: string;
  detalhe?: string;
  codigoCompleto: string;
  createdAt: string; // ISO date string
};

    