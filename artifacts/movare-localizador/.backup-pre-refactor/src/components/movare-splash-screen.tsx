import { useEffect, useState } from 'react';
import { Warehouse, Sparkles, CheckCircle2 } from 'lucide-react';

type MovareSplashScreenProps = {
  onFinished: () => void;
  isDark?: boolean;
};

const LOADING_STAGES = [
  { progress: 14, text: 'Iniciando sistema Movare WMS & Localizador CAD...' },
  { progress: 32, text: 'Carregando layouts dos galpões e plantas de armazenagem...' },
  { progress: 54, text: 'Calibrando réguas métricas e física anti-sobreposição...' },
  { progress: 76, text: 'Mapeando ruas, módulos e posições internas de produtos...' },
  { progress: 92, text: 'Sincronizando banco de dados local e categorias...' },
  { progress: 100, text: 'Ambiente preparado com sucesso!' },
];

export function MovareSplashScreen({ onFinished, isDark = true }: MovareSplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Sequência lenta de carregamento (duração total ~3.4 segundos)
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => { setProgress(14); setStageIndex(0); }, 350));
    timers.push(setTimeout(() => { setProgress(32); setStageIndex(1); }, 1000));
    timers.push(setTimeout(() => { setProgress(54); setStageIndex(2); }, 1750));
    timers.push(setTimeout(() => { setProgress(76); setStageIndex(3); }, 2450));
    timers.push(setTimeout(() => { setProgress(92); setStageIndex(4); }, 3100));
    timers.push(setTimeout(() => { setProgress(100); setStageIndex(5); }, 3600));

    // Inicia o fade out suave
    timers.push(setTimeout(() => {
      setIsFadingOut(true);
    }, 4000));

    // Conclui e remove a splash screen
    timers.push(setTimeout(() => {
      onFinished();
    }, 4550));

    return () => timers.forEach(clearTimeout);
  }, [onFinished]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(onFinished, 200);
  };

  const currentStage = LOADING_STAGES[stageIndex] || LOADING_STAGES[0];

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${isDark ? 'bg-[#080d15] text-slate-100' : 'bg-slate-900 text-white'}`}
    >
      {/* Luz ambiente de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-red-600/10 rounded-full blur-[90px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
        {/* Logotipo Movare com Respiração & Halo de Destaque */}
        <div className="relative mb-6 group">
          <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 blur-xl opacity-80 group-hover:opacity-100 transition duration-700 animate-pulse" />
          <div className="relative p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl flex items-center justify-center">
            <img
              src="/movare-logo.png"
              alt="MOVARE Móveis e eletros"
              className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_4px_20px_rgba(249,115,22,0.35)] transition-transform duration-700 hover:scale-105"
            />
          </div>
        </div>

        {/* Título & Insígnia */}
        <div className="space-y-1.5 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-[11px] font-mono font-bold text-orange-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SISTEMA DE GESTÃO LOGÍSTICA & WMS</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            MOVARE <span className="text-orange-500">LOCALIZADOR</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Mapeamento espacial de galpões, porta-paletes e localização instantânea de produtos
          </p>
        </div>

        {/* Barra de Progresso Lenta com Porcentagem Real */}
        <div className="w-full space-y-2.5 mb-6">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-slate-400 flex items-center gap-1.5">
              {progress === 100 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Warehouse className="w-3.5 h-3.5 text-orange-400 animate-bounce" />
              )}
              <span>Carregamento</span>
            </span>
            <span className="text-orange-400">{progress}%</span>
          </div>

          {/* Barra de Progresso Tridimensional */}
          <div className="relative h-2.5 w-full bg-slate-950/80 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(249,115,22,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Mensagem da Etapa Atual */}
          <div className="h-6 flex items-center justify-center">
            <p className="text-[11.5px] text-slate-300 font-medium animate-fade-in font-mono">
              {currentStage.text}
            </p>
          </div>
        </div>

        {/* Botão Pular para acesso rápido */}
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-slate-500 hover:text-slate-300 font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-900/60 transition-all cursor-pointer"
        >
          Pular introdução ➔
        </button>
      </div>

      {/* Rodapé discreto de versão */}
      <div className="absolute bottom-4 text-center text-[10px] font-mono text-slate-600">
        MOVARE WMS · ENGINE CAD INDUSTRIAL v2.4 · ALTA PRECISÃO
      </div>
    </div>
  );
}
