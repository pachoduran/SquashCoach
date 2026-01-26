# Squash Analyzer - Aplicación de Análisis de Partidos de Squash

## Descripción

Aplicación móvil desarrollada con Expo/React Native para análisis detallado de partidos de squash. Permite registrar puntos, posiciones de jugadores, motivos de victoria/derrota y generar estadísticas completas de rendimiento.

## Características Principales

### 📊 Gestión de Partidos
- Crear nuevos partidos especificando jugadores (mejor de 3 o 5 games)
- Registro de jugadores con nombre y nickname
- Seguimiento automático del marcador (games y puntos)
- Sistema de puntuación oficial de squash (11 puntos con diferencia de 2)

### 🎯 Registro Táctil de Puntos
- **Cancha Interactiva**: Toca en la cancha de squash para registrar dónde terminó cada punto
- **Motivos Personalizables**: Winner, Error forzado, Error no forzado, Let, Drop shot, Boast, Volley, Drive, Error en la red, Fuera (y motivos personalizados)
- **Posiciones de Jugadores**: Registra opcionalmente la posición de tu jugador y el oponente en cada punto

### 📈 Análisis y Estadísticas
- **Mapa de Calor**: Visualización de dónde terminan los puntos (ganados vs perdidos)
- **Estadísticas de Motivos**: Gráficos de barras mostrando los motivos más comunes de puntos
- **Efectividad**: Porcentaje de puntos ganados
- **Resumen por Game**: Desglose detallado de cada game del partido
- **Historial Completo**: Acceso a todos los partidos jugados

### ⚙️ Configuración
- Personalizar motivos de puntos
- Activar/desactivar motivos existentes
- Agregar nuevos motivos según tu estilo de juego

## Uso de la Aplicación

### 1. Crear Jugadores y Partido
- Desde la pantalla principal, toca "Nuevo Partido"
- Selecciona o crea dos jugadores
- Indica cuál es tu jugador
- Elige el formato (mejor de 3 o mejor de 5 games)

### 2. Registrar Puntos Durante el Partido
- Toca "Registrar Punto"
- Toca en la cancha donde terminó el punto
- Selecciona quién ganó el punto
- Elige el motivo (Winner, Error, etc.)
- Opcionalmente, registra las posiciones de ambos jugadores

### 3. Ver Análisis
- El marcador se actualiza automáticamente
- Al finalizar, verás el resumen completo

## Notas Importantes

- **Solo Móvil**: Esta es una aplicación móvil. Para probarla, usa Expo Go en tu dispositivo Android/iOS.
- **Base de Datos Local**: Todos los datos se almacenan localmente en tu dispositivo
- **Sin Cuenta Requerida**: No necesitas crear cuenta ni conexión a internet
