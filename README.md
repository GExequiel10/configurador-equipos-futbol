# ⚽ FútbolApp – Organizador de Partidos

Aplicación web 100% offline para organizar partidos de fútbol entre amigos. Armá equipos equilibrados, gestioná jugadores, calculá gastos y llevá un historial de partidos. Sin backend, sin registro, sin internet requerido.

---

## 📸 Funcionalidades

- 👥 **Gestión de jugadores** – Agregá, eliminá y asignales un nivel del 1 al 5
- ⚽ **Equipos equilibrados** – Algoritmo greedy que distribuye jugadores según nivel
- 📍 **Datos del partido** – Guardá lugar, fecha, hora y notas
- 💰 **Calculadora de gastos** – Dividí el costo entre los que pagan (con opción de excluir)
- 📋 **Historial** – Guardá los resultados de cada partido
- 📲 **Compartir por WhatsApp** – Copiá equipos, info o gastos con un toque
- 📤📥 **Exportar / Importar** – Guardá y cargá listas de jugadores en JSON
- 🔀 **Re-mezclar equipos** – Generá nuevas combinaciones sin perder a los jugadores
- ✏️ **Modo edición manual** – Mové jugadores entre equipos manualmente

---

## 📁 Estructura de archivos

```
futbolapp/
├── index.html      # Estructura HTML de la app
├── styles.css      # Estilos (modo oscuro, responsive)
├── app.js          # Toda la lógica de la aplicación
└── README.md       # Esta documentación
```

---

## 🚀 Cómo usar la app

### Abrir localmente

1. Descargá o cloná los archivos en una carpeta
2. Abrí `index.html` directamente en tu navegador (Chrome, Firefox, Edge, Safari)
3. No necesitás servidor ni conexión a internet

### Flujo de uso típico

#### 1. Agregar jugadores

- Ve a la pestaña **Jugadores**
- Escribí el nombre del jugador en el campo de texto
- Seleccioná su nivel del **1 al 5** usando los botones:
  - **1** – Principiante
  - **2** – Regular
  - **3** – Bueno (nivel por defecto)
  - **4** – Muy bueno
  - **5** – Crack ⚡
- Presioná **Agregar Jugador** o la tecla **Enter**

#### 2. Cargar datos del partido

- Ve a la pestaña **Partido**
- Completá el lugar, fecha y hora
- Agregá notas si querés (tipo de cancha, qué traer, etc.)
- Los datos se guardan automáticamente

#### 3. Generar equipos

- Ve a la pestaña **Equipos**
- Activá o desactivá "Equilibrar por nivel" según prefieras
- Presioná **⚽ Generar Equipos**
- Podés presionar **🔀 Mezclar de nuevo** para obtener otra combinación
- Activá **Modo edición manual** para mover jugadores entre equipos

#### 4. Calcular gastos

- Ve a la pestaña **Gastos**
- Ingresá el costo total del partido
- Seleccioná la moneda (ARS / EUR / USD)
- Destildá a los jugadores que no pagan (ej: el arquero invitado)
- La división se calcula automáticamente

#### 5. Guardar en el historial

- Ve a la pestaña **Historial**
- Ingresá el resultado (goles de cada equipo)
- Presioná **💾 Guardar en Historial**

---

## 🌐 Cómo subir a GitHub Pages paso a paso

### Requisitos previos

- Tener una cuenta en [GitHub](https://github.com)
- Tener [Git](https://git-scm.com) instalado (opcional, podés usar la web)

### Opción A: Desde la interfaz web de GitHub (sin Git)

1. **Crear un repositorio nuevo**
   - Entrá a [github.com](https://github.com) y hacé click en **"New repository"**
   - Nombre: `futbolapp` (o el que quieras)
   - Marcalo como **Public**
   - No inicialices con README
   - Hacé click en **"Create repository"**

2. **Subir los archivos**
   - En la página del repositorio vacío, hacé click en **"uploading an existing file"**
   - Arrastrá los 4 archivos: `index.html`, `styles.css`, `app.js`, `README.md`
   - Escribí un mensaje de commit como `"Initial commit"`
   - Hacé click en **"Commit changes"**

3. **Activar GitHub Pages**
   - Entrá a la pestaña **Settings** del repositorio
   - En el menú lateral, hacé click en **Pages**
   - En "Source", seleccioná **"Deploy from a branch"**
   - En "Branch", seleccioná **`main`** y carpeta **`/ (root)`**
   - Hacé click en **Save**

4. **Acceder a tu app**
   - Esperá 1-2 minutos
   - La URL será: `https://TU-USUARIO.github.io/futbolapp/`
   - Podés compartir esa URL con tus amigos

### Opción B: Con Git desde terminal (Linux/Mac/Windows)

```bash
# 1. Crear carpeta y entrar
mkdir futbolapp && cd futbolapp

# 2. Copiar los 4 archivos a esta carpeta (index.html, styles.css, app.js, README.md)

# 3. Inicializar repositorio Git
git init
git add .
git commit -m "Initial commit: FútbolApp v1.0"

# 4. Conectar con GitHub (reemplazá TU-USUARIO con tu nombre de usuario)
git remote add origin https://github.com/TU-USUARIO/futbolapp.git
git branch -M main
git push -u origin main

# 5. Activar GitHub Pages desde Settings > Pages (igual que Opción A, paso 3)
```

### Actualizar la app después de cambios

```bash
git add .
git commit -m "Actualización: descripción del cambio"
git push
```

GitHub Pages se actualiza automáticamente en 1-2 minutos.

---

## ✏️ Cómo modificar la app

### Cambiar los colores

Abrí `styles.css` y modificá las variables CSS al inicio del archivo:

```css
:root {
  --color-green:  #2dce5c;   /* Color principal (verde fútbol) */
  --color-bg:     #0d0f10;   /* Fondo oscuro */
  --team-1-color: #2dce5c;   /* Color del Equipo 1 */
  --team-2-color: #4a9eff;   /* Color del Equipo 2 */
}
```

### Cambiar los nombres de los equipos

En `app.js`, buscá la función `renderTeamCard` y modificá:

```javascript
const names = ['', 'Equipo Verde', 'Equipo Azul'];
const icons = ['', '🟢', '🔵'];
```

### Cambiar el algoritmo de división

En `app.js` hay dos funciones de división:

- `divideTeamsBalanced()` – Usa niveles para equilibrar (algoritmo greedy)
- `divideTeamsRandom()` – División puramente aleatoria

Podés modificar `divideTeamsBalanced` para cambiar cómo se asignan los jugadores.

### Agregar más jugadores por defecto

Al inicio de `app.js`, después de `loadAllData()` en la función `init()`, podés agregar:

```javascript
if (App.players.length === 0) {
  App.players = [
    { id: generateId(), name: 'Rodrigo', level: 4 },
    { id: generateId(), name: 'Martín', level: 3 },
    // ...
  ];
  saveToStorage(STORAGE_KEYS.PLAYERS, App.players);
}
```

### Cambiar el máximo de partidos en el historial

En `app.js`, buscá:

```javascript
if (App.history.length > 50) {
```

Cambiá `50` por el número que prefieras.

### Agregar más monedas

En `app.js`, buscá la función `getCurrencySymbol`:

```javascript
function getCurrencySymbol(currency) {
  const symbols = { ARS: '$', EUR: '€', USD: 'U$S ' };
  // Agregá más monedas aquí:
  // BRL: 'R$', CLP: '$', MXN: '$'
}
```

Y en `index.html`, buscá el bloque `.currency-selector` y agregá botones:

```html
<button class="currency-btn" data-currency="BRL">R$ BRL</button>
```

---

## 💾 Dónde se guardan los datos

Los datos se guardan en el `localStorage` del navegador con estas claves:

| Clave | Contenido |
|-------|-----------|
| `futbolapp_players` | Lista de jugadores y niveles |
| `futbolapp_match` | Datos del partido (lugar, fecha, hora) |
| `futbolapp_teams` | Equipos generados |
| `futbolapp_expenses` | Costo y exclusiones de pago |
| `futbolapp_history` | Historial de partidos |

> ⚠️ Los datos son locales al navegador. Si usás otro dispositivo o limpias el caché, se perderán. Usá la función **Exportar JSON** para hacer backup de los jugadores.

---

## 📱 Compatibilidad

| Navegador | Compatibilidad |
|-----------|---------------|
| Chrome 80+ | ✅ Completa |
| Firefox 75+ | ✅ Completa |
| Safari 14+ | ✅ Completa |
| Edge 80+ | ✅ Completa |
| Chrome Android | ✅ Completa |
| Safari iOS | ✅ Completa |

---

## 📄 Licencia

MIT License – Libre para usar, modificar y distribuir.

---

*Hecho con ❤️ para organizar el fulbito del finde*
