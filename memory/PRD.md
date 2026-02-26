# Squash Coach Dashboard - PRD

## Original Problem Statement
Dashboard web page to access information from an existing "Squash Coach" backend API at `https://lev.jsb.mybluehost.me:8001`.

## Core Requirements
- Login/Register with email
- View list of matches (read-only)
- View detailed match analysis with step-by-step visual representation on squash court
- View matches shared by other users
- View player lists
- Analyze head-to-head performance between two players within a date range

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Axios
- **Backend**: FastAPI (minimal, frontend calls external API directly)
- **External API**: `https://lev.jsb.mybluehost.me:8001`
- **Auth**: JWT via Bearer token, stored in localStorage

## What's Been Implemented

### Authentication
- Login, Register, Logout via AuthContext
- JWT Bearer token auth with external API

### Pages
- **Dashboard**: Overview page
- **Matches**: List of matches
- **Match Detail**: Per-game court visualization with point-by-point playback, broadcast scoreboard. Tabs: Todos, G1, G2, Stats. Stats tab includes: match summary, Efectividad de Puntos with bars, Top 5 Motivos with visual bars, Resultados por Juego.
- **Players**: Player list
- **Analysis (Head-to-Head)**: Full analysis with heatmaps, effectiveness, Top 5 reasons, match list
- **Shared Matches**: Matches shared by other users

### Analysis Page Features (Feb 26, 2026)
- Player selection with date range filters (controlled popover calendars)
- Stats grid: Partidos, Puntos Totales, Victorias, Games
- Efectividad de Puntos with percentage and comparison bar
- 3 Court Heatmaps (4x6 grid): Player 1 (blue #2196F3), All (purple #9C27B0), Player 2 (orange #FF5722)
- Top 5 Motivos de Punto with split bars per player
- Partidos Analizados list with results and dates

### Match Detail Enhancements (Feb 26, 2026)
- "Todos" tab to show all points across all games
- Top 5 Motivos with visual green/red bars
- Efectividad de Puntos with percentages and bar
- Game-filtered stats

### Squash Court Visualization
- Custom court image background
- Step-by-step point playback with slider
- Animated ball sequences with broadcast scoreboard
- Correct aspect ratio (0.713:1)

## Bug Fixes
- **Analysis page data mismatch** (Feb 26): API returns `{matches_count, matches[], points[]}` but component expected different fields. Fixed with data transformation.
- **Date pickers not closing** (Feb 26): Made Popover controlled with open/onOpenChange state.
- **CORS** (Feb 26): User enabled CORS on external API server.

## Known Limitations
- `DemoCourt.jsx` uses hardcoded mock data (development aid)

## Backlog
- Clean up/remove DemoCourt.jsx for production
- No outstanding feature requests
