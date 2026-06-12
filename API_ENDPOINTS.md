# API Movil FF - Documentacion de Endpoints

## Base URL

Definir segun ambiente. Ejemplo local:

```txt
http://localhost:13000
```

## Endpoints publicos y privados

- Publicos:
  - `GET /ping`
  - `GET /_sat/metrics`
  - `POST /api/auth/login/empresa`
  - `POST /api/auth/login/user`
- `POST /api/auth/login/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/device-token`
- Privados:
  - `GET /api/preload`
  - `GET /api/ordenes-trabajo`
  - `PUT /api/ordenes-trabajo/asignar/:did`
  - `PUT /api/ordenes-trabajo/desasignar/:did`
  - `PUT /api/ordenes-trabajo/desestimar/:did`
  - `PUT /api/ordenes-trabajo/armar/:did`
  - `GET /api/home`

## Autenticacion

Todos los endpoints privados requieren token JWT en el header:

```http
Authorization: Bearer TU_TOKEN
```

El token se obtiene en `POST /api/auth/login/user`.

## Perfiles de usuario

- `1`: Administrador
- `2`: Coordinador
- `3`: Armador
- `4`: Cliente

## Formato general de respuesta

La API suele responder con esta estructura:

```json
{
  "success": true,
  "message": "Mensaje",
  "data": {},
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

En algunos endpoints no viene `meta`, pero el criterio general es ese.

## 1. Salud del servicio

### `GET /ping`

Sirve para validar que el servicio este arriba.

#### Response

```txt
1
```

### `GET /_sat/metrics`

Devuelve metricas internas del servicio.

## 2. Auth

### `POST /api/auth/login/empresa`

Valida la empresa y devuelve datos base para la pantalla inicial.

#### Body

```json
{
  "companyCode": "CODIGO_EMPRESA"
}
```

#### Body params

- `companyCode` `string` requerido: codigo de empresa

#### Response ejemplo

```json
{
  "success": true,
  "message": "Inicio de sesion exitoso",
  "data": {
    "company": {
      "did": "1",
      "codigo": "TEST",
      "nombre": "Empresa Demo",
      "apellido": "MODO_TRABAJO",
      "imagen": "https://..."
    },
    "identificadoresEspeciales": [
      {
        "did": "5",
        "nombre": "Lote",
        "data": []
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### Observaciones

- Si la empresa no existe responde error.
- `identificadoresEspeciales[].data` puede venir parseado como objeto/array si estaba guardado como JSON string.

### `POST /api/auth/login/user`

Login de usuario. Devuelve datos del usuario, `token` y `refreshToken`.

#### Body

```json
{
  "username": "usuario",
  "password": "clave",
  "companyCode": "CODIGO_EMPRESA"
}
```

#### Body params

- `username` `string` requerido
- `password` `string` requerido
- `companyCode` `string` requerido

#### Response ejemplo

```json
{
  "success": true,
  "message": "Inicio de sesion exitoso",
  "data": {
    "user": {
      "did": "10",
      "perfil": "Armador",
      "nombre": "Juan",
      "apellido": "Perez",
      "email": "juan@demo.com",
      "username": "jperez",
      "nroPerfil": 3,
      "imagen": null,
      "token": "JWT",
      "refreshToken": "REFRESH"
    }
  },
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### Observaciones

- El `token` es el que va en `Authorization: Bearer`.
- El `refreshToken` se usa para renovar sesion.
- Si usuario o password son incorrectos devuelve `401`.

### `POST /api/auth/login/refresh`

Renueva `token` y `refreshToken`.

#### Body

```json
{
  "refreshToken": "REFRESH_ACTUAL"
}
```

#### Response ejemplo

```json
{
  "success": true,
  "message": "Token renovado",
  "data": {
    "token": "NUEVO_JWT",
    "refreshToken": "NUEVO_REFRESH"
  },
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### Observaciones

- El refresh token rota: al usarlo, deja de servir y se entrega uno nuevo.
- Si expiro o no existe devuelve `401`.

### `POST /api/auth/logout`

Invalida el `refreshToken`.

#### Body

```json
{
  "refreshToken": "REFRESH_ACTUAL"
}
```

### `POST /api/auth/device-token`

Registra o actualiza el token `FCM` del dispositivo autenticado.

#### Headers

```http
Authorization: Bearer TU_TOKEN
```

#### Body

```json
{
  "fcmToken": "TOKEN_FCM",
  "deviceId": "DEVICE_ID",
  "deviceModel": "Samsung A54",
  "androidVersion": "14",
  "appVersion": "1.0.0"
}
```

#### Observaciones

- Este endpoint queda pensado para integracion mobile.
- Tambien sigue funcionando `POST /api/fcm/token` por compatibilidad.
- `plataforma` sigue siendo opcional si la app quiere enviarla.

#### Response ejemplo

```json
{
  "success": true,
  "message": "Sesion cerrada",
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

## 3. Preload

### `GET /api/preload`

Devuelve datos precargados para la app. Actualmente expone usuarios.

#### Query params

- `sections` `string` opcional: lista separada por coma de secciones a traer

#### Valores soportados

- `usuarios`
- `all`

#### Ejemplos

```http
GET /api/preload
GET /api/preload?sections=usuarios
GET /api/preload?sections=all
```

#### Response ejemplo

```json
{
  "success": true,
  "message": "Datos pre-cargados correctamente",
  "data": {
    "usuarios": [
      {
        "did": 10,
        "nombre": "Juan",
        "apellido": "Perez",
        "habilitado": 1,
        "perfil": 3,
        "telefono": "123",
        "usuario": "jperez",
        "codigo_cliente": null,
        "app_habilitada": 1,
        "accesos": "",
        "email": "juan@demo.com"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

## 4. Home

### `GET /api/home`

Trae resumen del inicio con contadores y OT sugeridas.

#### Response ejemplo

```json
{
  "success": true,
  "message": "Home PVs obtenida correctamente",
  "data": {
    "total_hoy": "5",
    "pendientes_total": "3",
    "completados_total": "2",
    "ot_urgentes": "0",
    "sin_asignar": "0",
    "avisos": [],
    "ot_sugeridas": [
      {
        "did": "200",
        "asignado": "10",
        "estado": "1",
        "nombre_asignado": "Juan",
        "fecha": "2026-03-25 08:00:00",
        "pedidos": [
          {
            "did_pedido": "500",
            "id_venta": "VTA-001",
            "tienda": "1",
            "fecha": "2026-03-25 07:30:00",
            "productos": []
          }
        ],
        "insumos": []
      }
    ]
  }
}
```

#### Comportamiento por perfil

- Perfil `3` Armador: ve solo datos de sus propias OT.
- Perfiles `1` y `2`: ven datos globales.

## 5. Ordenes de trabajo

### `GET /api/ordenes-trabajo`

Lista OT con sus pedidos, productos e insumos calculados.

#### Query params soportados

- `did_cliente` `string` opcional: uno o varios IDs separados por coma
- `estado` `string` opcional: uno o varios estados separados por coma
- `asignado` `string` opcional: uno o varios IDs separados por coma
- `tienda` `string` opcional: uno o varios valores separados por coma
- `alertada` `0|1|true|false` opcional
- `fecha_from` `YYYY-MM-DD` opcional
- `fecha_to` `YYYY-MM-DD` opcional
- `id_venta` `string` opcional: filtro parcial por numero de venta
- `producto_id_venta` `string` opcional: busca en numero de venta o descripcion de producto
- `sort_by` `string` opcional
- `sort_dir` `asc|desc` opcional
- `sortBy` `string` opcional: alias de `sort_by`
- `sortDir` `asc|desc` opcional: alias de `sort_dir`

#### `sort_by` permitidos

- `did_cliente`
- `fecha`
- `id_venta`
- `estado`
- `tienda`
- `asignado`

#### Casos especiales de `asignado`

- `asignado=10`: OT asignadas al usuario `10`
- `asignado=10,11`: OT asignadas a `10` o `11`
- `asignado=sin_asignar`: OT sin asignar
- `asignado=10,sin_asignar`: OT asignadas a `10` o sin asignar
- `asignado=`: para admin/coordinador fuerza "solo asignadas"; para armador fuerza "solo las suyas"

#### Reglas de estados

- Estado `4` nunca se devuelve.
- Si no se manda `estado`, por defecto tambien se excluye estado `3`.
- Si se manda `estado`, se puede pedir `3` pero igual se excluye `4`.

#### Comportamiento por perfil

- Perfil `1` o `2`: pueden ver segun filtros generales.
- Perfil `3`: por defecto ve solo OT asignadas a su usuario.
- Perfil `4`: no trae resultados, devuelve `data: []`.

#### Ejemplos

```http
GET /api/ordenes-trabajo
GET /api/ordenes-trabajo?estado=1,2
GET /api/ordenes-trabajo?asignado=sin_asignar
GET /api/ordenes-trabajo?did_cliente=20&sort_by=fecha&sort_dir=desc
GET /api/ordenes-trabajo?producto_id_venta=remera
GET /api/ordenes-trabajo?fecha_from=2026-03-01&fecha_to=2026-03-25
```

#### Response ejemplo resumido

```json
{
  "success": true,
  "message": "Ordenes de Trabajo obtenidas correctamente",
  "data": [
    {
      "did": "200",
      "estado": "1",
      "asignado": "10",
      "nombre_asignado": "Juan",
      "fecha": "2026-03-25 08:00:00",
      "pedidos": [
        {
          "did_pedido": "500",
          "did_cliente": "20",
          "id_venta": "VTA-001",
          "tienda": "1",
          "fecha": "2026-03-25 07:30:00",
          "productos": [
            {
              "did": "300",
              "titulo": "Remera Azul M",
              "ean": "123456",
              "sku": "SKU-01",
              "posicion": "A-1",
              "cantidad": "2",
              "did_producto_variante_valor": "900",
              "foto": "https://...",
              "stock": "5",
              "identificadores_especiales": []
            }
          ]
        }
      ],
      "insumos": [
        {
          "did_insumo": "700",
          "nombre": "Bolsa",
          "cantidad": "2"
        }
      ]
    }
  ]
}
```

#### Estructura de `productos`

- `did`: ID del producto
- `titulo`: descripcion + nombres de variantes
- `ean`
- `sku`
- `posicion`
- `cantidad`
- `did_producto_variante_valor`
- `foto`
- `stock`
- `identificadores_especiales`: lotes/series asociados cuando aplica

### `PUT /api/ordenes-trabajo/asignar/:did`

Asigna una OT a un usuario.

#### Params

- `did` requerido: ID de la OT

#### Body

```json
{
  "did_usuario": 10
}
```

#### Body params

- `did_usuario` requerido en uso real: ID del usuario a asignar

#### Response

```json
{
  "success": true,
  "message": "Orden de Trabajo asignada correctamente",
  "data": {},
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### Observaciones

- Aunque la ruta la declara como opcional, en la practica hay que enviar `did_usuario` para que la OT quede correctamente asignada.

### `PUT /api/ordenes-trabajo/desasignar/:did`

Saca la asignacion de una OT y opcionalmente guarda motivo.

#### Params

- `did` requerido: ID de la OT

#### Body

```json
{
  "motivo": "Se reasigna por carga de trabajo",
  "userId": 10
}
```

#### Body params

- `motivo` `string` opcional
- `userId` `number` recomendado en implementacion actual

#### Response

```json
{
  "success": true,
  "message": "Orden de Trabajo desasignada correctamente",
  "data": {},
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### Observaciones

- La OT queda con `asignado = 0`.
- En la implementacion actual la auditoria toma `userId` desde el body, no desde el token. Si no se envia, usa `0`.
- La ruta declara `did_usuario` como opcional, pero hoy no se usa dentro del controlador.

### `PUT /api/ordenes-trabajo/desestimar/:did`

Marca una OT como desestimada y desvincula sus pedidos.

#### Params

- `did` requerido: ID de la OT

#### Body

```json
{
  "motivo": "Pedido cancelado"
}
```

#### Body params

- `motivo` `string` opcional
- `did_usuario` `number` opcional pero actualmente no se usa

#### Efectos

- La OT pasa a `estado = 4`.
- En `pedidos` relacionados:
  - `did_ot = null`
  - `armado = 0`
  - `fecha_armado = fecha actual`
  - `quien_armado = usuario logueado`

#### Response

```json
{
  "success": true,
  "message": "Orden de Trabajo desestimada correctamente",
  "data": {},
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

### `PUT /api/ordenes-trabajo/armar/:did`

Marca la OT como armada, actualiza pedidos, egresa stock y genera remito.

#### Params

- `did` requerido: ID de la OT

#### Body

```json
{
  "productos": [
    {
      "did_producto": 300,
      "combinaciones": [
        {
          "did_combinacion": 900,
          "cantidad": 2,
          "did_stock_producto_detalle": 1000,
          "identificadores_especiales": 0
        }
      ]
    }
  ]
}
```

#### Body params

- `productos` `array` requerido
- `productos[].did_producto` requerido
- `productos[].combinaciones` `array` requerido
- `productos[].combinaciones[].did_combinacion` requerido
- `productos[].combinaciones[].cantidad` requerido
- `productos[].combinaciones[].did_stock_producto_detalle` opcional
- `productos[].combinaciones[].identificadores_especiales`:
  - `0` para egreso simple
  - array para egreso por identificadores especiales

#### Ejemplo con identificadores especiales

```json
{
  "productos": [
    {
      "did_producto": 300,
      "combinaciones": [
        {
          "did_combinacion": 900,
          "cantidad": 2,
          "identificadores_especiales": [
            {
              "did_stock": 1500,
              "cantidad": 1
            },
            {
              "did_stock": 1501,
              "cantidad": 1
            }
          ]
        }
      ]
    }
  ]
}
```

#### Efectos

- En `ordenes_trabajo`:
  - `estado = 3`
- En `pedidos` relacionados:
  - `armado = 2`
  - `quien_armado = usuario logueado`
  - `fecha_armado = fecha actual`
- Ejecuta egreso de stock
- Genera remito si hubo items egresados

#### Response ejemplo

```json
{
  "success": true,
  "message": "Armado actualizado correctamente",
  "data": {
    "resultados": [
      {
        "did_producto": 300,
        "did_combinacion": 900,
        "cantidad": 2,
        "estado": "OK"
      }
    ],
    "errores": []
  },
  "meta": {
    "timestamp": "2026-03-25T12:00:00.000Z"
  }
}
```

#### Importante

- Si `productos` viene vacio, devuelve error.
- Si una combinacion no tiene stock suficiente, el error queda listado dentro de `data.errores`.
- Puede haber mezcla de `resultados` correctos y `errores` en la misma respuesta.

## 6. Estados de orden de trabajo

Segun el comportamiento observado en el codigo:

- `1`: pendiente
- `2`: en curso
- `3`: terminada / armada
- `4`: desestimada

## 7. Ejemplo de flujo recomendado

### 1. Validar empresa

```http
POST /api/auth/login/empresa
```

### 2. Loguear usuario

```http
POST /api/auth/login/user
Authorization: no requerido
```

### 3. Usar token en endpoints privados

```http
GET /api/home
Authorization: Bearer JWT
```

### 4. Renovar sesion cuando venza el token

```http
POST /api/auth/login/refresh
```

### 5. Cerrar sesion

```http
POST /api/auth/logout
```

## 8. Observaciones tecnicas para integracion

- Los bodies aceptan JSON.
- El servidor esta configurado con limite de `50mb` para JSON y form.
- Los endpoints privados dependen del token para resolver empresa y usuario.
- En OT y Home varios campos numericos vuelven como `string`.
- Hay diferencias entre lo que algunas rutas marcan como "optional" y lo que realmente conviene enviar. En esta documentacion esta aclarado endpoint por endpoint.
