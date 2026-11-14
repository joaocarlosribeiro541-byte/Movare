import { useMemo, useState } from 'react';
import {
  Search,
  X,
  Crosshair,
  BookmarkCheck,
  Check,
  Filter,
  ClipboardCheck,
  Package,
  Building2,
  MapPin,
  ChevronLeft,
} from 'lucide-react';
import { PRODUCT_CATEGORIES, type FloorArea } from '../editor-model';
import {
  buildSearchCatalog,
  filterSearchCatalog,
  formatReservationDateTime,
  type SearchCatalogItem,
} from '../wms-operations';

type ConferentePanelProps = {
  isOpen: boolean;
  onToggleOpen: () => void;
  areas: FloorArea[];
  activeAreaId: string;
  isDark: boolean;
  onLocateItem: (item: SearchCatalogItem) => void;
};

export function ConferentePanel({
  isOpen,
  onToggleOpen,
  areas,
  activeAreaId,
  isDark,
  onLocateItem,
}: ConferentePanelProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'products' | 'reserved'>('all');
  const [areaScope, setAreaScope] = useState<'all' | 'active'>('all');

  const catalog = useMemo(() => buildSearchCatalog(areas), [areas]);

  const results = useMemo(
    () =>
      filterSearchCatalog(catalog, {
        query,
        filterType: statusFilter,
        category: categoryFilter,
        areaId: areaScope === 'active' ? activeAreaId : 'all',
        onlyPositionsFirst: true,
        limit: 40,
      }),
    [catalog, query, statusFilter, categoryFilter, areaScope, activeAreaId]
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`absolute top-4 left-4 z-30 flex items-center gap-2 px-3.5 py-2 rounded-xl border shadow-xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-900/95 border-sky-500/50 text-sky-300 hover:bg-slate-800 shadow-black/70'
            : 'bg-white/95 border-sky-400 text-sky-700 hover:bg-sky-50 shadow-slate-400/25'
        }`}
      >
        <ClipboardCheck className="w-4 h-4 text-sky-400" />
        <span>Painel do Conferente</span>
      </button>
    );
  }

  return (
    <aside
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`fixed md:absolute inset-x-3 top-14 md:inset-x-auto md:top-3 md:left-3 md:bottom-3 md:w-[360px] max-h-[78dvh] md:max-h-none z-30 flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${
        isDark
          ? 'bg-slate-950/94 border-slate-700/85 text-slate-100 shadow-black/80'
          : 'bg-white/96 border-slate-200 text-slate-900 shadow-slate-500/25'
      }`}
    >
      {/* Cabeçalho Operacional */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
          isDark
            ? 'bg-slate-900/90 border-slate-800'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-400 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold tracking-tight truncate">
              Consulta do Conferente
            </h3>
            <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Localize produto por código, SKU, modelo ou fornecedor
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          title="Recolher painel do conferente"
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <ChevronLeft className="w-4 h-4 hidden md:block" />
          <X className="w-4 h-4 md:hidden" />
        </button>
      </div>

      {/* Controles de Busca e Filtros */}
      <div
        className={`p-3 space-y-2.5 border-b ${
          isDark ? 'border-slate-800/90 bg-slate-950/70' : 'border-slate-200 bg-slate-50/60'
        }`}
      >
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-orange-500 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código, SKU, modelo, fornecedor..."
            className={`w-full pl-9 pr-8 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-orange-500 transition-colors ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 p-0.5 text-slate-400 hover:text-orange-400 cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <Filter className="w-3 h-3 text-orange-500 shrink-0" />
            <select
              aria-label="Filtrar categoria"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-transparent focus:outline-none cursor-pointer truncate"
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

          <select
            aria-label="Escopo de galpão"
            value={areaScope}
            onChange={(e) => setAreaScope(e.target.value as 'all' | 'active')}
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium focus:outline-none cursor-pointer ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <option value="all">Todos os galpões</option>
            <option value="active">Apenas galpão atual</option>
          </select>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'products', label: 'Com Produto / SKU' },
              { id: 'reserved', label: 'Reservados' },
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all cursor-pointer border ${
                statusFilter === pill.id
                  ? pill.id === 'reserved'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-orange-600 text-white border-orange-500 font-bold'
                  : isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Cards Objetivos de Resultado */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {results.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-1.5">
            <Search className="w-8 h-8 mx-auto opacity-35" />
            <p className="font-semibold">Nenhum produto encontrado</p>
            <p className="text-[11px] opacity-80">Tente outro código, SKU, modelo ou categoria.</p>
          </div>
        ) : (
          results.map((item, idx) => {
            const isReserved = item.status === 'reserved';
            const isOccupied = item.status === 'occupied';

            return (
              <div
                key={`${item.elementId}-${item.positionId || item.positionCode || idx}`}
                className={`p-3 rounded-xl border space-y-2 transition-all ${
                  isReserved
                    ? isDark
                      ? 'bg-amber-950/20 border-amber-500/50'
                      : 'bg-amber-50/70 border-amber-300'
                    : isDark
                    ? 'bg-slate-900/75 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.positionCode && (
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/35">
                          {item.positionCode}
                        </span>
                      )}
                      {item.sku && item.sku !== item.positionCode && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          SKU: {item.sku}
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 text-xs font-bold leading-snug break-words">
                      {item.productName || item.elementName}
                    </h4>
                  </div>

                  {isReserved ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/50 inline-flex items-center gap-1 shrink-0">
                      <BookmarkCheck className="w-2.5 h-2.5" />
                      <span>RESERVADO</span>
                    </span>
                  ) : isOccupied ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 inline-flex items-center gap-1 shrink-0">
                      <Check className="w-2.5 h-2.5" />
                      <span>OCUPADO</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30 shrink-0">
                      LIVRE
                    </span>
                  )}
                </div>

                <div className={`grid grid-cols-2 gap-1.5 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <div className="flex items-center gap-1 min-w-0">
                    <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                    <span className="truncate">{item.areaName}</span>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <Package className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="truncate">
                      {item.elementName}
                      {item.positionCode && item.isPosition ? ` · ${item.positionCode}` : ''}
                    </span>
                  </div>
                  {item.supplier && (
                    <div className="flex items-center gap-1 min-w-0 col-span-2 opacity-85">
                      <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{item.supplier}</span>
                      {typeof item.volumesPerItem === 'number' && (
                        <span className="ml-auto font-mono text-[10px] shrink-0">
                          {item.volumesPerItem} vol/item
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isReserved && (
                  <div
                    className={`px-2 py-1.5 rounded-lg border text-[10px] space-y-0.5 ${
                      isDark
                        ? 'bg-amber-950/35 border-amber-500/35 text-amber-200'
                        : 'bg-amber-100/70 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>Loja: <strong>{item.reservedStore || 'Não informada'}</strong></span>
                      {item.reservedAt && (
                        <span className="font-mono tabular-nums opacity-85">
                          {formatReservationDateTime(item.reservedAt)}
                        </span>
                      )}
                    </div>
                    {(typeof item.reservedQuantity === 'number' || typeof item.quantity === 'number') && (
                      <div className="font-mono tabular-nums">
                        Reserva: <strong>{item.reservedQuantity ?? item.quantity} {item.unit || 'UN'}</strong>
                        {typeof item.quantity === 'number' && (
                          <span className="opacity-85"> (estoque total: {item.quantity} {item.unit || 'UN'})</span>
                        )}
                      </div>
                    )}
                    {(item.reservedBy || item.reservedByEmail) && (
                      <div className="truncate opacity-90">
                        Responsável: <strong>{item.reservedBy || item.reservedByEmail}</strong>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onLocateItem(item)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Localizar no mapa</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé informativo */}
      <div
        className={`px-3.5 py-2 border-t text-[10px] font-mono flex items-center justify-between ${
          isDark ? 'bg-slate-900/90 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}
      >
        <span>{results.length} resultados</span>
        <span>Somente consulta</span>
      </div>
    </aside>
  );
}
