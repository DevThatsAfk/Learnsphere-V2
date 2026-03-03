# Reference: UI Aesthetic Overhaul (Transition from Dark to Light)

A case study in transforming a "gloomy" developer-style UI into an "energetic" academic-style UI.

## 1. The Color Shift
| Property | Old (Dark) | New (Light Academic) | Rationale |
|---|---|---|---|
| **Background** | `#020617` (Deep Indigo) | `#f8faff` (Cool White) | High energy, less eye strain for reading long notes. |
| **Surfaces** | `#1e293b` (Slate Card) | `#ffffff` (Pure White Card) | Crisp edges, modern "clean" look. |
| **Borders** | `rgba(255,255,255,0.1)` | `#e4e8f4` (Soft Sky) | Subtlety while maintaining structure. |
| **Primary** | Flat Violet | Gradient Indigo | Feel "premium" and academic. |

## 2. Component Design Principles
- **Minimalist Sidebar**: White background with a single-pixel right border. Active links use a **3px indigo left-border** instead of a full background highlight to reduce visual noise.
- **Glassmorphic Login**: Use of mesh gradients (Indigo/Mint blobs) on the login screen to create a "youthful" but focused entrance.
- **Elevation**: Use of two-tier shadows. `shadow-card` (standard) and `shadow-card-md` (on hover) to create a sense of depth.

## 3. Implementation Process
1. **Config Update**: First, update `tailwind.config.js` with semantic tokens (`surface-50`, `surface-0`, `emerald`).
2. **Global CSS**: Rewrite `index.css` using the `@apply` directive to map new Tailwind tokens to standard utility classes (`.card`, `.btn-primary`).
3. **App Shell**: Update the persistent layout (`AppShell.tsx`) to match the new sidebar and background system.

---
*Reference: See `client/src/index.css` for the complete implementation of the new design system.*
