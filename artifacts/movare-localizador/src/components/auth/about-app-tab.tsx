import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  Expand,
  Eye,
  Layers,
  Magnet,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Ruler,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type { DrawingElement, FloorArea, InternalPosition } from '../../editor-model';
import {
  InteractiveMapCADViewport,
  InteractivePhysicsDemoSVG,
  MovareBlueprintIllustration,
  SAMPLE_MOVARE_AREA,
  type BlueprintId,
} from './about-cad-visuals';

export type AboutAppTabProps = {
  isDark: boolean;
  areas?: FloorArea[];
  activeAreaId?: string;
};

type ChapterId = 'mapa' | 'reserva' | 'fisica' | 'cargos';
type RoleDemoId = 'admin' | 'assistencia' | 'conferente' | 'visitor';

const CHAPTERS: { id: ChapterId; step: string; label: string; icon: typeof Search }[] = [
  { id: 'mapa', step: '01', label: 'Mapa & Busca', icon: Search },
  { id: 'reserva', step: '02', label: 'Reserva Parcial', icon: BookmarkCheck },
  { id: 'fisica', step: '03', label: 'Física CAD', icon: Magnet },
  { id: 'cargos', step: '04', label: 'Cargos & Nuvem', icon: ShieldCheck },
];

type BlueprintCardInfo = {
  id: BlueprintId;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
};

const BLUEPRINTS: BlueprintCardInfo[] = [
  {
    id: 'scale-cad',
    number: '01',
    title: 'Planta CAD em Escala Métrica & Múltiplos Galpões',
    subtitle: 'Medidas reais calibradas (1m = px)',
    description:
      'Mapeie galpões reais em metros com régua métrica, grade de 1m/5m, corredores de circulação e prevenção física contra sobreposição entre zonas.',
    highlights: [
      'Troca rápida entre múltiplos galpões pelo seletor superior',
      'Física anti-colisão impede que zonas invadam o espaço vizinho',
      'Exportação nítida da planta inteira em imagem PNG',
    ],
  },
  {
    id: 'positions-search',
    number: '02',
    title: 'Nomenclatura Limpa & Busca Instantânea (Ctrl+K)',
    subtitle: 'Localização sem sobrepor códigos',
    description:
      'O título da zona fica posicionado acima do perímetro para nunca cobrir os códigos das células. A pesquisa focaliza a célula com mira vermelha pulsante.',
    highlights: [
      'Busca por código (ex: GEL0002), SKU, modelo, fornecedor ou loja',
      'Destaque pulsante no centro exato da posição no mapa',
      'Card completo com estoque total, saldo livre e dados da reserva',
    ],
  },
  {
    id: 'partial-reserve',
    number: '03',
    title: 'Reserva Parcial Derivada do Estoque Total',
    subtitle: 'Separação clara por loja e responsável',
    description:
      'Ao reservar parte do estoque de uma posição, o sistema mantém o total em estoque preservado e registra loja de destino, data/hora e responsável.',
    highlights: [
      'Impede reservar acima da quantidade disponível em estoque',
      'Calcula automaticamente o saldo livre restante na célula',
      'Painel do Conferente dedicado para expedição e docas',
    ],
  },
  {
    id: 'roles-cloud',
    number: '04',
    title: 'Cargos Automáticos, Autocadastro & Nuvem Realtime',
    subtitle: 'Controle de acesso via Supabase',
    description:
      'Qualquer usuário pode se cadastrar como Usuário Comum. Quando o Administrador vincula um cargo, as permissões e menus são liberados automaticamente.',
    highlights: [
      'Menu retrátil do usuário adaptado exatamente ao cargo ativo',
      'Criação e edição de cargos personalizados pelo Administrador',
      'Reservas atômicas e sincronização em tempo real na nuvem',
    ],
  },
];

const ROLE_SIMULATION: Record<
  RoleDemoId,
  {
    title: string;
    badge: string;
    accentColor: string;
    summary: string;
    menuItems: string[];
    toolbarAccess: string;
    canEditMap: boolean;
    canReserve: boolean;
    canConferente: boolean;
    canManageRoles: boolean;
  }
> = {
  admin: {
    title: 'Administrador',
    badge: 'Acesso Completo',
    accentColor: 'text-emerald-400',
    summary:
      'Gerencia todos os galpões, edita o mapa CAD, cria/atribui cargos na aba Membros & Cargos e publica alterações na nuvem.',
    menuItems: [
      'Meu Perfil & Segurança',
      'Nuvem & Publicar Versão',
      'Gerenciar Membros & Cargos',
      'Gerenciar Galpões, Escala e Dimensões',
      'Sobre o App & Backup JSON',
    ],
    toolbarAccess: 'Barra completa liberada (Desenhar Zona, Corredor, Mover, Régua, Backup, Cargos)',
    canEditMap: true,
    canReserve: true,
    canConferente: true,
    canManageRoles: true,
  },
  assistencia: {
    title: 'Assistência',
    badge: 'Reservas por Loja',
    accentColor: 'text-amber-400',
    summary:
      'Consulta produtos em qualquer galpão e realiza reservas parciais ou totais informando loja de destino e quantidade exata.',
    menuItems: [
      'Meu Perfil & Segurança',
      'Nuvem & Status em Tempo Real',
      'Exportar Planta PNG',
      'Sobre o App',
    ],
    toolbarAccess: 'Modo Consulta + Busca (Ctrl+K) + Botão "Reservar Posição" no card do produto',
    canEditMap: false,
    canReserve: true,
    canConferente: false,
    canManageRoles: false,
  },
  conferente: {
    title: 'Conferente',
    badge: 'Docas & Expedição',
    accentColor: 'text-sky-400',
    summary:
      'Opera com o Painel do Conferente para listar rapidamente todos os produtos reservados por loja e centralizar a mira na posição.',
    menuItems: [
      'Meu Perfil & Segurança',
      'Painel de Conferência (Reservas)',
      'Nuvem & Status em Tempo Real',
      'Sobre o App',
    ],
    toolbarAccess: 'Navegação segura + Painel Conferente + Busca por SKU, Loja ou Posição',
    canEditMap: false,
    canReserve: false,
    canConferente: true,
    canManageRoles: false,
  },
  visitor: {
    title: 'Usuário Comum / Visitante',
    badge: 'Consulta Segura',
    accentColor: 'text-slate-400',
    summary:
      'Visualiza galpões, zonas e produtos em modo leitura enquanto aguarda o Administrador vincular um cargo ao seu cadastro.',
    menuItems: [
      'Meu Perfil (se autenticado)',
      'Status da Nuvem',
      'Sobre o App',
    ],
    toolbarAccess: 'Navegação (Zoom/Pan), Busca e visualização limpa de posições',
    canEditMap: false,
    canReserve: false,
    canConferente: false,
    canManageRoles: false,
  },
};

const SHORTCUTS_LIST = [
  { key: 'V / H / M', desc: 'Selecionar, Navegar (Pan) ou Mover elementos' },
  { key: 'R / C / T', desc: 'Nova Zona, Corredor / Rua ou Fita Métrica' },
  { key: 'Ctrl + K', desc: 'Busca rápida por código, SKU, produto ou loja' },
  { key: 'Ctrl + S', desc: 'Salvar/publicar alterações na nuvem (Admin)' },
  { key: 'Ctrl + Z / Y', desc: 'Desfazer ou refazer alterações no galpão' },
  { key: 'Scroll', desc: 'Zoom preciso no cursor sobre o mapa' },
];

function cloneArea(area: FloorArea): FloorArea {
  return {
    ...area,
    elements: area.elements.map((el) => ({
      ...el,
      internalPositions: el.internalPositions
        ? el.internalPositions.map((p) => ({ ...p }))
        : undefined,
    })),
  };
}

function getAllPositions(area: FloorArea): { zone: DrawingElement; pos: InternalPosition }[] {
  const list: { zone: DrawingElement; pos: InternalPosition }[] = [];
  for (const el of area.elements) {
    if (el.hidden) continue;
    for (const pos of el.internalPositions || []) {
      list.push({ zone: el, pos });
    }
  }
  return list;
}

export function AboutAppTab({ isDark, areas = [], activeAreaId }: AboutAppTabProps) {
  const loadedPopulatedAreas = useMemo(
    () =>
      areas.filter((a) =>
        a.elements.some((el) => !el.hidden && (el.type !== 'rectangle' || (el.internalPositions?.length || 0) > 0 || el.width > 0))
      ),
    [areas]
  );

  const defaultLoadedArea = useMemo(() => {
    if (loadedPopulatedAreas.length === 0) return null;
    return loadedPopulatedAreas.find((a) => a.id === activeAreaId) || loadedPopulatedAreas[0];
  }, [activeAreaId, loadedPopulatedAreas]);

  const hasLoadedMap = Boolean(defaultLoadedArea);

  const [chapter, setChapter] = useState<ChapterId>('mapa');
  const [useLoadedMap, setUseLoadedMap] = useState<boolean>(hasLoadedMap);
  const [selectedLoadedAreaId, setSelectedLoadedAreaId] = useState<string>(
    defaultLoadedArea?.id || ''
  );

  // Cópia local segura para simulação interativa sem alterar o mapa oficial
  const sourceArea = useMemo(() => {
    if (useLoadedMap && loadedPopulatedAreas.length > 0) {
      return (
        loadedPopulatedAreas.find((a) => a.id === selectedLoadedAreaId) ||
        defaultLoadedArea ||
        SAMPLE_MOVARE_AREA
      );
    }
    return SAMPLE_MOVARE_AREA;
  }, [defaultLoadedArea, loadedPopulatedAreas, selectedLoadedAreaId, useLoadedMap]);

  const [sandboxArea, setSandboxArea] = useState<FloorArea>(() => cloneArea(sourceArea));

  useEffect(() => {
    setSandboxArea(cloneArea(sourceArea));
  }, [sourceArea]);

  const allPositions = useMemo(() => getAllPositions(sandboxArea), [sandboxArea]);

  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusTarget, setFocusTarget] = useState<{ x: number; y: number; zoom: number } | null>(
    null
  );
  const [tourPlaying, setTourPlaying] = useState(false);

  // Estados do Simulador de Reserva Parcial
  const [reserveStore, setReserveStore] = useState<string>('Loja Filial 02');
  const [reserveQty, setReserveQty] = useState<number>(3);

  // Estado do Simulador de Cargos
  const [demoRole, setDemoRole] = useState<RoleDemoId>('assistencia');

  // Ampliação de esquema
  const [expandedBlueprint, setExpandedBlueprint] = useState<BlueprintCardInfo | null>(null);

  // Seleciona automaticamente uma posição interessante ao trocar de mapa
  useEffect(() => {
    const preferred =
      allPositions.find((item) => item.pos.status === 'reserved') ||
      allPositions.find((item) => (item.pos.quantity || 0) > 0) ||
      allPositions[0];
    setSelectedPosId(preferred?.pos.id || null);
    setFocusTarget(null);
    setSearchQuery('');
    if (preferred?.pos.quantity) {
      setReserveQty(
        Math.max(1, Math.min(preferred.pos.quantity, preferred.pos.reservedQuantity || 3))
      );
    }
    if (preferred?.pos.reservedStore) {
      setReserveStore(preferred.pos.reservedStore);
    }
  }, [sourceArea.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedEntry = useMemo(
    () =>
      allPositions.find((item) => item.pos.id === selectedPosId) ||
      allPositions[0] ||
      null,
    [allPositions, selectedPosId]
  );

  // Busca em tempo real nas células e zonas do mapa em exibição
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchedPositions = useMemo(() => {
    if (!normalizedQuery) return [];
    return allPositions.filter(({ zone, pos }) => {
      return (
        pos.code.toLowerCase().includes(normalizedQuery) ||
        (pos.sku || '').toLowerCase().includes(normalizedQuery) ||
        (pos.description || '').toLowerCase().includes(normalizedQuery) ||
        (pos.model || '').toLowerCase().includes(normalizedQuery) ||
        (pos.supplier || '').toLowerCase().includes(normalizedQuery) ||
        (pos.reservedStore || '').toLowerCase().includes(normalizedQuery) ||
        zone.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [allPositions, normalizedQuery]);

  const highlightedPosIds = useMemo(
    () => new Set(matchedPositions.map((m) => m.pos.id)),
    [matchedPositions]
  );

  const focusEntryOnMap = (entry: { zone: DrawingElement; pos: InternalPosition }, zoom = 1.75) => {
    setSelectedPosId(entry.pos.id);
    setFocusTarget({
      x: entry.zone.x + entry.pos.relX + entry.pos.relWidth / 2,
      y: entry.zone.y + entry.pos.relY + entry.pos.relHeight / 2,
      zoom,
    });
    if (entry.pos.quantity && entry.pos.quantity > 0) {
      setReserveQty(
        Math.max(1, Math.min(entry.pos.quantity, entry.pos.reservedQuantity || 2))
      );
    }
    if (entry.pos.reservedStore) {
      setReserveStore(entry.pos.reservedStore);
    }
  };

  // Chips de busca rápida dinâmicos baseados no mapa carregado/demo
  const quickSearchPresets = useMemo(() => {
    const chips: { label: string; query: string }[] = [];
    const firstReserved = allPositions.find((p) => p.pos.status === 'reserved');
    const firstOccupied = allPositions.find((p) => p.pos.status === 'occupied');
    if (firstOccupied) {
      chips.push({ label: firstOccupied.pos.code, query: firstOccupied.pos.code });
      if (firstOccupied.pos.sku) {
        chips.push({ label: firstOccupied.pos.sku, query: firstOccupied.pos.sku });
      }
    }
    if (firstReserved?.pos.reservedStore) {
      chips.push({
        label: firstReserved.pos.reservedStore,
        query: firstReserved.pos.reservedStore,
      });
    }
    return chips.slice(0, 3);
  }, [allPositions]);

  // Tour animado automático entre células do mapa
  useEffect(() => {
    if (!tourPlaying || allPositions.length === 0) return;
    const interesting = allPositions.filter((p) => p.pos.status !== 'empty');
    const pool = interesting.length > 0 ? interesting : allPositions;
    let idx = 0;

    const runStep = () => {
      const target = pool[idx % pool.length];
      setSearchQuery(target.pos.code);
      focusEntryOnMap(target, 1.85);
      idx += 1;
    };

    runStep();
    const timer = window.setInterval(runStep, 2600);
    return () => window.clearInterval(timer);
  }, [tourPlaying, allPositions]);

  const handleApplyReservation = () => {
    if (!selectedEntry) return;
    const stock = selectedEntry.pos.quantity ?? 0;
    if (stock <= 0) return;
    const clamped = Math.max(1, Math.min(stock, Math.round(reserveQty || 1)));
    const store = reserveStore.trim() || 'Loja Centro';
    const nowStr = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    setSandboxArea((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id !== selectedEntry.zone.id || !el.internalPositions) return el;
        return {
          ...el,
          internalPositions: el.internalPositions.map((p) =>
            p.id === selectedEntry.pos.id
              ? {
                  ...p,
                  status: 'reserved',
                  reservedQuantity: clamped,
                  reservedStore: store,
                  reservedAt: nowStr,
                  reservedBy: 'Assistência (Simulação)',
                }
              : p
          ),
        };
      }),
    }));
  };

  const handleClearReservation = () => {
    if (!selectedEntry) return;
    setSandboxArea((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id !== selectedEntry.zone.id || !el.internalPositions) return el;
        return {
          ...el,
          internalPositions: el.internalPositions.map((p) =>
            p.id === selectedEntry.pos.id
              ? {
                  ...p,
                  status: (p.quantity || 0) > 0 ? 'occupied' : 'empty',
                  reservedQuantity: undefined,
                  reservedStore: undefined,
                  reservedAt: undefined,
                  reservedBy: undefined,
                }
              : p
          ),
        };
      }),
    }));
  };

  const handleResetSandbox = () => {
    setTourPlaying(false);
    setSearchQuery('');
    setFocusTarget(null);
    setSandboxArea(cloneArea(sourceArea));
  };

  const chapterIndex = CHAPTERS.findIndex((c) => c.id === chapter);
  const surfaceClass = isDark ? 'bg-slate-950/75 border-slate-800' : 'bg-slate-50 border-slate-200';
  const cardClass = isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const currentPos = selectedEntry?.pos;
  const stockTotal = currentPos?.quantity ?? 0;
  const reservedEffective =
    currentPos?.status === 'reserved'
      ? Math.min(stockTotal || currentPos.reservedQuantity || 0, currentPos.reservedQuantity ?? stockTotal)
      : 0;
  const availableStock = Math.max(0, stockTotal - reservedEffective);
  const reservedPct = stockTotal > 0 ? Math.round((reservedEffective / stockTotal) * 100) : 0;

  return (
    <div className="p-4 sm:p-5 space-y-5 text-xs">
      {/* Faixa Inicial Limpa com Alternador de Fonte do Mapa */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${surfaceClass}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="px-2 py-1 rounded-lg bg-white border border-slate-300 shrink-0 shadow-2xs">
            <img src="/movare-logo.png" alt="MOVARE" className="h-7 w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold tracking-tight truncate">
              Guia Interativo · Movare Localizador &amp; Galpões
            </h4>
            <p className={`text-[11px] truncate ${mutedText}`}>
              Explore na prática usando {useLoadedMap && hasLoadedMap ? 'o mapa carregado no sistema' : 'o galpão modelo em português'}.
            </p>
          </div>
        </div>

        {/* Alternador Mapa Carregado vs Modelo PT-BR */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {hasLoadedMap && (
            <div
              className={`inline-flex p-0.5 rounded-lg border text-[11px] ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setUseLoadedMap(true)}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  useLoadedMap
                    ? 'bg-red-600 text-white'
                    : isDark
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mapa Carregado
              </button>
              <button
                type="button"
                onClick={() => setUseLoadedMap(false)}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  !useLoadedMap
                    ? 'bg-red-600 text-white'
                    : isDark
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Exemplo Completo
              </button>
            </div>
          )}

          {useLoadedMap && loadedPopulatedAreas.length > 1 && (
            <select
              value={sourceArea.id}
              onChange={(e) => setSelectedLoadedAreaId(e.target.value)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              {loadedPopulatedAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Navegação Guiada em 4 Passos Claros */}
      <div className="space-y-3">
        <div
          className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-xl border ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {CHAPTERS.map((c) => {
            const Icon = c.icon;
            const active = chapter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChapter(c.id)}
                className={`px-2.5 py-2 rounded-lg text-[11.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                  active
                    ? 'bg-red-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono text-[10px] opacity-80">{c.step}</span>
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* CAPÍTULO 1: MAPA REAL & BUSCA COM MIRA ANIMADA */}
        {chapter === 'mapa' && (
          <div className={`p-4 rounded-xl border space-y-3.5 ${surfaceClass}`}>
            {/* Barra de Busca + Tour Automático */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setTourPlaying(false);
                      setSearchQuery(e.target.value);
                    }}
                    placeholder="Buscar posição, SKU, produto ou loja..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-red-500 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {quickSearchPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setTourPlaying(false);
                      setSearchQuery(preset.query);
                      const firstMatch = allPositions.find(
                        ({ pos }) =>
                          pos.code === preset.query ||
                          pos.sku === preset.query ||
                          pos.reservedStore === preset.query
                      );
                      if (firstMatch) focusEntryOnMap(firstMatch, 1.85);
                    }}
                    className={`hidden md:inline-flex px-2 py-1.5 rounded-lg border text-[10.5px] font-mono cursor-pointer transition-colors ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-red-500/70'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-red-500'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setTourPlaying((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    tourPlaying
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{tourPlaying ? 'Pausar Tour' : 'Animar Busca no Mapa'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetSandbox}
                  title="Reiniciar visualização"
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Viewport CAD Fiel + Card do Produto Fiel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
              <div className="lg:col-span-7 flex flex-col gap-2">
                <InteractiveMapCADViewport
                  area={sandboxArea}
                  isDark={isDark}
                  selectedPositionId={selectedEntry?.pos.id || null}
                  highlightedPositionIds={highlightedPosIds}
                  focusTarget={focusTarget}
                  onSelectPosition={(zone, pos) => {
                    setTourPlaying(false);
                    focusEntryOnMap({ zone, pos }, 1.75);
                  }}
                />
                <div className={`flex flex-wrap items-center justify-between gap-2 text-[10.5px] ${mutedText}`}>
                  <span>Clique em qualquer célula no mapa ou arraste para navegar.</span>
                  <span className="font-mono">
                    {matchedPositions.length > 0
                      ? `${matchedPositions.length} posição(ões) destacada(s)`
                      : `${allPositions.length} posições mapeadas`}
                  </span>
                </div>
              </div>

              {/* Card Fiel do Produto Selecionado */}
              <div className={`lg:col-span-5 p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${cardClass}`}>
                {selectedEntry && currentPos ? (
                  <div className="space-y-3">
                    <div className={`flex items-start justify-between gap-2 pb-2.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] truncate ${mutedText}`}>
                          {selectedEntry.zone.name}
                        </div>
                        <h5 className="text-sm font-bold leading-snug mt-0.5">
                          {currentPos.description || (currentPos.status === 'empty' ? 'Posição livre para alocação' : 'Item cadastrado no estoque')}
                        </h5>
                      </div>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-white shrink-0">
                        {currentPos.code}
                      </span>
                    </div>

                    {/* Grid SKU & Em Estoque */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2.5 rounded-lg border ${surfaceClass}`}>
                        <div className={`text-[10px] ${mutedText}`}>SKU / Modelo</div>
                        <div className="font-mono font-bold text-xs mt-0.5 truncate">
                          {currentPos.sku || '—'}
                        </div>
                        {currentPos.model && (
                          <div className={`text-[10px] truncate mt-0.5 ${mutedText}`}>
                            {currentPos.model}
                          </div>
                        )}
                      </div>

                      <div className={`p-2.5 rounded-lg border ${surfaceClass}`}>
                        <div className={`text-[10px] ${mutedText}`}>Em Estoque</div>
                        <div className="font-mono font-bold text-sm mt-0.5 tabular-nums">
                          {stockTotal} {currentPos.unit || 'UN'}
                        </div>
                        {currentPos.status === 'reserved' && stockTotal > 0 && (
                          <div className="text-[10px] font-semibold text-emerald-500 tabular-nums">
                            {availableStock > 0
                              ? `${availableStock} ${currentPos.unit || 'UN'} disp.`
                              : 'Estoque todo reservado'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card de Reserva Fiel quando Reservado */}
                    {currentPos.status === 'reserved' ? (
                      <div
                        className={`p-3 rounded-lg border space-y-1.5 text-[11px] ${
                          isDark
                            ? 'bg-amber-950/35 border-amber-500/40 text-amber-100'
                            : 'bg-amber-50 border-amber-300 text-amber-950'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Produto Reservado</span>
                          <span className="font-mono tabular-nums">
                            {reservedEffective} de {stockTotal} {currentPos.unit || 'UN'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="opacity-80">Loja de destino:</span>
                          <span className="font-semibold">{currentPos.reservedStore || 'Não informada'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="opacity-80">Data da reserva:</span>
                          <span className="font-mono tabular-nums">{currentPos.reservedAt || 'Agora'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="opacity-80">Responsável:</span>
                          <span className="font-medium">{currentPos.reservedBy || 'Assistência'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-2.5 rounded-lg border text-[11px] ${surfaceClass} ${mutedText}`}>
                        {currentPos.status === 'occupied'
                          ? 'Esta posição possui estoque ativo disponível. Acesse a aba "02 Reserva Parcial" para testar uma reserva para loja.'
                          : 'Posição vazia pronta para receber novos produtos pelo painel de endereços.'}
                      </div>
                    )}

                    {/* Botão direto para testar reserva nessa célula */}
                    {stockTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => setChapter('reserva')}
                        className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>Testar Reserva Parcial nesta Posição</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`text-xs ${mutedText}`}>
                    Este galpão ainda não possui posições internas criadas. Alterne para "Exemplo Completo" no topo para interagir com o mapa demonstrativo.
                  </div>
                )}

                <div className={`text-[10.5px] pt-2 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                  Medidas da célula: <strong className="font-mono tabular-nums">{currentPos ? `${currentPos.widthMeters.toFixed(2)}m × ${currentPos.depthMeters.toFixed(2)}m` : '—'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAPÍTULO 2: RESERVA PARCIAL VS ESTOQUE TOTAL */}
        {chapter === 'reserva' && (
          <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Controles Interativos da Reserva Parcial */}
              <div className={`lg:col-span-5 p-3.5 rounded-xl border space-y-3.5 ${cardClass}`}>
                <div>
                  <h5 className="text-sm font-bold">Simulador de Reserva Parcial</h5>
                  <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                    Escolha uma posição com estoque, ajuste a quantidade para a loja e veja o cálculo automático sem apagar o estoque total.
                  </p>
                </div>

                {/* Seletor rápido de célula com estoque */}
                <div>
                  <label className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}>
                    Posição selecionada no mapa
                  </label>
                  <select
                    value={selectedEntry?.pos.id || ''}
                    onChange={(e) => {
                      const found = allPositions.find((p) => p.pos.id === e.target.value);
                      if (found) focusEntryOnMap(found, 1.85);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {allPositions
                      .filter((p) => (p.pos.quantity || 0) > 0)
                      .map(({ zone, pos }) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.code} · {pos.sku || zone.name} ({pos.quantity} {pos.unit || 'UN'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Loja de Destino com chips rápidos */}
                <div className="space-y-1.5">
                  <label className={`block text-[10.5px] font-semibold ${mutedText}`}>
                    Loja de destino
                  </label>
                  <input
                    type="text"
                    value={reserveStore}
                    onChange={(e) => setReserveStore(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['Loja Centro', 'Loja Filial 02', 'Loja Norte', 'Loja Sul'].map((loja) => (
                      <button
                        key={loja}
                        type="button"
                        onClick={() => setReserveStore(loja)}
                        className={`px-2 py-0.5 rounded border text-[10.5px] cursor-pointer transition-colors ${
                          reserveStore === loja
                            ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                            : isDark
                            ? 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {loja}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider + Stepper de Quantidade */}
                {stockTotal > 0 ? (
                  <div className={`p-3 rounded-xl border space-y-2.5 ${surfaceClass}`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold">Quantidade a Reservar</span>
                      <span className="font-mono font-bold tabular-nums">
                        {Math.min(stockTotal, Math.max(1, reserveQty))} de {stockTotal} {currentPos?.unit || 'UN'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReserveQty((q) => Math.max(1, q - 1))}
                        className={`p-1.5 rounded-lg border cursor-pointer ${
                          isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min={1}
                        max={stockTotal}
                        value={Math.min(stockTotal, Math.max(1, reserveQty))}
                        onChange={(e) => setReserveQty(Number(e.target.value))}
                        className="flex-1 accent-amber-500 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setReserveQty((q) => Math.min(stockTotal, q + 1))}
                        className={`p-1.5 rounded-lg border cursor-pointer ${
                          isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleApplyReservation}
                        className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                      >
                        Aplicar Reserva no Mapa
                      </button>
                      {currentPos?.status === 'reserved' && (
                        <button
                          type="button"
                          onClick={handleClearReservation}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                            isDark
                              ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                              : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          Liberar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl border text-[11px] ${surfaceClass} ${mutedText}`}>
                    Nenhuma posição com estoque selecionada. Troque para o "Exemplo Completo" ou selecione uma célula com quantidade &gt; 0.
                  </div>
                )}

                {/* Barra Animada de Divisão de Estoque */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span>Composição do Estoque ({currentPos?.code || '—'})</span>
                    <span className="font-mono tabular-nums">
                      Total: {stockTotal} {currentPos?.unit || 'UN'}
                    </span>
                  </div>
                  <div className={`h-4 rounded-lg overflow-hidden flex border ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
                    <div
                      className="h-full bg-amber-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${reservedPct}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${stockTotal > 0 ? 100 - reservedPct : 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums">
                    <span className="text-amber-500 font-semibold">
                      Reservado: {reservedEffective} {currentPos?.unit || 'UN'}
                    </span>
                    <span className="text-emerald-500 font-semibold">
                      Disponível Livre: {availableStock} {currentPos?.unit || 'UN'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mapa CAD ao Vivo Refletindo a Reserva */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <InteractiveMapCADViewport
                  area={sandboxArea}
                  isDark={isDark}
                  selectedPositionId={selectedEntry?.pos.id || null}
                  highlightedPositionIds={selectedEntry ? new Set([selectedEntry.pos.id]) : new Set()}
                  focusTarget={focusTarget}
                  onSelectPosition={(zone, pos) => focusEntryOnMap({ zone, pos }, 1.85)}
                />
                <p className={`text-[11px] ${mutedText}`}>
                  Observe no mapa acima: o selo <strong className="font-mono">RES</strong> e o nome da loja aparecem imediatamente na célula e na placa da zona sem perder a contagem total de estoque.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CAPÍTULO 3: DESENHO CAD, SNAP MÉTRICO & FÍSICA ANTI-SOBREPOSIÇÃO */}
        {chapter === 'fisica' && (
          <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-8">
                <InteractivePhysicsDemoSVG isDark={isDark} />
              </div>

              <div className={`lg:col-span-4 p-3.5 rounded-xl border space-y-3 ${cardClass}`}>
                <h5 className="text-sm font-bold flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Precisão Arquitetônica</span>
                </h5>
                <p className={`text-[11.5px] leading-relaxed ${mutedText}`}>
                  Experimente arrastar a <strong>Zona Móveis</strong> contra a <strong>Zona Geladeiras</strong> ou clique em <strong>Animar Colisão</strong>.
                </p>
                <ul className="space-y-2 text-[11px]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Física Anti-Sobreposição:</strong> trava na borda exata (0,0 m) e permite deslizar rente à zona vizinha sem invasão.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Snap Métrico:</strong> alinha zonas e corredores perfeitamente na malha em metros.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Calibração 1m = px:</strong> garante que corredores de empilhadeira e células tenham largura real exata.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* CAPÍTULO 4: CARGOS, PERMISSÕES AUTOMÁTICAS & NUVEM */}
        {chapter === 'cargos' && (
          <div className={`p-4 rounded-xl border space-y-4 ${surfaceClass}`}>
            {/* Seletor de Cargo Interativo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'admin', label: 'Administrador', icon: ShieldCheck },
                  { id: 'assistencia', label: 'Assistência', icon: BookmarkCheck },
                  { id: 'conferente', label: 'Conferente', icon: ClipboardCheck },
                  { id: 'visitor', label: 'Comum / Visitante', icon: Eye },
                ] as const
              ).map((r) => {
                const RIcon = r.icon;
                const active = demoRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDemoRole(r.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      active
                        ? 'bg-red-600 border-red-500 text-white shadow-sm'
                        : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <RIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Simulação Fiel do Menu Retrátil + Fluxo de Autocadastro */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Simulação Visual do Menu de Perfil Retrátil */}
              <div className={`lg:col-span-6 p-3.5 rounded-xl border space-y-3 ${cardClass}`}>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/30">
                  <div>
                    <div className={`text-[10.5px] font-mono ${ROLE_SIMULATION[demoRole].accentColor}`}>
                      {ROLE_SIMULATION[demoRole].badge}
                    </div>
                    <h5 className="text-sm font-bold">{ROLE_SIMULATION[demoRole].title}</h5>
                  </div>
                  {/* Ícone de Perfil Retrátil Simulado */}
                  <div
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  >
                    <UserCheck className={`w-3.5 h-3.5 ${ROLE_SIMULATION[demoRole].accentColor}`} />
                    <span>Menu do Perfil</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </div>
                </div>

                <p className={`text-[11.5px] leading-relaxed ${mutedText}`}>
                  {ROLE_SIMULATION[demoRole].summary}
                </p>

                <div className={`p-2.5 rounded-xl border space-y-1.5 ${surfaceClass}`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${mutedText}`}>
                    Opções visíveis ao abrir o perfil neste cargo
                  </div>
                  {ROLE_SIMULATION[demoRole].menuItems.map((item) => (
                    <div
                      key={item}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-between ${
                        isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <span>{item}</span>
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                  ))}
                </div>

                <div className={`text-[11px] ${mutedText}`}>
                  <strong>Barra do editor:</strong> {ROLE_SIMULATION[demoRole].toolbarAccess}
                </div>
              </div>

              {/* Fluxo de Autocadastro + Matriz de Permissões */}
              <div className={`lg:col-span-6 p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${cardClass}`}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-500 shrink-0" />
                    <h5 className="text-sm font-bold">Fluxo de Cargos &amp; Sincronização Realtime</h5>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        step: '1',
                        title: 'Cadastro como Usuário Comum',
                        desc: 'Novo colaborador cria a conta na tela inicial com acesso seguro de consulta.',
                      },
                      {
                        step: '2',
                        title: 'Admin vincula ou cria um Cargo',
                        desc: 'Na aba Membros & Cargos, o Administrador atribui ou cria cargos com permissões personalizadas.',
                      },
                      {
                        step: '3',
                        title: 'Liberação Automática & Nuvem',
                        desc: 'As ferramentas do cargo desbloqueiam no mesmo instante e todas as reservas sincronizam via Supabase.',
                      },
                    ].map((s) => (
                      <div key={s.step} className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${surfaceClass}`}>
                        <span className="w-5 h-5 rounded-md bg-red-600 text-white font-mono font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
                          {s.step}
                        </span>
                        <div>
                          <div className="font-bold text-[11.5px]">{s.title}</div>
                          <div className={`text-[11px] leading-snug ${mutedText}`}>{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Matriz visual das 4 permissões */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/30 text-[11px]">
                  {[
                    { label: 'Editar Mapa', ok: ROLE_SIMULATION[demoRole].canEditMap },
                    { label: 'Reservar Loja', ok: ROLE_SIMULATION[demoRole].canReserve },
                    { label: 'Painel Conferente', ok: ROLE_SIMULATION[demoRole].canConferente },
                    { label: 'Gerenciar Cargos', ok: ROLE_SIMULATION[demoRole].canManageRoles },
                  ].map((perm) => (
                    <div
                      key={perm.label}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                        perm.ok
                          ? isDark
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 text-slate-500'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <span className="font-semibold">{perm.label}</span>
                      {perm.ok ? <Check className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barra Inferior de Navegação Guiada entre Etapas */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={chapterIndex <= 0}
            onClick={() => setChapter(CHAPTERS[Math.max(0, chapterIndex - 1)].id)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Etapa Anterior</span>
          </button>

          <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
            Passo {chapterIndex + 1} de {CHAPTERS.length}
          </span>

          <button
            type="button"
            disabled={chapterIndex >= CHAPTERS.length - 1}
            onClick={() => setChapter(CHAPTERS[Math.min(CHAPTERS.length - 1, chapterIndex + 1)].id)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span>Próxima Etapa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Seção 2: Diagramas Explicativos Fiéis ao Sistema em Português */}
      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-red-500" />
            <span>Diagramas Técnicos do Sistema (Em Português)</span>
          </h4>
          <p className={`text-[11px] mt-0.5 ${mutedText}`}>
            Visualizações fiéis ao padrão gráfico do Movare. Clique em qualquer diagrama para ampliar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {BLUEPRINTS.map((bp) => (
            <article key={bp.id} className={`p-3.5 rounded-xl border flex flex-col gap-3 ${cardClass}`}>
              <button
                type="button"
                onClick={() => setExpandedBlueprint(bp)}
                className={`group relative w-full overflow-hidden rounded-xl border text-left cursor-pointer transition-colors ${
                  isDark ? 'border-slate-800 hover:border-slate-600' : 'border-slate-200 hover:border-slate-400'
                }`}
                title="Clique para ampliar o diagrama"
              >
                <MovareBlueprintIllustration id={bp.id} isDark={isDark} compact />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/85 border border-white/15 text-[10px] font-medium text-white">
                  <Expand className="w-3 h-3" />
                  <span>Ampliar</span>
                </span>
              </button>

              <div className="space-y-1">
                <div className={`text-[10.5px] font-medium ${mutedText}`}>
                  {bp.number}. {bp.subtitle}
                </div>
                <h5 className="text-[13px] font-bold leading-snug">{bp.title}</h5>
                <p className={`text-[11.5px] leading-relaxed ${mutedText}`}>{bp.description}</p>
              </div>

              <ul className={`space-y-1 pt-2 border-t text-[11px] ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                {bp.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Seção 3: Atalhos Rápidos */}
      <section className={`p-4 rounded-xl border space-y-3 ${surfaceClass}`}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold tracking-tight">Atalhos Rápidos de Teclado</h4>
          <span className={`text-[10.5px] ${mutedText}`}>Editor &amp; Consulta</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SHORTCUTS_LIST.map((sc) => (
            <div
              key={sc.key}
              className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-3 ${cardClass}`}
            >
              <span className={`text-[11px] leading-snug ${mutedText}`}>{sc.desc}</span>
              <kbd
                className={`px-2 py-0.5 rounded border font-mono text-[10.5px] font-semibold shrink-0 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-200'
                    : 'bg-slate-100 border-slate-300 text-slate-800'
                }`}
              >
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* Modal de Ampliação do Diagrama Técnico */}
      {expandedBlueprint && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          onClick={() => setExpandedBlueprint(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <h5 className="text-xs sm:text-sm font-bold truncate">
                  {expandedBlueprint.number}. {expandedBlueprint.title}
                </h5>
                <p className={`text-[11px] truncate ${mutedText}`}>{expandedBlueprint.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedBlueprint(null)}
                aria-label="Fechar diagrama ampliado"
                className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <MovareBlueprintIllustration id={expandedBlueprint.id} isDark={isDark} />
              </div>
              <p className={`text-xs mt-3 leading-relaxed ${mutedText}`}>
                {expandedBlueprint.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
