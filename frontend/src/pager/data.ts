import type { Backlight, PagerPreset } from './types';

export const MIN_ID_LENGTH = 2;
export const MAX_ID_LENGTH = 16;
export const MIN_PW_LENGTH = 4;
export const MAX_PW_LENGTH = 16;

export interface HomeMenuItem {
  key: 'send' | 'inbox' | 'requests' | 'friends' | 'logout';
  label: string;
}

export function getHomeMenu(): HomeMenuItem[] {
  return [
    { key: 'send', label: 'SEND MESSAGE' },
    { key: 'inbox', label: 'INBOX' },
    { key: 'requests', label: 'REQUESTS' },
    { key: 'friends', label: 'FRIENDS' },
    { key: 'logout', label: 'LOG OUT' },
  ];
}

export const PRESETS: PagerPreset[] = [
  { code: '0', meaning: '저는 당신의 0순위예요.' },
  { code: '0000', meaning: '당신은 나의 0순위.' },
  { code: '0000', meaning: '보고 싶다.' },
  { code: '0011', meaning: 'Good night kiss' },
  { code: '0024', meaning: '영원히 사랑해' },
  { code: '0027', meaning: '땡땡이 치자' },
  { code: '0049', meaning: '차에 문제가 생겼음' },
  { code: '0090', meaning: '가고 있는 중이다' },
  { code: '0093', meaning: '조금 늦어지겠다' },
  { code: '0124', meaning: '영원히 사랑해' },
  { code: '0179', meaning: '영원한 친구' },
  { code: '017942', meaning: '영원한 친구 사이' },
  { code: '01925', meaning: '당신은 아직도 날 사랑하나요' },
  { code: '0242', meaning: '연인 사이' },
  { code: '0279', meaning: '영원한 친구' },
  { code: '02825', meaning: '너 나 사랑해?' },
  { code: '03456', meaning: '네가 사모하는 마음 소용없어' },
  { code: '0402', meaning: '영원히 사랑해 영원히' },
  { code: '0404', meaning: '영원히 사랑해' },
  { code: '041004', meaning: '영원히 사랑해 넌 나만의 천사' },
  { code: '0437', meaning: '너 미쳤어' },
  { code: '045', meaning: '빵사와' },
  { code: '04527', meaning: '너는 나의 사랑하는 아내' },
  { code: '04535', meaning: '너 나 보고 싶어?' },
  { code: '04551', meaning: '난 너밖에 없어' },
  { code: '0456', meaning: '넌 내꺼' },
  { code: '04567', meaning: '넌 내 마누라' },
  { code: '045617', meaning: '넌 나의 산소' },
  { code: '045692', meaning: '넌 내가 가장 사랑하는 것' },
  { code: '0564335', meaning: '심심할 때 널 생각해' },
  { code: '0594184', meaning: '너와 나 한평생' },
  { code: '065', meaning: '용서해줘' },
  { code: '06537', meaning: '넌 내 화를 북돋았어' },
  { code: '07209', meaning: '땡칠이 영구' },
  { code: '07382', meaning: '넌 비겁해' },
  { code: '075', meaning: '아직 가' },
  { code: '0750', meaning: '아직 가지마' },
  { code: '08056', meaning: '네가 나랑 안 놀아주잖아' },
  { code: '0837', meaning: '화내지 마' },
  { code: '0909', meaning: '모든 것이 취소됐다' },
  { code: '0920', meaning: '볼링장 가자' },
  { code: '0925', meaning: '볼링장 가자' },
  { code: '095', meaning: '나 찾아봐' },
  { code: '098', meaning: '꺼져' },
  { code: '100', meaning: '돌아와 (BACK)' },
  { code: '1004', meaning: '천사' },
  { code: '1008', meaning: '나 지금 고민스러워' },
  { code: '100003', meaning: '만세' },
  { code: '100024', meaning: '많이 사랑해' },
  { code: '1010235', meaning: '열렬히 사모해' },
  { code: '10288', meaning: '열이 펄펄 / 아파' },
  { code: '1052', meaning: '사랑해' },
  { code: '108', meaning: '괴롭다. 고민 중이다' },
  { code: '108108', meaning: '나 지금 고민스러워' },
  { code: '11', meaning: '나란히 있고 싶어요' },
  { code: '11010', meaning: '흥!' },
  { code: '1111', meaning: '비상사태' },
  { code: '112', meaning: '긴급상황' },
  { code: '113', meaning: '전화해' },
  { code: '1142', meaning: '전화하지 마' },
  { code: '11555', meaning: '이리로 와요' },
  { code: '1177155400', meaning: '당신이 그리워요' },
  { code: '1200', meaning: '지금 바빠' },
  { code: '1212', meaning: '술이 먹고 싶어' },
  { code: '1213', meaning: '오늘 숙직' },
  { code: '1255', meaning: '내가 있는 곳으로 오시오' },
  { code: '12535', meaning: '이리 오세요' },
  { code: '1283', meaning: '일이 발생' },
  { code: '129129', meaning: '낮잠을 자지 마세요' },
  { code: '1350', meaning: '너 없이는 못 살겠다' },
  { code: '13579', meaning: '정말 이상하다' },
  { code: '1414', meaning: '식사나 함께 합시다' },
  { code: '1472', meaning: '일이 잘되고 있다' },
  { code: '1717', meaning: '일찍 오세요' },
  { code: '175', meaning: '일찍 와' },
  { code: '230', meaning: '이상무' },
  { code: '4040', meaning: '보고 싶다' },
  { code: '4545', meaning: '사랑사랑' },
  { code: '486', meaning: '사랑해' },
  { code: '505', meaning: 'SOS' },
  { code: '515', meaning: '오 이런' },
  { code: '520', meaning: '사랑해' },
  { code: '5200', meaning: '오늘은 잊을 수 없는 날이다' },
  { code: '5233', meaning: '미안해요' },
  { code: '5404', meaning: '오빠 사랑해' },
  { code: '555555', meaning: '호~~~~' },
  { code: '5825', meaning: '일이 잘못됐다' },
  { code: '5842', meaning: '오빠와 동생 사이' },
  { code: '5875', meaning: '오빠 싫어' },
  { code: '7142', meaning: '천사 사이' },
  { code: '7179', meaning: '친한 친구' },
  { code: '7474', meaning: '죽도록 사랑해' },
  { code: '7676', meaning: '착륙착륙' },
  { code: '79337', meaning: '친구야 힘내' },
  { code: '7942', meaning: '친구사이' },
  { code: '825', meaning: '빨리 와' },
  { code: '8282', meaning: '빨리빨리' },
  { code: '8888', meaning: 'Bye Bye' },
  { code: '9090', meaning: '고고 GOGO' },
  { code: '9191', meaning: '구해 달라' },
  { code: '929', meaning: '그리고' },
  { code: '9413', meaning: '구사일생' },
  { code: '982', meaning: 'Goodbye' },
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
