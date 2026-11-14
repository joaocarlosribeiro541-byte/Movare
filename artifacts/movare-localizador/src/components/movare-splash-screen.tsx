import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';

type MovareSplashScreenProps = {
  onFinished: () => void;
  isDark?: boolean;
};

type LoadingPhase = {
  threshold: number;
  label: string;
  shortLabel: string;
};

const LOADING_PHASES: LoadingPhase[] = [
  {
    threshold: 0,
    label: 'Inicializando identidade visual e malha CAD...',
    shortLabel: 'Identidade',
  },
  {
    threshold: 25,
    label: 'Calibrando plantas dos galpões e réguas métricas...',
    shortLabel: 'Plantas',
  },
  {
    threshold: 58,
    label: 'Mapeando zonas, módulos e posições de produtos...',
    shortLabel: 'Posições',
  },
  {
    threshold: 86,
    label: 'Sincronizando catálogo, estoques e reservas...',
    shortLabel: 'Catálogo',
  },
];

const TOTAL_PROGRESS_MS = 3550;
const HOLD_COMPLETE_MS = 320;
const FADE_OUT_MS = 480;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function MovareSplashScreen({ onFinished, isDark = true }: MovareSplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    let rafId = 0;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawRatio = Math.min(1, elapsed / TOTAL_PROGRESS_MS);
      const eased = easeOutCubic(rawRatio);
      const nextProgress = Math.min(100, Math.round(eased * 100));

      setProgress(nextProgress);

      if (rawRatio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        fadeTimer = setTimeout(() => {
          setIsFadingOut(true);
        }, HOLD_COMPLETE_MS);
        doneTimer = setTimeout(() => {
          onFinishedRef.current();
        }, HOLD_COMPLETE_MS + FADE_OUT_MS);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, []);

  const currentPhaseIndex = LOADING_PHASES.reduce((acc, phase, index) => {
    return progress >= phase.threshold ? index : acc;
  }, 0);
  const currentPhase = LOADING_PHASES[currentPhaseIndex] ?? LOADING_PHASES[0];

  const isCompleted = progress >= 100;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando sistema Movare"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none overflow-hidden transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      } ${isDark ? 'bg-[#070a10] text-slate-100' : 'bg-[#f6f5f0] text-slate-900'}`}
    >
      {/* Malha arquitetônica de galpão com máscara radial */}
      <div
        aria-hidden="true"
        className="movare-anim-grid absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)'
            : 'linear-gradient(to right, rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.055) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 18%, transparent 74%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 18%, transparent 74%)',
        }}
      />

      {/* Iluminação radial Movare Crimson atrás do emblema */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-[130px] transition-opacity duration-700 ${
            isDark ? 'bg-red-600/18 opacity-100' : 'bg-red-500/12 opacity-90'
          }`}
        />
      </div>

      {/* Eixos cartesianos discretos de calibragem CAD */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-px pointer-events-none ${
          isDark
            ? 'bg-gradient-to-r from-transparent via-red-500/20 to-transparent'
            : 'bg-gradient-to-r from-transparent via-red-600/15 to-transparent'
        }`}
      />
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px pointer-events-none ${
          isDark
            ? 'bg-gradient-to-b from-transparent via-red-500/15 to-transparent'
            : 'bg-gradient-to-b from-transparent via-red-600/10 to-transparent'
        }`}
      />

      {/* Conteúdo central */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[440px]">
        {/* Conjunto animado baseado diretamente no logotipo oficial MOVARE */}
        <div className="relative flex flex-col items-center mb-7">
          {/* Emblema 3D "M" com ondas geométricas derivadas da moldura do logotipo */}
          <div className="relative w-[176px] h-[134px] mb-3.5 flex items-center justify-center">
            {/* Ondas geométricas baseadas no contorno arredondado do emblema M */}
            <svg
              aria-hidden="true"
              viewBox="0 0 180 136"
              className="movare-anim-echo-1 absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            >
              <rect
                x="14"
                y="8"
                width="152"
                height="120"
                rx="22"
                fill="none"
                stroke="#ef4444"
                strokeOpacity={isDark ? '0.45' : '0.35'}
                strokeWidth="1.25"
              />
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 180 136"
              className="movare-anim-echo-2 absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            >
              <rect
                x="14"
                y="8"
                width="152"
                height="120"
                rx="22"
                fill="none"
                stroke="#dc2626"
                strokeOpacity={isDark ? '0.3' : '0.22'}
                strokeWidth="1"
              />
            </svg>

            {/* Mira técnica nos 4 cantos do emblema */}
            <span
              aria-hidden="true"
              className={`absolute -top-2 -left-2 w-3 h-3 border-t-[1.5px] border-l-[1.5px] transition-opacity duration-500 ${
                isDark ? 'border-red-400/60' : 'border-red-600/50'
              }`}
            />
            <span
              aria-hidden="true"
              className={`absolute -top-2 -right-2 w-3 h-3 border-t-[1.5px] border-r-[1.5px] transition-opacity duration-500 ${
                isDark ? 'border-red-400/60' : 'border-red-600/50'
              }`}
            />
            <span
              aria-hidden="true"
              className={`absolute -bottom-2 -left-2 w-3 h-3 border-b-[1.5px] border-l-[1.5px] transition-opacity duration-500 ${
                isDark ? 'border-red-400/60' : 'border-red-600/50'
              }`}
            />
            <span
              aria-hidden="true"
              className={`absolute -bottom-2 -right-2 w-3 h-3 border-b-[1.5px] border-r-[1.5px] transition-opacity duration-500 ${
                isDark ? 'border-red-400/60' : 'border-red-600/50'
              }`}
            />

            {/* SVG vetorial fiel ao "M" 3D extrudado do logotipo Movare */}
            <svg
              viewBox="0 0 180 136"
              className="relative w-full h-full drop-shadow-[0_18px_36px_rgba(220,38,38,0.22)]"
              role="img"
              aria-label="Emblema 3D Movare"
            >
              <defs>
                <linearGradient id="movare-m-front" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f4252d" />
                  <stop offset="55%" stopColor="#e31c24" />
                  <stop offset="100%" stopColor="#cc141b" />
                </linearGradient>
                <linearGradient id="movare-m-bevel-left" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d11920" />
                  <stop offset="100%" stopColor="#991318" />
                </linearGradient>
                <linearGradient id="movare-m-bevel-right" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#be161c" />
                  <stop offset="100%" stopColor="#851015" />
                </linearGradient>
                <linearGradient id="movare-sheen-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity="0.48" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="movare-scan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </linearGradient>
                <clipPath id="movare-tile-clip">
                  <rect x="14" y="8" width="152" height="120" rx="22" />
                </clipPath>
              </defs>

              {/* Base branca arquitetônica do emblema (como no logotipo oficial) */}
              <rect
                x="14"
                y="8"
                width="152"
                height="120"
                rx="22"
                fill="#ffffff"
                className="transition-opacity duration-700"
                style={{ opacity: progress >= 14 ? 1 : 0.12 }}
              />

              {/* Moldura externa desenhada em traçado contínuo */}
              <rect
                x="14"
                y="8"
                width="152"
                height="120"
                rx="22"
                fill="none"
                stroke="#18181b"
                strokeWidth="3.2"
                className="movare-anim-stroke"
                style={
                  {
                    '--dash-length': 540,
                    '--draw-duration': '0.9s',
                    '--draw-delay': '0.05s',
                  } as CSSProperties
                }
              />

              {/* Conteúdo interno recortado dentro da moldura arredondada */}
              <g clipPath="url(#movare-tile-clip)">
                {/* Wireframe CAD preliminar do "M" 3D */}
                <g opacity={progress >= 35 ? 0.25 : 0.9} className="transition-opacity duration-500">
                  <path
                    d="M 54 20 L 72 15 L 93 63 L 117 22 L 128 24 L 136 95 L 115 98 L 109 58 L 95 90 L 84 59 L 77 104 L 57 110 L 33 106 Z"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.35"
                    strokeLinejoin="round"
                    className="movare-anim-stroke"
                    style={
                      {
                        '--dash-length': 620,
                        '--draw-duration': '0.95s',
                        '--draw-delay': '0.18s',
                      } as CSSProperties
                    }
                  />
                </g>

                {/* Faceta 1: Parede lateral esquerda extrudada em 3D */}
                <path
                  d="M 54 20 L 72 15 L 57 110 L 33 106 Z"
                  fill="url(#movare-m-bevel-left)"
                  stroke="#ffffff"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  className="movare-anim-extrude-left"
                />

                {/* Faceta 2: Parede de profundidade interna do pilar direito */}
                <path
                  d="M 98 21 L 118 23 L 108 98 L 88 101 Z"
                  fill="url(#movare-m-bevel-right)"
                  stroke="#ffffff"
                  strokeWidth="1.35"
                  strokeLinejoin="round"
                  className="movare-anim-extrude-right"
                />

                {/* Faceta 3: Face frontal vibrante do "M" */}
                <path
                  d="M 72 15 L 93 63 L 117 22 L 128 24 L 136 95 L 115 98 L 109 58 L 95 90 L 84 59 L 77 104 L 57 110 Z"
                  fill="url(#movare-m-front)"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  className="movare-anim-face-pop"
                />

                {/* Reflexo especular diagonal cruzando as facetas 3D */}
                <rect
                  x="-30"
                  y="0"
                  width="56"
                  height="140"
                  fill="url(#movare-sheen-grad)"
                  className="movare-anim-sheen"
                />

                {/* Feixe de leitura espacial vertical */}
                <rect
                  x="14"
                  y="64"
                  width="152"
                  height="3"
                  fill="url(#movare-scan-grad)"
                  className="movare-anim-scan"
                />
              </g>
            </svg>
          </div>

          {/* Moldura horizontal MOVARE + Etiqueta "Móveis e eletros" fiel ao logotipo */}
          <div className="movare-anim-wordmark relative px-6 pt-2.5 pb-3.5 rounded-[18px] bg-white border-[2.5px] border-zinc-900 shadow-[0_14px_34px_rgba(0,0,0,0.28)]">
            <span
              className="block text-[2.05rem] sm:text-[2.25rem] font-extrabold leading-none tracking-[-0.03em] text-[#e31c24]"
              aria-label="MOVARE"
            >
              MOVARE
            </span>

            {/* Aba "Móveis e eletros" posicionada na base direita */}
            <div className="movare-anim-tag absolute -bottom-2.5 right-3 px-2.5 py-0.5 rounded-[5px] bg-zinc-900 border border-zinc-800 shadow-sm">
              <span className="block text-[11px] font-medium italic tracking-[0.01em] text-white whitespace-nowrap">
                Móveis e eletros
              </span>
            </div>
          </div>
        </div>

        {/* Título operacional limpo (sem pílulas ou tags decorativas) */}
        <div className="text-center space-y-1 mb-7 mt-2">
          <h1
            className={`text-base sm:text-lg font-bold tracking-tight ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            Localizador &amp; Gestão de Galpões
          </h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Mapeamento espacial, endereçamento e controle de reservas
          </p>
        </div>

        {/* Barra de progresso contínua a 60fps via transform: scaleX */}
        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span
              className={`font-medium truncate ${
                isCompleted
                  ? isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-700'
                  : isDark
                  ? 'text-slate-300'
                  : 'text-slate-700'
              }`}
            >
              {isCompleted ? 'Ambiente operacional pronto' : currentPhase.label}
            </span>
            <span
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
              className={`font-semibold tabular-nums shrink-0 ${
                isCompleted
                  ? isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-700'
                  : isDark
                  ? 'text-red-400'
                  : 'text-red-600'
              }`}
            >
              {progress}%
            </span>
          </div>

          {/* Trilha da barra */}
          <div
            className={`relative h-1.5 w-full rounded-full overflow-hidden ${
              isDark
                ? 'bg-slate-900 ring-1 ring-white/10'
                : 'bg-slate-200 ring-1 ring-slate-900/10'
            }`}
          >
            <div
              className={`h-full w-full origin-left will-change-transform rounded-full transition-colors duration-300 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-red-700 via-red-600 to-rose-500'
              }`}
              style={{
                transform: `scaleX(${Math.max(0.02, progress / 100)})`,
              }}
            />
          </div>

          {/* Indicador limpo das 4 fases reais de inicialização */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {LOADING_PHASES.map((phase, idx) => {
              const isDone = progress >= 100 || currentPhaseIndex > idx;
              const isActive = !isCompleted && currentPhaseIndex === idx;
              return (
                <div key={phase.shortLabel} className="space-y-1.5">
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors duration-300 ${
                      isDone
                        ? isDark
                          ? 'bg-emerald-400/80'
                          : 'bg-emerald-600/80'
                        : isActive
                        ? 'bg-red-500'
                        : isDark
                        ? 'bg-slate-800'
                        : 'bg-slate-300'
                    }`}
                  />
                  <div
                    className={`flex items-center gap-1 text-[10.5px] font-medium whitespace-nowrap truncate ${
                      isDone
                        ? isDark
                          ? 'text-slate-200'
                          : 'text-slate-800'
                        : isActive
                        ? isDark
                          ? 'text-red-400'
                          : 'text-red-600'
                        : isDark
                        ? 'text-slate-500'
                        : 'text-slate-500'
                    }`}
                  >
                    {isDone && <Check className="w-3 h-3 shrink-0 text-emerald-500" />}
                    <span className="truncate">{phase.shortLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
