import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, X, MapPin, ArrowRight, Tag, Hash, Sparkles, Box, Check, Clock
} from 'lucide-react';
import {
  PRODUCT_SIZES, PRODUCT_CATEGORIES,
  type FloorArea, type DrawingElement, type RackSlot, type ProductSize
} from '../editor-model';
import type { PositionStockStatus } from '../zone-internal-positions';

export type SearchResult = {
  areaId: string;
  areaName: string;
  elementId: string;
  elementName: string;
  type: DrawingElement['type'];
  positionId?: string; // ID da posição interna específica
  positionCode?: string; // Código de identificação visível no mapa (ex: GEL-01, P-0001)
  address?: string;
  sku?: string;
  description?: string;
  status?: RackSlot['status'] | PositionStockStatus;
  productSize?: ProductSize;
  category?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPosition?: boolean;
};

type WMSSearchDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  areas: FloorArea[];
  activeAreaId: string;
  onNavigateToResult: (result: SearchResult) => void;
  isDark?: boolean;
};

const QUICK_TAGS = ['GEL', 'FOG', 'MIC', 'TV', 'COL', 'SOF', 'MÓV', 'RUA', 'DOCAS'];

export function WMSSearchDialog({
  isOpen,
  onClose,
  areas,
  activeAreaId,
  onNavigateToResult,
  isDark = true,
}: WMSSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'codes' | 'zones' | 'products'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery('');
      setFilterType('all');
    }
  }, [isOpen]);

  const allResults = useMemo(() => {
    const list: SearchResult[] = [];

    for (const area of areas) {
      for (const el of area.elements) {
        // 1. A própria Zona/Área
        list.push({
          areaId: area.id,
          areaName: area.name,
          elementId: el.id,
          elementName: el.name,
          type: el.type,
          positionCode: el.skuCode || el.street || el.name,
          productSize: el.productSize,
          category: el.category,
          sku: el.skuCode,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          isPosition: false,
        });

        // 2. Códigos das Posições Internas divididas na Zona
        if (el.internalPositions && el.internalPositions.length > 0) {
          for (const pos of el.internalPositions) {
            const relX = Number.isFinite(pos.relX) ? pos.relX : 0;
            const relY = Number.isFinite(pos.relY) ? pos.relY : 0;
            const relWidth = Number.isFinite(pos.relWidth) && pos.relWidth > 0 ? pos.relWidth : 25;
            const relHeight = Number.isFinite(pos.relHeight) && pos.relHeight > 0 ? pos.relHeight : 25;

            list.push({
              areaId: area.id,
              areaName: area.name,
              elementId: el.id,
              elementName: el.name,
              type: el.type,
              positionId: pos.id,
              positionCode: pos.code,
              address: `${el.name} · ${pos.code}`,
              sku: pos.sku,
              description: pos.description || pos.label,
              status: pos.status,
              productSize: pos.productSize || el.productSize,
              category: pos.category || el.category,
              x: el.x + relX,
              y: el.y + relY,
              width: relWidth,
              height: relHeight,
              isPosition: true,
            });
          }
        }

        // 3. Slots de Racks (se houver)
        if (el.type === 'rack' && el.slots) {
          for (const [, slot] of Object.entries(el.slots)) {
            list.push({
              areaId: area.id,
              areaName: area.name,
              elementId: el.id,
              elementName: el.name,
              type: 'rack',
              positionCode: slot.id,
              address: slot.id,
              sku: slot.sku,
              description: slot.description,
              status: slot.status,
              productSize: slot.productSize || el.productSize,
              category: slot.category || el.category,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              isPosition: true,
            });
          }
        }
      }
    }

    return list;
  }, [areas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return allResults
      .filter((item) => {
        // Filtros rápidos
        if (filterType === 'codes' && !item.positionCode) return false;
        if (filterType === 'zones' && item.isPosition) return false;
        if (filterType === 'products' && !item.sku && !item.description) return false;

        if (!q) return true;

        const matchCode = item.positionCode?.toLowerCase().includes(q);
        const matchName = item.elementName.toLowerCase().includes(q);
        const matchArea = item.areaName.toLowerCase().includes(q);
        const matchAddr = item.address?.toLowerCase().includes(q);
        const matchSku = item.sku?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);

        return matchCode || matchName || matchArea || matchAddr || matchSku || matchDesc || matchCat;
      })
      .slice(0, 40);
  }, [allResults, query, filterType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-5 sm:pt-12 p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-slate-950/95 border-orange-500/40 text-slate-100 shadow-orange-950/20'
            : 'bg-white border-slate-300 text-slate-900 shadow-xl'
        }`}
      >
        {/* Cabeçalho de Busca com Identidade Movare WMS */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/30 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/40">
                <Search className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-100 tracking-wide font-mono">
                MOVARE WMS · LOCALIZADOR INTELIGENTE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                ESC para fechar
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                title="Fechar (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Campo de Busca Ampliado com Lupa e Feedback */}
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-orange-500 absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código (ex: GEL-01, FOG-02), SKU, produto ou zona..."
              className="w-full pl-11 pr-9 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-sm font-semibold text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Atalhos Rápidos de Busca (Chips de Prefixo) */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-none text-[11px]">
            <span className="text-slate-400 text-[10px] font-mono mr-1 shrink-0">Populares:</span>
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(tag)}
                className={`px-2 py-0.5 rounded-md font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                  query.toUpperCase() === tag
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Abas de Categorização de Busca */}
        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950/60 border-b border-slate-800 overflow-x-auto scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Todos ({allResults.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('codes')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
              filterType === 'codes'
                ? 'bg-orange-600 text-white font-bold shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Hash className="w-3.5 h-3.5 text-orange-400" />
            <span>Códigos WMS</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('zones')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
              filterType === 'zones'
                ? 'bg-orange-600 text-white font-bold shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>Zonas & Galpões</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('products')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
              filterType === 'products'
                ? 'bg-orange-600 text-white font-bold shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>Com SKU / Estoque</span>
          </button>
        </div>

        {/* Lista de Resultados Otimizada */}
        <div className="flex-1 overflow-y-auto space-y-1.5 p-3 divide-y divide-slate-800/40">
          {filtered.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400 space-y-2">
              <Search className="w-10 h-10 text-slate-600 mx-auto opacity-40 animate-pulse" />
              <p className="font-bold text-slate-200 text-sm">Nenhum resultado para &quot;{query}&quot;</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tente buscar pelo prefixo (GEL, FOG, SOF), código individual da posição ou nome da zona.
              </p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isPos = Boolean(item.isPosition);
              const sizeObj = PRODUCT_SIZES.find((s) => s.id === item.productSize);
              const catObj = PRODUCT_CATEGORIES.find((c) => c.id === item.category);

              return (
                <button
                  key={`${item.elementId}-${item.positionId || item.positionCode || idx}`}
                  type="button"
                  onClick={() => {
                    onNavigateToResult(item);
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 transition-all group cursor-pointer ${
                    isDark
                      ? 'hover:bg-slate-900 hover:border-orange-500/50 bg-slate-950/40'
                      : 'hover:bg-slate-100 bg-white'
                  } border border-slate-800/60`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 sm:p-2.5 rounded-xl shrink-0 border shadow-xs ${
                        isPos
                          ? 'bg-orange-950/50 border-orange-500/40 text-orange-400'
                          : item.type === 'corridor'
                          ? 'bg-sky-950/50 border-sky-500/40 text-sky-300'
                          : 'bg-amber-950/50 border-amber-500/40 text-amber-400'
                      }`}
                    >
                      {isPos ? <Hash className="w-4 h-4" /> : item.type === 'corridor' ? <Tag className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Código de Identificação em Destaque */}
                        {item.positionCode ? (
                          <span className="font-mono text-xs font-bold text-orange-400 bg-orange-950/70 px-2 py-0.5 rounded-md border border-orange-500/40 shadow-xs">
                            {item.positionCode}
                          </span>
                        ) : null}

                        <span className="text-xs font-bold truncate text-slate-100">
                          {item.elementName}
                        </span>

                        {isPos ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono border border-slate-800">
                            CÉLULA
                          </span>
                        ) : item.type === 'corridor' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 font-mono border border-sky-800/50">
                            CORREDOR
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono border border-slate-800">
                            ZONA
                          </span>
                        )}

                        {item.status && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                              item.status === 'occupied'
                                ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                                : item.status === 'reserved'
                                ? 'bg-amber-950 border-amber-600 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {item.status === 'occupied' ? <Check className="w-2.5 h-2.5" /> : item.status === 'reserved' ? <Clock className="w-2.5 h-2.5" /> : null}
                            <span>{item.status === 'occupied' ? 'Ocupado' : item.status === 'reserved' ? 'Reservado' : 'Livre'}</span>
                          </span>
                        )}
                      </div>

                      {/* Informações detalhadas do endereço e produto */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                        <span className="text-slate-300 font-mono">📍 {item.areaName}</span>
                        {item.address && (
                          <span className="text-slate-400 truncate max-w-[200px]">
                            · {item.address}
                          </span>
                        )}
                        {catObj && (
                          <span className="text-[10px] text-orange-400 font-bold">
                            · {catObj.badge}
                          </span>
                        )}
                        {sizeObj && (
                          <span className="text-[10px] text-slate-400">
                            ({sizeObj.label})
                          </span>
                        )}
                        {item.sku && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-800/40">
                            SKU: {item.sku}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-slate-500 group-hover:text-orange-400 transition-colors">
                    <span className="hidden sm:inline text-xs font-semibold">Ir até</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-2.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>{filtered.length} itens encontrados</span>
          <span className="font-mono text-slate-500 text-[10px]">Pressione ESC para fechar</span>
        </div>
      </div>
    </div>
  );
}
