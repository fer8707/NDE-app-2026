import { useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Telescope,
} from 'lucide-react'
import sedesData from '../sedes.json'

const sedes = sedesData.filter((sede) => (
  Number.isFinite(sede.id)
  && typeof sede.nombre === 'string'
  && Number.isFinite(sede.lat)
  && Number.isFinite(sede.lng)
  && sede.lat >= -90 && sede.lat <= 90
  && sede.lng >= -180 && sede.lng <= 180
))

const normalize = (value) => value
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

function horario(sede) {
  return sede.inicio && sede.fin ? `${sede.inicio} – ${sede.fin} h` : 'Horario por confirmar'
}

function mapsEmbedUrl(sede) {
  const query = encodeURIComponent(`${sede.lat},${sede.lng}`)
  return `https://www.google.com/maps?q=${query}&z=14&output=embed`
}

function mapsLinkUrl(sede) {
  const query = encodeURIComponent([sede.direccion, sede.nombre].filter(Boolean).join(', '))
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function distanciaMetros(origen, sede) {
  const radianes = (grados) => (grados * Math.PI) / 180
  const deltaLat = radianes(sede.lat - origen.lat)
  const deltaLng = radianes(sede.lng - origen.lng)
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radianes(origen.lat))
    * Math.cos(radianes(sede.lat))
    * Math.sin(deltaLng / 2) ** 2

  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function textoDistancia(metros) {
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toFixed(metros < 10000 ? 1 : 0)} km`
}

function App() {
  const [busqueda, setBusqueda] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [origen, setOrigen] = useState(null)
  const [buscandoCercana, setBuscandoCercana] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState('')
  const [seleccionada, setSeleccionada] = useState(sedes[0])

  const sedesCoincidentes = useMemo(() => {
    const query = normalize(busqueda.trim())
    if (!query) return sedes
    return sedes.filter((sede) => normalize([
      sede.nombre,
      sede.direccion ?? '',
      ...(sede.actividades ?? []),
    ].join(' ')).includes(query))
  }, [busqueda])

  const sedesFiltradas = useMemo(() => {
    if (!origen) return sedesCoincidentes
    return [...sedesCoincidentes].sort((a, b) => (
      distanciaMetros(origen, a) - distanciaMetros(origen, b)
    ))
  }, [origen, sedesCoincidentes])

  function mostrarSedeMasCercana(coordenadas, etiqueta) {
    const masCercana = sedes.reduce((actual, sede) => (
      distanciaMetros(coordenadas, sede) < distanciaMetros(coordenadas, actual) ? sede : actual
    ), sedes[0])

    setOrigen(coordenadas)
    setSeleccionada(masCercana)
    setBusqueda('')
    setErrorUbicacion(`Sede más cercana a ${etiqueta}: ${masCercana.nombre} (${textoDistancia(distanciaMetros(coordenadas, masCercana))} en línea recta).`)
  }

  async function buscarPorDireccion(event) {
    event.preventDefault()
    const consulta = ubicacion.trim()
    if (!consulta) {
      setErrorUbicacion('Escribe una ciudad o dirección para encontrar la sede más cercana.')
      return
    }

    setBuscandoCercana(true)
    setErrorUbicacion('')
    try {
      const params = new URLSearchParams({
        q: consulta,
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'mx',
      })
      const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'es' },
      })
      if (!respuesta.ok) throw new Error('geocoding-failed')
      const resultados = await respuesta.json()
      const resultado = resultados[0]
      if (!resultado) {
        setErrorUbicacion('No encontramos esa ubicación en México. Prueba con otra ciudad o dirección.')
        return
      }

      const coordenadas = { lat: Number(resultado.lat), lng: Number(resultado.lon) }
      if (!Number.isFinite(coordenadas.lat) || !Number.isFinite(coordenadas.lng)
        || coordenadas.lat < -90 || coordenadas.lat > 90
        || coordenadas.lng < -180 || coordenadas.lng > 180) {
        setErrorUbicacion('El servicio devolvió una ubicación no válida. Inténtalo de nuevo.')
        return
      }

      mostrarSedeMasCercana(
        coordenadas,
        resultado.name || consulta,
      )
    } catch {
      setErrorUbicacion('No pudimos consultar la ubicación. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setBuscandoCercana(false)
    }
  }

  async function buscarDesdeDispositivo() {
    setErrorUbicacion('')
    if (!Capacitor.isNativePlatform() && !navigator.geolocation) {
      setErrorUbicacion('Este navegador no permite obtener tu ubicación. Puedes escribir una ciudad o dirección.')
      return
    }

    setBuscandoCercana(true)
    try {
      let coordenadas
      if (Capacitor.isNativePlatform()) {
        const permiso = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] })
        if (permiso.coarseLocation === 'denied') {
          setErrorUbicacion('No se concedió permiso de ubicación. Puedes escribir una ciudad o dirección.')
          return
        }
        const posicion = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
        })
        coordenadas = { lat: posicion.coords.latitude, lng: posicion.coords.longitude }
      } else {
        const posicion = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 300000,
          })
        })
        coordenadas = { lat: posicion.coords.latitude, lng: posicion.coords.longitude }
      }

      mostrarSedeMasCercana(coordenadas, 'tu ubicación actual')
    } catch (error) {
      const mensajes = {
        1: 'No se concedió permiso de ubicación. Puedes escribir una ciudad o dirección.',
        2: 'No pudimos determinar tu ubicación. Inténtalo de nuevo o escribe una ciudad.',
        3: 'La solicitud de ubicación tardó demasiado. Inténtalo de nuevo.',
      }
      setErrorUbicacion(mensajes[error.code] || 'No pudimos obtener tu ubicación. Revisa los permisos del dispositivo e inténtalo de nuevo.')
    } finally {
      setBuscandoCercana(false)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <header className="relative border-b border-white/10">
        <div className="sky-grain absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-6 sm:px-8 lg:px-12 lg:pb-16">
          <nav className="flex items-center justify-between">
            <a className="wordmark" href="#inicio" aria-label="Noche de las Estrellas, inicio">
              <span className="wordmark-icon"><Sparkles size={17} /></span>
              <span>Noche de las Estrellas</span>
            </a>
            <a href="#sedes" className="nav-link">
              Explorar sedes <ArrowDownRight size={15} />
            </a>
          </nav>

          <div id="inicio" className="hero-grid mt-16 items-end sm:mt-20 lg:mt-24">
            <div className="max-w-3xl">
              <p className="eyebrow"><span className="eyebrow-dot" /> México · 2026</p>
              <h1 className="display-title mt-5">Una noche.<br /><span>Todo el universo.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#b7c2b9] sm:text-lg">
                Encuentra tu sede, descubre sus actividades y planea una noche para mirar más lejos.
              </p>
            </div>
            <a className="hero-count mt-10 lg:mt-0" href="#sedes">
              <span className="count-number">{sedes.length}</span>
              <span className="count-label">sedes en todo<br />México</span>
              <ArrowUpRight className="count-arrow" size={20} />
            </a>
          </div>

          <div className="hero-rule mt-12 sm:mt-16" />
          <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-[#7f9082]">
            <span>El cielo nos reúne</span>
            <span>Consulta · Elige · Explora</span>
          </div>
        </div>
      </header>

      <main id="sedes" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <section aria-labelledby="explora-title" className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:gap-14">
          <div className="min-w-0">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Directorio de sedes</p>
                <h2 id="explora-title" className="section-title mt-2">¿A dónde vamos?</h2>
              </div>
              <span className="result-count">{sedesFiltradas.length} lugares</span>
            </div>

            <label className="search-box mt-7">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Busca por ciudad, sede o actividad"
                aria-label="Buscar por ciudad, sede o actividad"
              />
              <kbd>/</kbd>
            </label>

            <form className="nearby-search mt-5" onSubmit={buscarPorDireccion}>
              <div className="nearby-title">
                <span className="nearby-icon"><MapPin size={16} /></span>
                <span>Encuentra tu sede más cercana</span>
              </div>
              <div className="nearby-controls mt-3">
                <input
                  type="search"
                  value={ubicacion}
                  onChange={(event) => setUbicacion(event.target.value)}
                  placeholder="Escribe tu ciudad o dirección"
                  aria-label="Ciudad o dirección de referencia"
                  disabled={buscandoCercana}
                />
                <button className="nearby-submit" type="submit" disabled={buscandoCercana}>
                  {buscandoCercana ? 'Buscando…' : 'Buscar'}
                </button>
              </div>
              <button
                className="nearby-device"
                type="button"
                onClick={buscarDesdeDispositivo}
                disabled={buscandoCercana}
              >
                <LocateFixed size={14} /> Usar mi ubicación actual
              </button>
              <p className="location-disclosure">La dirección escrita se consulta en OpenStreetMap. Distancias aproximadas en línea recta.</p>
              {errorUbicacion && <p className="location-feedback" role="status">{errorUbicacion}</p>}
            </form>

            <div className="venue-list mt-5" aria-live="polite">
              {sedesFiltradas.map((sede, index) => {
                const activa = seleccionada.id === sede.id
                const distancia = origen ? distanciaMetros(origen, sede) : null
                return (
                  <button
                    className={`venue-row ${activa ? 'venue-row-active' : ''}`}
                    key={sede.id}
                    onClick={() => setSeleccionada(sede)}
                    aria-pressed={activa}
                  >
                    <span className="venue-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="venue-copy">
                      <span className="venue-name">{sede.nombre}</span>
                      <span className="venue-meta">
                        {distancia !== null ? <MapPin size={13} /> : <Clock3 size={13} />}
                        {distancia !== null ? `${textoDistancia(distancia)} · ` : ''}{horario(sede)}
                      </span>
                    </span>
                    <ArrowUpRight className="venue-arrow" size={18} aria-hidden="true" />
                  </button>
                )
              })}
              {sedesFiltradas.length === 0 && (
                <p className="empty-state">No encontramos sedes con “{busqueda}”. Prueba otra búsqueda.</p>
              )}
            </div>
          </div>

          <aside className="detail-panel" aria-label={`Información de ${seleccionada.nombre}`}>
            <div className="detail-topline">
              <span className="live-mark"><span /> Sede seleccionada</span>
              <span className="detail-id">N.º {String(seleccionada.id).padStart(2, '0')}</span>
            </div>
            <div className="detail-heading mt-7">
              <p className="eyebrow">Tu punto de encuentro</p>
              <h2 className="detail-title mt-2">{seleccionada.nombre}</h2>
              <p className="detail-address mt-3">
                <MapPin size={16} aria-hidden="true" />
                {seleccionada.direccion || 'Dirección por confirmar'}
              </p>
            </div>

            <div className="detail-facts mt-7">
              <div className="fact">
                <span className="fact-label"><Clock3 size={14} /> Horario</span>
                <span className="fact-value">{horario(seleccionada)}</span>
              </div>
              <div className="fact">
                <span className="fact-label"><Sparkles size={14} /> Evento</span>
                <span className="fact-value">{seleccionada.evento || 'Programa por confirmar'}</span>
              </div>
            </div>

            <div className="activities-block mt-6">
              <span className="fact-label"><Telescope size={14} /> Actividades</span>
              <div className="activity-tags mt-3">
                {(seleccionada.actividades?.length ? seleccionada.actividades : ['Por confirmar']).map((actividad) => (
                  <span className="activity-tag" key={actividad}>{actividad}</span>
                ))}
              </div>
            </div>

            <div className="map-frame mt-7">
              <iframe
                key={seleccionada.id}
                src={mapsEmbedUrl(seleccionada)}
                title={`Mapa de ${seleccionada.nombre}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                allowFullScreen
              />
              {seleccionada.coordAprox && (
                <span className="map-note">Ubicación aproximada</span>
              )}
            </div>
            <a className="maps-link mt-4" href={mapsLinkUrl(seleccionada)} target="_blank" rel="noopener noreferrer">
              Abrir indicaciones en Google Maps <ExternalLink size={15} />
            </a>
            <p className="map-attribution">Geocodificación © OpenStreetMap contributors</p>
          </aside>
        </section>
      </main>

      <footer className="page-footer">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-[#849186] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>Noche de las Estrellas · 2026</span>
          <span>Los horarios y actividades pueden cambiar; confirma con tu sede.</span>
          <a href={`${import.meta.env.BASE_URL}privacy.html`} className="maps-link">Privacidad</a>
        </div>
      </footer>
    </div>
  )
}

export default App