import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, CircleHelp, Crosshair,
  LayoutGrid, Minus, MousePointer2, Redo2, RectangleHorizontal, RotateCcw,
  Ruler, Trash2, X, ZoomIn, ZoomOut, Pencil, Warehouse, Search, Layers,
  Sun, Moon, Plus, Box as BoxIcon, Move, Copy, MapPinned, ChevronUp, ChevronRight,
  Lock, Unlock, RotateCw, Sparkles, SlidersHorizontal, ArrowLeftRight,
  Maximize2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Tag, Target,
  Magnet, Sliders, PanelRightClose, PanelRightOpen, Shield, ShieldCheck,
  CheckSquare, Square, AlignLeft, AlignCenter, AlignRight, Users, Eye
} from 'lucide-react';
import {
  initialAreas, parseBackup, createId, DEFAULT_SCALE_RATIO, DEFAULT_WIDTH_METERS, DEFAULT_HEIGHT_METERS,
  WMS_COLOR_PALETTE, PRODUCT_SIZES, PRODUCT_CATEGORIES, getAreaBounds,
  type DrawingElement, type FloorArea, type RackSlot, type ProductSize
} from '../editor-model';
import { snapMovedElement, snapPointToElements, snapResizedRectangle, type AlignmentGuide } from '../alignment';
import { createGridDividers, createGridCells, parseTrackProportions, divideAreaIntoCells } from '../grid-geometry';
import {
  isSolidSpace,
  getSolidObstacles,
  resolveSpacePhysics,
  resolveGroupPhysics,
  alignGroupElements,
  getGroupBoundingBox,
  boxesOverlap,
  type Box,
} from '../physics';
import { loadAreas, saveAreas } from '../local-store';
import { CADRuler } from '../components/cad-ruler';
import { Minimap } from '../components/minimap';
import { WMSSearchDialog, type SearchResult } from '../components/wms-search-dialog';
import { ScaleCalibrationDialog } from '../components/scale-calibration-dialog';
import { WarehouseSizeDialog } from '../components/warehouse-size-dialog';
import { LayersManagerDialog } from '../components/layers-manager-dialog';
import { MovareSplashScreen } from '../components/movare-splash-screen';
import { ZoneInternalPositionsManager } from '../components/zone-positions-manager';
import {
  WarehouseGeographicLegendSVG,
  FloatingGeographicLegendButton,
} from '../components/geographic-legend';
import {
  recalculatePositionsOnZoneResize,
  getDefaultLayoutForCategory,
  calculateZoneInternalPositions,
  applyVolumePresetToZone,
  sanitizeZonePositions,
  generateStablePositionId,
} from '../zone-internal-positions';

type Tool = 'select' | 'move' | 'rectangle' | 'divider' | 'corridor' | 'measure' | 'pan';
type Camera = { x: number; y: number; scale: number };
type Point = { x: number; y: number };

type Gesture =
  | { kind: 'pan'; pointerId: number; startScreen: Point; camera: Camera }
  | { kind: 'empty_pan_or_deselect'; pointerId: number; startScreen: Point; camera: Camera }
  | { kind: 'pending_select_or_move'; pointerId: number; startScreen: Point; startWorld: Point; item: DrawingElement }
  | { kind: 'pending_select'; pointerId: number; startScreen: Point; camera: Camera; item: DrawingElement }
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

  const [areas, setAreas] = useState<FloorArea[]>(() => clone(initialAreas));
  const areasRef = useRef(areas);
  areasRef.current = areas;

  const [activeId, setActiveId] = useState(initialAreas[0].id);
  const activeArea = areas.find((area) => area.id === activeId) ?? areas[0] ?? initialAreas[0];
  const scaleRatio = activeArea?.scaleRatio ?? DEFAULT_SCALE_RATIO;

  // Dimensões dinâmicas do armazém ativo
  const bounds = useMemo(() => getAreaBounds(activeArea), [activeArea]);
  const worldWidth = bounds.widthPx;
  const worldHeight = bounds.heightPx;

  const [tool, setTool] = useState<Tool>('select');
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
  const [showActionBar, setShowActionBar] = useState(false);

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

  const [history, setHistory] = useState<FloorArea[][]>([]);
  const historyRef = useRef<FloorArea[][]>([]);
  const [future, setFuture] = useState<FloorArea[][]>([]);
  const futureRef = useRef<FloorArea[][]>([]);

  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const [storageReady, setStorageReady] = useState(false);

  // Modais do Sistema
  const [modal, setModal] = useState<
    'delete' | 'rename' | 'new-area' | 'import' | 'grid' |
    'search' | 'scale' | 'warehouse-size' | 'layers' | null
  >(null);

  // Modo de Edição Individual de Espaço (Sub-Mapa / Foco Isolado)
  const [isolatedSpaceId, setIsolatedSpaceId] = useState<string | null>(null);
  const isolatedSpace = activeArea?.elements?.find((el) => el.id === isolatedSpaceId) ?? null;

  const [renameDraft, setRenameDraft] = useState('');
  const [queuedImport, setQueuedImport] = useState<FloorArea[] | null>(null);
  const [toast, setToast] = useState('');
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Alternador de Tema
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('movare-theme', next);
      return next;
    });
  }, []);

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

  const recordAreas = useCallback((next: FloorArea[]) => {
    const before = clone(areasRef.current);
    historyRef.current = [...historyRef.current.slice(-59), before];
    futureRef.current = [];
    setHistory(historyRef.current);
    setFuture([]);
    areasRef.current = next;
    setAreas(next);
  }, []);

  const patchActive = useCallback((patcher: (area: FloorArea) => FloorArea) => {
    recordAreas(areasRef.current.map((area) => (area.id === activeId ? patcher(area) : area)));
  }, [activeId, recordAreas]);

  // Carrega áreas salvas
  useEffect(() => {
    let alive = true;
    loadAreas()
      .then((stored) => {
        if (!alive) return;
        const sanitized = stored.map((area) => ({
          ...area,
          elements: area.elements.map((el) => {
            if (el.type === 'rectangle' && el.internalPositions?.length) {
              return {
                ...el,
                internalPositions: sanitizeZonePositions(el.id, el.internalPositions),
              };
            }
            return el;
          }),
        }));
        areasRef.current = sanitized;
        setAreas(sanitized);
        if (sanitized[0]?.id) setActiveId(sanitized[0].id);
        setStorageReady(true);
        setSaveStatus('saved');
      })
      .catch(() => {
        if (!alive) return;
        setSaveStatus('error');
        setToast('Não foi possível ler o armazenamento deste dispositivo.');
      });
    return () => { alive = false; };
  }, []);

  // Salva automaticamente com debounce
  useEffect(() => {
    if (!storageReady) return;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      saveAreas(areas)
        .then(() => setSaveStatus('saved'))
        .catch(() => {
          setSaveStatus('error');
          setToast('Falha ao salvar no armazenamento local.');
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [areas, storageReady]);

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

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal('search');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'r': setTool('rectangle'); break;
        case 'm': setTool('measure'); break;
        case 'h': setTool('pan'); break;
        case 'l':
          if (selected) toggleLockSelected();
          break;
        case 'escape':
          setSelectedId(null);
          setSelectedPositionId(null);
          setHighlightId(null);
          setMeasureLine(null);
          setTool('select');
          setModal(null);
          setMobileMenuOpen(false);
          break;
        case 's':
          setSnapEnabled((prev) => !prev);
          break;
        case 'f':
          setFreeMoveMode((prev) => !prev);
          break;
        case 'arrowleft':
          if (selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(e.shiftKey ? -2 : -0.5, 0);
          }
          break;
        case 'arrowright':
          if (selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(e.shiftKey ? 2 : 0.5, 0);
          }
          break;
        case 'arrowup':
          if (selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(0, e.shiftKey ? -2 : -0.5);
          }
          break;
        case 'arrowdown':
          if (selected && !selected.locked) {
            e.preventDefault();
            nudgeSelected(0, e.shiftKey ? 2 : 0.5);
          }
          break;
        case 'delete':
        case 'backspace':
          if (selected && !selected.locked) setModal('delete');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

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

  // Zoom suave com a rodinha do mouse no desktop
  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const screen = pointToScreen(e.clientX, e.clientY);
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomBy(zoomFactor, screen);
  }

  function replaceItem(item: DrawingElement) {
    patchActive((area) => ({
      ...area,
      elements: area.elements.map((candidate) => (candidate.id === item.id ? item : candidate)),
    }));
  }

  // Alterna Bloqueio do Objeto
  function toggleLockSelected() {
    if (!selected) return;
    const isNowLocked = !selected.locked;
    replaceItem({ ...selected, locked: isNowLocked });
    setToast(isNowLocked ? `🔒 "${selected.name}" bloqueado contra movimentação` : `🔓 "${selected.name}" desbloqueado para edição`);
  }

  // Rotação Tátil Rápida (90 graus)
  function rotateSelectedBy(degrees: number) {
    if (!selected || selected.locked) return;
    const currentRot = selected.rotation || 0;
    const newRot = (Math.round((currentRot + degrees) / 90) * 90) % 360;
    replaceItem({ ...selected, rotation: (newRot + 360) % 360 });
    setToast(`Girado para ${(newRot + 360) % 360}°`);
  }

  // Ajuste Tátil Fino de Posição (D-Pad Mobile)
  function nudgeSelected(dxM: number, dyM: number) {
    if (!selected || selected.locked) return;
    const dxPx = dxM * scaleRatio;
    const dyPx = dyM * scaleRatio;
    replaceItem({
      ...selected,
      x: Math.max(0, Math.min(worldWidth - selected.width, selected.x + dxPx)),
      y: Math.max(0, Math.min(worldHeight - selected.height, selected.y + dyPx)),
    });
  }

  // Ajuste Tátil Fino de Dimensão (+ / - metros)
  function tactileResize(dimension: 'width' | 'height', deltaM: number) {
    if (!selected || selected.locked) return;
    const deltaPx = deltaM * scaleRatio;
    let updatedItem: DrawingElement;
    if (dimension === 'width') {
      const newW = Math.max(scaleRatio * 0.5, selected.width + deltaPx);
      updatedItem = { ...selected, width: newW };
    } else {
      const newH = Math.max(scaleRatio * 0.5, selected.height + deltaPx);
      updatedItem = { ...selected, height: newH };
    }

    if (updatedItem.type === 'rectangle' && (updatedItem.internalPositions?.length || updatedItem.internalLayout)) {
      const resizeResult = recalculatePositionsOnZoneResize(
        updatedItem,
        scaleRatio,
        updatedItem.internalLayout,
        updatedItem.internalPositions || []
      );
      updatedItem = { ...updatedItem, internalPositions: resizeResult.positions };
      if (resizeResult.hasLossWarning) {
        setToast(`Atenção: Dimensões reduzidas. ${resizeResult.overflowOccupiedPositions.length} posições com estoque foram preservadas.`);
      }
    }

    replaceItem(updatedItem);
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
  }, [activeArea.elements, patchActive, setSelectedId, worldHeight, worldWidth]);

  const handleAddCorridorLabel = (defaultText?: string) => {
    const cx = Math.round((canvasSize.width / 2 - camera.x) / camera.scale);
    const cy = Math.round((canvasSize.height / 2 - camera.y) / camera.scale);
    handleAddCorridorAtPoint({ x: cx, y: cy }, defaultText);
  };

  // MANIPULAÇÃO DE TOQUE E PONTEIROS
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    setAlignmentGuides([]);
    const screen = pointToScreen(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, screen);
    event.currentTarget.setPointerCapture(event.pointerId);

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
    setCursorWorld(world);
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

    // 1. Se estiver na ferramenta 'pan' (Mão), toca para navegar independentemente de tocar em elementos
    if (tool === 'pan') {
      gestureRef.current = { kind: 'pan', pointerId: event.pointerId, startScreen: screen, camera: cameraRef.current };
      return;
    }

    // 2. Fita métrica
    if (tool === 'measure') {
      gestureRef.current = { kind: 'draw', pointerId: event.pointerId, startWorld: world, endWorld: world, type: 'measure' };
      setMeasureLine({ start: world, end: world });
      return;
    }

    // 3. Rotação tátil por alça (apenas no modo mover)
    if (rotateHandle && selected && !selected.locked && tool === 'move') {
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

    // 4. Redimensionamento por alça (apenas no modo mover)
    if (handle && selected && !selected.locked && tool === 'move') {
      gestureRef.current = { kind: 'resize', pointerId: event.pointerId, startWorld: world, item: clone(selected), corner: handle };
      return;
    }

    // 5. Desenho de retângulos ou paredes
    if (tool === 'rectangle' || tool === 'divider') {
      const snapped = snapPointToElements(world, activeArea.elements, cameraRef.current.scale);
      gestureRef.current = { kind: 'draw', pointerId: event.pointerId, startWorld: snapped.point, endWorld: snapped.point, type: tool };
      setAlignmentGuides(snapped.guides);
      setPreview({ id: 'preview', type: tool, name: '', x: snapped.point.x, y: snapped.point.y, width: 1, height: 1 });
      return;
    }

    // 6. Modo Exclusivo de Corredores (Seleção/Adição/Remoção de Corredores)
    if (tool === 'corridor') {
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

    // 7. Modo Exclusivo de Mover (Apenas mover e redimensionar no mapa)
    if (tool === 'move' && item) {
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
    const world = pointToWorld(event.clientX, event.clientY);
    setCursorWorld(world);

    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      const first = pointersRef.current.get(gesture.ids[0]);
      const second = pointersRef.current.get(gesture.ids[1]);
      if (!first || !second) return;
      const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const scale = Math.max(0.08, Math.min(4.5, gesture.camera.scale * (dist(first, second) / gesture.distance)));
      setCameraSafe(constrainCamera({ scale, x: mid.x - gesture.anchor.x * scale, y: mid.y - gesture.anchor.y * scale }));
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;

    // Rotação tátil suave
    if (gesture.kind === 'rotate') {
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

    // Limiar tátil anti-toque acidental durante navegação no modo selecionar
    if (gesture.kind === 'pending_select') {
      const deltaPx = dist(screen, gesture.startScreen);
      if (deltaPx > 7) {
        if (pendingCellTapRef.current) {
          pendingCellTapRef.current = null;
        }
        setCameraSafe(
          constrainCamera({
            ...gesture.camera,
            x: gesture.camera.x + screen.x - gesture.startScreen.x,
            y: gesture.camera.y + screen.y - gesture.startScreen.y,
          })
        );
      }
      return;
    }

    if (pendingCellTapRef.current) {
      const cellDelta = dist(screen, pendingCellTapRef.current.startScreen);
      if (cellDelta > 7) {
        pendingCellTapRef.current = null;
      }
    }

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
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      gestureRef.current = null;
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;

    // Se liberou no modo empty_pan_or_deselect (arrasto no vazio = navegação pelo mapa; toque parado no vazio = desmarcar)
    if (gesture.kind === 'empty_pan_or_deselect') {
      const deltaPx = dist(pointToScreen(event.clientX, event.clientY), gesture.startScreen);
      if (deltaPx <= 7) {
        if (!isolatedSpaceId) {
          setSelectedId(null);
          setSelectedPositionId(null);
        }
      }
      gestureRef.current = null;
      return;
    }

    // Se liberou no modo pending_select (toque limpo e intencional sem arrasto no mapa)
    if (gesture.kind === 'pending_select') {
      const deltaPx = dist(pointToScreen(event.clientX, event.clientY), gesture.startScreen);
      if (deltaPx <= 7) {
        // Se houve toque em célula interna sem arrasto, seleciona a célula
        if (pendingCellTapRef.current && pendingCellTapRef.current.pointerId === event.pointerId) {
          const { pos, zoneId } = pendingCellTapRef.current;
          setSelectedId(zoneId);
          setSelectedPositionId(pos.id);
          // Se interagiu com outra célula/posição, limpa o destaque da pesquisa anterior
          if (highlightId && highlightId !== pos.id && highlightId !== zoneId) {
            setHighlightId(null);
          }
          setDesktopSidebarOpen(true);
          setMobileDrawerOpen(true);
          setToast(`Posição ${pos.code} selecionada para edição individual.`);
        } else {
          // Toque no elemento / zona
          setSelectedId(gesture.item.id);
          setSelectedPositionId(null);
          // Se interagiu com outro elemento, limpa o destaque da pesquisa anterior
          if (highlightId && highlightId !== gesture.item.id) {
            setHighlightId(null);
          }
          setDesktopSidebarOpen(true);
          setMobileDrawerOpen(true);
        }
      }
      pendingCellTapRef.current = null;
      gestureRef.current = null;
      return;
    }

    if (pendingCellTapRef.current && pendingCellTapRef.current.pointerId === event.pointerId) {
      const deltaPx = dist(pointToScreen(event.clientX, event.clientY), pendingCellTapRef.current.startScreen);
      if (deltaPx <= 7) {
        const { pos, zoneId } = pendingCellTapRef.current;
        setSelectedId(zoneId);
        setSelectedPositionId(pos.id);
        if (highlightId && highlightId !== pos.id && highlightId !== zoneId) {
          setHighlightId(null);
        }
        setDesktopSidebarOpen(true);
        setMobileDrawerOpen(true);
        setToast(`Posição ${pos.code} selecionada para edição individual.`);
      }
      pendingCellTapRef.current = null;
    }

    // Se liberou ainda no estado pending_select_or_move, é um TOQUE / SELEÇÃO LIMPA!
    if (gesture.kind === 'pending_select_or_move') {
      if (isMultiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey) {
        toggleSelectId(gesture.item.id);
      } else {
        setSelectedId(gesture.item.id);
        if (highlightId && highlightId !== gesture.item.id) {
          setHighlightId(null);
        }
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
          productSize: 'medium_box',
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
          };
          if (resizeResult.hasLossWarning) {
            setToast(`Atenção: Dimensões reduzidas. ${resizeResult.overflowOccupiedPositions.length} posições com estoque foram preservadas.`);
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

  // Desfazer & Refazer
  const undo = () => {
    if (!historyRef.current.length) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [clone(areasRef.current), ...futureRef.current];
    setHistory(historyRef.current);
    setFuture(futureRef.current);
    areasRef.current = previous;
    setAreas(previous);
  };

  const redo = () => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [...historyRef.current, clone(areasRef.current)];
    setHistory(historyRef.current);
    setFuture(futureRef.current);
    areasRef.current = next;
    setAreas(next);
  };

  const duplicateSelected = () => {
    if (!selected) return;
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
    if (!selected || selected.type !== 'rectangle') return;
    const updated = applyVolumePresetToZone(selected, newProductSize, scaleRatio);
    if (newCategory) {
      updated.category = newCategory;
    }
    replaceItem(updated);
    setToast(`Porte do volume alterado para ${newProductSize}: Divisões criadas automaticamente!`);
  };

  // Navega até resultado de busca (o destaque permanece até outra interação)
  const handleNavigateToSearchResult = (result: SearchResult) => {
    if (result.areaId !== activeId) {
      setActiveId(result.areaId);
    }
    const targetX = result.x + result.width / 2;
    const targetY = result.y + result.height / 2;
    navigateToPoint(targetX, targetY, 1.4);
    setSelectedId(result.elementId);
    if (result.positionId) {
      setSelectedPositionId(result.positionId);
      setHighlightId(result.positionId);
      setToast(`Código localizado: ${result.positionCode || result.address}`);
    } else {
      setSelectedPositionId(null);
      setHighlightId(result.elementId);
      setToast(`Zona localizada: ${result.elementName}`);
    }
    setDesktopSidebarOpen(true);
    setMobileDrawerOpen(true);
    // O destaque não possui temporizador e permanece ativo até outra ação do usuário!
  };

  // Cria nova área limpa
  const createNewArea = () => {
    const newArea: FloorArea = {
      id: createId('wh'),
      name: `Galpão ${areas.length + 1}`,
      scaleRatio: DEFAULT_SCALE_RATIO,
      widthMeters: DEFAULT_WIDTH_METERS,
      heightMeters: DEFAULT_HEIGHT_METERS,
      elements: [],
    };
    recordAreas([...areas, newArea]);
    setActiveId(newArea.id);
    setToast(`Galpão criado.`);
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
    if (!queuedImport) return;
    recordAreas(queuedImport);
    if (queuedImport[0]?.id) setActiveId(queuedImport[0].id);
    setQueuedImport(null);
    setModal(null);
    setToast('Backup restaurado com sucesso.');
  };

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
      {/* 1. HEADER COMPACTO, ENXUTO E MODERNO */}
      <header
        className={`h-11 shrink-0 flex items-center justify-between gap-2 px-2.5 sm:px-3 border-b z-20 backdrop-blur-md ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}
      >
        {/* Identidade Movare Oficial & Seletor de Galpão */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="h-8 sm:h-8.5 flex items-center shrink-0">
            <img
              src="/movare-logo.png"
              alt="MOVARE Móveis e eletros"
              className="h-7 sm:h-8 w-auto object-contain drop-shadow-sm rounded"
            />
          </div>

          {/* Pod Integrado de Galpão */}
          <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-md px-1 py-0.5 min-w-0">
            <select
              aria-label="Escolher galpão"
              className="text-xs font-semibold bg-transparent border-0 text-slate-200 pr-5 appearance-none cursor-pointer truncate max-w-[100px] sm:max-w-[150px] md:max-w-[190px] focus:outline-none"
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 -ml-4 pointer-events-none shrink-0" />
            <button
              type="button"
              onClick={createNewArea}
              title="Adicionar Novo Galpão"
              className="p-0.5 ml-1 text-slate-400 hover:text-orange-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dimensões em Metros (Acesso Direto à Configuração de Tamanho) */}
          <button
            type="button"
            onClick={() => setModal('warehouse-size')}
            className={`hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-mono transition-colors ${
              isDark
                ? 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-orange-500/50 hover:text-orange-300'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:border-orange-500'
            }`}
            title="Dimensões do Galpão (Clique para redimensionar)"
          >
            <Maximize2 className="w-3 h-3 text-orange-400" />
            <span className="tabular-nums">{bounds.widthMeters}×{bounds.heightMeters}m</span>
          </button>
        </div>

        {/* Barra Central Enxuta: Bibliotecas e Gestão WMS */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Pod: Camadas & Busca Rápida WMS */}
          <div className="flex items-center p-0.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <button
              type="button"
              onClick={() => setModal('layers')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
              title="Camadas & Visibilidade de Espaços"
            >
              <Layers className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="hidden sm:inline">Camadas</span>
            </button>
            <div className="w-px h-3.5 bg-slate-800" />
            <button
              type="button"
              onClick={() => setModal('search')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors"
              title="Buscar Espaço, Produto ou SKU no Mapa (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="hidden md:inline">Buscar</span>
              <kbd className="hidden lg:inline font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Ctrl+K
              </kbd>
            </button>
            <div className="w-px h-3.5 bg-slate-800" />
            <button
              type="button"
              onClick={() => handleAddCorridorLabel()}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold text-sky-400 hover:text-sky-200 hover:bg-slate-800/70 transition-colors"
              title="Adicionar Identificação de Corredor / Rua (Apenas palavras sem background)"
            >
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">+ Corredor</span>
            </button>
          </div>

          {/* Pod 3: Sistema, Backup & Tema */}
          <div className="flex items-center gap-1 pl-1">
            {/* Backup no Desktop */}
            <div className="hidden sm:flex items-center rounded-md border border-slate-800 bg-slate-950/60 p-0.5">
              <button
                type="button"
                onClick={exportBackup}
                title="Exportar Backup JSON"
                className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-slate-800" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Importar Backup JSON"
                className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void readImport(e.target.files?.[0])}
            />

            {/* Alternar Tema */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
              title="Alternar Tema Claro / Escuro"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            </button>

            {/* Menu Rápido Mobile (Acesso Completo a Funções) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="sm:hidden p-1.5 rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              title="Menu de Funções"
            >
              <SlidersHorizontal className="w-4 h-4 text-orange-400" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: CANVAS VIEWPORT & TOOLBAR */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* BARRA DE FERRAMENTAS LATERAL DESKTOP ENXUTA (MD+) */}
        <aside
          className={`hidden md:flex w-11 shrink-0 flex-col items-center py-2 gap-1 border-r z-10 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          {/* Grupo 1: Modos (Selecionar, Mover, Visualizar) */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => { setTool('select'); setMeasureLine(null); }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                tool === 'select' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title="Modo Selecionar (V)"
            >
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setTool('move'); setMeasureLine(null); }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                tool === 'move' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title="Modo Mover Elementos"
            >
              <Move className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setTool('pan'); setMeasureLine(null); }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                tool === 'pan' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title="Modo Visualizar / Navegar pelo Mapa (H)"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          <div className="w-5 h-px bg-slate-800 my-0.5" />

          {/* Grupo 2: Desenho & Geradores */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => { setTool('rectangle'); setMeasureLine(null); }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                tool === 'rectangle' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title="Desenhar Área / Bloco (R)"
            >
              <RectangleHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setTool('measure'); }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                tool === 'measure' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title="Fita Métrica CAD (M)"
            >
              <Ruler className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setTool('corridor'); setMeasureLine(null); setToast('Modo Corredores: Clique no mapa com a mira para posicionar ou editar corredores'); }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                tool === 'corridor' ? 'bg-red-600 text-white shadow-xs' : 'text-sky-400 hover:text-sky-200 hover:bg-slate-800/60'
              }`}
              title="Modo Corredor / Rua (C)"
            >
              <Tag className="w-4 h-4" />
            </button>
          </div>

          <div className="w-5 h-px bg-slate-800 my-0.5" />

          {/* Grupo 3: Precisão, Snap e Física */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSnapEnabled((prev) => !prev);
                setToast(!snapEnabled ? 'Magnetismo / Snap Ativado' : 'Movimento Livre sem Snap Ativado');
              }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                snapEnabled ? 'text-red-400 bg-red-500/15' : 'text-slate-500 hover:bg-slate-800/60'
              }`}
              title={snapEnabled ? 'Magnetismo / Snap Ativo (Clique para desativar)' : 'Movimento Livre sem Snap (Clique para ativar)'}
            >
              <Magnet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPhysicsEnabled((prev) => !prev);
                setToast(!physicsEnabled ? 'Física Anti-Sobreposição Ativada' : 'Física Desativada');
              }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                physicsEnabled ? 'text-emerald-400 bg-emerald-500/15' : 'text-slate-500 hover:bg-slate-800/60'
              }`}
              title={physicsEnabled ? 'Física Anti-Sobreposição Ativa (Clique para desativar)' : 'Física Desativada (Clique para ativar)'}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMultiSelectMode((prev) => !prev);
                setToast(!isMultiSelectMode ? 'Modo Seleção Múltipla Ativado' : 'Modo Seleção Individual');
              }}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                isMultiSelectMode ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
              title={isMultiSelectMode ? 'Seleção Múltipla Ativa' : 'Ativar Seleção Múltipla'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          <div className="w-5 h-px bg-slate-800 my-0.5" />

          {/* Grupo 4: Histórico Undo / Redo */}
          <div className="flex flex-col items-center gap-1 mt-auto">
            <button
              type="button"
              onClick={undo}
              disabled={!history.length}
              className="w-8 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-100 disabled:opacity-25 transition-colors"
              title="Desfazer (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!future.length}
              className="w-8 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-100 disabled:opacity-25 transition-colors"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* 2. CONTAINER DO CANVAS COM WHEEL ZOOM & TOUCH CONTROL (SEM MENU SPLIT) */}
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
              {/* BANNER FLUTUANTE DE MODO FOCO EXCLUSIVO */}
              {isolatedSpace && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 sm:gap-3 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-orange-500/80 shadow-2xl backdrop-blur-md text-xs transition-all duration-150 max-w-[96vw] ${
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
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-orange-500/80 shadow-2xl backdrop-blur-md text-xs transition-all duration-150 max-w-[96vw] ${
                    isDragging ? 'opacity-30 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">Destaque:</span>
                    <span className="font-bold text-orange-400 font-mono text-xs truncate max-w-[150px] sm:max-w-[240px]">
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

                  {/* Efeito Glow para Destaque de Busca */}
                  <filter id="glow-highlight" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#f97316" floodOpacity="0.9" />
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
                      setSelectedId(zone.id);
                      setSelectedPositionId(null);
                      navigateToPoint(zone.x + zone.width / 2, zone.y + zone.height / 2, 1.3);
                      setDesktopSidebarOpen(true);
                      setMobileDrawerOpen(true);
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
                    const containsHighlightedPosition = !isDirectlyHighlighted && !!item.internalPositions?.some((p) => p.id === highlightId);
                    const isHighlighted = isDirectlyHighlighted || containsHighlightedPosition;
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
                      if (tool === 'pan') return false; // Menu visualizar não interage com NADA (zonas, células, paredes, corredores)
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
                        filter={isHighlighted ? 'url(#glow-highlight)' : undefined}
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
                                  stroke={isCollidedObstacle ? '#ef4444' : isDirectlyHighlighted ? '#f97316' : isSelected ? (isLocked ? '#eab308' : '#f97316') : color}
                                  strokeWidth={isCollidedObstacle ? 3.5 : isDirectlyHighlighted ? 3.5 : isSelected ? 3 : 2}
                                  strokeDasharray={isLocked ? '5 3' : isSelected && selectedIds.length > 1 ? '4 2' : undefined}
                                  vectorEffect="non-scaling-stroke"
                                  pointerEvents={isItemInteractive ? 'all' : 'none'}
                                />

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

                                {/* Rótulo da Rua WMS & Etiquetas de Produto */}
                                <g pointerEvents="none">
                                  <text
                                    x={rendered.x + 8}
                                    y={rendered.y + 18}
                                    fontSize={11}
                                    fontFamily="'JetBrains Mono', monospace"
                                    fontWeight="bold"
                                    fill={color}
                                  >
                                    RUA {rendered.street || rendered.name}
                                  </text>

                                  {/* Badges de SKU e Tamanho */}
                                  <g transform={`translate(${rendered.x + 8}, ${rendered.y + 26})`}>
                                    {sizeDef && (
                                      <text fontSize={9} fontWeight="bold" fill="#f97316">
                                        [{sizeDef.short}]
                                      </text>
                                    )}
                                    {rendered.skuCode && (
                                      <text
                                        x={sizeDef ? 36 : 0}
                                        fontSize={9}
                                        fontFamily="'JetBrains Mono', monospace"
                                        fill={isDark ? '#cbd5e1' : '#475569'}
                                      >
                                        SKU: {rendered.skuCode}
                                      </text>
                                    )}
                                  </g>
                                </g>

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
                                  stroke={isCollidedObstacle ? '#ef4444' : isDirectlyHighlighted ? '#f97316' : isSelected ? (isLocked ? '#eab308' : isPrimarySelected ? '#38bdf8' : '#60a5fa') : color}
                                  strokeWidth={isCollidedObstacle ? 3.5 : isDirectlyHighlighted ? 3.5 : isSelected ? (isPrimarySelected ? 3 : 2.5) : 2}
                                  strokeDasharray={isLocked ? '5 3' : isSelected && selectedIds.length > 1 ? '4 2' : undefined}
                                  vectorEffect="non-scaling-stroke"
                                  pointerEvents={isItemInteractive ? 'all' : 'none'}
                                />

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
                                      const isPosHighlighted = highlightId === pos.id || (highlightId === rendered.id && isPosSelected);
                                      const isOccupied = pos.status === 'occupied';
                                      const isReserved = pos.status === 'reserved';

                                      const posFill = isPosHighlighted
                                        ? 'rgba(239, 68, 68, 0.45)'
                                        : isPosSelected
                                        ? 'rgba(239, 68, 68, 0.35)'
                                        : isOccupied
                                        ? 'rgba(34, 197, 94, 0.22)'
                                        : isReserved
                                        ? 'rgba(234, 179, 8, 0.22)'
                                        : isDark
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'rgba(0, 0, 0, 0.04)';

                                      const posStroke = isPosHighlighted
                                        ? '#ef4444'
                                        : isPosSelected
                                        ? '#ef4444'
                                        : isOccupied
                                        ? '#22c55e'
                                        : isReserved
                                        ? '#eab308'
                                        : color;

                                      const posStrokeOpacity = isPosHighlighted || isPosSelected || isOccupied || isReserved ? 0.95 : 0.45;
                                      const posReactKey = `${rendered.id}-${pos.id || 'pos'}-${posIdx}`;

                                      return (
                                        <g key={posReactKey} className={tool === 'select' && isItemInteractive ? 'cursor-pointer' : 'pointer-events-none'}>
                                          <rect
                                            x={posX}
                                            y={posY}
                                            width={relWidth}
                                            height={relHeight}
                                            rx={2}
                                            fill={posFill}
                                            stroke={posStroke}
                                            strokeOpacity={posStrokeOpacity}
                                            strokeWidth={isPosHighlighted ? 3 : isPosSelected ? 2.5 : 1}
                                            strokeDasharray={pos.status === 'empty' && !isPosSelected && !isPosHighlighted ? '3 2' : undefined}
                                            pointerEvents={tool === 'select' && isItemInteractive ? 'all' : 'none'}
                                            onPointerDown={(e) => {
                                              if (tool !== 'select' || !isItemInteractive) return;
                                              const scr = pointToScreen(e.clientX, e.clientY);
                                              pendingCellTapRef.current = {
                                                pos,
                                                zoneId: rendered.id,
                                                startScreen: scr,
                                                pointerId: e.pointerId,
                                              };
                                            }}
                                          />

                                          {/* Rótulo do Código da Posição */}
                                          {relHeight >= 12 && relWidth >= 24 && (
                                            <text
                                              x={posX + 4}
                                              y={posY + Math.min(13, Math.max(10, relHeight - 3))}
                                              fontSize={Math.min(10, Math.max(7, relHeight * 0.45))}
                                              fontFamily="'JetBrains Mono', monospace"
                                              fontWeight="bold"
                                              fill={
                                                isPosSelected
                                                  ? '#38bdf8'
                                                  : isOccupied
                                                  ? '#4ade80'
                                                  : isReserved
                                                  ? '#fde047'
                                                  : isDark
                                                  ? '#94a3b8'
                                                  : '#64748b'
                                              }
                                              pointerEvents="none"
                                            >
                                              {pos.code}
                                              {pos.sku && relWidth >= 70 ? ` · ${pos.sku}` : ''}
                                            </text>
                                          )}

                                          {/* Detalhes de Estoque: Qtd e Unidade se houver espaço vertical */}
                                          {pos.status !== 'empty' && relWidth >= 50 && relHeight >= 26 && (
                                            <text
                                              x={posX + 4}
                                              y={posY + 22}
                                              fontSize={8}
                                              fontFamily="'JetBrains Mono', monospace"
                                              fill={isDark ? '#cbd5e1' : '#475569'}
                                              pointerEvents="none"
                                            >
                                              {pos.quantity ? `${pos.quantity} ${pos.unit || 'UN'}` : ''}
                                            </text>
                                          )}
                                        </g>
                                      );
                                    })}
                                  </g>
                                )}

                                {/* Informações da Zona e Células de Produtos */}
                                <g pointerEvents="none">
                                  {rendered.internalPositions && rendered.internalPositions.length > 0 ? (
                                    // Header compacto da Zona com Posições Internas
                                    <g transform={`translate(${baseZoneX + 6}, ${baseZoneY + 12})`}>
                                      <rect
                                        x={-2}
                                        y={-10}
                                        width={Math.min(
                                          Math.max(20, baseZoneW - 8),
                                          Math.max(90, (rendered.name || '').length * 6.5 + 40)
                                        )}
                                        height={16}
                                        rx={3}
                                        fill={isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)'}
                                        stroke={color}
                                        strokeWidth={0.8}
                                      />
                                      <text
                                        x={2}
                                        y={1}
                                        fontSize={9}
                                        fontWeight="bold"
                                        fill={isDark ? '#f8fafc' : '#0f172a'}
                                        fontFamily="'JetBrains Mono', monospace"
                                      >
                                        {(rendered.name || '').slice(0, 24)} [{rendered.internalPositions.length} pos]
                                      </text>
                                    </g>
                                  ) : baseZoneW >= 75 && baseZoneH >= 45 ? (
                                    <>
                                      <text
                                        x={baseZoneX + 8}
                                        y={baseZoneY + 18}
                                        fontSize={11}
                                        fontWeight="700"
                                        fill={isDark ? '#f1f5f9' : '#1e293b'}
                                      >
                                        {rendered.name}
                                      </text>

                                      {/* Badges Dedicadas de Produto */}
                                      <g transform={`translate(${baseZoneX + 8}, ${baseZoneY + 26})`}>
                                        {catDef && (
                                          <text fontSize={9} fontWeight="bold" fill={catDef.color}>
                                            ● {catDef.badge}
                                          </text>
                                        )}
                                        {sizeDef && (
                                          <text x={catDef ? 50 : 0} fontSize={9} fill={isDark ? '#94a3b8' : '#64748b'}>
                                            [{sizeDef.label}]
                                          </text>
                                        )}
                                      </g>

                                      {rendered.skuCode && (
                                        <text
                                          x={baseZoneX + 8}
                                          y={baseZoneY + 48}
                                          fontSize={10}
                                          fontFamily="'JetBrains Mono', monospace"
                                          fontWeight="bold"
                                          fill="#f97316"
                                        >
                                          🏷️ {rendered.skuCode}
                                        </text>
                                      )}
                                    </>
                                  ) : (
                                    // Exibição adaptativa compacta para células divididas menores
                                    <g transform={`translate(${baseZoneX + 4}, ${baseZoneY + 14})`}>
                                      <text
                                        fontSize={10}
                                        fontFamily="'JetBrains Mono', monospace"
                                        fontWeight="bold"
                                        fill={isDark ? '#f8fafc' : '#0f172a'}
                                      >
                                        {rendered.name?.includes('Célula')
                                          ? rendered.name.split('Célula').pop()?.trim()
                                          : (rendered.name || '').slice(0, 8)}
                                      </text>
                                      {rendered.skuCode && baseZoneH >= 26 && (
                                        <text
                                          y={11}
                                          fontSize={8}
                                          fontFamily="'JetBrains Mono', monospace"
                                          fill="#f97316"
                                          fontWeight="bold"
                                        >
                                          {rendered.skuCode.slice(0, 10)}
                                        </text>
                                      )}
                                    </g>
                                  )}
                                </g>

                                {/* Indicador de Bloqueio 🔒 */}
                                {isLocked && (
                                  <g transform={`translate(${baseZoneX + baseZoneW - 24}, ${baseZoneY + 6})`} pointerEvents="none">
                                    <rect width={18} height={18} rx={4} fill="#eab308" />
                                    <text x={9} y={13} textAnchor="middle" fontSize={11} fill="#000">🔒</text>
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
                              stroke={isSelected ? (isLocked ? '#eab308' : '#38bdf8') : color}
                              strokeWidth={isSelected ? 5 : 3.5}
                              strokeLinecap="round"
                              vectorEffect="non-scaling-stroke"
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

                        {/* MANIPULAÇÃO TÁTIL: ALÇAS DE REDIMENSIONAMENTO E ROTAÇÃO (APENAS NO MODO MOVER SE SELECIONADO E NÃO BLOQUEADO) */}
                        {tool === 'move' && isSelected && !isLocked && belongsToIsolated && (item.type === 'rectangle' || item.type === 'rack' || item.type === 'corridor') && (
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

                  {/* BEACON PULSANTE E INDICADOR VISUAL DO ITEM DESTACADO PELA BUSCA */}
                  {highlightedDetails && (
                    <g pointerEvents="none">
                      {/* Anéis de pulso de radar contínuos (permanece visível navegando pelo mapa em qualquer zoom) */}
                      <circle
                        cx={highlightedDetails.x}
                        cy={highlightedDetails.y}
                        r={24}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth={2.5 / camera.scale}
                        opacity="0.8"
                        vectorEffect="non-scaling-stroke"
                      >
                        <animate attributeName="r" from={10 / camera.scale} to={48 / camera.scale} dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.9" to="0" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                      <circle
                        cx={highlightedDetails.x}
                        cy={highlightedDetails.y}
                        r={16}
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth={1.8 / camera.scale}
                        opacity="0.6"
                        vectorEffect="non-scaling-stroke"
                      >
                        <animate attributeName="r" from={6 / camera.scale} to={30 / camera.scale} dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.8" to="0" dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                      </circle>

                      {/* Pin Flutuante de Localização com Etiqueta */}
                      <g transform={`translate(${highlightedDetails.x}, ${highlightedDetails.y - 28 / camera.scale}) scale(${1 / Math.max(camera.scale, 0.45)})`}>
                        <path
                          d="M 0 0 C -7 -11 -12 -18 -12 -25 A 12 12 0 1 1 12 -25 C 12 -18 7 -11 0 0 Z"
                          fill="#f97316"
                          stroke="#ffffff"
                          strokeWidth="2"
                          filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.65))"
                        />
                        <circle cx="0" cy="-25" r="4.5" fill="#ffffff" />
                        <g transform="translate(0, -38)">
                          <rect
                            x={-Math.max(30, (highlightedDetails.code || highlightedDetails.name).length * 4.2 + 8)}
                            y={-14}
                            width={Math.max(60, (highlightedDetails.code || highlightedDetails.name).length * 8.4 + 16)}
                            height={18}
                            rx={4}
                            fill="rgba(15, 23, 42, 0.92)"
                            stroke="#f97316"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="-1"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                          >
                            {highlightedDetails.code || highlightedDetails.name}
                          </text>
                        </g>
                      </g>
                    </g>
                  )}
                </g>
              </svg>

              {/* BARRA DE AÇÕES FLUTUANTE ABERTA PELO BOTÃO FLUTUANTE '+' */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto">
                {/* PAINEL EXPANDIDO DA BARRA DE AÇÕES (FAIXA HORIZONTAL) */}
                {showActionBar && (
                  <div className="flex flex-row items-center gap-1.5 p-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl animate-fade-in text-xs font-semibold text-slate-200 max-w-[95vw] overflow-x-auto whitespace-nowrap scrollbar-none">
                    {/* 1. MODO SELECIONAR */}
                    <button
                      type="button"
                      onClick={() => {
                        setTool('select');
                        setMeasureLine(null);
                        setShowActionBar(false);
                        setToast('Modo Selecionar: Clique para inspecionar e editar');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        tool === 'select'
                          ? 'bg-red-600 text-white shadow-md font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <MousePointer2 className="w-4 h-4 text-slate-200" />
                      <span>Selecionar</span>
                    </button>

                    {/* 2. MODO MOVER */}
                    <button
                      type="button"
                      onClick={() => {
                        setTool('move');
                        setMeasureLine(null);
                        setMobileDrawerOpen(false);
                        setDesktopSidebarOpen(false);
                        setShowActionBar(false);
                        setToast('Modo Mover: Apenas mover e redimensionar no mapa');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        tool === 'move'
                          ? 'bg-red-600 text-white shadow-md font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Move className="w-4 h-4" />
                      <span>Mover</span>
                    </button>

                    {/* 3. MODO VISUALIZAR */}
                    <button
                      type="button"
                      onClick={() => {
                        setTool('pan');
                        setMeasureLine(null);
                        setShowActionBar(false);
                        setToast('Modo Visualizar: Arraste para navegar');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        tool === 'pan'
                          ? 'bg-red-600 text-white shadow-md font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>Visualizar</span>
                    </button>

                    <div className="w-px h-5 bg-slate-700/80 mx-1 shrink-0" />

                    {/* DESENHAR NOVA ZONA */}
                    <button
                      type="button"
                      onClick={() => {
                        setTool('rectangle');
                        setMeasureLine(null);
                        setShowActionBar(false);
                        setToast('Desenhar Nova Zona: Arraste no mapa');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        tool === 'rectangle' ? 'bg-red-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <RectangleHorizontal className="w-4 h-4 text-red-400" />
                      <span>Nova Zona</span>
                    </button>

                    {/* CRIAR / MODO CORREDOR */}
                    <button
                      type="button"
                      onClick={() => {
                        setTool('corridor');
                        setMeasureLine(null);
                        setShowActionBar(false);
                        setToast('Modo Corredores: Clique no mapa com a mira para posicionar ou editar corredores');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        tool === 'corridor' ? 'bg-red-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span>Corredor</span>
                    </button>

                    {/* FITA MÉTRICA */}
                    <button
                      type="button"
                      onClick={() => {
                        setTool('measure');
                        setShowActionBar(false);
                        setToast('Modo Fita Métrica: Clique em dois pontos para medir');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                        tool === 'measure' ? 'bg-red-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Ruler className="w-4 h-4 text-amber-400" />
                      <span>Medir</span>
                    </button>

                    <div className="w-px h-5 bg-slate-700/80 mx-1 shrink-0" />

                    {/* BUSCAR WMS */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionBar(false);
                        setModal('search');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-all hover:text-white shrink-0"
                    >
                      <Search className="w-4 h-4 text-orange-400" />
                      <span>Buscar WMS</span>
                    </button>

                    {/* MAIS / CONFIGURAÇÕES */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionBar(false);
                        setMobileMenuOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-all hover:text-white shrink-0"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                      <span>Mais</span>
                    </button>
                  </div>
                )}

                {/* BOTÃO FLUTUANTE FAB '+' APENAS COM O ÍCONE '+' */}
                <button
                  type="button"
                  onClick={() => setShowActionBar((prev) => !prev)}
                  className={`w-12 h-12 rounded-full shadow-2xl transition-all flex items-center justify-center border ${
                    showActionBar
                      ? 'bg-slate-800 border-slate-600 text-slate-200 shadow-slate-900/80 scale-105'
                      : 'bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-red-600/40 hover:scale-110'
                  }`}
                  title={showActionBar ? 'Fechar Ações' : 'Ações e Ferramentas (+)'}
                >
                  <Plus className={`w-6 h-6 stroke-[3] transition-transform duration-200 ${showActionBar ? 'rotate-45' : ''}`} />
                </button>
              </div>

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

              {/* BOTÃO FLUTUANTE DE BUSCA COM LUPA (SUGESTÃO DO USUÁRIO) */}
              <button
                type="button"
                onClick={() => setModal('search')}
                className="absolute bottom-5 left-4 z-20 flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-100 border border-orange-500/80 hover:border-orange-400 shadow-2xl backdrop-blur-md transition-all group hover:scale-105 cursor-pointer select-none"
                title="Buscar Código WMS, Zona ou SKU (Ctrl+K)"
              >
                <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/40 group-hover:bg-orange-500 transition-colors shrink-0">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>Buscar WMS</span>
                    <span className="hidden sm:inline-block font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-orange-400 border border-slate-700">
                      Ctrl+K
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight hidden xs:inline">
                    Código, SKU ou Zona
                  </span>
                </div>
              </button>

              {/* BOTÃO FLUTUANTE DE LEGENDA RÁPIDA (SEM MENU SPLIT) */}
              <div className="absolute bottom-5 right-4 z-20">
                <FloatingGeographicLegendButton
                  elements={activeArea.elements}
                  selectedId={selectedId}
                  onSelectZone={(zone) => {
                    setSelectedId(zone.id);
                    setSelectedPositionId(null);
                    navigateToPoint(zone.x + zone.width / 2, zone.y + zone.height / 2, 1.3);
                    setDesktopSidebarOpen(true);
                    setMobileDrawerOpen(true);
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
                className="hidden md:flex absolute top-4 right-4 z-20 items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700 shadow-xl backdrop-blur-md text-xs font-semibold text-slate-200 transition-all"
              >
                <PanelRightOpen className="w-4 h-4 text-orange-400" />
                <span>Propriedades: {selected.name}</span>
              </button>
            )}

            {/* DESKTOP SIDEBAR (MD+) */}
            <aside
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`hidden md:flex w-80 shrink-0 border-l p-4 flex-col justify-between z-10 overflow-y-auto transition-all duration-200 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              } ${isDragging ? 'opacity-25 pointer-events-none scale-[0.99]' : 'opacity-100'} ${
                !desktopSidebarOpen || freeMoveMode ? '!hidden' : ''
              }`}
            >
              <div className="space-y-4">
                {/* Banner de Seleção Múltipla & Operações de Grupo */}
                {selectedIds.length > 1 && (
                  <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-200">
                          {selectedIds.length} Espaços Selecionados
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-[10px] text-blue-300 hover:text-white"
                      >
                        Limpar Seleção
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                      Mova qualquer espaço selecionado para mover o grupo inteiro mantendo todos os parâmetros e distâncias.
                    </p>

                    {/* Alinhamento Rápido em Grupo */}
                    <div className="pt-1 border-t border-blue-500/20">
                      <span className="block text-[10px] font-semibold text-slate-300 mb-1">Alinhar Grupo:</span>
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const aligned = alignGroupElements(selectedElements, 'left', worldWidth, worldHeight);
                            patchActive((a) => ({
                              ...a,
                              elements: a.elements.map((el) => aligned.find((it) => it.id === el.id) || el),
                            }));
                            setToast('Espaços alinhados à esquerda');
                          }}
                          className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] flex items-center justify-center gap-0.5"
                          title="Alinhar à Esquerda"
                        >
                          <AlignLeft className="w-3 h-3" />
                          <span>Esq</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const aligned = alignGroupElements(selectedElements, 'top', worldWidth, worldHeight);
                            patchActive((a) => ({
                              ...a,
                              elements: a.elements.map((el) => aligned.find((it) => it.id === el.id) || el),
                            }));
                            setToast('Espaços alinhados ao topo');
                          }}
                          className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] flex items-center justify-center gap-0.5"
                          title="Alinhar ao Topo"
                        >
                          <AlignLeft className="w-3 h-3 rotate-90" />
                          <span>Topo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const aligned = alignGroupElements(selectedElements, 'distribute-h', worldWidth, worldHeight);
                            patchActive((a) => ({
                              ...a,
                              elements: a.elements.map((el) => aligned.find((it) => it.id === el.id) || el),
                            }));
                            setToast('Espaços distribuídos horizontalmente');
                          }}
                          className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] flex items-center justify-center gap-0.5"
                          title="Distribuir Horizontalmente"
                        >
                          <AlignCenter className="w-3 h-3" />
                          <span>Dist H</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const aligned = alignGroupElements(selectedElements, 'distribute-v', worldWidth, worldHeight);
                            patchActive((a) => ({
                              ...a,
                              elements: a.elements.map((el) => aligned.find((it) => it.id === el.id) || el),
                            }));
                            setToast('Espaços distribuídos verticalmente');
                          }}
                          className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] flex items-center justify-center gap-0.5"
                          title="Distribuir Verticalmente"
                        >
                          <AlignCenter className="w-3 h-3 rotate-90" />
                          <span>Dist V</span>
                        </button>
                      </div>
                    </div>

                    {/* Ações de Agrupamento */}
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newGroupId = createId('group');
                          patchActive((a) => ({
                            ...a,
                            elements: a.elements.map((el) =>
                              selectedIds.includes(el.id) ? { ...el, groupId: newGroupId } : el
                            ),
                          }));
                          setToast(`Grupo criado com ${selectedIds.length} espaços`);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Agrupar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          patchActive((a) => ({
                            ...a,
                            elements: a.elements.map((el) =>
                              selectedIds.includes(el.id) ? { ...el, groupId: undefined } : el
                            ),
                          }));
                          setToast('Espaços desagrupados');
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1"
                      >
                        <span>Desagrupar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Header do Elemento Selecionado */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3.5 h-3.5 rounded-xs shrink-0" style={{ backgroundColor: selected.color || '#f97316' }} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono truncate">
                      {selected.type === 'rack'
                        ? 'Porta-Paletes'
                        : selected.type === 'rectangle'
                        ? 'Zona'
                        : 'Divisória'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão de Modo Movimento Livre (Tela Limpa) */}
                    <button
                      type="button"
                      onClick={() => setFreeMoveMode(true)}
                      className="px-2 py-1 rounded-md text-xs text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 flex items-center gap-1 font-semibold transition-colors"
                      title="Tela limpa com micro-painel para mover e posicionar livremente"
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden lg:inline">Mover Livre</span>
                    </button>
                    {/* Botão de Trava / Bloqueio */}
                    <button
                      type="button"
                      onClick={toggleLockSelected}
                      className={`p-1.5 rounded-md text-xs flex items-center gap-1 font-semibold transition-colors ${
                        selected.locked
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      title={selected.locked ? 'Desbloquear objeto' : 'Bloquear objeto'}
                    >
                      {selected.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    {/* Botão de Recolher Sidebar */}
                    <button
                      type="button"
                      onClick={() => setDesktopSidebarOpen(false)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Recolher painel para liberar tela inteira"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </button>
                    {/* Fechar Seleção */}
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                      title="Desmarcar item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status de Bloqueio Alerta */}
                {selected.locked && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Objeto travado contra edição</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleLockSelected}
                      className="text-[11px] font-bold underline hover:text-amber-200"
                    >
                      Desbloquear
                    </button>
                  </div>
                )}

                {/* Nome / Endereço */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">Nome / Endereço</label>
                  <input
                    type="text"
                    disabled={selected.locked}
                    value={selected.name}
                    onChange={(e) => replaceItem({ ...selected, name: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-700 bg-slate-950 text-slate-100 disabled:opacity-50"
                  />
                </div>

                {/* Classificação & Etiquetas Dedicadas */}
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Classificação & Etiquetas Dedicadas</span>
                  </div>

                  {/* SKU / Código do Produto Dedicado */}
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Código do Produto (SKU / EAN)</label>
                    <input
                      type="text"
                      disabled={selected.locked}
                      value={selected.skuCode || ''}
                      onChange={(e) => replaceItem({ ...selected, skuCode: e.target.value.toUpperCase() })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      placeholder="Ex: PAL-1042, SKU-ELEC-01"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-md border border-slate-700 bg-slate-950 text-orange-400 disabled:opacity-50"
                    />
                  </div>

                  {/* Porte / Tamanho do Produto */}
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Porte / Tamanho do Volume</label>
                    <select
                      disabled={selected.locked}
                      value={selected.productSize || 'medium_box'}
                      onChange={(e) => handleUpdateZoneVolumeType(e.target.value as ProductSize, selected.category)}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-50"
                    >
                      {PRODUCT_SIZES.map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.icon} {size.label} — {size.desc}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Categoria do Produto */}
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Categoria / Setor Logístico</label>
                    <select
                      disabled={selected.locked}
                      value={selected.category || 'general'}
                      onChange={(e) => handleUpdateZoneVolumeType(selected.productSize || 'medium_box', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-50"
                    >
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* CONTROLES TÁTEIS: Rotação Rápida & Ajuste Fino D-Pad */}
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-orange-400" />
                      <span>Orientação & Rotação Tátil</span>
                    </span>
                    <span className="font-mono text-orange-400">{selected.rotation || 0}°</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={selected.locked}
                      onClick={() => rotateSelectedBy(-90)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-40"
                    >
                      ↺ Girar 90°
                    </button>
                    <button
                      type="button"
                      disabled={selected.locked}
                      onClick={() => rotateSelectedBy(90)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-40"
                    >
                      ↻ Girar 90°
                    </button>
                  </div>

                  {/* D-Pad de Ajuste Fino de Posição (Nudge) */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1.5">Ajuste Fino de Posição (0.5m)</span>
                    <div className="grid grid-cols-3 gap-1 max-w-[120px] mx-auto">
                      <div />
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(0, -0.5)}
                        className="h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-40"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <div />
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(-0.5, 0)}
                        className="h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-40"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center justify-center text-[9px] font-mono text-slate-500 font-bold">0.5m</div>
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(0.5, 0)}
                        className="h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-40"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <div />
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(0, 0.5)}
                        className="h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-40"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <div />
                    </div>
                  </div>
                </div>

                {/* Ações Específicas do Espaço Selecionado */}
                {selected.type === 'rack' ? (
                  <button
                    type="button"
                    onClick={() => setModal('rack-gen')}
                    className="w-full py-2 px-3 rounded-xl bg-orange-600/15 hover:bg-orange-600/25 border border-orange-500/40 text-orange-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <BoxIcon className="w-4 h-4 text-orange-400" />
                    <span>Configurar Estrutura de Racks</span>
                  </button>
                ) : selected.type === 'rectangle' ? (
                  <div className="space-y-3">
                    {/* Botão de Modo Foco Individual */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isolatedSpaceId === selected.id) {
                          setIsolatedSpaceId(null);
                          setToast('Modo Foco desativado');
                        } else {
                          setIsolatedSpaceId(selected.id);
                          fitToElement(selected);
                          setToast(`Modo Foco Ativo: "${selected.name}" · Demais itens bloqueados`);
                        }
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                        isolatedSpaceId === selected.id
                          ? 'bg-orange-600 text-white border-orange-500 shadow-md ring-2 ring-orange-500/30'
                          : 'bg-orange-600/15 hover:bg-orange-600/25 border-orange-500/40 text-orange-300'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      <span>{isolatedSpaceId === selected.id ? 'Sair do Modo Foco' : 'Editar Espaço Individual (Modo Foco)'}</span>
                    </button>

                    {/* GERENCIADOR DE MÓDULOS E POSIÇÕES INTERNAS DA ZONA */}
                    <ZoneInternalPositionsManager
                      element={selected}
                      scaleRatio={scaleRatio}
                      onUpdateElement={replaceItem}
                      selectedPositionId={selectedPositionId}
                      onSelectPosition={setSelectedPositionId}
                      isDark={isDark}
                    />

                    {selected.groupId && (
                      <button
                        type="button"
                        onClick={() => selectGroup(selected.groupId!)}
                        className="w-full py-1.5 px-3 rounded-xl bg-blue-950/40 hover:bg-blue-900/40 border border-blue-600/40 text-blue-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Selecionar Todo o Grupo ({activeArea.elements.filter(e => (e.groupId || e.id) === selected.groupId).length} espaços)</span>
                      </button>
                    )}
                  </div>
                ) : selected.type === 'corridor' ? (
                  <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-900/95 border border-sky-500/50 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                        <Tag className="w-4 h-4" />
                        <span>Edição Completa de Corredor / Rua</span>
                      </span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 font-bold border border-sky-800/60">
                        Palavras Sem Fundo
                      </span>
                    </div>

                    {/* Texto Principal do Corredor */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Texto / Identificação
                      </label>
                      <input
                        type="text"
                        disabled={selected.locked}
                        value={selected.corridorText || selected.name}
                        onChange={(e) => {
                          const text = e.target.value.toUpperCase();
                          const fSize = selected.fontSize || 22;
                          replaceItem({
                            ...selected,
                            name: text,
                            corridorText: text,
                            width: Math.max(120, text.length * (fSize * 0.65) + 30),
                          });
                        }}
                        placeholder="Ex: RUA A, CORREDOR 01, ENTRADA"
                        className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-700 bg-slate-950 text-sky-300 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    {/* Presets Rápidos de Nomes de Ruas & Galpão */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 mb-1.5">Atalhos de Nomes Frequentes</span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-950/60 rounded-lg border border-slate-800">
                        {[
                          'RUA A', 'RUA B', 'RUA C', 'RUA D',
                          'CORREDOR 01', 'CORREDOR 02', 'CORREDOR 03',
                          'ENTRADA', 'SAÍDA', 'DOCA 01', 'CARRINHOS',
                          'ALMOXARIFADO', 'EXPEDIÇÃO', 'PULMÃO'
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => {
                              const fSize = selected.fontSize || 22;
                              replaceItem({
                                ...selected,
                                name: preset,
                                corridorText: preset,
                                width: Math.max(120, preset.length * (fSize * 0.65) + 30),
                              });
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-300 transition-colors disabled:opacity-40"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Símbolos & Setas de Tráfego Logístico */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 mb-1.5">Sentido de Tráfego & Setas</span>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { symbol: '➔', label: 'Frente' },
                          { symbol: '⬅', label: 'Retorno' },
                          { symbol: '⬆', label: 'Subida' },
                          { symbol: '⬇', label: 'Descida' },
                          { symbol: '↔', label: 'Duplo' },
                          { symbol: '🔄', label: 'Giro' },
                          { symbol: '🚷', label: 'Sem Pedestre' },
                        ].map((item) => (
                          <button
                            key={item.symbol}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => {
                              const current = selected.corridorText || selected.name || '';
                              if (current.includes(item.symbol)) return;
                              const updated = `${item.symbol} ${current}`;
                              const fSize = selected.fontSize || 22;
                              replaceItem({
                                ...selected,
                                name: updated,
                                corridorText: updated,
                                width: Math.max(120, updated.length * (fSize * 0.65) + 30),
                              });
                            }}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500 text-sky-300 font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-40"
                            title={`Adicionar ${item.label}`}
                          >
                            <span className="text-sm">{item.symbol}</span>
                            <span className="text-[9px] text-slate-400 font-normal">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ajustes de Fonte, Espaçamento & Peso */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-400">Tamanho da Fonte</span>
                            <span className="font-mono text-xs font-bold text-sky-300">{selected.fontSize || 22}px</span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="96"
                            disabled={selected.locked}
                            value={selected.fontSize || 22}
                            onChange={(e) => {
                              const size = parseInt(e.target.value, 10);
                              const currentText = selected.corridorText || selected.name || '';
                              replaceItem({
                                ...selected,
                                fontSize: size,
                                height: Math.max(30, size * 1.5),
                                width: Math.max(120, currentText.length * (size * 0.65) + 30),
                              });
                            }}
                            className="w-full accent-sky-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-400">Espaçamento</span>
                            <span className="font-mono text-xs font-bold text-sky-300">{selected.letterSpacing ?? 4}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="24"
                            disabled={selected.locked}
                            value={selected.letterSpacing ?? 4}
                            onChange={(e) => {
                              const sp = parseInt(e.target.value, 10);
                              replaceItem({ ...selected, letterSpacing: sp });
                            }}
                            className="w-full accent-sky-500"
                          />
                        </div>
                      </div>

                      {/* Espessura da Fonte */}
                      <div>
                        <span className="block text-[10px] text-slate-400 mb-1 font-semibold">Peso / Espessura da Letra</span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { value: 'normal', label: 'Normal' },
                            { value: 'bold', label: 'Negrito' },
                            { value: 'extrabold', label: 'Extra Pesado' },
                          ].map((weight) => (
                            <button
                              key={weight.value}
                              type="button"
                              disabled={selected.locked}
                              onClick={() => replaceItem({ ...selected, fontWeight: weight.value as any })}
                              className={`py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                                (selected.fontWeight || 'extrabold') === weight.value
                                  ? 'bg-sky-950 border-sky-500 text-sky-200 font-bold'
                                  : 'bg-slate-950 border-slate-800 text-slate-400'
                              }`}
                            >
                              {weight.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Orientação e Rotação */}
                    <div className="pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">Orientação & Ângulo</span>
                        <span className="font-mono text-xs font-bold text-sky-400">{selected.rotation || 0}°</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[0, 90, 180, 270].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => replaceItem({ ...selected, rotation: deg })}
                            className={`py-1.5 rounded-lg text-xs font-mono font-semibold border flex items-center justify-center ${
                              (selected.rotation || 0) === deg
                                ? 'bg-sky-950 border-sky-500 text-sky-200 font-bold shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cores Especiais de Texto Sem Fundo */}
                    <div className="pt-2 border-t border-slate-800">
                      <span className="block text-[10px] font-semibold text-slate-400 mb-1.5">Cor da Palavra (Alta Visibilidade)</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { value: '#ffffff', label: 'Branco' },
                          { value: '#38bdf8', label: 'Azul' },
                          { value: '#facc15', label: 'Amarelo' },
                          { value: '#10b981', label: 'Verde' },
                          { value: '#f97316', label: 'Laranja' },
                          { value: '#ef4444', label: 'Vermelho' },
                          { value: '#c084fc', label: 'Roxo' },
                          { value: '#22d3ee', label: 'Ciano' },
                        ].map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            disabled={selected.locked}
                            onClick={() => replaceItem({ ...selected, color: c.value })}
                            title={c.label}
                            style={{ backgroundColor: c.value }}
                            className={`h-7 rounded-md transition-transform flex items-center justify-center text-[10px] font-bold ${
                              ['#ffffff', '#facc15', '#22d3ee', '#38bdf8'].includes(c.value) ? 'text-black' : 'text-white'
                            } ${
                              (selected.color || '#ffffff').toLowerCase() === c.value.toLowerCase()
                                ? 'ring-2 ring-sky-400 scale-105'
                                : 'opacity-85 hover:opacity-100'
                            } disabled:opacity-40`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Cores Setoriais */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">Cor Setorial</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {WMS_COLOR_PALETTE.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        disabled={selected.locked}
                        onClick={() => replaceItem({ ...selected, color: c.value })}
                        title={c.name}
                        style={{ backgroundColor: c.value }}
                        className={`h-7 rounded-md transition-transform ${
                          (selected.color || '#f97316').toLowerCase() === c.value.toLowerCase()
                            ? 'ring-2 ring-white scale-105'
                            : 'opacity-85 hover:opacity-100'
                        } disabled:opacity-40`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Duplicar & Excluir */}
              <div className="pt-3 border-t border-slate-800 mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 text-xs font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicar</span>
                </button>
                <button
                  type="button"
                  disabled={selected.locked}
                  onClick={() => setModal('delete')}
                  className="flex items-center justify-center p-2 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 text-xs disabled:opacity-40"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </aside>

            {/* MOBILE BOTTOM SHEET DRAWER (<MD) */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`md:hidden fixed bottom-14 left-0 right-0 z-30 transition-all duration-200 ease-out border-t shadow-2xl ${
                isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
              } ${
                isDragging || freeMoveMode
                  ? 'translate-y-full opacity-0 pointer-events-none'
                  : mobileDrawerOpen
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-[calc(100%-42px)] opacity-100'
              }`}
            >
              {/* Barra de Puxar da Gaveta */}
              <div
                onClick={() => setMobileDrawerOpen((prev) => !prev)}
                className="h-10 flex items-center justify-between px-3 cursor-pointer border-b border-slate-800/40 bg-slate-950/70"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: selected.color || '#f97316' }} />
                  <span className="text-xs font-bold truncate max-w-[120px]">{selected.name}</span>
                  {selected.locked && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold flex items-center gap-0.5 shrink-0">
                      🔒
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Botão Mover Livre no Mobile */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFreeMoveMode(true);
                      setToast('Modo Movimentação Livre Ativado: Tela limpa para posicionar o item.');
                    }}
                    className="px-2 py-1 rounded-md text-[11px] font-bold text-orange-400 bg-orange-600/20 border border-orange-500/40 flex items-center gap-1"
                    title="Minimizar para tela limpa com micro-painel flutuante"
                  >
                    <Move className="w-3 h-3" />
                    <span>Mover Livre</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLockSelected();
                    }}
                    className={`p-1.5 rounded-md text-xs font-bold ${
                      selected.locked ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 bg-slate-800'
                    }`}
                  >
                    {selected.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-200 ml-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conteúdo da Gaveta Mobile */}
              <div className="p-3 max-h-[70vh] sm:max-h-[50vh] overflow-y-auto overscroll-contain space-y-3">
                {/* Atalho Rápido para Liberar Visão do Mapa */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-orange-600/15 border border-orange-500/30 text-xs">
                  <div className="flex items-center gap-1.5 text-orange-300 font-bold">
                    <Move className="w-3.5 h-3.5 text-orange-400" />
                    <span>Mover livremente sem o menu na frente:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFreeMoveMode(true);
                      setToast('Modo Movimentação Livre Ativado.');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-sm"
                  >
                    Ativar
                  </button>
                </div>
                {/* Nome */}
                <div>
                  <input
                    type="text"
                    disabled={selected.locked}
                    value={selected.name}
                    onChange={(e) => replaceItem({ ...selected, name: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-700 bg-slate-950 text-slate-100 disabled:opacity-50"
                    placeholder="Nome do elemento"
                  />
                </div>

                {/* Classificação Dedicada no Mobile */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Código SKU</label>
                    <input
                      type="text"
                      disabled={selected.locked}
                      value={selected.skuCode || ''}
                      onChange={(e) => replaceItem({ ...selected, skuCode: e.target.value.toUpperCase() })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      placeholder="Ex: SKU-101"
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded-md border border-slate-700 bg-slate-950 text-orange-400 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Porte do Volume</label>
                    <select
                      disabled={selected.locked}
                      value={selected.productSize || 'medium_box'}
                      onChange={(e) => replaceItem({ ...selected, productSize: e.target.value as ProductSize })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 text-xs font-semibold rounded-md border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-50"
                    >
                      {PRODUCT_SIZES.map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.icon} {size.short}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ROTAÇÃO TÁTIL E D-PAD MOBILE */}
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Girar Objeto:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => rotateSelectedBy(-90)}
                        className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-200 font-bold disabled:opacity-40"
                      >
                        ↺ -90°
                      </button>
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => rotateSelectedBy(90)}
                        className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-200 font-bold disabled:opacity-40"
                      >
                        ↻ +90°
                      </button>
                    </div>
                  </div>

                  {/* Nudge D-pad */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400">Mover com Toque:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(-0.5, 0)}
                        className="w-7 h-7 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(0, -0.5)}
                        className="w-7 h-7 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(0, 0.5)}
                        className="w-7 h-7 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={selected.locked}
                        onClick={() => nudgeSelected(0.5, 0)}
                        className="w-7 h-7 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ações Especiais Mobile */}
                {selected.type === 'rack' ? (
                  <button
                    type="button"
                    onClick={() => setModal('rack-gen')}
                    className="w-full py-2 px-3 rounded-xl bg-orange-600/15 border border-orange-500/40 text-orange-300 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <BoxIcon className="w-4 h-4 text-orange-400" />
                    <span>Configurar Estrutura de Racks</span>
                  </button>
                ) : selected.type === 'rectangle' ? (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isolatedSpaceId === selected.id) {
                          setIsolatedSpaceId(null);
                          setToast('Modo Foco desativado');
                        } else {
                          setIsolatedSpaceId(selected.id);
                          fitToElement(selected);
                          setToast(`Modo Foco Ativo: "${selected.name}" · Demais itens bloqueados`);
                        }
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                        isolatedSpaceId === selected.id
                          ? 'bg-orange-600 text-white border-orange-500 shadow-md ring-2 ring-orange-500/30'
                          : 'bg-orange-600/20 text-orange-400 border border-orange-500/50'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      <span>{isolatedSpaceId === selected.id ? 'Sair do Modo Foco' : 'Editar Espaço Individual (Modo Foco)'}</span>
                    </button>

                    {/* GERENCIADOR DE MÓDULOS E POSIÇÕES INTERNAS DA ZONA NO MOBILE */}
                    <ZoneInternalPositionsManager
                      element={selected}
                      scaleRatio={scaleRatio}
                      onUpdateElement={replaceItem}
                      selectedPositionId={selectedPositionId}
                      onSelectPosition={setSelectedPositionId}
                      isDark={isDark}
                    />

                    {selected.groupId && (
                      <button
                        type="button"
                        onClick={() => selectGroup(selected.groupId!)}
                        className="w-full py-1.5 px-3 rounded-xl bg-blue-950/40 border border-blue-600/40 text-blue-300 text-[11px] font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Selecionar Todo o Grupo ({activeArea.elements.filter(e => (e.groupId || e.id) === selected.groupId).length} espaços)</span>
                      </button>
                    )}
                  </div>
                ) : selected.type === 'corridor' ? (
                  <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-sky-500/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        <span>Edição de Corredor / Rua</span>
                      </span>
                      <span className="text-[9px] font-mono text-sky-300">Sem Background</span>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Identificação</label>
                      <input
                        type="text"
                        disabled={selected.locked}
                        value={selected.corridorText || selected.name}
                        onChange={(e) => {
                          const text = e.target.value.toUpperCase();
                          const fSize = selected.fontSize || 22;
                          replaceItem({
                            ...selected,
                            name: text,
                            corridorText: text,
                            width: Math.max(120, text.length * (fSize * 0.65) + 30),
                          });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded bg-slate-900 border border-slate-700 text-sky-300"
                        placeholder="Ex: RUA A, CORREDOR 01"
                      />
                    </div>

                    {/* Presets Rápidos Mobile */}
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {['RUA A', 'RUA B', 'RUA C', 'CORREDOR 01', 'CORREDOR 02', 'ENTRADA', 'SAÍDA', 'DOCA 01'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={selected.locked}
                          onClick={() => {
                            const fSize = selected.fontSize || 22;
                            replaceItem({
                              ...selected,
                              name: preset,
                              corridorText: preset,
                              width: Math.max(120, preset.length * (fSize * 0.65) + 30),
                            });
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:text-white"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Setas de Tráfego Mobile */}
                    <div className="grid grid-cols-4 gap-1">
                      {['➔', '⬅', '⬆', '⬇', '↔', '🔄', '🚷'].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          disabled={selected.locked}
                          onClick={() => {
                            const current = selected.corridorText || selected.name || '';
                            if (current.includes(sym)) return;
                            const updated = `${sym} ${current}`;
                            const fSize = selected.fontSize || 22;
                            replaceItem({
                              ...selected,
                              name: updated,
                              corridorText: updated,
                              width: Math.max(120, updated.length * (fSize * 0.65) + 30),
                            });
                          }}
                          className="p-1 rounded bg-slate-900 border border-slate-800 text-sky-300 font-bold text-xs"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    {/* Tamanho da fonte e espaçamento */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400">Fonte: {selected.fontSize || 22}px</span>
                        <input
                          type="range"
                          min="12"
                          max="80"
                          disabled={selected.locked}
                          value={selected.fontSize || 22}
                          onChange={(e) => {
                            const size = parseInt(e.target.value, 10);
                            const currentText = selected.corridorText || selected.name || '';
                            replaceItem({
                              ...selected,
                              fontSize: size,
                              height: Math.max(30, size * 1.5),
                              width: Math.max(120, currentText.length * (size * 0.65) + 30),
                            });
                          }}
                          className="w-full accent-sky-500"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400">Espaço: {selected.letterSpacing ?? 4}px</span>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          disabled={selected.locked}
                          value={selected.letterSpacing ?? 4}
                          onChange={(e) => {
                            const sp = parseInt(e.target.value, 10);
                            replaceItem({ ...selected, letterSpacing: sp });
                          }}
                          className="w-full accent-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Cores Setoriais no Mobile */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {WMS_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      disabled={selected.locked}
                      onClick={() => replaceItem({ ...selected, color: c.value })}
                      style={{ backgroundColor: c.value }}
                      className={`w-7 h-7 rounded-md shrink-0 ${
                        (selected.color || '#f97316').toLowerCase() === c.value.toLowerCase() ? 'ring-2 ring-white scale-105' : 'opacity-80'
                      } disabled:opacity-40`}
                    />
                  ))}
                </div>

                {/* Duplicar & Excluir Mobile */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={duplicateSelected}
                    className="flex-1 py-1.5 rounded-md bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    disabled={selected.locked}
                    onClick={() => setModal('delete')}
                    className="py-1.5 px-3 rounded-md bg-rose-500/15 text-rose-400 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
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

                {/* D-Pad de Micro-Ajuste Compacto */}
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
      {(tool === 'rectangle' || tool === 'divider' || tool === 'measure') && (
        <div className="md:hidden fixed bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => { setTool('rectangle'); setMeasureLine(null); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              tool === 'rectangle' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <RectangleHorizontal className="w-3.5 h-3.5" />
            <span>Área</span>
          </button>
          <button
            type="button"
            onClick={() => { setTool('divider'); setMeasureLine(null); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              tool === 'divider' ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Parede</span>
          </button>
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
            V: Selecionar · L: Travar Objeto · R: Zonas · P: Porta-Paletes · M: Medir · Ctrl+K: Buscar
          </span>
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

      {/* DRAWER MENU RÁPIDO MOBILE */}
      {mobileMenuOpen && (
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
              {/* Seção 1: Busca */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Busca WMS</span>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setModal('search');
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold"
                  >
                    <Search className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>Buscar Espaço ou SKU (Ctrl+K)</span>
                  </button>
                </div>
              </div>

              {/* Seção 2: Gestão do Galpão & Medição */}
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
                </div>
              </div>

              {/* Seção 3: Galpões & Arquivo */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Galpões & Backup</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setModal('rename');
                    }}
                    className="p-2 rounded-lg bg-slate-800 text-slate-300 font-medium flex items-center justify-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    <span>Renomear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      createNewArea();
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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DO SISTEMA */}

      {/* MODAL: REDIMENSIONAR TAMANHO DO ESPAÇO */}
      <WarehouseSizeDialog
        isOpen={modal === 'warehouse-size'}
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
          patchActive((area) => ({ ...area, elements: updated }));
        }}
        isDark={isDark}
      />

      {/* MODAL: BUSCA GLOBAL WMS & LOCALIZADOR */}
      <WMSSearchDialog
        isOpen={modal === 'search'}
        onClose={() => setModal(null)}
        areas={areas}
        activeAreaId={activeId}
        onNavigateToResult={handleNavigateToSearchResult}
        isDark={isDark}
      />

      {/* MODAL: CALIBRAÇÃO DE ESCALA MÉTRICA */}
      <ScaleCalibrationDialog
        isOpen={modal === 'scale'}
        onClose={() => setModal(null)}
        currentScaleRatio={scaleRatio}
        onSaveScaleRatio={(newRatio) => {
          patchActive((area) => ({ ...area, scaleRatio: newRatio }));
          setToast(`Escala calibrada: 1m = ${newRatio}px.`);
        }}
        isDark={isDark}
      />

      {/* MODAL: EXCLUSÃO DE ELEMENTO */}
      {modal === 'delete' && (
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

      {/* MODAL: RENOMEAR GALPÃO */}
      {modal === 'rename' && (
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

      {/* MODAL: RESTAURAR BACKUP */}
      {modal === 'import' && (
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
