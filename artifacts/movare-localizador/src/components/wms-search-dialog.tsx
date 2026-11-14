import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  MapPin,
  ArrowRight,
  Tag,
  Hash,
  Check,
  BookmarkCheck,
  Filter,
} from 'lucide-react';
import {
  PRODUCT_SIZES,
  PRODUCT_CATEGORIES,
  type FloorArea,
  type DrawingElement,
  type RackSlot,
  type ProductSize,
} from '../editor-model';
import type { PositionStockStatus } from '../zone-internal-positions';
import { buildSearchCatalog, filterSearchCatalog } from '../wms-operations';

export type SearchResult = {
  areaId: string;
  areaName: string;
  elementId: string;
  elementName: string;
  type: DrawingElement['type'];
  positionId?: string;
  positionCode?: string;
  address?: string;
  sku?: string;
  description?: string;
  model?: string;
  supplier?: string;
  volumesPerItem?: number;
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
  initialFilterType?: 'all' | 'codes' | 'zones' | 'products' | 'reserved';
};

const QUICK_TAGS = ['GEL', 'FOG', 'MIC', 'TV', 'COL', 'SOF', 'MOV', 'RUA'];

export function WMSSearchDialog({
  isOpen,
  onClose,
  areas,
  onNavigateToResult,
  isDark = true,
  initialFilterType = 'all',
}: WMSSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'codes' | 'zones' | 'products' | 'reserved'>(
    initialFilterType
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFilterType(initialFilterType);
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery('');
      setFilterType('all');
      setSelectedCategory('all');
    }
  }, [isOpen, initialFilterType]);

  const catalog = useMemo(() => buildSearchCatalog(areas), [areas]);

  const reservedCount = useMemo(
    () => catalog.filter((item) => item.status === 'reserved').length,
    [catalog]
  );

  const filtered = useMemo(
    () =>
      filterSearchCatalog(catalog, {
        query,
        filterType,
        category: selectedCategory,
        onlyPositionsFirst: filterType === 'products' || filterType === 'reserved',
        limit: 50,
      }),
    [catalog, query, filterType, selectedCategory]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-10 p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-slate-950/95 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-500/25'
        }`}
      >
        {/* Cabeçalho moderno WMS */}
        <div
          className={`p-4 border-b ${
            isDark
              ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/30 border-slate-800'
              : 'bg-gradient-to-r from-slate-50 via-white to-orange-50/60 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/30">
                <Search className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold tracking-wide block">
                  Localizador Rápido WMS
                </span>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Busque por código, SKU, modelo, fornecedor ou zona
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`hidden sm:inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${
                  isDark
                    ? 'bg-slate-900 text-slate-400 border-slate-800'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                ESC
              </span>
              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                }`}
                title="Fechar (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Campo de Busca Principal + Filtro de Categoria */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-orange-500 absolute left-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: GEL-01, SKU, Brastemp, Modelo, Rua A..."
                className={`w-full pl-10 pr-9 py-2.5 rounded-xl border text-sm font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700/80 text-slate-100 placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-orange-500 transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-2 sm:py-0 rounded-xl border text-xs ${
                isDark
                  ? 'bg-slate-900 border-slate-700/80 text-slate-200'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <select
                aria-label="Filtrar por categoria"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer max-w-[160px]"
              >
                <option value="all" className={isDark ? 'bg-slate-900' : 'bg-white'}>
                  Todas categorias
                </option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-none text-[11px]">
            <span className={`text-[10px] font-mono mr-1 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Atalhos:
            </span>
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(tag)}
                className={`px-2 py-0.5 rounded-md font-mono font-semibold transition-all shrink-0 cursor-pointer border ${
                  query.toUpperCase() === tag
                    ? 'bg-orange-600 text-white border-orange-500'
                    : isDark
                    ? 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Abas de Categorização */}
        <div
          className={`flex items-center gap-1.5 px-3.5 py-2 border-b overflow-x-auto scrollbar-none text-xs ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {(
            [
              { id: 'all', label: `Todos (${catalog.length})` },
              { id: 'products', label: 'Produtos / SKUs' },
              { id: 'reserved', label: `Reservados (${reservedCount})`, highlightYellow: true },
              { id: 'codes', label: 'Códigos' },
              { id: 'zones', label: 'Zonas & Ruas' },
            ] as const
          ).map((tab) => {
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? tab.id === 'reserved'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-orange-600 text-white font-bold shadow-xs'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.id === 'reserved' && <BookmarkCheck className="w-3.5 h-3.5" />}
                {tab.id === 'codes' && <Hash className="w-3.5 h-3.5 text-orange-400" />}
                {tab.id === 'zones' && <MapPin className="w-3.5 h-3.5 text-sky-400" />}
                {tab.id === 'products' && <Tag className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto space-y-1.5 p-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <Search className="w-9 h-9 text-slate-500 mx-auto opacity-40" />
              <p className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Nenhum item encontrado {query ? `para "${query}"` : ''}
              </p>
              <p className="text-xs max-w-sm mx-auto opacity-80">
                Ajuste o filtro ou busque pelo código da posição, SKU, modelo ou fornecedor.
              </p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isPos = item.isPosition;
              const isReserved = item.status === 'reserved';
              const sizeObj = PRODUCT_SIZES.find((s) => s.id === item.productSize);
              const catObj = PRODUCT_CATEGORIES.find((c) => c.id === item.category);

              return (
                <button
                  key={`${item.elementId}-${item.positionId || item.positionCode || idx}`}
                  type="button"
                  onClick={() => {
                    onNavigateToResult({
                      ...item,
                      isPosition: item.isPosition,
                    });
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 transition-all group cursor-pointer border ${
                    isReserved
                      ? isDark
                        ? 'bg-amber-950/20 border-amber-500/45 hover:border-amber-400'
                        : 'bg-amber-50/70 border-amber-300 hover:border-amber-500'
                      : isDark
                      ? 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 hover:border-orange-500/50'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-orange-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 border ${
                        isReserved
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                          : isPos
                          ? 'bg-orange-500/15 border-orange-500/35 text-orange-400'
                          : item.type === 'corridor'
                          ? 'bg-sky-500/15 border-sky-500/35 text-sky-400'
                          : 'bg-slate-500/15 border-slate-500/30 text-slate-400'
                      }`}
                    >
                      {isReserved ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : isPos ? (
                        <Hash className="w-4 h-4" />
                      ) : item.type === 'corridor' ? (
                        <Tag className="w-4 h-4" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.positionCode && (
                          <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/30">
                            {item.positionCode}
                          </span>
                        )}

                        <span className="text-xs font-bold truncate">
                          {item.productName || item.elementName}
                        </span>

                        {isReserved ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-400 inline-flex items-center gap-1">
                            <BookmarkCheck className="w-2.5 h-2.5" />
                            <span>RESERVADO</span>
                          </span>
                        ) : item.status === 'occupied' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 inline-flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            <span>OCUPADO</span>
                          </span>
                        ) : null}
                      </div>

                      <div className={`flex items-center gap-2 text-[11px] mt-1 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        <span className="font-medium">
                          {item.areaName} · {item.elementName}
                        </span>
                        {item.sku && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/25">
                            SKU: {item.sku}
                          </span>
                        )}
                        {item.supplier && (
                          <span className="text-[10px] opacity-85">· {item.supplier}</span>
                        )}
                        {catObj && (
                          <span className="text-[10px] text-orange-400 font-semibold">· {catObj.badge}</span>
                        )}
                        {sizeObj && (
                          <span className="text-[10px] opacity-75">({sizeObj.short})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400 group-hover:text-orange-400 transition-colors">
                    <span className="hidden sm:inline text-xs font-semibold">Localizar</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div
          className={`px-3.5 py-2 border-t flex items-center justify-between text-[11px] ${
            isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <span>{filtered.length} resultados exibidos</span>
          <span className="font-mono text-[10px]">Clique para localizar no mapa</span>
        </div>
      </div>
    </div>
  );
}
