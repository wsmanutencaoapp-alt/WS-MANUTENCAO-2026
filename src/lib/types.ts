'use client';


export type Vehicle = {
  id?: string;
  prefixo: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  km: number;
  tipo: 'Carro' | 'Moto' | 'Caminhão' | 'Van' | 'Caminhonete' | 'Outro';
  status: 'Ativo' | 'Inativo' | 'Em Manutenção' | 'Em Viagem';
};

export type VehicleMovement = {
    id?: string;
    vehicleId?: string;
    vehiclePrefixo?: string;
    vehiclePlaca: string;
    driverName: string;
    driverPhotoUrl?: string;
    type: 'saida' | 'entrada';
    date: string; // ISO String
    km?: number;
    notes?: string;
    isExternal?: boolean;
};

export type Visit = {
  id?: string;
  name: string;
  documentNumber: string;
  company: string;
  personToVisit: string;
  reason: string;
  entryTimestamp: string; // ISO String
  exitTimestamp?: string; // ISO String
  status: 'Dentro' | 'Fora';
};

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
  localizacaoPadrao: string; 
  
  // Novos campos de conversão e peso
  unidadeSecundaria?: 'G' | 'ML' | 'CM' | 'MM'; // Grama, Mililitro, Centímetro, Milímetro
  fatorConversao?: number; // Ex: 1 UN = 1000 G
  pesoBruto?: number; // Peso total com embalagem, na unidade secundária

  // Anexos
  imageUrl?: string;
  documentoUrl?: string;
  valor_estimado?: number;
};

export type SupplyStock = {
    id?: string;
    loteInterno: string; // Lote gerado pelo sistema para cada entrada
    loteFornecedor?: string; // Lote informado pelo fornecedor (opcional)
    quantidade: number; // Quantidade na unidade de medida principal (ex: 1 UN)
    pesoLiquido?: number; // Quantidade atual na unidade secundária (ex: 850 G)
    localizacao: string; // Endereço físico deste lote
    dataEntrada: string; // ISO date string
    dataValidade?: string; // ISO date string
    custoUnitario?: number;
    status: 'Disponível' | 'Reservado' | 'Bloqueado';
    documentoUrl?: string; // URL do documento específico do lote (FISPQ, Certificado)
};

export type SupplyMovement = {
    id?: string;
    supplyId: string;
    supplyStockId: string; // Referência ao lote específico movimentado
    supplyCodigo: string;
    loteFornecedor?: string;
    type: 'entrada' | 'saida' | 'ajuste' | 'devolucao';
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
  compras_requisicao?: boolean;
  financeiro_visao_geral?: boolean;
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
  cadastros_fornecedores?: boolean;
  cadastros_veiculos?: boolean;
  cadastros_funcionarios?: boolean;
  cadastros_enderecos?: boolean;
  cadastros_centro_custo?: boolean;
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
  ferramentaria_kits?: boolean;
  ferramentaria_historico?: boolean;
  configurador_disparo_email?: boolean;
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
  date: string; // ISO String
  category: 'Alimentação' | 'Hospedagem' | 'Transporte' | 'Outros';
  otherCategoryDetail?: string;
  costCenterId: string;
  costCenterCode: string;
  paymentProofUrl: string;
  employeeId: string;
  employeeName: string;
};

export type Budget = {
    id?: string;
    costCenter: string;
    costCenterId?: string; // Add this to link to the CostCenter entity
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

export type CostCenter = {
    id: string;
    code: string;
    description: string;
    sector: string;
};

export type ApprovalTier = {
  id?: string;
  costCenterId: string;
  level: 1 | 2;
  approverId: string;
  approverName: string;
};

export type Quotation = {
  supplierId: string;
  supplierName: string;
  totalValue: number;
  deliveryTime: number; // in days
  paymentTerms: string;
  attachmentUrl?: string;
};

export type Delivery = {
  id: string;
  nfNumber: string;
  nfUrl: string;
  receivedAt: string; // ISO date string
  notes?: string;
  items: {
      itemId: string;
      itemName: string;
      quantityReceived: number;
  }[];
};


export type PurchaseRequisition = {
  id?: string;
  protocol: string;
  originalRequisitionId?: string; // Links an OC back to its original SC
  originalRequisitionProtocol?: string;
  requesterId: string;
  requesterName: string;
  costCenterId: string;
  neededByDate: string; // ISO date string
  type: 'Solicitação de Compra' | 'Ordem de Compra';
  status: 'Aberta' | 'Parcialmente Atendida' | 'Totalmente Atendida' | 'Cancelada' | 'Em Cotação' | 'Em Aprovação' | 'Aprovada' | 'Recusada' | 'Concluída' | 'Em Revisão' | 'Aguardando Entrega' | 'Recebimento Parcial' | 'Recebimento Concluído';
  rejectionReason?: string;
  createdAt: string; // ISO date string
  priority: 'Normal' | 'Média' | 'Urgente';
  purchaseReason: string;
  expensiveChoiceJustification?: string;
  purchaseOrderNotes?: string;
  lastSentToSupplierAt?: string;
  supplierId?: string;
  totalValue?: number;
  paymentTerms?: string;
  deliveries?: Delivery[];
};


export type PurchaseRequisitionItem = {
    id?: string;
    itemId: string; // ID of the Supply or Tool item
    itemType: 'supply' | 'tool';
    quantity: number;
    receivedQuantity?: number;
    estimatedPrice?: number;
    status: 'Pendente' | 'Em Cotação' | 'Cotado' | 'Recebido' | 'Cancelado';
    notes?: string;
    attachmentUrl?: string;
    quotations?: Quotation[];
    selectedQuotationIndex?: number;
};

export type Notification = {
    id?: string;
    userId: string;
    title: string;
    message: string;
    link: string;
    read: boolean;
    createdAt: string; // ISO date string
};

export type Supplier = {
    id?: string;
    name: string;
    cnpj: string;
    contactEmail: string;
    contactPhone?: string;
    segmento?: string;
    rating?: number;
};

export type EmailConfiguration = {
    id: string; // e.g. 'purchase_requisition'
    description: string;
    enabled: boolean;
    recipients: string[];
};

export type AppAppearance = {
  id?: string;
  loginBackgroundUrl?: string;
};
    

export type MaintenancePlan = {
  id?: string;
  vehicleId: string;
  serviceType: string;
  frequencyKm: number;
  lastServiceKm: number;
};

export type MaintenanceRecord = {
  id?: string;
  vehicleId: string;
  planId?: string;
  serviceType: string;
  date: string; // ISO String
  mileage: number;
  notes: string;
  cost?: number;
};
    
