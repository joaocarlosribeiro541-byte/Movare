import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, CircleHelp, Crosshair,
  LayoutGrid, Minus, MousePointer2, Redo2, RectangleHorizontal, RotateCcw,
  Ruler, Trash2, X, ZoomIn, ZoomOut, Pencil, Warehouse, Search, Layers,
  Sun, Moon, Plus, Box as BoxIcon, Move, Copy, MapPinned, ChevronUp, ChevronRight,
  Lock, Unlock, RotateCw, Sparkles, SlidersHorizontal, ArrowLeftRight,
  Maximize2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Tag, Target,
  Magnet, Sliders, PanelRightClose, PanelRightOpen, Shield, ShieldCheck,
  CheckSquare, Square,  AlignLeft, AlignCenter, Users, Eye,
  Camera as CameraIcon, Cloud, CloudOff, LogIn, UploadCloud, Loader2,
  BookmarkCheck, ClipboardCheck
} from 'lucide-react';
import {
  initialAreas, parseBackup, createId, DEFAULT_SCALE_RATIO, DEFAULT_WIDTH_METERS, DEFAULT_HEIGHT_METERS,
  WMS_COLOR_PALETTE, PRODUCT_SIZES, PRODUCT_CATEGORIES, getAreaBounds,
  type DrawingElement, type FloorArea, type ProductSize
} from '../editor-model';
import { snapMovedElement, snapPointToElements, snapResizedRectangle, type AlignmentGuide } from '../alignment';
import {
  isSolidSpace,
  getSolidObstacles,
  resolveSpacePhysics,
  resolveGroupPhysics,
  alignGroupElements,
} from '../physics';
import { ROLE_METADATA } from '../lib/auth';
import { useAuth } from '../hooks/use-auth';
import { useSharedMap } from '../hooks/use-shared-map';
import { AuthDialog } from '../components/auth/auth-dialog';
import { AdminPanelDialog } from '../components/auth/admin-panel-dialog';
import type { AccessPanelTab } from '../components/auth/profile-menu';
import { MigrationDialog } from '../components/auth/migration-dialog';
import { ConflictDialog } from '../components/auth/conflict-dialog';
import {
  canUserPersistReservations,
  canUserSeeReservationAction,
} from '../components/permissions/permission-guard';
import { CADRuler } from '../components/cad-ruler';
import { Minimap } from '../components/minimap';
import { WMSSearchDialog, type SearchResult } from '../components/wms-search-dialog';
import { ScaleCalibrationDialog } from '../components/scale-calibration-dialog';
import { WarehouseSizeDialog } from '../components/warehouse-size-dialog';
import { LayersManagerDialog } from '../components/layers-manager-dialog';
import { MovareSplashScreen } from '../components/movare-splash-screen';
import { SpotlightPalette, type SpotlightCommandAction } from '../components/spotlight-palette';
import { FloatingActionDock } from '../components/floating-action-dock';
import { TopCommandBar } from '../components/top-command-bar';
import { KeyboardShortcutsDialog } from '../components/keyboard-shortcuts-dialog';
import { PngExportDialog } from '../components/png-export-dialog';
import { ProductQuickCard } from '../components/product-quick-card';
import { SelectionInspector } from '../components/selection-inspector';
import { ConferentePanel } from '../components/conferente-panel';
import { WarehouseManagerDialog, type WarehouseManagerMode } from '../components/warehouse-manager-dialog';
import {
  buildNewWarehouse,
  updateWarehouseArea,
  deleteWarehouseArea,
} from '../warehouse-crud';
import {
  WarehouseGeographicLegendSVG,
  FloatingGeographicLegendButton,
} from '../components/geographic-legend';
import {
  recalculatePositionsOnZoneResize,
  applyVolumePresetToZone,
  generateStablePositionId,
} from '../zone-internal-positions';
import {
  countReservedPositionsInAreas,
  type SearchCatalogItem,
} from '../wms-operations';

type Tool = 'select' | 'move' | 'rectangle' | 'divider' | 'corridor' | 'measure' | 'pan';
type Camera = { x: number; y: number; scale: number };
type Point = { x: number; y: number };

type Gesture =
  | { kind: 'pan'; pointerId: number; startScreen: Point; camera: Camera }
  | { kind: 'empty_pan_or_deselect'; pointerId: number; startScreen: Point; camera: Camera }
  | { kind: 'pending_select_or_move'; pointerId: number; startScreen: Point; startWorld: Point; item: DrawingElement }
  | { kind: 'pending_select'; pointerId: number; startScreen: Point; camera: Camera; item: DrawingElement }
  | { kind: 'pending_view_select'; pointerId: number; startScreen: Point; camera: Camera; item: DrawingElement }
  | { kind: 'move'; pointerId: number; startWorld: Point; item: DrawingElement }
  | { kind: 'move_group'; pointerId: number; startWorld: Point; items: DrawingElement[] }
  | { kind: 'marquee'; pointerId: number; startWorld: Point; currentWorld: Point }
  | { kind: 'resize'; pointerId: number; startWorld: Point; item: DrawingElement; corner: string }
  | { kind: 'rotate'; pointerId: number; center: Point; initialAngle: number; initialRotation: number; item: DrawingElement }
  | { kind: 'draw'; pointerId: number; startWorld: Point; endWorld: Point; type: 'rectangle' | 'divider' | 'measure' }
  | { kind: 'pinch'; ids: [number, number]; distance: number; anchor: Point; camera: Camera };

const clone = <T,>(value: T): T => structuredClone(value);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const EMPTY_CAMERA: Camera = { x: 0, y: 0, scale: 1 };
const TOUCH_DRAG_THRESHOLD_PX = 12; // Maior no mobile para evitar arrasto acidental ao tocar

export default function Editor() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('movare-theme') as 'dark' | 'light') || 'dark';
  });

  const [activeId, setActiveId] = useState(initialAreas[0].id);
  const [toast, setToast] = useState('');

  // Autenticação e permissões reais via Supabase Auth + sistema de cargos
  const auth = useAuth();
  const userRole = auth.role;
  const isAdmin = auth.isAdmin;
  const isAssistencia = auth.isAssistencia;
  const isConferente = auth.isConferente;
  const canReservePositions = auth.canReservePositions;
  const canUseConferentePanel = auth.canUseConferentePanel;
  const canManageRoles = auth.canManageRoles;
  const isCommonUser = auth.isCommonUser;
  const isVisitor = auth.isVisitor;

  // Mapa central compartilhado com Realtime e controle otimista de concorrência
  const sharedMap = useSharedMap({
    isAdmin,
    userId: auth.user?.id ?? null,
    activeId,
    onSyncActiveId: setActiveId,
    onNotify: setToast,
  });

  const {
    areas,
    areasRef,
    history,
    future,
    recordAreas,
    patchActive,
    togglePositionReservation,
    undo,
    redo,
  } = sharedMap;

  const activeArea = areas.find((area) => area.id === activeId) ?? areas[0] ?? initialAreas[0];
  const scaleRatio = activeArea?.scaleRatio ?? DEFAULT_SCALE_RATIO;

  // Dimensões dinâmicas do armazém ativo
  const bounds = useMemo(() => getAreaBounds(activeArea), [activeArea]);
  const worldWidth = bounds.widthPx;
  const worldHeight = bounds.heightPx;

  const [tool, setTool] = useState<Tool>(isAdmin ? 'select' : 'pan');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const selected = activeArea?.elements?.find((item) => item.id === selectedId) ?? null;
  const selectedElements = useMemo(() => {
    const set = new Set(selectedIds);
    return activeArea?.elements?.filter((el) => set.has(el.id)) ?? [];
  }, [selectedIds, activeArea?.elements]);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIds(id ? [id] : []);
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const selectGroup = useCallback(
    (groupId: string) => {
      const groupItems = activeArea.elements.filter((el) => (el.groupId || el.id) === groupId);
      if (groupItems.length > 0) {
        setSelectedIds(groupItems.map((el) => el.id));
      }
    },
    [activeArea.elements]
  );

  // Estados para seleção múltipla e física anti-sobreposição
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [marqueeBox, setMarqueeBox] = useState<{ start: Point; current: Point } | null>(null);
  const [groupPreview, setGroupPreview] = useState<DrawingElement[] | null>(null);
  const [collisionContactIds, setCollisionContactIds] = useState<Set<string>>(new Set());

  // Estados para evitar que o menu sobreponha o mapa e garantir movimentação 100% livre
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [freeMoveMode, setFreeMoveMode] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [camera, setCamera] = useState<Camera>(EMPTY_CAMERA);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new window.Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);

  const [preview, setPreview] = useState<DrawingElement | null>(null);
  const [measureLine, setMeasureLine] = useState<{ start: Point; end: Point } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [cursorWorld, setCursorWorld] = useState<Point>({ x: 0, y: 0 });

  const setCameraSafe = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  const constrainCamera = useCallback((next: Camera): Camera => {
    if (!canvasSize.width || !canvasSize.height) return next;
    const visibleMargin = 40;
    const totalWidth = worldWidth + 330;
    const scaledWidth = totalWidth * next.scale;
    const scaledHeight = worldHeight * next.scale;
    return {
      ...next,
      x: Math.max(visibleMargin - scaledWidth, Math.min(canvasSize.width - visibleMargin, next.x)),
      y: Math.max(visibleMargin - scaledHeight, Math.min(canvasSize.height - visibleMargin, next.y)),
    };
  }, [canvasSize.height, canvasSize.width, worldHeight, worldWidth]);

  // Navegação de Precisão CAD (Trava no ponto exato sem escorregamento) vs Inércia
  const [precisionNavMode, setPrecisionNavMode] = useState(true);

  // Física de Navegação Tátil Calibrada com Amortecimento Firme
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const lastMoveTimeRef = useRef(0);
  const lastScreenRef = useRef<Point>({ x: 0, y: 0 });
  const momentumAnimRef = useRef<number | null>(null);

  const stopMomentum = useCallback(() => {
    if (momentumAnimRef.current !== null) {
      cancelAnimationFrame(momentumAnimRef.current);
      momentumAnimRef.current = null;
    }
  }, []);

  const startMomentum = useCallback((initVx: number, initVy: number) => {
    stopMomentum();
    if (precisionNavMode) return;
    let currentVx = Math.max(-1.0, Math.min(1.0, initVx));
    let currentVy = Math.max(-1.0, Math.min(1.0, initVy));
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(32, Math.max(1, now - lastTime));
      lastTime = now;

      // Amortecimento firme (0.80) para desaceleração rápida e controlada
      currentVx *= 0.80;
      currentVy *= 0.80;

      const cam = cameraRef.current;
      const nextCamera = constrainCamera({
        ...cam,
        x: cam.x + currentVx * dt,
        y: cam.y + currentVy * dt,
      });
      setCameraSafe(nextCamera);

      if (Math.hypot(currentVx, currentVy) > 0.08) {
        momentumAnimRef.current = requestAnimationFrame(step);
      } else {
        momentumAnimRef.current = null;
      }
    };

    momentumAnimRef.current = requestAnimationFrame(step);
  }, [constrainCamera, precisionNavMode, setCameraSafe, stopMomentum]);

  // Destaque para busca (persiste até outra interação, navegação pelo mapa não cancela)
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Detalhes do item atualmente destacado para renderização de balão/pin no mapa e banner flutuante
  const highlightedDetails = useMemo(() => {
    if (!highlightId) return null;
    for (const el of activeArea.elements) {
      if (el.id === highlightId) {
        return {
          id: el.id,
          name: el.name,
          code: el.skuCode || el.street || el.name,
          x: el.x + el.width / 2,
          y: el.y + el.height / 2,
          isPosition: false,
        };
      }
      if (el.internalPositions && el.internalPositions.length > 0) {
        const pos = el.internalPositions.find((p) => p.id === highlightId);
        if (pos) {
          const relX = Number.isFinite(pos.relX) ? pos.relX : 0;
          const relY = Number.isFinite(pos.relY) ? pos.relY : 0;
          const relW = Number.isFinite(pos.relWidth) && pos.relWidth > 0 ? pos.relWidth : 25;
          const relH = Number.isFinite(pos.relHeight) && pos.relHeight > 0 ? pos.relHeight : 25;
          return {
            id: pos.id,
            zoneId: el.id,
            name: `${el.name} · ${pos.code}`,
            code: pos.code,
            sku: pos.sku,
            x: el.x + relX + relW / 2,
            y: el.y + relY + relH / 2,
            isPosition: true,
          };
        }
      }
    }
    return null;
  }, [highlightId, activeArea]);

  // Módulos Internos: Posição interna individual selecionada na zona
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const pendingCellTapRef = useRef<{ pos: any; zoneId: string; startScreen: Point; pointerId: number } | null>(null);

  // Modais do Sistema
  const [modal, setModal] = useState<
    'delete' | 'rename' | 'new-area' | 'import' | 'grid' |
    'search' | 'scale' | 'warehouse-size' | 'layers' | 'spotlight' | 'shortcuts' | 'rack-gen' | 'png-export' |
    'auth' | 'access-panel' | 'warehouses' | null
  >(null);
  const [accessPanelTab, setAccessPanelTab] = useState<AccessPanelTab>('overview');
  const openAccessPanel = useCallback((tab: AccessPanelTab = 'overview') => {
    setAccessPanelTab(tab);
    setModal('access-panel');
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated) {
      setMobileMenuOpen(false);
    }
  }, [auth.isAuthenticated]);

  const [warehouseManagerMode, setWarehouseManagerMode] = useState<WarehouseManagerMode>('list');
  const [warehouseManagerEditId, setWarehouseManagerEditId] = useState<string | null>(null);
  const [searchInitialFilter, setSearchInitialFilter] = useState<'all' | 'codes' | 'zones' | 'products' | 'reserved'>('all');
  const [conferentePanelOpen, setConferentePanelOpen] = useState(false);

  // Modo de Edição Individual de Espaço (Sub-Mapa / Foco Isolado)
  const [isolatedSpaceId, setIsolatedSpaceId] = useState<string | null>(null);
  const isolatedSpace = activeArea?.elements?.find((el) => el.id === isolatedSpaceId) ?? null;

  const [renameDraft, setRenameDraft] = useState('');
  const [queuedImport, setQueuedImport] = useState<FloorArea[] | null>(null);
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  const reservedCount = useMemo(() => countReservedPositionsInAreas(areas), [areas]);
  const canSeeReserve = canUserSeeReservationAction(userRole, auth.permissions);
  const canPersistReserve = canUserPersistReservations(
    userRole,
    isAdmin,
    auth.isConfigured,
    auth.permissions
  );

  const handleToggleReservePosition = useCallback(
    async (
      elementId: string,
      positionId: string,
      reservationStore?: string,
      reservationQuantity?: number
    ) => {
      if (!canPersistReserve) {
        setToast('Seu cargo atual não possui permissão para reservar posições.');
        return;
      }
      const responsibleName =
        auth.profile?.fullName?.trim() ||
        auth.user?.email?.trim() ||
        'Operador';
      const res = await togglePositionReservation(elementId, positionId, canPersistReserve, {
        store: reservationStore?.trim() || undefined,
        quantity:
          typeof reservationQuantity === 'number' &&
          Number.isFinite(reservationQuantity) &&
          reservationQuantity > 0
            ? reservationQuantity
            : undefined,
        reservedBy: responsibleName,
        reservedByEmail: auth.user?.email || undefined,
        reservedAt: new Date().toISOString(),
      });
      if (res.changed) {
        if (res.nextStatus === 'reserved') {
          const qtySuffix =
            typeof reservationQuantity === 'number' && reservationQuantity > 0
              ? ` (${reservationQuantity} un)`
              : '';
          const storeSuffix = reservationStore?.trim() ? ` para "${reservationStore.trim()}"` : '';
          setToast(
            !isAdmin && canPersistReserve && auth.isConfigured
              ? `Posição reservada${qtySuffix}${storeSuffix} (sincronizado na nuvem).`
              : `Posição reservada${qtySuffix}${storeSuffix}.`
          );
        } else {
          setToast(
            !isAdmin && canPersistReserve && auth.isConfigured
              ? 'Reserva removida (sincronizado na nuvem).'
              : 'Marcação de reserva removida.'
          );
        }
      }
    },
    [auth.isConfigured, auth.profile?.fullName, auth.user?.email, canPersistReserve, isAdmin, togglePositionReservation]
  );

  // Abre painel operacional automaticamente quando o cargo possui permissão de Conferente
  useEffect(() => {
    setConferentePanelOpen(canUseConferentePanel);
  }, [canUseConferentePanel]);

  // Notifica usuário conectado caso um Administrador altere seu cargo/permissões em tempo real
  const prevCargoKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.id) {
      prevCargoKeyRef.current = null;
      return;
    }
    const nextKey = `${auth.user.id}:${auth.cargoId ?? 'common'}:${auth.permissions.canEditMap}:${auth.permissions.canReservePositions}:${auth.permissions.canUseConferentePanel}:${auth.permissions.canManageRoles}`;
    if (prevCargoKeyRef.current && prevCargoKeyRef.current !== nextKey) {
      setToast(
        auth.cargoName
          ? `Cargo atualizado automaticamente para "${auth.cargoName}".`
          : 'Seu cargo operacional foi removido (modo Usuário Comum).'
      );
    }
    prevCargoKeyRef.current = nextKey;
  }, [auth.cargoId, auth.cargoName, auth.isAuthenticated, auth.permissions, auth.user?.id]);

  // Alternador de Tema
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('movare-theme', next);
      return next;
    });
  }, []);

  // Garante transição segura para modo de consulta/visualização caso o usuário não seja administrador
  useEffect(() => {
    if (!isAdmin) {
      setTool((current) =>
        current === 'pan' || current === 'measure' ? current : 'pan'
      );
      setFreeMoveMode(false);
      setIsMultiSelectMode(false);
      setDesktopSidebarOpen(false);
      setMobileDrawerOpen(false);
      setModal((current) =>
        current === 'delete' ||
        current === 'rename' ||
        current === 'new-area' ||
        current === 'import' ||
        current === 'scale' ||
        current === 'warehouse-size' ||
        current === 'rack-gen' ||
        current === 'warehouses'
          ? null
          : current
      );
    } else {
      setTool((current) => (current === 'pan' && !selectedId ? 'select' : current));
    }
  }, [isAdmin, selectedId]);

  // FitPlan com controle seguro de referência
  const fitPlan = useCallback(() => {
    if (!canvasSize.width || !canvasSize.height) return;
    const padding = window.innerWidth < 640 ? 24 : 60;
    const totalContentWidth = worldWidth + 320;
    const totalContentHeight = Math.max(worldHeight, 480);
    const scale = Math.max(
      0.08,
      Math.min((canvasSize.width - padding) / totalContentWidth, (canvasSize.height - padding) / totalContentHeight, 1.4)
    );
    setCameraSafe({
      scale,
      x: (canvasSize.width - totalContentWidth * scale) / 2,
      y: (canvasSize.height - totalContentHeight * scale) / 2,
    });
  }, [canvasSize.width, canvasSize.height, setCameraSafe, worldHeight, worldWidth]);

  const fitPlanRef = useRef(fitPlan);
  fitPlanRef.current = fitPlan;

  // ResizeObserver para o canvas (resistente à abertura do teclado mobile)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box && box.width > 0 && box.height > 0) {
        // Se o usuário estiver com foco em caixa de texto (teclado aberto), NÃO alterar a posição da câmera
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const isEditingInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

        const previous = canvasSizeRef.current;
        const currentCamera = cameraRef.current;
        if (!isEditingInput && previous.width && previous.height && currentCamera.scale > 0) {
          const centerX = (previous.width / 2 - currentCamera.x) / currentCamera.scale;
          const centerY = (previous.height / 2 - currentCamera.y) / currentCamera.scale;
          setCameraSafe({
            ...currentCamera,
            x: box.width / 2 - centerX * currentCamera.scale,
            y: box.height / 2 - centerY * currentCamera.scale,
          });
        }
        canvasSizeRef.current = { width: box.width, height: box.height };
        setCanvasSize({ width: box.width, height: box.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setCameraSafe]);

  // Enquadra a planta apenas na carga inicial (câmera zerada)
  useEffect(() => {
    if (canvasSize.width && canvasSize.height && camera.scale === 1 && camera.x === 0 && camera.y === 0) {
      fitPlanRef.current();
    }
  }, [canvasSize.width, canvasSize.height, camera.scale, camera.x, camera.y]);

  // Executa SOMENTE quando o usuário troca de Galpão / Área (activeId), sem fechar seleção no resize do teclado!
  useEffect(() => {
    setSelectedId(null);
    setAlignmentGuides([]);
    fitPlanRef.current();
  }, [activeId]);

  // Quando seleciona um elemento, abre menus apenas se estiver no Modo Selecionar
  useEffect(() => {
    if (selectedId && tool === 'select') {
      setMobileDrawerOpen(true);
      setDesktopSidebarOpen(true);
    } else if (tool === 'move') {
      setMobileDrawerOpen(false);
      setDesktopSidebarOpen(false);
      setSelectedPositionId(null);
    } else if (!selectedId) {
      setSelectedPositionId(null);
    }
  }, [selectedId, tool]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectToolSafe = useCallback(
    (nextTool: Tool) => {
      if (!isAdmin && nextTool !== 'pan' && nextTool !== 'measure') {
        setToast('Edição e seleção avançada restritas ao perfil Administrador.');
        return;
      }
      if (nextTool !== 'pan') {
        setHighlightId(null);
      }
      setTool(nextTool);
      setMeasureLine(null);
    },
    [isAdmin]
  );

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal('spotlight');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setModal('png-export');
        return;
      }
      if (e.key === 'F1' || (e.key === '?' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setModal('shortcuts');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!isAdmin) return;
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isAdmin && auth.isConfigured) {
          void sharedMap.flushSaveToCloud();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': if (isAdmin) { setTool('select'); setMeasureLine(null); } break;
        case 'm': if (isAdmin) { setTool('move'); setMeasureLine(null); } break;
        case 'h': setTool('pan'); setMeasureLine(null); break;
        case 'r': if (isAdmin) { setTool('rectangle'); setMeasureLine(null); } break;
        case 'c': if (isAdmin) { setTool('corridor'); setMeasureLine(null); } break;
        case 't': setTool('measure'); break;
        case 'l':
          if (isAdmin && selected) toggleLockSelected();
          break;
        case 'escape':
          setSelectedId(null);
          setSelectedPositionId(null);
          setHighlightId(null);
          setMeasureLine(null);
          setTool(isAdmin ? 'select' : 'pan');
          setModal(null);
          setMobileMenuOpen(false);
          break;
        case 's':
          if (isAdmin) setSnapEnabled((prev) => !prev);
          break;
        case 'f':
          if (isAdmin) setFreeMoveMode((prev) => !prev);
          break;
        case 'arrowleft':
          if (isAdmin && selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(e.shiftKey ? -2 : -0.5, 0);
          }
          break;
        case 'arrowright':
          if (isAdmin && selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(e.shiftKey ? 2 : 0.5, 0);
          }
          break;
        case 'arrowup':
          if (isAdmin && selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(0, e.shiftKey ? -2 : -0.5);
          }
          break;
        case 'arrowdown':
          if (isAdmin && selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(0, e.shiftKey ? 2 : 0.5);
          }
          break;
        case 'delete':
        case 'backspace':
          if (isAdmin && selected && !selected.locked) setModal('delete');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [auth.isConfigured, isAdmin, redo, selected, sharedMap, undo]);

  // Alerta ao tentar fechar a aba com edições locais pendentes de envio para a nuvem
  useEffect(() => {
    if (!isAdmin || !auth.isConfigured || !sharedMap.hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [auth.isConfigured, isAdmin, sharedMap.hasUnsavedChanges]);

  function pointToWorld(clientX: number, clientY: number): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: Math.max(0, Math.min(worldWidth, (clientX - (rect?.left ?? 0) - cam.x) / cam.scale)),
      y: Math.max(0, Math.min(worldHeight, (clientY - (rect?.top ?? 0) - cam.y) / cam.scale)),
    };
  }

  function pointToScreen(clientX: number, clientY: number): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }

  function editItemAtPoint(gesture: Extract<Gesture, { kind: 'move' | 'resize' }>, world: Point): DrawingElement {
    if (gesture.kind === 'move') {
      const dx = world.x - gesture.startWorld.x;
      const dy = world.y - gesture.startWorld.y;
      const minX = gesture.item.type === 'divider' ? Math.max(0, -gesture.item.width) : 0;
      const minY = gesture.item.type === 'divider' ? Math.max(0, -gesture.item.height) : 0;
      return {
        ...gesture.item,
        x: Math.max(minX, Math.min(worldWidth - (gesture.item.type === 'divider' ? 0 : gesture.item.width), gesture.item.x + dx)),
        y: Math.max(minY, Math.min(worldHeight - (gesture.item.type === 'divider' ? 0 : gesture.item.height), gesture.item.y + dy)),
      };
    }

    const item = gesture.item;
    const right = gesture.corner.includes('r') || gesture.corner === 'right';
    const bottom = gesture.corner.includes('b') || gesture.corner === 'bottom';
    const left = gesture.corner.includes('l') || gesture.corner === 'left';
    const top = gesture.corner.includes('t') || gesture.corner === 'top';

    const x = left ? Math.min(item.x + item.width - 4, world.x) : item.x;
    const y = top ? Math.min(item.y + item.height - 4, world.y) : item.y;
    const width = right ? Math.max(4, world.x - item.x) : left ? Math.max(4, item.x + item.width - world.x) : item.width;
    const height = bottom ? Math.max(4, world.y - item.y) : top ? Math.max(4, item.y + item.height - world.y) : item.height;
    return { ...item, x: left ? x : item.x, y: top ? y : item.y, width, height };
  }

  function zoomBy(factor: number, centerScreen?: Point) {
    const cam = cameraRef.current;
    const nextScale = Math.max(0.08, Math.min(4.5, cam.scale * factor));
    const anchor = centerScreen ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    const world = { x: (anchor.x - cam.x) / cam.scale, y: (anchor.y - cam.y) / cam.scale };
    setCameraSafe(constrainCamera({ scale: nextScale, x: anchor.x - world.x * nextScale, y: anchor.y - world.y * nextScale }));
  }

  // Zoom suave e proporcional para rodinha de mouse e trackpad
  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const screen = pointToScreen(e.clientX, e.clientY);
    const rawDelta = e.deltaY;
    const delta = e.deltaMode === 1 ? rawDelta * 16 : e.deltaMode === 2 ? rawDelta * 100 : rawDelta;
    const zoomFactor = Math.max(0.90, Math.min(1.10, 1 - delta * 0.0012));
    zoomBy(zoomFactor, screen);
  }

  function replaceItem(item: DrawingElement) {
    if (!isAdmin) {
      setToast('Modo Visitante: somente leitura.');
      return;
    }
    patchActive((area) => ({
      ...area,
      elements: area.elements.map((candidate) => (candidate.id === item.id ? item : candidate)),
    }));
  }

  // Alterna Bloqueio do Objeto
  function toggleLockSelected() {
    if (!isAdmin || !selected) return;
    const isNowLocked = !selected.locked;
    replaceItem({ ...selected, locked: isNowLocked });
    setToast(isNowLocked ? `🔒 "${selected.name}" bloqueado contra movimentação` : `🔓 "${selected.name}" desbloqueado para edição`);
  }

  // Rotação Tátil Rápida (90 graus)
  function rotateSelectedBy(degrees: number) {
    if (!isAdmin || !selected || selected.locked) return;
    const currentRot = selected.rotation || 0;
    const newRot = (Math.round((currentRot + degrees) / 90) * 90) % 360;
    replaceItem({ ...selected, rotation: (newRot + 360) % 360 });
    setToast(`Girado para ${(newRot + 360) % 360}°`);
  }

  // Ajuste Tátil Fino de Posição (D-Pad Mobile)
  function nudgeSelected(dxM: number, dyM: number) {
    if (!isAdmin || !selected || selected.locked) return;
    const dxPx = dxM * scaleRatio;
    const dyPx = dyM * scaleRatio;
    replaceItem({
      ...selected,
      x: Math.max(0, Math.min(worldWidth - selected.width, selected.x + dxPx)),
      y: Math.max(0, Math.min(worldHeight - selected.height, selected.y + dyPx)),
    });
  }

  // Navegar suavemente até um ponto do mapa (Minimapa e Busca)
  const navigateToPoint = useCallback(
    (targetWorldX: number, targetWorldY: number, targetScale?: number) => {
      const nextScale = targetScale ?? Math.max(cameraRef.current.scale, 0.8);
      const targetCamX = canvasSize.width / 2 - targetWorldX * nextScale;
      const targetCamY = canvasSize.height / 2 - targetWorldY * nextScale;

      setCameraSafe(
        constrainCamera({
          scale: nextScale,
          x: targetCamX,
          y: targetCamY,
        })
      );
    },
    [canvasSize.width, canvasSize.height, constrainCamera, setCameraSafe]
  );

  // Enquadra a câmera diretamente em um elemento ou espaço individual
  const fitToElement = useCallback(
    (item: DrawingElement) => {
      if (!canvasSize.width || !canvasSize.height) return;
      const padding = window.innerWidth < 640 ? 30 : 60;
      const targetScale = Math.max(
        0.18,
        Math.min(
          (canvasSize.width - padding * 2) / Math.max(item.width, 100),
          (canvasSize.height - padding * 2) / Math.max(item.height, 100),
          2.4
        )
      );
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      setCameraSafe(
        constrainCamera({
          scale: targetScale,
          x: canvasSize.width / 2 - cx * targetScale,
          y: canvasSize.height / 2 - cy * targetScale,
        })
      );
    },
    [canvasSize.width, canvasSize.height, constrainCamera, setCameraSafe]
  );


  // Adiciona um rótulo de Identificação de Corredor / Rua na posição exata
  const handleAddCorridorAtPoint = useCallback((worldPoint: Point, defaultText?: string) => {
    if (!isAdmin) {
      setToast('Modo Visitante: criação de corredores restrita a administradores.');
      return;
    }
    const existing = activeArea.elements.filter((el) => el.type === 'corridor');
    const count = existing.length + 1;
    const labelText = defaultText || `CORREDOR ${String(count).padStart(2, '0')}`;
    const fSize = 22;
    const cWidth = Math.max(140, labelText.length * (fSize * 0.65) + 30);
    const cHeight = Math.max(30, fSize * 1.5);

    const corridorItem: DrawingElement = {
      id: createId('corridor'),
      type: 'corridor',
      name: labelText,
      corridorText: labelText,
      color: '#ffffff',
      fontSize: fSize,
      letterSpacing: 4,
      fontWeight: 'extrabold',
      x: Math.max(0, Math.min(worldWidth - cWidth, Math.round(worldPoint.x - cWidth / 2))),
      y: Math.max(0, Math.min(worldHeight - cHeight, Math.round(worldPoint.y - cHeight / 2))),
      width: cWidth,
      height: cHeight,
      rotation: 0,
    };

    patchActive((area) => ({
      ...area,
      elements: [...area.elements, corridorItem],
    }));
    setSelectedId(corridorItem.id);
    setDesktopSidebarOpen(true);
    setMobileDrawerOpen(true);
    setToast(`Corredor "${labelText}" criado na mira.`);
  }, [activeArea.elements, isAdmin, patchActive, setSelectedId, worldHeight, worldWidth]);

  // MANIPULAÇÃO DE TOQUE E PONTEIROS
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    stopMomentum();
    setAlignmentGuides([]);
    const screen = pointToScreen(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, screen);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}

    lastMoveTimeRef.current = performance.now();
    lastScreenRef.current = screen;
    velocityRef.current = { vx: 0, vy: 0 };

    // Zoom por pinch em mobile
    if (pointersRef.current.size >= 2) {
      const [aId, bId] = [...pointersRef.current.keys()].slice(0, 2);
      const a = pointersRef.current.get(aId)!;
      const b = pointersRef.current.get(bId)!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cam = cameraRef.current;
      gestureRef.current = {
        kind: 'pinch',
        ids: [aId, bId],
        distance: Math.max(1, dist(a, b)),
        anchor: { x: (mid.x - cam.x) / cam.scale, y: (mid.y - cam.y) / cam.scale },
        camera: cam,
      };
      setPreview(null);
      setAlignmentGuides([]);
      return;
    }

    const world = pointToWorld(event.clientX, event.clientY);
    if (event.pointerType !== 'touch') {
      setCursorWorld(world);
    }
    const target = event.target as Element;

    // Alça de rotação tátil
    const rotateHandle = target.closest<SVGElement>('[data-rotate-handle]')?.dataset.rotateHandle;
    // Alça de redimensionamento tátil
    const handle = target.closest<SVGElement>('[data-handle]')?.dataset.handle;
    // Elemento clicado
    const itemId = target.closest<SVGElement>('[data-element-id]')?.dataset.elementId;
    let item = activeArea.elements.find((candidate) => candidate.id === itemId);

    // RESTRIÇÃO ESTRITA: Durante o modo foco não se deve interagir com o restante dos itens
    if (isolatedSpaceId) {
      if (item && item.id !== isolatedSpaceId && item.groupId !== isolatedSpaceId) {
        // Bloqueia qualquer clique, seleção ou arrasto de elementos fora do espaço em foco
        item = undefined;
      }
      if (selected && selected.id !== isolatedSpaceId && selected.groupId !== isolatedSpaceId) {
        if (rotateHandle || handle) return;
      }
    }

    // 1. Modo Visualização ('pan'): permite arrastar o mapa livremente OU tocar em um item/célula para ver o resumo simplificado
    if (tool === 'pan') {
      if (item) {
        gestureRef.current = {
          kind: 'pending_view_select',
          pointerId: event.pointerId,
          startScreen: screen,
          camera: cameraRef.current,
          item: clone(item),
        };
        return;
      }
      gestureRef.current = { kind: 'empty_pan_or_deselect', pointerId: event.pointerId, startScreen: screen, camera: cameraRef.current };
      return;
    }

    // 2. Fita métrica
    if (tool === 'measure') {
      setHighlightId(null);
      gestureRef.current = { kind: 'draw', pointerId: event.pointerId, startWorld: world, endWorld: world, type: 'measure' };
      setMeasureLine({ start: world, end: world });
      return;
    }

    // 3. Rotação tátil por alça (apenas Admin no modo mover)
    if (isAdmin && rotateHandle && selected && !selected.locked && tool === 'move') {
      setHighlightId(null);
      const center = { x: selected.x + selected.width / 2, y: selected.y + selected.height / 2 };
      const initialAngle = Math.atan2(world.y - center.y, world.x - center.x) * (180 / Math.PI);
      gestureRef.current = {
        kind: 'rotate',
        pointerId: event.pointerId,
        center,
        initialAngle,
        initialRotation: selected.rotation || 0,
        item: clone(selected),
      };
      return;
    }

    // 4. Redimensionamento por alça (apenas Admin no modo mover)
    if (isAdmin && handle && selected && !selected.locked && tool === 'move') {
      setHighlightId(null);
      gestureRef.current = { kind: 'resize', pointerId: event.pointerId, startWorld: world, item: clone(selected), corner: handle };
      return;
    }

    // 5. Desenho de retângulos ou paredes (apenas Admin)
    if (isAdmin && (tool === 'rectangle' || tool === 'divider')) {
      setHighlightId(null);
      const snapped = snapPointToElements(world, activeArea.elements, cameraRef.current.scale);
      gestureRef.current = { kind: 'draw', pointerId: event.pointerId, startWorld: snapped.point, endWorld: snapped.point, type: tool };
      setAlignmentGuides(snapped.guides);
      setPreview({ id: 'preview', type: tool, name: '', x: snapped.point.x, y: snapped.point.y, width: 1, height: 1 });
      return;
    }

    // 6. Modo Exclusivo de Corredores (apenas Admin)
    if (isAdmin && tool === 'corridor') {
      setHighlightId(null);
      if (item && item.type === 'corridor') {
        setSelectedId(item.id);
        setDesktopSidebarOpen(true);
        setMobileDrawerOpen(true);
        gestureRef.current = null;
        return;
      }
      handleAddCorridorAtPoint(world);
      gestureRef.current = null;
      return;
    }

    // 7. Modo Exclusivo de Mover (apenas Admin)
    if (isAdmin && tool === 'move' && item) {
      setHighlightId(null);
      if (item.locked) {
        setSelectedId(item.id);
        setSelectedPositionId(null);
        gestureRef.current = null;
        setToast(`🔒 "${item.name}" está bloqueado`);
        return;
      }
      setSelectedId(item.id);
      setSelectedPositionId(null);
      setIsDragging(true);
      if (selectedIds.length > 1 && selectedIds.includes(item.id)) {
        gestureRef.current = {
          kind: 'move_group',
          pointerId: event.pointerId,
          startWorld: world,
          items: clone(selectedElements),
        };
      } else {
        gestureRef.current = {
          kind: 'move',
          pointerId: event.pointerId,
          startWorld: world,
          item: clone(item),
        };
      }
      return;
    }

    // 8. Modo Exclusivo de Seleção com Menus Ativos (Apenas seleciona e abre menus após toque sem arrasto)
    if (tool === 'select') {
      if (item) {
        // Registra seleção pendente com threshold tátil: se o usuário arrastar a tela para navegar, move o mapa; se soltar sem arrasto, abre a edição
        gestureRef.current = {
          kind: 'pending_select',
          pointerId: event.pointerId,
          startScreen: screen,
          camera: cameraRef.current,
          item: clone(item),
        };
        return;
      }
      // Navegação pelo mapa com arrasto no vazio não cancela o destaque ou seleção:
      gestureRef.current = { kind: 'empty_pan_or_deselect', pointerId: event.pointerId, startScreen: screen, camera: cameraRef.current };
      return;
    }

    gestureRef.current = { kind: 'pan', pointerId: event.pointerId, startScreen: screen, camera: cameraRef.current };
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const screen = pointToScreen(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, screen);

    // Rastreamento contínuo de velocidade para inércia cinemática fluida
    const now = performance.now();
    const dt = Math.max(1, now - lastMoveTimeRef.current);
    if (dt < 120) {
      const vx = (screen.x - lastScreenRef.current.x) / dt;
      const vy = (screen.y - lastScreenRef.current.y) / dt;
      velocityRef.current = {
        vx: velocityRef.current.vx * 0.35 + vx * 0.65,
        vy: velocityRef.current.vy * 0.35 + vy * 0.65,
      };
    }
    lastMoveTimeRef.current = now;
    lastScreenRef.current = screen;

    const gesture = gestureRef.current;

    // Otimização crucial: só atualiza cursorWorld no hover do mouse, nunca no touch drag para manter 60-120 FPS
    if (!gesture && event.pointerType !== 'touch') {
      const world = pointToWorld(event.clientX, event.clientY);
      setCursorWorld(world);
    }

    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      const first = pointersRef.current.get(gesture.ids[0]);
      const second = pointersRef.current.get(gesture.ids[1]);
      if (!first || !second) return;
      const currentDist = dist(first, second);
      const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const scale = Math.max(0.08, Math.min(4.5, gesture.camera.scale * (currentDist / gesture.distance)));
      setCameraSafe(constrainCamera({ scale, x: mid.x - gesture.anchor.x * scale, y: mid.y - gesture.anchor.y * scale }));
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;

    // Rotação tátil suave
    if (gesture.kind === 'rotate') {
      const world = pointToWorld(event.clientX, event.clientY);
      const currentAngle = Math.atan2(world.y - gesture.center.y, world.x - gesture.center.x) * (180 / Math.PI);
      const deltaAngle = currentAngle - gesture.initialAngle;
      let rawRotation = (gesture.initialRotation + deltaAngle) % 360;
      if (rawRotation < 0) rawRotation += 360;

      // Snap magnético aos ângulos cardeais (0°, 45°, 90°, 180°, 270°)
      const cardinalAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      for (const snap of cardinalAngles) {
        if (Math.abs(rawRotation - snap) <= 6) {
          rawRotation = snap % 360;
          break;
        }
      }

      setPreview({ ...gesture.item, rotation: Math.round(rawRotation) });
      return;
    }

    // Se o movimento for pequeno no início do toque, não entra em modo move até ultrapassar o limiar
    if (gesture.kind === 'pending_select_or_move') {
      const deltaPx = dist(screen, gesture.startScreen);
      // Se o objeto já estiver selecionado, o arrasto é imediato e ultra-sensível (2px)
      const isAlreadySelected = selectedIds.includes(gesture.item.id);
      const threshold = isAlreadySelected ? 2 : 5;
      if (deltaPx > threshold) {
        setIsDragging(true);
        // Se há múltiplos elementos selecionados e o clicado faz parte deles, move o GRUPO mantendo os parâmetros!
        if (selectedIds.length > 1 && selectedIds.includes(gesture.item.id)) {
          gestureRef.current = {
            kind: 'move_group',
            pointerId: event.pointerId,
            startWorld: gesture.startWorld,
            items: clone(selectedElements),
          };
        } else {
          setSelectedId(gesture.item.id);
          gestureRef.current = {
            kind: 'move',
            pointerId: event.pointerId,
            startWorld: gesture.startWorld,
            item: gesture.item,
          };
        }
      }
      return;
    }

    // Limiar tátil anti-toque acidental durante navegação no modo selecionar / visualizar:
    // 10px calibrado para permitir seleção limpa e precisa de células sem converter em pan por engano
    if (gesture.kind === 'pending_select' || gesture.kind === 'pending_view_select') {
      const deltaPx = dist(screen, gesture.startScreen);
      if (deltaPx > 10) {
        if (pendingCellTapRef.current) {
          pendingCellTapRef.current = null;
        }
        gestureRef.current = {
          kind: 'pan',
          pointerId: event.pointerId,
          startScreen: screen,
          camera: cameraRef.current,
        };
      }
      return;
    }

    if (pendingCellTapRef.current) {
      const cellDelta = dist(screen, pendingCellTapRef.current.startScreen);
      if (cellDelta > 10) {
        pendingCellTapRef.current = null;
      }
    }

    const world = pointToWorld(event.clientX, event.clientY);

    if (gesture.kind === 'pan' || gesture.kind === 'empty_pan_or_deselect') {
      setCameraSafe(
        constrainCamera({
          ...gesture.camera,
          x: gesture.camera.x + screen.x - gesture.startScreen.x,
          y: gesture.camera.y + screen.y - gesture.startScreen.y,
        })
      );
    } else if (gesture.kind === 'move_group') {
      setIsDragging(true);
      const rawDx = world.x - gesture.startWorld.x;
      const rawDy = world.y - gesture.startWorld.y;

      let groupDx = rawDx;
      let groupDy = rawDy;

      if (physicsEnabled) {
        const groupIds = new Set(gesture.items.map((it) => it.id));
        const obstacles = getSolidObstacles(activeArea.elements, groupIds);
        const resolved = resolveGroupPhysics(gesture.items, { dx: rawDx, dy: rawDy }, obstacles, worldWidth, worldHeight);
        groupDx = resolved.dx;
        groupDy = resolved.dy;
        if (resolved.collided) {
          try { navigator.vibrate?.(4); } catch {}
        }
      }

      const movedGroup = gesture.items.map((it) => ({
        ...it,
        x: Math.round(it.x + groupDx),
        y: Math.round(it.y + groupDy),
      }));
      setGroupPreview(movedGroup);
    } else if (gesture.kind === 'move' || gesture.kind === 'resize') {
      setIsDragging(true);
      const edited = editItemAtPoint(gesture, world);
      const snapped =
        gesture.kind === 'resize'
          ? (snapEnabled ? snapResizedRectangle(edited, gesture.corner, activeArea.elements, cameraRef.current.scale, worldWidth, worldHeight, scaleRatio) : { item: edited, guides: [] })
          : (snapEnabled ? snapMovedElement(edited, activeArea.elements, cameraRef.current.scale, worldWidth, worldHeight) : { item: edited, guides: [] });

      // FÍSICA ANTI-SOBREPOSIÇÃO: Espaços criados não podem sobrepor outros espaços
      if (gesture.kind === 'move' && physicsEnabled && isSolidSpace(snapped.item)) {
        const obstacles = getSolidObstacles(activeArea.elements, new Set([snapped.item.id]));
        const resolved = resolveSpacePhysics(gesture.item, { x: snapped.item.x, y: snapped.item.y }, obstacles, worldWidth, worldHeight);
        setPreview({ ...snapped.item, x: resolved.x, y: resolved.y });
        if (resolved.collided && resolved.contactObstacleId) {
          setCollisionContactIds(new Set([resolved.contactObstacleId]));
        } else {
          setCollisionContactIds(new Set());
        }
      } else {
        setPreview(snapped.item);
        setCollisionContactIds(new Set());
      }

      if (snapEnabled && snapped.guides.length > 0 && alignmentGuides.length === 0) {
        try { navigator.vibrate?.(6); } catch {}
      }
      setAlignmentGuides(snapped.guides);
    } else if (gesture.kind === 'draw') {
      if (gesture.type === 'measure') {
        setMeasureLine({ start: gesture.startWorld, end: world });
        return;
      }

      const snapped = snapPointToElements(world, activeArea.elements, cameraRef.current.scale);
      gestureRef.current = { ...gesture, endWorld: snapped.point };
      setAlignmentGuides(snapped.guides);
      if (gesture.type === 'rectangle') {
        setPreview({
          id: 'preview',
          type: gesture.type,
          name: '',
          x: Math.min(gesture.startWorld.x, snapped.point.x),
          y: Math.min(gesture.startWorld.y, snapped.point.y),
          width: Math.max(1, Math.abs(snapped.point.x - gesture.startWorld.x)),
          height: Math.max(1, Math.abs(snapped.point.y - gesture.startWorld.y)),
        });
      } else {
        setPreview({
          id: 'preview',
          type: gesture.type,
          name: '',
          x: gesture.startWorld.x,
          y: gesture.startWorld.y,
          width: snapped.point.x - gesture.startWorld.x,
          height: snapped.point.y - gesture.startWorld.y,
        });
      }
    }
  }

  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      // Se ainda resta um dedo na tela após o pinch, continua navegando suavemente em pan
      if (pointersRef.current.size === 1) {
        const remainingId = [...pointersRef.current.keys()][0];
        const remainingScreen = pointersRef.current.get(remainingId)!;
        gestureRef.current = {
          kind: 'pan',
          pointerId: remainingId,
          startScreen: remainingScreen,
          camera: cameraRef.current,
        };
        lastMoveTimeRef.current = performance.now();
        lastScreenRef.current = remainingScreen;
        velocityRef.current = { vx: 0, vy: 0 };
        return;
      }
      gestureRef.current = null;
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;

    // Se liberou no modo empty_pan_or_deselect (arrasto no vazio = navegação pelo mapa; toque parado no vazio = desmarcar e limpar destaque)
    if (gesture.kind === 'empty_pan_or_deselect') {
      const deltaPx = dist(pointToScreen(event.clientX, event.clientY), gesture.startScreen);
      if (deltaPx <= 7) {
        if (highlightId) {
          setHighlightId(null);
        }
        if (!isolatedSpaceId) {
          setSelectedId(null);
          setSelectedPositionId(null);
        }
      } else {
        const now = performance.now();
        const isTouch = event.pointerType === 'touch';
        const timeSinceMove = now - lastMoveTimeRef.current;
        const speed = Math.hypot(velocityRef.current.vx, velocityRef.current.vy);
        if (!precisionNavMode && isTouch && speed >= 0.75 && timeSinceMove < 45) {
          startMomentum(velocityRef.current.vx, velocityRef.current.vy);
        }
      }
      pendingCellTapRef.current = null;
      gestureRef.current = null;
      return;
    }

    // Se liberou no modo pan direto (Mão ou arrasto contínuo)
    if (gesture.kind === 'pan') {
      const now = performance.now();
      const isTouch = event.pointerType === 'touch';
      const timeSinceMove = now - lastMoveTimeRef.current;
      const speed = Math.hypot(velocityRef.current.vx, velocityRef.current.vy);
      if (!precisionNavMode && isTouch && speed >= 0.75 && timeSinceMove < 45) {
        startMomentum(velocityRef.current.vx, velocityRef.current.vy);
      }
      pendingCellTapRef.current = null;
      gestureRef.current = null;
      return;
    }

    // Se liberou no modo pending_select ou pending_view_select (toque limpo e intencional sem arrasto no mapa)
    if (gesture.kind === 'pending_select' || gesture.kind === 'pending_view_select') {
      const isViewMode = gesture.kind === 'pending_view_select';
      const deltaPx = dist(pointToScreen(event.clientX, event.clientY), gesture.startScreen);
      if (deltaPx <= 7) {
        // Qualquer toque intencional no mapa encerra o contorno pulsante de busca
        if (highlightId) {
          setHighlightId(null);
        }
        // Se houve toque em célula interna sem arrasto, seleciona a célula
        if (pendingCellTapRef.current && pendingCellTapRef.current.pointerId === event.pointerId) {
          const { pos, zoneId } = pendingCellTapRef.current;
          setSelectedId(zoneId);
          setSelectedPositionId(pos.id);
          if (!isViewMode) {
            setDesktopSidebarOpen(true);
            setMobileDrawerOpen(true);
            setToast(
              isAdmin
                ? `Posição ${pos.code} selecionada para edição individual.`
                : `Posição ${pos.code} selecionada para consulta.`
            );
          }
        } else {
          // Toque no elemento / zona
          setSelectedId(gesture.item.id);
          setSelectedPositionId(null);
          if (!isViewMode) {
            setDesktopSidebarOpen(true);
            setMobileDrawerOpen(true);
          }
        }
      }
      pendingCellTapRef.current = null;
      gestureRef.current = null;
      return;
    }

    if (pendingCellTapRef.current && pendingCellTapRef.current.pointerId === event.pointerId) {
      const deltaPx = dist(pointToScreen(event.clientX, event.clientY), pendingCellTapRef.current.startScreen);
      if (deltaPx <= 7) {
        if (highlightId) {
          setHighlightId(null);
        }
        const { pos, zoneId } = pendingCellTapRef.current;
        setSelectedId(zoneId);
        setSelectedPositionId(pos.id);
        setDesktopSidebarOpen(true);
        setMobileDrawerOpen(true);
        setToast(
          isAdmin
            ? `Posição ${pos.code} selecionada para edição individual.`
            : `Posição ${pos.code} selecionada para consulta.`
        );
      }
      pendingCellTapRef.current = null;
    }

    // Se liberou ainda no estado pending_select_or_move, é um TOQUE / SELEÇÃO LIMPA!
    if (gesture.kind === 'pending_select_or_move') {
      if (highlightId) {
        setHighlightId(null);
      }
      if (isMultiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey) {
        toggleSelectId(gesture.item.id);
      } else {
        setSelectedId(gesture.item.id);
      }
      gestureRef.current = null;
      return;
    }

    // Aplicação da rotação tátil
    if (gesture.kind === 'rotate') {
      if (preview && preview.rotation !== undefined) {
        replaceItem({ ...gesture.item, rotation: preview.rotation });
      }
      gestureRef.current = null;
      setPreview(null);
      return;
    }

    if (gesture.kind === 'draw' && pointersRef.current.size < 2) {
      if (gesture.type === 'measure') {
        gestureRef.current = null;
        return;
      }

      const end = snapPointToElements(pointToWorld(event.clientX, event.clientY), activeArea.elements, cameraRef.current.scale).point;
      const lineDx = end.x - gesture.startWorld.x;
      const lineDy = end.y - gesture.startWorld.y;
      const rectX = Math.min(gesture.startWorld.x, end.x);
      const rectY = Math.min(gesture.startWorld.y, end.y);
      const rectWidth = Math.abs(lineDx);
      const rectHeight = Math.abs(lineDy);

      if (gesture.type === 'rectangle' ? rectWidth > 6 && rectHeight > 6 : Math.hypot(lineDx, lineDy) > 6) {
        const number = activeArea.elements.filter((item) => item.type === gesture.type).length + 1;
        const item: DrawingElement = {
          id: createId(gesture.type),
          type: gesture.type,
          name: `${gesture.type === 'rectangle' ? 'Zona' : 'Parede'} ${number}`,
          color: gesture.type === 'rectangle' ? '#0284c7' : '#475569',
          x: gesture.type === 'rectangle' ? rectX : gesture.startWorld.x,
          y: gesture.type === 'rectangle' ? rectY : gesture.startWorld.y,
          width: gesture.type === 'rectangle' ? rectWidth : lineDx,
          height: gesture.type === 'rectangle' ? rectHeight : lineDy,
          productSize: 'pallet',
          category: 'general',
        };
        patchActive((area) => ({ ...area, elements: [...area.elements, item] }));
        setSelectedId(item.id);
        setTool('select');
      }
    } else if (gesture.kind === 'move_group') {
      const rawDx = pointToWorld(event.clientX, event.clientY).x - gesture.startWorld.x;
      const rawDy = pointToWorld(event.clientX, event.clientY).y - gesture.startWorld.y;

      let groupDx = rawDx;
      let groupDy = rawDy;

      if (physicsEnabled) {
        const groupIds = new Set(gesture.items.map((it) => it.id));
        const obstacles = getSolidObstacles(activeArea.elements, groupIds);
        const resolved = resolveGroupPhysics(gesture.items, { dx: rawDx, dy: rawDy }, obstacles, worldWidth, worldHeight);
        groupDx = resolved.dx;
        groupDy = resolved.dy;
      }

      if (groupDx !== 0 || groupDy !== 0) {
        const movedMap = new Map<string, { x: number; y: number }>();
        gesture.items.forEach((it) => {
          movedMap.set(it.id, {
            x: Math.round(it.x + groupDx),
            y: Math.round(it.y + groupDy),
          });
        });

        patchActive((area) => ({
          ...area,
          elements: area.elements.map((el) => {
            const next = movedMap.get(el.id);
            return next ? { ...el, x: next.x, y: next.y } : el;
          }),
        }));
      }
      setGroupPreview(null);
      setCollisionContactIds(new Set());
    } else if (gesture.kind === 'move' || gesture.kind === 'resize') {
      const initial = editItemAtPoint(gesture, pointToWorld(event.clientX, event.clientY));
      const snapped =
        gesture.kind === 'resize'
          ? (snapEnabled ? snapResizedRectangle(initial, gesture.corner, activeArea.elements, cameraRef.current.scale, worldWidth, worldHeight, scaleRatio).item : initial)
          : (snapEnabled ? snapMovedElement(initial, activeArea.elements, cameraRef.current.scale, worldWidth, worldHeight).item : initial);

      let finalItem = snapped;
      if (gesture.kind === 'move' && physicsEnabled && isSolidSpace(snapped)) {
        const obstacles = getSolidObstacles(activeArea.elements, new Set([snapped.id]));
        const resolved = resolveSpacePhysics(gesture.item, { x: snapped.x, y: snapped.y }, obstacles, worldWidth, worldHeight);
        finalItem = { ...snapped, x: resolved.x, y: resolved.y };
      }

      if (
        finalItem.x !== gesture.item.x ||
        finalItem.y !== gesture.item.y ||
        finalItem.width !== gesture.item.width ||
        finalItem.height !== gesture.item.height
      ) {
        if (gesture.kind === 'resize' && finalItem.type === 'rectangle' && (finalItem.internalPositions?.length || finalItem.internalLayout)) {
          const resizeResult = recalculatePositionsOnZoneResize(
            finalItem,
            scaleRatio,
            finalItem.internalLayout,
            finalItem.internalPositions || []
          );
          finalItem = {
            ...finalItem,
            internalPositions: resizeResult.positions,
            overflowPositions: resizeResult.overflowOccupiedPositions.length > 0
              ? resizeResult.overflowOccupiedPositions
              : finalItem.overflowPositions,
          };
          if (resizeResult.hasLossWarning) {
            setToast(`Atenção: Dimensões reduzidas. ${resizeResult.overflowOccupiedPositions.length} posições com estoque foram retidas com segurança no overflow.`);
          }
        }
        replaceItem(finalItem);
      }
      setCollisionContactIds(new Set());
    }

    gestureRef.current = null;
    setPreview(null);
    setGroupPreview(null);
    setAlignmentGuides([]);
    setIsDragging(false);
  }

  function pointerCancel(event: PointerEvent<SVGSVGElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1 && gestureRef.current?.kind === 'pinch') {
      const remainingId = [...pointersRef.current.keys()][0];
      const remainingScreen = pointersRef.current.get(remainingId)!;
      gestureRef.current = {
        kind: 'pan',
        pointerId: remainingId,
        startScreen: remainingScreen,
        camera: cameraRef.current,
      };
      return;
    }
    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setPreview(null);
      setGroupPreview(null);
      setAlignmentGuides([]);
      setIsDragging(false);
    }
  }

  const duplicateSelected = () => {
    if (!isAdmin || !selected) return;
    const newZoneId = createId(selected.type);
    const copyPositions = selected.internalPositions?.map((pos, pIdx) => ({
      ...pos,
      id: generateStablePositionId(newZoneId, pIdx + 1),
    }));
    const copyItem: DrawingElement = {
      ...clone(selected),
      id: newZoneId,
      internalPositions: copyPositions,
      name: `${selected.name} (Cópia)`,
      x: Math.min(worldWidth - selected.width, selected.x + 30),
      y: Math.min(worldHeight - selected.height, selected.y + 30),
      locked: false,
    };
    patchActive((area) => ({ ...area, elements: [...area.elements, copyItem] }));
    setSelectedId(copyItem.id);
    setToast(`"${copyItem.name}" duplicado.`);
  };

  // Salva novas dimensões do galpão (WarehouseSizeDialog)
  // As zonas diminuem proporcionalmente mantendo posição e 100% dos produtos internos sem deformar o formato
  const handleSaveWarehouseDimensions = (newWMeters: number, newHMeters: number, scaleElements: boolean = true) => {
    if (!isAdmin) return;
    const oldBounds = getAreaBounds(activeArea);
    const oldWPx = oldBounds.widthPx;
    const oldHPx = oldBounds.heightPx;
    const newWPx = Math.round(newWMeters * scaleRatio);
    const newHPx = Math.round(newHMeters * scaleRatio);

    if (newWPx === oldWPx && newHPx === oldHPx) return;

    const scaleFactorX = newWPx / oldWPx;
    const scaleFactorY = newHPx / oldHPx;

    // Fator uniforme para garantir ZERO deformação (proporções e aspecto da zona 100% inalterados)
    // Se o barracão estiver diminuindo, reduz proporcionalmente com a menor razão para caber perfeitamente
    const isShrinking = scaleFactorX < 1 || scaleFactorY < 1;
    const uniformScale = scaleElements
      ? (isShrinking ? Math.min(scaleFactorX, scaleFactorY) : 1)
      : 1;

    patchActive((area) => {
      const updatedElements = area.elements.map((el) => {
        // Nova largura e altura proporcionais com fator uniforme: a zona NÃO se deforma!
        const newWidth = Math.max(12, Math.round(el.width * uniformScale));
        const newHeight = Math.max(12, Math.round(el.height * uniformScale));

        // Mapeamento proporcional de posição: preserva a localização relativa no barracão
        const relCenterX = (el.x + el.width / 2) / oldWPx;
        const relCenterY = (el.y + el.height / 2) / oldHPx;

        const targetCenterX = relCenterX * newWPx;
        const targetCenterY = relCenterY * newHPx;

        let newX = Math.round(targetCenterX - newWidth / 2);
        let newY = Math.round(targetCenterY - newHeight / 2);

        // Limita para que nenhuma zona fique fora do perímetro do novo barracão
        newX = Math.max(0, Math.min(Math.max(0, newWPx - newWidth), newX));
        newY = Math.max(0, Math.min(Math.max(0, newHPx - newHeight), newY));

        // Posições internas: mantém 100% da quantidade, códigos e produtos internos intactos
        const updatedInternalPositions = el.internalPositions?.map((pos) => {
          const newRelX = Math.round(pos.relX * uniformScale * 10) / 10;
          const newRelY = Math.round(pos.relY * uniformScale * 10) / 10;
          const newRelW = Math.max(4, Math.round(pos.relWidth * uniformScale * 10) / 10);
          const newRelH = Math.max(4, Math.round(pos.relHeight * uniformScale * 10) / 10);

          return {
            ...pos,
            relX: newRelX,
            relY: newRelY,
            relWidth: newRelW,
            relHeight: newRelH,
            widthMeters: Math.round((newRelW / scaleRatio) * 100) / 100,
            depthMeters: Math.round((newRelH / scaleRatio) * 100) / 100,
          };
        });

        const updatedInternalLayout = el.internalLayout
          ? {
              ...el.internalLayout,
              unitWidthMeters: el.internalLayout.unitWidthMeters ? Math.round(el.internalLayout.unitWidthMeters * uniformScale * 100) / 100 : undefined,
              unitDepthMeters: el.internalLayout.unitDepthMeters ? Math.round(el.internalLayout.unitDepthMeters * uniformScale * 100) / 100 : undefined,
              rowDepthMeters: el.internalLayout.rowDepthMeters ? Math.round(el.internalLayout.rowDepthMeters * uniformScale * 100) / 100 : undefined,
              clearanceMeters: el.internalLayout.clearanceMeters ? Math.round(el.internalLayout.clearanceMeters * uniformScale * 100) / 100 : undefined,
              marginMeters: el.internalLayout.marginMeters ? Math.round(el.internalLayout.marginMeters * uniformScale * 100) / 100 : undefined,
            }
          : undefined;

        if (el.type === 'corridor') {
          return {
            ...el,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            fontSize: el.fontSize ? Math.max(7, Math.round(el.fontSize * uniformScale)) : undefined,
          };
        }

        return {
          ...el,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          internalPositions: updatedInternalPositions,
          internalLayout: updatedInternalLayout,
        };
      });

      return {
        ...area,
        widthMeters: newWMeters,
        heightMeters: newHMeters,
        elements: updatedElements,
      };
    });

    setToast(
      `Galpão alterado para ${newWMeters}m × ${newHMeters}m. As zonas e posições internas foram ajustadas proporcionalmente sem deformação.`
    );
    setTimeout(() => fitPlan(), 120);
  };

  // Atualiza porte do volume / categoria e recalcula posições internas dividindo a área automaticamente
  const handleUpdateZoneVolumeType = (newProductSize: ProductSize, newCategory?: string) => {
    if (!isAdmin || !selected || selected.type !== 'rectangle') return;
    const updated = applyVolumePresetToZone(selected, newProductSize, scaleRatio);
    if (newCategory) {
      updated.category = newCategory;
    }
    replaceItem(updated);
    setToast(`Porte do volume alterado para ${newProductSize}: Divisões criadas automaticamente!`);
  };

  // Navega até resultado de busca entrando automaticamente em Modo Visualização (destaque persiste até outra interação)
  const handleNavigateToSearchResult = (result: SearchResult) => {
    if (result.areaId !== activeId) {
      setActiveId(result.areaId);
    }
    const targetX = result.x + result.width / 2;
    const targetY = result.y + result.height / 2;
    navigateToPoint(targetX, targetY, 1.4);
    setTool('pan');
    setMeasureLine(null);
    setDesktopSidebarOpen(false);
    setMobileDrawerOpen(false);
    setSelectedId(result.elementId);
    if (result.positionId) {
      setSelectedPositionId(result.positionId);
      setHighlightId(result.positionId);
      setToast(`Modo Visualização · Código localizado: ${result.positionCode || result.address}`);
    } else {
      setSelectedPositionId(null);
      setHighlightId(result.elementId);
      setToast(`Modo Visualização · Zona localizada: ${result.elementName}`);
    }
    // O destaque não possui temporizador e permanece ativo até outra ação do usuário!
  };

  const openWarehouseManager = useCallback(
    (mode: WarehouseManagerMode = 'list', editAreaId: string | null = null) => {
      if (!isAdmin) {
        setToast('Apenas administradores podem criar, editar ou excluir galpões.');
        return;
      }
      setWarehouseManagerMode(mode);
      setWarehouseManagerEditId(editAreaId);
      setModal('warehouses');
    },
    [isAdmin]
  );

  // Cria nova área (personalizada ou padrão)
  const handleCreateWarehouse = (input?: {
    name?: string;
    widthMeters?: number;
    heightMeters?: number;
    scaleRatio?: number;
    activate?: boolean;
  }) => {
    if (!isAdmin) {
      setToast('Apenas administradores podem criar novos galpões.');
      return;
    }
    const newArea = buildNewWarehouse(areas, input);
    if (recordAreas([...areas, newArea])) {
      if (input?.activate !== false) {
        setActiveId(newArea.id);
        setSelectedId(null);
        setSelectedPositionId(null);
        setHighlightId(null);
        setIsolatedSpaceId(null);
      }
      setToast(`Galpão "${newArea.name}" criado.`);
      if (input?.activate !== false) {
        setTimeout(() => fitPlan(), 120);
      }
    }
  };

  // Atualiza nome, dimensões e escala de um galpão existente
  const handleUpdateWarehouse = (
    areaId: string,
    updates: {
      name: string;
      widthMeters: number;
      heightMeters: number;
      scaleRatio: number;
      scaleElements: boolean;
    }
  ) => {
    if (!isAdmin) {
      setToast('Apenas administradores podem editar galpões.');
      return;
    }
    const target = areas.find((a) => a.id === areaId);
    if (!target) return;

    const updatedArea = updateWarehouseArea(target, updates);
    const nextAreas = areas.map((a) => (a.id === areaId ? updatedArea : a));
    if (recordAreas(nextAreas)) {
      setToast(`Galpão "${updatedArea.name}" atualizado.`);
      if (areaId === activeId) {
        setTimeout(() => fitPlan(), 120);
      }
    }
  };

  // Exclui um galpão garantindo que ao menos 1 permaneça ativo
  const handleDeleteWarehouse = (areaId: string) => {
    if (!isAdmin) {
      setToast('Apenas administradores podem excluir galpões.');
      return;
    }
    const result = deleteWarehouseArea(areas, areaId, activeId);
    if (!result) {
      setToast('É obrigatório manter pelo menos 1 galpão cadastrado no sistema.');
      return;
    }
    if (recordAreas(result.areas)) {
      if (result.nextActiveId !== activeId) {
        setActiveId(result.nextActiveId);
        setSelectedId(null);
        setSelectedPositionId(null);
        setHighlightId(null);
        setIsolatedSpaceId(null);
        setTimeout(() => fitPlan(), 120);
      }
      setToast(`Galpão "${result.deletedArea.name}" excluído.`);
    }
  };

  const exportBackup = () => {
    const data = {
      format: 'movare-localizador-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      areas,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `movare-wms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Backup exportado com sucesso.');
  };

  const readImport = (file?: File) => {
    if (!file) return;
    if (!isAdmin) {
      setToast('Modo Visitante: importação de backup restrita a administradores.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseBackup(e.target?.result as string);
        setQueuedImport(parsed);
        setModal('import');
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Falha ao importar backup.');
      }
    };
    reader.readAsText(file);
  };

  const applyImport = () => {
    if (!isAdmin || !queuedImport) return;
    if (recordAreas(queuedImport)) {
      if (queuedImport[0]?.id) setActiveId(queuedImport[0].id);
      setQueuedImport(null);
      setModal(null);
      setToast('Backup restaurado e enviado para sincronização central.');
    }
  };

  // Ações do Spotlight Command Palette
  const handleSpotlightAction = useCallback((action: SpotlightCommandAction) => {
    const adminOnlyActions: SpotlightCommandAction[] = [
      'new_warehouse',
      'manage_warehouses',
      'resize_warehouse',
      'import_backup',
      'open_calibration',
      'mode_move',
      'mode_zone',
      'mode_corridor',
    ];
    if (!isAdmin && adminOnlyActions.includes(action)) {
      setToast('Ação restrita a administradores.');
      return;
    }

    switch (action) {
      case 'new_warehouse':
        openWarehouseManager('create');
        break;
      case 'manage_warehouses':
        openWarehouseManager('list');
        break;
      case 'resize_warehouse':
        setModal('warehouse-size');
        break;
      case 'fit_plan':
        fitPlan();
        setToast('Planta enquadrada');
        break;
      case 'open_layers':
        setModal('layers');
        break;
      case 'toggle_theme':
        toggleTheme();
        break;
      case 'export_png':
        setModal('png-export');
        break;
      case 'export_backup':
        exportBackup();
        break;
      case 'import_backup':
        fileInputRef.current?.click();
        break;
      case 'open_calibration':
        setModal('scale');
        break;
      case 'open_shortcuts':
        setModal('shortcuts');
        break;
      case 'mode_select':
        setHighlightId(null);
        setTool('select');
        setMeasureLine(null);
        setToast('Modo Seleção Ativado');
        break;
      case 'mode_move':
        setHighlightId(null);
        setTool('move');
        setMeasureLine(null);
        setToast('Modo Mover Ativado');
        break;
      case 'mode_pan':
        setTool('pan');
        setMeasureLine(null);
        setToast('Modo Navegar Ativado');
        break;
      case 'mode_zone':
        setHighlightId(null);
        setTool('rectangle');
        setMeasureLine(null);
        setToast('Modo Nova Zona: Arraste no mapa');
        break;
      case 'mode_corridor':
        setHighlightId(null);
        setTool('corridor');
        setMeasureLine(null);
        setToast('Modo Corredores: Clique no mapa');
        break;
      case 'mode_measure':
        setHighlightId(null);
        setTool('measure');
        setToast('Fita Métrica: Clique em dois pontos');
        break;
    }
  }, [fitPlan, isAdmin, openWarehouseManager, toggleTheme]);

  const handleSpotlightNavigate = useCallback(
    (
      targetAreaId: string,
      elementId: string,
      x: number,
      y: number,
      name: string,
      _code?: string,
      positionId?: string
    ) => {
      if (targetAreaId !== activeId) {
        setActiveId(targetAreaId);
      }
      setTool('pan');
      setMeasureLine(null);
      setDesktopSidebarOpen(false);
      setMobileDrawerOpen(false);
      setSelectedId(elementId);
      if (positionId) {
        setSelectedPositionId(positionId);
        setHighlightId(positionId);
      } else {
        setSelectedPositionId(null);
        setHighlightId(elementId);
      }
      navigateToPoint(x, y, 1.4);
      setToast(`Modo Visualização · Localizado: ${name}`);
    },
    [activeId, navigateToPoint, setSelectedId]
  );

  // Medição métrica ativa
  const measureDistanceM = useMemo(() => {
    if (!measureLine) return null;
    const px = Math.hypot(measureLine.end.x - measureLine.start.x, measureLine.end.y - measureLine.start.y);
    return (px / scaleRatio).toFixed(2);
  }, [measureLine, scaleRatio]);

  const isDark = theme === 'dark';
  const visibleItems = preview?.id === 'preview' ? [...activeArea.elements, preview] : activeArea.elements;

  return (
    <div
      className={`fixed inset-0 h-[100dvh] w-full flex flex-col overflow-hidden select-none font-sans ${
        isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* 1. TOP COMMAND BAR 4.0 (BARRA COMPACTA COM GAVETAS INTELIGENTES) */}
      <TopCommandBar
        areas={areas}
        activeAreaId={activeId}
        onSelectArea={(id) => {
          setActiveId(id);
          setHighlightId(null);
        }}
        onCreateNewArea={() => openWarehouseManager('create')}
        onOpenWarehouseManager={() => openWarehouseManager('list')}
        bounds={bounds}
        scaleRatio={scaleRatio}
        onOpenResizeDialog={() => isAdmin && setModal('warehouse-size')}
        onOpenScaleDialog={() => isAdmin && setModal('scale')}
        tool={tool}
        onSelectTool={(t) => {
          selectToolSafe(t);
          if (t === 'select') setToast('Modo Seleção Ativado');
        }}
        snapEnabled={snapEnabled}
        onToggleSnap={() => isAdmin && setSnapEnabled(!snapEnabled)}
        physicsEnabled={physicsEnabled}
        onTogglePhysics={() => isAdmin && setPhysicsEnabled(!physicsEnabled)}
        multiSelectMode={isMultiSelectMode}
        onToggleMultiSelect={() => isAdmin && setIsMultiSelectMode(!isMultiSelectMode)}
        precisionNavMode={precisionNavMode}
        onTogglePrecisionNav={() => {
          setPrecisionNavMode((prev) => {
            const next = !prev;
            setToast(next ? 'Precisão CAD Ativada (Sem inércia)' : 'Inércia Tátil Ativada');
            return next;
          });
        }}
        canUndo={isAdmin && history.length > 0}
        onUndo={undo}
        canRedo={isAdmin && future.length > 0}
        onRedo={redo}
        onOpenSpotlight={() => {
          if (isAdmin) {
            setModal('spotlight');
          } else {
            setSearchInitialFilter('all');
            setModal('search');
          }
        }}
        onOpenSearch={() => {
          setSearchInitialFilter('all');
          setModal('search');
        }}
        onOpenReservedSearch={() => {
          setSearchInitialFilter('reserved');
          setModal('search');
        }}
        reservedCount={reservedCount}
        onToggleConferentePanel={() => setConferentePanelOpen((prev) => !prev)}
        conferentePanelOpen={conferentePanelOpen}
        onOpenLayers={() => setModal('layers')}
        onOpenShortcuts={() => setModal('shortcuts')}
        onOpenPngExport={() => setModal('png-export')}
        onExportBackup={exportBackup}
        onImportBackup={() => isAdmin && fileInputRef.current?.click()}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        selectedElementCount={selectedIds.length}
        sidebarOpen={desktopSidebarOpen}
        onToggleSidebar={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        userRole={userRole}
        cargoName={auth.cargoName}
        cargoColor={auth.cargoColor}
        profile={auth.profile}
        permissions={auth.permissions}
        canManageRoles={canManageRoles}
        canReserve={canReservePositions}
        canUseConferente={canUseConferentePanel}
        isCommonUser={isCommonUser}
        isAdmin={isAdmin}
        userEmail={auth.user?.email ?? null}
        connectionStatus={sharedMap.connectionStatus}
        syncStatus={sharedMap.syncStatus}
        mapVersion={sharedMap.mapVersion}
        hasUnsavedChanges={sharedMap.hasUnsavedChanges}
        onSaveToCloud={() => void sharedMap.flushSaveToCloud()}
        onOpenAccessPanel={(tab = 'overview') => openAccessPanel(tab)}
        onRefreshAccess={auth.refreshRole}
        onLogout={auth.logout}
        onOpenLogin={() => setModal('auth')}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void readImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* 2. ÁREA CENTRAL: CANVAS VIEWPORT EM TELA TOTAL (MAXIMIZADO) */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* RÉGUA HORIZONTAL (APENAS DESKTOP MD+) */}
          <div
            className={`h-5 pl-5 border-b z-10 shrink-0 overflow-hidden hidden md:block ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <CADRuler
              orientation="horizontal"
              size={canvasSize.width}
              cameraOffset={camera.x}
              cameraScale={camera.scale}
              scaleRatio={scaleRatio}
              isDark={isDark}
            />
          </div>

          <div className="flex-1 flex overflow-hidden relative">
            {/* RÉGUA VERTICAL (APENAS DESKTOP MD+) */}
            <div
              className={`w-5 border-r z-10 shrink-0 overflow-hidden hidden md:block ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-300'
              }`}
            >
              <CADRuler
                orientation="vertical"
                size={canvasSize.height}
                cameraOffset={camera.y}
                cameraScale={camera.scale}
                scaleRatio={scaleRatio}
                isDark={isDark}
              />
            </div>

            {/* SVG VIEWPORT */}
            <div
              ref={canvasRef}
              onWheel={handleWheel}
              className={`flex-1 relative overflow-hidden touch-none select-none ${
                isDark ? 'bg-[#080d15]' : 'bg-[#f8fafc]'
              }`}
            >
              {/* PILHA SUPERIOR DE AVISOS NÃO INTRUSIVOS (FOCO / DESTAQUE / LEMBRETE DE ALTERAÇÕES PENDENTES) */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none max-w-[96vw]">
                {/* BANNER FLUTUANTE DE MODO FOCO EXCLUSIVO */}
                {isolatedSpace && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className={`pointer-events-auto flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-orange-500/80 shadow-2xl backdrop-blur-md text-xs transition-all duration-150 max-w-[96vw] ${
                      isDragging ? 'opacity-20 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="w-4 h-4 text-orange-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100 truncate max-w-[140px] sm:max-w-none">
                            Modo Foco: {isolatedSpace.name}
                          </span>
                          <span className="text-[10px] text-orange-400 font-mono hidden sm:inline">
                            ({Math.round(isolatedSpace.width / scaleRatio)}m × {Math.round(isolatedSpace.height / scaleRatio)}m)
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 hidden md:inline">
                          Restante do armazém bloqueado contra toque e edição acidental
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsolatedSpaceId(null);
                          setToast('Modo Foco finalizado. Todos os itens desbloqueados.');
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3 text-orange-400" />
                        <span>Sair do Foco</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* BANNER FLUTUANTE DE ITEM EM DESTAQUE PELA BUSCA */}
                {highlightedDetails && !isolatedSpace && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className={`pointer-events-auto flex items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-red-500/80 shadow-2xl backdrop-blur-md text-xs transition-all duration-150 max-w-[96vw] ${
                      isDragging ? 'opacity-30 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="movare-search-pulse inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-red-400/50"></span>
                    </span>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">Destaque:</span>
                      <span className="font-bold text-red-400 font-mono text-xs truncate max-w-[150px] sm:max-w-[240px]">
                        {highlightedDetails.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 ml-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigateToPoint(highlightedDetails.x, highlightedDetails.y, 1.4)}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700/80 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Centralizar no mapa"
                      >
                        <Crosshair className="w-3 h-3 text-sky-400" />
                        <span className="hidden xs:inline">Centralizar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHighlightId(null)}
                        className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-0.5 cursor-pointer"
                        title="Limpar destaque"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* LEMBRETE DISCRETO DE ALTERAÇÕES LOCAIS NÃO SALVAS NA NUVEM */}
                {isAdmin && auth.isConfigured && sharedMap.hasUnsavedChanges && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className={`pointer-events-auto flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-md text-xs transition-all duration-150 max-w-[94vw] ${
                      isDark
                        ? 'bg-slate-900/95 border-amber-500/65 text-slate-100 shadow-black/70'
                        : 'bg-white/95 border-amber-400 text-slate-900 shadow-slate-500/20'
                    } ${isDragging ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                    <span className="text-[11px] font-medium truncate">
                      Alterações mais recentes não foram salvas
                      {sharedMap.remoteUpdateNotice
                        ? ` · Nuvem em v${sharedMap.remoteUpdateNotice.version}`
                        : ''}
                    </span>
                    <button
                      type="button"
                      disabled={sharedMap.syncStatus === 'syncing'}
                      onClick={() => void sharedMap.flushSaveToCloud()}
                      className="px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      title="Enviar todas as edições concluídas para a nuvem (Ctrl+S)"
                    >
                      {sharedMap.syncStatus === 'syncing' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3 h-3" />
                      )}
                      <span>{sharedMap.syncStatus === 'syncing' ? 'Salvando...' : 'Salvar na nuvem'}</span>
                    </button>
                  </div>
                )}
              </div>

              <svg
                className={`absolute inset-0 w-full h-full touch-none select-none ${
                  tool === 'pan'
                    ? 'cursor-grab active:cursor-grabbing'
                    : tool === 'move'
                    ? 'cursor-move'
                    : tool === 'measure' || tool === 'rectangle' || tool === 'divider'
                    ? 'cursor-crosshair'
                    : 'cursor-default'
                }`}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerCancel}
                onPointerLeave={pointerCancel}
              >
                <defs>
                  {/* Grade CAD Métrica Subordinada (1m e 5m) */}
                  <pattern
                    id="cad-grid-1m"
                    width={scaleRatio}
                    height={scaleRatio}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${scaleRatio} 0 L 0 0 0 ${scaleRatio}`}
                      fill="none"
                      stroke={isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}
                      strokeWidth="1"
                    />
                  </pattern>

                  <pattern
                    id="cad-grid-5m"
                    width={scaleRatio * 5}
                    height={scaleRatio * 5}
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width={scaleRatio * 5} height={scaleRatio * 5} fill="url(#cad-grid-1m)" />
                    <path
                      d={`M ${scaleRatio * 5} 0 L 0 0 0 ${scaleRatio * 5}`}
                      fill="none"
                      stroke={isDark ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.15)'}
                      strokeWidth="1.2"
                    />
                  </pattern>

                  {/* Efeito Glow Vermelho para Destaque de Busca */}
                  <filter id="glow-highlight" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.95" />
                  </filter>
                </defs>

                {/* CÂMERA PRINCIPAL */}
                <g transform={`matrix(${camera.scale} 0 0 ${camera.scale} ${camera.x} ${camera.y})`}>
                  {/* FUNDO DA PLANTA BAIXA COM GRADE */}
                  <rect
                    x={0}
                    y={0}
                    width={worldWidth}
                    height={worldHeight}
                    fill={isDark ? '#0b111e' : '#ffffff'}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={worldWidth}
                    height={worldHeight}
                    fill="url(#cad-grid-5m)"
                  />

                  {/* LOGOTIPO MOVARE DESTACADO COMO BACKGROUND */}
                  <image
                    href="/movare-logo.png"
                    x={worldWidth * 0.08}
                    y={worldHeight * 0.08}
                    width={worldWidth * 0.84}
                    height={worldHeight * 0.84}
                    preserveAspectRatio="xMidYMid meet"
                    opacity={isDark ? 0.24 : 0.20}
                    pointerEvents="none"
                    style={{ userSelect: 'none' }}
                  />

                  {/* PERÍMETRO EXTERNO DO ARMAZÉM COM COTAS MÉTRICAS */}
                  <rect
                    x={0}
                    y={0}
                    width={worldWidth}
                    height={worldHeight}
                    fill="none"
                    stroke={isDark ? '#f97316' : '#ea580c'}
                    strokeWidth={2.5}
                    strokeDasharray="10 6"
                    pointerEvents="none"
                  />
                  {/* Rótulos de Dimensão no Perímetro */}
                  <g pointerEvents="none" className="font-mono text-[11px] font-bold fill-orange-500/80">
                    <text x={worldWidth / 2} y={-8} textAnchor="middle">
                      LARGURA: {bounds.widthMeters}m ({worldWidth}px)
                    </text>
                    <text x={-8} y={worldHeight / 2} textAnchor="middle" transform={`rotate(-90, -8, ${worldHeight / 2})`}>
                      COMPRIMENTO: {bounds.heightMeters}m ({worldHeight}px)
                    </text>
                  </g>

                  {/* LEGENDA GEOGRÁFICA SIMPLES FIXADA AO LADO DO PERÍMETRO DO BARRACÃO */}
                  <WarehouseGeographicLegendSVG
                    elements={activeArea.elements}
                    selectedId={selectedId}
                    onSelectZone={(zone) => {
                      setHighlightId(null);
                      setSelectedId(zone.id);
                      setSelectedPositionId(null);
                      navigateToPoint(zone.x + zone.width / 2, zone.y + zone.height / 2, 1.3);
                      if (tool !== 'pan') {
                        setDesktopSidebarOpen(true);
                        setMobileDrawerOpen(true);
                      }
                      setToast(`Zona focalizada: ${zone.name}`);
                    }}
                    scaleRatio={scaleRatio}
                    worldWidth={worldWidth}
                    worldHeight={worldHeight}
                    isDark={isDark}
                  />

                  {/* ELEMENTOS VISÍVEIS */}
                  {visibleItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isPrimarySelected = item.id === selectedId;
                    const isDirectlyHighlighted = item.id === highlightId;
                    const isCollidedObstacle = collisionContactIds.has(item.id);
                    const isLocked = !!item.locked;

                    // Renderiza a posição atualizada do preview (individual ou grupo)
                    const rendered = (groupPreview?.find((g) => g.id === item.id)) || (preview?.id === item.id ? preview : item);
                    const color = rendered.color || (rendered.type === 'rack' ? '#f97316' : '#d97706');
                    const rotation = rendered.rotation || 0;
                    const cx = rendered.x + rendered.width / 2;
                    const cy = rendered.y + rendered.height / 2;

                    // Lógica de isolamento e interatividade por Ferramenta (Tool)
                    const isTheIsolatedContainer = isolatedSpaceId === item.id;
                    const belongsToIsolated =
                      !isolatedSpaceId || isTheIsolatedContainer || item.groupId === isolatedSpaceId;

                    const isItemInteractive = (() => {
                      if (!belongsToIsolated) return false;
                      if (tool === 'pan') return true; // Modo visualização: toque exibe resumo simplificado, arrasto navega
                      if (tool === 'corridor') return rendered.type === 'corridor'; // Adição/seleção de corredores no menu corredor
                      if (tool === 'select') return true; // Menu selecionar: interage e seleciona todos os elementos (inclusive corredores)
                      if (tool === 'move') return true; // Movimento e redimensionamento exclusivo do menu mover
                      return false;
                    })();

                    const sizeDef = PRODUCT_SIZES.find((s) => s.id === rendered.productSize);
                    const catDef = PRODUCT_CATEGORIES.find((c) => c.id === rendered.category);

                    return (
                      <g
                        key={item.id}
                        data-element-id={item.id}
                        className={isItemInteractive ? 'cursor-pointer' : 'pointer-events-none select-none'}
                        opacity={belongsToIsolated ? 1 : 0.06}
                        pointerEvents={isItemInteractive ? 'all' : 'none'}
                        transform={rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined}
                      >
                        {rendered.type === 'rack' ? (
                          // ---------------- PORTA-PALETES (RACK) ----------------
                          (() => {
                            const modulesCount = rendered.modules || 6;
                            const modWidth = rendered.width / modulesCount;

                            return (
                              <g>
                                <rect
                                  x={rendered.x}
                                  y={rendered.y}
                                  width={rendered.width}
                                  height={rendered.height}
                                  rx={3}
                                  fill={isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.12)'}
                                  stroke={isCollidedObstacle ? '#ef4444' : isDirectlyHighlighted ? '#ef4444' : isSelected ? (isLocked ? '#eab308' : '#f97316') : color}
                                  strokeWidth={isCollidedObstacle ? 3.5 : isDirectlyHighlighted ? 3.5 : isSelected ? 3 : 2}
                                  strokeDasharray={isLocked ? '5 3' : isSelected && selectedIds.length > 1 ? '4 2' : undefined}
                                  vectorEffect="non-scaling-stroke"
                                  pointerEvents={isItemInteractive ? 'all' : 'none'}
                                />
                                {isDirectlyHighlighted && (
                                  <rect
                                    x={rendered.x}
                                    y={rendered.y}
                                    width={rendered.width}
                                    height={rendered.height}
                                    rx={4}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth={4.5}
                                    vectorEffect="non-scaling-stroke"
                                    filter="url(#glow-highlight)"
                                    className="movare-search-pulse"
                                    pointerEvents="none"
                                  />
                                )}

                                {/* Vigas dos Módulos */}
                                {Array.from({ length: modulesCount - 1 }, (_, i) => {
                                  const mx = rendered.x + (i + 1) * modWidth;
                                  return (
                                    <line
                                      key={i}
                                      x1={mx}
                                      y1={rendered.y}
                                      x2={mx}
                                      y2={rendered.y + rendered.height}
                                      stroke={color}
                                      strokeWidth={1.2}
                                      strokeDasharray="3 2"
                                      vectorEffect="non-scaling-stroke"
                                      pointerEvents="none"
                                    />
                                  );
                                })}

                                {/* Rótulo da Rua WMS (limpo e sem duplicar prefixo) */}
                                {(() => {
                                  const rawStreet = (rendered.street || rendered.name || '').trim();
                                  const rackTitle = /^RUA\b/i.test(rawStreet) ? rawStreet : `RUA ${rawStreet}`;
                                  const maxRackChars = Math.max(4, Math.floor((rendered.width - (isLocked ? 30 : 16)) / 6.8));
                                  const clippedRackTitle =
                                    rackTitle.length > maxRackChars && maxRackChars >= 4
                                      ? `${rackTitle.slice(0, maxRackChars - 1)}…`
                                      : rackTitle.slice(0, maxRackChars);

                                  return (
                                    <g pointerEvents="none">
                                      <text
                                        x={rendered.x + 8}
                                        y={rendered.y + 16}
                                        fontSize={10.5}
                                        fontFamily="'JetBrains Mono', monospace"
                                        fontWeight="bold"
                                        fill={color}
                                      >
                                        {clippedRackTitle}
                                      </text>

                                      {rendered.height >= 36 && rendered.skuCode && rendered.width >= 70 && (
                                        <text
                                          x={rendered.x + 8}
                                          y={rendered.y + 28}
                                          fontSize={8.5}
                                          fontFamily="'JetBrains Mono', monospace"
                                          fill={isDark ? '#cbd5e1' : '#475569'}
                                        >
                                          {rendered.skuCode.slice(0, Math.max(4, Math.floor((rendered.width - 16) / 5.5)))}
                                        </text>
                                      )}
                                    </g>
                                  );
                                })()}

                                {/* Indicador de Bloqueio 🔒 */}
                                {isLocked && (
                                  <g transform={`translate(${rendered.x + rendered.width - 22}, ${rendered.y + 6})`} pointerEvents="none">
                                    <rect width={16} height={16} rx={3} fill="#eab308" />
                                    <text x={8} y={12} textAnchor="middle" fontSize={10} fill="#000">🔒</text>
                                  </g>
                                )}
                              </g>
                            );
                          })()
                        ) : rendered.type === 'rectangle' ? (
                          // ---------------- ZONA / CÉLULA INDIVIDUAL PARA PRODUTOS ----------------
                          (() => {
                            const baseZoneX = Number.isFinite(rendered.x) ? rendered.x : 0;
                            const baseZoneY = Number.isFinite(rendered.y) ? rendered.y : 0;
                            const baseZoneW = Number.isFinite(rendered.width) && rendered.width > 0 ? rendered.width : 20;
                            const baseZoneH = Number.isFinite(rendered.height) && rendered.height > 0 ? rendered.height : 20;

                            return (
                              <g>
                                <rect
                                  x={baseZoneX}
                                  y={baseZoneY}
                                  width={baseZoneW}
                                  height={baseZoneH}
                                  rx={4}
                                  fill={`${color}${isSelected ? '45' : '22'}`}
                                  stroke={isCollidedObstacle ? '#ef4444' : isDirectlyHighlighted ? '#ef4444' : isSelected ? (isLocked ? '#eab308' : isPrimarySelected ? '#38bdf8' : '#60a5fa') : color}
                                  strokeWidth={isCollidedObstacle ? 3.5 : isDirectlyHighlighted ? 3.5 : isSelected ? (isPrimarySelected ? 3 : 2.5) : 2}
                                  strokeDasharray={isLocked ? '5 3' : isSelected && selectedIds.length > 1 ? '4 2' : undefined}
                                  vectorEffect="non-scaling-stroke"
                                  pointerEvents={isItemInteractive ? 'all' : 'none'}
                                />

                                {/* Contorno vermelho pulsante na zona pesquisada */}
                                {isDirectlyHighlighted && (
                                  <rect
                                    x={baseZoneX}
                                    y={baseZoneY}
                                    width={baseZoneW}
                                    height={baseZoneH}
                                    rx={5}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth={4.5}
                                    vectorEffect="non-scaling-stroke"
                                    filter="url(#glow-highlight)"
                                    className="movare-search-pulse"
                                    pointerEvents="none"
                                  />
                                )}

                                {/* POSIÇÕES INTERNAS MODULARES (Pertencem à zona, movem-se com ela) */}
                                {rendered.internalPositions && rendered.internalPositions.length > 0 && (
                                  <g>
                                    {rendered.internalPositions.map((pos, posIdx) => {
                                      const relX = Number.isFinite(pos.relX) ? pos.relX : Number.isFinite((pos as any).x) ? (pos as any).x : 0;
                                      const relY = Number.isFinite(pos.relY) ? pos.relY : Number.isFinite((pos as any).y) ? (pos as any).y : 0;
                                      const relWidth = Number.isFinite(pos.relWidth) && pos.relWidth > 0 ? pos.relWidth : Number.isFinite((pos as any).width) ? (pos as any).width : 24;
                                      const relHeight = Number.isFinite(pos.relHeight) && pos.relHeight > 0 ? pos.relHeight : Number.isFinite((pos as any).height) ? (pos as any).height : 24;

                                      const posX = baseZoneX + relX;
                                      const posY = baseZoneY + relY;
                                      const isPosSelected = selectedPositionId === pos.id;
                                      const isPosHighlighted = highlightId === pos.id;
                                      const isOccupied = pos.status === 'occupied';
                                      const isReserved = pos.status === 'reserved';

                                      const posFill = isPosHighlighted
                                        ? 'rgba(239, 68, 68, 0.32)'
                                        : isPosSelected
                                        ? 'rgba(56, 189, 248, 0.25)'
                                        : isReserved
                                        ? isDark
                                          ? 'rgba(250, 204, 21, 0.34)'
                                          : 'rgba(250, 204, 21, 0.42)'
                                        : isOccupied
                                        ? 'rgba(34, 197, 94, 0.22)'
                                        : isDark
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'rgba(0, 0, 0, 0.04)';

                                      const posStroke = isPosHighlighted
                                        ? '#ef4444'
                                        : isPosSelected
                                        ? '#38bdf8'
                                        : isReserved
                                        ? isDark
                                          ? '#facc15'
                                          : '#ca8a04'
                                        : isOccupied
                                        ? '#22c55e'
                                        : color;

                                      const posStrokeOpacity = isPosHighlighted || isPosSelected || isOccupied || isReserved ? 0.95 : 0.45;
                                      const posReactKey = `${rendered.id}-${pos.id || 'pos'}-${posIdx}`;

                                      return (
                                        <g key={posReactKey} className={(tool === 'select' || tool === 'pan') && isItemInteractive ? 'cursor-pointer' : 'pointer-events-none'}>
                                          <rect
                                            x={posX}
                                            y={posY}
                                            width={relWidth}
                                            height={relHeight}
                                            rx={2}
                                            fill={posFill}
                                            stroke={posStroke}
                                            strokeOpacity={posStrokeOpacity}
                                            strokeWidth={isPosHighlighted ? 3 : isPosSelected ? 2.5 : isReserved ? 2 : 1}
                                            strokeDasharray={pos.status === 'empty' && !isPosSelected && !isPosHighlighted ? '3 2' : undefined}
                                            pointerEvents={(tool === 'select' || tool === 'pan') && isItemInteractive ? 'all' : 'none'}
                                            onPointerDown={(e) => {
                                              if ((tool !== 'select' && tool !== 'pan') || !isItemInteractive) return;
                                              const scr = pointToScreen(e.clientX, e.clientY);
                                              pendingCellTapRef.current = {
                                                pos,
                                                zoneId: rendered.id,
                                                startScreen: scr,
                                                pointerId: e.pointerId,
                                              };
                                            }}
                                          />

                                          {/* Rótulo do Código da Posição (sempre isolado e sem colidir com selo de reserva) */}
                                          {relHeight >= 12 && relWidth >= 22 && (() => {
                                            const showResPill = isReserved && relWidth >= 56 && relHeight >= 18;
                                            const showResDot = isReserved && !showResPill && relWidth >= 14 && relHeight >= 12;
                                            const reservedRightSpace = showResPill ? 28 : showResDot ? 11 : 5;
                                            const availWidth = Math.max(10, relWidth - 4 - reservedRightSpace);
                                            const codeFontSize = Math.min(9.5, Math.max(7, relHeight * 0.36));
                                            const charW = codeFontSize * 0.62;
                                            const maxCodeChars = Math.max(2, Math.floor(availWidth / charW));
                                            const rawCode = (pos.code || '').trim();
                                            const displayCode =
                                              rawCode.length > maxCodeChars && maxCodeChars >= 4
                                                ? `${rawCode.slice(0, maxCodeChars - 1)}…`
                                                : rawCode.slice(0, maxCodeChars);

                                            return (
                                              <text
                                                x={posX + 4}
                                                y={posY + Math.min(12, Math.max(9, relHeight * 0.45))}
                                                fontSize={codeFontSize}
                                                fontFamily="'JetBrains Mono', monospace"
                                                fontWeight="bold"
                                                fill={
                                                  isPosSelected
                                                    ? '#38bdf8'
                                                    : isOccupied
                                                    ? '#4ade80'
                                                    : isReserved
                                                    ? isDark ? '#fef08a' : '#854d0e'
                                                    : isDark
                                                    ? '#94a3b8'
                                                    : '#64748b'
                                                }
                                                pointerEvents="none"
                                              >
                                                {displayCode}
                                              </text>
                                            );
                                          })()}

                                          {/* Indicador compacto de RESERVA no canto superior direito da célula */}
                                          {isReserved && relWidth >= 14 && relHeight >= 12 && (
                                            relWidth >= 56 && relHeight >= 18 ? (
                                              <g transform={`translate(${posX + relWidth - 26}, ${posY + 3})`} pointerEvents="none">
                                                <rect width={23} height={10} rx={2} fill="#eab308" />
                                                <text
                                                  x={11.5}
                                                  y={7.5}
                                                  textAnchor="middle"
                                                  fontSize={6.2}
                                                  fontFamily="'JetBrains Mono', monospace"
                                                  fontWeight="900"
                                                  fill="#0f172a"
                                                >
                                                  RES
                                                </text>
                                              </g>
                                            ) : (
                                              <circle
                                                cx={posX + relWidth - 5}
                                                cy={posY + 5}
                                                r={2.8}
                                                fill="#facc15"
                                                stroke="#0f172a"
                                                strokeWidth={0.7}
                                                pointerEvents="none"
                                              />
                                            )
                                          )}

                                          {/* Linha secundária limpa (SKU, Loja da reserva ou Qtd) sem vazar da célula */}
                                          {pos.status !== 'empty' && relWidth >= 36 && relHeight >= 25 && (() => {
                                            const maxSubChars = Math.max(3, Math.floor((relWidth - 8) / 4.8));
                                            const rawSub = isReserved && pos.reservedStore
                                              ? pos.reservedStore.trim()
                                              : pos.sku
                                              ? pos.sku.trim()
                                              : pos.quantity
                                              ? `${pos.quantity} ${pos.unit || 'UN'}`
                                              : '';
                                            if (!rawSub) return null;
                                            const displaySub =
                                              rawSub.length > maxSubChars && maxSubChars >= 4
                                                ? `${rawSub.slice(0, maxSubChars - 1)}…`
                                                : rawSub.slice(0, maxSubChars);
                                            return (
                                              <text
                                                x={posX + 4}
                                                y={posY + Math.min(relHeight - 4, 22)}
                                                fontSize={7.5}
                                                fontFamily="'JetBrains Mono', monospace"
                                                fontWeight={isReserved && pos.reservedStore ? '600' : '400'}
                                                fill={isReserved ? (isDark ? '#fde047' : '#854d0e') : isDark ? '#cbd5e1' : '#475569'}
                                                pointerEvents="none"
                                              >
                                                {displaySub}
                                              </text>
                                            );
                                          })()}
                                        </g>
                                      );
                                    })}

                                    {/* Contorno vermelho pulsante sobre a célula interna pesquisada (renderizado por cima para nunca ser coberto) */}
                                    {rendered.internalPositions.map((pos, posIdx) => {
                                      if (highlightId !== pos.id) return null;
                                      const relX = Number.isFinite(pos.relX) ? pos.relX : Number.isFinite((pos as any).x) ? (pos as any).x : 0;
                                      const relY = Number.isFinite(pos.relY) ? pos.relY : Number.isFinite((pos as any).y) ? (pos as any).y : 0;
                                      const relWidth = Number.isFinite(pos.relWidth) && pos.relWidth > 0 ? pos.relWidth : Number.isFinite((pos as any).width) ? (pos as any).width : 24;
                                      const relHeight = Number.isFinite(pos.relHeight) && pos.relHeight > 0 ? pos.relHeight : Number.isFinite((pos as any).height) ? (pos as any).height : 24;

                                      return (
                                        <rect
                                          key={`highlight-pos-${pos.id || posIdx}`}
                                          x={baseZoneX + relX}
                                          y={baseZoneY + relY}
                                          width={relWidth}
                                          height={relHeight}
                                          rx={3}
                                          fill="none"
                                          stroke="#ef4444"
                                          strokeWidth={4}
                                          vectorEffect="non-scaling-stroke"
                                          filter="url(#glow-highlight)"
                                          className="movare-search-pulse"
                                          pointerEvents="none"
                                        />
                                      );
                                    })}
                                  </g>
                                )}

                                {/* Nomenclatura Limpa da Zona (posicionada acima da borda quando há células internas para não sobrepor códigos) */}
                                <g pointerEvents="none">
                                  {rendered.internalPositions && rendered.internalPositions.length > 0 ? (() => {
                                    const zoneReservedCount = rendered.internalPositions.filter((p) => p.status === 'reserved').length;
                                    const rawZoneName = (rendered.name || 'Zona').trim();
                                    const reservedBadgeText = zoneReservedCount > 0 && baseZoneW >= 125 ? ` · ${zoneReservedCount} RES` : '';
                                    const maxBadgeW = Math.max(64, baseZoneW - (isLocked ? 20 : 0));
                                    const maxNameChars = Math.max(
                                      6,
                                      Math.floor((maxBadgeW - 14 - reservedBadgeText.length * 5.8) / 5.8)
                                    );
                                    const clippedName =
                                      rawZoneName.length > maxNameChars
                                        ? `${rawZoneName.slice(0, Math.max(3, maxNameChars - 1))}…`
                                        : rawZoneName;
                                    const labelStr = `${clippedName}${reservedBadgeText}`;
                                    const plateW = Math.min(maxBadgeW, Math.max(46, labelStr.length * 5.9 + 14));

                                    return (
                                      <g transform={`translate(${baseZoneX}, ${baseZoneY - 17})`}>
                                        <rect
                                          x={0}
                                          y={0}
                                          width={plateW}
                                          height={15}
                                          rx={3}
                                          fill={
                                            zoneReservedCount > 0
                                              ? isDark
                                                ? 'rgba(66, 32, 6, 0.96)'
                                                : 'rgba(254, 249, 195, 0.98)'
                                              : isDark
                                              ? 'rgba(15, 23, 42, 0.94)'
                                              : 'rgba(255, 255, 255, 0.96)'
                                          }
                                          stroke={zoneReservedCount > 0 ? '#eab308' : color}
                                          strokeWidth={1}
                                        />
                                        <text
                                          x={6}
                                          y={10.5}
                                          fontSize={9}
                                          fontWeight="bold"
                                          fill={
                                            zoneReservedCount > 0
                                              ? isDark
                                                ? '#fde047'
                                                : '#854d0e'
                                              : isDark
                                              ? '#f8fafc'
                                              : '#0f172a'
                                          }
                                          fontFamily="'JetBrains Mono', monospace"
                                        >
                                          {labelStr}
                                        </text>
                                      </g>
                                    );
                                  })() : baseZoneW >= 75 && baseZoneH >= 42 ? (() => {
                                    const rawZoneName = (rendered.name || 'Zona').trim();
                                    const maxTitleChars = Math.max(5, Math.floor((baseZoneW - (isLocked ? 32 : 16)) / 6.6));
                                    const clippedZoneName =
                                      rawZoneName.length > maxTitleChars
                                        ? `${rawZoneName.slice(0, Math.max(3, maxTitleChars - 1))}…`
                                        : rawZoneName;

                                    return (
                                      <>
                                        <text
                                          x={baseZoneX + 8}
                                          y={baseZoneY + 17}
                                          fontSize={10.5}
                                          fontWeight="700"
                                          fill={isDark ? '#f1f5f9' : '#1e293b'}
                                        >
                                          {clippedZoneName}
                                        </text>

                                        {catDef && baseZoneH >= 48 && (
                                          <text
                                            x={baseZoneX + 8}
                                            y={baseZoneY + 30}
                                            fontSize={8.5}
                                            fontWeight="600"
                                            fill={catDef.color}
                                          >
                                            {catDef.badge}
                                          </text>
                                        )}

                                        {rendered.skuCode && baseZoneH >= 58 && (
                                          <text
                                            x={baseZoneX + 8}
                                            y={baseZoneY + 43}
                                            fontSize={9}
                                            fontFamily="'JetBrains Mono', monospace"
                                            fontWeight="bold"
                                            fill="#f97316"
                                          >
                                            {rendered.skuCode.slice(0, Math.max(4, Math.floor((baseZoneW - 16) / 5.8)))}
                                          </text>
                                        )}
                                      </>
                                    );
                                  })() : (() => {
                                    const shortName = rendered.name?.includes('Célula')
                                      ? rendered.name.split('Célula').pop()?.trim() || ''
                                      : (rendered.name || '').trim();
                                    const maxSmallChars = Math.max(3, Math.floor((baseZoneW - 8) / 5.6));
                                    const clippedSmall =
                                      shortName.length > maxSmallChars
                                        ? `${shortName.slice(0, Math.max(2, maxSmallChars - 1))}…`
                                        : shortName;

                                    return (
                                      <g transform={`translate(${baseZoneX + 4}, ${baseZoneY + 13})`}>
                                        <text
                                          fontSize={9}
                                          fontFamily="'JetBrains Mono', monospace"
                                          fontWeight="bold"
                                          fill={isDark ? '#f8fafc' : '#0f172a'}
                                        >
                                          {clippedSmall}
                                        </text>
                                        {rendered.skuCode && baseZoneH >= 28 && (
                                          <text
                                            y={10}
                                            fontSize={7.5}
                                            fontFamily="'JetBrains Mono', monospace"
                                            fill="#f97316"
                                            fontWeight="bold"
                                          >
                                            {rendered.skuCode.slice(0, maxSmallChars)}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  })()}
                                </g>

                                {/* Indicador de Bloqueio 🔒 (acima da borda quando há células internas para não tampar códigos) */}
                                {isLocked && (
                                  <g
                                    transform={
                                      rendered.internalPositions && rendered.internalPositions.length > 0
                                        ? `translate(${baseZoneX + baseZoneW - 16}, ${baseZoneY - 17})`
                                        : `translate(${baseZoneX + baseZoneW - 22}, ${baseZoneY + 5})`
                                    }
                                    pointerEvents="none"
                                  >
                                    <rect width={16} height={15} rx={3} fill="#eab308" />
                                    <text x={8} y={11.5} textAnchor="middle" fontSize={9.5} fill="#000">🔒</text>
                                  </g>
                                )}
                              </g>
                            );
                          })()
                        ) : rendered.type === 'corridor' ? (
                          // ---------------- IDENTIFICAÇÃO DE CORREDOR / RUA (APENAS PALAVRAS SEM BACKGROUND) ----------------
                          <g>
                            {/* Caixas/Moldura de seleção discreta quando selecionado */}
                            {isSelected && (
                              <rect
                                x={rendered.x}
                                y={rendered.y}
                                width={rendered.width}
                                height={rendered.height}
                                rx={4}
                                fill="none"
                                stroke={isLocked ? '#eab308' : '#38bdf8'}
                                strokeWidth={1.5 / camera.scale}
                                strokeDasharray="4 3"
                                pointerEvents="none"
                              />
                            )}
                            {isDirectlyHighlighted && (
                              <rect
                                x={rendered.x}
                                y={rendered.y}
                                width={Math.max(20, rendered.width)}
                                height={Math.max(20, rendered.height)}
                                rx={5}
                                fill="rgba(239, 68, 68, 0.12)"
                                stroke="#ef4444"
                                strokeWidth={4}
                                vectorEffect="non-scaling-stroke"
                                filter="url(#glow-highlight)"
                                className="movare-search-pulse"
                                pointerEvents="none"
                              />
                            )}

                            {/* Texto de identificação do corredor — palavras puras sem fundo */}
                            <text
                              x={rendered.x + rendered.width / 2}
                              y={rendered.y + rendered.height / 2}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={rendered.fontSize || 22}
                              fontFamily="'JetBrains Mono', 'Inter', monospace"
                              fontWeight={rendered.fontWeight === 'bold' ? 'bold' : rendered.fontWeight === 'extrabold' ? '900' : '800'}
                              fill={rendered.color || (isDark ? '#ffffff' : '#0f172a')}
                              stroke={isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)'}
                              strokeWidth={Math.max(0.8, (rendered.fontSize || 22) * 0.08)}
                              paintOrder="stroke fill"
                              style={{
                                letterSpacing: `${rendered.letterSpacing ?? 4}px`,
                                textTransform: 'uppercase',
                                userSelect: 'none',
                              }}
                              pointerEvents="none"
                            >
                              {rendered.corridorText || rendered.name || 'CORREDOR 01'}
                            </text>

                            {/* Hitbox transparente para clicar e mover no mapa */}
                            <rect
                              x={rendered.x}
                              y={rendered.y}
                              width={Math.max(20, rendered.width)}
                              height={Math.max(20, rendered.height)}
                              rx={4}
                              fill="transparent"
                              pointerEvents={isItemInteractive ? 'all' : 'none'}
                            />
                          </g>
                        ) : (
                          // ---------------- DIVISÓRIA / PAREDE ----------------
                          <g>
                            <line
                              x1={rendered.x}
                              y1={rendered.y}
                              x2={rendered.x + rendered.width}
                              y2={rendered.y + rendered.height}
                              stroke={isDirectlyHighlighted ? '#ef4444' : isSelected ? (isLocked ? '#eab308' : '#38bdf8') : color}
                              strokeWidth={isDirectlyHighlighted ? 5.5 : isSelected ? 5 : 3.5}
                              strokeLinecap="round"
                              vectorEffect="non-scaling-stroke"
                              filter={isDirectlyHighlighted ? 'url(#glow-highlight)' : undefined}
                              className={isDirectlyHighlighted ? 'movare-search-pulse' : undefined}
                              pointerEvents="none"
                            />
                            {/* Hitbox ampla de toque para celular */}
                            <line
                              x1={rendered.x}
                              y1={rendered.y}
                              x2={rendered.x + rendered.width}
                              y2={rendered.y + rendered.height}
                              stroke="transparent"
                              strokeWidth={Math.max(48 / camera.scale, 34)}
                              pointerEvents={isItemInteractive ? 'stroke' : 'none'}
                            />
                          </g>
                        )}

                        {/* MANIPULAÇÃO TÁTIL: ALÇAS DE REDIMENSIONAMENTO E ROTAÇÃO (APENAS ADMIN NO MODO MOVER SE SELECIONADO E NÃO BLOQUEADO) */}
                        {isAdmin && tool === 'move' && isSelected && !isLocked && belongsToIsolated && (item.type === 'rectangle' || item.type === 'rack' || item.type === 'corridor') && (
                          <g>
                            {/* 1. HASTE E ALÇA DE ROTAÇÃO TÁTIL DIRETA (Acima do Centro) */}
                            {(() => {
                              const rotHandleDist = Math.max(34 / camera.scale, 28);
                              const rx = cx;
                              const ry = item.y - rotHandleDist;

                              return (
                                <g data-rotate-handle="top" className="cursor-grab active:cursor-grabbing">
                                  {/* Haste conectando topo ao puxador */}
                                  <line
                                    x1={cx}
                                    y1={item.y}
                                    x2={rx}
                                    y2={ry}
                                    stroke="#f97316"
                                    strokeWidth={1.5 / camera.scale}
                                    strokeDasharray="3 2"
                                    pointerEvents="none"
                                  />
                                  {/* Área de toque expandida para dedos */}
                                  <circle cx={rx} cy={ry} r={Math.max(26 / camera.scale, 20)} fill="transparent" />
                                  {/* Botão visual de Rotação Tátil */}
                                  <circle
                                    cx={rx}
                                    cy={ry}
                                    r={Math.max(9 / camera.scale, 7)}
                                    fill="#f97316"
                                    stroke="#ffffff"
                                    strokeWidth={2 / camera.scale}
                                    pointerEvents="none"
                                  />
                                  <text
                                    x={rx}
                                    y={ry + 3 / camera.scale}
                                    textAnchor="middle"
                                    fontSize={8 / camera.scale}
                                    fill="#ffffff"
                                    fontWeight="bold"
                                    pointerEvents="none"
                                  >
                                    ↻
                                  </text>
                                </g>
                              );
                            })()}

                            {/* 2. ALÇAS DE REDIMENSIONAMENTO TÁTEIS NOS 4 CANTOS */}
                            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
                              const px = item.x + (corner.includes('r') ? item.width : 0);
                              const py = item.y + (corner.includes('b') ? item.height : 0);
                              return (
                                <g key={corner} data-handle={corner} className="cursor-nwse-resize">
                                  {/* Hitbox generosa para celular */}
                                  <circle cx={px} cy={py} r={Math.max(32 / camera.scale, 22)} fill="transparent" />
                                  <circle
                                    cx={px}
                                    cy={py}
                                    r={Math.max(8 / camera.scale, 6)}
                                    fill="#f97316"
                                    stroke="#ffffff"
                                    strokeWidth={2 / camera.scale}
                                    pointerEvents="none"
                                  />
                                </g>
                              );
                            })}

                            {/* 3. ALÇAS DE REDIMENSIONAMENTO TÁTEIS NAS 4 BORDAS (TOP, BOTTOM, LEFT, RIGHT) */}
                            {[
                              { id: 'top', x: cx, y: item.y },
                              { id: 'bottom', x: cx, y: item.y + item.height },
                              { id: 'left', x: item.x, y: cy },
                              { id: 'right', x: item.x + item.width, y: cy },
                            ].map((edge) => (
                              <g key={edge.id} data-handle={edge.id} className="cursor-pointer">
                                <circle cx={edge.x} cy={edge.y} r={Math.max(26 / camera.scale, 18)} fill="transparent" />
                                <rect
                                  x={edge.x - Math.max(5 / camera.scale, 4)}
                                  y={edge.y - Math.max(5 / camera.scale, 4)}
                                  width={Math.max(10 / camera.scale, 8)}
                                  height={Math.max(10 / camera.scale, 8)}
                                  rx={2}
                                  fill="#ffffff"
                                  stroke="#f97316"
                                  strokeWidth={1.5 / camera.scale}
                                  pointerEvents="none"
                                />
                              </g>
                            ))}
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* PREVIEW DE DESENHO OU TRANSFORMAÇÃO */}
                  {preview?.id === 'preview' && (
                    <rect
                      x={preview.x}
                      y={preview.y}
                      width={preview.width}
                      height={preview.height}
                      rx={3}
                      fill="rgba(249, 115, 22, 0.25)"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}

                  {/* FITA MÉTRICA ATIVA */}
                  {measureLine && measureDistanceM && (
                    <g pointerEvents="none">
                      <line
                        x1={measureLine.start.x}
                        y1={measureLine.start.y}
                        x2={measureLine.end.x}
                        y2={measureLine.end.y}
                        stroke="#f97316"
                        strokeWidth={2.5}
                        strokeDasharray="4 3"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle cx={measureLine.start.x} cy={measureLine.start.y} r={4} fill="#f97316" />
                      <circle cx={measureLine.end.x} cy={measureLine.end.y} r={4} fill="#f97316" />
                      <g
                        transform={`translate(${
                          (measureLine.start.x + measureLine.end.x) / 2
                        }, ${(measureLine.start.y + measureLine.end.y) / 2 - 12})`}
                      >
                        <rect x={-36} y={-10} width={72} height={20} rx={4} fill="#0f172a" stroke="#f97316" strokeWidth={1} />
                        <text x={0} y={4} textAnchor="middle" fill="#ffffff" fontSize={11} fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                          {measureDistanceM} m
                        </text>
                      </g>
                    </g>
                  )}

                  {/* GUIAS MAGNÉTICAS & RÉGUAS DE ENQUADRAMENTO AUTOMÁTICO */}
                  {alignmentGuides.map((guide, idx) => {
                    const isVertical = guide.orientation === 'vertical' || guide.axis === 'x';
                    const strokeColor =
                      guide.type === 'center'
                        ? '#e879f9'
                        : guide.type === 'bounds'
                        ? '#f59e0b'
                        : guide.type === 'dimension'
                        ? '#22c55e'
                        : '#38bdf8';
                    const x1 = isVertical ? guide.position : 0;
                    const y1 = isVertical ? 0 : guide.position;
                    const x2 = isVertical ? guide.position : worldWidth;
                    const y2 = isVertical ? worldHeight : guide.position;

                    // Posição ajustada do badge dentro da área visível perto do elemento
                    const badgeX = isVertical
                      ? guide.position
                      : Math.max(50, Math.min(worldWidth - 50, guide.anchorX ?? worldWidth / 2));
                    const badgeY = isVertical
                      ? Math.max(30, Math.min(worldHeight - 30, guide.anchorY ?? worldHeight / 2))
                      : guide.position;

                    return (
                      <g key={idx} pointerEvents="none">
                        {/* Linha guia de enquadramento automático */}
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={strokeColor}
                          strokeWidth={1.5}
                          strokeDasharray={guide.type === 'center' ? '5 3' : '3 2'}
                          vectorEffect="non-scaling-stroke"
                        />
                        {/* Indicador visual de coordenada / tipo do alinhamento */}
                        <g transform={`translate(${badgeX}, ${badgeY})`}>
                          <rect
                            x={-44}
                            y={-10}
                            width={88}
                            height={20}
                            rx={5}
                            fill="#090d16"
                            stroke={strokeColor}
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={4}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize={9.5}
                            fontFamily="'JetBrains Mono', monospace"
                            fontWeight="bold"
                          >
                            {guide.label || `${Math.round(guide.position / scaleRatio)}m`}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* MIRA / CROSSHAIR INTERATIVO PARA CRIAÇÃO DE CORREDORES */}
                  {tool === 'corridor' && (
                    <g pointerEvents="none" className="animate-fade-in">
                      {/* Linha vertical da mira */}
                      <line
                        x1={cursorWorld.x}
                        y1={0}
                        x2={cursorWorld.x}
                        y2={worldHeight}
                        stroke="#38bdf8"
                        strokeWidth={1.5 / camera.scale}
                        strokeDasharray="5 3"
                        opacity={0.8}
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Linha horizontal da mira */}
                      <line
                        x1={0}
                        y1={cursorWorld.y}
                        x2={worldWidth}
                        y2={cursorWorld.y}
                        stroke="#38bdf8"
                        strokeWidth={1.5 / camera.scale}
                        strokeDasharray="5 3"
                        opacity={0.8}
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Círculo central do Crosshair */}
                      <circle
                        cx={cursorWorld.x}
                        cy={cursorWorld.y}
                        r={16 / camera.scale}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={2 / camera.scale}
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={cursorWorld.x}
                        cy={cursorWorld.y}
                        r={3 / camera.scale}
                        fill="#38bdf8"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Badge explicativo da mira em tempo real */}
                      <g transform={`translate(${cursorWorld.x + 20 / camera.scale}, ${cursorWorld.y - 18 / camera.scale})`}>
                        <rect
                          x={-4}
                          y={-12}
                          width={132}
                          height={22}
                          rx={6}
                          fill="#0284c7"
                          stroke="#38bdf8"
                          strokeWidth={1}
                        />
                        <text
                          x={62}
                          y={3}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={10}
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                        >
                          + Criar Corredor Aqui
                        </text>
                      </g>
                    </g>
                  )}
                </g>
              </svg>

              {/* PAINEL OPERACIONAL DO CONFERENTE (CONSULTA RÁPIDA SOMENTE LEITURA) */}
              {canUseConferentePanel && (
                <ConferentePanel
                  isOpen={conferentePanelOpen}
                  onToggleOpen={() => setConferentePanelOpen((prev) => !prev)}
                  areas={areas}
                  activeAreaId={activeId}
                  isDark={isDark}
                  onLocateItem={(item: SearchCatalogItem) => {
                    handleNavigateToSearchResult({
                      ...item,
                      isPosition: item.isPosition,
                    });
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setConferentePanelOpen(false);
                    }
                  }}
                />
              )}

              {/* DOCK FLUTUANTE INFERIOR 4.0 (FERRAMENTAS CAD & WMS) */}
              <FloatingActionDock
                tool={tool}
                onSelectTool={(t) => {
                  if (!isAdmin && t !== 'pan' && t !== 'measure') {
                    selectToolSafe(t);
                    return;
                  }
                  selectToolSafe(t);
                  if (t === 'select') setToast('Modo Seleção Ativado');
                  else if (t === 'move') setToast('Modo Mover Ativado');
                  else if (t === 'pan') setToast('Modo Visualização — Toque em itens para ver resumo');
                  else if (t === 'rectangle') setToast('Modo Nova Zona: Arraste na planta');
                  else if (t === 'corridor') setToast('Modo Corredores: Clique no mapa');
                  else if (t === 'measure') setToast('Fita Métrica: Clique em dois pontos');
                }}
                snapEnabled={snapEnabled}
                onToggleSnap={() => {
                  if (!isAdmin) return;
                  setSnapEnabled((prev) => !prev);
                  setToast(!snapEnabled ? 'Magnetismo / Snap Ativado' : 'Movimento Livre sem Snap');
                }}
                physicsEnabled={physicsEnabled}
                onTogglePhysics={() => {
                  if (!isAdmin) return;
                  setPhysicsEnabled((prev) => !prev);
                  setToast(!physicsEnabled ? 'Física Anti-Sobreposição Ativada' : 'Física Desativada');
                }}
                multiSelectMode={isMultiSelectMode}
                onToggleMultiSelect={() => {
                  if (!isAdmin) return;
                  setIsMultiSelectMode((prev) => !prev);
                  setToast(!isMultiSelectMode ? 'Modo Seleção Múltipla Ativado' : 'Modo Seleção Individual');
                }}
                canUndo={isAdmin && history.length > 0}
                onUndo={undo}
                canRedo={isAdmin && future.length > 0}
                onRedo={redo}
                isDark={isDark}
                isAdmin={isAdmin}
                userRole={userRole}
                onOpenSpotlight={() => {
                  if (isAdmin) {
                    setModal('spotlight');
                  } else {
                    setSearchInitialFilter('all');
                    setModal('search');
                  }
                }}
              />

              {/* MINIMAPA FIXO NA PARTE SUPERIOR (ACOMPANHA NAVEGAÇÃO E ZOOM SEM ATRAPALHAR) */}
              <div className="absolute top-3 right-3 z-20 flex flex-col items-end">
                <Minimap
                  elements={activeArea.elements}
                  worldWidth={worldWidth}
                  worldHeight={worldHeight}
                  camera={camera}
                  canvasSize={canvasSize}
                  onNavigate={(wx, wy) => navigateToPoint(wx, wy)}
                  onZoomIn={() => zoomBy(1.25)}
                  onZoomOut={() => zoomBy(1 / 1.25)}
                  onFitPlan={fitPlan}
                  isDark={isDark}
                  isDraggingCanvas={isDragging}
                  highlightedPoint={highlightedDetails ? { x: highlightedDetails.x, y: highlightedDetails.y, name: highlightedDetails.code || highlightedDetails.name } : null}
                  defaultCollapsed={typeof window !== 'undefined' ? window.innerWidth < 768 : false}
                />
              </div>

              {/* BOTÃO FLUTUANTE DE LEGENDA RÁPIDA (SEM MENU SPLIT) */}
              <div className="absolute bottom-5 right-4 z-20">
                <FloatingGeographicLegendButton
                  elements={activeArea.elements}
                  selectedId={selectedId}
                  onSelectZone={(zone) => {
                    setHighlightId(null);
                    setSelectedId(zone.id);
                    setSelectedPositionId(null);
                    navigateToPoint(zone.x + zone.width / 2, zone.y + zone.height / 2, 1.3);
                    if (tool !== 'pan') {
                      setDesktopSidebarOpen(true);
                      setMobileDrawerOpen(true);
                    }
                    setToast(`Zona focalizada: ${zone.name}`);
                  }}
                  scaleRatio={scaleRatio}
                  isDark={isDark}
                  onFocusPerimeterLegend={() => {
                    navigateToPoint(worldWidth + 170, 200, 1.0);
                    setToast('Focalizando legenda no perímetro do barracão');
                  }}
                />
              </div>

              {/* CARD COMPACTO DE RESUMO DO PRODUTO NO MODO VISUALIZAÇÃO (SEM ABRIR MENU DE EDIÇÃO) */}
              {selected && tool === 'pan' && (
                <ProductQuickCard
                  element={selected}
                  position={
                    selectedPositionId
                      ? selected.internalPositions?.find((p) => p.id === selectedPositionId) ?? null
                      : null
                  }
                  areaName={activeArea.name}
                  isDark={isDark}
                  isAdmin={isAdmin}
                  canSeeReservationAction={canSeeReserve}
                  canPersistReservation={canPersistReserve}
                  reservationBusy={sharedMap.reservationSyncing}
                  shiftRightForPanel={canUseConferentePanel && conferentePanelOpen}
                  isDragging={isDragging}
                  onClose={() => {
                    setSelectedId(null);
                    setSelectedPositionId(null);
                    setHighlightId(null);
                  }}
                  onCenter={() => {
                    const pos = selectedPositionId
                      ? selected.internalPositions?.find((p) => p.id === selectedPositionId)
                      : null;
                    if (pos) {
                      const cx = selected.x + (pos.relX || 0) + (pos.relWidth || 25) / 2;
                      const cy = selected.y + (pos.relY || 0) + (pos.relHeight || 25) / 2;
                      navigateToPoint(cx, cy, 1.5);
                    } else {
                      navigateToPoint(selected.x + selected.width / 2, selected.y + selected.height / 2, 1.4);
                    }
                  }}
                  onToggleReservePosition={(elId, posId, storeName, reserveQty) => {
                    void handleToggleReservePosition(elId, posId, storeName, reserveQty);
                  }}
                  onSwitchToEdit={
                    isAdmin
                      ? () => {
                          setHighlightId(null);
                          setTool('select');
                          setDesktopSidebarOpen(true);
                          setMobileDrawerOpen(true);
                        }
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* 3. MENU / GAVETA DE EDIÇÃO RESPONSIVO (APENAS NO MODO SELECIONAR) */}
        {selected && tool === 'select' && (
          <>
            {/* BOTAO FLUTUANTE PARA REABRIR PROPRIEDADES NO DESKTOP */}
            {!desktopSidebarOpen && !freeMoveMode && (
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(true)}
                className={`hidden md:flex absolute top-4 right-4 z-20 items-center gap-2 px-3 py-2 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold transition-all hover:scale-105 cursor-pointer ${
                  isDark
                    ? 'bg-slate-900/95 hover:bg-slate-850 border-slate-700/80 text-slate-100 shadow-slate-950/80'
                    : 'bg-white/95 hover:bg-slate-50 border-slate-300 text-slate-800 shadow-slate-300/40'
                }`}
                title="Abrir painel de propriedades"
              >
                <PanelRightOpen className="w-4 h-4 text-orange-500" />
                <span>Propriedades: {selected.name}</span>
              </button>
            )}

            {/* DESKTOP SIDEBAR (MD+) ENXUTA E DINÂMICA */}
            <aside
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`hidden md:flex w-80 shrink-0 border-l p-3.5 flex-col z-10 overflow-y-auto transition-all duration-200 relative ${
                isDark ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
              } ${isDragging ? 'opacity-25 pointer-events-none scale-[0.99]' : 'opacity-100'} ${
                !desktopSidebarOpen || freeMoveMode ? '!hidden' : ''
              }`}
            >
              {/* Botão de recolhimento na borda do painel */}
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(false)}
                className={`hidden md:flex absolute -left-3.5 top-5 z-20 w-7 h-7 rounded-full border shadow-md items-center justify-center transition-all hover:scale-110 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
                title="Recolher painel para liberar tela inteira"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <SelectionInspector
                selected={selected}
                selectedIds={selectedIds}
                selectedElements={selectedElements}
                allElements={activeArea.elements}
                scaleRatio={scaleRatio}
                worldWidth={worldWidth}
                worldHeight={worldHeight}
                selectedPositionId={selectedPositionId}
                isolatedSpaceId={isolatedSpaceId}
                isDark={isDark}
                isAdmin={isAdmin}
                userRole={userRole}
                currentUserName={auth.profile?.fullName || auth.user?.email || undefined}
                currentUserEmail={auth.user?.email || undefined}
                onReplaceItem={replaceItem}
                onPatchElements={(mapper, toastMsg) => {
                  patchActive((a) => ({ ...a, elements: mapper(a.elements) }));
                  if (toastMsg) setToast(toastMsg);
                }}
                onSelectPosition={setSelectedPositionId}
                onUpdateZoneVolumeType={handleUpdateZoneVolumeType}
                onToggleLock={toggleLockSelected}
                onRotateBy={rotateSelectedBy}
                onNudge={nudgeSelected}
                onDuplicate={duplicateSelected}
                onRequestDelete={() => setModal('delete')}
                onOpenRackModal={() => setModal('rack-gen')}
                onToggleIsolate={(el) => {
                  if (isolatedSpaceId === el.id) {
                    setIsolatedSpaceId(null);
                    setToast('Modo Foco desativado');
                  } else {
                    setIsolatedSpaceId(el.id);
                    fitToElement(el);
                    setToast(`Modo Foco Ativo: "${el.name}"`);
                  }
                }}
                onSelectGroup={selectGroup}
                onClearSelection={() => setSelectedId(null)}
                onEnterFreeMove={() => setFreeMoveMode(true)}
                onCollapseDesktop={() => setDesktopSidebarOpen(false)}
                onRequestLogin={() => setModal('auth')}
                onCreateGroupId={() => createId('group')}
              />
            </aside>

            {/* MOBILE BOTTOM SHEET DRAWER (<MD) ENXUTO E DINÂMICO */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`md:hidden fixed bottom-14 left-0 right-0 z-30 transition-all duration-200 ease-out border-t shadow-2xl rounded-t-2xl overflow-hidden ${
                isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
              } ${
                isDragging || freeMoveMode
                  ? 'translate-y-full opacity-0 pointer-events-none'
                  : mobileDrawerOpen
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-[calc(100%-44px)] opacity-100'
              }`}
            >
              {/* Barra de Puxar da Gaveta Mobile */}
              <div
                onClick={() => setMobileDrawerOpen((prev) => !prev)}
                className={`h-11 flex items-center justify-between px-3 cursor-pointer border-b ${
                  isDark ? 'border-slate-800/70 bg-slate-950/75' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selected.color || '#f97316' }} />
                  <span className="text-xs font-bold truncate max-w-[135px]">{selected.name}</span>
                  {selected.locked && (
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFreeMoveMode(true);
                          setToast('Modo Movimentação Livre Ativado');
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold text-orange-400 bg-orange-500/15 border border-orange-500/35 flex items-center gap-1"
                        title="Mover livremente no mapa"
                      >
                        <Move className="w-3 h-3" />
                        <span>Mover</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLockSelected();
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold ${
                          selected.locked
                            ? 'text-amber-400 bg-amber-500/20'
                            : isDark
                            ? 'text-slate-400 bg-slate-800'
                            : 'text-slate-500 bg-slate-200'
                        }`}
                      >
                        {selected.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileDrawerOpen((prev) => !prev);
                    }}
                    className={`p-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    title={mobileDrawerOpen ? 'Recolher' : 'Expandir'}
                  >
                    {mobileDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(null);
                    }}
                    className={`p-1 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                    title="Fechar seleção"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conteúdo Unificado da Gaveta Mobile */}
              <div className="p-3 max-h-[65vh] sm:max-h-[50vh] overflow-y-auto overscroll-contain">
                <SelectionInspector
                  selected={selected}
                  selectedIds={selectedIds}
                  selectedElements={selectedElements}
                  allElements={activeArea.elements}
                  scaleRatio={scaleRatio}
                  worldWidth={worldWidth}
                  worldHeight={worldHeight}
                  selectedPositionId={selectedPositionId}
                  isolatedSpaceId={isolatedSpaceId}
                  isDark={isDark}
                  isAdmin={isAdmin}
                  userRole={userRole}
                  currentUserName={auth.profile?.fullName || auth.user?.email || undefined}
                  currentUserEmail={auth.user?.email || undefined}
                  isMobile
                  onReplaceItem={replaceItem}
                  onPatchElements={(mapper, toastMsg) => {
                    patchActive((a) => ({ ...a, elements: mapper(a.elements) }));
                    if (toastMsg) setToast(toastMsg);
                  }}
                  onSelectPosition={setSelectedPositionId}
                  onUpdateZoneVolumeType={handleUpdateZoneVolumeType}
                  onToggleLock={toggleLockSelected}
                  onRotateBy={rotateSelectedBy}
                  onNudge={nudgeSelected}
                  onDuplicate={duplicateSelected}
                  onRequestDelete={() => setModal('delete')}
                  onOpenRackModal={() => setModal('rack-gen')}
                  onToggleIsolate={(el) => {
                    if (isolatedSpaceId === el.id) {
                      setIsolatedSpaceId(null);
                      setToast('Modo Foco desativado');
                    } else {
                      setIsolatedSpaceId(el.id);
                      fitToElement(el);
                      setToast(`Modo Foco Ativo: "${el.name}"`);
                    }
                  }}
                  onSelectGroup={selectGroup}
                  onClearSelection={() => setSelectedId(null)}
                  onEnterFreeMove={() => setFreeMoveMode(true)}
                  onRequestLogin={() => setModal('auth')}
                  onCreateGroupId={() => createId('group')}
                />
              </div>
            </div>

            {/* BARRA FLUTUANTE DE MOVIMENTAÇÃO LIVRE ENXUTA */}
            {selected && (freeMoveMode || !desktopSidebarOpen) && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className={`fixed bottom-16 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-150 max-w-[96vw] ${
                  isDark ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/80' : 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-400/40'
                } ${isDragging ? 'opacity-20 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}
              >
                {/* Nome do Objeto com cor do setor */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/70 border border-slate-800">
                  <div className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: selected.color || '#f97316' }} />
                  <span className="text-xs font-bold truncate max-w-[90px] sm:max-w-[140px]">{selected.name}</span>
                </div>

                {/* Coordenadas e Dimensões em Tempo Real */}
                <div className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono tabular-nums text-orange-400">
                  <span>{Math.round(selected.x / scaleRatio)}m, {Math.round(selected.y / scaleRatio)}m</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-300 font-sans text-[10px]">{Math.round(selected.width / scaleRatio)}×{Math.round(selected.height / scaleRatio)}m</span>
                </div>

                {/* D-Pad de Micro-Ajuste Compacto (APENAS ADMIN) */}
                {isAdmin && (
                <>
                <div className="flex items-center gap-0.5 bg-slate-950/70 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    disabled={selected.locked}
                    onClick={() => nudgeSelected(-0.5, 0)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:bg-orange-600 text-slate-200 flex items-center justify-center font-bold text-xs disabled:opacity-30"
                    title="Mover 0.5m para a esquerda"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={selected.locked}
                    onClick={() => nudgeSelected(0, -0.5)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:bg-orange-600 text-slate-200 flex items-center justify-center font-bold text-xs disabled:opacity-30"
                    title="Mover 0.5m para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={selected.locked}
                    onClick={() => nudgeSelected(0, 0.5)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:bg-orange-600 text-slate-200 flex items-center justify-center font-bold text-xs disabled:opacity-30"
                    title="Mover 0.5m para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={selected.locked}
                    onClick={() => nudgeSelected(0.5, 0)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:bg-orange-600 text-slate-200 flex items-center justify-center font-bold text-xs disabled:opacity-30"
                    title="Mover 0.5m para a direita"
                  >
                    →
                  </button>
                </div>

                {/* Alternar Magnetismo / Snap */}
                <button
                  type="button"
                  onClick={() => {
                    setSnapEnabled((prev) => !prev);
                    setToast(!snapEnabled ? 'Magnetismo Ativado' : 'Movimento Livre Ativado');
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                    snapEnabled
                      ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={snapEnabled ? 'Magnetismo ligado' : 'Movimento Livre'}
                >
                  <Magnet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{snapEnabled ? 'Snap' : 'Livre'}</span>
                </button>
                </>
                )}

                {/* Retornar ao Painel de Propriedades */}
                <button
                  type="button"
                  onClick={() => {
                    setFreeMoveMode(false);
                    setDesktopSidebarOpen(true);
                    setMobileDrawerOpen(true);
                  }}
                  className="px-2 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Propriedades</span>
                </button>

                {/* Concluir / Desmarcar */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setFreeMoveMode(false);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                  title="Concluir seleção"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* SELETOR RÁPIDO DE FERRAMENTA DE DESENHO NO MOBILE */}
      {((isAdmin && (tool === 'rectangle' || tool === 'divider')) || tool === 'measure') && (
        <div className="md:hidden fixed bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur-md">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => { selectToolSafe('rectangle'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  tool === 'rectangle' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <RectangleHorizontal className="w-3.5 h-3.5" />
                <span>Área</span>
              </button>
              <button
                type="button"
                onClick={() => { selectToolSafe('divider'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  tool === 'divider' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Parede</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setTool('measure')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              tool === 'measure' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Medir</span>
          </button>
          <button
            type="button"
            onClick={() => { setTool('select'); setMeasureLine(null); }}
            className="p-1 text-slate-400 hover:text-slate-200"
            title="Sair do modo desenho"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}



      {/* 5. BARRA DE STATUS INFERIOR DESKTOP (MD+) */}
      <footer
        className={`hidden md:flex h-7 shrink-0 items-center justify-between px-4 border-t text-[11px] font-mono z-20 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="text-slate-300 font-semibold tabular-nums">
            X: {(cursorWorld.x / scaleRatio).toFixed(2)}m · Y: {(cursorWorld.y / scaleRatio).toFixed(2)}m
          </span>
          <span className="text-slate-500 truncate max-w-[200px]">{activeArea.name}</span>
          <span className="text-orange-400">
            {bounds.widthMeters}m × {bounds.heightMeters}m ({bounds.areaM2.toLocaleString('pt-BR')} m²)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-[10px]">
            {isAdmin
              ? 'V: Selecionar · L: Travar Objeto · R: Zonas · M: Mover · T: Medir · Ctrl+K: Buscar'
              : 'Arraste para navegar · Toque no item para visualizar · Ctrl+K: Buscar'}
          </span>
          <button
            type="button"
            onClick={() => openAccessPanel('overview')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
              isAdmin
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : isAssistencia
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : isConferente
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
                : 'border-slate-600/50 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20'
            }`}
            title="Abrir Central de Acesso & Sincronização"
          >
            {isAdmin ? (
              <ShieldCheck className="w-3 h-3" />
            ) : isAssistencia ? (
              <BookmarkCheck className="w-3 h-3" />
            ) : isConferente ? (
              <ClipboardCheck className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            <span>
              {auth.cargoName || (isCommonUser ? 'Comum' : ROLE_METADATA[userRole].shortLabel)}
            </span>
            {sharedMap.connectionStatus === 'connected' ? (
              <Cloud className="w-3 h-3 text-emerald-400" />
            ) : (
              <CloudOff className="w-3 h-3 text-amber-400" />
            )}
            {sharedMap.mapVersion && sharedMap.mapVersion > 0 && (
              <span className="opacity-80">v{sharedMap.mapVersion}</span>
            )}
          </button>
          <span className="font-semibold text-orange-400 tabular-nums">{Math.round(camera.scale * 100)}%</span>
        </div>
      </footer>

      {/* TOAST FLUTUANTE */}
      {toast && (
        <div className="fixed bottom-16 md:bottom-10 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs shadow-xl animate-fade-in flex items-center gap-2 max-w-[90vw]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* DRAWER MENU RÁPIDO MOBILE (APENAS VISITANTE; LOGADOS USAM O ÍCONE DE PERFIL RETRÁTIL) */}
      {mobileMenuOpen && !auth.isAuthenticated && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs">
          <div
            className={`w-full max-h-[80vh] rounded-t-2xl border-t shadow-2xl p-4 overflow-y-auto ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                <span>Funções & Configurações do Galpão</span>
              </h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2.5 space-y-3 text-xs">
              {/* Seção 0: Acesso & Sincronização */}
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isAdmin ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isAssistencia ? (
                      <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : isConferente ? (
                      <ClipboardCheck className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 truncate">
                        {auth.cargoName ||
                          (isCommonUser ? 'Usuário Comum (aguardando cargo)' : ROLE_METADATA[userRole].label)}
                      </div>
                      {auth.user?.email && (
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {auth.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 ${
                      sharedMap.connectionStatus === 'connected'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {sharedMap.connectionStatus === 'connected'
                      ? `Nuvem v${sharedMap.mapVersion ?? 1}`
                      : 'Local'}
                  </span>
                </div>

                {isAdmin && auth.isConfigured && sharedMap.hasUnsavedChanges && (
                  <button
                    type="button"
                    disabled={sharedMap.syncStatus === 'syncing'}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void sharedMap.flushSaveToCloud();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold flex items-center justify-center gap-2"
                  >
                    {sharedMap.syncStatus === 'syncing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    <span>
                      {sharedMap.syncStatus === 'syncing'
                        ? 'Salvando alterações na nuvem...'
                        : 'Salvar Alterações na Nuvem'}
                    </span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setModal('access-panel');
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Cloud className="w-3.5 h-3.5 text-sky-400" />
                    <span>Sincronização</span>
                  </button>

                  {auth.isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void auth.logout();
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <span>Sair ({ROLE_METADATA[userRole].shortLabel})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setModal('auth');
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Entrar no Sistema</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Seção 1: Busca & Perfil Operacional */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Busca WMS</span>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setSearchInitialFilter('all');
                      setModal('search');
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold"
                  >
                    <Search className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>Buscar Produto, Código ou SKU</span>
                  </button>

                  {(canReservePositions || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setSearchInitialFilter('reserved');
                        setModal('search');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold"
                    >
                      <span className="flex items-center gap-2">
                        <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Itens Reservados</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px]">
                        {reservedCount}
                      </span>
                    </button>
                  )}

                  {canUseConferentePanel && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setConferentePanelOpen(true);
                      }}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-bold"
                    >
                      <ClipboardCheck className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Abrir Painel do Conferente</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Seção 2: Gestão do Galpão & Medição (Oculto para Visitante simples) */}
              {!isVisitor && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Espaço & Medidas</span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setModal('layers');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-semibold"
                    >
                      <div className="flex items-center gap-2.5">
                        <Layers className="w-4 h-4 text-orange-400 shrink-0" />
                        <span>Camadas & Foco Individual por Espaço</span>
                      </div>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setModal('warehouse-size');
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-semibold"
                        >
                          <div className="flex items-center gap-2.5">
                            <Maximize2 className="w-4 h-4 text-orange-400 shrink-0" />
                            <span>Tamanho do Galpão ({bounds.widthMeters}m × {bounds.heightMeters}m)</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setModal('scale');
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-semibold"
                        >
                          <div className="flex items-center gap-2.5">
                            <Ruler className="w-4 h-4 text-orange-400 shrink-0" />
                            <span>Calibrar Escala CAD (1m = {scaleRatio}px)</span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Seção 3: Galpões, Backup & Exportação */}
              {(isAdmin || canReservePositions) && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Galpões & Exportação</span>
                  <div className="grid grid-cols-2 gap-2">
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            openWarehouseManager('list');
                          }}
                          className="col-span-2 p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-100 font-semibold flex items-center justify-center gap-2 border border-slate-700/80"
                        >
                          <Warehouse className="w-4 h-4 text-orange-400" />
                          <span>Gerenciar Galpões (Criar / Editar / Excluir)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            openWarehouseManager('edit', activeArea.id);
                          }}
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 font-medium flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5 text-orange-400" />
                          <span>Editar Galpão</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            openWarehouseManager('create');
                          }}
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 font-medium flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Novo Galpão</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            exportBackup();
                          }}
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 font-medium flex items-center justify-center gap-1.5"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          <span>Exportar JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                          className="p-2 rounded-lg bg-slate-800 text-slate-300 font-medium flex items-center justify-center gap-1.5"
                        >
                          <ArrowUpFromLine className="w-3.5 h-3.5" />
                          <span>Importar JSON</span>
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setModal('png-export');
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-md shadow-orange-950/40 mt-1"
                  >
                    <CameraIcon className="w-4 h-4" />
                    <span>Exportar Imagem PNG em Alta Resolução</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DO SISTEMA */}

      {/* MODAL: EXPORTAR IMAGEM PNG EM ALTA RESOLUÇÃO */}
      <PngExportDialog
        isOpen={modal === 'png-export'}
        onClose={() => setModal(null)}
        area={activeArea}
        bounds={bounds}
        scaleRatio={scaleRatio}
        camera={camera}
        canvasSize={canvasSize}
        isDark={isDark}
      />

      {/* MODAL: GERENCIAR GALPÕES / BARRACÕES (CRIAR, EDITAR E EXCLUIR - APENAS ADMIN) */}
      <WarehouseManagerDialog
        isOpen={isAdmin && modal === 'warehouses'}
        onClose={() => setModal(null)}
        areas={areas}
        activeAreaId={activeId}
        initialMode={warehouseManagerMode}
        initialEditAreaId={warehouseManagerEditId}
        onSelectArea={(id) => {
          setActiveId(id);
          setSelectedId(null);
          setSelectedPositionId(null);
          setHighlightId(null);
          setIsolatedSpaceId(null);
        }}
        onCreateArea={handleCreateWarehouse}
        onUpdateArea={handleUpdateWarehouse}
        onDeleteArea={handleDeleteWarehouse}
        isDark={isDark}
      />

      {/* MODAL: REDIMENSIONAR TAMANHO DO ESPAÇO (APENAS ADMIN) */}
      <WarehouseSizeDialog
        isOpen={isAdmin && modal === 'warehouse-size'}
        onClose={() => setModal(null)}
        currentWidthMeters={bounds.widthMeters}
        currentHeightMeters={bounds.heightMeters}
        onSaveDimensions={handleSaveWarehouseDimensions}
        isDark={isDark}
      />

      {/* MODAL: CAMADAS & EDIÇÃO POR ESPAÇO / GRUPO */}
      <LayersManagerDialog
        isOpen={modal === 'layers'}
        onClose={() => setModal(null)}
        elements={activeArea.elements}
        focusedGroupId={isolatedSpaceId}
        onSetFocusedGroupId={(id) => {
          setIsolatedSpaceId(id);
          if (id) {
            const z = activeArea.elements.find((el) => el.id === id);
            if (z) fitToElement(z);
          }
        }}
        onUpdateElements={(updated) => {
          if (!isAdmin) return;
          patchActive((area) => ({ ...area, elements: updated }));
        }}
        isDark={isDark}
        readOnly={!isAdmin}
      />

      {/* MODAL: BUSCA GLOBAL WMS & LOCALIZADOR */}
      <WMSSearchDialog
        isOpen={modal === 'search'}
        onClose={() => {
          setModal(null);
          setSearchInitialFilter('all');
        }}
        areas={areas}
        activeAreaId={activeId}
        onNavigateToResult={handleNavigateToSearchResult}
        isDark={isDark}
        initialFilterType={searchInitialFilter}
      />

      {/* MODAL: SPOTLIGHT COMMAND PALETTE 4.0 (CTRL+K) */}
      <SpotlightPalette
        isOpen={modal === 'spotlight'}
        onClose={() => setModal(null)}
        areas={areas}
        activeAreaId={activeId}
        isDark={isDark}
        isAdmin={isAdmin}
        onNavigateToPosition={handleSpotlightNavigate}
        onExecuteAction={handleSpotlightAction}
      />

      {/* MODAL: ATALHOS DE TECLADO 4.0 */}
      <KeyboardShortcutsDialog
        isOpen={modal === 'shortcuts'}
        onClose={() => setModal(null)}
        isDark={isDark}
      />

      {/* MODAL: CALIBRAÇÃO DE ESCALA MÉTRICA (APENAS ADMIN) */}
      <ScaleCalibrationDialog
        isOpen={isAdmin && modal === 'scale'}
        onClose={() => setModal(null)}
        currentScaleRatio={scaleRatio}
        onSaveScaleRatio={(newRatio) => {
          if (!isAdmin) return;
          patchActive((area) => ({ ...area, scaleRatio: newRatio }));
          setToast(`Escala calibrada: 1m = ${newRatio}px.`);
        }}
        isDark={isDark}
      />

      {/* MODAL: EXCLUSÃO DE ELEMENTO (APENAS ADMIN) */}
      {isAdmin && modal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl p-5 bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Excluir elemento?</h3>
            <p className="text-xs text-slate-400 mb-5">
              &ldquo;{selected?.name}&rdquo; será removido da planta deste armazém.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected && !selected.locked) {
                    patchActive((area) => ({
                      ...area,
                      elements: area.elements.filter((el) => el.id !== selected.id),
                    }));
                    setSelectedId(null);
                    setModal(null);
                    setToast('Elemento excluído.');
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RENOMEAR GALPÃO (APENAS ADMIN) */}
      {isAdmin && modal === 'rename' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl p-5 bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Renomear Galpão</h3>
            <input
              type="text"
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-950 text-slate-100 mb-4"
              placeholder="Ex: CD Central — Armazém A"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameDraft.trim()) {
                    patchActive((area) => ({ ...area, name: renameDraft.trim() }));
                    setModal(null);
                    setToast('Nome atualizado.');
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESTAURAR BACKUP (APENAS ADMIN) */}
      {isAdmin && modal === 'import' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl p-5 bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Restaurar backup?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Deseja substituir todas as áreas atuais pelas áreas do backup importado?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setQueuedImport(null);
                }}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyImport}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white"
              >
                Substituir e Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOGIN, AUTOCADASTRO COMUM & RECUPERAÇÃO DE SENHA */}
      <AuthDialog
        isOpen={modal === 'auth'}
        onClose={() => setModal(null)}
        isConfigured={auth.isConfigured}
        configError={auth.configError}
        isDark={isDark}
        passwordRecoveryPending={auth.passwordRecoveryPending}
        onLogin={auth.login}
        onSignUp={auth.signUp}
        onSignedUpCommonUser={(needsEmail) => {
          setToast(
            needsEmail
              ? 'Conta criada! Confirme seu e-mail para aguardar a atribuição de cargo.'
              : 'Conta de Usuário Comum criada! Aguarde o Administrador atribuir seu cargo.'
          );
        }}
        onRequestPasswordReset={auth.requestPasswordReset}
        onCompletePasswordRecovery={auth.completePasswordRecovery}
        onClearPasswordRecovery={auth.clearPasswordRecovery}
      />

      {/* MODAL: CENTRAL DE ACESSO, PERFIL, MEMBROS, CARGOS & SINCRONIZAÇÃO EM NUVEM */}
      <AdminPanelDialog
        isOpen={modal === 'access-panel'}
        initialTab={accessPanelTab}
        onClose={() => setModal(null)}
        isDark={isDark}
        isConfigured={auth.isConfigured}
        configError={auth.configError}
        user={auth.user}
        profile={auth.profile}
        role={auth.role}
        cargoId={auth.cargoId}
        cargoName={auth.cargoName}
        cargoColor={auth.cargoColor}
        permissions={auth.permissions}
        isAdmin={isAdmin}
        canManageRoles={canManageRoles}
        isAuthenticated={auth.isAuthenticated}
        connectionStatus={sharedMap.connectionStatus}
        syncStatus={sharedMap.syncStatus}
        syncError={sharedMap.syncError}
        mapVersion={sharedMap.mapVersion}
        lastUpdatedAt={sharedMap.lastUpdatedAt}
        lastUpdatedByEmail={sharedMap.lastUpdatedByEmail}
        hasUnsavedChanges={sharedMap.hasUnsavedChanges}
        onOpenLogin={() => setModal('auth')}
        onLogout={auth.logout}
        onRefreshAccess={auth.refreshRole}
        onUpdateProfile={auth.updateProfile}
        onChangePassword={auth.changePassword}
        onForceSyncNow={() => sharedMap.flushSaveToCloud()}
        onReloadFromCloud={() => sharedMap.reloadFromCloud()}
        onExportBackup={exportBackup}
        onOpenWarehouseManager={isAdmin ? () => openWarehouseManager('list') : undefined}
        onOpenResizeDialog={isAdmin ? () => setModal('warehouse-size') : undefined}
        onOpenScaleDialog={isAdmin ? () => setModal('scale') : undefined}
      />

      {/* MODAL: MIGRAÇÃO INICIAL DO MAPA LOCAL PARA O SUPABASE */}
      <MigrationDialog
        isOpen={sharedMap.shouldShowMigrationPrompt}
        isDark={isDark}
        candidate={sharedMap.localMigrationCandidate}
        busy={sharedMap.migrationBusy}
        onExportLocalJson={() => {
          const candidateAreas = sharedMap.localMigrationCandidate?.areas;
          if (!candidateAreas || candidateAreas.length === 0) {
            exportBackup();
            return;
          }
          const data = {
            format: 'movare-localizador-backup',
            version: 3,
            exportedAt: new Date().toISOString(),
            areas: candidateAreas,
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `movare-backup-pre-migracao-${new Date().toISOString().slice(0, 10)}.json`;
          link.click();
          URL.revokeObjectURL(url);
          setToast('Backup JSON local salvo antes da migração.');
        }}
        onConfirmMigrate={() => sharedMap.migrateLocalCandidateToCloud()}
        onStartClean={() => sharedMap.initializeCleanCentralMap()}
        onDismiss={() => sharedMap.dismissMigrationPrompt()}
      />

      {/* MODAL: RESOLUÇÃO DE CONFLITO DE EDIÇÃO SIMULTÂNEA */}
      <ConflictDialog
        conflict={sharedMap.conflictState}
        isDark={isDark}
        onExportLocalDraft={() => {
          const draftAreas = sharedMap.conflictState?.localAreas || areasRef.current;
          const data = {
            format: 'movare-localizador-backup',
            version: 3,
            exportedAt: new Date().toISOString(),
            areas: draftAreas,
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `movare-rascunho-conflito-${new Date().toISOString().slice(0, 10)}.json`;
          link.click();
          URL.revokeObjectURL(url);
          setToast('Rascunho local exportado em JSON com segurança.');
        }}
        onReloadRemote={() => sharedMap.resolveConflictReloadRemote()}
        onPublishLocalDraft={() => sharedMap.resolveConflictPublishLocalDraft()}
        onDismiss={() => sharedMap.dismissConflict()}
      />

      {/* TELA DE CARREGAMENTO LENTA COM LOGOTIPO MOVARE */}
      {showSplashScreen && (
        <MovareSplashScreen
          onFinished={() => setShowSplashScreen(false)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
