# Squash Coach Web Dashboard - PRD

## Original Problem Statement
Dashboard web para Squash Coach que se conecta a un backend existente (https://lev.jsb.mybluehost.me:8001). La aplicación permite visualizar partidos de squash, análisis de jugadores y partidos compartidos.

## User Personas
- **Jugadores de Squash**: Quieren revisar su historial de partidos y estadísticas
- **Entrenadores**: Necesitan analizar el rendimiento de sus jugadores
- **Usuarios que comparten**: Pueden ver partidos compartidos por otros usuarios

## Core Requirements
1. Autenticación con email/password (mismas credenciales que la app móvil)
2. Dashboard con estadísticas generales
3. Lista de partidos (solo lectura)
4. Detalle de partido con visualización de cancha
5. Lista de jugadores
6. Análisis head-to-head entre jugadores
7. Partidos compartidos por otros usuarios
8. Diseño responsive (mobile-first)
9. Colores de marca: Negro (#000000), Amarillo (#FFDA00), Gris (#707070)

## What's Been Implemented (Jan 2026)

### Authentication
- ✅ Login page with email/password
- ✅ Register page with name, email, phone, password
- ✅ Token-based authentication (Bearer token)
- ✅ Auto-redirect for authenticated/unauthenticated users
- ✅ Logout functionality

### Dashboard
- ✅ Welcome header with user name
- ✅ Statistics cards (Total matches, Wins, Losses, Win %)
- ✅ Recent form indicator (W/L badges)
- ✅ Recent matches list

### Matches
- ✅ Filterable matches list
- ✅ Search by tournament/player
- ✅ Filter by result (wins/losses)
- ✅ Filter by opponent

### Match Detail
- ✅ Match header with score
- ✅ Court visualization with points
- ✅ Game-by-game breakdown
- ✅ Point statistics by reason
- ✅ Interactive point selection

### Players
- ✅ Players list with search
- ✅ Player cards with avatars

### Analysis
- ✅ Head-to-head comparison
- ✅ Date range filtering
- ✅ Win percentage visualization
- ✅ Games comparison

### Shared Matches
- ✅ Users that share with me list
- ✅ Shared matches view
- ✅ Shared match detail

### UI/UX
- ✅ Dark theme with brand colors
- ✅ Mobile bottom navigation
- ✅ Desktop sidebar navigation
- ✅ Responsive layout
- ✅ Barlow Condensed + Manrope fonts
- ✅ Squash court SVG component

## Prioritized Backlog

### P0 (Critical)
- None - MVP complete

### P1 (High)
- Real-time notifications for shared matches
- Export match statistics to PDF
- Performance optimization for large match lists

### P2 (Medium)
- Dark/light theme toggle
- Player comparison charts with Recharts
- Match filtering by date range
- Tournament grouping view

## Next Tasks
1. Test with real user credentials
2. Add more detailed point analysis (heatmaps)
3. Implement player statistics page
4. Add match notes/comments viewing
5. Integrate with push notifications

## Tech Stack
- Frontend: React 19, TailwindCSS, Shadcn/UI
- External Backend: FastAPI (https://lev.jsb.mybluehost.me:8001)
- Auth: JWT Bearer token

## Update Jan 2026 - Court Visualization Enhancement

### Changes Made:
- ✅ Replaced SVG court drawing with real squash court image (wood floor texture)
- ✅ Added realistic squash ball visualization with two yellow dots (characteristic of squash balls)
- ✅ Implemented step-by-step point sequence playback
- ✅ Play/Pause/Reset/Step Forward/Step Back controls
- ✅ Speed control (Slow/Normal/Fast)
- ✅ Score tracking during playback
- ✅ Point reason display (Nick, Boast, Winner, Error, etc.)
- ✅ Color coding: Green border = won point, Red border = lost point
- ✅ Trail lines connecting consecutive points

### Technical Notes:
- Court image URL: https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ipnldsxo_squash-court.png
- Coordinates from API (position_x, position_y) are 0-1 values that map directly to image percentages
- Demo page available at /demo for testing without authentication
