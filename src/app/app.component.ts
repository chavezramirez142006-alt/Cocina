import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Producto {
  idProducto: number;
  nombre: string;
  categoria: string;
  precioBase: number;
  emoji: string;
  descripcion: string;
  badge: string;
  esDisponible: boolean;
}

export interface DetallePedido {
  idDetalle: number;
  idProducto: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  papas: string;
  cremas: string;
  notas: string;
}

export type EstadoPedido = 'ENCOLADO_OFFLINE' | 'RECIBIDO' | 'EN_PREPARACION' | 'LISTO_PARA_ENTREGA' | 'ENTREGADO';

export interface Pedido {
  idPedido: number;
  uuid_offline?: string;
  cliente: string;
  telefono: string;
  tipoEntrega: 'Mesa' | 'Para Llevar' | 'Delivery';
  mesa: string;
  items: DetallePedido[];
  total: number;
  estado: EstadoPedido;
  fechaHora: string;
  timestamp: number;
  origen_offline: boolean;
}

export interface ToastMsg {
  id: number;
  texto: string;
  tipo: 'success' | 'warning' | 'info';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'FastOrder S.A. PWA';

  // Catálogo de Productos según especificación del restaurante
  productos: Producto[] = [
    {
      idProducto: 1,
      nombre: "Combo Mega Burger Doble",
      categoria: "hamburguesas",
      precioBase: 24.50,
      emoji: "🍔",
      descripcion: "Doble carne artesanal de 150g, queso cheddar fundido, tocino crocante, lechuga y salsa de la casa. Incluye papas y bebida.",
      badge: "Más Pedido",
      esDisponible: true
    },
    {
      idProducto: 2,
      nombre: "1/4 Pollo a la Brasa Tradicional",
      categoria: "pollos",
      precioBase: 19.90,
      emoji: "🍗",
      descripcion: "Tradicional 1/4 de pollo a la brasa dorado, crocante, acompañado de papas fritas onduladas y cremas artesanales.",
      badge: "Clásico",
      esDisponible: true
    },
    {
      idProducto: 3,
      nombre: "1/2 Pollo a la Brasa Familiar",
      categoria: "pollos",
      precioBase: 36.00,
      emoji: "🍗",
      descripcion: "Medio pollo a la brasa recién salido del horno, porción generosa de papas familiares y ensalada fresca.",
      badge: "Familiar",
      esDisponible: true
    },
    {
      idProducto: 4,
      nombre: "Crispy Chicken Bacon",
      categoria: "hamburguesas",
      precioBase: 22.00,
      emoji: "🥪",
      descripcion: "Pechuga de pollo súper crocante, queso suizo, tocino ahumado, pepinillos y mayonesa tártara.",
      badge: "Nuevo",
      esDisponible: true
    },
    {
      idProducto: 5,
      nombre: "Salchipapa FastOrder Especial",
      categoria: "combos",
      precioBase: 16.50,
      emoji: "🍟",
      descripcion: "Papas amarillas crocantes, salchicha frankfurter premium, huevo frito montado y cremas.",
      badge: "Especial",
      esDisponible: true
    },
    {
      idProducto: 6,
      nombre: "Chicha Morada Frozen 1L",
      categoria: "bebidas",
      precioBase: 11.00,
      emoji: "🥤",
      descripcion: "Elaborada con maíz morado, piña, membrillo, toques de manzana y canela bien helada.",
      badge: "Artesanal",
      esDisponible: true
    },
    {
      idProducto: 7,
      nombre: "Limonada Frozen Vaso",
      categoria: "bebidas",
      precioBase: 8.50,
      emoji: "🍋",
      descripcion: "Refrescante limonada frapeada al momento con hierbabuena fresca.",
      badge: "Refrescante",
      esDisponible: true
    },
    {
      idProducto: 8,
      nombre: "Inca Kola / Coca Cola 500ml",
      categoria: "bebidas",
      precioBase: 5.50,
      emoji: "🥤",
      descripcion: "Gaseosa helada en botella personal de 500ml.",
      badge: "Personal",
      esDisponible: true
    }
  ];

  // Estado reactivo y de navegación
  isOnline = true;
  currentTab: 'menu' | 'pedidos' | 'kds' = 'menu';
  currentCategory: string = 'todos';

  carrito: DetallePedido[] = [];
  pedidos: Pedido[] = [];
  toasts: ToastMsg[] = [];

  // Modales y PWA Install
  showCustomModal = false;
  showCartModal = false;
  showInstallBanner = false;
  deferredPrompt: any = null;

  // Personalización del producto actual
  productoSeleccionado: Producto | null = null;
  customPapas: string = 'Nativas';
  customCremas: { [key: string]: boolean } = {
    'Mayonesa Casera': true,
    'Ají Pollero': true,
    'Ketchup': true,
    'Tártara': false
  };
  customNotas: string = '';

  // Datos del Cliente (Actor UC)
  clienteNombre: string = 'Carlos Mendoza';
  clienteTelefono: string = '+51987654321';
  tipoEntrega: 'Mesa' | 'Para Llevar' | 'Delivery' = 'Mesa';
  numMesa: string = 'Mesa 5';

  private db: IDBDatabase | null = null;

  ngOnInit(): void {
    this.isOnline = navigator.onLine;
    this.initIndexedDB();
  }

  @HostListener('window:online')
  onOnline(): void {
    this.isOnline = true;
    this.addToast('¡Conexión de red restablecida! Ejecutando Background Sync...', 'success');
    this.sincronizarPedidosPendientes();
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isOnline = false;
    this.addToast('Modo Offline activo. Los pedidos se guardarán en IndexedDB.', 'warning');
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: any): void {
    event.preventDefault();
    this.deferredPrompt = event;
    this.showInstallBanner = true;
  }

  // --- MOTOR INDEXEDDB (FastOrderDB) ---
  initIndexedDB(): void {
    if (!('indexedDB' in window)) return;

    // Versión 2 con 'pedidos_pendientes' según doc técnico del docente
    const request = indexedDB.open('FastOrderDB', 2);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pedidos_pendientes')) {
        const store = db.createObjectStore('pedidos_pendientes', { keyPath: 'idPedido', autoIncrement: true });
        store.createIndex('estado', 'estado', { unique: false });
        store.createIndex('uuid_offline', 'uuid_offline', { unique: true });
      }
      if (!db.objectStoreNames.contains('pedidos_historial')) {
        db.createObjectStore('pedidos_historial', { keyPath: 'idPedido' });
      }
    };

    request.onsuccess = (e: any) => {
      this.db = e.target.result;
      this.cargarPedidosDesdeDB();
    };
  }

  guardarPedidoEnDB(pedido: Pedido): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(pedido.idPedido);
      const storeName = pedido.origen_offline ? 'pedidos_pendientes' : 'pedidos_historial';
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(pedido);
      req.onsuccess = () => resolve(Number(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  actualizarPedidoEnDB(pedido: Pedido): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(['pedidos_pendientes', 'pedidos_historial'], 'readwrite');
      const storeHist = tx.objectStore('pedidos_historial');
      storeHist.put(pedido);

      // Si ya no está offline, remover de pendientes
      if (pedido.estado !== 'ENCOLADO_OFFLINE') {
        const storePend = tx.objectStore('pedidos_pendientes');
        storePend.delete(pedido.idPedido);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  cargarPedidosDesdeDB(): void {
    if (!this.db) return;
    const tx = this.db.transaction(['pedidos_pendientes', 'pedidos_historial'], 'readonly');
    const storePend = tx.objectStore('pedidos_pendientes');
    const storeHist = tx.objectStore('pedidos_historial');

    const reqPend = storePend.getAll();
    const reqHist = storeHist.getAll();

    reqPend.onsuccess = () => {
      reqHist.onsuccess = () => {
        const todos: Pedido[] = [...reqPend.result, ...reqHist.result];
        // Quitar duplicados por idPedido
        const map = new Map<number, Pedido>();
        todos.forEach(p => map.set(p.idPedido, p));
        this.pedidos = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
      };
    };
  }

  // --- SINCRONIZACIÓN FUERA DE LÍNEA (BACKGROUND SYNC) ---
  async sincronizarPedidosPendientes(): Promise<void> {
    if (!this.db) return;
    const pendientes = this.pedidos.filter(p => p.estado === 'ENCOLADO_OFFLINE');
    if (pendientes.length === 0) return;

    for (const pedido of pendientes) {
      await new Promise(r => setTimeout(r, 600)); // Simula latencia de red POST /api/pedidos
      pedido.estado = 'RECIBIDO';
      await this.actualizarPedidoEnDB(pedido);
    }

    this.cargarPedidosDesdeDB();
    this.addToast(`Background Sync: ${pendientes.length} comanda(s) sincronizada(s) con cocina exitosamente.`, 'success');
    this.lanzarNotificacionPush('FastOrder S.A. - Cocina', '¡Tu pedido fue recibido en la pantalla de cocina (KDS)!');
  }

  // --- FILTRADO DE MENÚ ---
  get productosFiltrados(): Producto[] {
    if (this.currentCategory === 'todos') {
      return this.productos;
    }
    return this.productos.filter(p => p.categoria === this.currentCategory);
  }

  filtrarCategoria(cat: string): void {
    this.currentCategory = cat;
  }

  cambiarTab(tab: 'menu' | 'pedidos' | 'kds'): void {
    this.currentTab = tab;
    this.cargarPedidosDesdeDB();
  }

  // --- PERSONALIZACIÓN Y CARRITO ---
  abrirPersonalizacion(prod: Producto): void {
    this.productoSeleccionado = prod;
    this.customPapas = 'Nativas';
    this.customNotas = '';
    this.showCustomModal = true;
  }

  cerrarPersonalizacion(): void {
    this.showCustomModal = false;
  }

  confirmarAgregarCarrito(): void {
    if (!this.productoSeleccionado) return;

    const cremasSeleccionadas = Object.keys(this.customCremas)
      .filter(k => this.customCremas[k])
      .join(', ') || 'Sin cremas';

    const item: DetallePedido = {
      idDetalle: Date.now() + Math.floor(Math.random() * 1000),
      idProducto: this.productoSeleccionado.idProducto,
      nombre: this.productoSeleccionado.nombre,
      precioUnitario: this.productoSeleccionado.precioBase,
      cantidad: 1,
      subtotal: this.productoSeleccionado.precioBase,
      papas: this.customPapas,
      cremas: cremasSeleccionadas,
      notas: this.customNotas.trim()
    };

    this.carrito.push(item);
    this.showCustomModal = false;
    this.addToast(`¡${this.productoSeleccionado.nombre} agregado al carrito!`, 'info');
  }

  abrirCarrito(): void {
    this.showCartModal = true;
  }

  cerrarCarrito(): void {
    this.showCartModal = false;
  }

  modificarCantidad(index: number, delta: number): void {
    this.carrito[index].cantidad += delta;
    this.carrito[index].subtotal = this.carrito[index].precioUnitario * this.carrito[index].cantidad;
    if (this.carrito[index].cantidad <= 0) {
      this.carrito.splice(index, 1);
    }
  }

  get totalItemsCarrito(): number {
    return this.carrito.reduce((sum, item) => sum + item.cantidad, 0);
  }

  get totalMontoCarrito(): number {
    return this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
  }

  // --- REALIZAR PEDIDO (UC04: Realizar Pedido) ---
  async confirmarYEnviarPedido(): Promise<void> {
    if (this.carrito.length === 0) {
      this.addToast('El carrito está vacío.', 'warning');
      return;
    }

    const isOffline = !this.isOnline;
    const nuevoId = 1000 + this.pedidos.length + 1;
    const uuid = isOffline ? (crypto?.randomUUID ? crypto.randomUUID() : `offline-${Date.now()}`) : undefined;

    const nuevoPedido: Pedido = {
      idPedido: nuevoId,
      uuid_offline: uuid,
      cliente: this.clienteNombre || 'Cliente',
      telefono: this.clienteTelefono || '+51987654321',
      tipoEntrega: this.tipoEntrega,
      mesa: this.numMesa,
      items: [...this.carrito],
      total: this.totalMontoCarrito,
      estado: isOffline ? 'ENCOLADO_OFFLINE' : 'RECIBIDO',
      fechaHora: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      origen_offline: isOffline
    };

    await this.guardarPedidoEnDB(nuevoPedido);

    this.carrito = [];
    this.showCartModal = false;
    this.cargarPedidosDesdeDB();

    if (!isOffline) {
      this.addToast(`¡Pedido #${nuevoPedido.idPedido} enviado a la cocina en tiempo real!`, 'success');
      this.lanzarNotificacionPush(
        'FastOrder Cocina - ¡Pedido Recibido!',
        `Hola ${nuevoPedido.cliente}, tu orden #${nuevoPedido.idPedido} fue recibida en la pantalla de cocina.`
      );
    } else {
      this.addToast(`¡Pedido #${nuevoPedido.idPedido} encolado en IndexedDB! Se sincronizará al volver la señal.`, 'warning');
      // Registro de Background Sync
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg: any) => {
          reg.sync.register('sync-pedidos-pending');
        });
      }
    }

    this.cambiarTab('pedidos');
  }

  // --- PANTALLA KDS COCINA (UC07 y UC08) ---
  async cambiarEstadoCocina(pedido: Pedido, nuevoEstado: EstadoPedido): Promise<void> {
    pedido.estado = nuevoEstado;
    await this.actualizarPedidoEnDB(pedido);
    this.cargarPedidosDesdeDB();

    if (nuevoEstado === 'EN_PREPARACION') {
      this.addToast(`Cocina KDS: Pedido #${pedido.idPedido} puesto en preparación.`, 'info');
      this.lanzarNotificacionPush(
        `👨‍🍳 Pedido #${pedido.idPedido} en preparación`,
        `Tu orden está en la plancha. Tiempo estimado: 8-10 minutos.`
      );
    } else if (nuevoEstado === 'LISTO_PARA_ENTREGA') {
      this.addToast(`🎉 ¡Pedido #${pedido.idPedido} listo para entrega!`, 'success');
      this.lanzarNotificacionPush(
        `🍽️ ¡Tu Pedido #${pedido.idPedido} está LISTO!`,
        `Por favor acércate al mostrador o tu mesero te lo llevará a la ${pedido.mesa}.`
      );
    } else if (nuevoEstado === 'ENTREGADO') {
      this.addToast(`Pedido #${pedido.idPedido} marcado como entregado.`, 'success');
    }
  }

  solicitarPermisoNotificaciones(): void {
    if (!('Notification' in window)) {
      this.addToast('Tu navegador no soporta Notificaciones Web.', 'warning');
      return;
    }

    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        this.addToast('¡Permiso de notificaciones concedido exitosamente!', 'success');
        this.lanzarNotificacionPush('FastOrder Notificaciones', '¡Recibirás alertas en tiempo real sobre cada estado de tu comida!');
      } else {
        this.addToast('Permiso de notificaciones denegado.', 'warning');
      }
    });
  }

  lanzarNotificacionPush(titulo: string, cuerpo: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(titulo, {
            body: cuerpo,
            icon: 'assets/icons/icon-192x192.png',
            badge: 'assets/icons/icon-192x192.png'
          });
        });
      } else {
        new Notification(titulo, { body: cuerpo });
      }
    }
  }

  instalarPWA(): void {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          this.addToast('¡FastOrder instalada en tu pantalla de inicio!', 'success');
          this.showInstallBanner = false;
        }
        this.deferredPrompt = null;
      });
    } else {
      this.addToast('Usa la opción "Agregar a la pantalla principal" en el menú de tu navegador.', 'info');
    }
  }

  // --- SISTEMA TOAST ---
  addToast(texto: string, tipo: 'success' | 'warning' | 'info'): void {
    const toast: ToastMsg = { id: Date.now() + Math.random(), texto, tipo };
    this.toasts.push(toast);
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
    }, 3500);
  }
}
