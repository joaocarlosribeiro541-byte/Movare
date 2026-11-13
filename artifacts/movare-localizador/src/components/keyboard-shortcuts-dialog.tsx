import { X, Command, HelpCircle } from 'lucide-react';

type KeyboardShortcutsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
};

const SHORTCUT_GROUPS = [
  {
    group: 'Navegação e Seleção',
    shortcuts: [
      { key: 'V', desc: 'Ativar modo Seleção de zonas e objetos' },
      { key: 'M', desc: 'Ativar modo Mover e redimensionar' },
      { key: 'H', desc: 'Ativar modo Navegar / Pan pelo mapa' },
      { key: 'Ctrl + K', desc: 'Abrir barra de busca Spotlight e comandos' },
      { key: 'Esc', desc: 'Limpar seleção ou fechar painéis/modais' },
    ],
  },
  {
    group: 'Ferramentas de Desenho CAD',
    shortcuts: [
      { key: 'R', desc: 'Desenhar nova Zona / Bloco de armazenagem' },
      { key: 'C', desc: 'Criar identificador de Corredor / Rua' },
      { key: 'T', desc: 'Ativar Fita Métrica CAD para medir distâncias' },
    ],
  },
  {
    group: 'Ações de Objeto & Edição',
    shortcuts: [
      { key: 'Delete / Backspace', desc: 'Excluir elemento selecionado' },
      { key: 'Ctrl + D', desc: 'Duplicar elemento selecionado' },
      { key: 'Ctrl + E', desc: 'Exportar imagem PNG em alta resolução' },
      { key: 'Ctrl + L', desc: 'Bloquear / desbloquear zona contra edição' },
      { key: 'Ctrl + Z', desc: 'Desfazer última alteração' },
      { key: 'Ctrl + Y', desc: 'Refazer alteração' },
    ],
  },
  {
    group: 'Câmera e Visualização',
    shortcuts: [
      { key: 'Scroll do Mouse', desc: 'Aumentar ou diminuir zoom' },
      { key: 'Arraste com Botão Direito', desc: 'Arrastar e navegar pelo mapa' },
      { key: '?', desc: 'Abrir esta tela de atalhos' },
    ],
  },
];

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
  isDark = true,
}: KeyboardShortcutsDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-150 ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-slate-950/90'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-400/30'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Command className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm sm:text-base font-bold">Atalhos de Teclado — Movare 3.0</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTEÚDO DOS ATALHOS */}
        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.group} className="space-y-2">
              <h4 className="text-xs font-bold text-orange-400 tracking-wide uppercase">
                {group.group}
              </h4>
              <div className={`rounded-xl border overflow-hidden divide-y ${
                isDark ? 'border-slate-800 bg-slate-950/40 divide-slate-800/60' : 'border-slate-200 bg-slate-50 divide-slate-200'
              }`}>
                {group.shortcuts.map((sc) => (
                  <div key={sc.key} className="flex items-center justify-between px-3.5 py-2 text-xs">
                    <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{sc.desc}</span>
                    <kbd className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border shadow-xs shrink-0 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-orange-400' : 'bg-white border-slate-300 text-orange-600'
                    }`}>
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RODAPÉ */}
        <div className={`px-5 py-3 border-t text-xs text-slate-400 flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'
        }`}>
          <span>Pressione <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">ESC</kbd> para fechar</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
