/**
 * Bracelet color mapping by ticket type name.
 * TODO: replace with real colors from DB when decided.
 */

const PALETTE = [
  { label: 'Красный', hex: '#EF4444', bg: 'bg-red-500' },
  { label: 'Синий', hex: '#3B82F6', bg: 'bg-blue-500' },
  { label: 'Зелёный', hex: '#22C55E', bg: 'bg-green-500' },
  { label: 'Жёлтый', hex: '#EAB308', bg: 'bg-yellow-500' },
  { label: 'Фиолетовый', hex: '#A855F7', bg: 'bg-purple-500' },
  { label: 'Оранжевый', hex: '#F97316', bg: 'bg-orange-500' },
  { label: 'Розовый', hex: '#EC4899', bg: 'bg-pink-500' },
  { label: 'Голубой', hex: '#06B6D4', bg: 'bg-cyan-500' },
];

// Deterministic hash from string → same ticket type always gets same color
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getBraceletColor(ticketName: string): {
  label: string;
  hex: string;
  bg: string;
} {
  return PALETTE[hash(ticketName) % PALETTE.length];
}
