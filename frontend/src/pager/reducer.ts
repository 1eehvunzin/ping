import { MAX_ID_LENGTH, MAX_PW_LENGTH, MIN_ID_LENGTH, MIN_PW_LENGTH, filterPresets, getHomeMenu } from './data';
import type { PagerMessage, Phase } from './types';

export interface PagerState {
  phase: Phase;
  hasId: boolean;
  myId: string;
  hasPw: boolean;
  pendingPw: string;
  entryText: string;
  entryError: boolean;
  busy: boolean;
  apiError: string | null;
  authSel: number;
  menuSel: number;
  toId: string;
  isReply: boolean;
  presetSel: number;
  searchText: string;
  sentText: string;
  sentMeaning: string;
  sel: number;
  reqSel: number;
  msgs: PagerMessage[];
  requests: PagerMessage[];
  msgsLoaded: boolean;
  friends: string[];
  friendSel: number;
}

export const initialPagerState: PagerState = {
  phase: 'off',
  hasId: false,
  myId: '',
  hasPw: false,
  pendingPw: '',
  entryText: '',
  entryError: false,
  busy: false,
  apiError: null,
  authSel: 0,
  menuSel: 0,
  toId: '',
  isReply: false,
  presetSel: 0,
  searchText: '',
  sentText: '',
  sentMeaning: '',
  sel: 0,
  reqSel: 0,
  msgs: [],
  requests: [],
  msgsLoaded: false,
  friends: [],
  friendSel: 0,
};

export type PagerAction =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'OK' }
  | { type: 'PRESET_PREV' }
  | { type: 'SET_ENTRY_TEXT'; text: string }
  | { type: 'SET_SEARCH_TEXT'; text: string }
  | { type: 'BUSY_START' }
  | { type: 'PW_MISMATCH' }
  | { type: 'ID_EXISTS'; myId: string }
  | { type: 'ID_NEW'; myId: string }
  | { type: 'LOGOUT' }
  | { type: 'AUTH_SUCCESS'; myId: string }
  | { type: 'AUTH_FAILED'; message: string }
  | { type: 'SESSION_INVALID'; message: string }
  | { type: 'SEND_SUCCESS' }
  | { type: 'SEND_FAILED'; message: string }
  | { type: 'REQUEST_APPROVED' }
  | { type: 'REQUEST_DECLINED' }
  | { type: 'API_ERROR'; message: string }
  | { type: 'API_ERROR_CLEAR' }
  | { type: 'MESSAGES_UPDATED'; msgs: PagerMessage[]; requests: PagerMessage[]; friends: string[] };

const PW_PHASES: ReadonlySet<Phase> = new Set(['createPw', 'confirmPw', 'login']);

function sanitizeText(raw: string, maxLen: number): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLen);
}

export function pagerReducer(state: PagerState, action: PagerAction): PagerState {
  switch (action.type) {
    case 'NEXT': {
      switch (state.phase) {
        case 'authChoice':
          return { ...state, authSel: (state.authSel + 1) % 2 };
        case 'home': {
          const menu = getHomeMenu();
          const menuSel = Math.min(state.menuSel, menu.length - 1);
          return { ...state, menuSel: (menuSel + 1) % menu.length };
        }
        case 'pickMsg': {
          const n = filterPresets(state.searchText).length;
          return n ? { ...state, presetSel: (state.presetSel + 1) % n } : state;
        }
        case 'inbox':
          return { ...state, sel: (state.sel + 1) % Math.max(1, state.msgs.length) };
        case 'message': {
          if (!state.msgs.length) return state;
          const n = (state.sel + 1) % state.msgs.length;
          return {
            ...state,
            sel: n,
            msgs: state.msgs.map((m, idx) => (idx === n ? { ...m, read: true } : m)),
          };
        }
        case 'requests':
          return { ...state, reqSel: (state.reqSel + 1) % Math.max(1, state.requests.length) };
        case 'friends':
          return { ...state, friendSel: (state.friendSel + 1) % Math.max(1, state.friends.length) };
        default:
          return state;
      }
    }

    case 'BACK': {
      switch (state.phase) {
        case 'authChoice':
          return { ...state, phase: 'off', authSel: 0 };
        case 'createId':
        case 'loginId':
          if (state.entryText.length > 0) {
            return { ...state, entryText: state.entryText.slice(0, -1) };
          }
          return { ...state, phase: 'authChoice', entryText: '' };
        case 'composeId':
          if (state.entryText.length > 0) {
            return { ...state, entryText: state.entryText.slice(0, -1) };
          }
          return { ...state, phase: 'home' };
        case 'createPw':
          if (state.entryText.length > 0) {
            return { ...state, entryText: state.entryText.slice(0, -1) };
          }
          // Empty + back: bail out to off. Powering back on resumes at the right
          // step either way (createPw if setup was interrupted, login otherwise).
          return { ...state, phase: 'off' };
        case 'confirmPw':
          if (state.entryText.length > 0) {
            return { ...state, entryText: state.entryText.slice(0, -1) };
          }
          return { ...state, phase: 'createPw', pendingPw: '', entryError: false };
        case 'login':
          if (state.entryText.length > 0) {
            return { ...state, entryText: state.entryText.slice(0, -1) };
          }
          return { ...state, phase: 'off', entryError: false };
        case 'pickMsg':
          return { ...state, phase: state.isReply ? 'message' : 'composeId', isReply: false };
        case 'home':
          return { ...state, phase: 'off' };
        case 'inbox':
          return { ...state, phase: 'home' };
        case 'message':
          return { ...state, phase: 'inbox' };
        case 'confirm':
          return { ...state, phase: 'pickMsg' };
        case 'requests':
          return { ...state, phase: 'home', menuSel: 0 };
        case 'friends':
          return { ...state, phase: 'home', menuSel: 0 };
        // 'requestDetail' BACK (decline) is handled by the component, since it
        // requires a server round-trip; see REQUEST_DECLINED.
        default:
          return state;
      }
    }

    case 'OK': {
      switch (state.phase) {
        case 'off': {
          if (!state.hasId) return { ...state, phase: 'authChoice', entryText: '', authSel: 0 };
          if (!state.hasPw) return { ...state, phase: 'createPw', entryText: '' };
          return { ...state, phase: 'login', entryText: '', entryError: false };
        }
        case 'authChoice':
          return state.authSel === 0
            ? { ...state, phase: 'createId', entryText: '' }
            : { ...state, phase: 'loginId', entryText: '' };
        // 'createId' and 'loginId' OK are handled by the component: it must
        // check the server for whether the typed ID exists before deciding
        // whether to proceed (ID taken / not found are both errors here,
        // since the user already chose sign-up vs log-in) — see
        // ID_EXISTS / ID_NEW / API_ERROR.
        case 'createPw': {
          if (state.entryText.length < MIN_PW_LENGTH) return state;
          return { ...state, pendingPw: state.entryText, entryText: '', phase: 'confirmPw' };
        }
        // 'confirmPw' and 'login' OK are handled by the component: matching
        // passwords / credentials must be confirmed against the server before
        // the phase advances (see AUTH_SUCCESS / AUTH_FAILED / PW_MISMATCH).
        case 'composeId': {
          if (state.entryText.length < MIN_ID_LENGTH) return state;
          return {
            ...state,
            toId: state.entryText,
            phase: 'pickMsg',
            presetSel: 0,
            isReply: false,
            searchText: '',
          };
        }
        case 'home': {
          const menu = getHomeMenu();
          const menuSel = Math.min(state.menuSel, menu.length - 1);
          const key = menu[menuSel].key;
          if (key === 'send') return { ...state, phase: 'composeId', entryText: '' };
          if (key === 'requests') return { ...state, phase: 'requests', reqSel: 0 };
          if (key === 'friends') return { ...state, phase: 'friends', friendSel: 0 };
          // 'logout' is handled by the component: it clears the saved session
          // before dispatching LOGOUT (see below).
          return { ...state, phase: 'inbox', sel: 0 };
        }
        case 'pickMsg': {
          const list = filterPresets(state.searchText);
          const pm = list[state.presetSel];
          if (!pm) return state;
          return { ...state, phase: 'confirm', sentText: pm.code, sentMeaning: pm.meaning };
        }
        // 'confirm' OK (send) is handled by the component: it sends the message
        // to the server before advancing to 'sent' (see SEND_SUCCESS / SEND_FAILED).
        case 'sent':
          return { ...state, phase: 'home', menuSel: 0 };
        case 'inbox': {
          const cur = state.msgs[state.sel];
          if (!cur) return state;
          return {
            ...state,
            phase: 'message',
            msgs: state.msgs.map((m, idx) => (idx === state.sel ? { ...m, read: true } : m)),
          };
        }
        case 'message': {
          const cur = state.msgs[state.sel];
          if (!cur) return state;
          return {
            ...state,
            phase: 'pickMsg',
            toId: cur.from,
            presetSel: 0,
            isReply: true,
            searchText: '',
          };
        }
        case 'requests': {
          const cur = state.requests[state.reqSel];
          if (!cur) return state;
          return { ...state, phase: 'requestDetail' };
        }
        // 'requestDetail' OK (approve) is handled by the component; see REQUEST_APPROVED.
        default:
          return state;
      }
    }

    case 'PRESET_PREV': {
      const n = filterPresets(state.searchText).length;
      if (!n) return state;
      return { ...state, presetSel: (state.presetSel - 1 + n) % n };
    }

    case 'SET_ENTRY_TEXT': {
      const maxLen = PW_PHASES.has(state.phase) ? MAX_PW_LENGTH : MAX_ID_LENGTH;
      return { ...state, entryText: sanitizeText(action.text, maxLen), entryError: false, apiError: null };
    }

    case 'SET_SEARCH_TEXT':
      return { ...state, searchText: action.text, presetSel: 0 };

    case 'BUSY_START':
      return { ...state, busy: true, apiError: null };

    case 'PW_MISMATCH':
      return { ...state, busy: false, entryText: '', entryError: true };

    case 'ID_EXISTS':
      return {
        ...state,
        busy: false,
        myId: action.myId,
        hasId: true,
        hasPw: true,
        phase: 'login',
        entryText: '',
        entryError: false,
      };

    case 'ID_NEW':
      return {
        ...state,
        busy: false,
        myId: action.myId,
        hasId: true,
        phase: 'createPw',
        entryText: '',
      };

    case 'LOGOUT':
      return { ...initialPagerState, phase: 'authChoice' };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        busy: false,
        myId: action.myId,
        hasId: true,
        hasPw: true,
        pendingPw: '',
        entryText: '',
        entryError: false,
        phase: 'home',
        menuSel: 0,
        msgsLoaded: false,
      };

    case 'AUTH_FAILED':
      return { ...state, busy: false, apiError: action.message };

    case 'SESSION_INVALID':
      return {
        ...initialPagerState,
        phase: 'off',
        apiError: action.message,
      };

    case 'SEND_SUCCESS':
      return { ...state, busy: false, phase: 'sent' };

    case 'SEND_FAILED':
      return { ...state, busy: false, apiError: action.message };

    case 'REQUEST_APPROVED': {
      const approved = state.requests[state.reqSel];
      if (!approved) return { ...state, busy: false, phase: 'requests' };
      const friends = state.friends.includes(approved.from)
        ? state.friends
        : [...state.friends, approved.from].sort();
      return {
        ...state,
        busy: false,
        requests: state.requests.filter((_, idx) => idx !== state.reqSel),
        msgs: [{ ...approved, read: false }, ...state.msgs].slice(0, 9),
        friends,
        reqSel: 0,
        phase: 'requests',
      };
    }

    case 'REQUEST_DECLINED':
      return {
        ...state,
        busy: false,
        requests: state.requests.filter((_, idx) => idx !== state.reqSel),
        reqSel: 0,
        phase: 'requests',
      };

    case 'API_ERROR':
      return { ...state, busy: false, apiError: action.message };

    case 'API_ERROR_CLEAR':
      return { ...state, apiError: null };

    case 'MESSAGES_UPDATED':
      return { ...state, msgs: action.msgs, requests: action.requests, friends: action.friends, msgsLoaded: true };

    default:
      return state;
  }
}
