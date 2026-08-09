import { useEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { toPng } from 'html-to-image';
import { ApiError, approveRequest, declineRequest, getAccount, getInbox, getRequests, login, markRead, register, sendMessage } from './api';
import { BACKLIGHT_PALETTES, MAX_ID_LENGTH, MAX_PW_LENGTH, MIN_ID_LENGTH, MIN_PW_LENGTH, OFF_PALETTE, PRESETS, filterPresets, getHomeMenu } from './data';
import { initialPagerState, pagerReducer, type PagerState } from './reducer';
import { clearSession, loadSession, saveSession } from './session';
import type { Backlight, Phase } from './types';
import { useDeviceScale } from './useDeviceScale';
import './PagerDevice.css';

interface PagerDeviceProps {
  backlight?: Backlight;
}

const DEVICE_WIDTH = 720;
const DEVICE_HEIGHT = 560;
const STAGE_MARGIN = 24;
const POLL_INTERVAL_MS = 4000;

const PW_PHASES: ReadonlySet<Phase> = new Set(['createPw', 'confirmPw', 'login']);
const ENTRY_PHASES: ReadonlySet<Phase> = new Set(['createId', 'loginId', 'composeId', 'createPw', 'confirmPw', 'login']);
// Phases before the user is authenticated — no point polling the server yet.
const PRE_AUTH_PHASES: ReadonlySet<Phase> = new Set(['off', 'authChoice', 'createId', 'loginId', 'createPw', 'confirmPw', 'login']);

const AUTH_CHOICES = [
  { label: 'SIGN UP' },
  { label: 'LOG IN' },
];

const ENTRY_TITLES: Partial<Record<Phase, string>> = {
  createId: 'CREATE YOUR ID',
  loginId: 'ENTER YOUR ID',
  composeId: 'ENTER FRIEND ID',
  createPw: 'SET PASSWORD',
  confirmPw: 'CONFIRM PASSWORD',
};

const LEGEND: Record<string, { next: string; back: string; ok: string }> = {
  off: { next: '', back: '', ok: 'PWR' },
  authChoice: { next: 'MOVE', back: 'OFF', ok: 'SELECT' },
  createId: { next: '—', back: 'ERASE', ok: 'OK' },
  loginId: { next: '—', back: 'ERASE', ok: 'OK' },
  createPw: { next: '—', back: 'ERASE', ok: 'OK' },
  confirmPw: { next: '—', back: 'ERASE', ok: 'OK' },
  login: { next: '', back: 'ERASE', ok: 'OK' },
  composeId: { next: '—', back: 'ERASE', ok: 'OK' },
  home: { next: 'SCROLL', back: 'OFF', ok: 'PICK' },
  pickMsg: { next: 'SCROLL', back: 'BACK', ok: 'SEND' },
  confirm: { next: '', back: '취소', ok: '전송' },
  sent: { next: '', back: '', ok: 'OK' },
  inbox: { next: 'SCROLL', back: 'HOME', ok: 'READ' },
  message: { next: 'NEXT', back: 'INBOX', ok: 'REPLY' },
  requests: { next: 'SCROLL', back: 'HOME', ok: 'VIEW' },
  requestDetail: { next: '', back: 'DECLINE', ok: 'APPROVE' },
};

const ERROR_MESSAGES: Record<string, string> = {
  ID_TAKEN: '이미 사용중인 ID예요',
  NOT_FOUND: '계정을 찾을 수 없어요',
  WRONG_PASSWORD: '비밀번호가 틀렸어요',
  SENDER_NOT_FOUND: '내 계정 정보를 다시 확인해주세요',
  RECIPIENT_NOT_FOUND: '상대방 ID를 찾을 수 없어요',
  UNKNOWN_CODE: '알 수 없는 코드예요',
  REQUEST_NOT_FOUND: '이미 처리된 요청이에요',
  NETWORK_ERROR: '서버에 연결할 수 없어요',
};

function friendlyError(code: string): string {
  return ERROR_MESSAGES[code] ?? '문제가 발생했어요';
}

function errCode(e: unknown): string {
  return e instanceof ApiError ? e.message : 'NETWORK_ERROR';
}

function initState(seed: PagerState): PagerState {
  const session = loadSession();
  if (!session) return seed;
  return { ...seed, myId: session.myId, hasId: true, hasPw: session.hasPw };
}

export function PagerDevice({ backlight = 'ice' }: PagerDeviceProps) {
  const [state, dispatch] = useReducer(pagerReducer, initialPagerState, initState);
  const scale = useDeviceScale(DEVICE_WIDTH, STAGE_MARGIN);
  const entryInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [toast, setToast] = useState<string | null>(null);
  const [savingStory, setSavingStory] = useState(false);

  const isOn = state.phase !== 'off';
  const pal = isOn ? BACKLIGHT_PALETTES[backlight] : OFF_PALETTE;

  useEffect(() => {
    if (ENTRY_PHASES.has(state.phase)) {
      const t = setTimeout(() => entryInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    if (state.phase === 'pickMsg') {
      const t = setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  useEffect(() => {
    if (!state.apiError) return;
    const t = setTimeout(() => dispatch({ type: 'API_ERROR_CLEAR' }), 3000);
    return () => clearTimeout(t);
  }, [state.apiError]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Poll the server for new inbox/request messages once authenticated.
  useEffect(() => {
    if (!state.hasId || !isOn) return;
    let cancelled = false;
    const poll = async () => {
      const cur = stateRef.current;
      if (PRE_AUTH_PHASES.has(cur.phase)) return;
      try {
        const [msgs, requests] = await Promise.all([getInbox(cur.myId), getRequests(cur.myId)]);
        if (!cancelled) dispatch({ type: 'MESSAGES_UPDATED', msgs, requests });
      } catch {
        // transient poll failure — try again on the next tick
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.hasId, isOn, state.myId]);

  async function handleShareSent() {
    const s = stateRef.current;
    const shareText = `[ping] ${s.myId}님이 삐삐 메시지를 보냈어요! 확인해보세요`;
    const shareUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ping', text: shareText, url: shareUrl });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setToast('링크가 복사됐어요');
    } catch {
      setToast('복사에 실패했어요');
    }
  }

  async function handleSaveStory() {
    const node = deviceRef.current;
    if (!node || savingStory) return;
    setSavingStory(true);
    try {
      // Capture the device at a fixed width (ignoring the page's current
      // responsive scale) so the output size is predictable, leaving side
      // margins, then letterbox it onto a white 1080x1920 (9:16) canvas.
      const canvasWidth = 1080;
      const canvasHeight = Math.round((canvasWidth * 16) / 9);
      const sideMargin = 60;
      const targetDeviceWidth = canvasWidth - sideMargin * 2;
      const captureScale = targetDeviceWidth / DEVICE_WIDTH;
      const deviceDataUrl = await toPng(node, {
        pixelRatio: captureScale,
        backgroundColor: '#ffffff',
        skipFonts: true,
        style: { transform: 'none' },
      });
      const deviceImg = new Image();
      await new Promise<void>((resolve, reject) => {
        deviceImg.onload = () => resolve();
        deviceImg.onerror = () => reject(new Error('device image load failed'));
        deviceImg.src = deviceDataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(
        deviceImg,
        Math.round((canvasWidth - deviceImg.width) / 2),
        Math.round((canvasHeight - deviceImg.height) / 2),
      );

      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `ping-story-${Date.now()}.png`;

      if (navigator.canShare && navigator.share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'ping' });
            return;
          }
        } catch {
          // share sheet unavailable/cancelled/activation expired — fall back to download
        }
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch {
      setToast('이미지 생성에 실패했어요');
    } finally {
      setSavingStory(false);
    }
  }

  async function handleOk() {
    const s = stateRef.current;
    if (s.busy) return;

    if (s.phase === 'createId') {
      if (s.entryText.length < MIN_ID_LENGTH) return;
      dispatch({ type: 'BUSY_START' });
      try {
        await getAccount(s.entryText);
        dispatch({ type: 'API_ERROR', message: 'ID_TAKEN' });
      } catch (e) {
        const code = errCode(e);
        if (code === 'NOT_FOUND') {
          dispatch({ type: 'ID_NEW', myId: s.entryText });
        } else {
          dispatch({ type: 'API_ERROR', message: code });
        }
      }
      return;
    }

    if (s.phase === 'loginId') {
      if (s.entryText.length < MIN_ID_LENGTH) return;
      dispatch({ type: 'BUSY_START' });
      try {
        await getAccount(s.entryText);
        dispatch({ type: 'ID_EXISTS', myId: s.entryText });
      } catch (e) {
        dispatch({ type: 'API_ERROR', message: errCode(e) });
      }
      return;
    }

    if (s.phase === 'home') {
      const menu = getHomeMenu();
      const menuSel = Math.min(s.menuSel, menu.length - 1);
      if (menu[menuSel].key === 'logout') {
        clearSession();
        dispatch({ type: 'LOGOUT' });
        return;
      }
    }

    if (s.phase === 'confirmPw') {
      if (s.entryText.length < MIN_PW_LENGTH) return;
      if (s.entryText !== s.pendingPw) {
        dispatch({ type: 'PW_MISMATCH' });
        return;
      }
      dispatch({ type: 'BUSY_START' });
      try {
        const account = await register(s.myId, s.entryText);
        saveSession({ myId: account.id, hasPw: true });
        dispatch({ type: 'AUTH_SUCCESS', myId: account.id });
      } catch (e) {
        dispatch({ type: 'AUTH_FAILED', message: errCode(e) });
      }
      return;
    }

    if (s.phase === 'login') {
      if (s.entryText.length < MIN_PW_LENGTH) return;
      dispatch({ type: 'BUSY_START' });
      try {
        const account = await login(s.myId, s.entryText);
        saveSession({ myId: account.id, hasPw: true });
        dispatch({ type: 'AUTH_SUCCESS', myId: account.id });
      } catch (e) {
        const code = errCode(e);
        if (code === 'WRONG_PASSWORD') {
          dispatch({ type: 'PW_MISMATCH' });
        } else if (code === 'NOT_FOUND') {
          clearSession();
          dispatch({ type: 'SESSION_INVALID', message: code });
        } else {
          dispatch({ type: 'AUTH_FAILED', message: code });
        }
      }
      return;
    }

    if (s.phase === 'confirm') {
      dispatch({ type: 'BUSY_START' });
      try {
        await sendMessage(s.myId, s.toId, s.sentText);
        dispatch({ type: 'SEND_SUCCESS' });
      } catch (e) {
        dispatch({ type: 'SEND_FAILED', message: errCode(e) });
      }
      return;
    }

    if (s.phase === 'requestDetail') {
      const cur = s.requests[s.reqSel];
      if (!cur) {
        dispatch({ type: 'OK' });
        return;
      }
      dispatch({ type: 'BUSY_START' });
      try {
        await approveRequest(s.myId, cur.id);
        dispatch({ type: 'REQUEST_APPROVED' });
      } catch (e) {
        dispatch({ type: 'API_ERROR', message: errCode(e) });
      }
      return;
    }

    if (s.phase === 'inbox') {
      const cur = s.msgs[s.sel];
      dispatch({ type: 'OK' });
      if (cur && !cur.read) void markRead(s.myId, cur.id).catch(() => {});
      return;
    }

    dispatch({ type: 'OK' });
  }

  async function handleBack() {
    const s = stateRef.current;
    if (s.busy) return;

    if (s.phase === 'requestDetail') {
      const cur = s.requests[s.reqSel];
      if (!cur) {
        dispatch({ type: 'BACK' });
        return;
      }
      dispatch({ type: 'BUSY_START' });
      try {
        await declineRequest(s.myId, cur.id);
        dispatch({ type: 'REQUEST_DECLINED' });
      } catch (e) {
        dispatch({ type: 'API_ERROR', message: errCode(e) });
      }
      return;
    }

    dispatch({ type: 'BACK' });
  }

  const handleEntryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleOk();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      void handleBack();
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleOk();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      void handleBack();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      dispatch({ type: 'NEXT' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      dispatch({ type: 'PRESET_PREV' });
    }
  };

  const unread = state.msgs.filter((m) => !m.read).length;
  const total = state.msgs.length;
  const pendingRequests = state.requests.length;

  const filteredPresets = filterPresets(state.searchText);
  const pStart = Math.max(0, Math.min(state.presetSel - 1, Math.max(0, filteredPresets.length - 4)));
  const presetView = filteredPresets.slice(pStart, pStart + 4).map((p, i) => ({ ...p, idx: pStart + i }));

  const iStart = Math.max(0, Math.min(state.sel - 1, Math.max(0, state.msgs.length - 4)));
  const visibleMsgs = state.msgs.slice(iStart, iStart + 4).map((m, i) => ({ ...m, idx: iStart + i }));

  const curMsg = state.msgs[state.sel];
  const curMeaning = curMsg ? (PRESETS.find((p) => p.code === curMsg.text)?.meaning ?? '') : '';

  const homeMenu = getHomeMenu();
  const homeMenuSel = Math.min(state.menuSel, homeMenu.length - 1);
  const hStart = Math.max(0, Math.min(homeMenuSel - 1, Math.max(0, homeMenu.length - 3)));
  const homeMenuView = homeMenu.slice(hStart, hStart + 3).map((mi, i) => ({ ...mi, idx: hStart + i }));

  const iReqStart = Math.max(0, Math.min(state.reqSel - 1, Math.max(0, state.requests.length - 4)));
  const visibleRequests = state.requests.slice(iReqStart, iReqStart + 4).map((m, i) => ({ ...m, idx: iReqStart + i }));
  const curRequest = state.requests[state.reqSel];
  const curRequestMeaning = curRequest ? (PRESETS.find((p) => p.code === curRequest.text)?.meaning ?? '') : '';

  const legend = LEGEND[state.phase];
  const ledColor = isOn ? '#c4c7cb' : '#3a3c3f';
  const ledShadow = isOn ? '0 0 8px rgba(180,215,242,.85)' : 'none';

  const lcdVars = {
    '--lcd-bg': pal.bg,
    '--lcd-bg2': pal.bg2,
    '--lcd-glow': pal.glow,
    '--lcd-ink': pal.ink,
  } as CSSProperties;

  return (
    <div className="pager-page">
      <div
        className="pager-stage"
        style={{ width: DEVICE_WIDTH * scale, height: DEVICE_HEIGHT * scale }}
      >
        <div
          ref={deviceRef}
          className="pager-device"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div className="pager-sheen" />

          <div className="pager-bezel">
            <div className="pager-lcd" style={lcdVars}>
              <div className="pager-lcd-lines" />
              <div className="pager-lcd-sheen" />

              {!isOn && <div className="pager-off-screen">PRESS ● POWER</div>}

              {isOn && (
                <div className="pager-on">
                  <div className="pager-status-bar">
                    <div className="pager-signal">
                      <div className="pager-signal-bar" />
                      <div className="pager-signal-bar" />
                      <div className="pager-signal-bar" />
                    </div>
                    <div className="pager-status-right">
                      <span className={`pager-envelope ${unread > 0 ? 'is-blinking' : 'is-idle'}`}>
                        ✉{unread}
                      </span>
                      <div className="pager-battery">
                        <div className="pager-battery-cells">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className={`pager-battery-cell ${i >= 3 ? 'is-empty' : ''}`} />
                          ))}
                        </div>
                        <div className="pager-battery-tip" />
                      </div>
                    </div>
                  </div>

                  <div className="pager-content">
                    {state.phase === 'authChoice' && (
                      <div className="pager-home">
                        <div className="pager-home-title">WELCOME TO ping</div>
                        {AUTH_CHOICES.map((choice, i) => (
                          <div
                            key={choice.label}
                            className={`pager-menu-item ${i === state.authSel ? 'is-selected' : ''}`}
                          >
                            <span className="pager-menu-mark">{i === state.authSel ? '>' : ' '}</span>
                            {choice.label}
                          </div>
                        ))}
                      </div>
                    )}

                    {ENTRY_PHASES.has(state.phase) && (() => {
                      const isPw = PW_PHASES.has(state.phase);
                      const entryMin = isPw ? MIN_PW_LENGTH : MIN_ID_LENGTH;
                      const entryMax = isPw ? MAX_PW_LENGTH : MAX_ID_LENGTH;
                      const title = state.phase === 'login'
                        ? `WELCOME BACK · ${state.myId}`
                        : ENTRY_TITLES[state.phase];
                      return (
                        <div className="pager-entry">
                          <div className="pager-entry-title">{title}</div>
                          <div className="pager-entry-slots">
                            {state.entryText.split('').map((ch, i) => (
                              <div key={i} className="pager-entry-slot">{isPw ? '●' : ch}</div>
                            ))}
                            {state.entryText.length < entryMax && (
                              <div className="pager-entry-slot is-cursor">_</div>
                            )}
                          </div>
                          {state.entryText.length < entryMin && (
                            <div className="pager-entry-hint">
                              {isPw ? `TYPE ${entryMin}+ CHARACTERS` : 'TYPE 2+ LETTERS/NUMBERS'}
                            </div>
                          )}
                          {state.phase === 'createId' && (
                            <div className="pager-entry-warn">⚠ 한번 정한 ID는 바꿀 수 없어요</div>
                          )}
                          {state.phase === 'createPw' && (
                            <div className="pager-entry-warn">⚠ 잊지 않게 기억해두세요</div>
                          )}
                          {(state.phase === 'confirmPw' || state.phase === 'login') && state.entryError && (
                            <div className="pager-entry-warn">
                              {state.phase === 'confirmPw' ? '⚠ 비밀번호가 일치하지 않아요' : '⚠ 비밀번호가 틀렸어요'}
                            </div>
                          )}
                          {state.apiError && (
                            <div className="pager-entry-warn">⚠ {friendlyError(state.apiError)}</div>
                          )}
                          {state.busy && (state.phase === 'createId' || state.phase === 'loginId' || state.phase === 'confirmPw' || state.phase === 'login') && (
                            <div className="pager-entry-hint">확인 중...</div>
                          )}
                          <input
                            ref={entryInputRef}
                            className="pager-hidden-input"
                            value={state.entryText}
                            onChange={(e) => dispatch({ type: 'SET_ENTRY_TEXT', text: e.target.value })}
                            onKeyDown={handleEntryKeyDown}
                            maxLength={entryMax}
                            autoFocus
                            lang="en"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                        </div>
                      );
                    })()}

                    {state.phase === 'home' && (
                      <div className="pager-home">
                        <div className="pager-home-title">MENU · ID {state.myId}</div>
                        {homeMenuView.map((mi) => (
                          <div
                            key={mi.key}
                            className={`pager-menu-item ${mi.idx === homeMenuSel ? 'is-selected' : ''}`}
                          >
                            <span className="pager-menu-mark">{mi.idx === homeMenuSel ? '>' : ' '}</span>
                            {mi.label}
                            {((mi.key === 'inbox' && unread > 0) ||
                              (mi.key === 'requests' && pendingRequests > 0)) && (
                              <span className="pager-menu-dot" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {state.phase === 'pickMsg' && (
                      <div className="pager-pickmsg">
                        <div className="pager-pickmsg-head">
                          <span>TO {state.toId}</span>
                          <span>⌨ {state.searchText ? `"${state.searchText}"` : 'TYPE TO SEARCH'}</span>
                        </div>
                        {presetView.map((pm) => (
                          <div
                            key={pm.code}
                            className={`pager-preset-row ${pm.idx === state.presetSel ? 'is-selected' : ''}`}
                          >
                            <span className="pager-preset-mark">{pm.idx === state.presetSel ? '>' : ' '}</span>
                            <span className="pager-preset-code">{pm.code}</span>
                            <span className="pager-preset-meaning">{pm.meaning}</span>
                          </div>
                        ))}
                        <div className="pager-pickmsg-spacer" />
                        {!filteredPresets.length && (
                          <div className="pager-pickmsg-hint">NO MATCH · DEL로 지우기</div>
                        )}
                        <input
                          ref={searchInputRef}
                          className="pager-hidden-input"
                          value={state.searchText}
                          onChange={(e) => dispatch({ type: 'SET_SEARCH_TEXT', text: e.target.value })}
                          onKeyDown={handleSearchKeyDown}
                          lang="ko"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    )}

                    {state.phase === 'confirm' && (
                      <div className="pager-confirm">
                        <div className="pager-confirm-to">TO {state.toId}</div>
                        <div className="pager-confirm-code">{state.sentText}</div>
                        <div className="pager-confirm-meaning">{state.sentMeaning}</div>
                        <div className="pager-confirm-question">
                          {state.busy ? '전송 중...' : '이 메시지를 보낼까요?'}
                        </div>
                        {state.apiError && (
                          <div className="pager-entry-warn">⚠ {friendlyError(state.apiError)}</div>
                        )}
                      </div>
                    )}

                    {state.phase === 'sent' && (
                      <div className="pager-sent">
                        <div className="pager-sent-title">MESSAGE SENT</div>
                        <div className="pager-sent-detail">{state.toId} ← {state.sentText}</div>
                      </div>
                    )}

                    {state.phase === 'inbox' && (
                      <div className="pager-inbox">
                        <div className="pager-inbox-title">INBOX {total} MSG</div>
                        {visibleMsgs.map((m) => (
                          <div
                            key={m.id}
                            className={`pager-inbox-row ${m.idx === state.sel ? 'is-selected' : ''}`}
                          >
                            <span className="pager-inbox-dot">{m.read ? '·' : '►'}</span>
                            <span className="pager-inbox-from">{m.from}</span>
                            <span className="pager-inbox-text">{m.text}</span>
                            <span className="pager-inbox-time">{m.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {state.phase === 'message' && curMsg && (
                      <div className="pager-message">
                        <div className="pager-message-head">
                          <span>{curMsg.from}</span>
                          <span>{curMsg.time}</span>
                        </div>
                        <div className="pager-message-body">
                          <div className="pager-message-text">{curMsg.text}</div>
                          <div className="pager-message-meaning">{curMeaning}</div>
                        </div>
                        <div className="pager-message-idx">MSG {state.sel + 1}/{total}</div>
                      </div>
                    )}

                    {state.phase === 'requests' && (
                      <div className="pager-inbox">
                        <div className="pager-inbox-title">
                          {state.requests.length ? `REQUESTS ${state.requests.length}` : 'NO REQUESTS'}
                        </div>
                        {visibleRequests.map((m) => (
                          <div
                            key={m.id}
                            className={`pager-inbox-row ${m.idx === state.reqSel ? 'is-selected' : ''}`}
                          >
                            <span className="pager-inbox-dot">?</span>
                            <span className="pager-inbox-from">{m.from}</span>
                            <span className="pager-inbox-text">{m.text}</span>
                            <span className="pager-inbox-time">{m.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {state.phase === 'requestDetail' && curRequest && (
                      <div className="pager-message">
                        <div className="pager-message-head">
                          <span>{curRequest.from}</span>
                          <span>{curRequest.time}</span>
                        </div>
                        <div className="pager-message-body">
                          <div className="pager-message-text">{curRequest.text}</div>
                          <div className="pager-message-meaning">{curRequestMeaning}</div>
                        </div>
                        <div className="pager-message-idx">
                          {state.busy ? '처리 중...' : '모르는 상대예요 · 받을까요?'}
                        </div>
                        {state.apiError && (
                          <div className="pager-entry-warn">⚠ {friendlyError(state.apiError)}</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pager-legend">
                    <div className="pager-legend-item">▼{legend.next}</div>
                    <div className="pager-legend-item is-mid">DEL {legend.back}</div>
                    <div className="pager-legend-item">●{legend.ok}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pager-label-row">
            <div className="pager-label">
              <span>ping</span>
              <span className="pager-led" style={{ background: ledColor, boxShadow: ledShadow }} />
            </div>
          </div>

          <div className="pager-controls-row">
            <div className="pager-dpad">
              <div className="pager-dpad-buttons">
                <button className="pager-btn" onClick={() => dispatch({ type: 'NEXT' })}>
                  <div className="pager-btn-circle">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c4c7cb" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span className="pager-btn-label">NEXT</span>
                </button>

                <button className="pager-btn" onClick={() => void handleBack()}>
                  <div className="pager-btn-circle">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c4c7cb" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 6 9 12 15 18" />
                    </svg>
                  </div>
                  <span className="pager-btn-label">DEL / ESC</span>
                </button>
              </div>
            </div>

            <div className="pager-spacer" />

            <div className="pager-volume">
              <div className="pager-volume-bar" />
              <div className="pager-volume-bar" />
              <div className="pager-volume-bar" />
              <div className="pager-volume-bar" />
              <div className="pager-volume-bar" />
            </div>

            <button className="pager-btn" onClick={() => void handleOk()}>
              <div className="pager-btn-circle pager-btn-circle--power">
                <div className="pager-power-ring" />
              </div>
              <span className="pager-btn-label">POWER / OK</span>
            </button>
          </div>
        </div>
      </div>

      {state.phase === 'sent' && (
        <button className="pager-float-btn" onClick={() => void handleShareSent()}>
          삐삐 - 알리기
        </button>
      )}

      {state.phase === 'message' && curMsg && (
        <button className="pager-float-btn" onClick={() => void handleSaveStory()} disabled={savingStory}>
          {savingStory ? '이미지 만드는 중...' : '스토리로 공유'}
        </button>
      )}

      {toast && <div className="pager-toast">{toast}</div>}
    </div>
  );
}
