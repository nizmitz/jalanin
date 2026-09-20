export interface GageProps {
  id: string;
  name: string;
  group: 'spine' | 'west' | 'ring' | 'central';
  note?: string;
}
