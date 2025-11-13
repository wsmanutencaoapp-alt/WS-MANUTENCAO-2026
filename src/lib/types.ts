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
  name: string;
  serialNumber: string;
  status: 'Available' | 'In Use' | 'In Calibration';
  lastCalibration: string;
  calibratedBy: string;
  imageUrl: string;
  imageHint: string;
};
