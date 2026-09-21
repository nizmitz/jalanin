export interface GageProps {
  id: string;
  name: string;
  group: 'spine' | 'west' | 'ring' | 'central';
  note?: string;
}

export interface TransitLineProps {
  ref: string;
  name: string;
  colour: string;
  network: string;
  operator?: string;
  data_as_of: string;
}

export interface TransitStationProps {
  name: string;
  network: string;
  lines: string[];
}
