---
description: Workspace instructions for AdminPanel, a React TypeScript app for managing gym user subscriptions
---

# AdminPanel Workspace Instructions

This workspace contains a React + TypeScript application for managing gym subscription users. It's a single-page admin panel with user table, filtering, editing, and CSV export.

## Getting Started

See [README.md](README.md) for setup and development environment.

### Build Commands
- Development server: `npm run dev`
- Production build: `npm run build`
- Linting: `npm run lint`
- Preview build: `npm run preview`

## Architecture Overview

- **Tech Stack**: React 19, TypeScript, Vite
- **Structure**: Monolithic single-component app in [App.tsx](src/App.tsx)
- **Styling**: Inline CSS-in-JS (no external CSS files)
- **Data**: Currently uses mock data; no backend integration
- **State**: Local React state with useState/useMemo

### Key Components
- `AdminPanel`: Main component with table and detail views
- `StatCard`: Dashboard statistics cards
- `DetailRow`: Detail panel rows

## Development Conventions

### Code Style
- TypeScript with strict settings (noUnusedLocals, noUnusedParameters)
- React functional components with hooks
- JSX transform (no React import needed)
- ESLint with React hooks and refresh plugins

### Data Handling
- User types: `AdminUser`, `UserStatus` (active|inactive|expired), `UserRole` (admin|user)
- Date utilities: `parseLocalDate`, `toStartOfDay`, `daysLeft`, `formatDate`
- **Important**: Dates are handled as local time (not UTC); be aware of timezone issues

### UI Patterns
- Inline editing in table rows
- Toggle buttons for status changes
- Search/filter functionality
- Responsive grid layouts

## Common Pitfalls

- **Empty mock data**: `mockUsers` starts empty; app appears blank initially
- **Date calculations**: Timezone-naive; may cause issues with DST or different locales
- **Monolithic component**: [App.tsx](src/App.tsx) is 1500+ lines; consider extracting components/styles for maintainability
- **No tests**: No testing framework configured; add tests for reliability
- **Hardcoded i18n**: Spanish labels hardcoded; no internationalization setup

## Scaling Considerations

For production use:
- Extract components into separate files
- Move styles to CSS modules or styled-components
- Add backend API integration
- Implement proper state management (Context/Redux)
- Add comprehensive test suite
- Handle internationalization

## File Organization

- `src/App.tsx`: Main application component
- `src/main.tsx`: React entry point
- `src/index.css`: Global styles
- `src/assets/`: Static assets
- `package.json`: Dependencies and scripts
- `vite.config.ts`: Build configuration
- `tsconfig.*.json`: TypeScript configurations