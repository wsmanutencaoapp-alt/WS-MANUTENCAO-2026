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
  codigo?: string;
  unitCode?: string; // Lote sequencial por unidade
  enderecamento?: string;
  is_calibrable?: boolean;
  aeronave_principal?: string | null;
  label_url?: string | null;
  quantidade_estoque?: number;
};

export type Permissions = {
  [key: string]: boolean;
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

    