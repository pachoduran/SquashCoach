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
- **Backend**: FastAPI (proxy - minimal usage, frontend calls external API directly)
- **External API**: `https://lev.jsb.mybluehost.me:8001`
- **Auth**: JWT via Bearer token, stored in localStorage

## What's Been Implemented
- Full auth flow (Login, Register, Logout) via AuthContext
- Dashboard, Matches, Match Detail, Players, Shared Matches pages
- Squash Court visualization with animated ball sequences and broadcast-style scoreboard
- Analysis Head-to-Head page with player selection, date filters, and stats display
- Responsive dark theme (black, yellow, gray)
- Sidebar (desktop) and BottomNav (mobile) navigation

## Bug Fixes (Feb 26, 2026)
- **Analysis page data mismatch**: API returns `{matches_count, matches[], points[]}` but component expected `{total_matches, player1_wins, ...}`. Fixed by transforming API response in `fetchAnalysis`.
- **Date pickers not closing**: Made Popover components controlled with `open`/`onOpenChange` state.
- **LoadingSpinner in button**: Replaced full-size spinner with inline spinner for button context.

## Known Limitations
- Date filter API calls may encounter CORS issues from external API (external API limitation)
- `DemoCourt.jsx` uses hardcoded mock data (development aid)

## Backlog
- Clean up/remove DemoCourt.jsx for production
- No outstanding feature requests
