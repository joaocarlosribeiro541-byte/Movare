import { useState, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import {
  Search, X, MapPin, Tag, Box, ArrowRight, CornerDownLeft,
  Maximize2, Plus, Download, Upload, Layers, Sun, Moon,
  Ruler, HelpCircle, Sparkles, Check, Hash
} from 'lucide-react';
import {
  PRODUCT_SIZES, PRODUCT_CATEGORIES,
  type FloorArea, type DrawingElement, type ProductSize
} from '../editor-model';
import type { PositionStockStatus } from '../zone-internal-positions';

export type SpotlightCommandAction =
  | 'new_warehouse'
  | 'resize_warehouse'
  | 'export_backup'
  | 'import_backup'
  | 'toggle_theme'
  | 'open_layers'
  | 'open_calibration'
  | 'open_shortcuts'
  | 'fit_plan'
  | 'mode_select'
  | 'mode_move'
  | 'mode_pan'
  | 'mode_zone'
  | 'mode_corridor'
  | 'mode_measure'
  | 'export_png';

export type SpotlightItem = {
  id: string;
  kind: 'zone' | 'position' | 'action';
  title: string;
  subtitle: string;
  badge?: string;
  iconType: 'zone' | 'position' | 'action';
  // Dados de navegação espacial
  areaId?: string;
  areaName?: string;
  elementId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  positionCode?: string;
  sku?: string;
  actionId?: SpotlightCommandAction;
};

type SpotlightPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  areas: FloorArea[];
  activeAreaId: string;
  isDark: boolean;
  onNavigateToPosition: (areaId: string, elementId: string, x: number, y: number, name: string, code?: string) => void;
  onExecuteAction: (action: SpotlightCommandAction) => void;
};

const SYSTEM_ACTIONS: Array<{
  actionId: SpotlightCommandAction;
  title: string;
  subtitle: string;
  badge: string;
  keywords: string;
}> = [
  {
    actionId: 'new_warehouse',
    title: 'Adicionar Novo Galpão',
    subtitle: 'Criar uma nova área de armazenamento no projeto',
    badge: 'Galpão',
    keywords: 'novo galpao adicionar criar planta area armazem',
  },
  {
    actionId: 'resize_warehouse',
    title: 'Redimensionar Armazém',
    subtitle: 'Alterar largura e comprimento do galpão em metros',
    badge: 'Tamanho',
    keywords: 'redimensionar tamanho metros dimensoes escala proporcao barracao',
  },
  {
    actionId: 'fit_plan',
    title: 'Encaixar Planta na Tela (Fit)',
    subtitle: 'Centralizar e ajustar o zoom da câmera ao galpão',
    badge: 'Câmera',
    keywords: 'fit centralizar encaixar zoom redefinir camera ver tudo',
  },
  {
    actionId: 'open_layers',
    title: 'Gerenciador de Camadas & Visibilidade',
    subtitle: 'Ocultar ou destacar zonas por setor ou categoria',
    badge: 'Camadas',
    keywords: 'camadas layers visibilidade filtros ocultar mostrar setores',
  },
  {
    actionId: 'toggle_theme',
    title: 'Alternar Tema Claro / Escuro',
    subtitle: 'Mudar entre visual escuro técnico e claro corporativo',
    badge: 'Tema',
    keywords: 'tema dark light modo escuro modo claro cores aparencia',
  },
  {
    actionId: 'export_png',
    title: 'Exportar Imagem PNG em Alta Resolução',
    subtitle: 'Gerar planta baixa do galpão para relatórios, WhatsApp e documentação',
    badge: 'Exportar',
    keywords: 'exportar png imagem foto print alta resolucao planta relatorio whatsapp documento pdf',
  },
  {
    actionId: 'export_backup',
    title: 'Exportar Backup JSON',
    subtitle: 'Salvar arquivo de backup completo com todas as plantas',
    badge: 'Backup',
    keywords: 'exportar backup salvar download json dados arquivo',
  },
  {
    actionId: 'import_backup',
    title: 'Importar Backup JSON',
    subtitle: 'Restaurar layout de armazém a partir de arquivo JSON',
    badge: 'Backup',
    keywords: 'importar backup restaurar upload carregar json',
  },
  {
    actionId: 'open_calibration',
    title: 'Calibrar Escala do Armazém',
    subtitle: 'Definir proporção exata de pixels por metro',
    badge: 'Escala',
    keywords: 'calibrar escala precisao pixels metro proporcao cad',
  },
  {
    actionId: 'open_shortcuts',
    title: 'Guia de Atalhos de Teclado',
    subtitle: 'Ver comandos rápidos de desenho, seleção e CAD',
    badge: 'Ajuda',
    keywords: 'atalhos teclado teclas comandos help ajuda hotkeys',
  },
  {
    actionId: 'mode_measure',
    title: 'Fita Métrica CAD',
    subtitle: 'Medir distâncias reais em metros entre dois pontos',
    badge: 'Ferramenta',
    keywords: 'fita metrica medir distancia t ruler trena cad',
  },
  {
    actionId: 'mode_zone',
    title: 'Desenhar Nova Zona de Armazenagem',
    subtitle: 'Criar um bloco ou área retangular no armazém',
    badge: 'Desenho',
    keywords: 'desenhar nova zona bloco retangulo area r',
  },
  {
    actionId: 'mode_corridor',
    title: 'Criar Identificador de Corredor / Rua',
    subtitle: 'Inserir nome ou código de corredor logístico',
    badge: 'WMS',
    keywords: 'corredor rua etiqueta texto c tag',
  },
];

export function SpotlightPalette({
  isOpen,
  onClose,
  areas,
  activeAreaId,
  isDark,
  onNavigateToPosition,
  onExecuteAction,
}: SpotlightPaletteProps) {
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'zones' | 'positions' | 'actions'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setFilterTab('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Indexação de todos os itens buscáveis
  const items = useMemo(() => {
    const list: SpotlightItem[] = [];

    // 1. Zonas e Corredores das Áreas
    for (const area of areas) {
      for (const el of area.elements) {
        if (el.type === 'corridor') {
          list.push({
            id: `corridor-${el.id}`,
            kind: 'zone',
            title: el.corridorText || el.name || 'Corredor',
            subtitle: `${area.name} · Rua / Corredor de Trânsito`,
            badge: 'Corredor',
            iconType: 'zone',
            areaId: area.id,
            areaName: area.name,
            elementId: el.id,
            x: el.x + el.width / 2,
            y: el.y + el.height / 2,
            width: el.width,
            height: el.height,
            positionCode: el.corridorText || el.name,
          });
          continue;
        }

        if (el.type === 'divider') {
          continue; // Paredes simples não precisam de busca direta
        }

        const sizeDef = PRODUCT_SIZES.find((s) => s.id === el.productSize);
        const catDef = PRODUCT_CATEGORIES.find((c) => c.id === el.category);
        const zoneBadge = sizeDef?.short || catDef?.label || 'Zona';

        list.push({
          id: `zone-${el.id}`,
          kind: 'zone',
          title: el.name,
          subtitle: `${area.name} · ${catDef?.label || 'Geral'} · ${Math.round(el.width / (area.scaleRatio || 15))}×${Math.round(el.height / (area.scaleRatio || 15))}m`,
          badge: zoneBadge,
          iconType: 'zone',
          areaId: area.id,
          areaName: area.name,
          elementId: el.id,
          x: el.x + el.width / 2,
          y: el.y + el.height / 2,
          width: el.width,
          height: el.height,
          sku: el.skuCode,
          positionCode: el.skuCode || el.name,
        });

        // 2. Posições internas detalhadas (SKUs e endereços)
        if (el.internalPositions && el.internalPositions.length > 0) {
          for (const pos of el.internalPositions) {
            const relX = Number.isFinite(pos.relX) ? pos.relX : 0;
            const relY = Number.isFinite(pos.relY) ? pos.relY : 0;
            const relWidth = Number.isFinite(pos.relWidth) && pos.relWidth > 0 ? pos.relWidth : 25;
            const relHeight = Number.isFinite(pos.relHeight) && pos.relHeight > 0 ? pos.relHeight : 25;

            const posX = el.x + relX + relWidth / 2;
            const posY = el.y + relY + relHeight / 2;

            const posCode = pos.code || `P-${pos.shelfIndex ?? 1}-${pos.cellIndex ?? 1}`;
            const skuText = pos.sku || el.skuCode;
            const statusLabel = pos.status === 'occupied' ? 'Ocupado' : pos.status === 'reserved' ? 'Reservado' : 'Disponível';

            list.push({
              id: `pos-${el.id}-${pos.id}`,
              kind: 'position',
              title: `${posCode} ${skuText ? `· ${skuText}` : ''}`,
              subtitle: `${area.name} · ${el.name} · ${statusLabel} ${pos.quantity ? `(${pos.quantity} un)` : ''}`,
              badge: posCode,
              iconType: 'position',
              areaId: area.id,
              areaName: area.name,
              elementId: el.id,
              x: posX,
              y: posY,
              width: relWidth,
              height: relHeight,
              positionCode: posCode,
              sku: skuText,
            });
          }
        }
      }
    }

    // 3. Ações do Sistema
    for (const act of SYSTEM_ACTIONS) {
      list.push({
        id: `act-${act.actionId}`,
        kind: 'action',
        title: act.title,
        subtitle: act.subtitle,
        badge: act.badge,
        iconType: 'action',
        actionId: act.actionId,
      });
    }

    return list;
  }, [areas]);

  // Filtragem fuzzy
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      // Filtro de aba
      if (filterTab === 'zones' && item.kind !== 'zone') return false;
      if (filterTab === 'positions' && item.kind !== 'position') return false;
      if (filterTab === 'actions' && item.kind !== 'action') return false;

      if (!q) return true;

      // Busca por título, subtítulo, badge ou SKU
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSubtitle = item.subtitle.toLowerCase().includes(q);
      const matchBadge = item.badge?.toLowerCase().includes(q);
      const matchSku = item.sku?.toLowerCase().includes(q);
      const matchCode = item.positionCode?.toLowerCase().includes(q);

      if (item.kind === 'action' && item.actionId) {
        const actDef = SYSTEM_ACTIONS.find((a) => a.actionId === item.actionId);
        if (actDef?.keywords.toLowerCase().includes(q)) return true;
      }

      return matchTitle || matchSubtitle || matchBadge || matchSku || matchCode;
    });
  }, [items, query, filterTab]);

  // Limitar resultados para fluidez extrema
  const displayedItems = useMemo(() => filteredItems.slice(0, 40), [filteredItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filterTab]);

  // Scroll automático do item selecionado na lista
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: SpotlightItem) => {
    if (item.kind === 'action' && item.actionId) {
      onExecuteAction(item.actionId);
      onClose();
    } else if ((item.kind === 'zone' || item.kind === 'position') && item.areaId && item.elementId && item.x !== undefined && item.y !== undefined) {
      onNavigateToPosition(item.areaId, item.elementId, item.x, item.y, item.title, item.positionCode);
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < displayedItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, displayedItems.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = displayedItems[selectedIndex];
      if (current) {
        handleSelect(current);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-150 ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-slate-950/90'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-400/30'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* BARRA DE ENTRADA / INPUT DO SPOTLIGHT */}
        <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <Search className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar zona, rua, SKU, posição ou comando..."
            className="flex-1 bg-transparent border-0 text-sm sm:text-base font-medium placeholder:text-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-400">
              ESC para sair
            </span>
          )}
        </div>

        {/* ABAS / FILTROS RÁPIDOS */}
        <div className={`flex items-center gap-1 px-4 py-2 border-b overflow-x-auto text-xs ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'}`}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
              filterTab === 'all'
                ? 'bg-orange-500 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({filteredItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('zones')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
              filterTab === 'zones'
                ? 'bg-orange-500 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Zonas & Ruas
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('positions')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
              filterTab === 'positions'
                ? 'bg-orange-500 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Posições & SKUs
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('actions')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
              filterTab === 'actions'
                ? 'bg-orange-500 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Comandos do Sistema
          </button>
        </div>

        {/* LISTA DE RESULTADOS */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2 divide-y divide-transparent">
          {displayedItems.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Nenhum resultado encontrado para &quot;{query}&quot;</p>
              <p className="text-xs text-slate-500 mt-1">Tente pesquisar por código de rua, nome de bloco, SKU ou comando.</p>
            </div>
          ) : (
            displayedItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-orange-500/20 border border-orange-500/50 text-white'
                        : 'bg-orange-50 border border-orange-300 text-slate-900'
                      : isDark
                      ? 'hover:bg-slate-800/60 text-slate-200'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.kind === 'action'
                          ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
                          : item.kind === 'position'
                          ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                          : isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {item.kind === 'action' ? (
                        <Sparkles className="w-4 h-4" />
                      ) : item.kind === 'position' ? (
                        <Tag className="w-4 h-4" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-300'
                                : 'bg-slate-200 border-slate-300 text-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-orange-400">
                        <span>Executar</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    )}
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-slate-500'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ DO SPOTLIGHT COM ATALHOS ÚTEIS */}
        <div className={`px-4 py-2 border-t flex items-center justify-between text-[11px] text-slate-400 ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">↓</kbd>
              <span>Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">ENTER</kbd>
              <span>Selecionar</span>
            </span>
          </div>
          <span className="text-slate-500 hidden sm:inline">Movare Localizador 3.0</span>
        </div>
      </div>
    </div>
  );
}
