import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { concerts as sourceConcerts } from './data/concerts.js';

const themes = {
  neutral: { label: 'ТИХАЯ НОЧЬ', motion: 1, particle: '#d6b9d0', ticket: '#17131d', colors: { bg: '#111016', bg2: '#1a1720', text: '#f6f0ec', muted: '#a6a0ae', accent: '#e6b5c9', accent2: '#9186b7', glow: 'rgba(230,181,201,.28)', border: 'rgba(246,240,236,.18)' }, gradients: ['radial-gradient(circle at 12% 18%, rgba(115,95,135,.22), transparent 38%)', 'radial-gradient(circle at 86% 74%, rgba(211,141,162,.12), transparent 35%)'] },
  goneFludd: { label: 'ФИОЛЕТОВОЕ ПОСЛЕСВЕЧЕНИЕ', motion: 1.55, particle: '#ff9ed7', ticket: '#24112d', colors: { bg: '#190c22', bg2: '#2c0f37', text: '#fff3f8', muted: '#c5a1c9', accent: '#fa6eb8', accent2: '#a873ff', glow: 'rgba(250,110,184,.38)', border: 'rgba(250,110,184,.34)' }, gradients: ['radial-gradient(circle at 14% 12%, rgba(164,43,196,.55), transparent 35%)', 'radial-gradient(circle at 82% 70%, rgba(250,77,165,.30), transparent 42%)'] },
  darkPrince: { label: 'НОЧНАЯ СТАТИКА', motion: .62, particle: '#afc7ff', ticket: '#0e1728', colors: { bg: '#07101d', bg2: '#101a2c', text: '#edf2ff', muted: '#98a8c4', accent: '#9eb7ff', accent2: '#b39bdf', glow: 'rgba(120,159,255,.30)', border: 'rgba(158,183,255,.27)' }, gradients: ['radial-gradient(circle at 78% 16%, rgba(76,93,173,.38), transparent 37%)', 'radial-gradient(circle at 22% 82%, rgba(107,76,151,.24), transparent 40%)'] },
  custom: { label: 'ТВОЯ ВОЛНА', motion: .9, particle: '#b9dec9', ticket: '#121d1d', colors: { bg: '#11151b', bg2: '#1b2428', text: '#eff6ef', muted: '#a4b3ab', accent: '#b8d9bf', accent2: '#8db6b9', glow: 'rgba(184,217,191,.26)', border: 'rgba(184,217,191,.27)' }, gradients: ['radial-gradient(circle at 18% 16%, rgba(78,137,128,.28), transparent 37%)', 'radial-gradient(circle at 82% 78%, rgba(185,160,109,.16), transparent 40%)'] }
};

const concerts = sourceConcerts.map((item, index) => ({
  ...item,
  date: index === 0 ? '27 ноября 2026' : '14 февраля 2027',
  artwork: index === 0 ? 'fludd' : 'prince',
  image: item.image,
  audioPreview: item.audioPreview,
  price: item.priceNote || `от ${item.priceFrom.toLocaleString('ru-RU')} ₽`,
  mapNote: item.seatMap.label,
  conflict: index === 1 ? 'В одном устаревшем зеркале встречается 13.02 / 21:00; приоритет отдан организатору и билетным афишам с 14.02 / 20:00.' : '',
  statusText: item.statusLabel,
  sources: [item.officialSource, item.ticketSource]
}));
const noCopy = ['Нет', 'Ты уверена?', 'Подумай ещё', 'Не так быстро', 'Ну пожалуйста', 'Последняя попытка'];

function selectionModeFor(map) {
  if (map?.selectionMode === 'seat') return 'seat';
  if (map?.selectionMode === 'sector' || map?.type === 'zones') return 'sector';
  return 'unavailable';
}

function selectionModeLabel(map, selection) {
  const mode = selection?.selectionMode || selectionModeFor(map);
  if (mode === 'seat') return 'МЕСТО';
  if (mode === 'sector') return 'СЕКТОР';
  return 'БЕЗ ВЫБОРА МЕСТА';
}

function selectionToPayload(selection) {
  if (selection?.type === 'sector') return { t: 'sector', s: selection.sector };
  if (selection?.type === 'seat') return { t: 'seat', s: selection.sector, r: selection.row, n: selection.seat };
  return null;
}

function selectionFromPayload(place) {
  if (place?.t === 'sector' && typeof place.s === 'string') return { type: 'sector', sector: place.s };
  // v1 links used zone/z. Keep them valid after the ticket format upgrade.
  if (place?.t === 'zone' && typeof place.z === 'string') return { type: 'sector', sector: place.z };
  if (place?.t === 'seat' && typeof place.s === 'string' && typeof place.r === 'string' && typeof place.n === 'string') {
    return { type: 'seat', sector: place.s, row: place.r, seat: place.n };
  }
  return null;
}

function createTicketId() {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `N27-${value.slice(0, 12).toUpperCase()}`;
}

function legacyTicketId(concertId, selection) {
  const source = `${concertId}:${JSON.stringify(selectionToPayload(selection))}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `DEMO-${(hash >>> 0).toString(36).toUpperCase().padStart(7, '0')}`;
}

function encodeTicketToken(concertId, selection, ticketId) {
  const payload = JSON.stringify({ v: 2, c: concertId, p: selectionToPayload(selection), i: ticketId });
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeTicketToken(token) {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (token.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || ![1, 2].includes(payload.v) || typeof payload.c !== 'string') return null;
    const selection = selectionFromPayload(payload.p);
    const ticketId = typeof payload.i === 'string' && /^[A-Z0-9-]{6,36}$/i.test(payload.i) ? payload.i.toUpperCase() : null;
    return { concertId: payload.c, selection, ticketId };
  } catch {
    return null;
  }
}

function readTicketRoute() {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/ticket\/([^/]+)\/?$/i);
  const ticket = match ? decodeTicketToken(match[1]) : null;
  if (!ticket) return null;
  const concert = concerts.find((item) => item.id === ticket.concertId);
  if (!concert) return null;
  const selection = validateSelection(concert.seatMap, ticket.selection) ? ticket.selection : null;
  return { concertId: ticket.concertId, selection, ticketId: ticket.ticketId || legacyTicketId(ticket.concertId, selection) };
}

function ticketPathFor(selected, selection, ticketId) {
  return selected && selected.id !== 'custom' && ticketId ? `/ticket/${encodeTicketToken(selected.id, selection, ticketId)}` : null;
}

function validateSelection(map, selection) {
  if (!selection) return true;
  const mode = selectionModeFor(map);
  if (mode === 'sector') return selection.type === 'sector' && Array.isArray(map?.zones) && map.zones.includes(selection.sector);
  if (mode !== 'seat' || selection.type !== 'seat') return false;
  const sector = map?.sectors?.find((item) => (item.id || item.name) === selection.sector);
  const row = sector?.rows?.find((item) => String(item.id ?? item.number) === selection.row);
  const seat = row?.seats?.find((item) => String(item.id ?? item.number) === selection.seat);
  return seat?.status === 'available';
}

function selectionDetails(map, selection) {
  if (!selection) return null;
  if (selection.type === 'sector') return { ...selection, selectionMode: 'sector', category: null, price: null };
  const sector = map?.sectors?.find((item) => (item.id || item.name) === selection.sector);
  const row = sector?.rows?.find((item) => String(item.id ?? item.number) === selection.row);
  const seat = row?.seats?.find((item) => String(item.id ?? item.number) === selection.seat);
  return {
    ...selection,
    selectionMode: 'seat',
    category: seat?.category ?? sector?.category ?? null,
    price: seat?.price ?? sector?.price ?? null,
  };
}

function ticketQrPayload(selected, selection, ticketId, ticketUrl = '') {
  if (!selected || !ticketId) return '';
  return JSON.stringify({
    v: 2,
    type: 'demo-ticket',
    ticketId,
    concert: selected.id,
    selectionMode: selection ? selectionModeLabel(selected.seatMap, selection) : 'БЕЗ ВЫБОРА МЕСТА',
    selection: selectionToPayload(selection),
    route: ticketUrl || undefined,
  });
}

function useTicketQr(payload) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!payload) { setDataUrl(''); return undefined; }
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#fff4fb', light: '#171019' },
    }).then((result) => { if (!cancelled) setDataUrl(result); }).catch(() => { if (!cancelled) setDataUrl(''); });
    return () => { cancelled = true; };
  }, [payload]);
  return dataUrl;
}

function useReducedMotion() {
  const [value, setValue] = useState(false);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setValue(media.matches); update(); media.addEventListener?.('change', update); return () => media.removeEventListener?.('change', update); }, []);
  return value;
}

function useLocalDateTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => ({
    date: new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now),
    time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now),
  }), [now]);
}

function usePreferredColorScheme() {
  const [scheme, setScheme] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => setScheme(media.matches ? 'light' : 'dark');
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return scheme;
}

const lightThemeOverrides = {
  neutral: {
    label: 'ТИХИЙ ДЕНЬ', particle: '#8e6281', ticket: '#fffaff',
    colors: { bg: '#f3f0f5', bg2: '#fffdfd', text: '#211c26', muted: '#6f6875', accent: '#ad477b', accent2: '#71639f', glow: 'rgba(173,71,123,.2)', border: 'rgba(33,28,38,.18)' },
    gradients: ['radial-gradient(circle at 12% 18%, rgba(163,126,177,.22), transparent 38%)', 'radial-gradient(circle at 86% 74%, rgba(224,147,175,.2), transparent 35%)'],
  },
  goneFludd: {
    label: 'ФИОЛЕТОВЫЙ ДЕНЬ', particle: '#a7478e', ticket: '#fff7fc',
    colors: { bg: '#fbf1f9', bg2: '#fffdfd', text: '#2d172c', muted: '#795c77', accent: '#c43b80', accent2: '#7652b4', glow: 'rgba(196,59,128,.24)', border: 'rgba(83,29,74,.2)' },
    gradients: ['radial-gradient(circle at 14% 12%, rgba(205,108,221,.3), transparent 35%)', 'radial-gradient(circle at 82% 70%, rgba(246,105,176,.22), transparent 42%)'],
  },
  darkPrince: {
    label: 'ДНЕВНАЯ СТАТИКА', particle: '#5c78bb', ticket: '#f7f9ff',
    colors: { bg: '#edf2fa', bg2: '#ffffff', text: '#142036', muted: '#5c6b83', accent: '#3e66b5', accent2: '#7358a4', glow: 'rgba(62,102,181,.2)', border: 'rgba(20,32,54,.2)' },
    gradients: ['radial-gradient(circle at 78% 16%, rgba(121,143,217,.24), transparent 37%)', 'radial-gradient(circle at 22% 82%, rgba(151,112,193,.2), transparent 40%)'],
  },
  custom: {
    label: 'ТВОЙ ДЕНЬ', particle: '#4b866b', ticket: '#f7fff9',
    colors: { bg: '#eef6f1', bg2: '#ffffff', text: '#14241e', muted: '#567064', accent: '#2e8363', accent2: '#5f8f95', glow: 'rgba(46,131,99,.2)', border: 'rgba(20,36,30,.2)' },
    gradients: ['radial-gradient(circle at 18% 16%, rgba(93,166,149,.25), transparent 37%)', 'radial-gradient(circle at 82% 78%, rgba(198,162,104,.18), transparent 40%)'],
  },
};

function resolveTheme(theme, scheme) {
  if (scheme !== 'light') return theme;
  const override = lightThemeOverrides[Object.keys(themes).find((key) => themes[key] === theme) || 'neutral'];
  return override ? { ...theme, ...override } : theme;
}

function cleanCustomText(value, maxLength = 120) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function validatePosterUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function useMagnetic(active = true, phaseKey = '') {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || !window.matchMedia('(pointer:fine)').matches) return undefined;
    const move = (event) => { const rect = el.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width - .5) * 12; const y = ((event.clientY - rect.top) / rect.height - .5) * 12; el.style.setProperty('--mag-x', `${Math.max(-6, Math.min(6, x))}px`); el.style.setProperty('--mag-y', `${Math.max(-6, Math.min(6, y))}px`); };
    const leave = () => { el.style.setProperty('--mag-x', '0px'); el.style.setProperty('--mag-y', '0px'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [active, phaseKey]);
  return ref;
}

function rgba(hex, alpha) { const value = hex.replace('#', ''); const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value; const number = parseInt(full, 16); return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`; }

function ParticleField({ theme, reduced, active = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return undefined; const ctx = canvas.getContext('2d'); let width = 0; let height = 0; let raf = 0; const pointer = { x: 0, y: 0 };
    canvas.style.opacity = '0';
    if (!active) return undefined;
    const reveal = setTimeout(() => { canvas.style.opacity = '0.8'; }, 160);
    const particles = Array.from({ length: reduced ? 0 : (window.innerWidth < 640 ? 16 : 42) }, (_, i) => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.55 + .35, vx: (Math.random() - .5) * .00012 * theme.motion, vy: (Math.random() - .5) * .0001 * theme.motion, a: Math.random() * .42 + .12, phase: i * .7 }));
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); width = window.innerWidth; height = window.innerHeight; canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const move = (event) => { pointer.x = event.clientX / Math.max(width, 1) - .5; pointer.y = event.clientY / Math.max(height, 1) - .5; };
    const draw = (time) => { ctx.clearRect(0, 0, width, height); particles.forEach((p) => { p.x += p.vx; p.y += p.vy; if (p.x < -.03) p.x = 1.03; if (p.x > 1.03) p.x = -.03; if (p.y < -.03) p.y = 1.03; if (p.y > 1.03) p.y = -.03; ctx.beginPath(); ctx.arc(p.x * width + pointer.x * 8, p.y * height + pointer.y * 6, p.r, 0, Math.PI * 2); ctx.fillStyle = rgba(theme.particle, p.a * (.7 + Math.sin(time * .0006 + p.phase) * .3)); ctx.fill(); }); raf = requestAnimationFrame(draw); };
    resize(); window.addEventListener('resize', resize); window.addEventListener('pointermove', move, { passive: true }); if (!reduced) raf = requestAnimationFrame(draw);
    return () => { clearTimeout(reveal); cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); };
  }, [theme, reduced, active]);
  return <canvas ref={ref} className="particle-field" aria-hidden="true" />;
}

function CustomCursor() {
  const dot = useRef(null); const ring = useRef(null);
  useEffect(() => {
    if (!window.matchMedia('(pointer:fine)').matches) return undefined; let x = -100; let y = -100; let tx = x; let ty = y; let raf = 0;
    const move = (event) => { tx = event.clientX; ty = event.clientY; }; const tick = () => { x += (tx - x) * .18; y += (ty - y) * .18; if (dot.current) dot.current.style.transform = `translate3d(${x}px,${y}px,0)`; if (ring.current) ring.current.style.transform = `translate3d(${x}px,${y}px,0)`; raf = requestAnimationFrame(tick); };
    window.addEventListener('pointermove', move, { passive: true }); raf = requestAnimationFrame(tick); return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  return <><div className="cursor-dot" aria-hidden="true" ref={dot} /><div className="cursor-ring" aria-hidden="true" ref={ring} /></>;
}
function Artwork({ kind, compact = false, image }) { return <div className={`artwork artwork--${kind} ${compact ? 'artwork--compact' : ''} ${image ? 'has-image' : ''}`} aria-hidden="true">{image && <img src={image} alt="" loading={compact ? 'lazy' : 'eager'} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}{!image && <><span /><i /><b /></>}</div>; }
function Progress({ current }) { return <div className="progress" role="status" aria-label={`Шаг ${current} из 5`}><div><i style={{ width: `${current * 20}%` }} /></div></div>; }

export default function App() {
  const reduced = useReducedMotion();
  const colorScheme = usePreferredColorScheme();
  const localDateTime = useLocalDateTime();
  const sharedTicket = useMemo(() => readTicketRoute(), []);
  const sharedConcert = sharedTicket ? concerts.find((item) => item.id === sharedTicket.concertId) : null;
  const [phase, setPhase] = useState(sharedConcert ? 'ticket' : 'intro'); const [selectedId, setSelectedId] = useState(sharedConcert?.id || null); const [previewId, setPreviewId] = useState(null); const [noAttempts, setNoAttempts] = useState(0); const [noPosition, setNoPosition] = useState({ x: 0, y: 0, rotate: 0 }); const [modalOpen, setModalOpen] = useState(false); const [errorStage, setErrorStage] = useState(0); const [selectedPlace, setSelectedPlace] = useState(sharedTicket?.selection || null); const [customName, setCustomName] = useState(''); const [customDetails, setCustomDetails] = useState({ date: '', time: '', venue: '', posterUrl: '' }); const [customConcert, setCustomConcert] = useState(null); const [soundOn, setSoundOn] = useState(false); const [labelClicks, setLabelClicks] = useState(0); const [toast, setToast] = useState(''); const [activeAudioArtist, setActiveAudioArtist] = useState(null); const [introStep, setIntroStep] = useState(sharedConcert ? 5 : 0); const [ticketId, setTicketId] = useState(sharedTicket?.ticketId || null); const [introLeaving, setIntroLeaving] = useState(false);
  const previewAudio = useRef(null); const ambientContext = useRef(null); const ambientGain = useRef(null); const ambientNodes = useRef([]); const fadeTimer = useRef(null); const previewStopTimer = useRef(null); const activePreviewRef = useRef(null); const transitionTimer = useRef(null); const introTimer = useRef(null);
  const noWrap = useRef(null); const magneticRef = useMagnetic(!reduced, phase); const selected = customConcert || concerts.find((item) => item.id === selectedId) || null; const activeKey = previewId ? (concerts.find((item) => item.id === previewId)?.theme || 'neutral') : (selected?.theme || 'neutral'); const baseTheme = themes[activeKey] || themes.neutral; const theme = useMemo(() => resolveTheme(baseTheme, colorScheme), [baseTheme, colorScheme]);
  const style = useMemo(() => ({ '--bg': theme.colors.bg, '--bg-2': theme.colors.bg2, '--text': theme.colors.text, '--muted': theme.colors.muted, '--accent': theme.colors.accent, '--accent-2': theme.colors.accent2, '--glow': theme.colors.glow, '--border': theme.colors.border, '--mesh-a': theme.gradients[0], '--mesh-b': theme.gradients[1], '--ticket': theme.ticket }), [theme]);
  useEffect(() => {
    if (phase !== 'intro') return undefined;
    if (reduced) { setIntroStep(5); return undefined; }
    setIntroStep(0);
    const timers = [480, 1160, 1900, 2680, 3480].map((delay, index) => setTimeout(() => setIntroStep(index + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, [phase, reduced]);
  useEffect(() => { if (phase !== 'themeTransition') return undefined; const t = setTimeout(() => setPhase('details'), reduced ? 80 : 1080); return () => clearTimeout(t); }, [phase, reduced]);
  useEffect(() => { if (phase !== 'ticketPrinting') return undefined; const t = setTimeout(() => setPhase('ticket'), reduced ? 80 : 1480); return () => clearTimeout(t); }, [phase, reduced]);
  useEffect(() => { if (phase !== 'fakeError') return undefined; setErrorStage(0); const timers = [setTimeout(() => setErrorStage(1), reduced ? 50 : 500), setTimeout(() => setErrorStage(2), reduced ? 100 : 1100), setTimeout(() => setErrorStage(3), reduced ? 160 : 1850)]; return () => timers.forEach(clearTimeout); }, [phase, reduced]);
  useEffect(() => { if (!modalOpen) return undefined; const onKey = (event) => { if (event.key === 'Escape') setModalOpen(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [modalOpen]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if ((!soundOn || !activeAudioArtist || phase !== 'concerts') && (activeAudioArtist || previewAudio.current)) stopPreview(); return undefined; }, [soundOn, activeAudioArtist, phase]);
  useEffect(() => () => { clearTimeout(fadeTimer.current); clearTimeout(previewStopTimer.current); clearTimeout(transitionTimer.current); clearTimeout(introTimer.current); previewAudio.current?.pause(); ambientNodes.current.forEach((node) => node.stop?.()); ambientContext.current?.close?.(); }, []);
  const tone = (kind = 'click') => { if (!soundOn) return; try { const Context = window.AudioContext || window.webkitAudioContext; const context = new Context(); const osc = context.createOscillator(); const gain = context.createGain(); osc.frequency.value = kind === 'success' ? 660 : 220; gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.04, context.currentTime + .015); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .18); osc.connect(gain).connect(context.destination); osc.start(); osc.stop(context.currentTime + .2); } catch { /* sound is optional */ } };
  const startAmbient = () => {
    if (reduced) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    let context = ambientContext.current;
    if (!context || context.state === 'closed') {
      context = new Context();
      const master = context.createGain(); master.gain.value = 0;
      const lowPass = context.createBiquadFilter(); lowPass.type = 'lowpass'; lowPass.frequency.value = 680; lowPass.Q.value = .38;
      lowPass.connect(master).connect(context.destination);
      const nodes = [130.81, 196, 261.63].map((frequency, index) => {
        const oscillator = context.createOscillator(); const voice = context.createGain();
        oscillator.type = index === 1 ? 'triangle' : 'sine'; oscillator.frequency.value = frequency; voice.gain.value = index === 1 ? .026 : .018;
        oscillator.connect(voice).connect(lowPass); oscillator.start(); return oscillator;
      });
      ambientContext.current = context; ambientGain.current = master; ambientNodes.current = nodes;
    }
    context.resume().then(() => { const now = context.currentTime; const gain = ambientGain.current?.gain; if (!gain) return; gain.cancelScheduledValues(now); gain.setTargetAtTime(.08, now, .72); }).catch(() => {});
  };
  const stopAmbient = () => { const gain = ambientGain.current?.gain; const context = ambientContext.current; if (!gain || !context) return; const now = context.currentTime; gain.cancelScheduledValues(now); gain.setTargetAtTime(.0001, now, .18); };
  const toggleSound = () => { const next = !soundOn; setSoundOn(next); if (next) startAmbient(); else stopAmbient(); };
  const openQuestion = () => { if (introLeaving) return; tone(); startAmbient(); setSoundOn(true); setIntroLeaving(true); clearTimeout(introTimer.current); introTimer.current = setTimeout(() => { setPhase('question'); setIntroLeaving(false); }, reduced ? 40 : 420); }; const yes = () => { tone('success'); setPhase('concerts'); };
  const moveNo = () => { const box = noWrap.current; if (!box || reduced) return; const maxX = Math.max(0, box.clientWidth - 124); const maxY = Math.max(0, box.clientHeight - 54); setNoPosition({ x: Math.random() * maxX - maxX / 2, y: Math.random() * maxY - maxY / 2, rotate: Math.random() * 10 - 5 }); };
  const no = (event) => { event?.preventDefault(); tone(); const next = noAttempts + 1; setNoAttempts(next); if (next >= 4) { setModalOpen(true); return; } moveNo(); };
  const fadeAudio = (audio, target, duration, done) => { if (!audio) { done?.(); return; } const startVolume = audio.volume; const started = performance.now(); const tick = (time) => { const progress = Math.min(1, (time - started) / duration); audio.volume = startVolume + (target - startVolume) * progress; if (progress < 1) requestAnimationFrame(tick); else done?.(); }; requestAnimationFrame(tick); };
  const stopPreview = (requestedId) => { if (requestedId && activePreviewRef.current && requestedId !== activePreviewRef.current) return; clearTimeout(fadeTimer.current); clearTimeout(previewStopTimer.current); const audio = previewAudio.current; activePreviewRef.current = null; setActiveAudioArtist(null); previewAudio.current = null; if (!audio) return; fadeAudio(audio, 0, 450, () => { audio.pause(); audio.removeAttribute('src'); }); };
  const startPreview = (item) => { if (!soundOn || phase !== 'concerts' || !item?.audioPreview) return; clearTimeout(fadeTimer.current); clearTimeout(previewStopTimer.current); if (activePreviewRef.current === item.id) return; stopPreview(); const audio = new Audio(item.audioPreview.previewUrl); audio.preload = 'none'; audio.loop = false; audio.volume = 0; previewAudio.current = audio; activePreviewRef.current = item.id; setActiveAudioArtist(item.id); audio.play().then(() => { if (activePreviewRef.current !== item.id) return; fadeAudio(audio, .085, 500); previewStopTimer.current = setTimeout(() => stopPreview(item.id), 12000); }).catch(() => { if (activePreviewRef.current === item.id) { activePreviewRef.current = null; setActiveAudioArtist(null); } }); };
  const chooseConcert = (item) => { clearTimeout(transitionTimer.current); stopPreview(); tone('success'); setSelectedId(item.id); setCustomConcert(null); setSelectedPlace(null); setTicketId(null); setPreviewId(null); if (reduced) { setPhase('themeTransition'); return; } transitionTimer.current = setTimeout(() => setPhase('themeTransition'), 90); };
  const customSubmit = (event) => {
    event.preventDefault();
    const name = cleanCustomText(customName, 90);
    if (!name) { setToast('Напиши название концерта.'); return; }
    const posterUrl = validatePosterUrl(customDetails.posterUrl);
    if (posterUrl === null) { setToast('Ссылка на афишу должна начинаться с http:// или https://.'); return; }
    const date = cleanCustomText(customDetails.date, 70);
    const time = cleanCustomText(customDetails.time, 30);
    const venue = cleanCustomText(customDetails.venue, 100);
    setCustomName(name);
    setCustomDetails((current) => ({ ...current, date, time, venue, posterUrl: posterUrl || '' }));
    setCustomConcert({
      id: 'custom', artist: name,
      date: date || 'дата по договорённости',
      time: time || 'время по договорённости',
      venue: venue || 'место, которое мы выберем',
      city: 'Санкт-Петербург', address: 'адрес по договорённости', ageLimit: 'уточним',
      theme: 'custom', artwork: 'custom', image: posterUrl || undefined, posterUrl: posterUrl || '',
      statusText: 'твоя идея', price: '—', sources: posterUrl ? [posterUrl] : [], mapNote: 'Схема для этого варианта появится после выбора события.',
      seatMap: { type: 'unavailable', selectionMode: 'unavailable', available: false, label: 'Схема пока не определена.' }, conflict: '',
    });
    setSelectedId('custom'); setSelectedPlace(null); setTicketId(null); setPhase('themeTransition'); tone('success');
  };
  const printTicket = () => {
    const nextTicketId = ticketId || createTicketId();
    const nextPath = ticketPathFor(selected, selectedPlace, nextTicketId);
    if (nextPath && window.location.pathname !== nextPath) window.history.replaceState({}, '', nextPath);
    setTicketId(nextTicketId);
    tone('success');
    setPhase('ticketPrinting');
  };
  const reset = () => { clearTimeout(transitionTimer.current); clearTimeout(introTimer.current); stopPreview(); stopAmbient(); if (window.location.pathname.startsWith('/ticket/')) window.history.replaceState({}, '', '/'); setSoundOn(false); setIntroLeaving(false); setPhase('intro'); setSelectedId(null); setCustomConcert(null); setCustomName(''); setCustomDetails({ date: '', time: '', venue: '', posterUrl: '' }); setPreviewId(null); setSelectedPlace(null); setTicketId(null); setIntroStep(0); setNoAttempts(0); setNoPosition({ x: 0, y: 0, rotate: 0 }); setModalOpen(false); setErrorStage(0); setToast(''); };
  const labelClick = () => { const count = labelClicks + 1; setLabelClicks(count); if (count >= 5) setToast('Петербург слушает.'); };

  const selection = selectionDetails(selected?.seatMap, selectedPlace);
  const ticketPath = ticketPathFor(selected, selectedPlace, ticketId);
  const ticketUrl = ticketPath ? `${window.location.origin}${ticketPath}` : null;

  return <div className={`stage stage--${phase} stage--${colorScheme} ${previewId ? 'stage--preview' : ''} ${introLeaving ? 'stage--introLeaving' : ''} ${phase === 'intro' ? `stage--intro-step-${introStep}` : ''}`} data-color-scheme={colorScheme} style={style}><ParticleField theme={theme} reduced={reduced} active={phase !== 'intro' || introStep >= 3} /><div className={`city-echo city-echo--${phase} ${phase === 'intro' ? `city-echo--step-${introStep}` : ''} ${introLeaving ? 'is-leaving' : ''}`} aria-hidden="true" /><div className="mesh" aria-hidden="true" /><div className="haze haze--left" aria-hidden="true" /><div className="haze haze--right" aria-hidden="true" /><div className="grain" aria-hidden="true" /><div className="vignette" aria-hidden="true" /><CustomCursor />
    <header className="topbar"><button className="wordmark" onClick={labelClick} aria-label="Тихая ночь, пасхалка">Н / 27 <span>СПБ</span></button><div className="topbar__right"><span className="live-dot" /><span>{theme.label}</span><button className="sound-toggle" onClick={toggleSound} aria-pressed={soundOn}>{soundOn ? 'ЗВУК ВКЛ.' : 'ЗВУК ВЫКЛ.'}</button></div></header>
    <main>
      {phase === 'intro' && <Intro step={introStep} localDateTime={localDateTime} leaving={introLeaving} onOpen={openQuestion} onLabel={labelClick} clicks={labelClicks} magneticRef={magneticRef} />}
      {phase === 'question' && <Question reduced={reduced} attempts={noAttempts} position={noPosition} onNo={no} onHover={moveNo} onYes={yes} noWrap={noWrap} magneticRef={magneticRef} />}
      {(phase === 'concerts' || phase === 'themeTransition') && <ConcertListV2 phase={phase} selected={selected} previewId={previewId} activeAudioArtist={activeAudioArtist} selectedId={selectedId} onPreview={setPreviewId} onPreviewAudio={startPreview} onStopPreview={stopPreview} onChoose={chooseConcert} customName={customName} setCustomName={setCustomName} customDetails={customDetails} setCustomDetails={setCustomDetails} onCustom={customSubmit} soundOn={soundOn} />}
      {phase === 'details' && selected && <Details selected={selected} onNext={() => setPhase('venue')} magneticRef={magneticRef} />}
      {phase === 'venue' && selected && <Venue selected={selected} onNext={printTicket} magneticRef={magneticRef} />}
      {phase === 'ticketPrinting' && selected && <TicketPrinting selected={selected} selection={selection} ticketId={ticketId} ticketUrl={ticketUrl} />}
      {phase === 'ticket' && selected && <Ticket selected={selected} selection={selection} ticketId={ticketId} ticketUrl={ticketUrl} onToast={setToast} />}
      {phase === 'fakeError' && <FakeError stage={errorStage} onRetry={() => { setPhase('question'); setNoAttempts(0); }} />}
    </main>
    {modalOpen && <RefusalModal onClose={() => setModalOpen(false)} onBack={() => { setModalOpen(false); setPhase('question'); setNoAttempts(0); }} onConfirm={() => { setModalOpen(false); setPhase('fakeError'); }} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function Intro({ step, localDateTime, leaving, onOpen, onLabel, clicks, magneticRef }) {
  return <section className={`screen intro-screen intro-screen--step-${step} ${leaving ? 'is-leaving' : ''}`} aria-labelledby="intro-title">
    <div className="intro-light-reveal" aria-hidden="true" />
    <div className="intro-orbit" aria-hidden="true"><span>САНКТ-ПЕТЕРБУРГ</span><span>59° 56′ с. ш. / 30° 19′ в. д.</span></div>
    <div className="intro-sequence" aria-live="polite">
      <p className="intro-date">{localDateTime.date} · {localDateTime.time}</p>
      <p className="intro-city-label">САНКТ-ПЕТЕРБУРГ</p>
      <p className="intro-line">НЕВА / ИСААКИЙ / НОЧНЫЕ ОГНИ</p>
    </div>
    <div className="intro-copy">
      <button className="eyebrow eyebrow-button" onClick={onLabel} aria-label="Пасхалка, счётчик нажатий">ОДИН ВОПРОС</button>
      <h1 id="intro-title">У меня есть<br /><em>один вопрос…</em></h1>
      <p className="lede">Можно мы будем этот день<br className="desktop-only" /> только вдвоём?</p>
      <button ref={magneticRef} className="button button--primary magnetic" onClick={onOpen}>Открыть письмо <span>↗</span></button>
    </div>
  </section>;
}
function Question({ reduced, attempts, position, onNo, onHover, onYes, noWrap, magneticRef }) { return <section className="screen question-screen" aria-labelledby="question-title"><Progress current={1} /><div className="question-layout"><div><p className="eyebrow">ПЕРЕД ВЫБОРОМ</p><h2 id="question-title">Ты пойдёшь<br /><em>со мной?</em></h2><p className="lede">Перед тем как я расскажу куда — ответь<br className="desktop-only" /> на один маленький вопрос.</p></div><div className="answer-zone" ref={noWrap}><button ref={magneticRef} className="button button--primary magnetic answer-button" onClick={onYes}>Да, конечно <span>→</span></button><button className="button button--ghost dodge-button" style={{ transform: `translate(${position.x}px, ${position.y}px) rotate(${position.rotate}deg)` }} onPointerEnter={onHover} onFocus={onHover} onClick={onNo} aria-label="Ответить нет">{noCopy[Math.min(attempts, noCopy.length - 1)]}</button><p className="tiny-note">обещаю, это займёт меньше минуты{reduced ? '' : ' · попробуй поймать «нет»'}</p></div></div><div className="question-aside"><span>ПРОСТОЙ ВОПРОС</span><span>СЛОЖНЫЙ ОТВЕТ</span></div></section>; }
function ConcertListV2({ phase, selected, previewId, activeAudioArtist, selectedId, onPreview, onPreviewAudio, onStopPreview, onChoose, customName, setCustomName, customDetails, setCustomDetails, onCustom, soundOn }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const pointerRef = useRef({ id: null, startX: 0, startY: 0, lastX: 0, lastTime: 0, moved: false, axis: null, captured: false });
  const suppressClickRef = useRef(false);
  const carouselRef = useRef(null);
  const customNameInputRef = useRef(null);
  const customLaunchRef = useRef(null);
  const customSlideIndex = concerts.length;
  const carouselItems = [...concerts, { id: 'custom-option', artist: 'свой концерт' }];
  useEffect(() => {
    if (selectedId === 'custom') {
      setActiveIndex(customSlideIndex);
      setCustomFormOpen(true);
      return;
    }
    const selectedIndex = concerts.findIndex((item) => item.id === selectedId);
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
  }, [selectedId, customSlideIndex]);
  const clampIndex = (index) => Math.max(0, Math.min(carouselItems.length - 1, index));
  const goTo = (index) => { setActiveIndex(clampIndex(index)); setDragX(0); };
  const handleClick = (event, item) => {
    if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); return; }
    const pointerType = event.nativeEvent?.pointerType;
    if (pointerType === 'touch' && soundOn && previewId !== item.id) {
      onPreview(item.id); onPreviewAudio(item); return;
    }
    onChoose(item);
  };
  const enter = (event, item) => { if (event?.pointerType === 'touch') return; onPreview(item.id); if (soundOn) onPreviewAudio(item); };
  const leave = (event, item) => { if (event?.pointerType === 'touch') return; onPreview(null); onStopPreview(item.id); };
  const focusEnter = (event, item) => { if (!event.currentTarget.contains(event.relatedTarget)) enter(null, item); };
  const focusLeave = (event, item) => { if (!event.currentTarget.contains(event.relatedTarget)) leave(null, item); };
  const openCustomForm = () => {
    if (phase !== 'concerts') return;
    onPreview(null);
    onStopPreview();
    setCustomFormOpen(true);
    requestAnimationFrame(() => customNameInputRef.current?.focus());
  };
  const closeCustomForm = () => {
    setCustomFormOpen(false);
    requestAnimationFrame(() => customLaunchRef.current?.focus());
  };
  const onPointerDown = (event) => {
    if (phase !== 'concerts' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const now = performance.now();
    // Do not capture on pointerdown: capturing here changes the click target
    // from the card button to the carousel in desktop browsers.
    pointerRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: now, moved: false, axis: null, captured: false };
    setDragging(true);
  };
  const onPointerMove = (event) => {
    const state = pointerRef.current;
    if (state.id !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) state.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    if (state.axis !== 'x') return;
    if (!state.captured) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      state.captured = true;
    }
    state.moved = true;
    state.lastX = event.clientX;
    state.lastTime = performance.now();
    if (event.cancelable) event.preventDefault();
    setDragX(dx);
  };
  const finishPointer = (event, cancelled = false) => {
    const state = pointerRef.current;
    if (state.id !== event.pointerId) return;
    const delta = event.clientX - state.startX;
    const elapsed = Math.max(16, performance.now() - (state.lastTime || performance.now()));
    const velocity = Math.abs(delta) / elapsed;
    const shouldAdvance = !cancelled && state.axis === 'x' && (Math.abs(delta) > 64 || velocity > .45);
    // A desktop click can contain a few pixels of pointer jitter. Only
    // suppress the button click after an intentional horizontal drag.
    const intentionalDrag = state.axis === 'x' && Math.abs(delta) > 14;
    if (intentionalDrag) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 140);
    }
    if (shouldAdvance) setActiveIndex((current) => clampIndex(current + (delta < 0 ? 1 : -1)));
    setDragX(0);
    setDragging(false);
    if (state.captured) event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerRef.current = { id: null, startX: 0, startY: 0, lastX: 0, lastTime: 0, moved: false, axis: null, captured: false };
  };
  const onCarouselKeyDown = (event) => {
    if (phase !== 'concerts') return;
    if (event.target !== event.currentTarget) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('.custom-pick')))) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeIndex + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeIndex - 1); }
    if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    if (event.key === 'End') { event.preventDefault(); goTo(carouselItems.length - 1); }
  };
  return <section className="screen concerts-screen" aria-labelledby="concerts-title">
    <div className="section-head"><div><p className="eyebrow">ТВОЙ ВЕЧЕР</p><h2 id="concerts-title">Тогда осталось<br /><em>выбрать звук.</em></h2><p className="lede">У меня есть несколько идей.<br />Наведи курсор — почувствуешь разницу.</p></div></div>
    <div className="concert-carousel" ref={carouselRef} role="region" aria-roledescription="карусель" aria-label="Выбор концерта" tabIndex={0} onKeyDown={onCarouselKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={(event) => finishPointer(event, true)}>
      <div className={`concert-track ${dragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(calc(${activeIndex * -100}% + ${dragX}px), 0, 0)` }}>
      {concerts.map((item, index) => <div key={item.id} aria-hidden={index !== activeIndex} className={`concert-card-wrap ${activeAudioArtist === item.id ? 'is-previewing' : ''} ${phase === 'themeTransition' ? (selectedId === item.id ? 'is-transition-selected' : 'is-transition-muted') : ''}`} onPointerEnter={(event) => enter(event, item)} onPointerLeave={(event) => leave(event, item)} onFocus={(event) => focusEnter(event, item)} onBlur={(event) => focusLeave(event, item)}>
      <button tabIndex={index === activeIndex ? 0 : -1} className={`concert-card concert-card--${item.artwork} ${selectedId === item.id ? 'is-selected' : ''} ${activeAudioArtist === item.id ? 'is-previewing' : ''}`} onClick={(event) => handleClick(event, item)} aria-label={`Выбрать концерт ${item.artist}. Карточка ${index + 1} из ${carouselItems.length}`}>
        <Artwork kind={item.artwork} image={item.image} compact /><span className="card-wash" /><span className="card-top"><span>КОНЦЕРТ</span><span>{item.ageLimit}</span></span>
        {activeAudioArtist === item.id && <span className="audio-preview" aria-label={`Музыкальный фрагмент ${item.audioPreview?.title || ''}`}><span className="audio-bars"><i /><i /><i /></span> ♪ ФРАГМЕНТ <small>Apple Music · iTunes</small></span>}
        <span className="card-content"><span className="card-kicker">{item.city} · {item.date}</span><strong>{item.artist}</strong><span>{item.venue}</span><small>{item.time} · {item.price}</small></span><span className="card-arrow">↗</span>
      </button>
      {item.audioPreview && <a className="card-audio-credit" href={item.audioPreview.trackUrl} target="_blank" rel="noreferrer" tabIndex={index === activeIndex && activeAudioArtist === item.id ? 0 : -1}>Фрагмент: {item.audioPreview.title} · предоставлено iTunes ↗</a>}
    </div>)}
      <div key="custom-option" aria-hidden={customSlideIndex !== activeIndex} className={`concert-card-wrap concert-card-wrap--custom ${customFormOpen ? 'is-custom-open' : ''} ${phase === 'themeTransition' ? (selectedId === 'custom' ? 'is-transition-selected' : 'is-transition-muted') : ''}`}>
        <div className="custom-concert-card">
          <Artwork kind="custom" compact />
          <span className="card-wash" />
          <span className="card-top"><span>ТВОЙ ВАРИАНТ</span><span>03</span></span>
          {!(customFormOpen && customSlideIndex === activeIndex) ? <button ref={customLaunchRef} type="button" tabIndex={customSlideIndex === activeIndex ? 0 : -1} className="custom-card-launch" onClick={openCustomForm} aria-label="Открыть форму своего концерта, карточка 3 из 3">
            <span className="custom-card-launch__content"><span className="card-kicker">СВОЙ КОНЦЕРТ</span><strong>Или у тебя есть<br /><em>идея получше?</em></strong><span>Добавь свой концерт и детали, если захочешь.</span><span className="custom-card-launch__action">Рассказать идею <b>→</b></span></span>
          </button> : <form className="custom-pick custom-pick--card" onSubmit={onCustom} onPointerDown={(event) => event.stopPropagation()} onPointerMove={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onPointerCancel={(event) => event.stopPropagation()}>
            <div className="custom-pick__header"><label htmlFor="custom-concert">Или у тебя есть идея получше?</label><button type="button" className="custom-pick__collapse" onClick={closeCustomForm}>Свернуть</button></div>
            <div className="custom-pick__name"><input ref={customNameInputRef} id="custom-concert" value={customName} maxLength={90} onChange={(event) => setCustomName(event.target.value)} placeholder="Напиши название концерта…" /><button className="button button--line" type="submit">Выбрать <span>→</span></button></div>
            <p className="custom-pick__hint">Название обязательно. Остальное — по желанию: добавь детали и ссылку на афишу.</p>
            <div className="custom-pick__details">
              <label><span>Дата</span><input value={customDetails.date} maxLength={70} onChange={(event) => setCustomDetails((current) => ({ ...current, date: event.target.value }))} placeholder="например, 18 октября 2026" /></label>
              <label><span>Время</span><input value={customDetails.time} maxLength={30} onChange={(event) => setCustomDetails((current) => ({ ...current, time: event.target.value }))} placeholder="20:00" /></label>
              <label><span>Площадка</span><input value={customDetails.venue} maxLength={100} onChange={(event) => setCustomDetails((current) => ({ ...current, venue: event.target.value }))} placeholder="место проведения" /></label>
              <label className="custom-pick__poster"><span>Ссылка на афишу</span><input type="url" value={customDetails.posterUrl} maxLength={500} onChange={(event) => setCustomDetails((current) => ({ ...current, posterUrl: event.target.value }))} placeholder="https://…" inputMode="url" /></label>
            </div>
          </form>}
        </div>
      </div></div>
    </div>
    <div className="carousel-controls" aria-label="Управление каруселью"><button className="carousel-arrow" type="button" onClick={() => goTo(activeIndex - 1)} disabled={phase !== 'concerts' || activeIndex === 0} aria-label="Предыдущий концерт">←</button><div className="carousel-dots" role="tablist" aria-label="Концерты">{carouselItems.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={index === activeIndex} aria-label={item.id === 'custom-option' ? 'Показать свой концерт' : `Показать концерт ${item.artist}`} className={`carousel-dot ${index === activeIndex ? 'is-active' : ''}`} onClick={() => goTo(index)} disabled={phase !== 'concerts'} />)}</div><button className="carousel-arrow" type="button" onClick={() => goTo(activeIndex + 1)} disabled={phase !== 'concerts' || activeIndex === carouselItems.length - 1} aria-label="Следующий концерт">→</button><span className="carousel-count" aria-live="polite">{activeIndex + 1} из {carouselItems.length}</span></div><p className="carousel-hint">Листай карточки взмахом или используй ← →</p>
    {phase === 'themeTransition' && <VenueTransit selected={selected} />}
  </section>;
}

function VenueTransit({ selected }) {
  if (!selected) return null;
  return <div className="theme-transition" aria-label={`Переходим к площадке ${selected.venue}`} role="status">
    <div className="venue-transit__city" aria-hidden="true" />
    <div className="venue-transit__veil" aria-hidden="true" />
    <div className="venue-transit__marker"><span>САНКТ-ПЕТЕРБУРГ / ПРИБЛИЖАЕМСЯ</span><strong>{selected.venue}</strong><small>{selected.address}</small></div>
  </div>;
}

function Details({ selected, onNext, magneticRef }) { return <section className="screen details-screen" aria-labelledby="details-title"><Progress current={3} /><div className="details-hero"><Artwork kind={selected.artwork} image={selected.image} /><div className="details-copy"><p className="eyebrow">ВЫБРАННАЯ ВОЛНА</p><h2 id="details-title"><em>{selected.artist}</em><br />в Петербурге.</h2><div className="detail-lines"><div><span>ДАТА</span><strong>{selected.date}</strong></div><div><span>ВРЕМЯ</span><strong>{selected.time}</strong></div><div><span>ПЛОЩАДКА</span><strong>{selected.venue}</strong></div><div><span>ГОРОД</span><strong>{selected.city}</strong></div></div><p className="notice">{selected.statusText || selected.status} · {selected.ageLimit}</p>{selected.sources?.length > 0 && <div className="source-links" aria-label="Источники события">{selected.sources.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">{selected.id === 'custom' ? 'афиша события' : (index === 0 ? 'источник события' : 'билетная афиша')} ↗</a>)}</div>}<button ref={magneticRef} className="button button--primary magnetic" onClick={onNext}>Проверить площадку <span>→</span></button></div></div></section>; }
function Venue({ selected, onNext, magneticRef }) { return <section className="screen venue-screen" aria-labelledby="venue-title"><Progress current={4} /><div className="venue-wrap"><p className="eyebrow">СЛЕДУЮЩАЯ ТОЧКА</p><h2 id="venue-title">Отличный выбор.<br /><em>Подтвердим</em><br />эту историю?</h2><div className="venue-card"><div className="venue-card__meta"><span>ПЛОЩАДКА</span><span>{selected.city}</span></div><h3>{selected.venue}</h3><p>{selected.address}</p><div className="venue-card__rule" /><div className="venue-card__facts"><span><b>ДАТА</b>{selected.date}</span><span><b>ВРЕМЯ</b>{selected.time}</span><span><b>ВОЗРАСТ</b>{selected.ageLimit}</span></div></div><p className="venue-prompt">Место не выбираем — дальше только твой билет.</p><button ref={magneticRef} className="button button--primary magnetic" onClick={onNext}>Подтвердить выбор <span>→</span></button><p className="disclaimer">Создадим памятный билет, а не бронирование. Актуальные места и наличие — у билетного оператора.</p>{selected.conflict && <p className="conflict">{selected.conflict}</p>}</div></section>; }
function escapeSvg(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }

function placeLines(selection, map) {
  if (!selection) return [{ label: 'ФОРМАТ', value: 'ЦИФРОВОЕ ПРИГЛАШЕНИЕ' }];
  if (selection.type === 'sector') return [{ label: 'ТИП', value: selectionModeLabel(map, selection) }, { label: 'СЕКТОР', value: selection.sector }];
  const lines = [{ label: 'ТИП', value: selectionModeLabel(map, selection) }, { label: 'СЕКТОР', value: selection.sector }, { label: 'РЯД', value: selection.row }, { label: 'МЕСТО', value: selection.seat }];
  if (selection.category) lines.push({ label: 'КАТЕГОРИЯ', value: selection.category });
  if (selection.price) lines.push({ label: 'ЦЕНА', value: selection.price });
  return lines;
}

function telegramMessage(selected, ticketUrl) {
  const lines = [
    'Привет! Я выбрала концерт.',
    '',
    `Концерт: ${selected.artist}`,
    `Дата: ${selected.date} · ${selected.time}`,
    `Площадка: ${selected.venue}, Санкт-Петербург`,
  ];
  if (ticketUrl) lines.push('', `Мой билет: ${ticketUrl}`);
  return lines.join('\n');
}

function ticketSvg(selected, selection, ticketId, qrDataUrl) {
  const artist = escapeSvg(selected.artist); const date = escapeSvg(selected.date); const time = escapeSvg(selected.time); const venue = escapeSvg(selected.venue); const address = escapeSvg(selected.address); const city = escapeSvg(selected.city); const id = escapeSvg(ticketId);
  const fieldLines = placeLines(selection, selected.seatMap).map((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return `<text x="${120 + column * 360}" y="${635 + row * 34}" fill="#f19bc9" font-family="monospace" font-size="19" letter-spacing="2">${escapeSvg(`${item.label} · ${item.value}`)}</text>`;
  }).join('');
  const qr = qrDataUrl ? `<rect x="1110" y="552" width="190" height="190" fill="#171019" stroke="#dd9abc" stroke-opacity=".58"/><image href="${escapeSvg(qrDataUrl)}" x="1120" y="562" width="170" height="170"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><rect width="1440" height="900" fill="#111016"/><rect x="80" y="80" width="1280" height="740" rx="4" fill="#1a141f" stroke="#dd9abc" stroke-opacity=".58"/><circle cx="80" cy="500" r="25" fill="#111016"/><circle cx="1360" cy="500" r="25" fill="#111016"/><path d="M110 195H1330" stroke="#dd9abc" stroke-opacity=".38" stroke-dasharray="9 11"/><text x="120" y="150" fill="#bba9b7" font-family="monospace" font-size="22" letter-spacing="5">ПАМЯТНЫЙ БИЛЕТ</text><text x="1320" y="150" fill="#bba9b7" font-family="monospace" font-size="22" text-anchor="end" letter-spacing="5">${city}</text><text x="120" y="315" fill="#f8eefa" font-family="Georgia, serif" font-size="108">${artist}</text><text x="120" y="405" fill="#f19bc9" font-family="Georgia, serif" font-size="56">${date} · ${time}</text><text x="120" y="485" fill="#f8eefa" font-family="Arial, sans-serif" font-size="35">${venue}</text><text x="120" y="532" fill="#bba9b7" font-family="Arial, sans-serif" font-size="25">${address}</text>${fieldLines}<text x="120" y="755" fill="#bba9b7" font-family="monospace" font-size="19" letter-spacing="3">ЭТО НЕ ПРОПУСК · ЭТО НАША ИСТОРИЯ</text><text x="1320" y="790" fill="#f19bc9" font-family="monospace" font-size="19" text-anchor="end" letter-spacing="3">НОМЕР БИЛЕТА · ${id}</text>${qr}</svg>`;
}

function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

async function saveTicketPng(svgMarkup, filename) {
  const svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = svgUrl; });
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 900;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('png_failed');
    downloadBlob(blob, filename);
  } finally { URL.revokeObjectURL(svgUrl); }
}

function TicketPrinting({ selected, selection, ticketId, ticketUrl }) {
  const qrDataUrl = useTicketQr(ticketQrPayload(selected, selection, ticketId, ticketUrl));
  return <section className="screen ticket-printing-screen" aria-label="Печатаем билет" role="status"><div className="ticket-printing-copy"><p className="eyebrow">ПЕЧАТЬ БИЛЕТА</p><h2>Печатаем<br /><em>твой билет.</em></h2></div><div className="print-ticket" aria-hidden="true"><div className="print-ticket__top" /><div className="print-ticket__brand">{selected.artist}</div><div className="print-ticket__details">{selected.date} · {selected.time}<br />{selected.venue}</div>{qrDataUrl && <img className="print-ticket__qr" src={qrDataUrl} alt="" />}<div className="print-ticket__id">{ticketId}</div></div><p className="printing-status">контур → данные → QR-код → номер билета</p></section>;
}

function Ticket({ selected, selection, ticketId, ticketUrl, onToast }) {
  const qrDataUrl = useTicketQr(ticketQrPayload(selected, selection, ticketId, ticketUrl));
  const share = () => {
    const message = telegramMessage(selected, ticketUrl);
    window.open(`https://t.me/anrchx?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };
  const save = async () => {
    if (!qrDataUrl) { onToast('QR-код ещё готовится. Попробуй через секунду.'); return; }
    const svgMarkup = ticketSvg(selected, selection, ticketId, qrDataUrl);
    try {
      await saveTicketPng(svgMarkup, `билет-${ticketId}.png`);
      onToast('Билет сохранён как PNG.');
    } catch {
      onToast('Не удалось сохранить PNG. Попробуй ещё раз.');
    }
  };
  const fields = placeLines(selection, selected.seatMap);
  return <section className="screen ticket-screen" aria-labelledby="ticket-title"><div className="ticket-intro"><p className="eyebrow">БИЛЕТ ГОТОВ</p><h2 id="ticket-title">Билет<br /><em>напечатан.</em></h2><p>Памятный билет, а не пропуск на мероприятие.</p></div><div className="ticket" aria-label={`Памятный билет на ${selected.artist}, ${selected.date}`}><div className="ticket__top"><span>ПАМЯТНЫЙ БИЛЕТ</span><span>{selected.city}</span></div><div className="ticket__body"><div className="ticket__brand">{selected.artist}</div><div className="ticket__date"><span>{selected.date}</span><strong>{selected.time}</strong></div><div className="ticket__venue"><span>{selected.venue}</span><small>{selected.address}</small></div><div className="ticket__seat">{fields.map((item) => <span key={item.label}><b>{item.label}</b>{item.value}</span>)}</div>{qrDataUrl && <img className="ticket__qr" src={qrDataUrl} alt={`QR-код билета ${ticketId}`} />}</div><div className="ticket__foot"><span>ЭТО НЕ ПРОПУСК · ЭТО НАША ИСТОРИЯ</span><span>НОМЕР БИЛЕТА · {ticketId}</span></div></div><div className="ticket-actions" aria-label="Действия с билетом"><button className="button button--primary" onClick={share}>Поделиться в Telegram <span>↗</span></button><button className="button button--ghost" onClick={save}>Сохранить билет <span>↓</span></button></div></section>;
}
function FakeError({ stage, onRetry }) { return <section className="screen error-screen" aria-labelledby="error-title" role="status"><div className="error-frame"><p className="eyebrow">СООБЩЕНИЕ СИСТЕМЫ</p><div className={`error-code ${stage >= 1 ? 'is-visible' : ''}`}>ОШИБКА 418</div><div className={`error-lines ${stage >= 2 ? 'is-visible' : ''}`}><span>ПРИГЛАШЕНИЕ_ОТКЛОНЕНО</span><span>СЦЕНАРИЙ_НЕ_ПОДДЕРЖИВАЕТСЯ</span><span>ПОПРОБУЙ_ЕЩЁ_РАЗ_С_ЧУВСТВАМИ</span></div><h2 id="error-title" className={stage >= 3 ? 'is-visible' : ''}>Кажется, система<br /><em>не поддерживает</em><br />такой сценарий.</h2><button className={`button button--line ${stage >= 3 ? 'is-visible' : ''}`} onClick={onRetry}>Попробовать ещё раз <span>↻</span></button></div></section>; }
function RefusalModal({ onClose, onBack, onConfirm }) {
  const modalRef = useRef(null);
  useEffect(() => {
    const modal = modalRef.current; if (!modal) return undefined;
    const previous = document.activeElement; const focusable = () => [...modal.querySelectorAll('button')]; focusable()[0]?.focus();
    const trap = (event) => { if (event.key !== 'Tab') return; const items = focusable(); if (!items.length) return; const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
    modal.addEventListener('keydown', trap); return () => { modal.removeEventListener('keydown', trap); if (previous && typeof previous.focus === 'function') previous.focus(); };
  }, []);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="Закрыть">×</button><span className="modal-mark">?</span><p className="eyebrow">И ЕЩЁ КОЕ-ЧТО</p><h2 id="modal-title">Ты действительно<br /><em>этого хочешь?</em></h2><p>Я просто уточняю. Это довольно важный ответ.</p><div className="modal-actions"><button className="button button--primary" onClick={onBack}>Передумала</button><button className="button button--ghost" onClick={onConfirm}>Да</button></div></div></div>;
}
