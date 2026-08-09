export type Phase =
  | 'off'
  | 'authChoice'
  | 'createId'
  | 'loginId'
  | 'createPw'
  | 'confirmPw'
  | 'login'
  | 'composeId'
  | 'home'
  | 'pickMsg'
  | 'confirm'
  | 'sent'
  | 'inbox'
  | 'message'
  | 'requests'
  | 'requestDetail'
  | 'friends';

export type Backlight = 'ice' | 'green' | 'amber' | 'blue';

export interface PagerPreset {
  code: string;
  meaning: string;
}

export interface PagerMessage {
  id: number;
  from: string;
  time: string;
  text: string;
  read: boolean;
}
