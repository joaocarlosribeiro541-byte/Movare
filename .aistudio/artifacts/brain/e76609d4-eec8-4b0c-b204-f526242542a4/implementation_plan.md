# Movare WMS — Localizador e Editor de Mapas Industrial (Mega Upgrade)

Sistema profissional de gestão visual e mapeamento de armazém (WMS), unindo editor CAD de alta precisão com visualização interativa, localização instantânea de endereços logísticos (`Rua-Módulo-Nível-Vão`), gerador paramétrico de porta-paletes multinível, minimapa de navegação rápida e fita métrica com calibração métrica real.

---

### Decisões do Usuário & Alinhamento

> [!IMPORTANT]
> As decisões de escopo e design foram alinhadas diretamente na etapa de planejamento:
> - **Foco**: Sistema WMS de armazém com endereçamento logístico e busca instantânea.
> - **Identidade Visual**: Modo Dark e Light profissional estilo CAD industrial com minimapa de navegação em tempo real.
> - **Funcionalidades Chave**:
>   1. Localizador inteligente com busca instantânea por endereço (`A-03-02-1`), zona ou produto/SKU, com zoom dinâmico e realce luminoso no mapa.
>   2. Gerador paramétrico de estruturas porta-paletes e prateleiras multinível (configuração de ruas, módulos, níveis e vãos de armazenamento).
>   3. Ferramenta de medição real (fita métrica com cálculo dinâmico de distância em metros) e réguas milimetradas com escala métrica configurável (px/metro).

---

### 1. Visão Geral & Conceito Central

- **O que faz**: Transforma o editor de plantas simples em uma estação de trabalho CAD e WMS completa. Permite desenhar o galpão, configurar ruas, gerar baterias de porta-paletes com endereçamento automático, atribuir produtos a posições, medir distâncias reais de corredores de empilhadeiras e localizar qualquer item ou endereço em milissegundos.
- **Público-Alvo**: Gestores de logística, operadores de depósito, engenheiros de instalações e inventariantes que necessitam de clareza espacial e agilidade na localização de estoques.
- **Valor Agregado**: Elimina o tempo perdido procurando endereços em galpões extensos, calcula distâncias exatas entre docas e posições de armazenagem e oferece exportação executiva de mapas operacionais.

---

### 2. Experiência do Usuário & Design Visual

#### A. Estrutura de Layout e Navegação
- **Header Superior (Contrato de 3 Zonas)**:
  - *Zona 1*: Wordmark **MOVARE** com insígnia WMS e seletor rápido de galpão/área ativa.
  - *Zona 2*: Barra de busca rápida global (`Ctrl + K` / `Cmd + K`) para localização imediata de ruas, módulos e SKUs.
  - *Zona 3*: Ações primárias: Alternador Dark/Light (CAD Dark / CAD Blueprint Light), Calibração de Escala Métrica, Exportação e Backup.
- **Barra de Ferramentas CAD (Esquerda / Flutuante)**:
  - Seleção & Manipulação (`V`)
  - Retângulo / Bloco de Área (`R`)
  - Parede / Divisória (`D`)
  - Gerador de Porta-Paletes / Racks WMS (`P`)
  - Fita Métrica & Régua de Distância (`M`)
  - Mão de Pan (`H`)
- **Painel Lateral Contextual (Direita - Retrátil)**:
  - Exibe propriedades do elemento selecionado (dimensões em metros e pixels, cor temática, identificador do endereço).
  - Para Porta-Paletes: Visualizador vertical de níveis (ex: Nível 1 ao 5), capacidade por vão, status de ocupação e produtos alocados.
- **Minimapa Interativo (Canto Inferior Direito)**:
  - Visualização em miniatura de todo o galpão (1200x800) com retângulo de viewport que indica a câmera atual e permite clique para salto rápido.
- **Réguas Métricas & HUD de Coordenadas (Topo e Esquerda do Canvas)**:
  - Mostradores calibrados em metros com marcações precisas de escala dinâmica conforme o nível de zoom.

#### B. Paleta de Cores e Tipografia (CAD Industrial)
- **Tema Escuro (CAD Dark)**:
  - Canvas: Slate ultra-escuro `#0b0f17` com grid sutil de engenharia `#1e293b`.
  - Superfícies/Painéis: `#111827` com bordas sutis `rgba(255, 255, 255, 0.08)`.
  - Acentos Primários: Laranja industrial `#f97316` (atenção operacional) e Âmbar `#eab308`.
  - Posições Ocupadas/Livres: Verde esmeralda `#10b981` (livre/disponível), Azul técnico `#38bdf8` (ocupado).
- **Tema Claro (Blueprint Light)**:
  - Canvas: Gelo técnico `#f8fafc` com grid milimetrado `#e2e8f0`.
  - Superfícies: Branco puro `#ffffff` com bordas de precisão `#cbd5e1`.
- **Tipografia**:
  - *Interface & Títulos*: `Plus Jakarta Sans` para clareza e autoridade técnica.
  - *Endereços WMS, Métricas e Dimensões*: `JetBrains Mono` / `tabular-nums` para alinhamento uniforme de coordenadas e dimensões (`12.50 m`, `A-04-03-2`).

---

### 3. Decisões Técnicas & Arquitetura de Produto

```
┌────────────────────────────────────────────────────────────────────────┐
│                              MOVARE WMS                                │
│               Header: Busca Global WMS · Escala · Tema                 │
├──────────────┬──────────────────────────────────────────┬──────────────┤
│ FERRAMENTAS  │               VIEWPORT CAD               │  INSPEÇÃO    │
│              │ ┌──────────────────────────────────────┐ │              │
│ • Selecionar │ │ Réguas Milimetradas em Metros        │ │ • Detalhes   │
│ • Retângulo  │ │ Grid Infinito com Snap Inteligente   │ │ • Dimensões  │
│ • Divisória  │ │                                      │ │ • Níveis WMS │
│ • Porta-     │ │ [ Porta-Paletes A-01 | A-02 | A-03 ] │ │ • Estoque    │
│   Paletes    │ │ [ Fita Métrica: 14.80 m ]            │ │ • Cor / Tag  │
│ • Medição    │ │                                      │ │              │
│ • Pan / Zoom │ │                    ┌───────────────┐ │ │              │
│              │ │                    │ Minimapa HUD  │ │ │              │
│              │ └────────────────────┴───────────────┘ │ │              │
├──────────────┴──────────────────────────────────────────┴──────────────┤
│ Barra de Status: Escala 1m = 20px · Zoom 125% · Coordenadas X: 450 Y: 220│
└────────────────────────────────────────────────────────────────────────┘
```

#### A. Modelo de Dados Extensível (`editor-model.ts`)
- Suporte a elementos:
  - `rectangle`: Zonas operacionais, docas, escritórios, áreas de staging.
  - `divider`: Paredes, muretas e divisórias.
  - `rack`: Estrutura de armazenagem contendo:
    - `street`: Código da rua (ex: "A", "B", "RUA-01").
    - `modules`: Quantidade de módulos horizontais (ex: 6).
    - `levels`: Quantidade de níveis verticais (ex: 4).
    - `baysPerLevel`: Posições por nível (ex: 2 paletes por vão).
    - `slots`: Mapeamento de posições com SKU, descrição e status de ocupação.
- Configurações de Área:
  - `scaleRatio`: Fator de calibração métrica (ex: 20 pixels por metro).
  - `width` / `height`: Dimensões do armazém.

#### B. Mecanismo de Busca & Destaque
- Modal de busca instantânea com suporte a:
  - Código exato de endereço (ex: `A-02-01-1`).
  - Busca por nome da zona (ex: "Doca 3", "Picking").
  - Busca por produto ou código SKU.
- Ao selecionar um resultado: a câmera anima suavemente para o centro do elemento, aplica zoom adequado e aciona um efeito pulsante de destaque visual (highlight).

#### C. Gerador de Estruturas Porta-Paletes
- Modal interativo com pré-visualização em tempo real:
  - Orientação: Horizontal ou Vertical.
  - Quantidade de módulos e dimensões de vão padronizado (ex: 1,20m x 1,00m de palete PBR).
  - Cálculo automático de numeração contínua ou alternada (par/ímpar) com geração automática de códigos de barras/etiquetas legíveis.

#### D. Ferramenta de Fita Métrica
- Clique e arraste para traçar uma linha temporária de medição entre dois pontos do armazém com:
  - Comprimento euclidiano em metros (`ΔX`, `ΔY` e hipotenusa total).
  - Ângulo e alinhamento com guias magnéticas de 0°, 45° e 90°.
  - Possibilidade de fixar a medição como cota permanente no projeto ou descartar com `Esc`.

---

### 4. Plano de Implementação em Fases

1. **Fase 1: Modelo & Migração de Dados**
   - Atualizar `editor-model.ts` para suportar tipos `rack`, dados WMS de posições e parâmetros de escala métrica, garantindo retrocompatibilidade total com dados existentes.
   - Ajustar `local-store.ts` para serialização de novos metadados.

2. **Fase 2: Motor CAD & Ferramental de Precisão**
   - Implementar cálculo de escala métrica e réguas interativas no topo e lateral do viewport.
   - Criar ferramenta de medição por fita métrica interativa (`tape-measure`).
   - Implementar minimapa funcional com indicador de enquadramento da câmera.

3. **Fase 3: Porta-Paletes WMS & Gerador Paramétrico**
   - Desenhar visualmente os porta-paletes com subdivisões de módulos e níveis.
   - Criar modal de criação assistida de baterias de porta-paletes com endereçamento automático.
   - Criar painel lateral de inspeção multinível (visualizador vertical de prateleiras).

4. **Fase 4: Localizador Global & Busca Rápida (WMS Locator)**
   - Criar barra e modal de busca instantânea (hotkey `Ctrl+K`) com listagem de endereços e produtos.
   - Implementar rotina de centralização suave de câmera com realce pulsante do alvo.

5. **Fase 5: Tema CAD Dark/Light & Acabamento Profissional**
   - Aplicar alternância de tema CAD Industrial Dark e Blueprint Light.
   - Ajustar atalhos de teclado, barra de status inferior de coordenadas e polimento de acessibilidade.
   - Compilação e verificação final.

---

### 6. Atualizações Recentes & Melhorias Contínuas

- **Destaque Permanente de Pesquisa WMS**:
  - Removido o temporizador automático de 3.5s (`setTimeout`) que desativava o destaque. O item localizado permanece em modo destaque até outra interação do usuário.
  - **Isolamento de Navegação pelo Mapa**: Panning com a ferramenta Mão/Visualizar, arrasto no vazio no modo Selecionar (`empty_pan_or_deselect`), zoom pelo scroll do mouse, botões `+`/`-`/`Centralizar`, gestos de pinch em telas de toque e cliques no Minimapa **não cancelam** o destaque nem desfazem a seleção do item pesquisado.
  - **Indicadores Visuais de Alta Visibilidade**:
    1. Anéis de pulso de radar contínuos em SVG sobre a posição/zona encontrada, com adaptação dinâmica de escala vetorial.
    2. Pin flutuante estilizado (📍) com rótulo do código/nome diretamente sobre o item no mapa.
    3. Banner flutuante no topo com atalho "Centralizar" para reenquadrar a câmera no item a qualquer momento e botão "✕" para limpar o destaque.
- **Minimapa Fixo na Parte Superior (Aprimorado)**:
  - Posicionamento fixo no canto superior direito (`top-3 right-3`), integrando em um único painel coeso o mapa do armazém, o nível de zoom em tempo real e os controles (+ / - / Ajustar).
  - **Sincronização em Tempo Real de Navegação e Zoom**: A caixa de enquadramento (viewport frustum) e mira central acompanham fielmente o movimento da câmera (pan) e nível de zoom (scale), mantendo proporções geométricas perfeitas.
  - **Navegação Interativa por Clique e Arrasto Contínuo**: Usuários podem clicar ou arrastar livremente dentro do minimapa para navegar e inspecionar instantaneamente qualquer setor do armazém.
  - **Sinalização do Item Pesquisado**: Itens em destaque na busca exibem um beacon pulsante no próprio minimapa para orientação espacial macro.
  - **Design Discreto e Não Intrusivo**: Modo recolhível em 1 clique (transformando-se em uma pílula ultracompacta com badge de zoom e atalhos), transparência com backdrop blur e redução inteligente de opacidade para 35% durante arrasto de elementos na tela.
- **Tela de Carregamento Lenta com Logotipo Movare**:
  - `MovareSplashScreen`: Apresentação cinematográfica de abertura com o logotipo oficial Movare, halo ambiente luminoso pulsante e progressão gradual e realista (~3.5s) com etapas detalhadas do carregamento do sistema CAD/WMS.
  - Inclui botão de atalho para pular a introdução e transição suave por *fade-out*.
- **Layout de Busca WMS Aprimorado & Botão Flutuante com Lupa**:
  - **Botão Flutuante FAB**: Botão fixado no canvas (`bottom-5 left-4`) com ícone de lupa, badge estilizado e atalho `Ctrl+K` para acesso imediato em qualquer resolução (especialmente no mobile e tablets).
  - **Modal WMS Enriquecido**: Chips de busca rápida para prefixos populares (`GEL`, `FOG`, `COL`, `SOF`, `MÓV`, `RUA`, `DOCAS`), cartões de resultado com destaque de status de estoque, dimensões e categoria, e atalho de teclado `ESC`.
- **Legenda Lateral Fixa de Zonas & Características**:
  - `WarehouseLegendSidebar`: Painel lateral fixo (`left-14 top-16`) fora dos limites da planta, 100% imune a movimentações de câmera, pan ou zoom.
  - Exibe a paleta cromática de cada zona criada com: nome, badge de categoria (com sua respectiva cor), porte de volume (ex: Geladeiras, Sofás, Colchões), dimensões em metros e m², e contagem de posições/ocupação.
  - **Foco Interativo**: Clicar em qualquer item da legenda centraliza suavemente a câmera na respectiva zona e abre os detalhes para inspeção.

