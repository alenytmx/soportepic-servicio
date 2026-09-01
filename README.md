# Soportepic Servicio

Sistema web responsivo para administrar talleres de reparación de celulares y computadoras. Incluye clientes, usuarios y permisos, tipos de orden, órdenes con evidencias, abonos, saldos, gastos, reportes, impresión A4/térmica y auditoría.

## Tecnologías

- React 19 + TypeScript + Vite.
- Node.js + Express 5 + TypeScript.
- MongoDB + Mongoose.
- PDFKit para reportes A4 y tickets de 58/80 mm.
- Socket.IO para actualización de órdenes, pagos, gastos y configuración.
- Interfaz ligera sin framework visual pesado.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- MongoDB local o una base de datos en MongoDB Atlas.
- Chrome, Edge, Firefox o Safari 14 o superior.

## Inicio rápido en Windows

1. Instala Node.js 20 o superior y MongoDB, o crea una base en MongoDB Atlas.
2. Ejecuta `iniciar.bat`.
3. La primera vez se creará `apps/api/.env` a partir del ejemplo. Revisa `MONGODB_URI`; el sistema genera automáticamente una `JWT_SECRET` segura.
4. Abre `http://localhost:5173`.
5. El sistema mostrará una única vez el asistente para crear el administrador principal.

El archivo `.bat` instala las dependencias cuando todavía no existen y levanta React y la API juntos.

No existen credenciales predeterminadas. Cuando MongoDB se conecte y la base no tenga usuarios, aparecerá **Configuración inicial** para que el dueño cree su administrador.

## Inicio desde terminal

En Windows:

```bat
copy apps\api\.env.example apps\api\.env
npm install
npm run dev
```

En macOS o Linux:

```bash
cp apps/api/.env.example apps/api/.env
npm install
npm run dev
```

Direcciones locales:

- Aplicación: `http://localhost:5173`
- API: `http://localhost:3000`
- Salud de la API: `http://localhost:3000/api/health`

El endpoint de salud muestra por separado si la API está encendida y si MongoDB está conectado.

Para abrir el sistema desde otra computadora de la misma red durante desarrollo, usa `http://IP-DEL-SERVIDOR:5173`. La versión 1.0.4 acepta automáticamente direcciones privadas como `192.168.x.x` en desarrollo. Si Windows lo solicita, permite Node.js en redes privadas.

## Variables de entorno

Edita `apps/api/.env`:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/soportepic_servicio
JWT_SECRET=el-sistema-la-genera-automaticamente
JWT_EXPIRES_IN=8h
CLIENT_ORIGIN=http://localhost:5173
UPLOAD_DIR=uploads
MAX_IMAGE_MB=5
TRUST_PROXY=0
```

Ejemplo de MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://USUARIO:CONTRASENA@cluster.mongodb.net/soportepic_servicio?retryWrites=true&w=majority
```

No subas el archivo `.env` a Git ni compartas su contenido.

Antes de `npm run dev`, `npm start` o `npm run create-admin`, el proyecto revisa `apps/api/.env`. Si `JWT_SECRET` no existe o tiene menos de 32 caracteres, genera una clave criptográfica segura y la guarda sin imprimirla. En desarrollo, una clave corta tampoco vuelve a cerrar la API: se usa una clave temporal como protección adicional.

## Si aparece ECONNREFUSED o MongoDB no conectado

Las versiones 1.0.1 y posteriores mantienen la API encendida y reintentan la conexión a MongoDB cada cinco segundos. La versión 1.0.2 también evita que una `JWT_SECRET` corta cierre la API antes de revisar Atlas. Así React muestra un diagnóstico claro en lugar del error del proxy de Vite.

La versión 1.0.4 corrige el falso aviso de MongoDB en equipos nuevos: una sesión ausente ya no se confunde con una base desconectada, la pantalla reintenta automáticamente durante el arranque de Atlas y el acceso por IP privada funciona en desarrollo. También agrega reporte PDF con gráfica y progreso por Socket.IO, y actualiza en vivo los pagos de órdenes recientes separando el estado de pago del estado técnico.

La versión 1.2.0 suma automáticamente el importe del servicio y las refacciones para obtener el total y el saldo. Al conectarse, corrige las órdenes anteriores que tenían materiales pero conservaban únicamente el importe del servicio. También incluye pagos en efectivo, transferencia, tarjeta o mixtos; firma de entrega; garantías; tipos de cotización; expediente de reparaciones y anticipos por cliente; tema configurable; fecha y hora; y métricas estrictamente del día.

Si utilizas MongoDB local en Windows:

1. Abre `Servicios` con `Win + R` y ejecuta `services.msc`.
2. Busca el servicio `MongoDB Server` o `MongoDB`.
3. Presiona **Iniciar**.
4. Verifica en MongoDB Compass la conexión `mongodb://127.0.0.1:27017`.
5. Regresa al sistema y presiona **Reintentar**.

También puedes abrir una terminal como administrador y ejecutar:

```bat
net start MongoDB
```

Si el servicio no existe, debes instalar MongoDB Community Server o utilizar MongoDB Atlas. Instalar únicamente MongoDB Compass no inicia una base de datos local.

Si utilizas Atlas, revisa que:

- `MONGODB_URI` contenga el usuario, contraseña, clúster y nombre de base correctos.
- La contraseña con caracteres especiales esté codificada para URL.
- Tu dirección IP esté permitida en Network Access de Atlas.
- El usuario de Database Access tenga permisos para la base `soportepic_servicio`.

## Comandos

```bash
npm run dev          # React y API en desarrollo
npm run typecheck    # Revisión estricta de TypeScript
npm run build        # Compilación de producción
npm run smoke        # Compila y verifica el endpoint de salud
npm start            # Compila e inicia producción
npm run start:fast   # Inicia una compilación ya existente
npm run create-admin # Crea otro administrador desde terminal
```

## Producción y hosting

Configura como mínimo:

```env
NODE_ENV=production
MONGODB_URI=tu-cadena-de-produccion
JWT_SECRET=una-clave-larga-y-unica
CLIENT_ORIGIN=https://tu-dominio.com
TRUST_PROXY=1
```

Después ejecuta `npm start`. La API sirve también la aplicación React compilada, por lo que solo se necesita un proceso Node.js. Vite genera archivos con nombre versionado y el servidor entrega `index.html` sin caché para evitar que una actualización deje una pantalla anterior en el navegador.

La carpeta `apps/api/uploads` debe conservarse entre despliegues. En plataformas con disco temporal conviene montar un volumen persistente o sustituirla por almacenamiento de objetos.

## Primer administrador

Cuando la colección de usuarios está vacía, `/setup` permite crear el primer administrador. El backend usa un bloqueo único para impedir que dos solicitudes creen administradores iniciales al mismo tiempo. Después de crear la primera cuenta, el endpoint queda deshabilitado.

Como recuperación autorizada, desde la computadora del servidor se puede ejecutar:

```bash
npm run create-admin
```

## Módulos incluidos

- Clientes con código único, búsqueda, referencias, dirección y detección de posibles duplicados.
- Usuarios con roles y permisos por acción.
- Tipos de orden sin nombres duplicados.
- Órdenes con folio único, uno a diez equipos, accesorios, observaciones y máximo cinco fotografías.
- Estados con historial: Pendiente, En diagnóstico, En reparación, Esperando refacción, Listo para entregar, Entregado, Finalizado y Cancelado.
- Abonos en efectivo o transferencia con referencia, idempotencia y saldo calculado.
- Cancelación controlada de pagos y gastos sin borrar historial.
- Gastos generales o relacionados con una orden.
- Reportes de facturación, cobros, saldos, gastos, caja y utilidad estimada, con descarga PDF horizontal, gráfica por estado y progreso en vivo.
- PDF A4 con evidencias, nota de venta descargable y tickets térmicos de 58/80 mm.
- Configuración de nombre, dirección, teléfono, correo, redes, impresión y textos del ticket.
- Auditoría de altas, cambios, estados, abonos y cancelaciones.
- Tema claro/oscuro y diseño adaptable a computadora, tableta y teléfono.

## Reglas financieras del reporte

- **Facturado:** total de órdenes creadas en el periodo, excepto canceladas.
- **Cobrado:** abonos aplicados dentro del periodo.
- **Saldo:** saldo de las órdenes creadas en el periodo.
- **Neto en caja:** cobrado menos gastos activos.
- **Utilidad estimada:** cobrado menos gastos y menos materiales cuyo gasto no fue relacionado con la orden.

Al registrar la compra de una refacción como gasto, relaciónala con su orden. Esto evita descontarla dos veces en la utilidad estimada.

## Seguridad aplicada

- Contraseñas con bcrypt y factor de costo 12.
- Sesión JWT en cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Límite de intentos de inicio de sesión.
- Validación Zod en la API además de validaciones del navegador.
- Permisos verificados en cada endpoint.
- Protección de origen en operaciones de escritura.
- Rechazo de operadores NoSQL en solicitudes.
- Firmas reales JPG/PNG verificadas, límite de cinco archivos y tamaño configurable.
- Evidencias accesibles solo con una sesión autorizada.
- Abonos atómicos con clave de idempotencia para evitar duplicados por doble clic.
- Control de concurrencia en ediciones.
- Sin borrado físico de movimientos financieros.
- Registro de auditoría con usuario, fecha, IP, entidad y acción.

## Estructura

```text
soportepic-servicio/
├── apps/
│   ├── api/        API, MongoDB, PDFs, archivos y Socket.IO
│   └── web/        Aplicación React responsiva
├── scripts/        Verificaciones del proyecto
├── iniciar.bat     Arranque local en Windows
└── package.json    Comandos únicos del monorepo
```

## Aviso

Versión 1.2.0. Derechos reservados Soportepic. Soporte técnico: 311-135-45-85.
