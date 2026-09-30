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
    .seg-titulo { color: var(--upc-color-primario, #0b4f8a); margin: 0 0 4px; }
    .seg-version { font-size: 12px; color: var(--upc-color-texto-tenue, #888); }
    .seg-vacio, .seg-error { margin: var(--upc-espacio-3, 16px) 0; color: var(--upc-color-texto-suave, #777); }
    .seg-error { background: var(--upc-color-peligro-fondo, #fdecea); color: var(--upc-color-peligro-texto, #a12a1e); padding: var(--upc-espacio-3, 16px); border-radius: var(--upc-radio-1, 4px); }
    .seg-pedido { background: var(--upc-color-superficie, #fff); border: 1px solid var(--upc-color-borde, #dde3ea); border-radius: var(--upc-radio-2, 6px); padding: var(--upc-espacio-3, 16px); margin-top: var(--upc-espacio-3, 16px); }
    .seg-cabecera { display: flex; justify-content: space-between; font-size: 17px; }
    .seg-meta { font-size: 12px; color: var(--upc-color-texto-tenue, #888); margin: 2px 0 8px; }
    .seg-items { margin: 0 0 12px; padding-left: 20px; }
    .seg-pasos { display: flex; gap: var(--upc-espacio-2, 8px); list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
    .seg-pasos li { padding: 4px 10px; border-radius: 12px; font-size: 13px; background: var(--upc-color-fondo, #f4f6f8); color: var(--upc-color-texto-tenue, #888); }
    .seg-pasos li.seg-hecho { background: var(--upc-color-exito-fondo, #eaf6ea); color: var(--upc-color-exito-oscuro, #1b7a3e); }
    .seg-pasos li.seg-actual { background: var(--upc-color-exito-oscuro, #1b7a3e); color: var(--upc-color-sobre-primario, #fff); font-weight: bold; }
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
