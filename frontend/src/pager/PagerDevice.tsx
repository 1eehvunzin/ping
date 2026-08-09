import { useEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ApiError, approveRequest, declineRequest, getAccount, getInbox, getRequests, login, markRead, register, sendMessage } from './api';
import { BACKLIGHT_PALETTES, MAX_ID_LENGTH, MAX_PW_LENGTH, MIN_ID_LENGTH, MIN_PW_LENGTH, OFF_PALETTE, PRESETS, filterPresets, getHomeMenu } from './data';
import { initialPagerState, pagerReducer, type PagerState } from './reducer';
import { clearSession, loadSession, saveSession } from './session';
import type { Backlight, PagerMessage, Phase } from './types';
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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Character-by-character wrapping (rather than word-splitting) handles mixed
// Korean/digit content without needing per-language logic.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    const attempt = current + ch;
    if (current && ctx.measureText(attempt).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

interface StoryPalette {
  bg: string;
  bg2: string;
  ink: string;
}

function drawCircleButton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  label: string,
  labelFontPx: number,
) {
  // .pager-btn-circle box-shadow: 0 1px 1px rgba(255,255,255,.06), 0 2px 5px
  // rgba(0,0,0,.35), plus insets canvas can't express — approximate with a
  // single soft drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = r * 0.14;
  ctx.shadowOffsetY = r * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx, cy - r * 0.08, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#2b2d30');
  grad.addColorStop(1, '#333538');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#5f6266';
  ctx.font = `600 ${labelFontPx}px "Barlow Semi Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, cx, cy + r + labelFontPx * 1.6);
}

// Matches the live <svg viewBox="0 0 24 24"><polyline .../></svg> chevrons:
// NEXT is "6 9, 12 15, 18 9" (points down), DEL/ESC is "15 6, 9 12, 15 18"
// (points left) — both centered on (12,12), so offsets below are relative
// to that center, scaled by px() same as everything else.
function drawChevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: (n: number) => number, direction: 'down' | 'left') {
  ctx.save();
  ctx.strokeStyle = '#c4c7cb';
  ctx.lineWidth = px(2.6);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (direction === 'down') {
    ctx.moveTo(cx - px(6), cy - px(3));
    ctx.lineTo(cx, cy + px(3));
    ctx.lineTo(cx + px(6), cy - px(3));
  } else {
    ctx.moveTo(cx + px(3), cy - px(6));
    ctx.lineTo(cx - px(3), cy);
    ctx.lineTo(cx + px(3), cy + px(6));
  }
  ctx.stroke();
  ctx.restore();
}

// Renders a story-ratio (9:16) PNG of the message screen by drawing the
// pager device directly with Canvas 2D primitives, mirroring PagerDevice.css
// — deliberately not a DOM screenshot (html-to-image/html2canvas etc), since
// those go through an SVG foreignObject step that produces a torn/
// duplicated-seam image on iOS Safari for content like this (nested
// gradients + running animations).
async function buildStoryDataUrl(
  msg: PagerMessage,
  meaning: string,
  pal: StoryPalette,
  msgIndex: number,
  msgTotal: number,
): Promise<string> {
  const canvasWidth = 1080;
  const canvasHeight = Math.round((canvasWidth * 16) / 9);
  const sideMargin = 60;
  const deviceWidth = canvasWidth - sideMargin * 2;
  const scale = deviceWidth / DEVICE_WIDTH;
  const deviceHeight = Math.round(DEVICE_HEIGHT * scale);
  const deviceX = sideMargin;
  const deviceY = Math.round((canvasHeight - deviceHeight) / 2);
  const px = (n: number) => n * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  await document.fonts.ready;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Device shell — linear-gradient(158deg, #54565a 0%, #45474b 30%, #37393c 62%, #2c2e30 100%)
  // plus its drop shadow: 0 44px 70px -22px rgba(45,52,62,.5), 0 10px 26px rgba(0,0,0,.2)
  const deviceGrad = ctx.createLinearGradient(deviceX, deviceY, deviceX + deviceWidth, deviceY + deviceHeight);
  deviceGrad.addColorStop(0, '#54565a');
  deviceGrad.addColorStop(0.3, '#45474b');
  deviceGrad.addColorStop(0.62, '#37393c');
  deviceGrad.addColorStop(1, '#2c2e30');
  ctx.save();
  ctx.shadowColor = 'rgba(45,52,62,.45)';
  ctx.shadowBlur = px(55);
  ctx.shadowOffsetY = px(28);
  roundRectPath(ctx, deviceX, deviceY, deviceWidth, deviceHeight, px(34));
  ctx.fillStyle = deviceGrad;
  ctx.fill();
  ctx.restore();

  const devicePad = px(26);
  const bezelX = deviceX + devicePad;
  const bezelY = deviceY + devicePad;
  const bezelWidth = deviceWidth - devicePad * 2;
  const bezelHeight = px(300);

  // Bezel — linear-gradient(160deg, #101010, #1c1c1c)
  roundRectPath(ctx, bezelX, bezelY, bezelWidth, bezelHeight, px(14));
  const bezelGrad = ctx.createLinearGradient(bezelX, bezelY, bezelX + bezelWidth, bezelY + bezelHeight);
  bezelGrad.addColorStop(0, '#101010');
  bezelGrad.addColorStop(1, '#1c1c1c');
  ctx.fillStyle = bezelGrad;
  ctx.fill();

  const bezelPad = px(14);
  const lcdX = bezelX + bezelPad;
  const lcdY = bezelY + bezelPad;
  const lcdWidth = bezelWidth - bezelPad * 2;
  const lcdHeight = bezelHeight - bezelPad * 2;

  ctx.save();
  roundRectPath(ctx, lcdX, lcdY, lcdWidth, lcdHeight, px(3));
  ctx.clip();

  // LCD — radial-gradient(120% 130% at 50% 38%, --lcd-bg 0%, --lcd-bg2 100%)
  const lcdGrad = ctx.createRadialGradient(
    lcdX + lcdWidth * 0.5, lcdY + lcdHeight * 0.38, 0,
    lcdX + lcdWidth * 0.5, lcdY + lcdHeight * 0.38, lcdWidth * 0.75,
  );
  lcdGrad.addColorStop(0, pal.bg);
  lcdGrad.addColorStop(1, pal.bg2);
  ctx.fillStyle = lcdGrad;
  ctx.fillRect(lcdX, lcdY, lcdWidth, lcdHeight);

  // Dot-matrix grid texture, drawn once into a small tile and repeated —
  // far cheaper than stroking thousands of individual grid lines.
  const tileSize = Math.max(2, Math.round(px(3)));
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tileCtx = tile.getContext('2d');
  if (tileCtx) {
    tileCtx.strokeStyle = 'rgba(0,0,0,.08)';
    tileCtx.lineWidth = 1;
    tileCtx.beginPath();
    tileCtx.moveTo(0, 0.5);
    tileCtx.lineTo(tileSize, 0.5);
    tileCtx.moveTo(0.5, 0);
    tileCtx.lineTo(0.5, tileSize);
    tileCtx.stroke();
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(lcdX, lcdY, lcdWidth, lcdHeight);
    }
  }

  // .pager-on { padding: 12px 18px }
  const contentPadX = px(18);
  const contentPadY = px(12);
  const contentX = lcdX + contentPadX;
  const contentWidth = lcdWidth - contentPadX * 2;
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.ink;
  ctx.textBaseline = 'alphabetic';

  // .pager-status-bar — signal bars, envelope, battery
  const statusFontPx = px(20);
  let cursorY = lcdY + contentPadY + statusFontPx * 0.82;
  const signalBaseY = cursorY;
  const signalBarW = px(5);
  const signalGap = px(2);
  [px(7), px(11), px(15)].forEach((h, i) => {
    ctx.fillRect(contentX + i * (signalBarW + signalGap), signalBaseY - h, signalBarW, h);
  });

  // battery: 28x14 outline with 4 cells (last one empty), tip on the right
  const battW = px(28);
  const battH = px(14);
  const battX = contentX + contentWidth - battW - px(3);
  const battY = signalBaseY - battH * 0.85;
  ctx.lineWidth = px(2);
  ctx.strokeRect(battX, battY, battW, battH);
  const cellPad = px(2);
  const cellGap = px(2);
  const cellW = (battW - cellPad * 2 - cellGap * 3) / 4;
  for (let i = 0; i < 4; i++) {
    if (i >= 3) continue; // last cell rendered empty, matching the live UI
    ctx.fillRect(battX + cellPad + i * (cellW + cellGap), battY + cellPad, cellW, battH - cellPad * 2);
  }
  ctx.fillRect(battX + battW, battY + battH * 0.28, px(3), battH * 0.44);

  cursorY += statusFontPx * 0.3 + px(6);
  ctx.lineWidth = px(3);
  ctx.beginPath();
  ctx.moveTo(contentX, cursorY);
  ctx.lineTo(contentX + contentWidth, cursorY);
  ctx.stroke();

  // .pager-message { padding-top: 4px } .pager-message-head
  cursorY += px(4);
  const headFontPx = px(15);
  cursorY += headFontPx * 0.85;
  ctx.font = `${headFontPx}px "DotGothic16", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(msg.from, contentX, cursorY);
  ctx.textAlign = 'right';
  ctx.fillText(msg.time, contentX + contentWidth, cursorY);
  ctx.textAlign = 'left';

  cursorY += headFontPx * 0.3 + px(6);
  ctx.lineWidth = px(2);
  ctx.beginPath();
  ctx.moveTo(contentX, cursorY);
  ctx.lineTo(contentX + contentWidth, cursorY);
  ctx.stroke();

  // Anchor the legend row (and message-idx just above it) to the LCD's
  // inner bottom edge, working upward — everything above is what's left
  // over for the vertically-centered message body.
  const lcdInnerBottom = lcdY + lcdHeight - contentPadY;
  const legendFontPx = px(17);
  const legendRowHeight = px(6) + legendFontPx * 1.2;
  const legendBorderY = lcdInnerBottom - legendRowHeight;

  const idxFontPx = px(12);
  const idxY = legendBorderY - px(4);

  // .pager-message-body — vertically centered in the remaining space
  const bodyTop = cursorY + px(6);
  const bodyBottom = idxY - idxFontPx * 1.4;
  const codeFontSize = px(44);
  const meaningFontSize = px(19);
  const codeLineHeight = codeFontSize * 1.05;
  const meaningLineHeight = meaningFontSize * 1.1;
  const blockGap = px(10);

  ctx.font = `${codeFontSize}px "DotGothic16", monospace`;
  const codeLines = wrapText(ctx, msg.text, contentWidth);
  ctx.font = `${meaningFontSize}px "DotGothic16", monospace`;
  const meaningLines = wrapText(ctx, meaning, contentWidth);

  const blockHeight = codeLines.length * codeLineHeight + blockGap + meaningLines.length * meaningLineHeight;
  let y = bodyTop + Math.max(0, (bodyBottom - bodyTop - blockHeight) / 2) + codeLineHeight * 0.8;

  ctx.font = `${codeFontSize}px "DotGothic16", monospace`;
  for (const line of codeLines) {
    ctx.fillText(line, contentX, y);
    y += codeLineHeight;
  }
  y += blockGap - codeLineHeight + meaningLineHeight * 0.8;
  ctx.font = `${meaningFontSize}px "DotGothic16", monospace`;
  ctx.globalAlpha = 0.85;
  for (const line of meaningLines) {
    ctx.fillText(line, contentX, y);
    y += meaningLineHeight;
  }
  ctx.globalAlpha = 1;

  ctx.font = `${idxFontPx}px "DotGothic16", monospace`;
  ctx.globalAlpha = 0.55;
  ctx.fillText(`MSG ${msgIndex}/${msgTotal}`, contentX, idxY);
  ctx.globalAlpha = 1;

  // .pager-legend — border-top 3px, three equal columns
  const legend = LEGEND.message;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = px(3);
  ctx.beginPath();
  ctx.moveTo(contentX, legendBorderY);
  ctx.lineTo(contentX + contentWidth, legendBorderY);
  ctx.stroke();

  const legendTextY = legendBorderY + px(6) + legendFontPx * 0.82;
  const colWidth = contentWidth / 3;
  ctx.font = `${legendFontPx}px "DotGothic16", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`▼${legend.next}`, contentX + colWidth * 0.5, legendTextY);
  ctx.fillText(`DEL ${legend.back}`, contentX + colWidth * 1.5, legendTextY);
  ctx.fillText(`●${legend.ok}`, contentX + colWidth * 2.5, legendTextY);
  ctx.lineWidth = px(2);
  ctx.beginPath();
  ctx.moveTo(contentX + colWidth, legendBorderY);
  ctx.lineTo(contentX + colWidth, legendBorderY + px(4) + legendFontPx * 1.3);
  ctx.moveTo(contentX + colWidth * 2, legendBorderY);
  ctx.lineTo(contentX + colWidth * 2, legendBorderY + px(4) + legendFontPx * 1.3);
  ctx.stroke();
  ctx.textAlign = 'left';

  ctx.restore();

  // .pager-label-row { margin-top: 16px; padding: 0 10px } "ping" + LED
  const labelFontPx = px(56);
  const labelY = bezelY + bezelHeight + px(16) + labelFontPx * 0.78;
  ctx.fillStyle = '#1e2022';
  ctx.font = `800 ${labelFontPx}px "Pretendard Variable", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('ping', bezelX + px(10), labelY);
  const pingWidth = ctx.measureText('ping').width;
  ctx.beginPath();
  ctx.arc(bezelX + px(10) + pingWidth + px(10), labelY - labelFontPx * 0.32, px(5.5), 0, Math.PI * 2);
  ctx.fillStyle = '#c4c7cb';
  ctx.shadowColor = 'rgba(180,215,242,.85)';
  ctx.shadowBlur = px(8);
  ctx.fill();
  ctx.shadowBlur = 0;

  // .pager-controls-row { margin-top: 18px; padding: 0 6px; align-items: center }
  // The row's cross-axis center is shared by every item (dpad circles, volume
  // bars, power circle) — anchor everything to one center line rather than
  // stacking from a shared top/bottom, matching that align-items: center.
  const controlsY = bezelY + bezelHeight + px(16) + labelFontPx + px(18);
  const btnLabelFontPx = px(13);
  const dpadR = px(37);
  const powerR = px(50);
  const rowCenterY = controlsY + powerR;

  const nextCx = bezelX + px(6) + dpadR;
  const delCx = bezelX + px(6) + dpadR * 2 + px(20) + dpadR;
  drawCircleButton(ctx, nextCx, rowCenterY, dpadR, 'NEXT', btnLabelFontPx);
  drawChevron(ctx, nextCx, rowCenterY, px, 'down');
  drawCircleButton(ctx, delCx, rowCenterY, dpadR, 'DEL / ESC', btnLabelFontPx);
  drawChevron(ctx, delCx, rowCenterY, px, 'left');

  const volumeHeights = [px(20), px(28), px(34), px(28), px(20)];
  const volumeBarW = px(9);
  const volumeGap = px(9);
  const volumeTotalW = volumeHeights.length * volumeBarW + (volumeHeights.length - 1) * volumeGap;
  const volumeRight = bezelX + bezelWidth - px(6) - px(100) - px(20) - px(6);
  const volumeLeft = volumeRight - volumeTotalW;
  const volumeMaxH = Math.max(...volumeHeights);
  const volumeBottomY = rowCenterY + volumeMaxH / 2;
  ctx.fillStyle = '#242527';
  volumeHeights.forEach((h, i) => {
    const bx = volumeLeft + i * (volumeBarW + volumeGap);
    roundRectPath(ctx, bx, volumeBottomY - h, volumeBarW, h, px(5));
    ctx.fill();
  });

  const powerCx = bezelX + bezelWidth - px(6) - powerR;
  drawCircleButton(ctx, powerCx, rowCenterY, powerR, 'POWER / OK', btnLabelFontPx);
  ctx.beginPath();
  ctx.arc(powerCx, rowCenterY, px(15), 0, Math.PI * 2);
  ctx.strokeStyle = '#c4c7cb';
  ctx.lineWidth = px(2.6);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export function PagerDevice({ backlight = 'ice' }: PagerDeviceProps) {
  const [state, dispatch] = useReducer(pagerReducer, initialPagerState, initState);
  const scale = useDeviceScale(DEVICE_WIDTH, STAGE_MARGIN);
  const entryInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    const shareText = '[ping] 삐삐- 메시지를 전송했어요 📟';
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
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setToast('링크가 복사됐어요');
    } catch {
      setToast('복사에 실패했어요');
    }
  }

  async function handleSaveStory() {
    if (savingStory) return;
    const s = stateRef.current;
    const msg = s.msgs[s.sel];
    if (!msg) return;
    const meaning = PRESETS.find((p) => p.code === msg.text)?.meaning ?? '';
    setSavingStory(true);
    try {
      const pal = BACKLIGHT_PALETTES[backlight];
      const dataUrl = await buildStoryDataUrl(msg, meaning, pal, s.sel + 1, s.msgs.length);
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
