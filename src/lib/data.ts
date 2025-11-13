import type { Supply, Tool } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getImage = (id: string) => {
  const image = PlaceHolderImages.find(img => img.id === id);
  if (!image) {
    return { imageUrl: "https://picsum.photos/seed/default/300/200", imageHint: "placeholder" };
  }
  return { imageUrl: image.imageUrl, imageHint: image.imageHint };
};

export const supplies: Supply[] = [
  {
    id: 'S001',
    name: 'AN365-1032A Nylon Insert Lock Nut',
    partNumber: 'AN365-1032A',
    quantity: 5000,
    unit: 'units',
    category: 'Structural',
    status: 'In Stock',
    ...getImage('rivets'),
  },
  {
    id: 'S002',
    name: 'Skydrol 500B-4 Hydraulic Fluid',
    partNumber: 'SKY500B4',
    quantity: 50,
    unit: 'liters',
    category: 'Consumables',
    status: 'In Stock',
    ...getImage('hydraulic-fluid'),
  },
  {
    id: 'S003',
    name: 'Garmin GDU 1060 Display',
    partNumber: '010-01326-01',
    quantity: 8,
    unit: 'units',
    category: 'Avionics',
    status: 'In Stock',
    ...getImage('avionics-display'),
  },
  {
    id: 'S004',
    name: 'MS24693C Phillips Head Screw',
    partNumber: 'MS24693C',
    quantity: 250,
    unit: 'units',
    category: 'Structural',
    status: 'Low Stock',
    ...getImage('rivets'),
  },
  {
    id: 'S005',
    name: 'AeroShell Grease 33',
    partNumber: 'ASG33',
    quantity: 15,
    unit: 'kg',
    category: 'Consumables',
    status: 'Out of Stock',
    ...getImage('hydraulic-fluid'),
  },
  {
    id: 'S006',
    name: 'Boeing 737 Landing Gear Assembly',
    partNumber: 'BG-737-LG-ASSY',
    quantity: 1,
    unit: 'units',
    category: 'Mechanical',
    status: 'Low Stock',
    ...getImage('landing-gear'),
  },
];

export const tools: Tool[] = [
  {
    id: 'T001',
    name: 'CDI Torque Wrench 2503MFRMH',
    serialNumber: 'SN-TW-1023',
    status: 'Available',
    lastCalibration: '2024-05-01',
    calibratedBy: 'John Doe',
    ...getImage('wrench'),
  },
  {
    id: 'T002',
    name: 'Fluke 87V Digital Multimeter',
    serialNumber: 'SN-MM-4567',
    status: 'In Use',
    lastCalibration: '2024-03-15',
    calibratedBy: 'Jane Smith',
    ...getImage('multimeter'),
  },
  {
    id: 'T003',
    name: 'Aircraft Jack - 12 Ton',
    serialNumber: 'SN-JK-8901',
    status: 'In Calibration',
    lastCalibration: '2023-12-10',
    calibratedBy: 'Calibration Inc.',
    ...getImage('landing-gear'),
  },
  {
    id: 'T004',
    name: 'Rivet Gun - Pneumatic',
    serialNumber: 'SN-RG-2345',
    status: 'Available',
    lastCalibration: 'N/A',
    calibratedBy: 'N/A',
    ...getImage('rivets'),
  },
];

export const reorderThresholds = {
  'MS24693C Phillips Head Screw': 500,
  'AeroShell Grease 33': 20,
  'Boeing 737 Landing Gear Assembly': 2,
};
