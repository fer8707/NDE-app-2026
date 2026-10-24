# Noche de las Estrellas

Aplicación web React para consultar las sedes de la Noche de las Estrellas 2026. El mismo frontend se publica en GitHub Pages y se empaqueta como aplicación Android con Capacitor.

## Desarrollo web

Requiere Node.js 22 o posterior.

```bash
npm ci
npm run dev
```

El catálogo se mantiene en `sedes.json`. El build de producción se genera en `dist/` con `npm run build`.

## GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` construye y publica el sitio cuando se actualiza `main` o `master`.

1. Sube este proyecto a un repositorio GitHub.
2. En GitHub, abre **Settings > Pages** y selecciona **GitHub Actions** como fuente de publicación.
3. Confirma que el workflow termine correctamente en la pestaña **Actions**.
4. Completa el correo oficial en `public/privacy.html` antes de usar esa página como política pública.

La configuración de Vite detecta el nombre del repositorio en GitHub Actions y ajusta la ruta base automáticamente. En desarrollo local usa `/`.

## Android y Google Play

El proyecto nativo está en `android/`. Para preparar una compilación local hacen falta Android Studio, un Android SDK instalado y JDK compatible con la versión de Gradle generada.

```bash
npm ci
npm run android:sync
npm run android:open
```

En Android Studio puedes ejecutar la app en un emulador o dispositivo. Para generar el archivo de publicación, abre **Build > Generate Signed Bundle / APK**, selecciona **Android App Bundle**, crea o selecciona una clave de firma y termina el asistente. El archivo `.aab` se carga en Play Console.

La configuración Gradle también admite firma release mediante estas variables de entorno: `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`. Después de configurar las cuatro en tu shell o gestor de secretos, `npm run android:bundle` produce `android/app/build/outputs/bundle/release/app-release.aab`. Mantén el keystore fuera del repositorio y no escribas contraseñas en archivos versionados ni en comandos que queden guardados en el historial.

### Lista de publicación

- Registra la cuenta de Google Play Console, completa la verificación de identidad y acepta los contratos y pagos vigentes.
- Antes de publicar, cambia `appId` en `capacitor.config.json` por un identificador de paquete propio, único y definitivo. Después sincroniza y comprueba `applicationId` en Android Studio. No lo cambies tras publicar la primera versión.
- Reemplaza el correo de ejemplo de `public/privacy.html`, confirma quién es el responsable del tratamiento y publica la URL HTTPS de esa página. La política debe describir exactamente la app y las transferencias a OpenStreetMap, Google y GitHub.
- El icono de ficha de 512 × 512 px está en `resources/icon.png` y el gráfico destacado de 1024 × 500 px en `resources/feature-graphic.png`; el icono Android ya está instalado en las densidades correspondientes. Las capturas deben ser reales y tomarse de la app ejecutándose en un dispositivo o emulador Android. Los gráficos de ficha no sustituyen al icono de launcher Android.
- Completa nombre y descripción, categoría, datos de contacto, clasificación de contenido, público objetivo, formulario **Data safety**, declaración de anuncios y acceso de revisión. Responde de acuerdo con el comportamiento real: la app no tiene cuenta ni servidor propio, pero la búsqueda por texto consulta Nominatim y los mapas usan Google Maps.
- Genera y conserva de forma segura la clave de firma; no la subas al repositorio. Activa **Play App Signing** y guarda una copia cifrada de la clave de carga y sus credenciales.
- Sube primero el `.aab` a una prueba interna. Prueba instalación, búsqueda, permisos de ubicación, enlaces y mapas en un dispositivo real antes de promoverlo.
- Revisa el requisito de pruebas cerradas aplicable a cuentas personales nuevas y el nivel de API objetivo vigente en Play Console. Google puede cambiar estos requisitos.
- Completa la ficha y declara la política de privacidad en Play Console; solicita revisión y libera producción cuando la consola permita hacerlo.

La firma de release no se configura automáticamente para evitar guardar secretos en el repositorio. Los requisitos de cuenta, pruebas y nivel de API pueden variar; Play Console es la fuente final antes de enviar.

## Privacidad y seguridad

Consulta `SECURITY.md` para la Definition of Done de seguridad y `public/privacy.html` para la política que debe revisarse antes de publicar. La ubicación del dispositivo es opcional y se calcula localmente; las direcciones escritas se envían a Nominatim para geocodificación.