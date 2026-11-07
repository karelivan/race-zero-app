# AERO-X 99: Hyper-Velocity Antigravity Racing PWA

Un juego de carreras antigravedad en formato Progressive Web App (PWA) que recrea la velocidad vertiginosa, la perspectiva pseudo-3D (*Mode 7*) y la tensión táctica de los clásicos de 16 bits, ejecutándose de forma instantánea en el navegador mediante un motor matemático puro en HTML5 Canvas 2D y audio sintetizado en tiempo real, con identidad visual, vehículos y banda sonora 100% originales.

### User Review & Critical Decisions

> [!IMPORTANT]
> Se han incorporado tus respuestas de la fase de clarificación para definir el alcance funcional y técnico del juego. Revisa las decisiones confirmadas antes de iniciar la construcción.

- **Decisión Confirmada 1 — Modos de Juego**: **Campeonato Grand Prix (con IA) y Modo Contrarreloj (Time Trial)**. Incluye una copa de 3 circuitos distintos contra pilotos de IA competitivos con tabla de puntos acumulados, además de modo Contrarreloj con fantasmas y récords locales por vuelta.
- **Decisión Confirmada 2 — Mecánicas en Pista**: **Sistema de Energía Dual (Escudo + Turbo), Zonas de Recarga y Rampas de Salto**. La barra de energía actúa simultáneamente como escudo frente a colisiones y como combustible para activar el *Hyper-Boost*, obligando a gestionar el riesgo en cada vuelta y aprovechar los carriles de recarga (*Pit Lanes*) y las plataformas de salto magnético.
- **Decisión Confirmada 3 — Esquema de Controles y PWA**: **Soporte Universal (Teclado, Gamepad API y Controles Táctiles en Pantalla)**. Detección automática de mandos físicos, controles de teclado de baja latencia (incluyendo inclinación lateral *Strafe* L/R para tomar curvas cerradas) y botonera táctil ergonómica en el tercio inferior para móviles y tablets, con instalación PWA directa desde la interfaz y funcionamiento 100% offline.
- **Garantía de Propiedad Intelectual Original**: Cero uso de nombres, logotipos, diseños de naves, trazados o composiciones musicales de franquicias existentes. Todo el universo (*Liga AERO-X 2199*), las 4 escuderías originales y el sintetizador FM/Chiptune en Web Audio API son creaciones originales libres de derechos.

---

### 1. Overview & Core Concept

- **Qué Hace**: Ofrece una experiencia arcade de carreras futuristas a 60 FPS constantes donde el jugador elige entre 4 naves antigravedad originales con distintas curvas de aceleración, velocidad punta, agarre magnético y blindaje, compitiendo a través de circuitos suspendidos sobre megaciudades, cañones solares y mares de metano.
- **Audiencia y Contexto**: Jugadores entusiastas del *retro-arcade* de 16 bits que buscan una experiencia inmediata, sin pantallas de carga pesadas, instalable como aplicación nativa tanto en escritorio como en dispositivos móviles, incluso sin conexión a internet.
- **Valor Principal**: Carga instantánea (< 50ms de inicialización del motor) al prescindir de motores 3D pesados (como Three.js o Unity WebGL) y archivos de audio/texturas externos, generando tanto los gráficos pseudo-3D como la música *synth-rock* de 16 bits de forma procedural en el cliente.

---

### 2. User Experience & Visual Design

- **Flujos de Usuario Clave**:
  1. **Pantalla de Título y Cabina Principal (`TITLE_MENU`)**: Presentación con horizonte *Mode 7* animado en vivo en el fondo, selector de modo (*Grand Prix*, *Contrarreloj*, *Práctica*), botón de instalación de PWA integrado en la barra superior y control de audio.
  2. **Hangar de Selección de Nave y Circuito (`GARAGE_SELECT`)**: Comparativa visual e interactiva de las 4 naves originales (*Valkyrie V-01*, *Titan Heavy Industries*, *Spectre Phantom*, *Solaris Apex*) mostrando sus estadísticas con tipografía tabular y previsualización del trazado de los 3 circuitos (*Neo-Veridia Loop*, *Helios Canyon*, *Cryo-Sector Zero*).
  3. **Vista de Carrera Activa (`PLAYING`)**: Lienzo a pantalla completa con semáforo de salida sincronizado con audio, HUD táctica en la zona superior (Velocímetro digital en km/h, Barra de Energía/Turbo con umbral crítico, Contador de Vuelta, Cronómetro al milisegundo y Posición en carrera), minimapa vectorial del circuito y controles táctiles adaptativos.
  4. **Pausa y Resumen de Carrera (`PAUSED` / `ROUND_SUMMARY` / `GAME_OVER`)**: Modal de resultados al cruzar la meta (o si la nave explota por agotamiento de energía), desglose de tiempos por vuelta, clasificación del campeonato y reinicio instantáneo sin recargar la página.

- **Identidad Visual y Tema**:
  - *Dirección Estética*: **Arcade Industrial de 16-Bits & Telemetría de Cabina**. Estética limpia, nítida y de alto contraste inspirada en consolas de principios de los 90 combinada con instrumentación aeronáutica moderna.
  - *Paleta de Colores y Regla 60-30-10*:
    - **60% Lienzo Dominante (`--background`)**: Pizarra espacial profunda (`#0B0F19`) y asfalto magnético oscuro (`#111827`) que maximizan el contraste de la pista y reducen la fatiga visual.
    - **30% Superficies Estructurales (`--surface`)**: Paneles de cabina en gris titanio (`#1E293B`) con bordes de línea fina (`#334155`) y texto primario blanco nítido (`#F8FAFC`).
    - **10% Acento de Alta Intención (`--accent`)**: Ámbar de postcombustión (`#F59E0B`) para acciones principales y turbo activo, Esmeralda de recarga (`#10B981`) para zonas de *Pit Stop*, y Carmesí de alerta (`#EF4444`) acompañado de etiqueta textual (`CRITICAL POWER`) cuando el escudo baja del 20%.
  - *Tipografía y Jerarquía (Regla 2+1)*:
    - **Display / Titulares**: `Barlow Condensed` (o `Oswald`) en pesos SemiBold/Bold para títulos de velocidad, nombres de circuitos y conteo de salida.
    - **Cuerpo / Interfaz**: `Plus Jakarta Sans` para menús, descripciones de naves y controles claros en una sola línea (`whitespace-nowrap`).
    - **Telemetría y Cronómetros**: `JetBrains Mono` con `tabular-nums` obligatorio para velocímetro (km/h), tiempos de vuelta (`01:24.850`) y tabla de posiciones sin saltos horizontales de dígitos.
  - *Composición Espacial y Ergonomía*:
    - En escritorio (1440px), diseño panorámico inmersivo con barra superior limpia bajo el contrato de 3 zonas (Marca `AERO-X 99`, navegación de vistas y botón de acción primaria / instalar PWA).
    - En pantallas táctiles, zonas de toque de al menos `48x48px` ubicadas en el 40% inferior de la pantalla (zona natural de los pulgares): cruceta/deslizador de dirección a la izquierda y pedales de Aceleración, Freno/Derape (*Strafe*) y *Hyper-Boost* a la derecha.

- **Feedback Interactivo y Movimiento**:
  - Inclinación dinámica del horizonte y de los *sprites* vectoriales de la nave al girar o activar los propulsores laterales (*Strafe*).
  - Efecto de líneas de velocidad periféricas, destello de postcombustión y vibración sutil de cámara al activar el *Hyper-Boost* o aterrizar desde una rampa de salto.
  - Chispas procedimentales y empuje físico al rozar los bordes electrificados de la pista o chocar contra otras naves.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Motor de Renderizado Pseudo-3D (*Scanline & Segment Projection*) en HTML5 Canvas 2D**
  - *Enfoque Elegido*: Proyección matemática de segmentos de pista curvos y perspectiva de suelo estilo *Mode 7* sobre un único `<canvas>` 2D acelerado por hardware.
  - *Por Qué*: Garantiza un peso de aplicación mínimo, arranque instantáneo en cualquier móvil o PC, cero compilación de *shaders* pesados y fidelidad auténtica a la estética de 16 bits.
  - *Alternativas Descartadas*: Motores 3D completos (Three.js / Babylon.js) que incrementan el tamaño del paquete, consumen más batería en móviles y pierden el carácter visual del escalado matricial clásico de SNES.

- **Decisión 2: Sintetizador de Audio Procedural (Web Audio API) y Sprites Vectoriales/Pixel-Art en Memoria**
  - *Enfoque Elegido*: Generación en tiempo real del rugido antigravitacional del motor (modulado según las RPM y velocidad), efectos de choque, recarga de energía y música *chiptune* original mediante osciladores (`Sawtooth`, `Square`, `Triangle`) y filtros paso-bajo de la Web Audio API.
  - *Por Qué*: Evita descargas de archivos MP3/WAV pesados, funciona 100% offline desde el primer segundo, elimina la latencia de audio y asegura 0% de riesgo de derechos de autor.

- **Decisión 3: Arquitectura PWA Offline-First con `vite-plugin-pwa` y Persistencia en `localStorage`**
  - *Enfoque Elegido*: Service Worker con precarga completa de activos (`autoUpdate`), manifiesto web estandarizado con iconos dedicados (`any` y `maskable`), botón de instalación integrado en la UI (`usePWAInstall`) e indicador de estado offline, guardando récords de pista, desbloqueos y fantasmas de Contrarreloj en `localStorage`.
  - *Por Qué*: Permite instalar el juego en la pantalla de inicio de Android, iOS y escritorio y jugarlo en modo avión sin depender de servidores externos.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Diagrama de Arquitectura y Componentes**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        AERO-X 99 APPLICATION SHELL                       │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ Top Bar Contract   │  │ PWA Install Manager  │  │ Offline Status   │  │
│  │ (Brand/Nav/Action) │  │ (beforeinstallprompt)│  │ Indicator        │  │
│  └─────────┬──────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
└────────────┼────────────────────────┼───────────────────────┼────────────┘
             │                        ▼                       │
┌────────────▼────────────────────────────────────────────────▼────────────┐
│                         GAME STATE MACHINECONTROLLER                     │
│      [TITLE_MENU] ──► [GARAGE_SELECT] ──► [PLAYING] ◄──► [PAUSED]        │
│                              ▲                │                          │
│                              └── [SUMMARY / GAME_OVER] ◄─────────────────┘
└────────────┬─────────────────────────────────┬───────────────────────────┘
             │                                 │
   ┌─────────▼──────────┐            ┌─────────▼──────────────────────────┐
   │ MENU & GARAGE UI   │            │ ACTIVE RACE VIEWPORT               │
   │ ├─ Craft Selector  │            │ ├─ HTML5 Mode-7 Canvas Renderer    │
   │ ├─ Track Selector  │            │ ├─ Cockpit HUD Overlay (Tabular)   │
   │ └─ Records Table   │            │ ├─ Minimap Radar Canvas            │
   └─────────┬──────────┘            │ └─ Touch Controls Overlay (Mobile) │
             │                       └─────────┬──────────────────────────┘
             │                                 │
┌────────────▼─────────────────────────────────▼───────────────────────────┐
│                     CORE RACING & SYNTHESIS ENGINES                      │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ Physics & Track    │  │ AI Pilots & Ghost    │  │ Web Audio Synth  │  │
│  │ Projection Engine  │  │ Recorder System      │  │ (SFX + Chiptune) │  │
│  └─────────┬──────────┘  └──────────┬───────────┘  └──────────────────┘  │
│            └──────────────┬─────────┘                                    │
│                 ┌─────────▼──────────┐                                   │
│                 │ LocalStorage Store │ (Best Laps, GP Cups, Settings)    │
│                 └────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Modelo de Datos y Estado**:
  - `CraftSpec`: Identificador, nombre original, escudería, paleta de colores, velocidad máxima (`maxSpeed`), aceleración (`accel`), agarre magnético (`grip`), masa/blindaje (`shieldStrength`) y potencia de impulso (`boostPower`).
  - `TrackSegment`: Índice Z, curvatura horizontal (`curve`), elevación/rampa (`pitch`), tipo de superficie (`NORMAL`, `RECHARGE_PIT`, `JUMP_PAD`, `BOOST_PAD`, `ROUGH_BORDER`), y objetos decorativos laterales (pilares de neón, arcos de meta, balizas).
  - `RaceState`: Estado actual (`COUNTDOWN`, `RACING`, `FINISHED`, `CRASHED`), vuelta actual (`1..3`), tiempos por vuelta, energía del jugador (`0..100`), estado de *Turbo* restante, altura de salto (`yOffset`, `yVelocity`), velocidad lateral de *Strafe* y lista de competidores (posición Z, desplazamiento X, velocidad actual e IA).
  - `PersistenceStore`: Récords históricos por pista (mejor tiempo total, mejor vuelta rápida, nave utilizada y puntos de ruta del fantasma en Contrarreloj) y trofeos obtenidos en el modo Grand Prix.

- **Mapeo de Componentes Interactivos y Transiciones de Estado**:
  - **Navegación Superior y Modal de Ayuda/Controles**: Cambia entre la vista de Carrera/Menú, el Hangar de Naves, la Tabla de Récords y el panel de Configuración de Controles/Audio. Incluye el botón `Instalar App` (con guía interactiva para iOS Safari y disparo nativo en Chromium/Android).
  - **Selector de Nave y Circuito (`GARAGE_SELECT`)**: Permite alternar entre las 4 naves y los 3 circuitos o la Copa Grand Prix completa, actualizando en tiempo real las barras comparativas de estadísticas y los récords almacenados para ese circuito antes de pulsar `Iniciar Carrera`.
  - **Bucle de Simulación y Controles (`requestAnimationFrame`)**:
    - Unifica las entradas de Teclado (`Flechas/WASD` para dirección y aceleración, `Q/E` o `Z/X` para inclinación lateral *Strafe*, `Espacio/Shift` para *Hyper-Boost*), `navigator.getGamepads()` y eventos `onPointerDown/Up` de los botones táctiles.
    - Calcula fuerzas centrífugas en curvas (obligando a usar el *Strafe* para no derrapar hacia los bordes electrificados), detecta colisiones con los bordes (reduciendo energía y aplicando rebote físico), recarga energía al pasar sobre franjas esmeralda (`RECHARGE_PIT`) y proyecta el vuelo parabólico al pisar rampas (`JUMP_PAD`).
  - **Condiciones de Fin de Carrera y Recuperación**:
    - Si la energía llega a `0`, se activa la secuencia de destrucción de la nave con partículas vectoriales y transición a `GAME_OVER` con botón directo de `Reintentar Circuito`.
    - Al completar las 3 vueltas, registra automáticamente nuevos récords en `localStorage`, calcula los puntos de clasificación si está en modo *Grand Prix* y permite avanzar al siguiente circuito de la copa.
