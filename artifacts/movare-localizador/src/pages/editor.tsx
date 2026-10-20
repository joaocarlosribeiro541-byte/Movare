import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, CircleHelp, Crosshair,
  LayoutGrid, Minus, MousePointer2, Redo2, RectangleHorizontal, RotateCcw,
  Ruler, Trash2, X, ZoomIn, ZoomOut, Pencil, Warehouse,
} from 'lucide-react';
import { initialAreas, parseBackup, createId, WORLD_HEIGHT, WORLD_WIDTH, type DrawingElement, type FloorArea } from '../editor-model';
import { snapMovedElement, snapPointToElements, snapResizedRectangle, type AlignmentGuide } from '../alignment';
import { createGridDividers, parseTrackProportions } from '../grid-geometry';
import { loadAreas, saveAreas } from '../local-store';

type Tool = 'select' | 'rectangle' | 'divider';
type Camera = { x: number; y: number; scale: number };
type Point = { x: number; y: number };
type Gesture =
  | { kind: 'pan'; pointerId: number; start: Point; camera: Camera }
  | { kind: 'move'; pointerId: number; start: Point; item: DrawingElement }
  | { kind: 'resize'; pointerId: number; start: Point; item: DrawingElement; corner: string }
  | { kind: 'draw'; pointerId: number; start: Point; end: Point; type: 'rectangle' | 'divider' }
  | { kind: 'pinch'; ids: [number, number]; distance: number; anchor: Point; camera: Camera };

const clone = <T,>(value: T): T => structuredClone(value);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const EMPTY_CAMERA = { x: 0, y: 0, scale: 1 };
const DEFAULT_RECTANGLE_COLOR = '#d39a53';
const DEFAULT_DIVIDER_COLOR = '#557b6b';
const ELEMENT_COLORS = [
  { name: 'Âmbar', value: '#d39a53' },
  { name: 'Verde', value: '#557b6b' },
  { name: 'Azul', value: '#5482b8' },
  { name: 'Terracota', value: '#c96f5d' },
  { name: 'Violeta', value: '#8a6bb0' },
  { name: 'Turquesa', value: '#3c9aa4' },
  { name: 'Grafite', value: '#64748b' },
];
const defaultElementColor = (item: DrawingElement) =>
  item.type === 'rectangle' ? DEFAULT_RECTANGLE_COLOR : DEFAULT_DIVIDER_COLOR;
const elementColor = (item: DrawingElement) => item.color ?? defaultElementColor(item);

export default function Editor() {
  const [areas, setAreas] = useState<FloorArea[]>(() => clone(initialAreas));
  const areasRef = useRef(areas);
  areasRef.current = areas;
  const [activeId, setActiveId] = useState(initialAreas[0].id);
  const activeArea = areas.find((area) => area.id === activeId) ?? areas[0];
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = activeArea.elements.find((item) => item.id === selectedId) ?? null;
  const [camera, setCamera] = useState<Camera>(EMPTY_CAMERA);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<DrawingElement | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [history, setHistory] = useState<FloorArea[][]>([]);
  const historyRef = useRef<FloorArea[][]>([]);
  const [future, setFuture] = useState<FloorArea[][]>([]);
  const futureRef = useRef<FloorArea[][]>([]);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const [storageReady, setStorageReady] = useState(false);
  const [modal, setModal] = useState<'delete' | 'rename' | 'import' | 'grid' | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [gridColumnsDraft, setGridColumnsDraft] = useState('1; 1');
  const [gridRowsDraft, setGridRowsDraft] = useState('1; 1');
  const [gridError, setGridError] = useState('');
  const [queuedImport, setQueuedImport] = useState<FloorArea[] | null>(null);
  const [toast, setToast] = useState('');
  const [elementNameDraft, setElementNameDraft] = useState('');
  const [elementColorDraft, setElementColorDraft] = useState(DEFAULT_RECTANGLE_COLOR);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  const setCameraSafe = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  const constrainCamera = useCallback((next: Camera): Camera => {
    if (!canvasSize.width || !canvasSize.height) return next;
    const visibleMargin = 48;
    const scaledWidth = WORLD_WIDTH * next.scale;
    const scaledHeight = WORLD_HEIGHT * next.scale;
    return {
      ...next,
      x: Math.max(visibleMargin - scaledWidth, Math.min(canvasSize.width - visibleMargin, next.x)),
      y: Math.max(visibleMargin - scaledHeight, Math.min(canvasSize.height - visibleMargin, next.y)),
    };
  }, [canvasSize.height, canvasSize.width]);

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
    recordAreas(areasRef.current.map((area) => area.id === activeId ? patcher(area) : area));
  }, [activeId, recordAreas]);

  useEffect(() => {
    let alive = true;
    loadAreas().then((stored) => {
      if (!alive) return;
      areasRef.current = stored;
      setAreas(stored);
      setStorageReady(true);
      setSaveStatus('saved');
    }).catch(() => {
      if (!alive) return;
      setSaveStatus('error');
      setToast('Não foi possível ler o armazenamento deste dispositivo.');
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      saveAreas(areas).then(() => setSaveStatus('saved')).catch(() => {
        setSaveStatus('error');
        setToast('Falha ao salvar neste dispositivo. Verifique o espaço disponível.');
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [areas, storageReady]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) {
        const previous = canvasSizeRef.current;
        const currentCamera = cameraRef.current;
        if (previous.width && previous.height && currentCamera.scale > 0) {
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

  useEffect(() => {
    if (canvasSize.width && canvasSize.height && camera.scale === 1 && camera.x === 0 && camera.y === 0) fitPlan();
    // fitPlan is intentionally only used for initial viewport sizing.
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => {
    setSelectedId(null);
    setElementNameDraft('');
    setElementColorDraft(DEFAULT_RECTANGLE_COLOR);
    setAlignmentGuides([]);
    fitPlan();
  }, [activeId]);

  useEffect(() => {
    if (selected) setElementColorDraft(elementColor(selected));
    else setElementColorDraft(DEFAULT_RECTANGLE_COLOR);
  }, [activeId, selected?.id, selected?.color]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function fitPlan() {
    if (!canvasSize.width || !canvasSize.height) return;
    const scale = Math.max(0.18, Math.min((canvasSize.width - 72) / WORLD_WIDTH, (canvasSize.height - 72) / WORLD_HEIGHT, 1));
    setCameraSafe({
      scale,
      x: (canvasSize.width - WORLD_WIDTH * scale) / 2,
      y: (canvasSize.height - WORLD_HEIGHT * scale) / 2,
    });
  }

  function pointToWorld(clientX: number, clientY: number): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: Math.max(0, Math.min(WORLD_WIDTH, (clientX - (rect?.left ?? 0) - cam.x) / cam.scale)),
      y: Math.max(0, Math.min(WORLD_HEIGHT, (clientY - (rect?.top ?? 0) - cam.y) / cam.scale)),
    };
  }

  function pointToScreen(clientX: number, clientY: number): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }

  function editItemAtPoint(gesture: Extract<Gesture, { kind: 'move' | 'resize' }>, world: Point): DrawingElement {
    if (gesture.kind === 'move') {
      const dx = world.x - gesture.start.x;
      const dy = world.y - gesture.start.y;
      const minX = gesture.item.type === 'divider' ? Math.max(0, -gesture.item.width) : 0;
      const minY = gesture.item.type === 'divider' ? Math.max(0, -gesture.item.height) : 0;
      const maxX = gesture.item.type === 'rectangle' ? WORLD_WIDTH - gesture.item.width : WORLD_WIDTH - Math.max(0, gesture.item.width);
      const maxY = gesture.item.type === 'rectangle' ? WORLD_HEIGHT - gesture.item.height : WORLD_HEIGHT - Math.max(0, gesture.item.height);
      return {
        ...gesture.item,
        x: Math.max(minX, Math.min(maxX, gesture.item.x + dx)),
        y: Math.max(minY, Math.min(maxY, gesture.item.y + dy)),
      };
    }
    const item = gesture.item;
    const right = gesture.corner.includes('r');
    const bottom = gesture.corner.includes('b');
    const left = gesture.corner.includes('l');
    const top = gesture.corner.includes('t');
    const x = left ? Math.min(item.x + item.width - 2, world.x) : item.x;
    const y = top ? Math.min(item.y + item.height - 2, world.y) : item.y;
    const width = right ? Math.max(2, world.x - item.x) : left ? Math.max(2, item.x + item.width - world.x) : item.width;
    const height = bottom ? Math.max(2, world.y - item.y) : top ? Math.max(2, item.y + item.height - world.y) : item.height;
    return { ...item, x: left ? x : item.x, y: top ? y : item.y, width, height };
  }

  function zoomBy(factor: number) {
    const cam = cameraRef.current;
    const nextScale = Math.max(0.18, Math.min(3.2, cam.scale * factor));
    const anchor = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    const world = { x: (anchor.x - cam.x) / cam.scale, y: (anchor.y - cam.y) / cam.scale };
    setCameraSafe(constrainCamera({ scale: nextScale, x: anchor.x - world.x * nextScale, y: anchor.y - world.y * nextScale }));
  }

  function replaceItem(item: DrawingElement) {
    patchActive((area) => ({ ...area, elements: area.elements.map((candidate) => candidate.id === item.id ? item : candidate) }));
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    setAlignmentGuides([]);
    const screen = pointToScreen(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, screen);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      const [aId, bId] = [...pointersRef.current.keys()].slice(0, 2);
      const a = pointersRef.current.get(aId)!;
      const b = pointersRef.current.get(bId)!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cam = cameraRef.current;
      gestureRef.current = {
        kind: 'pinch', ids: [aId, bId], distance: Math.max(1, dist(a, b)),
        anchor: { x: (mid.x - cam.x) / cam.scale, y: (mid.y - cam.y) / cam.scale }, camera: cam,
      };
      setPreview(null);
      setAlignmentGuides([]);
      return;
    }

    const world = pointToWorld(event.clientX, event.clientY);
    const target = event.target as Element;
    const handle = target.closest<SVGElement>('[data-handle]')?.dataset.handle;
    const itemId = target.closest<SVGElement>('[data-element-id]')?.dataset.elementId;
    const item = activeArea.elements.find((candidate) => candidate.id === itemId);
    if (handle && selected && tool === 'select') {
      gestureRef.current = { kind: 'resize', pointerId: event.pointerId, start: world, item: clone(selected), corner: handle };
    } else if (tool === 'rectangle' || tool === 'divider') {
      const snapped = snapPointToElements(world, activeArea.elements, cameraRef.current.scale);
      gestureRef.current = { kind: 'draw', pointerId: event.pointerId, start: snapped.point, end: snapped.point, type: tool };
      setAlignmentGuides(snapped.guides);
      setPreview({ id: 'preview', type: tool, name: '', x: snapped.point.x, y: snapped.point.y, width: 1, height: 1 });
    } else if (tool === 'select' && item) {
      setSelectedId(item.id);
      setElementNameDraft(item.name);
      setElementColorDraft(elementColor(item));
      gestureRef.current = { kind: 'move', pointerId: event.pointerId, start: world, item: clone(item) };
    } else {
      if (tool === 'select') setSelectedId(null);
      gestureRef.current = { kind: 'pan', pointerId: event.pointerId, start: screen, camera: cameraRef.current };
    }
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const screen = pointToScreen(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, screen);
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      const first = pointersRef.current.get(gesture.ids[0]);
      const second = pointersRef.current.get(gesture.ids[1]);
      if (!first || !second) return;
      const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const scale = Math.max(0.18, Math.min(3.2, gesture.camera.scale * (dist(first, second) / gesture.distance)));
      setCameraSafe(constrainCamera({ scale, x: mid.x - gesture.anchor.x * scale, y: mid.y - gesture.anchor.y * scale }));
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    const world = pointToWorld(event.clientX, event.clientY);
    if (gesture.kind === 'pan') {
      setCameraSafe(constrainCamera({ ...gesture.camera, x: gesture.camera.x + screen.x - gesture.start.x, y: gesture.camera.y + screen.y - gesture.start.y }));
    } else if (gesture.kind === 'move' || gesture.kind === 'resize') {
      const edited = editItemAtPoint(gesture, world);
      const snapped = gesture.kind === 'resize'
        ? snapResizedRectangle(edited, gesture.corner, activeArea.elements, cameraRef.current.scale)
        : snapMovedElement(edited, activeArea.elements, cameraRef.current.scale);
      setPreview(snapped.item);
      setAlignmentGuides(snapped.guides);
    } else if (gesture.kind === 'draw') {
      const snapped = snapPointToElements(world, activeArea.elements, cameraRef.current.scale);
      gestureRef.current = { ...gesture, end: snapped.point };
      setAlignmentGuides(snapped.guides);
      if (gesture.type === 'rectangle') {
        setPreview({
          id: 'preview', type: gesture.type, name: '',
          x: Math.min(gesture.start.x, snapped.point.x), y: Math.min(gesture.start.y, snapped.point.y),
          width: Math.max(1, Math.abs(snapped.point.x - gesture.start.x)),
          height: Math.max(1, Math.abs(snapped.point.y - gesture.start.y)),
        });
      } else {
        setPreview({
          id: 'preview', type: gesture.type, name: '',
          x: gesture.start.x, y: gesture.start.y,
          width: snapped.point.x - gesture.start.x, height: snapped.point.y - gesture.start.y,
        });
      }
    }
  }

  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      if (gesture.ids.includes(event.pointerId)) {
        const remaining = [...pointersRef.current.entries()].slice(0, 2);
        if (remaining.length < 2) {
          gestureRef.current = null;
        } else {
          const [first, second] = remaining.map(([, point]) => point);
          const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
          const cam = cameraRef.current;
          gestureRef.current = {
            kind: 'pinch',
            ids: remaining.map(([id]) => id) as [number, number],
            distance: Math.max(1, dist(first, second)),
            anchor: { x: (mid.x - cam.x) / cam.scale, y: (mid.y - cam.y) / cam.scale },
            camera: cam,
          };
        }
      }
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.kind === 'draw' && pointersRef.current.size < 2) {
      const end = snapPointToElements(pointToWorld(event.clientX, event.clientY), activeArea.elements, cameraRef.current.scale).point;
      const lineDx = end.x - gesture.start.x;
      const lineDy = end.y - gesture.start.y;
      const rectX = Math.min(gesture.start.x, end.x);
      const rectY = Math.min(gesture.start.y, end.y);
      const rectWidth = Math.abs(lineDx);
      const rectHeight = Math.abs(lineDy);
      if (gesture.type === 'rectangle' ? rectWidth > 4 && rectHeight > 4 : Math.hypot(lineDx, lineDy) > 4) {
        const number = activeArea.elements.filter((item) => item.type === gesture.type).length + 1;
        const item: DrawingElement = {
          id: createId(), type: gesture.type, name: `${gesture.type === 'rectangle' ? 'Área' : 'Divisória'} ${number}`,
          x: gesture.type === 'rectangle' ? rectX : gesture.start.x,
          y: gesture.type === 'rectangle' ? rectY : gesture.start.y,
          width: gesture.type === 'rectangle' ? rectWidth : lineDx,
          height: gesture.type === 'rectangle' ? rectHeight : lineDy,
        };
        patchActive((area) => ({ ...area, elements: [...area.elements, item] }));
        setSelectedId(item.id);
        setElementNameDraft(item.name);
        setTool('select');
      }
    } else if (gesture.kind === 'move' || gesture.kind === 'resize') {
      const initial = editItemAtPoint(gesture, pointToWorld(event.clientX, event.clientY));
      const edited = gesture.kind === 'resize'
        ? snapResizedRectangle(initial, gesture.corner, activeArea.elements, cameraRef.current.scale).item
        : snapMovedElement(initial, activeArea.elements, cameraRef.current.scale).item;
      if (edited.x !== gesture.item.x || edited.y !== gesture.item.y ||
        edited.width !== gesture.item.width || edited.height !== gesture.item.height) {
        replaceItem(edited);
      }
    }
    gestureRef.current = null;
    setPreview(null);
    setAlignmentGuides([]);
  }

  function pointerCancel(event: PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
    setPreview(null);
    setAlignmentGuides([]);
  }

  function undo() {
    const previous = historyRef.current.at(-1);
    if (!previous) return;
    futureRef.current = [...futureRef.current, clone(areasRef.current)];
    historyRef.current = historyRef.current.slice(0, -1);
    setFuture(futureRef.current);
    setHistory(historyRef.current);
    areasRef.current = previous;
    setAreas(previous);
    setSelectedId(null);
  }

  function redo() {
    const next = futureRef.current.at(-1);
    if (!next) return;
    historyRef.current = [...historyRef.current, clone(areasRef.current)];
    futureRef.current = futureRef.current.slice(0, -1);
    setHistory(historyRef.current);
    setFuture(futureRef.current);
    areasRef.current = next;
    setAreas(next);
    setSelectedId(null);
  }

  function commitElementName() {
    if (!selected || !elementNameDraft.trim() || selected.name === elementNameDraft.trim()) return;
    replaceItem({ ...selected, name: elementNameDraft.trim() });
  }

  function commitElementColor() {
    if (!selected || !/^#[\da-f]{6}$/i.test(elementColorDraft) || elementColor(selected) === elementColorDraft) return;
    replaceItem({ ...selected, color: elementColorDraft });
  }

  function openGridDialog() {
    if (!selected || selected.type !== 'rectangle') return;
    setGridColumnsDraft('1; 1');
    setGridRowsDraft('1; 1');
    setGridError('');
    setModal('grid');
  }

  function applyGrid() {
    if (!selected || selected.type !== 'rectangle') return;
    try {
      const columns = parseTrackProportions(gridColumnsDraft);
      const rows = parseTrackProportions(gridRowsDraft);
      const dividers = createGridDividers(selected, columns, rows);
      patchActive((area) => ({ ...area, elements: [...area.elements, ...dividers] }));
      setGridError('');
      setModal(null);
      setToast(`Grade aplicada com ${dividers.length} divisórias.`);
    } catch (error) {
      setGridError(error instanceof Error ? error.message : 'Não foi possível criar esta grade.');
    }
  }

  function exportBackup() {
    const backup = { format: 'movare-localizador-backup', version: 1, exportedAt: new Date().toISOString(), areas } as const;
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `movare-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Backup exportado.');
  }

  async function readImport(file?: File) {
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      setQueuedImport(parsed);
      setModal('import');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Não foi possível validar este backup.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function applyImport() {
    if (!queuedImport) return;
    recordAreas(queuedImport);
    setActiveId(queuedImport[0]?.id ?? initialAreas[0].id);
    setSelectedId(null);
    setQueuedImport(null);
    setModal(null);
    setCamera(EMPTY_CAMERA);
    setToast('Backup restaurado neste dispositivo.');
  }

  function areaRename() {
    if (!nameDraft.trim()) return;
    patchActive((area) => ({ ...area, name: nameDraft.trim() }));
    setModal(null);
  }

  const visibleItems = useMemo(() => activeArea.elements.map((item) => preview?.id === item.id ? preview : item), [activeArea.elements, preview]);
  const displayStatus = saveStatus === 'loading' ? 'Abrindo armazenamento…' :
    saveStatus === 'saving' ? 'Salvando neste dispositivo…' : saveStatus === 'error' ? 'Falha ao salvar' : 'Salvo neste dispositivo';
  const shortStatus = saveStatus === 'loading' ? 'Abrindo' :
    saveStatus === 'saving' ? 'Salvando' : saveStatus === 'error' ? 'Erro' : 'Salvo';

  return (
    <main className="movare-app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark"><Warehouse size={19} strokeWidth={1.8} /></div>
          <div><div className="brand-title">Movare</div><div className="brand-sub">Localizador</div></div>
        </div>
        <div className="header-divider" />
        <label className="area-select-wrap">
          <span className="overline">Área de trabalho</span>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
            <select data-testid="select-area" aria-label="Escolher área" title={activeArea.name} className="area-select" value={activeId} onChange={(event) => setActiveId(event.target.value)}>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 4, pointerEvents: 'none', color: '#77817a' }} />
          </span>
        </label>
        <div className="header-actions">
          <div className={`save-status ${saveStatus === 'error' ? 'error' : ''}`} data-testid="status-autosave" aria-live="polite" aria-label={displayStatus} title={displayStatus}>
            <i className="save-dot" /><span className="save-status-full">{displayStatus}</span><span className="save-status-short">{shortStatus}</span>
          </div>
          <button className="icon-button" aria-label="Renomear área" data-testid="button-rename-area" onClick={() => { setNameDraft(activeArea.name); setModal('rename'); }}><Pencil size={16} /></button>
          <button className="icon-button" aria-label="Ajuda de desenho" data-testid="button-help" onClick={() => setHelpVisible((visible) => !visible)}><CircleHelp size={17} /></button>
        </div>
      </header>

      <section className="workspace">
        <div className="canvas-shell" ref={canvasRef} data-testid="canvas-warehouse">
          <div className="canvas-tag"><i /> {activeArea.elements.length ? `${activeArea.elements.length} elementos` : 'Planta vazia'}</div>
          <div className="canvas-tools">
            <button className="icon-button" aria-label="Centralizar planta" data-testid="button-fit" onClick={fitPlan}><Crosshair size={16} /></button>
            <button className="icon-button" aria-label="Aumentar zoom" data-testid="button-zoom-in" onClick={() => zoomBy(1.2)}><ZoomIn size={16} /></button>
            <button className="icon-button" aria-label="Diminuir zoom" data-testid="button-zoom-out" onClick={() => zoomBy(1 / 1.2)}><ZoomOut size={16} /></button>
          </div>
          <svg
            className="map-svg" data-testid="svg-map" role="img" aria-label={`Planta vetorial: ${activeArea.name}`}
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}
            viewBox={`0 0 ${Math.max(1, canvasSize.width)} ${Math.max(1, canvasSize.height)}`}
          >
            <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
              {visibleItems.map((item) => {
                const isSelected = item.id === selectedId;
                const color = isSelected ? elementColorDraft : elementColor(item);
                return (
                  <g key={item.id} data-element-id={item.id} data-testid={`element-${item.id}`} style={{ cursor: tool === 'select' ? 'move' : 'crosshair' }}>
                    {item.type === 'rectangle' ? (
                      <rect x={item.x} y={item.y} width={item.width} height={item.height} rx="5" fill={`${color}${isSelected ? '32' : '1a'}`} stroke={color} strokeWidth={isSelected ? 2.2 : 1.8} vectorEffect="non-scaling-stroke" />
                    ) : (
                      <line x1={item.x} y1={item.y} x2={item.x + item.width} y2={item.y + item.height} stroke={color} strokeWidth={isSelected ? 3 : 2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    )}
                    {item.type === 'divider' && (
                      <line
                        x1={item.x} y1={item.y} x2={item.x + item.width} y2={item.y + item.height}
                        stroke="transparent" strokeWidth={28 / camera.scale} pointerEvents="stroke"
                      />
                    )}
                    {(item.type === 'rectangle' || Math.hypot(item.width, item.height) > 20) && <text x={item.x + 10} y={item.y + 21} fontSize="13" fontFamily="DM Sans, sans-serif" fontWeight="600" fill="#59645d" pointerEvents="none">{item.name}</text>}
                    {isSelected && item.type === 'rectangle' && (['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
                      const cx = item.x + (corner.includes('r') ? item.width : 0);
                      const cy = item.y + (corner.includes('b') ? item.height : 0);
                      return (
                        <g key={corner} data-handle={corner} data-testid={`handle-${corner}-${item.id}`} style={{ cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize' }}>
                          <circle cx={cx} cy={cy} r={22 / camera.scale} fill="transparent" />
                          <circle cx={cx} cy={cy} r={7 / camera.scale} fill="#fbfaf5" stroke="#285c4b" strokeWidth={1.8 / camera.scale} pointerEvents="none" />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {preview?.id === 'preview' && (preview.type === 'rectangle'
                ? <rect x={preview.x} y={preview.y} width={preview.width} height={preview.height} rx="4" fill="#d39a5324" stroke="#c88839" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                : <line x1={preview.x} y1={preview.y} x2={preview.x + preview.width} y2={preview.y + preview.height} stroke="#557b6b" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
              {alignmentGuides.map((guide, index) => (
                <line
                  key={`${guide.axis}-${guide.value}-${index}`}
                  data-testid={`alignment-guide-${guide.axis}`}
                  x1={guide.axis === 'x' ? guide.value : guide.start}
                  y1={guide.axis === 'x' ? guide.start : guide.value}
                  x2={guide.axis === 'x' ? guide.value : guide.end}
                  y2={guide.axis === 'x' ? guide.end : guide.value}
                  stroke="#3d876e" strokeWidth="1.5" strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke" pointerEvents="none"
                />
              ))}
            </g>
          </svg>
          {activeArea.elements.length === 0 && !preview && <div className="map-empty"><div className="empty-icon"><Ruler size={21} /></div><strong>Comece a desenhar a planta</strong><span>Escolha uma ferramenta abaixo e arraste sobre a área.</span></div>}
          {helpVisible && <div className="toast-note" role="status">Selecione uma área para mudar sua cor ou criar uma grade de proporções personalizadas.</div>}
        </div>

        {selected ? (
          <div className="selection-card" data-testid="panel-selection">
            <div className="selection-info"><span className="selection-swatch" style={{ background: elementColorDraft }} /><div style={{ minWidth: 0 }}><div className="selection-type">{selected.type === 'rectangle' ? 'Área retangular' : 'Divisória'}</div><div className="selection-name">{selected.name}</div></div></div>
            <input
              className="property-input" aria-label="Nome do elemento" data-testid="input-element-name" value={elementNameDraft}
              onChange={(event) => setElementNameDraft(event.target.value)}
              onBlur={commitElementName}
              onKeyDown={(event) => { if (event.key === 'Enter') { commitElementName(); event.currentTarget.blur(); } }}
              placeholder="Nome do elemento"
            />
            <div className="selection-color-row">
              <span className="selection-color-label">Cor</span>
              <div className="color-options" role="group" aria-label="Escolher cor do elemento">
                {ELEMENT_COLORS.map((color) => (
                  <button
                    key={color.value} type="button" className={`color-swatch ${elementColorDraft.toLowerCase() === color.value ? 'active' : ''}`}
                    aria-label={`Usar cor ${color.name}`} aria-pressed={elementColorDraft.toLowerCase() === color.value}
                    title={color.name} data-testid={`color-swatch-${color.name.toLowerCase()}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => {
                      setElementColorDraft(color.value);
                      if (selected) replaceItem({ ...selected, color: color.value });
                    }}
                  />
                ))}
                <label className="custom-color-control" title="Escolher outra cor">
                  <input
                    type="color" aria-label="Cor personalizada" data-testid="input-element-color"
                    value={elementColorDraft}
                    onChange={(event) => setElementColorDraft(event.target.value)}
                    onBlur={commitElementColor}
                  />
                </label>
              </div>
            </div>
            <div className="selection-actions">
              {selected.type === 'rectangle' && <button className="mini-button" data-testid="button-grid-element" onClick={openGridDialog}><LayoutGrid size={14} /><span>Grade</span></button>}
              <button className="mini-button danger" data-testid="button-delete-element" onClick={() => setModal('delete')}><Trash2 size={14} /><span>Excluir</span></button>
              <button className="icon-button" aria-label="Fechar seleção" data-testid="button-clear-selection" onClick={() => setSelectedId(null)}><X size={15} /></button>
            </div>
          </div>
        ) : <div className="hint-line" data-testid="text-editor-hint">{tool === 'select' ? 'Selecione um elemento ou arraste o plano para navegar. Guias verdes indicam alinhamentos próximos.' : `Arraste no plano para desenhar ${tool === 'rectangle' ? 'uma área retangular' : 'uma divisória'}.`}</div>}

        <div className="bottom-bar" data-testid="toolbar">
          <div className="tool-group" role="toolbar" aria-label="Ferramentas do plano">
            <button className={`tool-button ${tool === 'select' ? 'active' : ''}`} aria-label="Selecionar e mover elementos" aria-pressed={tool === 'select'} data-testid="tool-select" onClick={() => setTool('select')}><MousePointer2 /><span>Selecionar</span></button>
            <button className={`tool-button ${tool === 'rectangle' ? 'active' : ''}`} aria-label="Desenhar área retangular" aria-pressed={tool === 'rectangle'} data-testid="tool-rectangle" onClick={() => setTool('rectangle')}><RectangleHorizontal /><span>Área</span></button>
            <button className={`tool-button ${tool === 'divider' ? 'active' : ''}`} aria-label="Desenhar divisória" aria-pressed={tool === 'divider'} data-testid="tool-divider" onClick={() => setTool('divider')}><Minus /><span>Divisória</span></button>
            <span className="tool-separator" />
            <button className="tool-button" aria-label="Desfazer" title="Desfazer" data-testid="button-undo" disabled={!history.length} onClick={undo}><RotateCcw /><span>Desfazer</span></button>
            <button className="tool-button" aria-label="Refazer" title="Refazer" data-testid="button-redo" disabled={!future.length} onClick={redo}><Redo2 /><span>Refazer</span></button>
          </div>
          <div className="bottom-right">
            <span className="zoom-label" data-testid="text-zoom">{Math.round(camera.scale * 100)}%</span>
            <button className="icon-button" aria-label="Exportar backup JSON" title="Exportar backup" data-testid="button-export" onClick={exportBackup}><ArrowDownToLine size={16} /></button>
            <button className="icon-button" aria-label="Importar backup JSON" title="Importar backup" data-testid="button-import" onClick={() => fileInputRef.current?.click()}><ArrowUpFromLine size={16} /></button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" hidden data-testid="input-import-file" onChange={(event) => void readImport(event.target.files?.[0])} />
          </div>
        </div>
      </section>

      {toast && <div className="toast-note" role="status" data-testid="status-toast">{toast}</div>}
      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            {modal === 'delete' ? <>
              <h2 id="dialog-title">Excluir elemento?</h2>
              <p>“{selected?.name}” será removido desta planta. Esta ação pode ser desfeita.</p>
              <div className="modal-actions"><button className="quiet-button" data-testid="button-cancel-delete" onClick={() => setModal(null)}>Manter</button><button className="primary-button" data-testid="button-confirm-delete" onClick={() => { if (selected) patchActive((area) => ({ ...area, elements: area.elements.filter((item) => item.id !== selected.id) })); setSelectedId(null); setModal(null); }}>Excluir elemento</button></div>
            </> : modal === 'rename' ? <>
              <h2 id="dialog-title">Renomear área</h2><p>O nome é salvo junto com o desenho desta área.</p>
              <input autoFocus className="property-input" style={{ width: '100%', marginTop: 15, height: 42 }} aria-label="Nome da área" data-testid="input-area-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') areaRename(); }} />
              <div className="modal-actions"><button className="quiet-button" data-testid="button-cancel-rename" onClick={() => setModal(null)}>Cancelar</button><button className="primary-button" data-testid="button-save-area-name" onClick={areaRename}><Check size={15} /> Salvar nome</button></div>
            </> : modal === 'grid' ? <>
              <h2 id="dialog-title">Dividir em grade</h2>
              <p>As divisórias serão criadas dentro de “{selected?.name}”. Informe as proporções das faixas.</p>
              <div className="grid-fields">
                <label>
                  <span>Proporções das colunas</span>
                  <input
                    className="property-input" type="text" inputMode="decimal" autoComplete="off"
                    aria-label="Proporções das colunas" data-testid="input-grid-columns"
                    value={gridColumnsDraft} onChange={(event) => { setGridColumnsDraft(event.target.value); setGridError(''); }}
                    placeholder="1; 1"
                  />
                </label>
                <label>
                  <span>Proporções das linhas</span>
                  <input
                    className="property-input" type="text" inputMode="decimal" autoComplete="off"
                    aria-label="Proporções das linhas" data-testid="input-grid-rows"
                    value={gridRowsDraft} onChange={(event) => { setGridRowsDraft(event.target.value); setGridError(''); }}
                    placeholder="1; 1"
                  />
                </label>
              </div>
              <p className="grid-help">Separe valores positivos por ponto e vírgula. Ex.: 1; 2; 1 cria faixas de tamanhos proporcionais.</p>
              {gridError && <p className="grid-error" role="alert" data-testid="grid-error">{gridError}</p>}
              <div className="modal-actions">
                <button className="quiet-button" data-testid="button-cancel-grid" onClick={() => setModal(null)}>Cancelar</button>
                <button className="primary-button" data-testid="button-apply-grid" onClick={applyGrid}><LayoutGrid size={15} /> Aplicar grade</button>
              </div>
            </> : <>
              <h2 id="dialog-title">Restaurar backup?</h2><p>O arquivo foi validado. A restauração substituirá todas as cinco áreas armazenadas neste dispositivo.</p>
              <div className="modal-actions"><button className="quiet-button" data-testid="button-cancel-import" onClick={() => { setModal(null); setQueuedImport(null); }}>Cancelar</button><button className="primary-button" data-testid="button-confirm-import" onClick={applyImport}>Substituir áreas</button></div>
            </>}
          </section>
        </div>
      )}
    </main>
  );
}
