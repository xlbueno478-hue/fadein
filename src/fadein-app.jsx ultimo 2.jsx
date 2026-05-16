import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ═══════════════════════════════════════════════════════════════════════════
// PROGRAMA DE INDICAÇÃO ("Indique e ganhe 1 mês grátis")
// ═══════════════════════════════════════════════════════════════════════════
// Quando alguém chega no app via link de indicação (`?ref=<uuid_do_indicador>`),
// guardamos o uid no localStorage. Quando essa pessoa cria a barbearia (insert
// em `shops`), gravamos `referred_by` apontando pra quem indicou. Daí em diante:
//   - O indicador vê o contador de indicações dele crescer no Config.
//   - O indicado ganha um banner "50% off no 1º mês" no login (psicológico).
//   - O processamento financeiro (estender trial / aplicar desconto) é manual
//     no painel admin do Supabase, olhando a coluna `referred_by`.
//
// Roda só na primeira render do módulo. Limpa o `?ref=` da URL pra não duplicar
// captura se o usuário recarregar depois de logar.
const REFERRAL_KEY = "fadein:referredBy";
(function captureReferralOnLoad() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    // Aceita só formato UUID v4 — protege contra junk/SQL injection no link
    if (ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
      localStorage.setItem(REFERRAL_KEY, ref);
      params.delete("ref");
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
    }
  } catch (e) { /* localStorage indisponível em modo privado: ignora silenciosamente */ }
})();


// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
const C = {
  // Backgrounds (preto oficial #1A1A1A)
  bg:          "#1A1A1A",
  bgRaised:    "#222020",
  bgSunken:    "#0F0F0F",
  // Cards
  card:        "#1F1C19",
  card2:       "#2A2622",
  cardHover:   "#2D2925",
  // Borders (marrom oficial #2A2218)
  border:      "#2A2218",
  borderHi:    "#3D342A",
  // Text (creme oficial #F5F0E8)
  fg:          "#F5F0E8",
  fgMuted:     "#A39A8C",
  muted:       "#6B6258",
  faded:       "#3F3A33",
  // Brand (ouro oficial #D4A844)
  gold:        "#B8902F",
  goldBright:  "#D4A844",
  goldDim:     "rgba(212, 168, 68, 0.12)",
  goldFaint:   "rgba(212, 168, 68, 0.06)",
  // Status
  green:       "#5BAF6F",
  greenDim:    "rgba(91, 175, 111, 0.15)",
  red:         "#E25A5A",
  redDim:      "rgba(226, 90, 90, 0.15)",
  amber:       "#E89C42",
  amberDim:    "rgba(232, 156, 66, 0.15)",
  blue:        "#5A9BE2",
};

// Global CSS injected once (scrollbars + animations + base styles)
const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; }

  /* Scrollbar custom — combina com a estética dark/gold */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: ${C.bgSunken}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.borderHi}; }
  ::-webkit-scrollbar-corner { background: ${C.bgSunken}; }
  * { scrollbar-width: thin; scrollbar-color: ${C.border} ${C.bgSunken}; }

  /* Selection */
  ::selection { background: ${C.goldBright}; color: #0A0908; }

  /* Animations */
  /* fadeIn: curva expo-out (mesma do loading) pra dar peso premium na troca de
     tela. translateY um pouco maior (8px) e duração 0.35s deixam a transição
     legível sem virar lentidão. O "both" mantém o estado inicial antes de
     rodar, evitando o flash de conteúdo já posicionado. */
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .fade-in { animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .slide-in { animation: slideIn 0.25s ease-out; }
  .pulse { animation: pulse 2s ease-in-out infinite; }

  /* Respeita reduce-motion também na transição de tela */
  @media (prefers-reduced-motion: reduce) {
    .fade-in, .slide-in { animation: none; }
  }

  /* ────────────────────── LOADING SCREEN ────────────────────── */
  /* Identidade Fadein viva. Animação staircase: cada barrinha sobe na sua vez
     (degrau 1 → degrau 2 → ... → degrau 5), fica em pé, e desaparece na mesma
     ordem antes do ciclo recomeçar. Mais minimal e premium que um wave clássico.
     Ciclo total de 4.4s, easing expo-out na subida pra dar peso refinado. */
  .loading-screen {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 65% 55% at 50% 38%, ${C.goldFaint} 0%, transparent 70%),
      ${C.bg};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 26px; padding: 24px;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .loading-bars {
    display: flex; align-items: flex-end; gap: 6px;
    height: 60px;
  }
  .loading-bars span {
    display: block; width: 7px; height: 0;
    background: linear-gradient(180deg, #F0C76A 0%, ${C.gold} 100%);
    border-radius: 2px;
    opacity: 0;
    transform-origin: bottom;
    animation: barStaircase 4.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }
  /* Cada barra reproduz a curva crescente do logo (alturas 22, 30, 38, 48, 60).
     O delay incremental cria o efeito de "degrau subindo um após o outro". */
  .loading-bars span:nth-child(1) { animation-delay: 0.0s;  --peak: 22px; }
  .loading-bars span:nth-child(2) { animation-delay: 0.18s; --peak: 30px; }
  .loading-bars span:nth-child(3) { animation-delay: 0.36s; --peak: 38px; }
  .loading-bars span:nth-child(4) { animation-delay: 0.54s; --peak: 48px; }
  .loading-bars span:nth-child(5) { animation-delay: 0.72s; --peak: 60px; }
  @keyframes barStaircase {
    /* invisível esperando a vez */
    0%   { height: 0;            opacity: 0; }
    /* sobe (4% do ciclo = ~180ms) */
    4%   { height: var(--peak);  opacity: 1; }
    /* fica em pé enquanto as outras sobem e o logo é "construído" */
    65%  { height: var(--peak);  opacity: 1; }
    /* fade-out elegante mantendo a altura — não despenca, dissolve */
    78%  { height: var(--peak);  opacity: 0; }
    /* repouso até o próximo ciclo começar */
    100% { height: 0;            opacity: 0; }
  }

  .loading-brand {
    font-size: 22px; font-weight: 600; letter-spacing: 6px;
    color: ${C.fg};
    animation: loadingFadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.1s both;
  }
  .loading-brand b {
    color: ${C.goldBright}; font-weight: 600;
    margin-left: 5px;
  }
  @keyframes loadingFadeUp {
    from { opacity: 0; transform: translateY(6px); letter-spacing: 3px; }
    to   { opacity: 1; transform: translateY(0);   letter-spacing: 6px; }
  }

  /* Linha-base sutil sob o logo (separador horizontal premium) */
  .loading-rule {
    width: 80px; height: 1px;
    background: linear-gradient(90deg, transparent, ${C.borderHi}, transparent);
    animation: loadingFadeUp 0.9s ease-out 1.3s both;
  }

  .loading-message {
    font-size: 9px; font-weight: 500;
    color: ${C.muted};
    letter-spacing: 4px; text-transform: uppercase;
    margin: 0;
    animation: loadingFadeUp 0.9s ease-out 1.5s both;
  }

  /* Respeita "reduce motion": mostra logo final estático, sem ciclo. */
  @media (prefers-reduced-motion: reduce) {
    .loading-bars span {
      animation: none;
      height: var(--peak, 50px);
      opacity: 1;
    }
  }

  /* Inputs sem highlight default azul */
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${C.goldBright} !important; }

  /* Remove number input arrows */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }

  /* Buttons sem outline default */
  button:focus { outline: none; }
  button:focus-visible { outline: 2px solid ${C.goldBright}; outline-offset: 2px; }

  /* Smooth transitions everywhere */
  button { transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s; }
  button:active:not(:disabled) { transform: scale(0.98); }

  /* ────────────────────── DASHBOARD CHART RESIZING ────────────────────── */
  /* Ocupa toda a largura do container. Altura vem naturalmente do viewBox
     (responsivo: mais panorâmico em desktop, mais quadrado em mobile). */
  .dashboard-chart-wrap { display: block; width: 100%; }
  .dashboard-chart-wrap svg { width: 100%; display: block; height: auto; }

  /* Sparkline do hero: maior em mobile pra dar mais leitura */
  @media (max-width: 768px) {
    .hero-sparkline { height: 64px !important; }
  }

  /* ────────────────────── MOBILE RESPONSIVO ────────────────────── */
  /* Layout shell */
  .app-shell { display: flex; min-height: 100vh; }
  .app-sidebar { width: 240px; border-right: 1px solid ${C.border}; display: flex; flex-direction: column; flex-shrink: 0; }
  .app-main { flex: 1; padding: 32px 40px; min-width: 0; overflow-x: hidden; }
  .app-bottom-nav { display: none; }
  .app-mobile-header { display: none; }

  /* Desktop: main com scroll independente */
  @media (min-width: 769px) {
    .app-shell { height: 100vh; overflow: hidden; }
    .app-main { overflow-y: auto; max-height: 100vh; }
  }

  @media (max-width: 768px) {
    /* Sidebar vira bottom nav em mobile */
    .app-sidebar { display: none !important; }
    .app-shell { flex-direction: column; }
    .app-main { padding: 16px 16px 92px !important; }

    /* Header mobile */
    .app-mobile-header {
      display: flex !important;
      align-items: center; justify-content: space-between;
      padding: 12px 16px;
      background: ${C.card};
      border-bottom: 1px solid ${C.border};
      position: sticky; top: 0; z-index: 50;
    }

    /* Bottom navigation */
    .app-bottom-nav {
      display: flex !important;
      position: fixed; bottom: 0; left: 0; right: 0;
      background: ${C.card};
      border-top: 1px solid ${C.border};
      z-index: 100;
      padding: 6px 4px calc(6px + env(safe-area-inset-bottom)) 4px;
      justify-content: space-around;
      align-items: stretch;
    }
    .app-bottom-nav button {
      flex: 1;
      background: none; border: none;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 3px;
      padding: 6px 4px;
      color: ${C.fgMuted};
      font-size: 10px; font-weight: 500;
      cursor: pointer;
      min-height: 52px;
      border-radius: 8px;
    }
    .app-bottom-nav button.active { color: ${C.goldBright}; }
    .app-bottom-nav button svg { width: 20px; height: 20px; }

    /* Tipografia mobile: hierarquia clara */
    h1 { font-size: 22px !important; line-height: 1.2 !important; }
    h2 { font-size: 17px !important; }
    h3 { font-size: 15px !important; }

    /* Inputs/botões: 44px mínimo (touch target padrão Apple/Google) */
    input, select, textarea { min-height: 44px; font-size: 16px !important; }  /* 16px evita zoom no iOS */
    button { min-height: 40px; }

    /* Modais ocupam tela quase inteira (bottom sheet) */
    .modal-content {
      width: 100% !important; max-width: 100% !important;
      max-height: 92vh !important;
      margin: 0 !important;
      border-radius: 18px 18px 0 0 !important;
      padding: 22px 18px !important;
    }
    .modal-overlay {
      padding: 0 !important;
      align-items: flex-end !important;
    }

    /* Grids responsivos */
    .grid-responsive { grid-template-columns: 1fr !important; }
    .grid-responsive-2 { grid-template-columns: repeat(2, 1fr) !important; }

    /* Mini-KPIs do dashboard: 3 colunas compactas no mobile pra economizar altura
       e deixar os gráficos mais visíveis */
    .mini-kpis-stack {
      grid-template-columns: repeat(3, 1fr) !important;
      grid-template-rows: auto !important;
      gap: 6px !important;
    }
    .mini-kpis-stack > div {
      flex-direction: column !important;
      align-items: flex-start !important;
      padding: 10px 12px !important;
      gap: 6px !important;
    }
    .mini-kpis-stack > div > div:first-child {
      width: 28px !important; height: 28px !important;
    }
    .mini-kpis-stack .mini-kpi-value {
      font-size: 15px !important;
    }
    .mini-kpis-stack .mini-kpi-sub { display: none; } /* economiza altura */

    /* Linha de horário por dia no mobile: nome em cima, horários embaixo lado a lado */
    .day-hours-row {
      grid-template-columns: 1fr 1fr !important;
      grid-template-rows: auto auto !important;
      row-gap: 8px !important;
    }
    .day-hours-row > button:first-child {
      grid-column: 1 / -1 !important;
    }

    /* Hero do dashboard: faturamento gigante reduz no mobile pra não estourar */
    .hero-revenue { font-size: 30px !important; }
    .hero-card { padding: 18px 18px !important; }

    /* Filtros do gráfico: pílulas um pouco maiores pra dedo */
    .chart-range-tabs button { padding: 7px 13px !important; font-size: 12px !important; }

    /* Tabelas com scroll horizontal */
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// DATE UTILS
// ═══════════════════════════════════════════════════════════════════════════
function pad(n) { return String(n).padStart(2, "0"); }
function toDS(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function addDays(b, n) { const d = new Date(b); d.setDate(d.getDate() + n); return d; }
function parseDS(ds) { const [y, m, d] = ds.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtShort(ds) { return parseDS(ds).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
function fmtWeekday(ds) { return parseDS(ds).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""); }
function fmtFull(ds) { return parseDS(ds).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); }
function fmtMoney(n) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n); }

const BASE_DATE = new Date(); // hoje, tempo real
const TODAY_DS  = toDS(BASE_DATE);

function isPast(ds) { return ds < TODAY_DS; }
function diffDays(ds) { return Math.floor((BASE_DATE - parseDS(ds)) / 86400000); }
function agoLabel(ds) {
  const d = diffDays(ds);
  if (d === 0) return "Hoje";
  if (d === 1) return "Ontem";
  if (d < 0) return "em " + (-d) + "d";
  return d + "d atrás";
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
// Slots de horário possíveis no app — 8h às 20h em intervalos de 30min.
// O horário REAL de funcionamento de cada barbearia é configurado em Settings
// (campos open_time / close_time / day_hours) e filtra esse array via getDayHourSlots().
const HOURS = [];
for (let h = 8; h < 20; h++) {
  HOURS.push(pad(h) + ":00");
  HOURS.push(pad(h) + ":30");
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANOS (gating de funcionalidades)
// ═══════════════════════════════════════════════════════════════════════════
// Cada plano tem uma `checkoutUrl` apontando pra um link de assinatura no
// Asaas. O cliente clica em "Fazer upgrade" → cai no checkout do Asaas →
// escolhe PIX/boleto/cartão → assinatura recorrente fica ativa lá. Quando
// alguém pagar, o admin atualiza manualmente `subscription_status='active'`
// e `plan='pro'/'premium'` no Supabase (Fase 1 — manual). Numa Fase 2 isso
// vira webhook automático.
const PLANS = {
  // Starter NÃO é um plano pago — é o estado da barbearia durante o trial
  // de 15 dias. Quando o trial vence, isShopBlocked() bloqueia o app e a
  // pessoa é forçada a escolher Pro ou Premium. `price: 0` e `trial: true`
  // sinalizam isso pra UI: a tela de plano não mostra "R$ X/mês", mostra
  // "Período de teste" e empurra pro upgrade.
  starter: {
    id: "starter",
    name: "Starter",
    price: 0,
    trial: true,
    maxBarbers: 1,
    checkoutUrl: null, // sem checkout — Starter não pode ser assinado
    features: { agenda: true, linkPublico: true, clientes: true, dashboardBasico: true,
                financeiro: false, comissoes: false, dashboardAvancado: false,
                multiUnidade: false, whatsappAuto: false, relatorios: false, whiteLabel: false },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 99,
    maxBarbers: 3,
    checkoutUrl: "https://www.asaas.com/c/i8tqwnqjsf4q50ym",
    features: { agenda: true, linkPublico: true, clientes: true, dashboardBasico: true,
                financeiro: true, comissoes: true, dashboardAvancado: true,
                multiUnidade: false, whatsappAuto: true, relatorios: true, whiteLabel: false },
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 179,
    maxBarbers: Infinity,
    checkoutUrl: "https://www.asaas.com/c/gp7spwhio9ud6o5g",
    features: { agenda: true, linkPublico: true, clientes: true, dashboardBasico: true,
                financeiro: true, comissoes: true, dashboardAvancado: true,
                multiUnidade: true, whatsappAuto: true, relatorios: true, whiteLabel: true },
  },
};
function hasFeature(plan, key) {
  const p = PLANS[plan] || PLANS.starter;
  return !!p.features[key];
}

// Abre o checkout do plano alvo em nova aba. Recebe o id do plano ("pro" ou
// "premium") e cai no link do Asaas. Fallback: se algum dia o link sair do ar
// ou o id for inválido, abre WhatsApp manual pra não deixar o cliente sem
// caminho de pagamento.
function openCheckout(planId, shopId) {
  const plan = PLANS[planId];
  // Se temos link do Asaas, vai direto pro checkout. Anexamos `?ref=<shopId>`
  // como referência externa — o Asaas guarda esse valor e ele aparece no
  // webhook (Fase 2) e no painel admin, facilitando reconciliar quem pagou
  // qual assinatura.
  if (plan && plan.checkoutUrl) {
    const sep = plan.checkoutUrl.includes("?") ? "&" : "?";
    const url = shopId ? plan.checkoutUrl + sep + "externalReference=" + encodeURIComponent(shopId) : plan.checkoutUrl;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  // Fallback: WhatsApp manual
  const planName = plan ? plan.name : "Pro";
  const msg = encodeURIComponent("Olá! Quero fazer upgrade pro plano " + planName + " do Fadein.");
  window.open("https://wa.me/?text=" + msg, "_blank", "noopener,noreferrer");
}

function getAvailableSlots(appts, date, barberId, duration) {
  const busy = appts
    .filter(a => a.date === date && a.barber.id === barberId && a.status !== "cancelled")
    .map(a => {
      const [h, m] = a.time.split(":").map(Number);
      const s = h * 60 + m;
      return { s, e: s + a.service.duration };
    });
  return HOURS.filter(slot => {
    const [h, m] = slot.split(":").map(Number);
    const s = h * 60 + m;
    const e = s + duration;
    return !busy.some(b => s < b.e && e > b.s);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HORÁRIOS POR DIA — utilitários
// ═══════════════════════════════════════════════════════════════════════════
// Convenção: 0=Dom, 1=Seg, ..., 6=Sáb (igual Date.getDay()).
//
// O shop pode ter:
//   - dayHours: { 0:{open,close,enabled}, 1:{open,close,enabled}, ... }
//     → modo "personalizado" (cada dia tem seu horário)
//   - openTime + closeTime + workDays (legacy / modo "simples")
//     → mesmo horário pra todos os dias abertos
//
// Sempre que precisar saber o horário de um dia específico, chame
// getDayHours(shop, dayOfWeek). Ela cuida do fallback.
function getDayHours(shop, dayOfWeek) {
  // Modo personalizado: dayHours existe e tem entrada pra esse dia
  if (shop?.dayHours && shop.dayHours[dayOfWeek]) {
    const dh = shop.dayHours[dayOfWeek];
    return {
      open:    dh.open    || "08:00",
      close:   dh.close   || "20:00",
      enabled: dh.enabled !== false,
    };
  }
  // Modo simples (legacy): mesmo horário pra todos, workDays diz quais abrem
  const workDays = Array.isArray(shop?.workDays) ? shop.workDays : [1, 2, 3, 4, 5, 6];
  return {
    open:    shop?.openTime  || "08:00",
    close:   shop?.closeTime || "20:00",
    enabled: workDays.includes(dayOfWeek),
  };
}

// Lista de slots HH:MM disponíveis num dia da semana (respeitando o open/close daquele dia).
function getDayHourSlots(shop, dayOfWeek) {
  const { open, close, enabled } = getDayHours(shop, dayOfWeek);
  if (!enabled) return [];
  return HOURS.filter(h => h >= open && h < close);
}

// Defaults pro modo "personalizado" — usados quando o usuário ativa pela primeira vez.
// Pega como base o openTime/closeTime/workDays atuais (ou 08-20, seg-sáb).
function buildDefaultDayHours(shop) {
  const baseOpen  = shop?.openTime  || "08:00";
  const baseClose = shop?.closeTime || "20:00";
  const workDays  = Array.isArray(shop?.workDays) ? shop.workDays : [1, 2, 3, 4, 5, 6];
  const dh = {};
  for (let d = 0; d <= 6; d++) {
    dh[d] = { open: baseOpen, close: baseClose, enabled: workDays.includes(d) };
  }
  return dh;
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG ICONS
// ═══════════════════════════════════════════════════════════════════════════
const Ic = {
  dashboard: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  calendar:  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.4"/><line x1="6" y1="1" x2="6" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="12" y1="1" x2="12" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  money:     <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1v16M13 4.5H7a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  box:       <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5l7-3 7 3-7 3-7-3zM2 5v8l7 3 7-3V5M9 8v9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  users:     <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 16c0-2.5 2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="13" cy="5" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M14 11c1.8.5 2.5 2 2.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  link:      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 11l4-4M5.5 7.5L3.3 9.7a3 3 0 004.2 4.2l2.2-2.2M8.3 6.3l2.2-2.2a3 3 0 014.2 4.2l-2.2 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  gear:      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9 1v2M9 15v2M16 9h-2M3 9H1M14.5 4.5l-1.4 1.4M5 13l-1.5 1.5M14.5 13.5l-1.4-1.4M5 5L3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  plus:      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  search:    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  check:     <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x:         <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  chevR:     <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6 4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevL:     <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3.5 6 7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  bell:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 6.5a4 4 0 10-8 0c0 4.5-2 5.5-2 5.5h12s-2-1-2-5.5M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  whatsapp:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.3A5.7 5.7 0 001.3 7c0 1 .26 1.94.72 2.75L1.3 12.7l3-.7A5.7 5.7 0 107 1.3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  edit:      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 1.5L11.5 4 4 11.5H1.5V9L9 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  trash:     <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V1.5h3V3M3 3l.7 8.5h5.6L10 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  logout:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M6 8h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  warning:   <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 12h12L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><line x1="7" y1="5" x2="7" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="7" cy="10.5" r="0.5" fill="currentColor"/></svg>,
  clock:     <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  scissors:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="3" cy="3" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="3" cy="11" r="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="4" x2="13" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="13" y1="3" x2="5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  filter:    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M3.5 7h7M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  eyeOpen:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>,
  eyeShut:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M3 11.5C4.3 10 6 9 8 9s3.7 1 5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  trendUp:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 11l4-4 3 3 6-6M10.5 4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGO
// ═══════════════════════════════════════════════════════════════════════════
function Logo({ scale = 1 }) {
  const VW = 130, VH = 30;
  const bars = [
    { x: 0,  bh: 10, op: 0.22 },
    { x: 8,  bh: 14, op: 0.40 },
    { x: 16, bh: 18, op: 0.58 },
    { x: 24, bh: 23, op: 0.78 },
    { x: 32, bh: 30, op: 1.00 },
  ];
  return (
    <svg width={Math.round(VW * scale)} height={Math.round(VH * scale)} viewBox={"0 0 " + VW + " " + VH} style={{ display: "block", overflow: "visible" }}>
      {bars.map((b, i) => <rect key={i} x={b.x} y={VH - b.bh} width={5} height={b.bh} rx="1.5" fill={C.goldBright} opacity={b.op} />)}
      <text y="23" fontFamily="-apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="19" fontWeight="700" letterSpacing="1.5">
        <tspan x="48" fill={C.fg}>FADE</tspan>
        <tspan dx="3" fill={C.goldBright}>IN</tspan>
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SCREEN — usado durante boot do app e na página pública /agendar/...
// ═══════════════════════════════════════════════════════════════════════════
// Animação staircase: as 5 barras do logo sobem uma após a outra (degraus
// crescentes), constróem o logo Fadein, e somem na mesma ordem antes do ciclo
// recomeçar. Sem barulho visual — entrega refinada, premium, sem pressa.
function LoadingScreen({ message = "Carregando" }) {
  return (
    <div className="loading-screen">
      <div className="loading-bars" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
      <div className="loading-brand">FADE<b>IN</b></div>
      <div className="loading-rule" aria-hidden="true" />
      <p className="loading-message">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════
function Btn({ children, onClick, v = "primary", sm, icon, disabled, full, type = "button", title }) {
  const styles = {
    primary: { background: C.goldBright, color: "#1A1A1A", border: "none" },
    ghost:   { background: "transparent", color: C.fg, border: "1px solid " + C.border },
    soft:    { background: C.card2, color: C.fg, border: "1px solid " + C.border },
    danger:  { background: C.redDim, color: C.red, border: "1px solid " + C.red + "30" },
    success: { background: C.greenDim, color: C.green, border: "1px solid " + C.green + "30" },
  };
  const s = styles[v] || styles.primary;
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: sm ? "5px 11px" : "9px 16px",
        borderRadius: 7, ...s,
        fontSize: sm ? 12 : 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        width: full ? "100%" : "auto",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
      )}
      {children}
      {hint && <span style={{ fontSize: 11, color: C.muted }}>{hint}</span>}
    </div>
  );
}

function Inp({ label, hint, error, ...p }) {
  return (
    <Field label={label} hint={error || hint}>
      <input {...p} style={{
        padding: "10px 12px", borderRadius: 8,
        border: "1px solid " + (error ? C.red : C.border),
        background: C.bgSunken, color: C.fg, fontSize: 13, outline: "none",
        fontFamily: "inherit",
        ...(p.style || {}),
      }} />
    </Field>
  );
}

function Sel({ label, options, hint, ...p }) {
  return (
    <Field label={label} hint={hint}>
      <select {...p} style={{
        padding: "10px 12px", borderRadius: 8,
        border: "1px solid " + C.border,
        background: C.bgSunken, color: C.fg, fontSize: 13, outline: "none",
        fontFamily: "inherit", cursor: "pointer",
      }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </Field>
  );
}

function KPI({ label, value, note, up, accent }) {
  return (
    <div style={{
      background: accent ? C.goldDim : C.card,
      border: "1px solid " + (accent ? C.goldBright + "40" : C.border),
      borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? C.goldBright : C.fg, lineHeight: 1.1 }}>{value}</div>
      {note && <div style={{ fontSize: 11, marginTop: 4, color: up === true ? C.green : up === false ? C.red : C.muted }}>{note}</div>}
    </div>
  );
}

function Badge({ children, color }) {
  const col = color || C.goldBright;
  return (
    <span style={{
      display: "inline-flex", padding: "2px 7px", borderRadius: 5,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      background: col + "20", color: col, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function StatusPill({ status }) {
  const cfg = {
    done:      { color: C.green, label: "Feito" },
    confirmed: { color: C.goldBright, label: "Confirmado" },
    pending:   { color: C.amber, label: "Pendente" },
    cancelled: { color: C.red, label: "Cancelado" },
  }[status] || { color: C.muted, label: status };
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width: 38, height: 22, borderRadius: 11,
      background: on ? C.green : C.border,
      position: "relative", cursor: "pointer", transition: "background 0.2s",
      flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 2, left: on ? 18 : 2,
        transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

function Toast({ msg, type = "ok" }) {
  if (!msg) return null;
  const cfg = type === "ok" ? { bg: C.goldBright, fg: "#1A1A1A" }
            : type === "err" ? { bg: C.red, fg: "#fff" }
            : { bg: C.green, fg: "#fff" };
  return (
    <div className="slide-in" style={{
      position: "fixed", top: 20, right: 20, zIndex: 1000,
      background: cfg.bg, color: cfg.fg, padding: "12px 20px",
      borderRadius: 10, fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>{msg}</div>
  );
}

function Modal({ title, subtitle, onClose, children, width = 440 }) {
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div onClick={onClose} className="fade-in modal-overlay" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
      backdropFilter: "blur(4px)",
    }}>
      <div onClick={e => e.stopPropagation()} className="modal-content" style={{
        background: C.card, border: "1px solid " + C.border, borderRadius: 14,
        padding: 24, width, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.fg, fontFamily: "Georgia, serif" }}>{title}</h3>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.fgMuted }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: C.fgMuted,
            cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel} width={400}>
      <p style={{ margin: 0, color: C.fgMuted, fontSize: 13, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <Btn v={danger ? "danger" : "primary"} onClick={onConfirm} full>{danger ? "Sim, excluir" : "Confirmar"}</Btn>
        <Btn v="ghost" onClick={onCancel}>Cancelar</Btn>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════
function ResetPassword({ onDone }) {
  const [pw, setPw]       = useState("");
  const [pw2, setPw2]     = useState("");
  const [err, setErr]     = useState("");
  const [show, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(false);

  async function submit() {
    if (pw.length < 6) { setErr("Senha deve ter pelo menos 6 caracteres."); return; }
    if (pw !== pw2)    { setErr("As senhas não coincidem."); return; }
    setLoading(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setDone(true);
      // Limpa hash da URL (remove tokens)
      window.history.replaceState({}, document.title, window.location.pathname);
      // Volta pra login depois de 2s
      setTimeout(() => { onDone(); }, 2000);
    } catch (ex) {
      setErr(ex?.message || "Erro ao redefinir senha.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: 20,
    }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 36, display: "flex", justifyContent: "center" }}>
          <Logo scale={1.4} />
        </div>
        <h2 style={{ color: C.fg, fontSize: 18, textAlign: "center", margin: "0 0 8px" }}>
          Definir nova senha
        </h2>
        <p style={{ color: C.fgMuted, fontSize: 13, textAlign: "center", marginBottom: 24 }}>
          Escolha uma senha forte para sua conta.
        </p>

        {done ? (
          <div style={{
            padding: "14px 18px", borderRadius: 10, textAlign: "center",
            background: C.greenDim, border: "1px solid " + C.green + "40",
            color: C.green, fontSize: 13, lineHeight: 1.4,
          }}>
            ✓ Senha alterada! Redirecionando...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Nova senha">
              <div style={{ position: "relative" }}>
                <input
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setErr(""); }}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "12px 46px 12px 14px", boxSizing: "border-box",
                    borderRadius: 10, border: "1px solid " + (err ? C.red : C.border),
                    background: C.card, color: C.fg, fontSize: 15, outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button type="button" onClick={() => setShow(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.fgMuted, cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                  {show ? Ic.eyeShut : Ic.eyeOpen}
                </button>
              </div>
            </Field>
            <Field label="Confirmar nova senha" hint={err}>
              <input
                type={show ? "text" : "password"}
                value={pw2}
                onChange={e => { setPw2(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="Digite novamente"
                autoComplete="new-password"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 14px", boxSizing: "border-box",
                  borderRadius: 10, border: "1px solid " + (err ? C.red : C.border),
                  background: C.card, color: C.fg, fontSize: 15, outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </Field>
            <Btn onClick={submit} disabled={loading} full>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [tab, setTab]     = useState("login"); // "login" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [shopName, setShopName] = useState("");
  const [err, setErr]     = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [show, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);

  // Se o usuário chegou via link de indicação (`?ref=<uuid>`), o boot já gravou
  // o uid do indicador no localStorage. Mostra banner celebratório e abre na
  // aba "Criar conta" — o objetivo da indicação é converter visitante em conta.
  const wasReferred = (() => {
    try { return typeof window !== "undefined" && !!localStorage.getItem(REFERRAL_KEY); }
    catch { return false; }
  })();
  useEffect(() => {
    if (wasReferred) setTab("signup");
  }, [wasReferred]);

  async function attempt() {
    const e = email.trim().toLowerCase();
    if (!e) { setErr("Informe o email."); return; }
    if (tab !== "reset" && !pw) { setErr("Preencha a senha."); return; }
    if (tab === "signup" && !shopName.trim()) { setErr("Informe o nome da barbearia."); return; }
    setLoading(true);
    setErr("");
    setOkMsg("");
    try {
      if (tab === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password: pw });
        if (error) throw error;
        // o onAuthStateChange no App vai pegar a sessão e chamar onLogin
      } else if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: e, password: pw,
          options: { data: { shop_name: shopName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setOkMsg("Conta criada! Verifique seu email para confirmar.");
          setLoading(false);
          return;
        }
      } else if (tab === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(e, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setOkMsg("✓ Enviamos um link para o seu email. Confira a caixa de entrada (e o spam).");
        setLoading(false);
        return;
      }
    } catch (ex) {
      const msg = ex?.message || "Erro ao autenticar.";
      setErr(msg.includes("Invalid login") ? "Email ou senha incorretos." :
             msg.includes("already registered") ? "Este email já tem cadastro." :
             msg.includes("Password should") ? "Senha deve ter pelo menos 6 caracteres." :
             msg.includes("rate limit") ? "Muitas tentativas. Aguarde alguns minutos." :
             msg);
      setLoading(false);
    }
  }

  const tabBtn = (id, label) => (
    <button onClick={() => { setTab(id); setErr(""); }}
      style={{
        flex: 1, padding: "10px 0", background: "none",
        border: "none", borderBottom: "2px solid " + (tab === id ? C.gold : "transparent"),
        color: tab === id ? C.gold : C.fgMuted,
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        fontFamily: "inherit",
      }}>{label}</button>
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: 20,
    }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 36, display: "flex", justifyContent: "center" }}>
          <Logo scale={1.4} />
        </div>
        <p style={{ color: C.fgMuted, fontSize: 13, textAlign: "center", marginBottom: 24 }}>
          Sistema de gestão para barbearias
        </p>

        {/* Banner de boas-vindas pro indicado: confirma que o desconto vai ser
            aplicado quando ele criar a conta. O processamento financeiro fica
            por conta do admin (manual, olhando referred_by no Supabase). */}
        {wasReferred && (
          <div style={{
            background: "linear-gradient(135deg, " + C.goldDim + " 0%, " + C.goldFaint + " 100%)",
            border: "1px solid " + C.goldBright + "40", borderRadius: 12,
            padding: "14px 16px", marginBottom: 22,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: C.goldBright + "25", color: C.goldBright,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>🎁</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.goldBright, marginBottom: 2 }}>
                Você foi indicado!
              </div>
              <div style={{ fontSize: 11, color: C.fgMuted, lineHeight: 1.4 }}>
                Ganhe <b style={{ color: C.fg }}>50% off no primeiro mês</b> ao criar sua conta.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", marginBottom: 20, borderBottom: "1px solid " + C.border }}>
          {tabBtn("login", "Entrar")}
          {tabBtn("signup", "Criar conta")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "signup" && (
            <Field label="Nome da barbearia">
              <input
                type="text"
                value={shopName}
                onChange={e => { setShopName(e.target.value); setErr(""); }}
                placeholder="Ex.: Barbearia do João"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 14px", boxSizing: "border-box",
                  borderRadius: 10, border: "1px solid " + C.border,
                  background: C.card, color: C.fg, fontSize: 15, outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </Field>
          )}
          <Field label="Email" hint={tab === "reset" ? err : ""}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && tab === "reset" && attempt()}
              placeholder="seu@email.com"
              autoComplete="email"
              disabled={loading}
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                borderRadius: 10, border: "1px solid " + (err && tab === "reset" ? C.red : C.border),
                background: C.card, color: C.fg, fontSize: 15, outline: "none",
                fontFamily: "inherit",
              }}
            />
          </Field>
          {tab !== "reset" && (
            <Field label="Senha" hint={err}>
              <div style={{ position: "relative" }}>
                <input
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && attempt()}
                  placeholder={tab === "signup" ? "Mínimo 6 caracteres" : "Sua senha"}
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "12px 46px 12px 14px", boxSizing: "border-box",
                    borderRadius: 10, border: "1px solid " + (err ? C.red : C.border),
                    background: C.card, color: C.fg, fontSize: 15, outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button type="button" onClick={() => setShow(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: C.fgMuted, cursor: "pointer",
                    display: "flex", alignItems: "center", padding: 0,
                  }}
                >{show ? Ic.eyeShut : Ic.eyeOpen}</button>
              </div>
            </Field>
          )}

          {okMsg && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: C.greenDim, border: "1px solid " + C.green + "40",
              color: C.green, fontSize: 12, lineHeight: 1.4,
            }}>{okMsg}</div>
          )}

          <Btn onClick={attempt} disabled={loading} full>
            {loading ? "Aguarde..." :
              tab === "login"  ? "Entrar" :
              tab === "signup" ? "Criar conta" :
                                 "Enviar link de recuperação"}
          </Btn>

          {tab === "login" && (
            <p style={{ textAlign: "center", marginTop: -2 }}>
              <span onClick={() => { setTab("reset"); setErr(""); setOkMsg(""); }}
                style={{ color: C.fgMuted, cursor: "pointer", fontSize: 12 }}>
                Esqueci minha senha
              </span>
            </p>
          )}
        </div>

        <p style={{ marginTop: 24, fontSize: 11, color: C.fgMuted, textAlign: "center" }}>
          {tab === "login"  && <>Não tem conta? <span onClick={() => { setTab("signup"); setErr(""); setOkMsg(""); }} style={{ color: C.gold, cursor: "pointer", fontWeight: 600 }}>Criar agora</span></>}
          {tab === "signup" && <>Já tem conta? <span onClick={() => { setTab("login"); setErr(""); setOkMsg(""); }} style={{ color: C.gold, cursor: "pointer", fontWeight: 600 }}>Fazer login</span></>}
          {tab === "reset"  && <>Lembrou da senha? <span onClick={() => { setTab("login"); setErr(""); setOkMsg(""); }} style={{ color: C.gold, cursor: "pointer", fontWeight: 600 }}>Fazer login</span></>}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD — pensado pro barbeiro: o que importa hoje
// ═══════════════════════════════════════════════════════════════════════════
function Dashboard({ appts, txns, services, navigate }) {
  const [range, setRange]     = useState("7d");
  const [hovBar, setHovBar]   = useState(null);
  const [now, setNow]         = useState(new Date());

  // Detecta mobile pra ajustar viewBox do gráfico (mais quadrado em mobile,
  // mais panorâmico em desktop). Tracked via matchMedia pra reagir a resize.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange); // fallback Safari antigo
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // Relógio em tempo real (atualiza a cada 30s — basta pra UX, não estressa o React)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const nowTime = pad(now.getHours()) + ":" + pad(now.getMinutes());

  const todayAppts = appts.filter(a => a.date === TODAY_DS);
  const m30Txns    = txns.filter(t => t.date >= toDS(addDays(BASE_DATE, -30)));
  const m60_30Txns = txns.filter(t => t.date >= toDS(addDays(BASE_DATE, -60)) && t.date < toDS(addDays(BASE_DATE, -30)));
  const revenue    = m30Txns.filter(t => !t.out).reduce((s, t) => s + t.amount, 0);
  const revPrev    = m60_30Txns.filter(t => !t.out).reduce((s, t) => s + t.amount, 0);
  const expenses   = m30Txns.filter(t => t.out).reduce((s, t) => s + t.amount, 0);
  const inCount    = m30Txns.filter(t => !t.out).length;
  const avgTicket  = inCount > 0 ? revenue / inCount : 0;
  const trendPct   = revPrev > 0 ? Math.round(((revenue - revPrev) / revPrev) * 100) : (revenue > 0 ? 100 : 0);

  // Próximo cliente
  const nextAppt = useMemo(() => {
    const future = todayAppts
      .filter(a => a.status === "confirmed" || a.status === "pending")
      .sort((a, b) => a.time.localeCompare(b.time));
    return future[0];
  }, [todayAppts]);

  // Sparkline 30d (mini gráfico no hero)
  const sparkPts = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const ds  = toDS(addDays(BASE_DATE, -i));
      const val = txns.filter(t => t.date === ds && !t.out).reduce((s, t) => s + t.amount, 0);
      arr.push(val);
    }
    return arr;
  }, [txns]);
  const sparkMax = Math.max(...sparkPts, 1);

  // Chart data
  const pts = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const raw = [];
    for (let i = days - 1; i >= 0; i--) {
      const ds  = toDS(addDays(BASE_DATE, -i));
      const val = txns.filter(t => t.date === ds && !t.out).reduce((s, t) => s + t.amount, 0);
      raw.push({ ds, val, label: range === "7d" ? fmtWeekday(ds) : fmtShort(ds) });
    }
    if (range === "7d") return raw;
    const weeks = []; let chunk = [];
    raw.forEach((p, i) => {
      chunk.push(p);
      if (chunk.length === 7 || i === raw.length - 1) {
        weeks.push({
          ds: chunk[0].ds,
          val: chunk.reduce((s, c) => s + c.val, 0),
          label: fmtShort(chunk[0].ds),
        });
        chunk = [];
      }
    });
    return weeks;
  }, [range, txns]);

  const maxVal      = Math.max(...pts.map(p => p.val), 1);
  const totalPeriod = pts.reduce((s, p) => s + p.val, 0);
  // Valor médio do período (usado pra linha de referência horizontal)
  const avgVal = pts.length > 0 ? totalPeriod / pts.length : 0;
  // Índice do ponto de pico (pra destacar)
  const peakIdx = pts.reduce((best, p, i, arr) => p.val > arr[best].val ? i : best, 0);

  // Receita por serviço (top 5)
  const svcRev = useMemo(() => {
    const map = {};
    m30Txns.filter(t => !t.out).forEach(t => { map[t.desc] = (map[t.desc] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [m30Txns]);
  const svcMax = svcRev.length ? svcRev[0][1] : 1;

  // Dimensões do SVG: viewBox responsivo.
  // Desktop: 1200×380 (panorâmico, aproveita largura) — proporção ~3.16:1
  // Mobile:  380×340  (quase quadrado, aproveita altura disponível) — proporção ~1.12:1
  // Como o SVG escala via width="100%" + viewBox, isso muda a proporção FINAL renderizada.
  // Em mobile com ~340px de largura útil, altura final fica ~304px (vs ~108px do design antigo).
  const SVG_W = isMobile ? 380 : 1200;
  const SVG_H = isMobile ? 340 : 380;
  const PAD_X = isMobile ? 32 : 32;     // espaço lateral pros labels do eixo Y
  const PAD_T = isMobile ? 18 : 22;     // topo
  const PAD_B = isMobile ? 26 : 28;     // base (labels do eixo X)
  const linePts = pts.map((p, i) => {
    const x = PAD_X + (i / Math.max(pts.length - 1, 1)) * (SVG_W - PAD_X * 2);
    const y = PAD_T + (1 - p.val / maxVal) * (SVG_H - PAD_T - PAD_B);
    return { x, y, ...p };
  });
  const linePath  = linePts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const areaPath  = linePath + " L" + (SVG_W - PAD_X) + " " + (SVG_H - PAD_B) + " L" + PAD_X + " " + (SVG_H - PAD_B) + " Z";
  // Y da linha de média (referência horizontal)
  const avgY = PAD_T + (1 - avgVal / maxVal) * (SVG_H - PAD_T - PAD_B);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", color: C.fg, letterSpacing: -0.5 }}>Visão geral</h1>
          <p style={{ fontSize: 13, color: C.fgMuted, margin: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ textTransform: "capitalize" }}>{fmtFull(TODAY_DS)}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.muted, display: "inline-block" }} />
            <span style={{ color: C.goldBright, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: 0.3 }}>{nowTime}</span>
          </p>
        </div>
      </div>

      {/* HERO: Faturamento grande + 3 KPIs auxiliares */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1.4fr) minmax(220px, 1fr)", gap: 14, marginBottom: 14 }} className="grid-responsive">
        {/* Hero card */}
        <div className="hero-card" style={{
          background: "linear-gradient(135deg, " + C.card + " 0%, " + C.card2 + " 100%)",
          border: "1px solid " + C.borderHi, borderRadius: 16,
          padding: "24px 26px", position: "relative", overflow: "hidden",
          boxShadow: "0 1px 0 " + C.borderHi + " inset, 0 8px 24px rgba(0,0,0,0.18)",
        }}>
          {/* glow circular ouro no canto */}
          <div style={{
            position: "absolute", top: -40, right: -40, width: 180, height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, " + C.goldBright + "18 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          {/* decorative bars (identidade Fadein) */}
          <svg width="80" height="60" viewBox="0 0 80 60" style={{ position: "absolute", top: 18, right: 22, opacity: 0.16 }}>
            {[
              { x: 0,  h: 18 }, { x: 14, h: 28 }, { x: 28, h: 38 },
              { x: 42, h: 50 }, { x: 56, h: 60 },
            ].map((b, i) => (
              <rect key={i} x={b.x} y={60 - b.h} width="10" height={b.h} rx="2" fill={C.goldBright} />
            ))}
          </svg>

          <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>
            Faturamento · últimos 30 dias
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <span className="hero-revenue" style={{ fontSize: 38, fontWeight: 700, color: C.goldBright, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {fmtMoney(revenue)}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              padding: "3px 9px", borderRadius: 14,
              background: trendPct >= 0 ? C.greenDim : C.redDim,
              color: trendPct >= 0 ? C.green : C.red,
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>
              {trendPct >= 0 ? "↑" : "↓"} {Math.abs(trendPct)}%
            </span>
          </div>

          {/* sparkline 30d embutido */}
          <svg width="100%" height="48" viewBox={"0 0 200 48"} preserveAspectRatio="none" className="hero-sparkline" style={{ display: "block" }}>
            <defs>
              <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={C.goldBright} stopOpacity="0.35" />
                <stop offset="100%" stopColor={C.goldBright} stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const w = 200, h = 48;
              const pts = sparkPts.map((v, i) => {
                const x = (i / Math.max(sparkPts.length - 1, 1)) * w;
                const y = h - (v / sparkMax) * (h - 4) - 2;
                return [x, y];
              });
              const lp = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
              const ap = lp + " L" + w + " " + h + " L0 " + h + " Z";
              return (
                <>
                  <path d={ap} fill="url(#sparkArea)" />
                  <path d={lp} fill="none" stroke={C.goldBright} strokeWidth="1.6" strokeLinejoin="round" />
                </>
              );
            })()}
          </svg>

          <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 4, fontStyle: "italic" }}>
            vs {fmtMoney(revPrev)} no período anterior
          </div>
        </div>

        {/* 3 mini-KPIs empilhados */}
        <div className="mini-kpis-stack" style={{ display: "grid", gridTemplateRows: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Hoje",          value: todayAppts.length, sub: "agendamentos", color: C.goldBright, icon: Ic.calendar },
            { label: "Lucro 30d",     value: fmtMoney(revenue - expenses), sub: "receita − despesas", color: revenue > expenses ? C.green : C.red, icon: Ic.trendUp },
            { label: "Ticket médio",  value: fmtMoney(avgTicket), sub: "por atendimento", color: C.fg, icon: Ic.money },
          ].map((k, i) => (
            <div key={i} style={{
              background: C.card, border: "1px solid " + C.border, borderRadius: 12,
              padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: k.color === C.fg ? C.bgSunken : k.color + "15",
                color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{k.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{k.label}</div>
                <div className="mini-kpi-value" style={{ fontSize: 18, fontWeight: 700, color: k.color, lineHeight: 1.1, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                <div className="mini-kpi-sub" style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Próximo cliente — quando existe, vira faixa de destaque */}
      {nextAppt && (
        <div onClick={() => navigate("agenda")} style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(90deg, " + C.goldDim + " 0%, transparent 100%)",
          border: "1px solid " + C.goldBright + "30",
          borderRadius: 12, padding: "12px 18px", marginBottom: 18, cursor: "pointer",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: nextAppt.barber.color + "30", color: nextAppt.barber.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, flexShrink: 0,
          }}>{nextAppt.barber.avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Próximo atendimento</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.fg, marginTop: 2 }}>
              {nextAppt.client} <span style={{ color: C.fgMuted, fontWeight: 400 }}>· {nextAppt.service.name}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.goldBright, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{nextAppt.time}</div>
            <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>{nextAppt.barber.name}</div>
          </div>
          <div style={{ color: C.goldBright }}>{Ic.chevR}</div>
        </div>
      )}

      {/* Main chart - área com gradient (substitui barras) */}
      <div style={{
        background: C.card, border: "1px solid " + C.border, borderRadius: 14,
        padding: "20px 24px", marginBottom: 16,
        boxShadow: "0 1px 0 " + C.borderHi + " inset",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>Receita no período</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.goldBright, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {fmtMoney(totalPeriod)}
            </div>
          </div>
          <div className="chart-range-tabs" style={{ display: "flex", gap: 4, background: C.bgSunken, padding: 3, borderRadius: 9 }}>
            {[["7d","7 dias"],["30d","30 dias"],["max","90 dias"]].map(([v, l]) => (
              <button key={v} onClick={() => setRange(v)} style={{
                padding: "5px 12px", borderRadius: 7, border: "none",
                background: range === v ? C.card : "transparent",
                color: range === v ? C.goldBright : C.fgMuted,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div className="dashboard-chart-wrap" style={{ position: "relative" }}>
          <svg
            width="100%"
            viewBox={"0 0 " + SVG_W + " " + SVG_H}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", width: "100%", overflow: "visible" }}
          >
            <defs>
              {/* Gradient da área: 3 stops pra dar mais profundidade que o degradê comum */}
              <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.goldBright} stopOpacity="0.45" />
                <stop offset="55%"  stopColor={C.goldBright} stopOpacity="0.12" />
                <stop offset="100%" stopColor={C.goldBright} stopOpacity="0" />
              </linearGradient>
              {/* Gradient do traço da linha — mais brilhante no topo, mais sutil na base */}
              <linearGradient id="dashLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#F0C76A" />
                <stop offset="100%" stopColor={C.goldBright} />
              </linearGradient>
              {/* Glow pro pico e ponto atual */}
              <filter id="dashGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid horizontal: 4 linhas de referência (0%, 25%, 50%, 75%, 100%) */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = PAD_T + f * (SVG_H - PAD_T - PAD_B);
              return (
                <line key={f}
                  x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y}
                  stroke={C.border} strokeWidth="1"
                  strokeDasharray={f === 1 ? "0" : "2 4"}
                  opacity={f === 1 ? 0.7 : 0.35}
                />
              );
            })}

            {/* Labels do eixo Y (3 valores: max, meio, 0) — discretos à esquerda */}
            {[1, 0.5, 0].map(f => {
              const y = PAD_T + (1 - f) * (SVG_H - PAD_T - PAD_B);
              const value = maxVal * f;
              const label = value >= 1000 ? "R$" + Math.round(value / 100) / 10 + "k" : "R$" + Math.round(value);
              return (
                <text key={f}
                  x={PAD_X - 6} y={y + 3}
                  textAnchor="end"
                  fontSize={isMobile ? "10" : "10"}
                  fill={C.muted}
                  fontFamily="ui-monospace, monospace"
                >{label}</text>
              );
            })}

            {/* Linha de média (referência horizontal pontilhada) — só mostra se houver dado */}
            {avgVal > 0 && (
              <g>
                <line
                  x1={PAD_X} y1={avgY} x2={SVG_W - PAD_X} y2={avgY}
                  stroke={C.fgMuted} strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
                />
                <text
                  x={SVG_W - PAD_X - 4} y={avgY - 5}
                  textAnchor="end"
                  fontSize={isMobile ? "9" : "9"}
                  fill={C.fgMuted}
                  fontWeight="600"
                  letterSpacing="0.4"
                >MÉDIA · {fmtMoney(avgVal).replace("R$\u00A0", "R$")}</text>
              </g>
            )}

            {/* Área + linha principal */}
            {linePts.length > 1 && (
              <>
                <path d={areaPath} fill="url(#dashArea)" />
                <path d={linePath}
                  fill="none"
                  stroke="url(#dashLine)"
                  strokeWidth={isMobile ? "2.8" : "2.4"}
                  strokeLinejoin="round" strokeLinecap="round"
                />
              </>
            )}

            {/* Destaque do pico: anel sutil ao redor do maior valor */}
            {linePts.length > 1 && pts[peakIdx]?.val > 0 && (() => {
              const p = linePts[peakIdx];
              return (
                <g>
                  <circle cx={p.x} cy={p.y} r="9" fill="none" stroke={C.goldBright} strokeWidth="1" opacity="0.35" />
                  <circle cx={p.x} cy={p.y} r="5.5" fill={C.goldBright} filter="url(#dashGlow)" opacity="0.9" />
                </g>
              );
            })()}

            {/* Pontos de dados + interação */}
            {linePts.map((p, i) => {
              const isToday = p.ds === TODAY_DS;
              const isHov   = hovBar === i;
              const isLast  = i === linePts.length - 1;
              const isPeak  = i === peakIdx && p.val > 0;
              return (
                <g key={p.ds} style={{ cursor: "pointer" }}
                   onMouseEnter={() => setHovBar(i)}
                   onMouseLeave={() => setHovBar(null)}
                   onTouchStart={() => setHovBar(i)}>
                  {/* área de hit maior pro toque no mobile */}
                  <rect x={p.x - (isMobile ? 18 : 14)} y={0}
                        width={isMobile ? 36 : 28} height={SVG_H} fill="transparent" />
                  {!isPeak && (
                    <circle cx={p.x} cy={p.y}
                      r={isHov || isToday || isLast ? 4.5 : 3}
                      fill={isToday || isLast ? C.goldBright : C.card}
                      stroke={C.goldBright}
                      strokeWidth={isToday || isLast ? 0 : 2}
                    />
                  )}
                  {/* "Agora" — pulsa no último ponto se for hoje */}
                  {isLast && isToday && (
                    <circle cx={p.x} cy={p.y} r="9" fill={C.goldBright} opacity="0.25"
                      className="pulse" />
                  )}
                  {/* Tooltip ao hover */}
                  {isHov && p.val > 0 && (() => {
                    const tipW = isMobile ? 110 : 100;
                    const tipH = 38;
                    // mantém o tooltip dentro da viewBox
                    const tipX = Math.max(PAD_X, Math.min(SVG_W - PAD_X - tipW, p.x - tipW / 2));
                    const tipY = Math.max(PAD_T, p.y - tipH - 8);
                    return (
                      <g pointerEvents="none">
                        <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="7"
                          fill={C.bgSunken} stroke={C.borderHi} strokeWidth="1" />
                        <text x={tipX + tipW / 2} y={tipY + 14} textAnchor="middle"
                          fontSize="9" fill={C.fgMuted}
                          textTransform="uppercase" letterSpacing="0.5">{p.label}</text>
                        <text x={tipX + tipW / 2} y={tipY + 29} textAnchor="middle"
                          fontSize="12" fill={C.goldBright} fontWeight="700"
                          fontFamily="ui-monospace, monospace">{fmtMoney(p.val)}</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Labels do eixo X (datas) */}
            {linePts.map((p, i) => {
              // Em mobile mostra menos labels pra não ficar apertado
              const targetCount = isMobile ? 4 : 6;
              const show = range === "7d"
                ? true
                : (i % Math.ceil(linePts.length / targetCount) === 0 || i === linePts.length - 1);
              if (!show) return null;
              return (
                <text key={p.ds + "-l"}
                  x={p.x} y={SVG_H - 6}
                  textAnchor="middle"
                  fontSize={isMobile ? "10" : "9"}
                  fill={C.fgMuted}
                  fontWeight="500"
                >{p.label}</text>
              );
            })}
          </svg>
        </div>

        {/* Resumo do período abaixo do chart — pico, média, comparação */}
        {pts.length > 1 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid " + C.border,
          }}>
            <div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                Pico
              </div>
              <div style={{ fontSize: 14, color: C.goldBright, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {fmtMoney(pts[peakIdx]?.val || 0)}
              </div>
              <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>
                {pts[peakIdx]?.label || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                Média / dia
              </div>
              <div style={{ fontSize: 14, color: C.fg, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {fmtMoney(avgVal)}
              </div>
              <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>
                {pts.length} {pts.length === 1 ? "registro" : "registros"}
              </div>
            </div>
            {!isMobile && (
              <div>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  Hoje
                </div>
                <div style={{ fontSize: 14, color: C.fg, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                  {fmtMoney(linePts[linePts.length - 1]?.val || 0)}
                </div>
                <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>
                  {(linePts[linePts.length - 1]?.val || 0) >= avgVal ? "↑ acima da média" : "↓ abaixo da média"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom row: Today + Top services */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Agenda de hoje
            </span>
            <Btn sm v="ghost" onClick={() => navigate("agenda")}>Ver tudo {Ic.chevR}</Btn>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {todayAppts.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Sem agendamentos hoje</p>
            ) : todayAppts.sort((a, b) => a.time.localeCompare(b.time)).map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: "1px solid " + C.border,
              }}>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: a.barber.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.goldBright, width: 44, fontVariantNumeric: "tabular-nums" }}>{a.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.fg, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.client}</div>
                  <div style={{ fontSize: 11, color: C.fgMuted }}>{a.service.name} · {a.barber.name}</div>
                </div>
                <StatusPill status={a.status} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>
            Top serviços · 30d
          </div>
          {svcRev.length === 0 && (
            <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Sem dados ainda</p>
          )}
          {svcRev.map(([name, val], i) => (
            <div key={name} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: C.fg, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>#{i + 1}</span>
                  {name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.goldBright, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(val)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.bgSunken, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: (val / svcMax * 100) + "%",
                  background: "linear-gradient(90deg, " + C.gold + " 0%, " + C.goldBright + " 100%)",
                  borderRadius: 3, transition: "width 0.6s",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn icon={Ic.plus} onClick={() => navigate("agenda")}>Novo agendamento</Btn>
        <Btn v="ghost" icon={Ic.money} onClick={() => navigate("financeiro")}>Lançar entrada</Btn>
        <Btn v="ghost" icon={Ic.link} onClick={() => navigate("link")}>Link de agendamento</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENDA — totalmente funcional
// ═══════════════════════════════════════════════════════════════════════════
function Agenda({ appts, setAppts, services, clients, setClients, setTxns, barbers, createAppt, updateAppt, cancelAppt, upsertClientFromAppt, createTxn }) {
  const [selDate, setSelDate]     = useState(TODAY_DS);
  const [barberF, setBarberF]     = useState(0);
  const [statusF, setStatusF]     = useState("all");
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [paying, setPaying]       = useState(null); // {appt, method, amount}
  const [toast, setToast]         = useState({ msg: "", type: "ok" });
  const [viewMode, setViewMode]   = useState("strip");
  const [calMonth, setCalMonth]   = useState({ y: BASE_DATE.getFullYear(), m: BASE_DATE.getMonth() });
  const [form, setForm]           = useState({ client: "", phone: "", serviceId: "", barberId: "", time: "" });
  const [clientSugg, setClientSugg] = useState(false);
  const stripRef = useRef(null);

  function flash(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 2800);
  }

  const stripDates = useMemo(() => {
    const arr = [];
    for (let i = -7; i <= 90; i++) arr.push(toDS(addDays(BASE_DATE, i)));
    return arr;
  }, []);

  const calDays = useMemo(() => {
    const first = new Date(calMonth.y, calMonth.m, 1);
    const last  = new Date(calMonth.y, calMonth.m + 1, 0);
    const days  = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(toDS(new Date(calMonth.y, calMonth.m, d)));
    return days;
  }, [calMonth]);

  // Filtered list
  const shown = useMemo(() =>
    appts
      .filter(a => a.date === selDate)
      .filter(a => barberF === 0 || a.barber.id === barberF)
      .filter(a => statusF === "all" || a.status === statusF)
      .sort((a, b) => a.time.localeCompare(b.time))
  , [appts, selDate, barberF, statusF]);

  const dateIsPast = isPast(selDate);
  const selSvc  = services.find(s => s.id === form.serviceId);
  const avSlots = useMemo(() =>
    selSvc ? getAvailableSlots(appts, selDate, form.barberId, selSvc.duration) : []
  , [selSvc, appts, selDate, form.barberId]);

  // Suggestions for client autocomplete
  const clientMatches = useMemo(() => {
    if (!form.client.trim() || form.client.length < 2) return [];
    const q = form.client.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 5);
  }, [form.client, clients]);

  function openNew() {
    if (dateIsPast) return;
    const first = avSlots[0] || HOURS[0];
    setEditing(null);
    setForm({ client: "", phone: "", serviceId: services[0]?.id || "", barberId: barbers[0]?.id || "", time: first });
    setModal(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      client: a.client, phone: "",
      serviceId: String(a.service.id),
      barberId:  String(a.barber.id),
      time: a.time,
    });
    setModal(true);
  }

  function updForm(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === "serviceId" || key === "barberId") {
        const svcId = key === "serviceId" ? val : next.serviceId;
        const bId   = key === "barberId"  ? val : next.barberId;
        const svc   = services.find(s => s.id === svcId);
        const sl    = getAvailableSlots(appts, selDate, bId, svc ? svc.duration : 30);
        // Mantém o horário se ainda disponível; senão escolhe o primeiro
        next.time = sl.includes(next.time) ? next.time : (sl[0] || "");
      }
      return next;
    });
  }

  function pickClient(c) {
    setForm(p => ({ ...p, client: c.name, phone: c.phone }));
    setClientSugg(false);
  }

  async function saveAppt() {
    const trimmedClient = form.client.trim();
    if (!trimmedClient) { flash("Digite o nome do cliente", "err"); return; }
    if (!form.time)     { flash("Selecione um horário",        "err"); return; }

    const svc    = services.find(s => s.id === form.serviceId);
    const barber = barbers.find(b => b.id === form.barberId);

    if (editing) {
      await updateAppt(editing.id, {
        client: trimmedClient, service: svc, barber, time: form.time, date: selDate,
      });
      flash("Agendamento atualizado", "success");
    } else {
      // NEW — atualiza/cria cliente no Supabase (incrementa visita)
      await upsertClientFromAppt({
        name: trimmedClient,
        phone: form.phone || "",
        date: selDate,
        barberId: barber.id,
      });
      await createAppt({
        date: selDate,
        time: form.time,
        client: trimmedClient,
        clientPhone: form.phone || "",
        service: svc,
        barber,
        status: "confirmed",
        paid: false,
      });
      flash("✓ " + trimmedClient + " — " + fmtShort(selDate) + " às " + form.time, "success");
    }
    setModal(false);
    setEditing(null);
  }

  // Abrir modal de pagamento ao concluir
  function openPay(appt) {
    setPaying({
      appt,
      method: "Pix",
      amount: String(appt.service.price),
      pixCode: null,
    });
  }

  // Confirmar pagamento → finalizar atendimento + criar transação + comissão
  async function finalizePay() {
    if (!paying) return;
    const { appt, method, amount } = paying;
    const finalAmount = parseFloat(String(amount).replace(",", "."));
    if (isNaN(finalAmount) || finalAmount <= 0) { flash("Valor inválido", "err"); return; }

    // 1) Marca atendimento como feito (no banco + estado)
    await updateAppt(appt.id, { status: "done", paid: true });

    // 2) Cria transação no financeiro (Supabase)
    const commissionPct = appt.barber.commission || 0;
    const commissionAmount = +(finalAmount * commissionPct / 100).toFixed(2);
    await createTxn({
      date:             appt.date,
      desc:             appt.service.name + " - " + appt.client,
      amount:           finalAmount,
      method,
      barberId:         appt.barber.id,
      out:              false,
      apptId:           appt.id,
      commissionPct,
      commissionAmount,
    });

    setPaying(null);
    flash("✓ Pago: " + fmtMoney(finalAmount) + " · Comissão " + fmtMoney(commissionAmount), "success");
  }

  // Gera "código Pix" simulado (em produção viria da API do Asaas/Mercado Pago)
  function generatePixCode() {
    if (!paying) return;
    const amount = parseFloat(String(paying.amount).replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;
    // Formato simplificado de Pix Copia-e-Cola (não é um BRCode real)
    const pixCode = "00020126360014BR.GOV.BCB.PIX0114+5551999990000520400005303986540" + amount.toFixed(2).replace(".", "") + "5802BR5913FADEIN BARBER6014VIAMAO" + Math.random().toString(36).slice(2, 10).toUpperCase() + "6304ABCD";
    setPaying(p => ({ ...p, pixCode }));
  }

  function markDone(id) {
    const appt = appts.find(a => a.id === id);
    if (appt) openPay(appt);
  }
  async function confirmIt(id)   { await updateAppt(id, { status: "confirmed" }); flash("Confirmado"); }
  async function reallyCancel()  { if (confirming) await cancelAppt(confirming.id); setConfirming(null); flash("Agendamento cancelado", "err"); }

  useEffect(() => {
    if (stripRef.current && viewMode === "strip") {
      const btn = stripRef.current.querySelector("[data-today]");
      if (btn) btn.scrollIntoView({ inline: "center", behavior: "auto" });
    }
  }, [viewMode]);

  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  // Stats by barber for the day
  const barberStats = barbers.map(b => {
    const dayApp = appts.filter(a => a.date === selDate && a.barber.id === b.id);
    return {
      barber: b,
      total: dayApp.length,
      done:  dayApp.filter(a => a.status === "done").length,
      revenue: dayApp.filter(a => a.status === "done").reduce((s, a) => s + a.service.price, 0),
    };
  });

  return (
    <div className="fade-in">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", color: C.fg, letterSpacing: -0.5 }}>Agenda</h1>
          <p style={{ fontSize: 13, color: C.fgMuted, margin: 0, textTransform: "capitalize" }}>
            {selDate === TODAY_DS && <span style={{ color: C.goldBright, fontWeight: 600 }}>Hoje · </span>}
            {fmtFull(selDate)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: C.bgSunken, padding: 3, borderRadius: 8 }}>
            {[["strip","Linha"],["month","Mês"]].map(([v, l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: "5px 14px", borderRadius: 6, border: "none",
                background: viewMode === v ? C.card : "transparent",
                color: viewMode === v ? C.goldBright : C.fgMuted,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{l}</button>
            ))}
          </div>
          <Btn onClick={openNew} icon={Ic.plus} disabled={dateIsPast}>Novo agendamento</Btn>
        </div>
      </div>

      {/* Quick stats por barbeiro */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        {barberStats.map(({ barber: b, total, done, revenue }) => {
          const active = barberF === b.id;
          return (
            <div key={b.id}
              onClick={() => setBarberF(active ? 0 : b.id)}
              style={{
                background: active ? b.color + "15" : C.card,
                border: "1px solid " + (active ? b.color : C.border),
                borderRadius: 10, padding: "12px 14px",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: b.color + "30", color: b.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>{b.avatar}</div>
                <span style={{ fontSize: 13, color: C.fg, fontWeight: 600, flex: 1 }}>{b.name}</span>
                {active && <Badge color={b.color}>Filtro</Badge>}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.fgMuted }}>
                <span><b style={{ color: C.fg, fontSize: 13 }}>{total}</b> agend.</span>
                <span><b style={{ color: C.green, fontSize: 13 }}>{done}</b> feitos</span>
                <span style={{ marginLeft: "auto", color: C.goldBright, fontWeight: 700 }}>{fmtMoney(revenue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Date selector */}
      {viewMode === "strip" ? (
        <div ref={stripRef} style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          {stripDates.map(ds => {
            const cnt     = appts.filter(a => a.date === ds).length;
            const isToday = ds === TODAY_DS;
            const isSel   = ds === selDate;
            const past    = isPast(ds);
            return (
              <button key={ds} data-today={isToday ? "" : undefined}
                onClick={() => setSelDate(ds)}
                style={{
                  minWidth: 56, flexShrink: 0, padding: "10px 6px",
                  borderRadius: 10, cursor: "pointer", textAlign: "center",
                  border: "1px solid " + (isSel ? C.goldBright : isToday ? C.goldBright + "60" : C.border),
                  background: isSel ? C.goldDim : isToday ? C.goldFaint : C.card,
                  opacity: past && !isSel ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: isSel ? C.goldBright : C.fgMuted, fontWeight: 600 }}>
                  {fmtWeekday(ds)}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, margin: "3px 0", color: isSel ? C.goldBright : past ? C.muted : C.fg }}>
                  {parseDS(ds).getDate()}
                </div>
                <div style={{ height: 4, display: "flex", justifyContent: "center", gap: 2 }}>
                  {cnt > 0 && [...Array(Math.min(cnt, 4))].map((_, i) =>
                    <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: isSel ? C.goldBright : C.goldBright + "60" }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => setCalMonth(p => { const d = new Date(p.y, p.m - 1); return { y: d.getFullYear(), m: d.getMonth() }; })}
              style={{ background: "transparent", border: "1px solid " + C.border, color: C.fgMuted, cursor: "pointer", padding: "6px 10px", borderRadius: 6 }}>
              {Ic.chevL}
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.fg }}>{MONTHS[calMonth.m]} {calMonth.y}</span>
            <button onClick={() => setCalMonth(p => { const d = new Date(p.y, p.m + 1); return { y: d.getFullYear(), m: d.getMonth() }; })}
              style={{ background: "transparent", border: "1px solid " + C.border, color: C.fgMuted, cursor: "pointer", padding: "6px 10px", borderRadius: 6 }}>
              {Ic.chevR}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((d, i) =>
              <div key={i} style={{ textAlign: "center", fontSize: 9, color: C.fgMuted, fontWeight: 700, padding: "4px 0", letterSpacing: 0.5 }}>{d}</div>
            )}
            {calDays.map((ds, i) => {
              if (!ds) return <div key={i} />;
              const cnt = appts.filter(a => a.date === ds).length;
              const isSel   = ds === selDate;
              const isToday = ds === TODAY_DS;
              const past    = isPast(ds);
              return (
                <button key={ds} onClick={() => setSelDate(ds)} style={{
                  height: 44, borderRadius: 8,
                  border: "1px solid " + (isSel ? C.goldBright : isToday ? C.goldBright + "50" : C.border),
                  background: isSel ? C.goldDim : isToday ? C.goldFaint : "transparent",
                  color: isSel ? C.goldBright : past ? C.faded : C.fg,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 3,
                  fontSize: 13, fontWeight: isSel || isToday ? 700 : 500,
                  position: "relative",
                }}>
                  {parseDS(ds).getDate()}
                  {cnt > 0 && (
                    <div style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: isSel ? C.goldBright : past ? C.faded : C.goldBright + "90",
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, marginRight: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Filtro:</span>
        {[["all","Todos",null],["pending","Pendentes",C.amber],["confirmed","Confirmados",C.goldBright],["done","Feitos",C.green]].map(([v, l, col]) => (
          <button key={v} onClick={() => setStatusF(v)} style={{
            padding: "4px 11px", borderRadius: 18, fontSize: 11, fontWeight: 600, cursor: "pointer",
            border: "1px solid " + (statusF === v ? (col || C.fg) : C.border),
            background: statusF === v ? (col || C.fg) + "20" : "transparent",
            color: statusF === v ? (col || C.fg) : C.fgMuted,
          }}>{l}</button>
        ))}
      </div>

      {/* Appointment list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 ? (
          <div style={{ background: C.card, border: "1px dashed " + C.border, borderRadius: 14, padding: 56, textAlign: "center" }}>
            <div style={{ color: C.faded, marginBottom: 12, fontSize: 38 }}>🗓</div>
            <p style={{ color: C.fgMuted, fontSize: 14, margin: "0 0 16px" }}>Nenhum agendamento neste dia</p>
            {!dateIsPast && <Btn sm onClick={openNew} icon={Ic.plus}>Criar primeiro</Btn>}
          </div>
        ) : shown.map(a => {
          const isDone      = a.status === "done";
          const isCancelled = a.status === "cancelled";
          const isToday     = a.date === TODAY_DS;
          const isPaid   = a.paid;
          const statusBg = a.status === "pending"   ? C.amberDim
                         : a.status === "confirmed" ? C.goldDim
                         : a.status === "done"      ? C.greenDim
                         : a.status === "cancelled" ? C.redDim
                         : C.bgSunken;
          const statusFg = a.status === "pending"   ? C.amber
                         : a.status === "confirmed" ? C.goldBright
                         : a.status === "done"      ? C.green
                         : a.status === "cancelled" ? C.red
                         : C.fgMuted;
          return (
            <div key={a.id} style={{
              display: "flex", alignItems: "stretch", gap: 0,
              background: C.card, border: "1px solid " + C.border, borderRadius: 12,
              overflow: "hidden", transition: "border-color 0.15s, transform 0.15s",
              opacity: isDone ? 0.78 : isCancelled ? 0.55 : 1,
            }}>
              {/* Faixa do barbeiro (esquerda) */}
              <div style={{ width: 5, background: a.barber.color, flexShrink: 0 }} />

              {/* Bloco da HORA (destaque) */}
              <div style={{
                width: 78, flexShrink: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: C.bgSunken,
                padding: "14px 8px",
              }}>
                <div style={{
                  fontSize: 22, fontWeight: 700, color: C.goldBright,
                  fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: -0.5,
                }}>
                  {a.time}
                </div>
                <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 4, fontWeight: 500 }}>
                  {a.service.duration}min
                </div>
              </div>

              {/* Conteúdo principal */}
              <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {/* Cliente em destaque */}
                <div style={{
                  fontSize: 15, fontWeight: 700, color: C.fg,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  marginBottom: 4,
                }}>
                  {a.client}
                </div>
                {/* Linha secundária: serviço + barbeiro + preço */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{
                    background: a.barber.color + "18", color: a.barber.color,
                    padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%",
                      background: a.barber.color + "30", color: a.barber.color,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700,
                    }}>{a.barber.avatar}</span>
                    {a.barber.name}
                  </span>
                  <span style={{ color: C.fgMuted }}>·</span>
                  <span style={{ color: C.fg, fontWeight: 500 }}>{a.service.name}</span>
                  <span style={{ color: C.fgMuted }}>·</span>
                  <span style={{ color: C.goldBright, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoney(a.service.price)}
                  </span>
                </div>
              </div>

              {/* Status + Ações (direita) */}
              <div style={{
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end",
                gap: 8, padding: "12px 14px", flexShrink: 0,
              }}>
                {/* Status pill */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 12,
                  background: statusBg, color: statusFg, textTransform: "uppercase", letterSpacing: 0.5,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {a.status === "done" ? "✓ Feito"
                    : a.status === "confirmed" ? "● Confirmado"
                    : a.status === "pending" ? "○ Pendente"
                    : a.status === "cancelled" ? "✕ Cancelado"
                    : a.status}
                </span>
                {/* Ações
                   Regras:
                   - Cancelado: nenhum botão (estado final, não recebe pagamento)
                   - Concluído com valor pago: mostra o valor verde no lugar dos botões
                   - Data passada: nenhum botão (cliente já passou)
                   - Caso normal: 3 botões (confirmar se pendente, editar, excluir)
                   - Receber (💰): SÓ aparece no dia do corte (data === hoje),
                     porque não faz sentido receber pagamento de algo que ainda
                     não aconteceu */}
                {isDone && a.paidAmount ? (
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} title={"Pago via " + a.paidMethod}>
                    +{fmtMoney(a.paidAmount)}
                  </span>
                ) : (!isDone && !isCancelled && !dateIsPast) && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {isToday && <Btn sm v="primary" onClick={() => markDone(a.id)} title="Concluir e receber">💰</Btn>}
                    {a.status === "pending" && <Btn sm v="success" onClick={() => confirmIt(a.id)} title="Confirmar">{Ic.check}</Btn>}
                    <Btn sm v="ghost" onClick={() => openEdit(a)} title="Editar">{Ic.edit}</Btn>
                    <Btn sm v="danger" onClick={() => setConfirming(a)} title="Cancelar">{Ic.trash}</Btn>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: C.fgMuted, marginTop: 14, display: "flex", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
        <span>{shown.length} agendamento{shown.length !== 1 ? "s" : ""} mostrado{shown.length !== 1 ? "s" : ""}</span>
        <span>Total previsto: <b style={{ color: C.goldBright }}>{fmtMoney(shown.reduce((s, a) => s + a.service.price, 0))}</b></span>
      </div>

      {/* MODAL: Novo / Editar */}
      {modal && (
        <Modal
          title={editing ? "Editar agendamento" : "Novo agendamento"}
          subtitle={fmtFull(selDate)}
          onClose={() => { setModal(false); setEditing(null); }}
        >
          {/* Client autocomplete */}
          <div style={{ position: "relative" }}>
            <Inp
              label="Cliente"
              placeholder="Nome do cliente"
              value={form.client}
              onChange={e => { setForm(p => ({ ...p, client: e.target.value })); setClientSugg(true); }}
              onFocus={() => setClientSugg(true)}
              onBlur={() => setTimeout(() => setClientSugg(false), 150)}
              autoComplete="off"
            />
            {clientSugg && clientMatches.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: C.card2, border: "1px solid " + C.borderHi, borderRadius: 8,
                zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", overflow: "hidden",
              }}>
                {clientMatches.map(c => (
                  <div key={c.id} onMouseDown={() => pickClient(c)} style={{
                    padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid " + C.border,
                  }}>
                    <div style={{ fontSize: 13, color: C.fg, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: C.fgMuted }}>{c.phone} · {c.visits} visitas</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!editing && (
            <Inp label="WhatsApp (opcional)" placeholder="(51) 99999-0000"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          )}

          <Sel label="Serviço" value={form.serviceId}
            onChange={e => updForm("serviceId", e.target.value)}
            options={services.map(s => ({ v: String(s.id), l: s.name + " — " + fmtMoney(s.price) + " (" + s.duration + "min)" }))} />

          <Sel label="Barbeiro" value={form.barberId}
            onChange={e => updForm("barberId", e.target.value)}
            options={barbers.map(b => ({ v: String(b.id), l: b.name }))} />

          <Sel label={"Horário · " + avSlots.length + " disponíveis"} value={form.time}
            onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
            options={avSlots.length > 0 ? avSlots.map(h => ({ v: h, l: h })) : [{ v: "", l: "Sem horários disponíveis" }]} />

          {avSlots.length === 0 && (
            <div style={{ padding: 10, background: C.redDim, border: "1px solid " + C.red + "30", borderRadius: 8, fontSize: 12, color: C.red }}>
              ⚠ Este barbeiro não tem horários livres neste dia
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={saveAppt} disabled={!form.client.trim() || !form.time} full>
              {editing ? "Salvar alterações" : "Confirmar agendamento"}
            </Btn>
            <Btn v="ghost" onClick={() => { setModal(false); setEditing(null); }}>Cancelar</Btn>
          </div>
        </Modal>
      )}

      {/* MODAL: Pagamento ao concluir atendimento */}
      {paying && (
        <Modal
          title="Receber pagamento"
          subtitle={paying.appt.client + " · " + paying.appt.service.name}
          onClose={() => setPaying(null)}
          width={420}
        >
          {/* Valor */}
          <Field label="Valor recebido (R$)">
            <input
              type="number"
              value={paying.amount}
              onChange={e => setPaying(p => ({ ...p, amount: e.target.value, pixCode: null }))}
              autoFocus
              style={{
                width: "100%", padding: "14px 16px",
                fontSize: 22, fontWeight: 700, color: C.goldBright,
                background: C.bgSunken, border: "1px solid " + C.border,
                borderRadius: 10, outline: "none", textAlign: "center",
                fontFamily: "Georgia, serif",
              }}
            />
          </Field>

          {(() => {
            const amt = parseFloat(String(paying.amount).replace(",", "."));
            const orig = paying.appt.service.price;
            if (!isNaN(amt) && amt > orig) {
              return <div style={{ fontSize: 11, color: C.green, textAlign: "center", marginTop: -8 }}>
                + {fmtMoney(amt - orig)} de gorjeta
              </div>;
            }
            return null;
          })()}

          {/* Forma de pagamento */}
          <Field label="Forma de pagamento">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                ["Pix",      C.green],
                ["Cartão",   C.blue],
                ["Dinheiro", C.amber],
              ].map(([m, col]) => {
                const sel = paying.method === m;
                return (
                  <button key={m}
                    onClick={() => setPaying(p => ({ ...p, method: m, pixCode: null }))}
                    style={{
                      padding: "12px 8px", borderRadius: 9,
                      border: "1px solid " + (sel ? col : C.border),
                      background: sel ? col + "20" : "transparent",
                      color: sel ? col : C.fgMuted,
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >{m}</button>
                );
              })}
            </div>
          </Field>

          {/* Pix QR Code */}
          {paying.method === "Pix" && (
            <div>
              {!paying.pixCode ? (
                <Btn v="ghost" onClick={generatePixCode} full>
                  Gerar QR Pix de {fmtMoney(parseFloat(paying.amount) || 0)}
                </Btn>
              ) : (
                <div style={{
                  background: "#fff", padding: 16, borderRadius: 10, textAlign: "center",
                }}>
                  {/* QR Code SVG visual (placeholder pattern) */}
                  <svg width="160" height="160" viewBox="0 0 21 21" style={{ width: 160, height: 160, display: "block", margin: "0 auto 8px", imageRendering: "pixelated" }}>
                    {/* Padrão visual de QR — em produção use uma lib real (qrcode.react) */}
                    {Array.from({ length: 21 * 21 }).map((_, i) => {
                      const x = i % 21, y = Math.floor(i / 21);
                      // Cantos (finder patterns)
                      const inFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
                      if (inFinder) {
                        const fx = x < 7 ? x : x - 14;
                        const fy = y < 7 ? y : y - 14;
                        const isOuter = fx === 0 || fx === 6 || fy === 0 || fy === 6;
                        const isInner = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
                        if (isOuter || isInner) return <rect key={i} x={x} y={y} width="1" height="1" fill="#000" />;
                        return null;
                      }
                      // Pseudo-random data baseado no código
                      const seed = (paying.pixCode.charCodeAt((x + y * 3) % paying.pixCode.length) + x * y) % 3;
                      return seed === 0 ? <rect key={i} x={x} y={y} width="1" height="1" fill="#000" /> : null;
                    })}
                  </svg>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 8, fontFamily: "ui-monospace, monospace", wordBreak: "break-all", padding: "0 8px" }}>
                    {paying.pixCode.slice(0, 80)}...
                  </div>
                  <Btn sm v="ghost" onClick={() => navigator.clipboard?.writeText(paying.pixCode)}>
                    Copiar Pix Copia-e-Cola
                  </Btn>
                </div>
              )}
            </div>
          )}

          {/* Comissão preview */}
          {(() => {
            const amt = parseFloat(String(paying.amount).replace(",", "."));
            if (isNaN(amt) || amt <= 0) return null;
            const com = amt * paying.appt.barber.commission / 100;
            const casa = amt - com;
            return (
              <div style={{
                background: C.bgSunken, border: "1px solid " + C.border,
                borderRadius: 10, padding: 14,
              }}>
                <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                  Divisão automática
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.fg, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: paying.appt.barber.color + "30", color: paying.appt.barber.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                      {paying.appt.barber.avatar}
                    </div>
                    {paying.appt.barber.name} · {paying.appt.barber.commission}%
                  </span>
                  <b style={{ color: C.green }}>{fmtMoney(com)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: C.fgMuted }}>Casa · {100 - paying.appt.barber.commission}%</span>
                  <b style={{ color: C.fg }}>{fmtMoney(casa)}</b>
                </div>
              </div>
            );
          })()}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={finalizePay} disabled={!paying.amount || parseFloat(paying.amount) <= 0} full>
              ✓ Confirmar recebimento
            </Btn>
            <Btn v="ghost" onClick={() => setPaying(null)}>Cancelar</Btn>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirming}
        title="Cancelar agendamento?"
        message={confirming ? "Tem certeza que quer cancelar o agendamento de " + confirming.client + " às " + confirming.time + "?" : ""}
        onConfirm={reallyCancel}
        onCancel={() => setConfirming(null)}
        danger
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FINANCEIRO
// ═══════════════════════════════════════════════════════════════════════════
function Financeiro({ txns, setTxns, navigate, createTxn, deleteTxn }) {
  const [period, setPeriod] = useState("month");
  const [tab, setTab]       = useState("all");
  const [modal, setModal]   = useState(false);
  const [hov, setHov]       = useState(null);
  const [form, setForm]     = useState({ desc: "", amount: "", method: "Pix", out: false });

  // Detecta mobile pra ajustar viewBox do gráfico (mesma estratégia do Dashboard)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const startDs = period === "today" ? TODAY_DS : toDS(addDays(BASE_DATE, period === "week" ? -7 : -30));
  const filtered = txns
    .filter(t => t.date >= startDs)
    .filter(t => tab === "all" || (tab === "in" ? !t.out : t.out));

  const totalIn  = filtered.filter(t => !t.out).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t =>  t.out).reduce((s, t) => s + t.amount, 0);

  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  const daily = useMemo(() => {
    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
      const ds  = toDS(addDays(BASE_DATE, -i));
      const inc = txns.filter(t => t.date === ds && !t.out).reduce((s, t) => s + t.amount, 0);
      const out = txns.filter(t => t.date === ds &&  t.out).reduce((s, t) => s + t.amount, 0);
      // Em "30 dias" mostra dia/mês curto; em "7 dias" mostra dia da semana
      const label = period === "week"
        ? fmtWeekday(ds)
        : period === "today"
        ? "Hoje"
        : fmtShort(ds);
      arr.push({ ds, inc, out, balance: inc - out, label });
    }
    return arr;
  }, [period, txns, days]);

  // Escala do eixo Y: pega o maior valor entre entradas e saídas
  const maxVal = Math.max(...daily.map(p => Math.max(p.inc, p.out)), 1);
  // Picos de cada série (pra destacar)
  const peakInIdx  = daily.reduce((b, p, i, a) => p.inc > a[b].inc ? i : b, 0);
  const peakOutIdx = daily.reduce((b, p, i, a) => p.out > a[b].out ? i : b, 0);
  // Saldo médio do período
  const avgBalance = daily.length > 0
    ? daily.reduce((s, p) => s + p.balance, 0) / daily.length
    : 0;

  // Dimensões responsivas — desktop panorâmico, mobile mais quadrado
  // (same pattern do gráfico do Dashboard)
  const SVG_W = isMobile ? 380 : 900;
  const SVG_H = isMobile ? 280 : 280;
  const PAD_X = 36;
  const PAD_T = 16;
  const PAD_B = 24;

  // Coordenadas dos pontos de cada série
  const xAt = (i) => PAD_X + (i / Math.max(daily.length - 1, 1)) * (SVG_W - PAD_X * 2);
  const yAt = (val) => PAD_T + (1 - val / maxVal) * (SVG_H - PAD_T - PAD_B);

  const incPts = daily.map((p, i) => ({ x: xAt(i), y: yAt(p.inc), ...p }));
  const outPts = daily.map((p, i) => ({ x: xAt(i), y: yAt(p.out), ...p }));

  const incLine = incPts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const outLine = outPts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const incArea = incLine + " L" + (SVG_W - PAD_X) + " " + (SVG_H - PAD_B) + " L" + PAD_X + " " + (SVG_H - PAD_B) + " Z";

  const byMethod = {};
  filtered.filter(t => !t.out).forEach(t => { byMethod[t.method] = (byMethod[t.method] || 0) + t.amount; });

  async function addTx() {
    const amt = parseFloat(String(form.amount).replace(",", "."));
    if (!form.desc.trim() || isNaN(amt) || amt <= 0) return;
    await createTxn({
      date: TODAY_DS,
      desc: form.desc.trim(),
      amount: amt,
      method: form.method,
      barberId: null,
      out: form.out,
    });
    setModal(false);
    setForm({ desc: "", amount: "", method: "Pix", out: false });
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: C.fg, letterSpacing: -0.5 }}>Financeiro</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn sm icon={Ic.plus} onClick={() => setModal(true)}>Lançar</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bgSunken, padding: 3, borderRadius: 9, width: "fit-content" }}>
        {[["today","Hoje"],["week","7 dias"],["month","30 dias"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{
            padding: "6px 14px", borderRadius: 7, border: "none",
            background: period === v ? C.card : "transparent",
            color: period === v ? C.goldBright : C.fgMuted,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KPI label="Entradas" value={fmtMoney(totalIn)} note="receita do período" />
        <KPI label="Saídas"   value={fmtMoney(totalOut)} note="custos e despesas" />
        <KPI label="Saldo"    value={fmtMoney(totalIn - totalOut)} note={totalIn >= totalOut ? "positivo" : "negativo"} up={totalIn >= totalOut} accent />
      </div>

      <div style={{
        background: C.card, border: "1px solid " + C.border, borderRadius: 14,
        padding: "20px 24px", marginBottom: 16,
        boxShadow: "0 1px 0 " + C.borderHi + " inset",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
              Fluxo de caixa
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: totalIn >= totalOut ? C.green : C.red, marginTop: 4, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>
              {totalIn >= totalOut ? "+" : ""}{fmtMoney(totalIn - totalOut)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, background: C.green, borderRadius: 2 }} />
              <span style={{ color: C.fgMuted }}>Entradas</span>
              <b style={{ color: C.green, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(totalIn)}</b>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, background: C.red, borderRadius: 2 }} />
              <span style={{ color: C.fgMuted }}>Saídas</span>
              <b style={{ color: C.red, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(totalOut)}</b>
            </div>
          </div>
        </div>

        <div className="dashboard-chart-wrap" style={{ position: "relative" }}>
          <svg
            width="100%"
            viewBox={"0 0 " + SVG_W + " " + SVG_H}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", width: "100%", overflow: "visible" }}
          >
            <defs>
              {/* Gradients ricos (3 stops) pra entradas e saídas */}
              <linearGradient id="finIncArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.green} stopOpacity="0.42" />
                <stop offset="55%"  stopColor={C.green} stopOpacity="0.10" />
                <stop offset="100%" stopColor={C.green} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="finOutArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.red} stopOpacity="0.30" />
                <stop offset="100%" stopColor={C.red} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="finIncLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7DD894" />
                <stop offset="100%" stopColor={C.green} />
              </linearGradient>
              <linearGradient id="finOutLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#F08585" />
                <stop offset="100%" stopColor={C.red} />
              </linearGradient>
              <filter id="finGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid horizontal — 4 linhas de referência */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = PAD_T + f * (SVG_H - PAD_T - PAD_B);
              return (
                <line key={f}
                  x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y}
                  stroke={C.border} strokeWidth="1"
                  strokeDasharray={f === 1 ? "0" : "2 4"}
                  opacity={f === 1 ? 0.7 : 0.32}
                />
              );
            })}

            {/* Labels do eixo Y — discretos à esquerda */}
            {[1, 0.5, 0].map(f => {
              const y = PAD_T + (1 - f) * (SVG_H - PAD_T - PAD_B);
              const value = maxVal * f;
              const label = value >= 1000 ? "R$" + Math.round(value / 100) / 10 + "k" : "R$" + Math.round(value);
              return (
                <text key={f}
                  x={PAD_X - 6} y={y + 3}
                  textAnchor="end" fontSize="10"
                  fill={C.muted}
                  fontFamily="ui-monospace, monospace"
                >{label}</text>
              );
            })}

            {daily.length > 1 && (
              <>
                {/* Áreas — entrada por baixo, saída por cima com transparência */}
                <path d={incArea} fill="url(#finIncArea)" />
                {/* Saída como path linha + área menor (não vai até 0, fica como "sombra") */}
                {(() => {
                  const outArea = outLine + " L" + (SVG_W - PAD_X) + " " + (SVG_H - PAD_B) + " L" + PAD_X + " " + (SVG_H - PAD_B) + " Z";
                  return <path d={outArea} fill="url(#finOutArea)" />;
                })()}
                {/* Linhas — entrada sólida, saída sólida (não tracejada — fica mais legível) */}
                <path d={incLine} fill="none" stroke="url(#finIncLine)" strokeWidth={isMobile ? "2.6" : "2.2"} strokeLinejoin="round" strokeLinecap="round" />
                <path d={outLine} fill="none" stroke="url(#finOutLine)" strokeWidth={isMobile ? "2" : "1.8"} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}

            {/* Destaque do pico de entradas (anel + glow verde) */}
            {daily.length > 1 && daily[peakInIdx]?.inc > 0 && (() => {
              const p = incPts[peakInIdx];
              return (
                <g>
                  <circle cx={p.x} cy={p.y} r="9" fill="none" stroke={C.green} strokeWidth="1" opacity="0.4" />
                  <circle cx={p.x} cy={p.y} r="5" fill={C.green} filter="url(#finGlow)" opacity="0.9" />
                </g>
              );
            })()}
            {/* Destaque do pico de saídas (anel vermelho mais sutil) */}
            {daily.length > 1 && daily[peakOutIdx]?.out > 0 && peakOutIdx !== peakInIdx && (() => {
              const p = outPts[peakOutIdx];
              return (
                <circle cx={p.x} cy={p.y} r="4.5" fill={C.red} stroke={C.card} strokeWidth="1.5" />
              );
            })()}

            {/* Pontos + interação */}
            {daily.map((p, i) => {
              const isHov  = hov === i;
              const isLast = i === daily.length - 1;
              const isPeakIn  = i === peakInIdx  && p.inc > 0;
              const isPeakOut = i === peakOutIdx && p.out > 0;
              const ip = incPts[i], op = outPts[i];
              return (
                <g key={p.ds}
                   style={{ cursor: "pointer" }}
                   onMouseEnter={() => setHov(i)}
                   onMouseLeave={() => setHov(null)}
                   onTouchStart={() => setHov(i)}>
                  {/* hit area */}
                  <rect x={ip.x - (isMobile ? 18 : 14)} y={0}
                        width={isMobile ? 36 : 28} height={SVG_H} fill="transparent" />
                  {/* ponto entrada (não desenha se já é o pico destacado) */}
                  {!isPeakIn && p.inc > 0 && (
                    <circle cx={ip.x} cy={ip.y}
                      r={isHov || isLast ? 4 : 2.5}
                      fill={isLast ? C.green : C.card}
                      stroke={C.green}
                      strokeWidth={isLast ? 0 : 1.6}
                    />
                  )}
                  {/* ponto saída */}
                  {!isPeakOut && p.out > 0 && (
                    <circle cx={op.x} cy={op.y}
                      r={isHov ? 3.5 : 2.2}
                      fill={C.card}
                      stroke={C.red}
                      strokeWidth="1.5"
                    />
                  )}
                  {/* "agora" pulsando no último ponto se há entrada hoje */}
                  {isLast && p.inc > 0 && (
                    <circle cx={ip.x} cy={ip.y} r="9" fill={C.green} opacity="0.25" className="pulse" />
                  )}
                  {/* tooltip rico: data + entrada + saída + saldo */}
                  {isHov && (p.inc > 0 || p.out > 0) && (() => {
                    const tipW = isMobile ? 140 : 130;
                    const tipH = 68;
                    const anchorY = Math.min(ip.y, op.y || ip.y);
                    const tipX = Math.max(PAD_X, Math.min(SVG_W - PAD_X - tipW, ip.x - tipW / 2));
                    const tipY = Math.max(PAD_T, anchorY - tipH - 10);
                    const balanceColor = p.balance >= 0 ? C.green : C.red;
                    return (
                      <g pointerEvents="none">
                        <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="8"
                          fill={C.bgSunken} stroke={C.borderHi} strokeWidth="1" />
                        <text x={tipX + 10} y={tipY + 14} fontSize="9" fill={C.fgMuted}
                              fontWeight="600" textTransform="uppercase" letterSpacing="0.5">{p.label}</text>
                        {/* Entrada */}
                        <circle cx={tipX + 12} cy={tipY + 28} r="3" fill={C.green} />
                        <text x={tipX + 20} y={tipY + 31} fontSize="10" fill={C.fgMuted}>Entrada</text>
                        <text x={tipX + tipW - 10} y={tipY + 31} textAnchor="end"
                              fontSize="11" fill={C.green} fontWeight="700"
                              fontFamily="ui-monospace, monospace">{fmtMoney(p.inc)}</text>
                        {/* Saída */}
                        <circle cx={tipX + 12} cy={tipY + 44} r="3" fill={C.red} />
                        <text x={tipX + 20} y={tipY + 47} fontSize="10" fill={C.fgMuted}>Saída</text>
                        <text x={tipX + tipW - 10} y={tipY + 47} textAnchor="end"
                              fontSize="11" fill={C.red} fontWeight="700"
                              fontFamily="ui-monospace, monospace">{fmtMoney(p.out)}</text>
                        {/* Saldo */}
                        <line x1={tipX + 8} y1={tipY + 54} x2={tipX + tipW - 8} y2={tipY + 54}
                              stroke={C.border} strokeWidth="1" />
                        <text x={tipX + 10} y={tipY + 64} fontSize="10" fill={C.fgMuted} fontWeight="600">Saldo</text>
                        <text x={tipX + tipW - 10} y={tipY + 64} textAnchor="end"
                              fontSize="11" fill={balanceColor} fontWeight="700"
                              fontFamily="ui-monospace, monospace">{p.balance >= 0 ? "+" : ""}{fmtMoney(p.balance)}</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Labels do eixo X */}
            {daily.map((p, i) => {
              const targetCount = isMobile ? 4 : 7;
              const show = period === "week"
                ? true
                : period === "today"
                ? true
                : (i % Math.ceil(daily.length / targetCount) === 0 || i === daily.length - 1);
              if (!show) return null;
              return (
                <text key={p.ds + "-l"}
                  x={xAt(i)} y={SVG_H - 6}
                  textAnchor="middle"
                  fontSize={isMobile ? "10" : "9"}
                  fill={C.fgMuted}
                  fontWeight="500"
                >{p.label}</text>
              );
            })}
          </svg>
        </div>

        {/* Resumo abaixo do chart: melhor dia / pior dia / saldo médio */}
        {daily.length > 1 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid " + C.border,
          }}>
            <div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                Melhor dia
              </div>
              <div style={{ fontSize: 14, color: C.green, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {fmtMoney(daily[peakInIdx]?.inc || 0)}
              </div>
              <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>
                {daily[peakInIdx]?.label || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                Maior gasto
              </div>
              <div style={{ fontSize: 14, color: C.red, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {fmtMoney(daily[peakOutIdx]?.out || 0)}
              </div>
              <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>
                {(daily[peakOutIdx]?.out || 0) > 0 ? daily[peakOutIdx]?.label : "—"}
              </div>
            </div>
            {!isMobile && (
              <div>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  Saldo médio / dia
                </div>
                <div style={{
                  fontSize: 14,
                  color: avgBalance >= 0 ? C.fg : C.red,
                  fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2,
                }}>
                  {avgBalance >= 0 ? "+" : ""}{fmtMoney(avgBalance)}
                </div>
                <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 2 }}>
                  {daily.length} dias analisados
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid " + C.border }}>
          {(() => {
            const total = Object.values(byMethod).reduce((s, v) => s + v, 0);
            return Object.entries(byMethod).map(([m, v]) => {
              const pct = total > 0 ? (v / total) * 100 : 0;
              const col = m === "Pix" ? C.green : m === "Cartão" ? C.blue : C.amber;
              return (
                <div key={m} style={{
                  background: C.bgSunken, borderRadius: 10, padding: "14px 16px",
                  border: "1px solid " + C.border,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{m}</span>
                    <span style={{ fontSize: 10, color: col, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.fg, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(v)}</div>
                  <div style={{ height: 4, borderRadius: 2, background: C.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: col, borderRadius: 2, transition: "width 0.6s" }} />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid " + C.border, marginBottom: 12 }}>
        {[["all","Todos"],["in","Entradas"],["out","Saídas"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: "10px 18px", border: "none",
            borderBottom: tab === v ? "2px solid " + C.goldBright : "2px solid transparent",
            background: "transparent", color: tab === v ? C.goldBright : C.fgMuted,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
        {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(t => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "11px 18px", borderBottom: "1px solid " + C.border,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: t.out ? C.redDim : C.greenDim,
              color: t.out ? C.red : C.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>{t.out ? "↓" : "↑"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{t.desc}</div>
              <div style={{ fontSize: 11, color: C.fgMuted }}>
                {fmtShort(t.date)} · {t.method}{t.barber !== "-" ? " · " + t.barber : ""}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.out ? C.red : C.green, flexShrink: 0 }}>
              {t.out ? "−" : "+"}{fmtMoney(t.amount)}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Novo lançamento" onClose={() => setModal(false)}>
          <Sel label="Tipo" value={String(form.out)} onChange={e => setForm(p => ({ ...p, out: e.target.value === "true" }))}
            options={[{ v: "false", l: "↑ Entrada" }, { v: "true", l: "↓ Saída" }]} />
          <Inp label="Descrição" placeholder="Ex: Corte + Barba" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
          <Inp label="Valor (R$)" type="number" placeholder="0,00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Sel label="Pagamento" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
            options={[{ v: "Pix", l: "Pix" }, { v: "Cartão", l: "Cartão" }, { v: "Dinheiro", l: "Dinheiro" }]} />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={addTx} full>Salvar</Btn>
            <Btn v="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LINK DE AGENDAMENTO — funcional + escreve no estado real
// ═══════════════════════════════════════════════════════════════════════════
function LinkAgendamento({ shop, appts, setAppts, services, clients, setClients, barbers, createAppt, upsertClientFromAppt }) {
  const [step, setStep]               = useState("service");
  const [selSvc, setSelSvc]           = useState(null);
  const [selBarber, setSelBarber]     = useState(null);
  const [selDate, setSelDate]         = useState(TODAY_DS);
  const [selTime, setSelTime]         = useState(null);
  const [clientName, setClientName]   = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [confirmed, setConfirmed]     = useState(null);
  const [copied, setCopied]           = useState(false);

  const slug = slugify(shop.name);
  const origin = (typeof window !== "undefined" && window.location.origin) ? window.location.origin : "https://fadein.app";
  const link = origin + "/agendar/" + slug;

  // Dias disponíveis: respeita os dias de funcionamento configurados em Config
  // (suporta dayHours por dia OU openTime/closeTime+workDays legacy via getDayHours).
  const bookDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 30; i++) {
      const ds  = toDS(addDays(BASE_DATE, i));
      const dow = parseDS(ds).getDay();
      if (getDayHours(shop, dow).enabled) arr.push(ds);
    }
    return arr;
  }, [shop]);

  // Slots de horário do dia selecionado — respeita o open/close DAQUELE dia
  const dayHours = useMemo(() => {
    const dow = parseDS(selDate).getDay();
    return getDayHourSlots(shop, dow);
  }, [shop, selDate]);

  const allSlotsInfo = useMemo(() => {
    if (!selBarber || !selSvc) return [];
    const busy = appts
      .filter(a => a.date === selDate && a.barber.id === selBarber.id && a.status !== "cancelled")
      .map(a => {
        const [h, m] = a.time.split(":").map(Number);
        const s = h * 60 + m;
        return { s, e: s + a.service.duration };
      });
    return dayHours.map(slot => {
      const [h, m] = slot.split(":").map(Number);
      const s = h * 60 + m, e = s + selSvc.duration;
      return { time: slot, available: !busy.some(b => s < b.e && e > b.s) };
    });
  }, [selDate, selBarber, selSvc, appts, dayHours]);

  function reset() {
    setStep("service"); setSelSvc(null); setSelBarber(null);
    setSelTime(null); setClientName(""); setClientPhone(""); setConfirmed(null);
  }

  async function confirm() {
    if (!clientName.trim()) return;
    // ESCREVE NO BANCO via createAppt
    const newAppt = await createAppt({
      date: selDate, time: selTime,
      client: clientName.trim(),
      clientPhone: clientPhone || "",
      service: selSvc, barber: selBarber,
      status: "pending", paid: false,
    });
    // Atualiza/cria cliente no Supabase
    await upsertClientFromAppt({
      name: clientName.trim(),
      phone: clientPhone || "",
      date: selDate,
      barberId: selBarber.id,
      notes: "Veio pelo link de agendamento",
    });
    setConfirmed(newAppt || { date: selDate, time: selTime, client: clientName.trim(), service: selSvc, barber: selBarber });
    setStep("done");
  }

  const STEPS = ["service","barber","time","confirm"];

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", color: C.fg, fontFamily: "Georgia, serif" }}>Link de Agendamento</h1>
      <p style={{ fontSize: 13, color: C.fgMuted, margin: "0 0 24px" }}>
        Compartilhe esse link no WhatsApp, Instagram ou bio. Os clientes agendam direto e cai na sua agenda automaticamente — 24h, sem você responder.
      </p>

      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <code style={{ flex: 1, minWidth: 200, background: C.bgSunken, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.goldBright, border: "1px solid " + C.border, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{link}</code>
        <Btn sm onClick={() => {
          if (navigator.clipboard) navigator.clipboard.writeText(link);
          setCopied(true); setTimeout(() => setCopied(false), 2000);
        }}>{copied ? "✓ Copiado" : "Copiar link"}</Btn>
        <Btn sm v="ghost" icon={Ic.whatsapp} onClick={() => {
          const msg = encodeURIComponent("Olá! Você pode agendar seu horário aqui: " + link);
          window.open("https://wa.me/?text=" + msg, "_blank");
        }}>Enviar</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <Btn sm v="soft" onClick={() => window.open(link, "_blank")}>
          🔗 Abrir página real em nova aba
        </Btn>
      </div>

      <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>
        ▼ Pré-visualização (agendamentos feitos aqui caem na agenda real)
      </div>

      <div style={{
        maxWidth: 400, background: C.bgSunken, border: "1px solid " + C.border,
        borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}>
        <div style={{ padding: "14px 20px", background: C.card, borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", gap: 12 }}>
          <Logo scale={0.7} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.name}</div>
            <div style={{ fontSize: 11, color: C.fgMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.address}</div>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {step !== "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}>
              {STEPS.map((s, i) => {
                const labels = ["Serviço","Barbeiro","Horário","Confirmar"];
                const curIdx = STEPS.indexOf(step);
                const done   = curIdx > i;
                const active = curIdx === i;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        background: active ? C.goldBright : done ? C.goldDim : C.bgSunken,
                        color: active ? "#1A1A1A" : done ? C.goldBright : C.muted,
                        border: "1px solid " + (active ? C.goldBright : done ? C.goldBright + "40" : C.border),
                      }}>{done ? "✓" : i + 1}</div>
                      <span style={{ fontSize: 9, color: active ? C.goldBright : C.fgMuted, fontWeight: 500 }}>{labels[i]}</span>
                    </div>
                    {i < STEPS.length - 1 && <div style={{ height: 1, width: 12, background: done ? C.goldBright + "40" : C.border, marginBottom: 14 }} />}
                  </div>
                );
              })}
            </div>
          )}

          {step === "service" && (
            <div>
              <p style={{ fontSize: 13, color: C.fgMuted, margin: "0 0 12px" }}>Escolha o serviço:</p>
              {services.map(s => (
                <button key={s.id} onClick={() => { setSelSvc(s); setStep("barber"); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 14px", background: C.card, border: "1px solid " + C.border,
                    borderRadius: 10, marginBottom: 6, cursor: "pointer", color: C.fg, textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.fgMuted }}>{s.duration} minutos</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.goldBright, fontFamily: "Georgia, serif" }}>{fmtMoney(s.price)}</div>
                </button>
              ))}
            </div>
          )}

          {step === "barber" && (
            <div>
              <button onClick={() => setStep("service")} style={{ background: "none", border: "none", color: C.goldBright, cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                {Ic.chevL} Voltar
              </button>
              <p style={{ fontSize: 13, color: C.fgMuted, margin: "0 0 12px" }}>Escolha o barbeiro:</p>
              <div style={{ display: "flex", gap: 10 }}>
                {barbers.map(b => (
                  <button key={b.id} onClick={() => { setSelBarber(b); setSelTime(null); setStep("time"); }}
                    style={{
                      flex: 1, padding: "14px 8px", background: C.card,
                      border: "1px solid " + C.border, borderRadius: 10,
                      cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: b.color + "30", color: b.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, margin: "0 auto 8px",
                    }}>{b.avatar}</div>
                    <div style={{ fontSize: 13, color: C.fg, fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "time" && (
            <div>
              <button onClick={() => setStep("barber")} style={{ background: "none", border: "none", color: C.goldBright, cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                {Ic.chevL} Voltar
              </button>
              <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
                {bookDates.slice(0, 12).map(ds => (
                  <button key={ds} onClick={() => { setSelDate(ds); setSelTime(null); }} style={{
                    minWidth: 50, flexShrink: 0, padding: "8px 4px", borderRadius: 8,
                    border: "1px solid " + (selDate === ds ? C.goldBright : C.border),
                    background: selDate === ds ? C.goldDim : C.card,
                    cursor: "pointer", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 9, color: selDate === ds ? C.goldBright : C.fgMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{fmtWeekday(ds)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: selDate === ds ? C.goldBright : C.fg, marginTop: 2 }}>{parseDS(ds).getDate()}</div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: C.fgMuted, margin: "0 0 10px" }}>
                <b style={{ color: C.fg }}>{selBarber.name}</b> · {fmtShort(selDate)}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {allSlotsInfo.map(({ time, available }) => (
                  <button key={time} disabled={!available}
                    onClick={() => { setSelTime(time); setStep("confirm"); }}
                    style={{
                      padding: "9px 4px", borderRadius: 8,
                      border: "1px solid " + (available ? C.border : C.bgSunken),
                      background: available ? C.card : C.bgSunken,
                      color: available ? C.fg : C.faded,
                      fontSize: 12, fontWeight: 500,
                      cursor: available ? "pointer" : "not-allowed",
                      textDecoration: !available ? "line-through" : "none",
                    }}
                  >{time}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 10, color: C.fgMuted }}>
                <span>● Disponível</span>
                <span style={{ color: C.faded }}>● Ocupado</span>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div>
              <button onClick={() => setStep("time")} style={{ background: "none", border: "none", color: C.goldBright, cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                {Ic.chevL} Voltar
              </button>
              <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Resumo</div>
                {[["Serviço", selSvc.name + " · " + fmtMoney(selSvc.price)], ["Barbeiro", selBarber.name], ["Data", fmtShort(selDate)], ["Horário", selTime]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + C.border }}>
                    <span style={{ fontSize: 12, color: C.fgMuted }}>{l}</span>
                    <span style={{ fontSize: 12, color: C.fg, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Seu nome completo"
                  style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid " + C.border, background: C.card, color: C.fg, fontSize: 13, outline: "none" }} />
                <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Seu WhatsApp (opcional)"
                  style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid " + C.border, background: C.card, color: C.fg, fontSize: 13, outline: "none" }} />
              </div>
              <button onClick={confirm} disabled={!clientName.trim()} style={{
                width: "100%", padding: 14, borderRadius: 10, border: "none",
                background: clientName.trim() ? C.goldBright : C.faded,
                color: clientName.trim() ? "#1A1A1A" : C.muted,
                fontSize: 14, fontWeight: 700,
                cursor: clientName.trim() ? "pointer" : "not-allowed",
              }}>Confirmar agendamento</button>
            </div>
          )}

          {step === "done" && confirmed && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: C.greenDim, border: "2px solid " + C.green,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 30, color: C.green, margin: "0 auto 18px",
              }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.fg, marginBottom: 8, fontFamily: "Georgia, serif" }}>
                Agendamento confirmado!
              </div>
              <div style={{ fontSize: 13, color: C.fgMuted, marginBottom: 20, lineHeight: 1.6 }}>
                {confirmed.client}<br />
                {confirmed.service.name} · {confirmed.barber.name}<br />
                <b style={{ color: C.goldBright }}>{fmtShort(confirmed.date)} às {confirmed.time}</b>
              </div>
              <button onClick={reset} style={{
                padding: "10px 24px", borderRadius: 10,
                border: "1px solid " + C.border, background: "transparent",
                color: C.goldBright, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Fazer outro agendamento</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC BOOKING — página pública (sem auth) acessada via /agendar/{slug}
// • Carrega shop + serviços + barbeiros do Supabase a partir do slug
// • Salva nome+telefone do cliente em localStorage (não pede de novo)
// ═══════════════════════════════════════════════════════════════════════════
function slugify(s) {
  return (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function PublicBooking({ slug }) {
  const [loading, setLoading]   = useState(true);
  const [shop, setShop]         = useState(null);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers]   = useState([]);
  const [appts, setAppts]       = useState([]);
  const [errMsg, setErrMsg]     = useState("");

  const [step, setStep]         = useState("service");
  const [selSvc, setSelSvc]     = useState(null);
  const [selBarber, setSelBarber] = useState(null);
  const [selDate, setSelDate]   = useState(TODAY_DS);
  const [selTime, setSelTime]   = useState(null);
  const [clientName, setClientName]   = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [confirmed, setConfirmed]     = useState(null);
  const [submitting, setSubmitting]   = useState(false);

  // Bloqueio de agendamento duplo: se cliente já tem agendamento ativo no futuro,
  // mostra apenas as informações dele (não permite novo agendamento até a data do corte)
  const [existingBooking, setExistingBooking]   = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Cliente recorrente: tenta recuperar dados salvos para este shop
  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem("fadein:client:" + slug);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.name)  setClientName(saved.name);
        if (saved.phone) setClientPhone(saved.phone);
      }
    } catch (e) { /* ignora */ }
  }, [slug]);

  // Carrega shop por slug
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErrMsg("");
      try {
        const BARBER_PALETTE = ["#E0B445", "#5A9BE2", "#5BAF6F", "#E27E5A", "#9B6FD4", "#D45A8A"];

        // 1) Busca shop por slug (ou por nome convertido em slug — fallback)
        let shopData = null;
        const { data: byCol } = await supabase.from("shops").select("*").eq("slug", slug).maybeSingle();
        if (byCol) shopData = byCol;
        if (!shopData) {
          // Fallback: lista shops e compara slugify(name)
          const { data: all } = await supabase.from("shops").select("*").limit(500);
          shopData = (all || []).find(s => slugify(s.name) === slug) || null;
        }
        if (cancelled) return;
        if (!shopData) { setErrMsg("Página de agendamento não encontrada."); setLoading(false); return; }

        setShop({
          id: shopData.id,
          name: shopData.name,
          address: shopData.address || "",
          openTime:  shopData.open_time  || "08:00",
          closeTime: shopData.close_time || "20:00",
          workDays:  Array.isArray(shopData.work_days) ? shopData.work_days : [1, 2, 3, 4, 5, 6],
          // Horário customizado por dia (opcional). Se existir, tem prioridade sobre openTime/closeTime.
          dayHours:  shopData.day_hours && typeof shopData.day_hours === "object" ? shopData.day_hours : null,
          trialEndsAt:        shopData.trial_ends_at || null,
          subscriptionStatus: shopData.subscription_status || "trial",
        });

        // 2) Carrega serviços ativos
        const { data: svcs } = await supabase.from("services")
          .select("*").eq("shop_id", shopData.id).eq("active", true).order("name");
        const mappedSvcs = (svcs || []).map(r => ({
          id: r.id, name: r.name,
          price: parseFloat(r.price) || 0,
          duration: parseInt(r.duration) || 30,
        }));

        // 3) Carrega barbeiros ativos
        const { data: brbs } = await supabase.from("barbers")
          .select("*").eq("shop_id", shopData.id).eq("active", true).order("created_at");
        const mappedBrbs = (brbs || []).map((b, i) => ({
          ...b,
          avatar: (b.name || "?").charAt(0).toUpperCase(),
          color: BARBER_PALETTE[i % BARBER_PALETTE.length],
        }));

        // 4) Carrega agendamentos próximos para calcular slots ocupados
        const today = new Date();
        const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const to   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 31).toISOString();
        const { data: apts } = await supabase.from("appointments")
          .select("*").eq("shop_id", shopData.id).gte("date", from).lte("date", to);
        const mappedApts = (apts || []).map(r => {
          const dt = new Date(r.date);
          let svc = null;
          try { svc = r.service_data ? (typeof r.service_data === "string" ? JSON.parse(r.service_data) : r.service_data) : null; }
          catch (e) { svc = null; }
          if (!svc) svc = { id: 0, name: r.service || "Serviço", price: parseFloat(r.price) || 0, duration: 30 };
          return {
            id: r.id,
            date: dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()),
            time: r.time || (pad(dt.getHours()) + ":" + pad(dt.getMinutes())),
            service: svc,
            barber: { id: r.barber_id },
            status: r.status || "pending",
          };
        });

        if (cancelled) return;
        setServices(mappedSvcs);
        setBarbers(mappedBrbs);
        setAppts(mappedApts);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setErrMsg("Não foi possível carregar a página. Tente novamente em instantes."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const bookDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 30; i++) {
      const ds  = toDS(addDays(BASE_DATE, i));
      const dow = parseDS(ds).getDay();
      if (getDayHours(shop, dow).enabled) arr.push(ds);
    }
    return arr;
  }, [shop]);

  // Slots de horário do dia selecionado (respeita o open/close DAQUELE dia da semana)
  const dayHours = useMemo(() => {
    if (!shop) return [];
    const dow = parseDS(selDate).getDay();
    return getDayHourSlots(shop, dow);
  }, [shop, selDate]);

  // Verifica se o cliente já tem agendamento ativo no futuro (impede agendamentos duplos).
  // Roda depois do shop+barbers carregarem; libera novo agendamento só após a data do corte
  // ou se o agendamento foi cancelado.
  useEffect(() => {
    if (!slug || !shop?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem("fadein:client:" + slug);
        if (!raw) { if (!cancelled) setCheckingExisting(false); return; }
        const saved = JSON.parse(raw);
        if (!saved?.booking?.id) { if (!cancelled) setCheckingExisting(false); return; }

        // Confirma no DB que o agendamento ainda existe e está ativo
        const { data: appt } = await supabase.from("appointments")
          .select("id, status, date, time, client_name, service, service_data, price, barber_id")
          .eq("id", saved.booking.id).maybeSingle();

        if (cancelled) return;

        // Cancelado, deletado ou inexistente → libera novo agendamento
        if (!appt || appt.status === "cancelled") {
          const { booking: _drop, ...rest } = saved;
          localStorage.setItem("fadein:client:" + slug, JSON.stringify(rest));
          setCheckingExisting(false);
          return;
        }

        // Data do corte já passou → libera novo agendamento
        const dt = new Date(appt.date);
        const dateStr = dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
        if (dateStr < TODAY_DS) {
          const { booking: _drop, ...rest } = saved;
          localStorage.setItem("fadein:client:" + slug, JSON.stringify(rest));
          setCheckingExisting(false);
          return;
        }

        // Agendamento ativo no futuro: bloqueia novo agendamento, mostra info
        let svc = null;
        try {
          svc = appt.service_data
            ? (typeof appt.service_data === "string" ? JSON.parse(appt.service_data) : appt.service_data)
            : null;
        } catch (e) { svc = null; }
        if (!svc) svc = {
          name:  appt.service || saved.booking.serviceName || "Serviço",
          price: parseFloat(appt.price) || saved.booking.servicePrice || 0,
        };

        const barber = barbers.find(b => b.id === appt.barber_id) || {
          id: appt.barber_id,
          name:   saved.booking.barberName   || "—",
          color:  saved.booking.barberColor  || "#888",
          avatar: saved.booking.barberAvatar || "?",
        };

        setExistingBooking({
          id: appt.id,
          date: dateStr,
          time: appt.time || saved.booking.time,
          client: appt.client_name || saved.name,
          service: svc,
          barber,
          status: appt.status || "pending",
        });
        setCheckingExisting(false);
      } catch (e) {
        if (!cancelled) setCheckingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, shop?.id, barbers]);

  const allSlotsInfo = useMemo(() => {
    if (!selBarber || !selSvc) return [];
    const busy = appts
      .filter(a => a.date === selDate && a.barber.id === selBarber.id && a.status !== "cancelled")
      .map(a => {
        const [h, m] = a.time.split(":").map(Number);
        const s = h * 60 + m;
        return { s, e: s + (a.service?.duration || 30) };
      });
    return dayHours.map(slot => {
      const [h, m] = slot.split(":").map(Number);
      const s = h * 60 + m, e = s + selSvc.duration;
      return { time: slot, available: !busy.some(b => s < b.e && e > b.s) };
    });
  }, [selDate, selBarber, selSvc, appts, dayHours]);

  function reset() {
    setStep("service"); setSelSvc(null); setSelBarber(null);
    setSelTime(null); setConfirmed(null);
    // mantém nome/telefone — cliente recorrente
  }

  async function confirm() {
    if (!clientName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const [Y, M, D] = selDate.split("-").map(Number);
      const [hh, mm]  = selTime.split(":").map(Number);
      const dt = new Date(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0);
      const row = {
        shop_id:      shop.id,
        barber_id:    selBarber.id,
        client_name:  clientName.trim(),
        client_phone: clientPhone.trim() || null,
        service:      selSvc.name,
        service_data: selSvc,
        price:        selSvc.price,
        status:       "pending",
        date:         dt.toISOString(),
        time:         selTime,
        paid:         false,
        notes:        "Veio pelo link de agendamento",
      };
      const { data: created, error } = await supabase.from("appointments").insert(row).select().maybeSingle();
      if (error) throw error;

      // Upsert cliente: incrementa visits ou cria
      try {
        const { data: existing } = await supabase.from("clients")
          .select("*").eq("shop_id", shop.id).eq("phone", clientPhone.trim() || "").maybeSingle();
        if (existing) {
          await supabase.from("clients").update({
            name: clientName.trim(),
            last_visit: selDate,
            visits: (existing.visits || 0) + 1,
            fav_barber: selBarber.id,
          }).eq("id", existing.id);
        } else {
          await supabase.from("clients").insert({
            shop_id: shop.id,
            name: clientName.trim(),
            phone: clientPhone.trim() || "",
            last_visit: selDate,
            visits: 1,
            fav_barber: selBarber.id,
            notes: "Veio pelo link de agendamento",
          });
        }
      } catch (e) { /* não bloqueia o agendamento */ }

      // Salva pra próxima vez (não vai pedir os dados de novo) + bloqueia novo agendamento
      // até a data do corte ou cancelamento (impede agendamentos duplos)
      try {
        localStorage.setItem("fadein:client:" + slug, JSON.stringify({
          name: clientName.trim(),
          phone: clientPhone.trim(),
          lastBooking: selDate,
          booking: {
            id:           created?.id,
            date:         selDate,
            time:         selTime,
            serviceName:  selSvc.name,
            servicePrice: selSvc.price,
            barberName:   selBarber.name,
            barberColor:  selBarber.color,
            barberAvatar: selBarber.avatar,
          },
        }));
      } catch (e) { /* ignora quota */ }

      const newBooking = {
        id: created?.id,
        date: selDate, time: selTime,
        client: clientName.trim(),
        service: selSvc, barber: selBarber,
        status: "pending",
      };
      setConfirmed(newBooking);
      // Ativa a tela de "já tem agendamento" — substitui o fluxo de booking
      // até a data do corte ou cancelamento
      setExistingBooking(newBooking);
      setStep("done");
    } catch (e) {
      alert("Não foi possível confirmar o agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (errMsg) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <Logo scale={1.1} />
        <p style={{ color: C.red, fontSize: 14, marginTop: 24, fontWeight: 600 }}>{errMsg}</p>
        <p style={{ color: C.fgMuted, fontSize: 12, marginTop: 8 }}>Verifique se o link está correto.</p>
      </div>
    </div>
  );

  if (loading || checkingExisting) return <LoadingScreen message="Carregando agendamento" />;

  // Trial da barbearia expirou (ou cancelaram) — não pode receber novos agendamentos
  if (isShopBlocked(shop)) return <ShopUnavailable shopName={shop?.name} />;

  // ─── Tela "já tem agendamento" ───────────────────────────────────────────
  // Mostra apenas as informações do agendamento existente. Cliente só pode
  // fazer um novo após a data do corte (ou se a barbearia cancelar).
  if (existingBooking) {
    const justBooked = step === "done"; // acabou de agendar agora
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px 40px", color: C.fg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <Logo scale={1.05} />
          </div>

          <div style={{ background: C.bgSunken, border: "1px solid " + C.border, borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "18px 20px", background: "linear-gradient(135deg, " + C.card + " 0%, " + C.card2 + " 100%)", borderBottom: "1px solid " + C.border }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.fg, fontFamily: "Georgia, serif" }}>{shop.name}</div>
              {shop.address && <div style={{ fontSize: 12, color: C.fgMuted, marginTop: 4 }}>{shop.address}</div>}
            </div>

            <div style={{ padding: "28px 22px 24px" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: C.greenDim, border: "2px solid " + C.green,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 30, color: C.green, margin: "0 auto 18px",
              }}>✓</div>

              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: C.fg, marginBottom: 6, fontFamily: "Georgia, serif" }}>
                  {justBooked ? "Agendamento confirmado!" : "Você já tem um agendamento"}
                </div>
                <p style={{ fontSize: 12, color: C.fgMuted, margin: 0, lineHeight: 1.55 }}>
                  {justBooked
                    ? "Seu horário foi reservado. Te esperamos!"
                    : "Aguarde até a data do seu corte para fazer um novo agendamento."}
                </p>
              </div>

              {/* Card com os detalhes */}
              <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid " + C.border }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: existingBooking.barber.color + "30", color: existingBooking.barber.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 17, fontWeight: 700, flexShrink: 0,
                  }}>{existingBooking.barber.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{existingBooking.client}</div>
                    <div style={{ fontSize: 12, color: C.fgMuted }}>{existingBooking.barber.name}</div>
                  </div>
                  <StatusPill status={existingBooking.status} />
                </div>

                {[
                  ["Serviço", existingBooking.service.name + (existingBooking.service.price ? " · " + fmtMoney(existingBooking.service.price) : "")],
                  ["Data",    fmtFull(existingBooking.date)],
                  ["Horário", existingBooking.time],
                ].map(([l, v], i, arr) => (
                  <div key={l} style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    padding: "8px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid " + C.border : "none",
                  }}>
                    <span style={{ fontSize: 12, color: C.fgMuted, flexShrink: 0 }}>{l}</span>
                    <span style={{
                      fontSize: 12, color: l === "Horário" ? C.goldBright : C.fg, fontWeight: 600,
                      textTransform: l === "Data" ? "capitalize" : "none",
                      textAlign: "right",
                    }}>{v}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: C.muted, marginTop: 18, lineHeight: 1.55, textAlign: "center" }}>
                Precisa cancelar ou remarcar?<br />Entre em contato direto com a barbearia.
              </p>
            </div>
          </div>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: C.muted }}>
            Powered by <span style={{ color: C.goldBright, fontWeight: 600 }}>Fadein</span>
          </p>
        </div>
      </div>
    );
  }

  const STEPS = ["service","barber","time","confirm"];
  const isReturning = !!clientName && step === "confirm";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px 40px", color: C.fg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <Logo scale={1.05} />
        </div>

        <div style={{ background: C.bgSunken, border: "1px solid " + C.border, borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}>
          {/* Shop header */}
          <div style={{ padding: "18px 20px", background: "linear-gradient(135deg, " + C.card + " 0%, " + C.card2 + " 100%)", borderBottom: "1px solid " + C.border }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.fg, fontFamily: "Georgia, serif" }}>{shop.name}</div>
            {shop.address && <div style={{ fontSize: 12, color: C.fgMuted, marginTop: 4 }}>{shop.address}</div>}
          </div>

          <div style={{ padding: 20 }}>
            {/* Stepper */}
            {step !== "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}>
                {STEPS.map((s, i) => {
                  const labels = ["Serviço","Barbeiro","Horário","Confirmar"];
                  const curIdx = STEPS.indexOf(step);
                  const done   = curIdx > i;
                  const active = curIdx === i;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                          background: active ? C.goldBright : done ? C.goldDim : C.bgSunken,
                          color: active ? "#1A1A1A" : done ? C.goldBright : C.muted,
                          border: "1px solid " + (active ? C.goldBright : done ? C.goldBright + "40" : C.border),
                        }}>{done ? "✓" : i + 1}</div>
                        <span style={{ fontSize: 9, color: active ? C.goldBright : C.fgMuted, fontWeight: 500 }}>{labels[i]}</span>
                      </div>
                      {i < STEPS.length - 1 && <div style={{ height: 1, width: 12, background: done ? C.goldBright + "40" : C.border, marginBottom: 14 }} />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mensagem de boas-vindas pra cliente recorrente */}
            {clientName && step === "service" && (
              <div style={{
                background: C.goldDim, border: "1px solid " + C.goldBright + "30",
                borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                fontSize: 12, color: C.goldBright, lineHeight: 1.5,
              }}>
                Olá, <b>{clientName.split(" ")[0]}</b>! Bom te ver de novo.
              </div>
            )}

            {step === "service" && (
              <div>
                <p style={{ fontSize: 13, color: C.fgMuted, margin: "0 0 12px" }}>Escolha o serviço:</p>
                {services.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 20 }}>Nenhum serviço cadastrado ainda.</p>
                ) : services.map(s => (
                  <button key={s.id} onClick={() => { setSelSvc(s); setStep("barber"); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "13px 14px", background: C.card, border: "1px solid " + C.border,
                      borderRadius: 10, marginBottom: 6, cursor: "pointer", color: C.fg, textAlign: "left",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: C.fgMuted }}>{s.duration} minutos</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.goldBright, fontFamily: "Georgia, serif" }}>{fmtMoney(s.price)}</div>
                  </button>
                ))}
              </div>
            )}

            {step === "barber" && (
              <div>
                <button onClick={() => setStep("service")} style={{ background: "none", border: "none", color: C.goldBright, cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {Ic.chevL} Voltar
                </button>
                <p style={{ fontSize: 13, color: C.fgMuted, margin: "0 0 12px" }}>Escolha o barbeiro:</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10 }}>
                  {barbers.map(b => (
                    <button key={b.id} onClick={() => { setSelBarber(b); setSelTime(null); setStep("time"); }}
                      style={{
                        padding: "14px 8px", background: C.card,
                        border: "1px solid " + C.border, borderRadius: 10,
                        cursor: "pointer", textAlign: "center",
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: b.color + "30", color: b.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 700, margin: "0 auto 8px",
                      }}>{b.avatar}</div>
                      <div style={{ fontSize: 13, color: C.fg, fontWeight: 600 }}>{b.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === "time" && (
              <div>
                <button onClick={() => setStep("barber")} style={{ background: "none", border: "none", color: C.goldBright, cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {Ic.chevL} Voltar
                </button>
                <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
                  {bookDates.slice(0, 14).map(ds => (
                    <button key={ds} onClick={() => { setSelDate(ds); setSelTime(null); }} style={{
                      minWidth: 50, flexShrink: 0, padding: "8px 4px", borderRadius: 8,
                      border: "1px solid " + (selDate === ds ? C.goldBright : C.border),
                      background: selDate === ds ? C.goldDim : C.card,
                      cursor: "pointer", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 9, color: selDate === ds ? C.goldBright : C.fgMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{fmtWeekday(ds)}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: selDate === ds ? C.goldBright : C.fg, marginTop: 2 }}>{parseDS(ds).getDate()}</div>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: C.fgMuted, margin: "0 0 10px" }}>
                  <b style={{ color: C.fg }}>{selBarber.name}</b> · {fmtShort(selDate)}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {allSlotsInfo.map(({ time, available }) => (
                    <button key={time} disabled={!available}
                      onClick={() => { setSelTime(time); setStep("confirm"); }}
                      style={{
                        padding: "9px 4px", borderRadius: 8,
                        border: "1px solid " + (available ? C.border : C.bgSunken),
                        background: available ? C.card : C.bgSunken,
                        color: available ? C.fg : C.faded,
                        fontSize: 12, fontWeight: 500,
                        cursor: available ? "pointer" : "not-allowed",
                        textDecoration: !available ? "line-through" : "none",
                      }}
                    >{time}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 10, color: C.fgMuted }}>
                  <span>● Disponível</span>
                  <span style={{ color: C.faded }}>● Ocupado</span>
                </div>
              </div>
            )}

            {step === "confirm" && (
              <div>
                <button onClick={() => setStep("time")} style={{ background: "none", border: "none", color: C.goldBright, cursor: "pointer", fontSize: 12, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {Ic.chevL} Voltar
                </button>
                <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Resumo</div>
                  {[["Serviço", selSvc.name + " · " + fmtMoney(selSvc.price)], ["Barbeiro", selBarber.name], ["Data", fmtShort(selDate)], ["Horário", selTime]].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + C.border }}>
                      <span style={{ fontSize: 12, color: C.fgMuted }}>{l}</span>
                      <span style={{ fontSize: 12, color: C.fg, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                {isReturning && (
                  <div style={{
                    background: C.greenDim, border: "1px solid " + C.green + "30",
                    borderRadius: 10, padding: "10px 12px", marginBottom: 12,
                    fontSize: 11, color: C.green, lineHeight: 1.5,
                  }}>
                    ✓ Dados preenchidos automaticamente
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Seu nome completo"
                    style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid " + C.border, background: C.card, color: C.fg, fontSize: 14, outline: "none" }} />
                  <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Seu WhatsApp (recomendado)"
                    style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid " + C.border, background: C.card, color: C.fg, fontSize: 14, outline: "none" }} />
                </div>
                <button onClick={confirm} disabled={!clientName.trim() || submitting} style={{
                  width: "100%", padding: 14, borderRadius: 10, border: "none",
                  background: clientName.trim() && !submitting ? C.goldBright : C.faded,
                  color: clientName.trim() && !submitting ? "#1A1A1A" : C.muted,
                  fontSize: 14, fontWeight: 700,
                  cursor: clientName.trim() && !submitting ? "pointer" : "not-allowed",
                }}>{submitting ? "Confirmando…" : "Confirmar agendamento"}</button>
              </div>
            )}

            {step === "done" && confirmed && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: C.greenDim, border: "2px solid " + C.green,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, color: C.green, margin: "0 auto 18px",
                }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.fg, marginBottom: 8, fontFamily: "Georgia, serif" }}>
                  Agendamento confirmado!
                </div>
                <div style={{ fontSize: 13, color: C.fgMuted, marginBottom: 20, lineHeight: 1.6 }}>
                  {confirmed.client}<br />
                  {confirmed.service.name} · {confirmed.barber.name}<br />
                  <b style={{ color: C.goldBright }}>{fmtShort(confirmed.date)} às {confirmed.time}</b>
                </div>
                <button onClick={reset} style={{
                  padding: "10px 24px", borderRadius: 10,
                  border: "1px solid " + C.border, background: "transparent",
                  color: C.goldBright, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Fazer outro agendamento</button>
              </div>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: C.muted }}>
          Powered by <span style={{ color: C.goldBright, fontWeight: 600 }}>Fadein</span>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERRAL CARD — "Indique e ganhe 1 mês grátis"
// ═══════════════════════════════════════════════════════════════════════════
// Cada barbearia vira vendedora: copia o link, manda no zap, e ganha 1 mês
// grátis pra cada barbearia que assinar pela indicação. O indicado ganha 50%
// off no 1º mês. Aqui só renderizamos UI + carregamos contadores; o crédito
// efetivo é processado manualmente no painel admin do Supabase com base na
// coluna `referred_by` da tabela `shops`.
//
// Fluxo:
//   1. Indicador copia o link `https://<host>/?ref=<shop.id>` daqui ou
//      compartilha pelo WhatsApp com mensagem pré-formatada.
//   2. Indicado clica → boot do app captura `?ref=` em localStorage.
//   3. Indicado cria conta → insert de shop grava `referred_by`.
//   4. Admin cruza referred_by + subscription_status pra liberar os meses.
function ReferralCard({ shop }) {
  const [referrals, setReferrals] = useState({ total: 0, active: 0, loading: true, error: false });
  const [copied, setCopied]       = useState(false);

  // URL do link: usa o origin atual (funciona em dev local, fadein.app, app
  // móvel embedado em webview, etc) + o shop.id como código.
  const origin = (typeof window !== "undefined" && window.location.origin)
    ? window.location.origin
    : "https://fadein.app";
  const link = origin + "/?ref=" + shop.id;

  // Mensagem padrão do WhatsApp — escrita em primeira pessoa pra parecer real
  // recomendação, não anúncio. CTA claro no final.
  const waMessage = (
    "Oi! Tô usando o Fadein pra gerenciar minha barbearia (" + (shop.name || "") + ") e tá " +
    "ajudando demais — agenda, link de agendamento online, financeiro, comissões dos barbeiros, " +
    "tudo num lugar só. Se você criar conta pelo meu link, ganha 50% off no primeiro mês: " + link
  );
  const waUrl = "https://wa.me/?text=" + encodeURIComponent(waMessage);

  // Carrega contagem de indicações. Se a coluna `referred_by` ainda não existir
  // no banco (migration não rodada), o erro é capturado e mostramos um estado
  // informativo em vez de derrubar o card inteiro.
  useEffect(() => {
    if (!shop?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // Total: qualquer barbearia que apontou pra esse shop como referrer
        const totalQ = await supabase.from("shops")
          .select("id", { count: "exact", head: true })
          .eq("referred_by", shop.id);
        if (totalQ.error) throw totalQ.error;

        // Convertidas: indicações que viraram assinatura ativa (são essas que
        // dão direito ao mês grátis pro indicador).
        const activeQ = await supabase.from("shops")
          .select("id", { count: "exact", head: true })
          .eq("referred_by", shop.id)
          .eq("subscription_status", "active");
        if (activeQ.error) throw activeQ.error;

        if (!cancelled) {
          setReferrals({
            total: totalQ.count || 0,
            active: activeQ.count || 0,
            loading: false, error: false,
          });
        }
      } catch (e) {
        console.warn("[fadein] referral stats error (coluna referred_by existe no banco?):", e?.message);
        if (!cancelled) setReferrals({ total: 0, active: 0, loading: false, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [shop?.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback pra browsers sem clipboard API: seleciona o input
      const input = document.getElementById("referral-link-input");
      if (input) { input.select(); document.execCommand && document.execCommand("copy"); }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div style={{
      // Mesmo gradiente discreto do plano premium pra dar peso visual ao card
      // sem competir com a CTA de upgrade ali em cima.
      background: "linear-gradient(135deg, " + C.card + " 0%, " + C.card2 + " 100%)",
      border: "1px solid " + C.goldBright + "30", borderRadius: 12, padding: 20,
      position: "relative", overflow: "hidden",
    }}>
      {/* Halo dourado discreto no canto pra dar identidade premium */}
      <div style={{
        position: "absolute", top: -40, right: -40, width: 140, height: 140,
        borderRadius: "50%", background: C.goldFaint, pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative", marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: C.goldDim, color: C.goldBright,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, flexShrink: 0,
        }}>🎁</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.goldBright, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
            Programa de indicação
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: C.fg, margin: 0, fontFamily: "Georgia, serif", letterSpacing: -0.3 }}>
            Indique e ganhe 1 mês grátis
          </h3>
          <p style={{ fontSize: 12, color: C.fgMuted, margin: "6px 0 0", lineHeight: 1.5 }}>
            Pra cada barbearia que assinar pelo seu link, você ganha <b style={{ color: C.fg }}>1 mês grátis</b>.
            E quem entrar ganha <b style={{ color: C.fg }}>50% off no primeiro mês</b>.
          </p>
        </div>
      </div>

      {/* Link copiável */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 10,
        background: C.bgSunken, border: "1px solid " + C.border, borderRadius: 10,
        padding: 4, position: "relative",
      }}>
        <input
          id="referral-link-input"
          readOnly value={link}
          onFocus={e => e.target.select()}
          style={{
            flex: 1, minWidth: 0, padding: "8px 10px",
            background: "transparent", border: "none", outline: "none",
            color: C.fg, fontSize: 12, fontFamily: "ui-monospace, 'SF Mono', monospace",
          }}
        />
        <button onClick={copyLink} title="Copiar link" style={{
          padding: "0 14px", border: "none", borderRadius: 7,
          background: copied ? C.green : C.goldBright,
          color: copied ? "#fff" : "#1A1A1A",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          minWidth: 90, justifyContent: "center",
          transition: "background 0.18s",
        }}>
          {copied ? "✓ Copiado" : "📋 Copiar"}
        </button>
      </div>

      {/* CTA principal: WhatsApp. É de longe o canal mais usado por barbeiros
          pra recomendar coisas, então merece o destaque. */}
      <a
        href={waUrl} target="_blank" rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "12px 16px",
          background: "#25D366", color: "#fff",
          borderRadius: 10, textDecoration: "none",
          fontSize: 14, fontWeight: 700, fontFamily: "inherit",
          transition: "transform 0.1s, filter 0.15s",
        }}
        onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <span style={{ fontSize: 16 }}>📱</span>
        Compartilhar no WhatsApp
      </a>

      {/* Stats: total de cliques que viraram conta + quantos já assinaram */}
      <div style={{
        marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.border,
        display: "flex", gap: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.fg, fontFamily: "Georgia, serif", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {referrals.loading ? "—" : referrals.total}
          </div>
          <div style={{ fontSize: 10, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 }}>
            indica{referrals.total === 1 ? "ção" : "ções"}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green, fontFamily: "Georgia, serif", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {referrals.loading ? "—" : referrals.active}
          </div>
          <div style={{ fontSize: 10, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 }}>
            mês{referrals.active === 1 ? "" : "es"} ganho{referrals.active === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {referrals.error && (
        <div style={{
          marginTop: 12, padding: "8px 10px",
          background: C.amberDim, border: "1px solid " + C.amber + "30",
          borderRadius: 8, fontSize: 11, color: C.amber, lineHeight: 1.4,
        }}>
          ⚠ Não consegui carregar as estatísticas. Verifique se a coluna <code>referred_by</code> existe na tabela <code>shops</code>.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE VIEW — bloqueio premium com call to action
// ═══════════════════════════════════════════════════════════════════════════
function UpgradeView({ feature, plan, navigate, shopId }) {
  const featureLabels = {
    financeiro: { title: "Financeiro completo", desc: "Controle todas as entradas e saídas, receita por método de pagamento, e relatórios mensais." },
    comissoes:  { title: "Comissões automáticas", desc: "Cálculo automático da comissão de cada barbeiro a cada atendimento concluído. Fim das planilhas." },
    barbeiros:  { title: "Mais barbeiros", desc: "Adicione mais profissionais à sua equipe e controle a agenda de cada um separadamente." },
  };
  const info = featureLabels[feature] || { title: "Recurso premium", desc: "" };
  const recommended = feature === "barbeiros" ? "pro" : "pro";
  const planInfo = PLANS[recommended];

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 0" }}>
      <div style={{
        background: "linear-gradient(135deg, " + C.card + " 0%, " + C.card2 + " 100%)",
        border: "1px solid " + C.goldBright + "30", borderRadius: 18,
        padding: "32px 28px", textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: C.goldDim, color: C.goldBright,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", fontSize: 26,
        }}>🔒</div>

        <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          Disponível no plano {planInfo.name}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 10px", color: C.fg, fontFamily: "Georgia, serif", letterSpacing: -0.3 }}>
          {info.title}
        </h1>
        <p style={{ fontSize: 14, color: C.fgMuted, margin: "0 auto 24px", maxWidth: 480, lineHeight: 1.5 }}>{info.desc}</p>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, marginBottom: 24 }}>
          <span style={{ fontSize: 14, color: C.fgMuted }}>R$</span>
          <span style={{ fontSize: 44, fontWeight: 700, color: C.goldBright, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {planInfo.price}
          </span>
          <span style={{ fontSize: 13, color: C.fgMuted }}>/mês</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360, margin: "0 auto 24px", textAlign: "left" }}>
          {[
            "Agenda + link de agendamento online",
            "Financeiro completo com gráficos",
            "Comissões automáticas por barbeiro",
            "Relatórios mensais detalhados",
            "Até 3 barbeiros",
            "Suporte via WhatsApp",
            "Cancele quando quiser",
          ].map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.fg }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%",
                background: C.greenDim, color: C.green,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>✓</span>
              {b}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={() => openCheckout(recommended, shopId)}>Quero fazer upgrade</Btn>
          <Btn v="ghost" onClick={() => navigate("dashboard")}>Voltar ao dashboard</Btn>
        </div>

        <p style={{ fontSize: 11, color: C.muted, marginTop: 18 }}>
          {(() => {
            const planInfo = PLANS[plan] || PLANS.starter;
            return planInfo.trial
              ? <>Você está em <b style={{ color: C.fgMuted }}>período de teste</b></>
              : <>Plano atual: <b style={{ color: C.fgMuted, textTransform: "capitalize" }}>{planInfo.name}</b></>;
          })()}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════════════════
function Clientes({ clients, setClients, appts, navigate, barbers, createClient, updateClient, deleteClient }) {
  const [q, setQ]         = useState("");
  const [sel, setSel]     = useState(null);
  const [modal, setModal] = useState(false);       // novo cliente
  const [editModal, setEditModal] = useState(false); // editar cliente
  const [delModal, setDelModal]   = useState(null); // confirma exclusão
  const [filter, setFilter] = useState("all");
  const [form, setForm]   = useState({ name: "", phone: "", notes: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "", fav: "" });
  const [saving, setSaving] = useState(false);

  const enriched = clients.map(c => {
    const d = diffDays(c.lastVisit);
    return { ...c, daysSince: d, isInactive: d > 30, isVip: c.visits >= 20, isNew: c.visits <= 3 };
  });

  const list = enriched
    .filter(c => filter === "all" || (filter === "vip" ? c.isVip : filter === "inactive" ? c.isInactive : c.isNew))
    .filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  const sc   = enriched.find(c => c.id === sel);
  const scAppts = sc ? appts.filter(a => a.client === sc.name).sort((a, b) => b.date.localeCompare(a.date)) : [];

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    await createClient({
      name: form.name.trim(),
      phone: form.phone || "",
      notes: form.notes || "",
      lastVisit: null,
      visits: 0,
      fav: barbers[0]?.id || null,
    });
    setSaving(false);
    setModal(false); setForm({ name: "", phone: "", notes: "" });
  }

  function openEdit() {
    if (!sc) return;
    setEditForm({
      name: sc.name,
      phone: sc.phone || "",
      notes: sc.notes || "",
      fav: sc.fav || "",
    });
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editForm.name.trim()) return;
    setSaving(true);
    await updateClient(sel, {
      name: editForm.name.trim(),
      phone: editForm.phone || "",
      notes: editForm.notes || "",
      fav: editForm.fav || null,
    });
    setSaving(false);
    setEditModal(false);
  }

  async function confirmDelete() {
    if (!delModal) return;
    setSaving(true);
    await deleteClient(delModal.id);
    setSaving(false);
    setDelModal(null);
    setSel(null);
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: C.fg, fontFamily: "Georgia, serif" }}>Clientes</h1>
        <Btn sm icon={Ic.plus} onClick={() => setModal(true)}>Novo cliente</Btn>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[["all", "Todos", clients.length, C.fg],
          ["vip", "VIP",   enriched.filter(c => c.isVip).length, C.goldBright],
          ["inactive","Inativos", enriched.filter(c => c.isInactive).length, C.red],
          ["new","Novos", enriched.filter(c => c.isNew).length, C.green]].map(([v, l, n, col]) => (
          <div key={v} onClick={() => setFilter(v)}
            style={{
              background: filter === v ? col + "12" : C.card,
              border: "1px solid " + (filter === v ? col + "60" : C.border),
              borderRadius: 10, padding: "12px 14px", cursor: "pointer",
            }}>
            <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: filter === v ? col : C.fg }}>{n}</div>
          </div>
        ))}
      </div>

      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: sc ? "1fr 1fr" : "1fr", gap: 16 }}>
        <div>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }}>{Ic.search}</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou telefone..."
              style={{
                width: "100%", padding: "11px 12px 11px 36px", borderRadius: 10,
                border: "1px solid " + C.border, background: C.card,
                color: C.fg, fontSize: 13, outline: "none", boxSizing: "border-box",
              }} />
          </div>
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden", maxHeight: 540, overflowY: "auto" }}>
            {list.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.fgMuted, fontSize: 13 }}>Nenhum cliente encontrado</div>
            ) : list.map(c => (
              <div key={c.id} onClick={() => setSel(c.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderBottom: "1px solid " + C.border,
                cursor: "pointer", background: sel === c.id ? C.goldDim : "transparent",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: c.isInactive ? C.redDim : C.goldDim,
                  color: c.isInactive ? C.red : C.goldBright,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, flexShrink: 0, fontFamily: "Georgia, serif",
                }}>{c.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>{c.name}</span>
                    {c.isVip && <Badge color={C.goldBright}>VIP</Badge>}
                    {c.isInactive && <Badge color={C.red}>Inativo</Badge>}
                    {c.isNew && <Badge color={C.green}>Novo</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: C.fgMuted, marginTop: 2 }}>
                    {c.visits} visitas · {agoLabel(c.lastVisit)}
                  </div>
                </div>
                <span style={{ color: C.muted }}>{Ic.chevR}</span>
              </div>
            ))}
          </div>
        </div>

        {sc && (
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: C.goldDim, color: C.goldBright,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif",
                }}>{sc.name[0]}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: C.fg }}>{sc.name}</span>
                    {sc.isVip && <Badge color={C.goldBright}>VIP</Badge>}
                  </div>
                  <div style={{ fontSize: 13, color: C.fgMuted, marginTop: 3 }}>{sc.phone}</div>
                </div>
              </div>
              <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22 }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
              {[
                [sc.visits, "Visitas", C.goldBright],
                [agoLabel(sc.lastVisit), "Última visita", C.fg],
                [barbers.find(b => b.id === sc.fav)?.name || "—", "Favorito", C.fg],
              ].map(([v, l, col]) => (
                <div key={l} style={{ background: C.bgSunken, borderRadius: 8, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: col, fontFamily: "Georgia, serif" }}>{v}</div>
                  <div style={{ fontSize: 10, color: C.fgMuted, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Observações</div>
              <div style={{ padding: 12, background: C.bgSunken, borderRadius: 8, fontSize: 13, color: C.fg, lineHeight: 1.6 }}>
                {sc.notes || "Sem observações"}
              </div>
            </div>

            {scAppts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                  Histórico recente · {scAppts.length} atendimentos
                </div>
                <div style={{ background: C.bgSunken, borderRadius: 8, overflow: "hidden", maxHeight: 160, overflowY: "auto" }}>
                  {scAppts.slice(0, 5).map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid " + C.border, fontSize: 12 }}>
                      <span style={{ color: C.goldBright, fontWeight: 700, width: 70 }}>{fmtShort(a.date)}</span>
                      <span style={{ flex: 1, color: C.fg }}>{a.service.name}</span>
                      <span style={{ color: C.fgMuted, fontSize: 11 }}>{a.barber.name}</span>
                      <StatusPill status={a.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn sm v="ghost" icon={Ic.whatsapp}>WhatsApp</Btn>
              <Btn sm v="ghost" icon={Ic.calendar} onClick={() => navigate("agenda")}>Agendar</Btn>
              <Btn sm v="ghost" icon={Ic.edit} onClick={openEdit}>Editar</Btn>
              <Btn sm v="danger" icon={Ic.trash} onClick={() => setDelModal(sc)}>Excluir</Btn>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <Modal title="Novo cliente" onClose={() => setModal(false)}>
          <Inp label="Nome completo" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: João Silva" />
          <Inp label="Telefone / WhatsApp" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(51) 99999-0000" />
          <Inp label="Observações" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Tipo de corte, alergias, preferências..." />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={add} disabled={saving} full>{saving ? "Salvando..." : "Salvar cliente"}</Btn>
            <Btn v="ghost" onClick={() => setModal(false)} disabled={saving}>Cancelar</Btn>
          </div>
        </Modal>
      )}

      {editModal && (
        <Modal title="Editar cliente" onClose={() => setEditModal(false)}>
          <Inp label="Nome completo" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: João Silva" />
          <Inp label="Telefone / WhatsApp" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} placeholder="(51) 99999-0000" />
          <Sel label="Barbeiro favorito" value={editForm.fav}
            onChange={e => setEditForm(p => ({ ...p, fav: e.target.value }))}
            options={[{ v: "", l: "— nenhum —" }, ...barbers.map(b => ({ v: b.id, l: b.name }))]} />
          <Inp label="Observações" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Tipo de corte, alergias, preferências..." />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={saveEdit} disabled={saving} full>{saving ? "Salvando..." : "Salvar alterações"}</Btn>
            <Btn v="ghost" onClick={() => setEditModal(false)} disabled={saving}>Cancelar</Btn>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!delModal}
        title="Excluir cliente?"
        message={delModal ? `Tem certeza que deseja excluir "${delModal.name}"? Esta ação não pode ser desfeita. O histórico de agendamentos será preservado.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDelModal(null)}
        danger
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMISSÕES — quem ganhou o quê, sem briga
// ═══════════════════════════════════════════════════════════════════════════
function Comissoes({ txns, appts, services, setServices, barbers }) {
  const [period, setPeriod]   = useState("month");
  const [selBarber, setSelBarber] = useState(0); // 0 = todos
  const [editComm, setEditComm] = useState(null); // {barberId, value}

  const startDs = period === "today" ? TODAY_DS
                : period === "week"  ? toDS(addDays(BASE_DATE, -7))
                : toDS(addDays(BASE_DATE, -30));

  // Pega só transações de entrada vinculadas a barbeiro
  const commTxns = useMemo(() =>
    txns.filter(t => t.date >= startDs && !t.out && t.barberId)
  , [txns, startDs]);

  // Stats por barbeiro
  const barberData = barbers.map(b => {
    const myTxns = commTxns.filter(t => t.barberId === b.id);
    const totalRev = myTxns.reduce((s, t) => s + t.amount, 0);
    const totalComm = myTxns.reduce((s, t) => s + (t.commissionAmount || (t.amount * b.commission / 100)), 0);
    const count = myTxns.length;
    const ticket = count > 0 ? totalRev / count : 0;
    return { barber: b, totalRev, totalComm, count, ticket, txns: myTxns };
  });

  const totalAll     = barberData.reduce((s, d) => s + d.totalRev, 0);
  const totalCommAll = barberData.reduce((s, d) => s + d.totalComm, 0);

  const filtered = selBarber === 0 ? barberData : barberData.filter(d => d.barber.id === selBarber);

  // Editar comissão
  function saveCommission() {
    if (!editComm) return;
    const v = parseInt(editComm.value);
    if (isNaN(v) || v < 0 || v > 100) return;
    // services não tem commission — vai no BARBERS, mas BARBERS é const
    // workaround: avisa ao usuário que precisa editar em Config
    // Por ora, vamos guardar em um state separado se precisarmos
    setEditComm(null);
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", color: C.fg, fontFamily: "Georgia, serif" }}>Comissões</h1>
          <p style={{ fontSize: 13, color: C.fgMuted, margin: 0 }}>Cálculo automático por atendimento concluído</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.bgSunken, padding: 3, borderRadius: 9 }}>
          {[["today","Hoje"],["week","7 dias"],["month","30 dias"]].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none",
              background: period === v ? C.card : "transparent",
              color: period === v ? C.goldBright : C.fgMuted,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* KPIs gerais */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="Faturamento total"  value={fmtMoney(totalAll)} />
        <KPI label="A pagar p/ barbeiros" value={fmtMoney(totalCommAll)} note="comissões totais" />
        <KPI label="Lucro da casa"      value={fmtMoney(totalAll - totalCommAll)} note={totalAll > 0 ? Math.round((1 - totalCommAll/totalAll) * 100) + "% do total" : ""} up={true} />
        <KPI label="Atendimentos"       value={String(commTxns.length)} note="no período" />
      </div>

      {/* Filtro por barbeiro */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setSelBarber(0)} style={{
          padding: "6px 14px", borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: "pointer",
          border: "1px solid " + (selBarber === 0 ? C.fg : C.border),
          background: selBarber === 0 ? C.fg : "transparent",
          color: selBarber === 0 ? C.bg : C.fgMuted,
        }}>Todos</button>
        {barbers.map(b => (
          <button key={b.id} onClick={() => setSelBarber(b.id)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "1px solid " + (selBarber === b.id ? b.color : C.border),
            background: selBarber === b.id ? b.color + "20" : "transparent",
            color: selBarber === b.id ? b.color : C.fgMuted,
          }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: b.color + "40", color: b.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{b.avatar}</div>
            {b.name}
          </button>
        ))}
      </div>

      {/* Cards por barbeiro */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
        {filtered.map(({ barber: b, totalRev, totalComm, count, ticket, txns: myTxns }) => (
          <div key={b.id} style={{
            background: C.card, border: "1px solid " + C.border,
            borderRadius: 14, overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid " + C.border,
              display: "flex", alignItems: "center", gap: 12,
              background: b.color + "10",
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: b.color + "30", color: b.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
              }}>{b.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.fg }}>{b.name}</div>
                <div style={{ fontSize: 11, color: C.fgMuted }}>Comissão: <b style={{ color: b.color }}>{b.commission}%</b></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: C.fgMuted }}>A pagar</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: "Georgia, serif" }}>{fmtMoney(totalComm)}</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid " + C.border, display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Atendimentos</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.fg }}>{count}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Faturado</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.fg }}>{fmtMoney(totalRev)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.fgMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Ticket méd.</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.fg }}>{fmtMoney(ticket)}</div>
              </div>
            </div>

            {/* Lista de atendimentos do barbeiro */}
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {myTxns.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: C.fgMuted, fontSize: 12 }}>
                  Nenhum atendimento neste período
                </div>
              ) : myTxns.slice(0, 20).map(t => (
                <div key={t.id} style={{
                  padding: "10px 20px", borderBottom: "1px solid " + C.border,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.fg, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.desc}
                    </div>
                    <div style={{ fontSize: 10, color: C.fgMuted }}>
                      {fmtShort(t.date)} · {t.method}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: C.fg }}>{fmtMoney(t.amount)}</div>
                    <div style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>
                      +{fmtMoney(t.commissionAmount || (t.amount * b.commission / 100))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão exportar */}
            <div style={{ padding: 12, borderTop: "1px solid " + C.border, background: C.bgSunken }}>
              <Btn sm v="ghost" full
                onClick={() => {
                  const csv = "Data,Cliente/Serviço,Valor,Forma,Comissão\n" +
                    myTxns.map(t => [t.date, t.desc, t.amount, t.method, t.commissionAmount || (t.amount * b.commission / 100)].join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "comissoes-" + b.name + "-" + period + ".csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >📄 Exportar CSV</Btn>
            </div>
          </div>
        ))}
      </div>

      {/* Aviso */}
      <div style={{
        padding: "12px 16px", background: C.goldDim, border: "1px solid " + C.gold + "40",
        borderRadius: 10, fontSize: 12, color: C.fgMuted, lineHeight: 1.6,
      }}>
        <b style={{ color: C.goldBright }}>Como funciona:</b> Toda vez que um atendimento é marcado como "Recebido" na agenda, o valor cai no Financeiro e a comissão é calculada automaticamente com base no percentual de cada barbeiro. Sem planilha, sem briga.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// PWA INSTALL BANNER
// ═══════════════════════════════════════════════════════════════════════════
// Banner discreto que aparece no topo do app convidando o usuário a instalar
// o PWA. Comportamento por plataforma:
//
// - Android Chrome/Edge: usamos o evento `beforeinstallprompt` (que o navegador
//   dispara quando o site é instalável). Guardamos o evento e disparamos quando
//   o usuário clica "Instalar". Resultado: prompt nativo do Chrome.
//
// - iOS Safari: NÃO existe API de instalação programática. Mostramos um modal
//   com o passo-a-passo (Compartilhar → "Adicionar à Tela de Início").
//
// O banner some quando: o usuário fecha (lembramos via localStorage por 7 dias),
// o app já está instalado (rodando em modo standalone), ou o usuário instala.

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true // iOS Safari legacy
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

const INSTALL_DISMISS_KEY = "fadein:install-dismissed-at";
const DISMISS_DAYS = 7;

function InstallBanner() {
  const [deferred, setDeferred]   = useState(null); // evento beforeinstallprompt salvo
  const [showIOS, setShowIOS]     = useState(false); // modal de instruções iOS
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // já instalado

    // Já dispensou recentemente?
    try {
      const dismissedAt = localStorage.getItem(INSTALL_DISMISS_KEY);
      if (dismissedAt) {
        const ageDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
        if (ageDays < DISMISS_DAYS) return;
      }
    } catch (e) { /* ignora */ }

    // Android: aguarda evento beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: não dispara o evento, mas é instalável via Safari → mostramos banner manual
    if (isIOS()) {
      // pequeno delay pra não competir com o login/loading inicial
      const t = setTimeout(() => setVisible(true), 2500);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler); };
    }

    // Quando instala, esconde o banner
    const onInstalled = () => { setVisible(false); setDeferred(null); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    setShowIOS(false);
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  async function install() {
    if (isIOS()) {
      setShowIOS(true);
      return;
    }
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setVisible(false);
    else dismiss(); // tratou o "agora não" como dismissal
  }

  if (!visible) return null;

  return (
    <>
      <div style={{
        background: C.goldDim, border: "1px solid " + C.goldBright + "30", borderRadius: 10,
        padding: "10px 14px", marginBottom: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 12.5, color: C.fg, fontWeight: 500, lineHeight: 1.4, flex: 1, minWidth: 200 }}>
          📱 <b>Instale o Fadein no seu celular</b>
          <span style={{ color: C.fgMuted, fontWeight: 400, marginLeft: 6 }}>
            Acesso rápido, abre como app, funciona offline.
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={install} style={{
            background: C.goldBright, color: "#1A1A1A", border: "none",
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Instalar
          </button>
          <button onClick={dismiss} title="Dispensar" style={{
            background: "transparent", color: C.fgMuted, border: "1px solid " + C.border,
            padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Agora não
          </button>
        </div>
      </div>

      {/* Modal iOS: instruções passo-a-passo */}
      {showIOS && (
        <div className="modal-overlay" onClick={dismiss} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 200,
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            background: C.card, border: "1px solid " + C.border, borderRadius: 14,
            padding: 24, maxWidth: 380, width: "100%",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px", color: C.fg, fontFamily: "Georgia, serif" }}>
              Instalar no iPhone
            </h3>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.fg, lineHeight: 1.85 }}>
              <li>Toque em <b>Compartilhar</b> <span style={{ color: C.fgMuted }}>(ícone de quadrado com seta)</span> na barra inferior do Safari</li>
              <li>Role e toque em <b>Adicionar à Tela de Início</b></li>
              <li>Toque em <b>Adicionar</b> no canto superior direito</li>
            </ol>
            <p style={{ fontSize: 12, color: C.fgMuted, margin: "16px 0 18px", lineHeight: 1.5 }}>
              Pronto — o Fadein vai aparecer como um app na sua tela inicial.
            </p>
            <button onClick={dismiss} style={{
              width: "100%", background: C.goldBright, color: "#1A1A1A", border: "none",
              padding: "11px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}


// Calcula quantos dias inteiros faltam até a data dada. Retorna 0 se já passou.
function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const ms = new Date(dateStr).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Determina se o shop está bloqueado (trial expirou e não virou pagante).
// Usado pra: travar o app inteiro e exibir tela de upgrade; e
// bloquear a página pública de agendamento (cliente final não consegue marcar).
function isShopBlocked(shop) {
  if (!shop) return false;
  const status = shop.subscriptionStatus || "trial";
  if (status === "active") return false;            // pagante
  if (status === "expired" || status === "cancelled") return true;
  if (status === "trial") return daysUntil(shop.trialEndsAt) === 0;
  return false;
}

// Banner que aparece no topo do app quando faltam ≤ 7 dias de trial.
// Não bloqueia nada — só lembra com tom amigável crescente conforme se aproxima do fim.
function TrialBanner({ shop }) {
  if (!shop || shop.subscriptionStatus !== "trial") return null;
  const days = daysUntil(shop.trialEndsAt);
  if (days > 7) return null;

  const urgent = days <= 2;
  const bg     = urgent ? C.redDim   : C.amberDim;
  const fg     = urgent ? C.red      : C.amber;
  const border = urgent ? C.red+"40" : C.amber+"40";

  const label = days === 0 ? "Seu trial termina hoje"
              : days === 1 ? "Seu trial termina amanhã"
              : "Faltam " + days + " dias do seu trial";

  return (
    <div style={{
      background: bg, border: "1px solid " + border, borderRadius: 10,
      padding: "10px 14px", marginBottom: 16,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ fontSize: 13, color: fg, fontWeight: 600, lineHeight: 1.4 }}>
        ⚠ {label}.{" "}
        <span style={{ fontWeight: 500, color: fg, opacity: 0.85 }}>
          Assine pra continuar usando sem interrupção.
        </span>
      </div>
      <button onClick={() => openCheckout("pro", shop?.id)} style={{
        background: fg, color: "#1A1A1A", border: "none",
        padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      }}>
        Assinar agora
      </button>
    </div>
  );
}

// Tela cheia que substitui o app quando trial expirou (ou assinatura cancelada).
// Único caminho daqui é assinar — abre direto o checkout do Asaas.
function TrialExpired({ shop, onLogout }) {
  const isExpired   = shop?.subscriptionStatus === "expired" || daysUntil(shop?.trialEndsAt) === 0;
  const isCancelled = shop?.subscriptionStatus === "cancelled";

  const title = isCancelled ? "Assinatura cancelada" : "Seu trial acabou";
  const sub   = isCancelled
    ? "Pra voltar a usar o Fadein, reative sua assinatura."
    : "Esperamos que você tenha curtido esses 15 dias. Pra continuar com agenda, link de agendamento e tudo mais funcionando, é hora de assinar.";

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 20px", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: 440, width: "100%",
        background: C.card, border: "1px solid " + C.border, borderRadius: 14,
        padding: "32px 28px", textAlign: "center",
      }}>
        <div style={{ marginBottom: 22, display: "flex", justifyContent: "center" }}>
          <Logo scale={1.2} />
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 56, height: 56, borderRadius: "50%",
          background: C.amberDim, marginBottom: 18, fontSize: 26,
        }}>
          {isCancelled ? "👋" : "⏰"}
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 700, margin: "0 0 10px",
          color: C.fg, fontFamily: "Georgia, serif",
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 13.5, color: C.fgMuted, margin: "0 0 24px", lineHeight: 1.55 }}>
          {sub}
        </p>

        <div style={{
          background: C.bgSunken, border: "1px solid " + C.border, borderRadius: 10,
          padding: "14px 16px", marginBottom: 20, textAlign: "left",
        }}>
          <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            O que você mantém ao assinar
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13, color: C.fg, lineHeight: 1.9 }}>
            <li>✓ Sua agenda e histórico de clientes</li>
            <li>✓ Seu link público de agendamento</li>
            <li>✓ Comissões e financeiro</li>
            <li>✓ Lembretes via WhatsApp (no Premium)</li>
          </ul>
        </div>

        {/* Dois botões: Pro como CTA principal (mais barato, mais conversão),
            Premium como secundário pra quem precisa do recurso completo */}
        <button onClick={() => openCheckout("pro", shop?.id)} style={{
          width: "100%", background: C.goldBright, color: "#1A1A1A", border: "none",
          padding: "13px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", marginBottom: 8,
        }}>
          Assinar Pro · R$ 99/mês
        </button>

        <button onClick={() => openCheckout("premium", shop?.id)} style={{
          width: "100%", background: "transparent", color: C.goldBright,
          border: "1px solid " + C.goldBright + "60",
          padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", marginBottom: 10,
        }}>
          Assinar Premium · R$ 179/mês
        </button>

        <button onClick={onLogout} style={{
          background: "transparent", color: C.fgMuted, border: "none",
          padding: "9px 14px", fontSize: 12, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          Sair da conta
        </button>
      </div>
    </div>
  );
}

// Mensagem que substitui a página pública de agendamento se a barbearia
// está com trial expirado. Cliente final vê algo amigável em vez de UI quebrada.
function ShopUnavailable({ shopName }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 20px", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 56, height: 56, borderRadius: "50%",
          background: C.bgSunken, border: "1px solid " + C.border,
          marginBottom: 18, fontSize: 24,
        }}>
          🚪
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 10px", color: C.fg, fontFamily: "Georgia, serif" }}>
          Agendamento indisponível
        </h1>
        <p style={{ fontSize: 13, color: C.fgMuted, margin: 0, lineHeight: 1.6 }}>
          {shopName ? <><b>{shopName}</b> não está</> : "Esta barbearia não está"}{" "}
          recebendo agendamentos online no momento. Entre em contato direto pra marcar seu horário.
        </p>
      </div>
    </div>
  );
}


// Convenção JS p/ dia da semana: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb.
// Mantemos essa ordem no array workDays pra bater com Date.getDay() na hora de filtrar.
const DAYS_OF_WEEK = [
  { idx: 1, label: "Seg", full: "Segunda" },
  { idx: 2, label: "Ter", full: "Terça" },
  { idx: 3, label: "Qua", full: "Quarta" },
  { idx: 4, label: "Qui", full: "Quinta" },
  { idx: 5, label: "Sex", full: "Sexta" },
  { idx: 6, label: "Sáb", full: "Sábado" },
  { idx: 0, label: "Dom", full: "Domingo" },
];

function OperatingHoursCard({ shop, updateShop }) {
  // Modo: "simple" = mesmo horário pra todos os dias / "custom" = um horário por dia
  const initialMode = shop?.dayHours ? "custom" : "simple";
  const [mode, setMode] = useState(initialMode);

  // Estado modo SIMPLES (legacy)
  const [openTime,  setOpenTime]  = useState(shop.openTime  || "08:00");
  const [closeTime, setCloseTime] = useState(shop.closeTime || "20:00");
  const [workDays,  setWorkDays]  = useState(
    Array.isArray(shop.workDays) ? shop.workDays : [1, 2, 3, 4, 5, 6]
  );

  // Estado modo PERSONALIZADO
  const [dayHours, setDayHours] = useState(() => shop.dayHours || buildDefaultDayHours(shop));

  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Re-sincroniza se o shop carregar depois (ex: hot reload, troca de shop)
  useEffect(() => {
    if (shop.openTime)  setOpenTime(shop.openTime);
    if (shop.closeTime) setCloseTime(shop.closeTime);
    if (Array.isArray(shop.workDays)) setWorkDays(shop.workDays);
    if (shop.dayHours)  { setDayHours(shop.dayHours); setMode("custom"); }
    else                { setMode("simple"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.openTime, shop.closeTime, shop.workDays, shop.dayHours]);

  // Detecta se houve mudança não-salva
  const dirty = useMemo(() => {
    if (mode === "simple") {
      return (
        openTime  !== (shop.openTime  || "08:00") ||
        closeTime !== (shop.closeTime || "20:00") ||
        JSON.stringify([...workDays].sort()) !==
          JSON.stringify([...(Array.isArray(shop.workDays) ? shop.workDays : [1,2,3,4,5,6])].sort()) ||
        !!shop.dayHours  // se shop está em custom e mudou pra simple, é dirty
      );
    }
    // mode === "custom"
    return JSON.stringify(dayHours) !== JSON.stringify(shop.dayHours || {});
  }, [mode, openTime, closeTime, workDays, dayHours, shop]);

  function toggleDay(idx) {
    setWorkDays(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    );
    setSavedOk(false);
  }

  function updateDayHour(dayIdx, key, val) {
    setDayHours(prev => ({
      ...prev,
      [dayIdx]: { ...prev[dayIdx], [key]: val },
    }));
    setSavedOk(false);
  }

  // Quando troca de modo, popula o estado novo com base no antigo (sem perder nada)
  function switchMode(newMode) {
    if (newMode === mode) return;
    if (newMode === "custom") {
      // Constrói dayHours a partir do simple atual
      const dh = {};
      for (let d = 0; d <= 6; d++) {
        dh[d] = { open: openTime, close: closeTime, enabled: workDays.includes(d) };
      }
      setDayHours(dh);
    }
    setMode(newMode);
    setSavedOk(false);
  }

  async function save() {
    if (!updateShop || saving) return;

    if (mode === "simple") {
      if (workDays.length === 0) { alert("Selecione pelo menos 1 dia de funcionamento."); return; }
      if (closeTime <= openTime) { alert("O horário de fechamento precisa ser depois do de abertura."); return; }
      setSaving(true);
      // Limpa dayHours pra voltar pro modo simples
      const ok = await updateShop({ openTime, closeTime, workDays, dayHours: null });
      setSaving(false);
      if (ok) { setSavedOk(true); setTimeout(() => setSavedOk(false), 2400); }
      return;
    }

    // mode === "custom"
    const enabledDays = Object.entries(dayHours).filter(([_, h]) => h.enabled);
    if (enabledDays.length === 0) { alert("Selecione pelo menos 1 dia de funcionamento."); return; }
    for (const [d, h] of enabledDays) {
      if (h.close <= h.open) {
        alert(`${DAYS_OF_WEEK.find(x => x.idx === Number(d))?.full || "Dia"}: o horário de fechamento precisa ser depois do de abertura.`);
        return;
      }
    }
    setSaving(true);
    // Sincroniza também os campos legacy pra clientes antigos do app continuarem funcionando.
    // openTime/closeTime ficam como o "menor abre" e "maior fecha", workDays = dias ativos.
    const enabled = Object.entries(dayHours).filter(([_, h]) => h.enabled);
    const minOpen   = enabled.reduce((acc, [_, h]) => h.open  < acc ? h.open  : acc, "23:59");
    const maxClose  = enabled.reduce((acc, [_, h]) => h.close > acc ? h.close : acc, "00:00");
    const wd = enabled.map(([d]) => Number(d)).sort();
    const ok = await updateShop({
      dayHours,
      openTime: minOpen,
      closeTime: maxClose,
      workDays: wd,
    });
    setSaving(false);
    if (ok) { setSavedOk(true); setTimeout(() => setSavedOk(false), 2400); }
  }

  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>
          Horário de funcionamento
        </h3>

        {/* Toggle de modo */}
        <div style={{ display: "flex", gap: 4, background: C.bgSunken, padding: 3, borderRadius: 8 }}>
          {[["simple", "Igual todo dia"], ["custom", "Por dia"]].map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => switchMode(v)}
              style={{
                padding: "5px 11px", borderRadius: 6, border: "none",
                background: mode === v ? C.card : "transparent",
                color: mode === v ? C.goldBright : C.fgMuted,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      {mode === "simple" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Inp label="Abre"  type="time" value={openTime}  onChange={e => { setOpenTime(e.target.value);  setSavedOk(false); }} />
            <Inp label="Fecha" type="time" value={closeTime} onChange={e => { setCloseTime(e.target.value); setSavedOk(false); }} />
          </div>
          <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Dias de funcionamento
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {DAYS_OF_WEEK.map(d => {
              const on = workDays.includes(d.idx);
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() => toggleDay(d.idx)}
                  style={{
                    padding: "7px 11px", borderRadius: 7,
                    border: "1px solid " + (on ? C.goldBright : C.border),
                    background: on ? C.goldDim : "transparent",
                    color: on ? C.goldBright : C.fgMuted,
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                  aria-pressed={on}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 12, lineHeight: 1.5 }}>
            Dias desmarcados não aparecem no link de agendamento público.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 12, lineHeight: 1.5 }}>
            Defina um horário diferente pra cada dia. Útil quando o sábado/domingo abre menos, por exemplo.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {DAYS_OF_WEEK.map(d => {
              const dh = dayHours[d.idx] || { open: "08:00", close: "20:00", enabled: false };
              return (
                <div key={d.idx} className="day-hours-row" style={{
                  display: "grid",
                  gridTemplateColumns: "84px 1fr 1fr",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: dh.enabled ? C.bgSunken : "transparent",
                  border: "1px solid " + (dh.enabled ? C.border : "transparent"),
                  borderRadius: 9,
                  opacity: dh.enabled ? 1 : 0.55,
                  transition: "background 0.15s, opacity 0.15s",
                }}>
                  {/* Toggle do dia + nome */}
                  <button
                    type="button"
                    onClick={() => updateDayHour(d.idx, "enabled", !dh.enabled)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: 0, background: "transparent", border: "none",
                      cursor: "pointer", color: C.fg, fontFamily: "inherit",
                      minHeight: 0,
                    }}
                    aria-pressed={dh.enabled}
                  >
                    <div style={{
                      width: 32, height: 18, borderRadius: 9,
                      background: dh.enabled ? C.goldBright : C.border,
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 2, left: dh.enabled ? 16 : 2,
                        transition: "left 0.2s",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: dh.enabled ? C.fg : C.fgMuted,
                    }}>{d.label}</span>
                  </button>

                  {/* Inputs de horário (desabilitados se dia fechado) */}
                  <input
                    type="time"
                    value={dh.open}
                    disabled={!dh.enabled}
                    onChange={e => updateDayHour(d.idx, "open", e.target.value)}
                    style={{
                      padding: "7px 10px", borderRadius: 7,
                      border: "1px solid " + C.border,
                      background: C.bg, color: C.fg, fontSize: 13, outline: "none",
                      fontFamily: "inherit", minHeight: 36,
                      cursor: dh.enabled ? "text" : "not-allowed",
                    }}
                  />
                  <input
                    type="time"
                    value={dh.close}
                    disabled={!dh.enabled}
                    onChange={e => updateDayHour(d.idx, "close", e.target.value)}
                    style={{
                      padding: "7px 10px", borderRadius: 7,
                      border: "1px solid " + C.border,
                      background: C.bg, color: C.fg, fontSize: 13, outline: "none",
                      fontFamily: "inherit", minHeight: 36,
                      cursor: dh.enabled ? "text" : "not-allowed",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Btn sm onClick={save} disabled={!dirty || saving}>
          {saving ? "Salvando..." : "Salvar horários"}
        </Btn>
        {savedOk && (
          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ Salvo</span>
        )}
      </div>
    </div>
  );
}


function Config({ shop, services, setServices, onLogout, barbers, addBarber, updateBarber, deleteBarber, createService, updateService, deleteService, updateShop }) {
  const [saved, setSaved]           = useState(false);
  const [svcModal, setSvcModal]     = useState(false);
  const [editSvc, setEditSvc]       = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const [svcForm, setSvcForm]       = useState({ name: "", price: "", duration: "" });

  // Barbeiros
  const [barberModal, setBarberModal] = useState(false);
  const [editBarber, setEditBarber]   = useState(null);
  const [delBarber, setDelBarber]     = useState(null);
  const [barberForm, setBarberForm]   = useState({ name: "", role: "", commission: "" });
  const [savingBarber, setSavingBarber] = useState(false);

  function openNewBarber() {
    setEditBarber(null);
    setBarberForm({ name: "", role: "Barbeiro", commission: "50" });
    setBarberModal(true);
  }
  function openEditBarber(b) {
    setEditBarber(b.id);
    setBarberForm({ name: b.name, role: b.role || "Barbeiro", commission: String(b.commission ?? 50) });
    setBarberModal(true);
  }
  async function saveBarber() {
    if (!barberForm.name.trim()) return;
    setSavingBarber(true);
    const data = {
      name: barberForm.name.trim(),
      role: barberForm.role.trim() || "Barbeiro",
      commission: parseFloat(barberForm.commission) || 50,
    };
    try {
      if (editBarber) await updateBarber(editBarber, data);
      else            await addBarber(data);
    } finally {
      setSavingBarber(false);
      setBarberModal(false);
      setEditBarber(null);
    }
  }

  function openNewSvc()   { setEditSvc(null); setSvcForm({ name: "", price: "", duration: "" }); setSvcModal(true); }
  function openEditSvc(s) { setEditSvc(s.id);  setSvcForm({ name: s.name, price: String(s.price), duration: String(s.duration) }); setSvcModal(true); }
  async function saveSvc() {
    if (!svcForm.name.trim()) return;
    const d = { name: svcForm.name.trim(), price: parseFloat(svcForm.price) || 0, duration: parseInt(svcForm.duration) || 30 };
    if (editSvc) await updateService(editSvc, d);
    else         await createService(d);
    setSvcModal(false); setEditSvc(null);
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: C.fg, fontFamily: "Georgia, serif" }}>Configurações</h1>
        <Btn v="danger" sm icon={Ic.logout} onClick={onLogout}>Sair</Btn>
      </div>
      {saved && <div style={{ background: C.greenDim, border: "1px solid " + C.green + "40", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: C.green, fontWeight: 600 }}>✓ Salvo com sucesso</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 540 }}>
        {/* Card de plano: comportamento muda conforme o estado da barbearia.
            - Starter (trial): mostra "Período de teste" com contagem de dias,
              SEM preço, e empurra forte pra escolher um plano (Pro ou Premium).
              Texto deixa claro que ao fim do trial o app é bloqueado.
            - Pro / Premium: mostra preço, status da assinatura e CTA de upgrade
              (só aparece se ainda tem pra onde subir). */}
        {(() => {
          const planInfo = PLANS[shop.plan] || PLANS.starter;
          const isTrialPlan = !!planInfo.trial; // Starter
          const days = shop.subscriptionStatus === "trial" ? daysUntil(shop.trialEndsAt) : null;
          const urgentTrial = days !== null && days <= 7;

          return (
            <div style={{
              background: shop.plan === "premium"
                ? "linear-gradient(135deg, " + C.card + " 0%, " + C.card2 + " 100%)"
                : C.card,
              border: "1px solid " + (isTrialPlan ? C.amber + "40" : C.goldBright + "30"),
              borderRadius: 12, padding: 20,
              position: "relative", overflow: "hidden",
            }}>
              {isTrialPlan ? (
                // ─── ESTADO DE TRIAL (Starter) ─────────────────────────────
                <>
                  <div style={{
                    fontSize: 11, color: C.amber, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8,
                  }}>
                    Período de teste
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: C.fg, fontFamily: "Georgia, serif" }}>
                      {days === null ? "Trial"
                        : days === 0 ? "Termina hoje"
                        : days === 1 ? "Termina amanhã"
                        : days + " dias restantes"}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: C.fgMuted, margin: "10px 0 16px", lineHeight: 1.55 }}>
                    Você está testando o Fadein gratuitamente. Quando o período acabar, escolha
                    um plano pra continuar usando — sua agenda, clientes e link público ficam preservados.
                  </p>

                  {/* Dois CTAs: Pro destaque (mais conversão), Premium em outline */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => openCheckout("pro", shop.id)} style={{
                      flex: "1 1 200px", background: C.goldBright, color: "#1A1A1A",
                      border: "none", padding: "11px 16px", borderRadius: 9,
                      fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Assinar Pro · R$ 99/mês
                    </button>
                    <button onClick={() => openCheckout("premium", shop.id)} style={{
                      flex: "1 1 200px", background: "transparent", color: C.goldBright,
                      border: "1px solid " + C.goldBright + "60", padding: "10px 16px", borderRadius: 9,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Premium · R$ 179/mês
                    </button>
                  </div>

                  {urgentTrial && days !== null && days <= 3 && (
                    <div style={{
                      marginTop: 14, padding: "10px 12px",
                      background: C.redDim, border: "1px solid " + C.red + "30",
                      borderRadius: 8, fontSize: 12, color: C.red, lineHeight: 1.5,
                    }}>
                      ⚠ Seu trial está acabando. Sem assinatura, o app será bloqueado no fim do período.
                    </div>
                  )}
                </>
              ) : (
                // ─── ESTADO DE PLANO PAGO (Pro / Premium) ──────────────────
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.fgMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                        Plano atual
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: C.fg, fontFamily: "Georgia, serif" }}>
                          {planInfo.name}
                        </span>
                        <span style={{ fontSize: 13, color: C.fgMuted }}>
                          R$ {planInfo.price}/mês
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: C.fgMuted, marginTop: 6 }}>
                        {shop.plan === "pro"     && "Agenda + Link + Financeiro + Comissões + Relatórios. Até 3 barbeiros."}
                        {shop.plan === "premium" && "Tudo do Pro + barbeiros ilimitados + multi-unidade."}
                      </div>
                    </div>
                    {shop.plan !== "premium" && (
                      <Btn sm onClick={() => openCheckout("premium", shop.id)}>
                        Fazer upgrade
                      </Btn>
                    )}
                  </div>

                  {shop.subscriptionStatus === "active" && (
                    <div style={{
                      marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.border,
                      fontSize: 12, color: C.green,
                    }}>
                      ✓ Assinatura ativa
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Programa de indicação: cada barbearia vira vendedora.
            Posicionado logo após o card de plano por estar conectado à
            economia da assinatura (ganhar mês grátis). */}
        <ReferralCard shop={shop} />

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: "0 0 14px" }}>Dados da barbearia</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp label="Nome" defaultValue={shop.name} />
            <Inp label="Endereço" defaultValue={shop.address} />
            <Inp label="WhatsApp" defaultValue="(51) 99999-0000" />
            <Inp label="Instagram" defaultValue="@barbearia" />
          </div>
        </div>

        <OperatingHoursCard shop={shop} updateShop={updateShop} />

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>
              Equipe
              <span style={{ fontSize: 11, color: C.fgMuted, fontWeight: 500, marginLeft: 8 }}>
                {barbers.length}{(PLANS[shop.plan] || PLANS.starter).maxBarbers === Infinity ? "" : "/" + (PLANS[shop.plan] || PLANS.starter).maxBarbers}
              </span>
            </h3>
            {(() => {
              const max = (PLANS[shop.plan] || PLANS.starter).maxBarbers;
              const reached = barbers.length >= max;
              return reached ? (
                <Btn sm v="ghost" onClick={() => {
                  // Starter (1 barbeiro) → Pro; Pro (3 barbeiros) → Premium
                  const nextPlanId = shop.plan === "starter" ? "pro" : "premium";
                  openCheckout(nextPlanId, shop.id);
                }}>🔒 Limite atingido</Btn>
              ) : (
                <Btn sm icon={Ic.plus} onClick={openNewBarber}>Novo barbeiro</Btn>
              );
            })()}
          </div>
          {(() => {
            const planInfo = PLANS[shop.plan] || PLANS.starter;
            const max = planInfo.maxBarbers;
            if (barbers.length >= max && max !== Infinity) {
              return (
                <div style={{
                  background: C.amberDim, border: "1px solid " + C.amber + "30",
                  borderRadius: 8, padding: "10px 12px", marginBottom: 10,
                  fontSize: 12, color: C.amber, lineHeight: 1.5,
                }}>
                  {planInfo.trial
                    ? <>Durante o período de teste você pode cadastrar até <b>{max}</b> barbeiro{max > 1 ? "s" : ""}. Assine o Pro pra ter <b>3</b> ou o Premium pra <b>ilimitados</b>.</>
                    : <>Seu plano <b>{planInfo.name}</b> permite até <b>{max}</b> barbeiro{max > 1 ? "s" : ""}. Faça upgrade pra adicionar mais.</>}
                </div>
              );
            }
            return null;
          })()}
          {barbers.length === 0 && (
            <p style={{ fontSize: 12, color: C.fgMuted, margin: 0, padding: "10px 0" }}>
              Nenhum barbeiro cadastrado. Clique em "Novo barbeiro" para começar.
            </p>
          )}
          {barbers.map((b, i) => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 0", borderBottom: i < barbers.length - 1 ? "1px solid " + C.border : "none",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: (b.color || "#E0B445") + "30", color: b.color || "#E0B445",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>{b.avatar || (b.name || "?").charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{b.name}</div>
                <div style={{ fontSize: 11, color: C.fgMuted }}>{b.role || "Barbeiro"} · {b.commission ?? 50}%</div>
              </div>
              <button onClick={() => openEditBarber(b)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: C.goldDim, color: C.goldBright, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center" }}>{Ic.edit}</button>
              <button onClick={() => setDelBarber(b)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: C.redDim, color: C.red, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center" }}>{Ic.trash}</button>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Serviços e preços</h3>
            <Btn sm icon={Ic.plus} onClick={openNewSvc}>Novo serviço</Btn>
          </div>
          {services.map(s => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 0", borderBottom: "1px solid " + C.border,
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.fg }}>{s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.goldBright, minWidth: 70, textAlign: "right", fontFamily: "Georgia, serif" }}>{fmtMoney(s.price)}</span>
              <span style={{ fontSize: 11, color: C.fgMuted, minWidth: 50, textAlign: "right" }}>{s.duration}min</span>
              <button onClick={() => openEditSvc(s)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: C.goldDim, color: C.goldBright, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center" }}>{Ic.edit}</button>
              <button onClick={() => setDeleting(s)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: C.redDim, color: C.red, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center" }}>{Ic.trash}</button>
            </div>
          ))}
        </div>

        <Btn onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} full>Salvar alterações</Btn>

        {/* Persistência / Reset */}
        <div style={{
          background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: 20,
          marginTop: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, marginBottom: 8 }}>Dados do sistema</div>
          <p style={{ fontSize: 12, color: C.fgMuted, margin: "0 0 14px", lineHeight: 1.5 }}>
            Tudo que você cria fica salvo automaticamente entre sessões. Use o botão abaixo para resetar para os dados de demonstração.
          </p>
          <Btn v="danger" sm icon={Ic.trash} onClick={async () => {
            if (window.storage) {
              try { await window.storage.delete("fadein:shop:" + shop.id + ":data"); } catch(e) {}
            }
            window.location.reload();
          }}>
            Resetar dados desta barbearia
          </Btn>
        </div>
      </div>

      {svcModal && (
        <Modal title={editSvc ? "Editar serviço" : "Novo serviço"} onClose={() => { setSvcModal(false); setEditSvc(null); }}>
          <Inp label="Nome do serviço" value={svcForm.name} onChange={e => setSvcForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Corte degradê" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Inp label="Preço (R$)" type="number" value={svcForm.price} onChange={e => setSvcForm(p => ({ ...p, price: e.target.value }))} placeholder="55" />
            <Inp label="Duração (min)" type="number" value={svcForm.duration} onChange={e => setSvcForm(p => ({ ...p, duration: e.target.value }))} placeholder="30" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={saveSvc} full>{editSvc ? "Salvar" : "Adicionar serviço"}</Btn>
            <Btn v="ghost" onClick={() => { setSvcModal(false); setEditSvc(null); }}>Cancelar</Btn>
          </div>
        </Modal>
      )}

      {barberModal && (
        <Modal title={editBarber ? "Editar barbeiro" : "Novo barbeiro"} onClose={() => { setBarberModal(false); setEditBarber(null); }}>
          <Inp label="Nome" value={barberForm.name} onChange={e => setBarberForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Carlos" />
          <Inp label="Função" value={barberForm.role} onChange={e => setBarberForm(p => ({ ...p, role: e.target.value }))} placeholder="Barbeiro, Barbeiro Senior, Aprendiz..." />
          <Inp label="Comissão (%)" type="number" value={barberForm.commission} onChange={e => setBarberForm(p => ({ ...p, commission: e.target.value }))} placeholder="50" hint="Percentual que vai para o barbeiro a cada atendimento" />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn onClick={saveBarber} disabled={savingBarber} full>
              {savingBarber ? "Salvando..." : (editBarber ? "Salvar" : "Adicionar barbeiro")}
            </Btn>
            <Btn v="ghost" onClick={() => { setBarberModal(false); setEditBarber(null); }} disabled={savingBarber}>Cancelar</Btn>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Excluir serviço?"
        message={deleting ? `Tem certeza? "${deleting.name}" será removido permanentemente.` : ""}
        onConfirm={async () => { if (deleting) await deleteService(deleting.id); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
        danger
      />

      <ConfirmDialog
        open={!!delBarber}
        title="Remover barbeiro?"
        message={delBarber ? `Tem certeza que deseja remover "${delBarber.name}"? O histórico de atendimentos será preservado.` : ""}
        onConfirm={async () => { if (delBarber) await deleteBarber(delBarber.id); setDelBarber(null); }}
        onCancel={() => setDelBarber(null)}
        danger
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
const NAV = [
  { id: "dashboard",  label: "Dashboard",  icon: Ic.dashboard },
  { id: "agenda",     label: "Agenda",     icon: Ic.calendar  },
  { id: "financeiro", label: "Financeiro", icon: Ic.money     },
  { id: "comissoes",  label: "Comissões",  icon: Ic.scissors  },
  { id: "clientes",   label: "Clientes",   icon: Ic.users     },
  { id: "link",       label: "Link",       icon: Ic.link      },
  { id: "config",     label: "Config",     icon: Ic.gear      },
];

export default function App() {
  // ── Roteamento: link público de agendamento ──────────────────────────────
  // Suporta /agendar/{slug} (path) e ?agendar={slug} (query) para máxima
  // compatibilidade entre hospedagens (Vercel, Netlify, etc).
  const publicSlug = useMemo(() => {
    if (typeof window === "undefined") return null;
    const path = window.location.pathname || "";
    const m = path.match(/\/agendar\/([a-z0-9-]+)/i);
    if (m) return m[1].toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const q = params.get("agendar");
    if (q) return q.toLowerCase();
    return null;
  }, []);

  // Se for link público, renderiza somente a página de booking (sem auth)
  if (publicSlug) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <PublicBooking slug={publicSlug} />
    </>
  );

  const [shop,     setShop]     = useState(null);
  const [barbers,  setBarbersState] = useState([]); // carregado do Supabase
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [page,     setPage]     = useState("dashboard");
  const [services, setServices] = useState([]); // carregado do Supabase
  const [clients,  setClients]  = useState([]); // carregado do Supabase
  const [appts,    setAppts]    = useState([]); // carregado do Supabase
  const [txns,     setTxns]     = useState([]); // carregado do Supabase
  const [hydrated, setHydrated] = useState(false);

  // Guarda o uid da sessão atual entre renders. Serve pra distinguir um login
  // novo (uid diferente do anterior) de um SIGNED_IN espúrio do Supabase
  // (refresh de token, retorno de aba/PWA do background, INITIAL_SESSION em
  // alguns navegadores). Sem isso, o app voltava pra dashboard toda vez que
  // a sessão era reidratada — o que quebra a navegação do usuário.
  const prevUidRef = useRef(null);

  // Paleta de cores para barbeiros (cíclica) — visual idêntico ao mock anterior
  const BARBER_PALETTE = ["#E0B445", "#5A9BE2", "#5BAF6F", "#E27E5A", "#9B6FD4", "#D45A8A"];
  const enrichBarber = (b, idx) => ({
    ...b,
    avatar: (b.name || "?").charAt(0).toUpperCase(),
    color: BARBER_PALETTE[idx % BARBER_PALETTE.length],
  });

  // ── Carrega barbeiros do shop ──────────────────────────────────────────
  const loadBarbers = useCallback(async (shopId) => {
    if (!shopId) { setBarbersState([]); return; }
    const withTimeout = (p, ms, label) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label}`)), ms)),
    ]);
    try {
      const { data, error } = await withTimeout(
        supabase.from("barbers").select("*").eq("shop_id", shopId).eq("active", true).order("created_at"),
        8000, "select barbers"
      );
      if (error) { console.error("[fadein] barbers error:", error); return; }
      const enriched = (data || []).map((b, i) => enrichBarber(b, i));
      setBarbersState(enriched);
    } catch (e) { console.error("[fadein] loadBarbers fatal:", e?.message || e); }
  }, []);

  // ── APPOINTMENTS — conversão DB ↔ UI ────────────────────────────────────
  // UI shape: { id, date: "YYYY-MM-DD", time: "HH:MM", client, service: {...}, barber: {...}, status, paid, paidAmount, paidMethod }
  // DB shape: { id, shop_id, barber_id, client_name, client_phone, service (text), service_data (jsonb), price, status, date (timestamptz), time, paid, notes }
  const dbRowToAppt = useCallback((row, barbersList) => {
    if (!row) return null;
    const dtIso = row.date;            // timestamptz
    const dt    = new Date(dtIso);
    const dateStr = dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
    const timeStr = row.time || (pad(dt.getHours()) + ":" + pad(dt.getMinutes()));
    let svc = null;
    try {
      svc = row.service_data ? (typeof row.service_data === "string" ? JSON.parse(row.service_data) : row.service_data) : null;
    } catch (e) { svc = null; }
    if (!svc) svc = { id: 0, name: row.service || "Serviço", price: parseFloat(row.price) || 0, duration: 30 };
    const barber = (barbersList || []).find(b => b.id === row.barber_id) || { id: row.barber_id, name: "—", color: "#888", avatar: "?", commission: 50 };
    return {
      id: row.id,
      date: dateStr,
      time: timeStr,
      client: row.client_name,
      clientPhone: row.client_phone || "",
      service: svc,
      barber,
      status: row.status || "pending",
      paid: !!row.paid,
      paidAmount: row.paid ? parseFloat(row.price) : undefined,
      paidMethod: undefined,
      notes: row.notes || "",
    };
  }, []);

  const apptToDbRow = useCallback((appt, shopId) => {
    // Combina date + time em timestamptz local
    const [Y, M, D] = (appt.date || "").split("-").map(Number);
    const [hh, mm]  = (appt.time || "00:00").split(":").map(Number);
    const dt = new Date(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0);
    return {
      shop_id:      shopId,
      barber_id:    appt.barber?.id || null,
      client_name:  appt.client,
      client_phone: appt.clientPhone || null,
      service:      appt.service?.name || "Serviço",
      service_data: appt.service || null,
      price:        appt.service?.price || 0,
      status:       appt.status || "pending",
      date:         dt.toISOString(),
      time:         appt.time,
      paid:         !!appt.paid,
      notes:        appt.notes || null,
    };
  }, []);

  // ── Carrega agendamentos do shop ────────────────────────────────────────
  const loadAppts = useCallback(async (shopId, barbersList) => {
    if (!shopId) { setAppts([]); return; }
    const withTimeout = (p, ms, label) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label}`)), ms)),
    ]);
    try {
      // Janela: últimos 60 dias + próximos 30 dias (suficiente para a UI)
      const today = new Date();
      const from  = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60).toISOString();
      const to    = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 31).toISOString();
      const { data, error } = await withTimeout(
        supabase.from("appointments")
          .select("*")
          .eq("shop_id", shopId)
          .gte("date", from)
          .lte("date", to)
          .order("date"),
        8000, "select appts"
      );
      if (error) { console.error("[fadein] appts error:", error); return; }
      const list = (data || []).map(r => dbRowToAppt(r, barbersList));
      setAppts(list);
    } catch (e) { console.error("[fadein] loadAppts fatal:", e?.message || e); }
  }, [dbRowToAppt]);

  // ── CRUD de agendamentos ─────────────────────────────────────────────────
  const createAppt = useCallback(async (apptData) => {
    if (!shop?.id) return null;
    const row = apptToDbRow(apptData, shop.id);
    const { data, error } = await supabase.from("appointments").insert(row).select().maybeSingle();
    if (error) { console.error("[fadein] createAppt:", error); return null; }
    if (data) {
      const newAppt = dbRowToAppt(data, barbers);
      setAppts(prev => [...prev, newAppt]);
      return newAppt;
    }
    return null;
  }, [shop?.id, barbers, apptToDbRow, dbRowToAppt]);

  const updateAppt = useCallback(async (id, patch) => {
    // patch é um objeto parcial no shape UI; convertemos só os campos relevantes para DB
    const dbPatch = {};
    if (patch.client !== undefined)      dbPatch.client_name = patch.client;
    if (patch.clientPhone !== undefined) dbPatch.client_phone = patch.clientPhone;
    if (patch.service !== undefined) {
      dbPatch.service      = patch.service?.name || "Serviço";
      dbPatch.service_data = patch.service;
      dbPatch.price        = patch.service?.price || 0;
    }
    if (patch.barber !== undefined)      dbPatch.barber_id = patch.barber?.id || null;
    if (patch.status !== undefined)      dbPatch.status    = patch.status;
    if (patch.paid !== undefined)        dbPatch.paid      = patch.paid;
    if (patch.notes !== undefined)       dbPatch.notes     = patch.notes;
    if (patch.date !== undefined || patch.time !== undefined) {
      // precisamos do appt atual pra montar o timestamp
      const current = appts.find(a => a.id === id);
      if (current) {
        const date = patch.date !== undefined ? patch.date : current.date;
        const time = patch.time !== undefined ? patch.time : current.time;
        const [Y, M, D] = date.split("-").map(Number);
        const [hh, mm] = time.split(":").map(Number);
        dbPatch.date = new Date(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0).toISOString();
        dbPatch.time = time;
      }
    }
    const { error } = await supabase.from("appointments").update(dbPatch).eq("id", id);
    if (error) { console.error("[fadein] updateAppt:", error); return; }
    // Atualiza state local imediatamente
    setAppts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, [appts]);

  const cancelAppt = useCallback(async (id) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) { console.error("[fadein] cancelAppt:", error); return; }
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status: "cancelled" } : a));
  }, []);

  // ── CLIENTES ─────────────────────────────────────────────────────────────
  const dbRowToClient = useCallback((row) => ({
    id:        row.id,
    name:      row.name,
    phone:     row.phone || "",
    lastVisit: row.last_visit || null,
    visits:    row.visits || 0,
    fav:       row.fav_barber || null,
    notes:     row.notes || "",
  }), []);

  const loadClients = useCallback(async (shopId) => {
    if (!shopId) { setClients([]); return; }
    const withTimeout = (p, ms, label) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label}`)), ms)),
    ]);
    try {
      const { data, error } = await withTimeout(
        supabase.from("clients").select("*").eq("shop_id", shopId).order("name"),
        8000, "select clients"
      );
      if (error) { console.error("[fadein] clients error:", error); return; }
      setClients((data || []).map(dbRowToClient));
    } catch (e) { console.error("[fadein] loadClients fatal:", e?.message || e); }
  }, [dbRowToClient]);

  const createClient = useCallback(async (data) => {
    if (!shop?.id) return null;
    const row = {
      shop_id:    shop.id,
      name:       data.name,
      phone:      data.phone || null,
      last_visit: data.lastVisit || null,
      visits:     data.visits || 0,
      fav_barber: data.fav || null,
      notes:      data.notes || null,
    };
    const { data: created, error } = await supabase.from("clients").insert(row).select().maybeSingle();
    if (error) { console.error("[fadein] createClient:", error); return null; }
    if (created) {
      const newClient = dbRowToClient(created);
      setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      return newClient;
    }
    return null;
  }, [shop?.id, dbRowToClient]);

  const updateClient = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (patch.name !== undefined)      dbPatch.name       = patch.name;
    if (patch.phone !== undefined)     dbPatch.phone      = patch.phone || null;
    if (patch.lastVisit !== undefined) dbPatch.last_visit = patch.lastVisit || null;
    if (patch.visits !== undefined)    dbPatch.visits     = patch.visits;
    if (patch.fav !== undefined)       dbPatch.fav_barber = patch.fav || null;
    if (patch.notes !== undefined)     dbPatch.notes      = patch.notes || null;
    const { error } = await supabase.from("clients").update(dbPatch).eq("id", id);
    if (error) { console.error("[fadein] updateClient:", error); return; }
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const deleteClient = useCallback(async (id) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { console.error("[fadein] deleteClient:", error); return; }
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  // Helper: ao criar agendamento, garante que cliente existe e atualiza visita
  const upsertClientFromAppt = useCallback(async ({ name, phone, date, barberId, notes }) => {
    if (!shop?.id || !name?.trim()) return;
    // Busca por telefone (mais confiável) ou por nome
    let existing = null;
    if (phone) existing = clients.find(c => c.phone === phone);
    if (!existing) existing = clients.find(c => c.name.toLowerCase() === name.trim().toLowerCase());

    if (existing) {
      // Incrementa visita
      await updateClient(existing.id, {
        visits: (existing.visits || 0) + 1,
        lastVisit: date,
      });
    } else {
      // Cria novo
      await createClient({
        name: name.trim(),
        phone: phone || "",
        lastVisit: date,
        visits: 1,
        fav: barberId || null,
        notes: notes || "",
      });
    }
  }, [shop?.id, clients, createClient, updateClient]);

  // ── TRANSAÇÕES (financeiro) ─────────────────────────────────────────────
  const dbRowToTxn = useCallback((row, barbersList) => {
    const barber = (barbersList || []).find(b => b.id === row.barber_id);
    return {
      id:               row.id,
      date:             row.date,                         // YYYY-MM-DD
      desc:             row.description,
      amount:           parseFloat(row.amount) || 0,
      method:           row.method || "",
      barber:           barber?.name || "",
      barberId:         row.barber_id || null,
      out:              !!row.is_expense,
      apptId:           row.appointment_id || null,
      commissionPct:    row.commission_pct != null ? parseFloat(row.commission_pct) : undefined,
      commissionAmount: row.commission_amount != null ? parseFloat(row.commission_amount) : undefined,
      notes:            row.notes || "",
    };
  }, []);

  const txnToDbRow = useCallback((t, shopId) => ({
    shop_id:           shopId,
    date:              t.date,                            // já YYYY-MM-DD
    description:       t.desc || "",
    amount:            t.amount || 0,
    method:            t.method || null,
    barber_id:         t.barberId || null,
    appointment_id:    t.apptId || null,
    is_expense:        !!t.out,
    commission_pct:    t.commissionPct ?? null,
    commission_amount: t.commissionAmount ?? null,
    notes:             t.notes || null,
  }), []);

  const loadTxns = useCallback(async (shopId, barbersList) => {
    if (!shopId) { setTxns([]); return; }
    const withTimeout = (p, ms, label) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label}`)), ms)),
    ]);
    try {
      const today = new Date();
      const from  = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90).toISOString().slice(0, 10);
      const { data, error } = await withTimeout(
        supabase.from("transactions").select("*").eq("shop_id", shopId).gte("date", from).order("date", { ascending: false }),
        8000, "select txns"
      );
      if (error) { console.error("[fadein] txns error:", error); return; }
      setTxns((data || []).map(r => dbRowToTxn(r, barbersList)));
    } catch (e) { console.error("[fadein] loadTxns fatal:", e?.message || e); }
  }, [dbRowToTxn]);

  const createTxn = useCallback(async (txnData) => {
    if (!shop?.id) return null;
    const row = txnToDbRow(txnData, shop.id);
    const { data: created, error } = await supabase.from("transactions").insert(row).select().maybeSingle();
    if (error) { console.error("[fadein] createTxn:", error); return null; }
    if (created) {
      const newTxn = dbRowToTxn(created, barbers);
      setTxns(prev => [newTxn, ...prev]);
      return newTxn;
    }
    return null;
  }, [shop?.id, barbers, txnToDbRow, dbRowToTxn]);

  const deleteTxn = useCallback(async (id) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { console.error("[fadein] deleteTxn:", error); return; }
    setTxns(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── SERVIÇOS ────────────────────────────────────────────────────────────
  const loadServices = useCallback(async (shopId) => {
    if (!shopId) { setServices([]); return; }
    const withTimeout = (p, ms, label) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label}`)), ms)),
    ]);
    try {
      const { data, error } = await withTimeout(
        supabase.from("services").select("*").eq("shop_id", shopId).eq("active", true).order("name"),
        8000, "select services"
      );
      if (error) { console.error("[fadein] services error:", error); return; }
      const mapped = (data || []).map(r => ({
        id:       r.id,
        name:     r.name,
        price:    parseFloat(r.price) || 0,
        duration: parseInt(r.duration) || 30,
      }));
      setServices(mapped);
    } catch (e) { console.error("[fadein] loadServices fatal:", e?.message || e); }
  }, []);

  const createService = useCallback(async (data) => {
    if (!shop?.id) return null;
    const row = {
      shop_id:  shop.id,
      name:     data.name,
      price:    data.price || 0,
      duration: data.duration || 30,
      active:   true,
    };
    const { data: created, error } = await supabase.from("services").insert(row).select().maybeSingle();
    if (error) { console.error("[fadein] createService:", error); return null; }
    if (created) {
      const s = { id: created.id, name: created.name, price: parseFloat(created.price) || 0, duration: parseInt(created.duration) || 30 };
      setServices(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
      return s;
    }
    return null;
  }, [shop?.id]);

  const updateService = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (patch.name !== undefined)     dbPatch.name     = patch.name;
    if (patch.price !== undefined)    dbPatch.price    = patch.price;
    if (patch.duration !== undefined) dbPatch.duration = patch.duration;
    const { error } = await supabase.from("services").update(dbPatch).eq("id", id);
    if (error) { console.error("[fadein] updateService:", error); return; }
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const deleteService = useCallback(async (id) => {
    // soft delete: desativa em vez de excluir, para preservar histórico de agendamentos
    const { error } = await supabase.from("services").update({ active: false }).eq("id", id);
    if (error) { console.error("[fadein] deleteService:", error); return; }
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  // ── Carrega shop do Supabase para um user_id ─────────────────────────────
  const loadShopForUser = useCallback(async (uid) => {
    if (!uid) { setShop(null); return; }

    // Helper: race contra timeout para detectar query travada
    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout em ${label} (${ms}ms)`)), ms)),
    ]);

    try {
      const { data, error } = await withTimeout(
        supabase.from("shops").select("*").eq("user_id", uid).maybeSingle(),
        8000, "select shops"
      );
      if (error) { console.error("[fadein] shop error:", error); setShop(null); return; }
      if (data) {
        setShop({
          id: data.id,
          name: data.name || "Minha Barbearia",
          address: data.address || "",
          color: "#C9982A",
          plan: data.plan || "starter",
          slug: data.slug || slugify(data.name || ""),
          // Horário de funcionamento (defaults: 8h-20h, fechado domingo)
          // work_days segue convenção JS: 0=Dom, 1=Seg, ..., 6=Sáb
          openTime:  data.open_time  || "08:00",
          closeTime: data.close_time || "20:00",
          workDays:  Array.isArray(data.work_days) ? data.work_days : [1, 2, 3, 4, 5, 6],
          // Horário customizado por dia (jsonb no banco). Se existir, tem prioridade
          // sobre openTime/closeTime — ver getDayHours().
          dayHours:  data.day_hours && typeof data.day_hours === "object" ? data.day_hours : null,
          // Trial / assinatura
          trialEndsAt:        data.trial_ends_at || null,
          subscriptionStatus: data.subscription_status || "trial",
        });
      } else {
        // Primeira entrada da barbearia: cria registro em shops.
        // Se chegou via link de indicação (`?ref=<uuid>` capturado no boot),
        // tenta gravar `referred_by` apontando pro indicador. Como a coluna
        // pode não existir ainda no banco (migration não rodada), faz fallback
        // pro insert "puro" pra não bloquear o cadastro.
        const referredBy = (typeof window !== "undefined") ? localStorage.getItem(REFERRAL_KEY) : null;
        const baseInsert = { user_id: uid, name: "Minha Barbearia", plan: "starter" };

        let created = null;
        if (referredBy) {
          const r1 = await withTimeout(
            supabase.from("shops").insert({ ...baseInsert, referred_by: referredBy }).select().maybeSingle(),
            8000, "insert shops com referral"
          );
          if (!r1.error) {
            created = r1.data;
            try { localStorage.removeItem(REFERRAL_KEY); } catch {}
          } else {
            console.warn("[fadein] insert com referred_by falhou, tentando sem:", r1.error?.message);
          }
        }
        if (!created) {
          const r2 = await withTimeout(
            supabase.from("shops").insert(baseInsert).select().maybeSingle(),
            8000, "insert shops"
          );
          created = r2.data;
        }

        if (created) setShop({
          id: created.id, name: created.name, address: "", color: "#C9982A",
          plan: "starter", slug: slugify(created.name || ""),
          openTime: "08:00", closeTime: "20:00", workDays: [1, 2, 3, 4, 5, 6],
          dayHours: null,
          trialEndsAt: created.trial_ends_at || null,
          subscriptionStatus: created.subscription_status || "trial",
        });
      }
    } catch (e) {
      console.error("[fadein] loadShop fatal:", e?.message || e);
      // Mesmo com erro, libera a tela pra mostrar pelo menos o login (ou o app sem shop)
    }
  }, []);

  // ── Boot: verifica sessão atual + listener de auth ───────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        const uid = session?.user?.id || null;
        // Marca o uid já no boot pra que o SIGNED_IN que o Supabase dispara
        // logo em seguida (com o mesmo usuário) seja reconhecido como sessão
        // já existente, e não como login novo.
        prevUidRef.current = uid;
        await loadShopForUser(uid);
      } catch (e) { console.error("[fadein] boot error:", e); }
      finally { if (active) { setAuthReady(true); } }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        return;
      }
      if (event === "SIGNED_OUT") {
        prevUidRef.current = null;
        setShop(null); setHydrated(false); setRecoveryMode(false);
        return;
      }
      // O Supabase dispara SIGNED_IN não só no login real, mas também em:
      //   - reidratação da sessão (foco da aba, PWA voltando do background)
      //   - INITIAL_SESSION em alguns navegadores
      //   - depois de um TOKEN_REFRESHED em determinadas versões
      // Por isso só consideramos "login novo" quando o uid mudou. Caso contrário
      // ignoramos: o usuário continua na página em que estava (não é mais
      // jogado pra dashboard quando volta pra aba).
      if (event === "SIGNED_IN") {
        const newUid = session?.user?.id || null;
        if (newUid && newUid !== prevUidRef.current) {
          prevUidRef.current = newUid;
          await loadShopForUser(newUid);
          setPage("dashboard");
          setHydrated(false);
        }
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadShopForUser]);

  // ── Carrega barbeiros e agendamentos sempre que o shop mudar ─────────────
  useEffect(() => {
    if (!shop?.id) { setBarbersState([]); setAppts([]); setClients([]); setTxns([]); setServices([]); return; }
    (async () => {
      // 1) carrega barbeiros primeiro (necessário pra resolver appts.barber)
      await loadBarbers(shop.id);
      // 2) carrega clientes e serviços em paralelo (não dependem de outras tabelas)
      loadClients(shop.id);
      loadServices(shop.id);
    })();
  }, [shop?.id, loadBarbers, loadClients, loadServices]);

  // Quando barbeiros mudam (após shop), recarrega agendamentos e transações com lista atualizada
  useEffect(() => {
    if (shop?.id && barbers.length >= 0) {
      loadAppts(shop.id, barbers);
      loadTxns(shop.id, barbers);
    }
  }, [shop?.id, barbers, loadAppts, loadTxns]);

  // ── REALTIME: agendamentos vindos do link público entram na agenda automaticamente ──
  // Substitui a necessidade de dar F5 — escuta INSERT/UPDATE/DELETE em appointments
  useEffect(() => {
    if (!shop?.id) return;
    const channel = supabase
      .channel("appts-rt-" + shop.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: "shop_id=eq." + shop.id,
      }, (payload) => {
        try {
          if (payload.eventType === "INSERT" && payload.new) {
            const newAppt = dbRowToAppt(payload.new, barbers);
            if (newAppt) {
              setAppts(prev => prev.some(a => a.id === newAppt.id) ? prev : [...prev, newAppt]);
            }
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const updated = dbRowToAppt(payload.new, barbers);
            if (updated) {
              setAppts(prev => prev.map(a => a.id === updated.id ? updated : a));
            }
          } else if (payload.eventType === "DELETE" && payload.old) {
            setAppts(prev => prev.filter(a => a.id !== payload.old.id));
          }
        } catch (e) { console.error("[fadein] realtime payload error:", e); }
      })
      .subscribe((status) => {
      });
    return () => { supabase.removeChannel(channel); };
  }, [shop?.id, barbers, dbRowToAppt]);

  // ── Refresh ao voltar pra aba: garante consistência mesmo se o realtime cair ──
  // Com throttle de 30s pra evitar que o app fique recarregando agendamentos
  // toda vez que o usuário troca rapidinho de aba (ou que iOS dispare
  // visibilitychange várias vezes em sequência). O realtime já cobre o caso
  // comum; isso aqui é só rede de segurança.
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    if (!shop?.id) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshRef.current < 30000) return; // 30s throttle
      lastRefreshRef.current = now;
      loadAppts(shop.id, barbers);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [shop?.id, barbers, loadAppts]);

  // Helpers expostos pra Config: criar/editar/excluir barbeiros
  const addBarber = useCallback(async (data) => {
    if (!shop?.id) return;
    const { data: created, error } = await supabase.from("barbers")
      .insert({ shop_id: shop.id, name: data.name, role: data.role || "Barbeiro", commission: data.commission || 50, active: true })
      .select().maybeSingle();
    if (error) { console.error("[fadein] addBarber:", error); return; }
    if (created) await loadBarbers(shop.id);
  }, [shop?.id, loadBarbers]);

  const updateBarber = useCallback(async (id, data) => {
    const { error } = await supabase.from("barbers").update(data).eq("id", id);
    if (error) { console.error("[fadein] updateBarber:", error); return; }
    if (shop?.id) await loadBarbers(shop.id);
  }, [shop?.id, loadBarbers]);

  const deleteBarber = useCallback(async (id) => {
    // soft delete: desativa em vez de excluir, para preservar histórico
    const { error } = await supabase.from("barbers").update({ active: false }).eq("id", id);
    if (error) { console.error("[fadein] deleteBarber:", error); return; }
    if (shop?.id) await loadBarbers(shop.id);
  }, [shop?.id, loadBarbers]);

  // Atualiza dados da loja (horário de funcionamento, etc).
  // `patch` usa nomes camelCase (openTime, closeTime, workDays, dayHours) — mapeamos
  // pros nomes do banco (open_time, close_time, work_days, day_hours) na hora do update.
  const updateShop = useCallback(async (patch) => {
    if (!shop?.id) return;
    const dbPatch = {};
    if (patch.openTime  !== undefined) dbPatch.open_time  = patch.openTime;
    if (patch.closeTime !== undefined) dbPatch.close_time = patch.closeTime;
    if (patch.workDays  !== undefined) dbPatch.work_days  = patch.workDays;
    if (patch.dayHours  !== undefined) dbPatch.day_hours  = patch.dayHours; // null limpa o campo
    if (patch.name      !== undefined) dbPatch.name       = patch.name;
    if (patch.address   !== undefined) dbPatch.address    = patch.address;
    const { error } = await supabase.from("shops").update(dbPatch).eq("id", shop.id);
    if (error) { console.error("[fadein] updateShop:", error); return false; }
    // Atualiza estado local imediatamente (UI não precisa esperar reload)
    setShop(prev => prev ? { ...prev, ...patch } : prev);
    return true;
  }, [shop?.id]);

  // ── PERSISTÊNCIA local (services, clients, appts, txns vêm do Supabase) ──
  useEffect(() => {
    if (!shop || hydrated) return;
    setHydrated(true);
  }, [shop, hydrated]);

  // Tela de loading enquanto verifica sessão
  if (!authReady) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoadingScreen />
    </>
  );

  if (recoveryMode) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <ResetPassword onDone={() => setRecoveryMode(false)} />
    </>
  );

  if (!shop) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Login onLogin={() => {}} />
    </>
  );

  // Trial venceu (ou assinatura cancelada): toma a tela inteira, sem acesso ao app.
  if (isShopBlocked(shop)) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <TrialExpired shop={shop} onLogout={() => supabase.auth.signOut()} />
    </>
  );

  const todayCount = appts.filter(a => a.date === TODAY_DS).length;
  const pendingCount = appts.filter(a => a.date === TODAY_DS && a.status === "pending").length;

  return (
    <>
    <style>{GLOBAL_CSS}</style>
    <div className="app-shell" style={{
      background: C.bg, color: C.fg,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      fontSize: 14,
    }}>
      <aside className="app-sidebar" style={{ background: C.card }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid " + C.border }}>
          <Logo />
          <div style={{
            fontSize: 11, color: C.fgMuted, marginTop: 8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{shop.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
              background: shop.plan === "premium" ? C.goldDim : shop.plan === "pro" ? C.greenDim : C.amberDim,
              color:      shop.plan === "premium" ? C.goldBright : shop.plan === "pro" ? C.green : C.amber,
              textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0,
            }}>{
              // Starter não é "plano" pra exibir, é estado de trial.
              // Mostra "TRIAL" pra reforçar que precisa assinar.
              (PLANS[shop.plan] || PLANS.starter).trial ? "Trial" : (PLANS[shop.plan] || PLANS.starter).name
            }</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV.map(n => {
            const active = page === n.id;
            const badge = n.id === "agenda" ? todayCount : 0;
            const badgeColor = C.goldBright;
            // Mapeia item do menu pro feature do plano
            const featureKey = n.id === "financeiro" ? "financeiro"
                            : n.id === "comissoes"  ? "comissoes" : null;
            const locked = featureKey ? !hasFeature(shop.plan, featureKey) : false;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 14px", borderRadius: 8, border: "none", marginBottom: 2,
                background: active ? C.goldDim : "transparent",
                color: active ? C.goldBright : locked ? C.muted : C.fgMuted,
                fontSize: 13, fontWeight: active ? 600 : 500,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>
                <span style={{ display: "flex", alignItems: "center" }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {locked && (
                  <span title="Disponível no plano Pro" style={{ fontSize: 10, opacity: 0.7 }}>🔒</span>
                )}
                {badge > 0 && !locked && (
                  <span style={{
                    background: badgeColor, color: badgeColor === C.red ? "#fff" : "#1A1A1A",
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                    minWidth: 18, textAlign: "center",
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {pendingCount > 0 && (
          <div style={{ margin: "0 12px 12px", padding: 12, background: C.amberDim, border: "1px solid " + C.amber + "30", borderRadius: 8, fontSize: 11, color: C.amber, lineHeight: 1.4 }}>
            <b>{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</b> na agenda de hoje
          </div>
        )}

        <div style={{
          padding: "14px 18px", borderTop: "1px solid " + C.border,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: shop.color + "30", color: shop.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, flexShrink: 0,
            fontFamily: "Georgia, serif",
          }}>{shop.name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: C.fg,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{shop.name}</div>
            <div style={{ fontSize: 10, color: C.fgMuted }}>Administrador</div>
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Sair"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.fgMuted, padding: 4, display: "flex" }}>
            {Ic.logout}
          </button>
        </div>
      </aside>

      {/* Header mobile (visível só em telas pequenas) */}
      <div className="app-mobile-header">
        <Logo scale={0.85} />
        <button onClick={() => supabase.auth.signOut()} title="Sair"
          style={{ background: "none", border: "none", cursor: "pointer", color: C.fgMuted, padding: 6, display: "flex" }}>
          {Ic.logout}
        </button>
      </div>

      <main className="app-main">
        <InstallBanner />
        <TrialBanner shop={shop} />
        {page === "dashboard"  && <Dashboard  appts={appts} txns={txns} services={services} navigate={setPage} />}
        {page === "agenda"     && <Agenda     appts={appts} setAppts={setAppts} services={services} clients={clients} setClients={setClients} setTxns={setTxns} barbers={barbers} createAppt={createAppt} updateAppt={updateAppt} cancelAppt={cancelAppt} upsertClientFromAppt={upsertClientFromAppt} createTxn={createTxn} />}
        {page === "financeiro" && (hasFeature(shop.plan, "financeiro")
          ? <Financeiro txns={txns} setTxns={setTxns} navigate={setPage} createTxn={createTxn} deleteTxn={deleteTxn} />
          : <UpgradeView feature="financeiro" plan={shop.plan} navigate={setPage} shopId={shop.id} />)}
        {page === "comissoes"  && (hasFeature(shop.plan, "comissoes")
          ? <Comissoes txns={txns} appts={appts} services={services} setServices={setServices} barbers={barbers} />
          : <UpgradeView feature="comissoes" plan={shop.plan} navigate={setPage} shopId={shop.id} />)}
        {page === "clientes"   && <Clientes   clients={clients}   setClients={setClients}   appts={appts} navigate={setPage} barbers={barbers} createClient={createClient} updateClient={updateClient} deleteClient={deleteClient} />}
        {page === "link"       && <LinkAgendamento shop={shop} appts={appts} setAppts={setAppts} services={services} clients={clients} setClients={setClients} barbers={barbers} createAppt={createAppt} upsertClientFromAppt={upsertClientFromAppt} />}
        {page === "config"     && <Config     shop={shop} services={services} setServices={setServices} onLogout={() => supabase.auth.signOut()} barbers={barbers} addBarber={addBarber} updateBarber={updateBarber} deleteBarber={deleteBarber} createService={createService} updateService={updateService} deleteService={deleteService} updateShop={updateShop} />}
      </main>

      {/* Bottom navigation mobile (5 itens principais) */}
      <nav className="app-bottom-nav">
        {NAV.filter(n => ["dashboard","agenda","link","clientes","config"].includes(n.id)).map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} className={page === n.id ? "active" : ""}>
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </>
  );
}
