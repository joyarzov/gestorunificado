# Verificación pública de documentos (QR en línea)

Permite que el código QR de cualquier documento o providencia se verifique **desde
internet** (por ejemplo, un celular con datos móviles), no solo dentro de la red
municipal. Implementado el 2026-06-04.

> Archivos de infraestructura versionados en [`deploy/verificar-publica/`](deploy/verificar-publica/).

---

## 1. Idea general

El sistema de gestión (CT 106) vive en la **red privada** de la Municipalidad
(`192.168.0.106`) y no es accesible desde internet. Para verificar QR en línea **sin
exponer la app de gestión**, se publica únicamente el endpoint de verificación a través
de un **VPS público** (`dockerimch`, dominio `imcabodehornos.cl`).

Decisiones tomadas:
- **Arquitectura "proxy en vivo"**: el VPS reenvía la verificación al CT 106 por un túnel
  saliente. No se duplican datos.
- **Solo metadatos**: la verificación muestra tipo, número, estado, firmantes y fechas.
  **No** expone el PDF.
- El código de verificación es aleatorio criptográfico de 8 caracteres
  (alfabeto de 30, ~6,5×10¹¹ combinaciones) → **no enumerable**, seguro de publicar.

---

## 2. Arquitectura

```
   📱 Escanea QR
        │  https://verificar.imcabodehornos.cl/verificar/<CODIGO>
        ▼
┌──────────────────────────────────────────────────────────┐
│  GATEWAY del proveedor (nginx, IP pública 45.228.210.11)   │  ← lo administra el proveedor
│  termina TLS y enruta por dominio:                         │
│    verificar.*  :443  ──►  http://10.2.1.100:8082          │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  VPS  dockerimch  (priv. 10.2.1.100 / púb. 45.228.210.11)  │
│  contenedor `verificar-nginx`  (network_mode: host, :8082) │
│    /verificar/*               → página estática propia     │
│    /api/verificar-documento/* → proxy a 127.0.0.1:8090     │
│    resto (/api/*, login, ...) → 404  (gestión NO expuesta) │
└──────────────────────────────────────────────────────────┘
        │  túnel SSH inverso (127.0.0.1:8090 en el VPS)
        ▼
┌──────────────────────────────────────────────────────────┐
│  CT 106  (192.168.0.106, red municipal)                    │
│  backend Laravel  127.0.0.1:8000                           │
│    GET /api/verificar-documento/{codigo}  (público)        │
└──────────────────────────────────────────────────────────┘
```

El VPS también corre `soporte.imcabodehornos.cl` (`:8080`) y un sitio de prueba (`:8081`);
verificación usa el **`:8082`**, que estaba libre.

---

## 3. Componentes

### 3.1 Backend (CT 106) — URL del QR

La URL que se incrusta en el QR se arma con la config `app.verificacion_url`, alimentada por
la variable de entorno `VERIFICACION_BASE_URL` (default = `APP_URL`).

- Config: `backend/config/app.php` → `'verificacion_url' => env('VERIFICACION_BASE_URL', env('APP_URL', ...))`
- Se usa en: `DocumentoController::inyectarFooterVerificacion()`,
  `ProvidenciaPdfService::generar()` y el comando `RegenerarProvidencias`.
- Valor en producción (CT 106 `backend/.env`):
  ```
  VERIFICACION_BASE_URL=https://verificar.imcabodehornos.cl
  ```
- Tras cambiarla: `docker exec unificada_backend php artisan config:clear`.

> Afecta solo a documentos **nuevos**. Los PDF ya generados son inmutables y conservan la
> URL con que se crearon.

### 3.2 VPS — servicio de verificación (`verificar-nginx`)

Ubicación en el VPS: `/opt/apps/verificar/` (archivos en `deploy/verificar-publica/`).

- `docker-compose.yml`: nginx `1.25-alpine`, `network_mode: host`, escucha `:8082`.
- `nginx.conf`: sirve la página y proxea **solo** `/api/verificar-documento/` al túnel
  (`127.0.0.1:8090`); cualquier otra ruta `/api/` → `404`; rate-limit `10 r/s`.
- `html/index.html`: página de verificación autocontenida (sin dependencias), identidad
  corporativa, maneja documentos y providencias.

Comandos:
```bash
ssh joyarzo@45.228.210.11          # ver ACCESOS.md para la contraseña
cd /opt/apps/verificar
docker compose up -d               # levantar / aplicar cambios
docker compose restart             # reiniciar
docker logs verificar-nginx --tail 50
```

### 3.3 Túnel SSH inverso (CT 106 → VPS)

Expone el backend del CT 106 en `127.0.0.1:8090` del VPS, mediante una conexión **saliente**
desde el CT 106 (no se abren puertos entrantes en la red municipal).

- Clave dedicada en el CT 106: `/root/.ssh/tunnel_vps` (autorizada en
  `~joyarzo/.ssh/authorized_keys` del VPS, restringida con `no-pty,no-X11-forwarding,no-agent-forwarding`).
- Servicio: `verificar-tunnel.service` (systemd, `Restart=always`):
  `ssh -NT -R 127.0.0.1:8090:127.0.0.1:8000 joyarzo@45.228.210.11`

Comandos (en el CT 106):
```bash
systemctl status verificar-tunnel
systemctl restart verificar-tunnel
journalctl -u verificar-tunnel -n 50
```

---

## 4. Reproducir / reinstalar

**En el VPS:**
```bash
mkdir -p /opt/apps/verificar
# copiar deploy/verificar-publica/{docker-compose.yml,nginx.conf,html/} a /opt/apps/verificar/
cd /opt/apps/verificar && docker compose up -d
```

**En el CT 106:**
```bash
# generar clave si no existe
test -f /root/.ssh/tunnel_vps || ssh-keygen -t ed25519 -N "" -f /root/.ssh/tunnel_vps
# autorizar /root/.ssh/tunnel_vps.pub en el VPS (~joyarzo/.ssh/authorized_keys)
# instalar el unit
cp verificar-tunnel.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now verificar-tunnel
```

**En el backend (CT 106):** setear `VERIFICACION_BASE_URL` en `.env` + `config:clear`.

**En el gateway del proveedor:** ver sección 5.

---

## 5. Vhost del proveedor

> ✅ **Configurado y funcionando** (2026-06-05). `https://verificar.imcabodehornos.cl` resuelve,
> con certificado Let's Encrypt válido, y la verificación opera de punta a punta.

El gateway que controla `:443` público lo administra el **proveedor de hosting** (no el VPS).
Lo que se les pidió, igual que `soporte`:

> - **Dominio:** `verificar.imcabodehornos.cl` (DNS ya apunta a `45.228.210.11`)
> - **Proxy reverso HTTPS →** `http://10.2.1.100:8082` (igual que soporte → `:8080`)
> - **Certificado TLS** para `verificar.imcabodehornos.cl` (Let's Encrypt)
> - Sitio HTTP simple, sin WebSocket.

Hasta que lo configuren, escanear un QR nuevo no responde; la verificación interna por
código sigue disponible. Una vez configurado, **funciona retroactivamente** (los QR ya
apuntan a la URL correcta).

---

## 6. Seguridad

- Solo se expone `GET /api/verificar-documento/{codigo}` (de solo lectura, metadatos).
  Todo lo demás de `/api/` y la app de gestión → `404` desde el VPS.
- El túnel es **saliente** desde el CT 106; la red municipal no abre puertos entrantes.
- Rate-limit en el nginx del VPS contra scraping.
- Código de verificación no enumerable (CSPRNG de 8 chars).
- La página de verificación **sanea la entrada de texto** (función `san()`): solo acepta el
  alfabeto del código (`A-Z`, `0-9`), en mayúsculas y con largo acotado (6–12). Se aplica tanto
  al input manual como al código tomado de la URL, y el render escapa HTML (anti-XSS). El input
  bloquea envíos concurrentes/doble submit.

---

## 7. Troubleshooting

| Síntoma | Revisar |
|---|---|
| QR no responde al escanear | ¿El proveedor ya configuró el vhost? (`curl -I https://verificar.imcabodehornos.cl`) |
| `verificar-nginx` arriba pero la verificación da error | Túnel caído: `systemctl status verificar-tunnel` en CT 106; probar `curl http://127.0.0.1:8090/api/verificar-documento/<cod>` en el VPS |
| El QR sigue apuntando a la IP LAN | Falta `VERIFICACION_BASE_URL` o no se hizo `config:clear`; los PDF viejos no cambian |
| Túnel no levanta | Clave `/root/.ssh/tunnel_vps` no autorizada en el VPS, o sin salida a internet desde el CT 106 |
