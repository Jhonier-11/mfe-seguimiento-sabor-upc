// Micro frontend: SEGUIMIENTO DE PEDIDOS  (equipo "Logística") — Vue 3 desde CDN, sin compilación
// Contrato: window.renderSeguimiento(idContenedor) / window.unmountSeguimiento(idContenedor)
// Escucha:  'pedido:confirmado'  { version: 1, id, items, total, fecha }  (canal, opcional)
// Publica:  'pedido:estado'      { version: 1, id, estado, anterior }
(function () {
  const VERSION = '1.0.0';
  const VUE_VERSION = '3.5.13';
  const VUE_URL = 'https://unpkg.com/vue@' + VUE_VERSION + '/dist/vue.esm-browser.prod.js';
  const ESTADOS = ['Recibido', 'En preparación', 'En camino', 'Entregado'];
  // Intervalo entre estados. Se puede cambiar con data-intervalo-ms en la etiqueta <script>
  // (lo usan las pruebas de contrato); si no se indica, 6 segundos.
  const script = document.currentScript;
  const INTERVALO_MS = Number(script && script.dataset.intervaloMs) || 6000;

  const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  const CSS = `
    .seg-titulo { margin: 0 0 10px; color: var(--upc-color-primario, #12432b); font-family: var(--upc-fuente-display, 'Fraunces', Georgia, serif); font-size: clamp(32px, 5vw, 48px); font-weight: 700; letter-spacing: -.02em; line-height: 1.05; }
    .seg-version { display: inline-flex; align-items: center; gap: 7px; font-family: var(--upc-fuente-mono, 'IBM Plex Mono', Consolas, monospace); font-size: 12px; line-height: 1; color: var(--upc-color-texto-tenue, #5f6a58); background: var(--upc-color-primario-suave, #e3efe4); padding: 6px 11px; border-radius: 999px; }
    .seg-version::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--upc-color-exito, #2f8f4e); }
    .seg-vacio, .seg-error { margin: var(--upc-espacio-4, 24px) 0 0; padding: 44px 16px; border: 2px dashed var(--upc-color-borde-input, #cdbf9c); border-radius: var(--upc-radio-2, 14px); color: var(--upc-color-texto-suave, #4a5848); font-style: italic; text-align: center; }
    .seg-error { border: 1px solid rgba(184, 67, 43, .35); border-left: 6px solid var(--upc-color-peligro, #b8432b); border-radius: var(--upc-radio-1, 8px); background: var(--upc-color-peligro-fondo, #f9e6dd); color: var(--upc-color-peligro-texto, #8f2f1c); font-style: normal; text-align: left; padding: 18px 20px; }
    .seg-pedido { position: relative; margin-top: 22px; padding: 22px 26px 26px; background: var(--upc-color-superficie, #fffcf3); border: 1px solid var(--upc-color-borde, #e3d9bd); border-radius: var(--upc-radio-2, 14px); box-shadow: var(--upc-sombra-1, 0 1px 2px rgba(18, 67, 43, .08), 0 8px 18px -10px rgba(18, 67, 43, .22)); animation: seg-llega .5s cubic-bezier(.2, .8, .2, 1); }
    @keyframes seg-llega { from { opacity: 0; transform: translateY(-10px); } }
    .seg-cabecera { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .seg-cabecera b { color: var(--upc-color-primario, #12432b); font-family: var(--upc-fuente-display, 'Fraunces', Georgia, serif); font-size: 26px; font-weight: 700; }
    .seg-cabecera span { font-family: var(--upc-fuente-mono, 'IBM Plex Mono', Consolas, monospace); font-size: 18px; font-weight: 500; }
    .seg-meta { margin: 4px 0 14px; color: var(--upc-color-texto-tenue, #5f6a58); font-family: var(--upc-fuente-mono, 'IBM Plex Mono', Consolas, monospace); font-size: 12px; }
    .seg-items { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 26px; padding: 0; list-style: none; }
    .seg-items li { padding: 4px 13px; border: 1px solid var(--upc-color-borde, #e3d9bd); border-radius: 999px; background: var(--upc-color-fondo, #f4eedd); font-size: 13px; }
    .seg-pasos { display: flex; margin: 0; padding: 0; list-style: none; counter-reset: paso; }
    .seg-pasos li { position: relative; flex: 1; padding-top: 44px; color: var(--upc-color-texto-tenue, #5f6a58); font-size: 13px; text-align: center; counter-increment: paso; }
    .seg-pasos li::before { content: counter(paso); position: absolute; top: 0; left: 50%; z-index: 1; display: grid; place-items: center; width: 32px; height: 32px; margin-left: -16px; border: 2px solid var(--upc-color-borde-input, #cdbf9c); border-radius: 50%; background: var(--upc-color-superficie, #fffcf3); color: var(--upc-color-texto-tenue, #5f6a58); font-family: var(--upc-fuente-mono, 'IBM Plex Mono', Consolas, monospace); font-size: 13px; font-weight: 500; }
    .seg-pasos li::after { content: ''; position: absolute; top: 15px; left: calc(50% + 18px); right: calc(-50% + 18px); height: 2px; background: var(--upc-color-borde-input, #cdbf9c); }
    .seg-pasos li:last-child::after { display: none; }
    .seg-pasos li.seg-hecho { color: var(--upc-color-exito-oscuro, #1b6b3a); }
    .seg-pasos li.seg-hecho::before { content: '✓'; border-color: var(--upc-color-exito, #2f8f4e); background: var(--upc-color-exito, #2f8f4e); color: var(--upc-color-sobre-primario, #fbf5e6); }
    .seg-pasos li.seg-hecho::after { background: var(--upc-color-exito, #2f8f4e); }
    .seg-pasos li.seg-actual { color: var(--upc-color-texto, #1c2b21); font-weight: 700; }
    .seg-pasos li.seg-actual::before { border-color: var(--upc-color-acento, #f2b632); background: var(--upc-color-acento, #f2b632); color: var(--upc-color-texto, #1c2b21); animation: seg-latido 1.7s ease-out infinite; }
    .seg-pasos li.seg-actual:last-child { color: var(--upc-color-exito-oscuro, #1b6b3a); }
    .seg-pasos li.seg-actual:last-child::before { content: '✓'; border-color: var(--upc-color-exito, #2f8f4e); background: var(--upc-color-exito, #2f8f4e); color: var(--upc-color-sobre-primario, #fbf5e6); animation: none; }
    @keyframes seg-latido { 0% { box-shadow: 0 0 0 0 rgba(242, 182, 50, .6); } 70%, 100% { box-shadow: 0 0 0 13px rgba(242, 182, 50, 0); } }
    @media (max-width: 560px) { .seg-pasos li { font-size: 11px; } .seg-pedido { padding: 18px 16px 22px; } }
  `;

  const PLANTILLA = `
    <h2 class="seg-titulo">Seguimiento de pedidos</h2>
    <span class="seg-version">mfe-seguimiento v{{ version }} · Vue {{ vueVersion }}</span>
    <p v-if="lista.length === 0" class="seg-vacio">Aún no hay pedidos. Confirma uno desde el carrito.</p>
    <article v-for="p in lista" :key="p.id" class="seg-pedido">
      <div class="seg-cabecera"><b>Pedido #{{ p.id }}</b><span>{{ pesos(p.total) }}</span></div>
      <div class="seg-meta">{{ hora(p.fecha) }}<template v-if="p.canal"> · canal: {{ p.canal }}</template></div>
      <ul class="seg-items"><li v-for="it in p.items" :key="it.id">{{ it.cantidad }} × {{ it.nombre }}</li></ul>
      <ol class="seg-pasos">
        <li v-for="(e, i) in estados" :key="e" :class="{ 'seg-hecho': i < indice(p), 'seg-actual': i === indice(p) }">{{ e }}</li>
      </ol>
    </article>`;

  function asegurarEstilos() {
    if (document.getElementById('seg-estilos')) return;
    const style = document.createElement('style');
    style.id = 'seg-estilos';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ---- Estado y temporizadores a NIVEL DE MÓDULO (no dentro de lo que se monta/desmonta):
  // los pedidos siguen avanzando y no se pierden eventos aunque el MFE no esté en pantalla.
  const pedidos = [];            // más reciente primero
  const oyentes = new Set();     // vistas montadas que quieren enterarse de los cambios

  function instantanea() {
    return pedidos.map(p => ({
      id: p.id, estado: p.estado, total: p.total, fecha: p.fecha, canal: p.canal,
      items: p.items.map(it => ({ id: it.id, nombre: it.nombre, cantidad: it.cantidad }))
    }));
  }

  function avisar() {
    oyentes.forEach(function (f) { f(); });
  }

  function publicarEstado(pedido, anterior) {
    window.dispatchEvent(new CustomEvent('pedido:estado', {
      detail: { version: 1, id: pedido.id, estado: pedido.estado, anterior: anterior }
    }));
  }

  function avanzar(pedido) {
    const anterior = pedido.estado;
    pedido.estado = ESTADOS[ESTADOS.indexOf(anterior) + 1];
    if (pedido.estado === ESTADOS[ESTADOS.length - 1]) clearInterval(pedido.temporizador);
    publicarEstado(pedido, anterior);
    avisar();
  }

  // Lector tolerante: solo entiende la versión 1 y ignora los campos que no conoce
  // (así un campo opcional nuevo, como "canal", no rompe a este consumidor).
  window.addEventListener('pedido:confirmado', function (e) {
    const d = e.detail;
    if (!d || d.version !== 1 || d.id == null || pedidos.some(p => p.id === d.id)) return;
    const pedido = {
      id: d.id,
      items: Array.isArray(d.items) ? d.items : [],
      total: Number(d.total) || 0,
      fecha: d.fecha,
      canal: d.canal,
      estado: ESTADOS[0],
      temporizador: null
    };
    pedidos.unshift(pedido);
    publicarEstado(pedido, null);
    pedido.temporizador = setInterval(function () { avanzar(pedido); }, INTERVALO_MS);
    avisar();
  });

  // ---- Vue: se descarga la primera vez que se monta. Como módulo ES no crea globales.
  let cargaVue = null;
  function cargarVue() {
    if (!cargaVue) {
      cargaVue = import(VUE_URL).catch(function (err) {
        cargaVue = null;       // permite reintentar en el próximo montaje
        throw err;
      });
    }
    return cargaVue;
  }

  let app = null;
  let turno = 0;               // descarta montajes que terminan después de un desmontaje

  window.renderSeguimiento = async function (idContenedor) {
    asegurarEstilos();
    const miTurno = ++turno;
    const raiz = document.getElementById(idContenedor);
    raiz.innerHTML = '<p class="seg-vacio">Cargando seguimiento…</p>';
    let Vue;
    try {
      Vue = await cargarVue();
    } catch (err) {
      if (miTurno === turno) {
        raiz.innerHTML = '<p class="seg-error">No se pudo cargar Vue desde el CDN. Vuelve a entrar a esta sección para reintentar.</p>';
      }
      return;
    }
    if (miTurno !== turno) return;

    app = Vue.createApp({
      template: PLANTILLA,
      setup() {
        const lista = Vue.ref(instantanea());
        const actualizar = function () { lista.value = instantanea(); };
        oyentes.add(actualizar);
        Vue.onUnmounted(function () { oyentes.delete(actualizar); });
        return {
          lista: lista,
          estados: ESTADOS,
          version: VERSION,
          vueVersion: Vue.version,
          pesos: function (n) { return pesos.format(n); },
          hora: function (f) {
            const d = new Date(f);
            return isNaN(d) ? '' : d.toLocaleTimeString('es-CO');
          },
          indice: function (p) { return ESTADOS.indexOf(p.estado); }
        };
      }
    });
    app.mount(raiz);
  };

  window.unmountSeguimiento = function (idContenedor) {
    turno++;
    if (app) {
      app.unmount();
      app = null;
    }
    document.getElementById(idContenedor).innerHTML = '';
  };
})();
