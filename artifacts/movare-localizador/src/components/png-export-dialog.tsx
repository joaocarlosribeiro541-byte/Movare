import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Camera, Download, Copy, Check, FileImage, Layers,
  Grid, Maximize2, Sparkles, Loader2, Info, Compass, Shield
} from 'lucide-react';
import type { FloorArea } from '../editor-model';
import {
  type ExportScope,
  type ExportTheme,
  type ExportResolution,
  type ExportOptions,
  formatExportFileName,
  calculateExportDimensions,
  renderWarehouseToCanvas,
  copyCanvasToClipboard,
  downloadBlob,
} from '../export-png';

interface PngExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  area: FloorArea;
  bounds: { widthMeters: number; heightMeters: number };
  scaleRatio: number;
  camera: { x: number; y: number; scale: number };
  canvasSize: { width: number; height: number };
  isDark?: boolean;
}

export function PngExportDialog({
  isOpen,
  onClose,
  area,
  bounds,
  scaleRatio,
  camera,
  canvasSize,
  isDark = true,
}: PngExportDialogProps) {
  const [scope, setScope] = useState<ExportScope>('full');
  const [theme, setTheme] = useState<ExportTheme>(isDark ? 'dark' : 'light');
  const [scaleFactor, setScaleFactor] = useState<ExportResolution>(2);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeGrid, setIncludeGrid] = useState(true);
  const [includeTitleBlock, setIncludeTitleBlock] = useState(true);
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [includeProductCodes, setIncludeProductCodes] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const currentOptions: ExportOptions = {
    scope,
    theme,
    scaleFactor,
    includeLegend,
    includeGrid,
    includeTitleBlock,
    includeWatermark,
    includeProductCodes,
    camera,
    canvasSize,
  };

  const worldWidth = bounds.widthMeters * scaleRatio;
  const worldHeight = bounds.heightMeters * scaleRatio;
  const dimensions = calculateExportDimensions(worldWidth, worldHeight, currentOptions);

  // Gera pré-visualização reduzida em tempo real
  const updatePreview = useCallback(async () => {
    if (!isOpen) return;
    try {
      const previewOpts: ExportOptions = {
        ...currentOptions,
        scaleFactor: 1, // Pré-visualização rápida em 1x
      };
      const canvas = await renderWarehouseToCanvas(area, bounds, scaleRatio, previewOpts);
      setPreviewDataUrl(canvas.toDataURL('image/png', 0.85));
    } catch (err) {
      console.warn('Erro ao gerar preview da exportação:', err);
    }
  }, [isOpen, scope, theme, includeLegend, includeGrid, includeTitleBlock, includeWatermark, includeProductCodes, area, bounds, scaleRatio, camera, canvasSize]);

  useEffect(() => {
    if (isOpen) {
      updatePreview();
    } else {
      setPreviewDataUrl(null);
      setCopied(false);
      setCopyError(null);
    }
  }, [isOpen, updatePreview]);

  if (!isOpen) return null;

  // Executa o download em alta resolução
  const handleDownload = async () => {
    setIsGenerating(true);
    setCopyError(null);
    try {
      // Pequeno timeout para permitir que o indicador de carregamento renderize
      await new Promise((r) => setTimeout(r, 40));
      const canvas = await renderWarehouseToCanvas(area, bounds, scaleRatio, currentOptions);
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Falha ao processar imagem PNG');
        const filename = formatExportFileName(area.name, 'png', includeProductCodes);
        downloadBlob(blob, filename);
        setIsGenerating(false);
        onClose();
      }, 'image/png');
    } catch (err) {
      console.error('Erro na exportação PNG:', err);
      setIsGenerating(false);
    }
  };

  // Copia a imagem PNG diretamente para a área de transferência
  const handleCopy = async () => {
    setIsGenerating(true);
    setCopyError(null);
    try {
      await new Promise((r) => setTimeout(r, 40));
      const canvas = await renderWarehouseToCanvas(area, bounds, scaleRatio, currentOptions);
      await copyCanvasToClipboard(canvas);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err: any) {
      console.error('Erro ao copiar imagem:', err);
      setCopyError(err?.message || 'Seu navegador não autorizou a cópia direta de imagens.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resolutions: { value: ExportResolution; label: string; desc: string }[] = [
    { value: 1, label: '1x · Padrão', desc: '72 DPI · Leve para WhatsApp' },
    { value: 2, label: '2x · HD', desc: '150 DPI · Relatórios & Apresentações' },
    { value: 3, label: '3x · Ultra HD', desc: '300 DPI · Impressão Profissional' },
    { value: 4, label: '4x · Máxima', desc: '600 DPI · Plotter & Arquitetura' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none overflow-y-auto">
      <div
        className={`w-full max-w-3xl my-auto rounded-2xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/50'
        }`}
      >
        {/* CABEÇALHO */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Exportar Imagem PNG em Alta Resolução</h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  v4.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gere cópias nítidas da planta baixa para WhatsApp, apresentações e documentação técnica
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO MODAL (DUAS COLUNAS EM TELAS MÉDIAS/GRANDES) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* COLUNA ESQUERDA: OPÇÕES DE CONFIGURAÇÃO (7 COLS) */}
          <div className="md:col-span-7 space-y-4.5">
            {/* 1. ESCOPO DA IMAGEM */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                1. Enquadramento da Imagem
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('full')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    scope === 'full'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/50'
                      : isDark
                      ? 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                    Planta Completa
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Todo o galpão de 0 a 100%, cotas métricas e legenda lateral
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('viewport')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    scope === 'viewport'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/50'
                      : isDark
                      ? 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    Visão Atual (Tela)
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Exatamente o que está enquadrado na mira atual da câmera
                  </p>
                </button>
              </div>
            </div>

            {/* 2. RESOLUÇÃO / NITIDEZ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Resolução & Nitidez (DPI)
                </label>
                <span className="text-[11px] font-mono text-orange-400 font-bold">
                  {dimensions.pixelWidth} × {dimensions.pixelHeight} px ({dimensions.dpi} DPI)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {resolutions.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setScaleFactor(r.value)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      scaleFactor === r.value
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/50 font-bold'
                        : isDark
                        ? 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs">{r.label}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate">{r.desc.split('·')[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. TEMA / FUNDO DA IMAGEM */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                3. Estilo de Fundo
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dark', label: 'Dark Blueprint', desc: 'Contraste CAD escuro' },
                  { id: 'light', label: 'Light / Papel', desc: 'Impressão em A4/A3' },
                  { id: 'transparent', label: 'Transparente', desc: 'Sem cor de fundo' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id as ExportTheme)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === t.id
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/50 font-bold'
                        : isDark
                        ? 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs truncate">{t.label}</div>
                    <div className="text-[9.5px] text-slate-400 mt-0.5 truncate">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. ELEMENTOS INCLUSOS */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                4. Informações & Detalhamentos Inclusos
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeTitleBlock}
                    onChange={(e) => setIncludeTitleBlock(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-500"
                  />
                  <div>
                    <span className="font-semibold block">Selo / Carimbo Técnico</span>
                    <span className="text-[10px] text-slate-400">Título, galpão, dimensões e data</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeLegend}
                    onChange={(e) => setIncludeLegend(e.target.checked)}
                    disabled={scope === 'viewport'}
                    className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-500 disabled:opacity-40"
                  />
                  <div>
                    <span className="font-semibold block">Legenda Cartográfica</span>
                    <span className="text-[10px] text-slate-400">Convenções e zonas ao lado</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeGrid}
                    onChange={(e) => setIncludeGrid(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-500"
                  />
                  <div>
                    <span className="font-semibold block">Grade Métrica CAD</span>
                    <span className="text-[10px] text-slate-400">Malha métrica de 1m e 5m</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeWatermark}
                    onChange={(e) => setIncludeWatermark(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-500"
                  />
                  <div>
                    <span className="font-semibold block">Marca d'água Movare</span>
                    <span className="text-[10px] text-slate-400">Logotipo sutil no centro</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors sm:col-span-2 ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={includeProductCodes}
                    onChange={(e) => setIncludeProductCodes(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer accent-orange-500"
                  />
                  <div>
                    <span className="font-semibold block">Códigos dos Produtos & Posições</span>
                    <span className="text-[10px] text-slate-400">
                      Desmarque para exportar a planta limpa sem códigos WMS ou SKUs nas células
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: PRÉVIA VISUAL & METADADOS (5 COLS) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pré-visualização
                </label>
                <span className="text-[10px] text-slate-400">Amostra em escala</span>
              </div>

              {/* MOLDURA DA PRÉVIA */}
              <div
                className={`w-full aspect-[4/3] rounded-xl border overflow-hidden flex items-center justify-center relative p-1.5 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Pré-visualização da Planta"
                    className="max-w-full max-h-full object-contain rounded drop-shadow-md select-none"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    <span className="text-[11px]">Gerando prévia...</span>
                  </div>
                )}
              </div>

              {/* CARD DE DETALHES TÉCNICOS */}
              <div
                className={`mt-3 p-3 rounded-xl border text-xs space-y-1.5 ${
                  isDark ? 'bg-slate-950/60 border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex justify-between">
                  <span className="text-slate-400">Galpão:</span>
                  <span className="font-semibold truncate max-w-[150px]">{area.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dimensões Reais:</span>
                  <span className="font-mono font-semibold">{bounds.widthMeters}m × {bounds.heightMeters}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tamanho da Imagem:</span>
                  <span className="font-mono text-orange-400 font-bold">
                    {dimensions.pixelWidth} × {dimensions.pixelHeight} px
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Resolução Estimada:</span>
                  <span className="font-mono">{dimensions.dpi} DPI (Escala {scaleFactor}x)</span>
                </div>
              </div>
            </div>

            {/* MENSAGEM DE ERRO NA CÓPIA SE HOUVER */}
            {copyError && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{copyError}</span>
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ COM BOTÕES DE AÇÃO */}
        <div
          className={`px-5 py-3.5 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>Arquivo PNG universal de alta densidade sem perda de vetores.</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancelar
            </button>

            {/* BOTÃO COPIAR PARA ÁREA DE TRANSFERÊNCIA */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={isGenerating}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                copied
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                  : isDark
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
              title="Copiar imagem PNG para colar direto no WhatsApp, Slack ou Word"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Imagem</span>
                </>
              )}
            </button>

            {/* BOTÃO BAIXAR ARQUIVO PNG DE ALTA RESOLUÇÃO */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Renderizando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Imagem PNG</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
