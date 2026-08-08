import type { Backlight, PagerPreset } from './types';

export const MIN_ID_LENGTH = 2;
export const MAX_ID_LENGTH = 16;
export const MIN_PW_LENGTH = 4;
export const MAX_PW_LENGTH = 16;

export interface HomeMenuItem {
  key: 'send' | 'inbox' | 'requests' | 'logout';
  label: string;
}

export function getHomeMenu(): HomeMenuItem[] {
  return [
    { key: 'send', label: 'SEND MESSAGE' },
    { key: 'inbox', label: 'INBOX' },
    { key: 'requests', label: 'REQUESTS' },
    { key: 'logout', label: 'LOG OUT' },
  ];
}

export const PRESETS: PagerPreset[] = [
  { code: '0404', meaning: '영원히 사랑해' },
  { code: '045', meaning: '빵사와' },
  { code: '07209', meaning: '땡칠이 영구' },
  { code: '0909', meaning: '모든것이 취소됐다' },
  { code: '0929', meaning: '볼링장 가자' },
  { code: '100', meaning: '돌아와 (BACK)' },
  { code: '100003', meaning: '만세' },
  { code: '1000024', meaning: '만이 사랑해' },
  { code: '1008', meaning: '난 지금 고민스러워' },
  { code: '1010235', meaning: '열렬히 사모해' },
  { code: '1052', meaning: '사랑해' },
  { code: '108', meaning: '괴롭다, 고민 중이다' },
  { code: '11', meaning: '나란히 있고 싶어요' },
  { code: '11010', meaning: '흥!' },
  { code: '112', meaning: '긴급상황' },
  { code: '1142', meaning: '전화하지마' },
  { code: '11555', meaning: '이리로 와요' },
  { code: '1255', meaning: '내가 있는 곳으로 오시오' },
  { code: '1350', meaning: '너없이는 못살겠다' },
  { code: '1414', meaning: '식사나 함께 합시다' },
  { code: '1472', meaning: '일이 잘되고 있다' },
  { code: '1717', meaning: '일찍 오세요' },
  { code: '175', meaning: '일찍와' },
  { code: '1750', meaning: '일찍오렴' },
];

export const BACKLIGHT_PALETTES: Record<
  Backlight,
  { bg: string; bg2: string; glow: string; ink: string }
> = {
  ice: { bg: '#e6f1fb', bg2: '#a9cdec', glow: 'rgba(150,200,255,.7)', ink: '#0b2138' },
  green: { bg: '#5cd21a', bg2: '#3fa310', glow: 'rgba(120,230,40,.5)', ink: '#0a2600' },
  amber: { bg: '#e0a72a', bg2: '#b07d15', glow: 'rgba(235,180,70,.5)', ink: '#2a1a00' },
  blue: { bg: '#54b7d8', bg2: '#2f86a8', glow: 'rgba(110,190,225,.5)', ink: '#062030' },
};

export const OFF_PALETTE = {
  bg: '#0e2205',
  bg2: '#081603',
  glow: 'rgba(40,90,20,.25)',
  ink: 'rgba(120,180,60,.22)',
};

export function filterPresets(query: string): PagerPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return PRESETS;
  return PRESETS.filter(
    (p) => p.code.includes(q) || p.meaning.toLowerCase().includes(q),
  );
}
