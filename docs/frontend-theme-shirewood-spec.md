# Shirewood Theme Spec

## Purpose
This spec defines a concrete frontend theme direction for Fendtastic where the interface feels as if it were designed by an ent or hobbit, while remaining usable as an industrial control application.

The theme is named `Shirewood` in this document to keep references short. The intended effect is:
- carved wood, bark, brass, parchment, sap, moss
- branching and dendritic information flow where relationships matter
- warm, hand-made surfaces around dense technical controls
- no photoreal fantasy UI, no game HUD styling, no novelty at the expense of legibility

This spec is written against the current frontend structure:
- theme root: [frontend/src/themes/murphTheme.ts](/home/earthling/Documents/Focus/fendtastic/frontend/src/themes/murphTheme.ts)
- global CSS: [frontend/src/index.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/index.css), [frontend/src/App.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/App.css)
- top navigation: [frontend/src/components/Header.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/Header.tsx)
- runtime shell: [frontend/src/components/runtime/RuntimeShell.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/RuntimeShell.tsx)
- runtime nav: [frontend/src/components/runtime/SectionNav.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/SectionNav.tsx)
- inspector: [frontend/src/components/runtime/InspectorPanel.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/InspectorPanel.tsx)
- binding flow: [frontend/src/components/runtime/BindingDesigner.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/BindingDesigner.tsx)

## Design Rules
1. Organic framing, technical interior
- Shells, headers, section boundaries, and navigation carry most of the theme.
- Dense forms, tables, and telemetry remain clean and readable inside those shells.

2. Asymmetry with discipline
- Use slightly irregular borders, notch cuts, bark edges, and branch dividers.
- Do not distort field alignment, table layout, or status labels.

3. Dendritic flow only where structure benefits
- Apply branching connectors to binding, capability, topology, and workflow views.
- Do not force branch lines into every list or form.

4. Materials must read as crafted, not photoreal
- Use vector ornament, gradients, grain overlays, and masks.
- Avoid bitmap wood photos and heavy textures.

5. Accessibility remains non-negotiable
- All text and critical states must keep industrial-grade contrast.
- Color is never the only carrier of status.

## Visual Language

### Material Story
- Primary shell material: dark walnut / bark-brown timber
- Interior surface: parchment fiber / warm clay wash
- Accent metal: aged brass
- Energy accent: amber sap glow
- Health accent: moss green
- Error accent: ember red
- Info accent: river-teal, used sparingly

### Spatial Story
- Global layout feels like carved panels mounted into a workshop wall.
- Section transitions feel like moving between alcoves or workbenches.
- Relationship lines feel root-like or branch-like, not like PCB traces.

## Color Tokens
Replace the current Mars-rust palette with theme variables and map them through MUI.

### Core tokens
```css
:root {
  --shirewood-bark-900: #16110d;
  --shirewood-bark-800: #211711;
  --shirewood-bark-700: #2f2219;
  --shirewood-walnut-600: #4e3422;
  --shirewood-walnut-500: #6b472c;
  --shirewood-walnut-400: #8b5e37;
  --shirewood-parchment-200: #dbc6a1;
  --shirewood-parchment-100: #efe3c7;
  --shirewood-brass-500: #b08a3a;
  --shirewood-brass-400: #c8a252;
  --shirewood-sap-500: #d79b2d;
  --shirewood-sap-400: #f0b84b;
  --shirewood-moss-500: #557a3e;
  --shirewood-moss-400: #6d9a4f;
  --shirewood-ember-500: #b24a2d;
  --shirewood-ember-400: #d9623c;
  --shirewood-river-500: #4f7c7b;
  --shirewood-river-400: #6d9a98;
  --shirewood-ink-100: #f6f0e5;
  --shirewood-ink-300: #d7cfbf;
  --shirewood-shadow: rgba(0, 0, 0, 0.42);
}
```

### MUI palette mapping
- `primary`: walnut / brass blend for shell CTA surfaces
- `secondary`: sap amber
- `success`: moss
- `warning`: sap
- `error`: ember
- `info`: river
- `background.default`: bark-900
- `background.paper`: bark-800
- `text.primary`: ink-100
- `text.secondary`: ink-300

## Typography
The current `Rajdhani` and `JetBrains Mono` pairing is too synthetic for this art direction.

### Recommended font roles
- Display / headings: `Cormorant SC` or `Alegreya SC`
- Body UI: `Source Serif 4` or `Literata`
- Monospace / tags / addresses / telemetry: keep `JetBrains Mono`

### Rules
- Headings use small caps or all caps sparingly.
- Forms and dense controls use body font, not display font.
- Monospace remains mandatory for PLC addresses, IDs, timestamps, and protocol values.

### Mapping
- `h1-h4`: display font
- `h5-h6`: body font, semibold
- `body1-body2`: body font
- `button`: body font, semibold
- `caption`, code, telemetry: monospace

## Texture And Surface System

### Surface levels
1. `Canopy`
- App background and top-level pages
- dark bark gradient with subtle canopy shadow overlay

2. `Plaque`
- cards, inspectors, nav blocks, section containers
- warm wood frame, parchment or clay inner panel

3. `Carved control`
- buttons, tabs, chips
- shallow carved edge, brass pin accents, light grain overlay

4. `Inset well`
- text fields, selects, tables, editors
- recessed inner surface, lower ornament, focus ring in sap or moss

### Texture policy
- One grain tile
- One parchment/fiber surface
- One canopy shadow pattern
- One bark edge mask
- No photo textures

## Motion
Use motion sparingly and only to reinforce the “growing” or “crafted” feel.

### Allowed motion
- page/section reveal: staggered vertical unfurl, 120-220ms
- hover: slight sap sheen sweep, 120ms
- active nav selection: branch-node pulse, 180ms
- panel open: settle-in shift, 140ms

### Avoid
- bounce
- rubber-band scaling
- long ambient animation loops
- decorative particle effects

### Library
- Use `framer-motion` only if the static theme lands first.
- Do not add animation until the component surfaces and tokens are stable.

## Library Decisions

### Keep
- `@mui/material`
- `@mui/system`
- inline SVG or SVGR for vector assets

### Add only if needed
- `framer-motion` for reveals and state transitions
- `d3-shape` for procedural branch connectors in binding and capability views

### Do not add
- WebGL or canvas renderers for theming
- texture-heavy art packages
- fantasy UI kits

## Component Spec

### App shell
Target files:
- [frontend/src/App.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/App.css)
- [frontend/src/index.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/index.css)
- [frontend/src/themes/murphTheme.ts](/home/earthling/Documents/Focus/fendtastic/frontend/src/themes/murphTheme.ts)

Behavior:
- Replace flat black background with layered bark gradient and faint canopy shadow overlay.
- Add CSS variables for all theme tokens.
- Standardize scrollbar styling to brass thumb on bark track.

### Header
Target file:
- [frontend/src/components/Header.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/Header.tsx)

Treatment:
- Convert the app bar into a carved beam or lintel.
- Brand area becomes a plaque with inset icon.
- Nav chips become carved trail markers or signboards.
- Status chips become lantern badges with ring + glyph + text.
- Clock remains technical and monospace, visually subordinate.

Do not:
- Turn the header into a decorative banner that increases height materially.

### Runtime shell
Target file:
- [frontend/src/components/runtime/RuntimeShell.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/RuntimeShell.tsx)

Treatment:
- Left nav and right inspector should feel like two carved side-frames around a central workbench.
- Main workspace keeps strong contrast and simpler surfaces.

### Section nav
Target file:
- [frontend/src/components/runtime/SectionNav.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/SectionNav.tsx)

Treatment:
- Replace flat buttons with stacked carved slats.
- Active state adds a branch-node indicator on the left.
- Hover state adds brass edge glow and slight grain highlight.

### Inspector panel
Target file:
- [frontend/src/components/runtime/InspectorPanel.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/InspectorPanel.tsx)

Treatment:
- Outer frame: plaque frame SVG or CSS mask
- Inner background: parchment or smoked clay
- Status chip: resin seal or lantern stamp, not standard MUI chip styling

### Buttons
Targets:
- global MUI override in [murphTheme.ts](/home/earthling/Documents/Focus/fendtastic/frontend/src/themes/murphTheme.ts)
- local custom variants where high emphasis is needed

Button families:
1. `wood-primary`
- medium walnut face
- brass border pins
- sap highlight on hover

2. `wood-secondary`
- darker carved face
- lighter text

3. `tool-button`
- flatter, utilitarian control for tables and dense editors
- minimal ornament

Pressed state:
- 1px downward shift
- stronger inset shadow

Disabled state:
- dry ash-brown, low saturation

### Inputs
Targets:
- MUI `MuiOutlinedInput`, `MuiTextField`, `MuiSelect`
- dense runtime editors like [RuntimeNodeEditor.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/RuntimeNodeEditor.tsx)

Treatment:
- Recessed well
- Focus ring uses sap or moss depending on context
- Labels use body serif, not futuristic caps
- Validation states remain clear and explicit

### Tables
Targets:
- [BindingDesigner.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/BindingDesigner.tsx)
- driver editors and status tables

Treatment:
- Header row gets carved divider strip
- Body rows remain simple
- Row hover can use faint parchment highlight
- Gridlines should be low contrast, like scored wood or ink lines

Do not:
- Add ornament per cell
- Add textured row backgrounds

### Chips and status
Targets:
- header chips
- authority chips
- inspector chips

Treatment:
- chips become seals, medallions, or lantern tags
- status colors:
  - online/ok: moss
  - warning: sap
  - error/offline: ember
  - info: river

### Dendritic flow
Primary target:
- [BindingDesigner.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/BindingDesigner.tsx)

Secondary targets:
- future capability graph
- runtime topology views

Treatment:
- Use SVG branch connectors between canonical tags and driver tags.
- Branch joints look like knots or buds.
- Connector line weights taper slightly at branches.
- Active/selected mapping glows with sap amber.

Do not:
- Replace the editable mapping table with a fully diagrammatic UI
- Make connectors the only way to understand relationships

## SVG Asset Inventory
Create these in `frontend/src/assets/theme/shirewood/`.

### Core shell assets
1. `grain-tile.svg`
- seamless low-contrast wood grain tile
- used as subtle overlay only

2. `canopy-shadow.svg`
- soft leaf-shadow pattern for page background

3. `plaque-frame.svg`
- scalable frame for panels and inspectors

4. `bark-edge-mask.svg`
- irregular edge mask for shells and major nav blocks

5. `carved-divider.svg`
- horizontal divider for section headers

### Control assets
6. `button-face-primary.svg`
- wood button face with shallow bevel

7. `button-face-secondary.svg`
- darker carved control face

8. `button-pin.svg`
- brass pin or rivet detail

9. `input-notch.svg`
- subtle notch ornament for field corners

10. `status-lantern-ring.svg`
- ring used in status chips and node badges

### Connector assets
11. `branch-connector-straight.svg`
- simple curved connector

12. `branch-connector-fork.svg`
- forked connector for one-to-many relationships

13. `branch-node.svg`
- knot or bud node at intersections

### Ornament assets
14. `corner-knot.svg`
- corner accent for high-level shells only

15. `leaf-tab-notch.svg`
- tab or nav notch mask

16. `seal-stamp.svg`
- used behind authority and status chips

## Icon Direction
Use a consistent vector line style:
- slightly tapered strokes
- carved or engraved feel
- avoid cartoon leaves or overt fantasy ornament

Needed icon concepts:
- home / burrow
- branch / topology
- lantern / status
- satchel / config
- hammer / engineering
- gate / deploy
- acorn / runtime node
- root / binding

If MUI icons are kept initially, wrap them in carved badge containers before replacing the glyphs themselves.

## Theme Token Structure
Add CSS variables in [frontend/src/index.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/index.css) and feed them into [murphTheme.ts](/home/earthling/Documents/Focus/fendtastic/frontend/src/themes/murphTheme.ts).

Recommended groups:
- `--shirewood-color-*`
- `--shirewood-surface-*`
- `--shirewood-shadow-*`
- `--shirewood-radius-*`
- `--shirewood-spacing-*`
- `--shirewood-texture-*`

Radius tokens:
- `--shirewood-radius-s`: `8px`
- `--shirewood-radius-m`: `14px`
- `--shirewood-radius-l`: `22px`

Use clipped or notched corners selectively. Do not make every component highly rounded.

## Implementation Plan

### Phase 1: token foundation
Files:
- [frontend/src/index.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/index.css)
- [frontend/src/App.css](/home/earthling/Documents/Focus/fendtastic/frontend/src/App.css)
- [frontend/src/themes/murphTheme.ts](/home/earthling/Documents/Focus/fendtastic/frontend/src/themes/murphTheme.ts)

Deliver:
- color tokens
- typography changes
- surface tokens
- baseline MUI overrides for `Paper`, `Card`, `Button`, `Chip`, `OutlinedInput`, `AppBar`

### Phase 2: navigation and shell
Files:
- [frontend/src/components/Header.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/Header.tsx)
- [frontend/src/components/runtime/RuntimeShell.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/RuntimeShell.tsx)
- [frontend/src/components/runtime/SectionNav.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/SectionNav.tsx)
- [frontend/src/components/runtime/InspectorPanel.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/InspectorPanel.tsx)

Deliver:
- carved header
- plaque-style nav
- inspector shell
- status medallions

### Phase 3: form and control pass
Files:
- [frontend/src/components/runtime/RuntimeNodeEditor.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/RuntimeNodeEditor.tsx)
- [frontend/src/components/runtime/DriverInstanceEditor.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/DriverInstanceEditor.tsx)
- [frontend/src/components/runtime/SchemaForm.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/SchemaForm.tsx)
- [frontend/src/components/runtime/TagEditorPanel.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/TagEditorPanel.tsx)

Deliver:
- inset wells
- refined labels
- tool-button variant
- dense editor cleanup

### Phase 4: dendritic interaction surfaces
Files:
- [frontend/src/components/runtime/BindingDesigner.tsx](/home/earthling/Documents/Focus/fendtastic/frontend/src/components/runtime/BindingDesigner.tsx)
- future capability graph components

Deliver:
- branch connectors
- knot nodes
- active mapping emphasis
- no regression in editability

## Explicit Non-Goals
- No photoreal fantasy environment art
- No medieval parody
- No replacement of precise engineering tables with decorative diagrams
- No textured backgrounds behind every control
- No custom canvas renderer for general UI

## Acceptance Criteria
1. The app still reads as an engineering console first.
2. A user can still edit runtime nodes, drivers, bindings, and authority without extra clicks.
3. Buttons, panels, and nav clearly carry the crafted wood / bark / plaque language.
4. Binding relationships can use dendritic connectors without losing form precision.
5. Status remains readable in grayscale or low-saturation conditions.
6. Dense editors remain visually quieter than shell/navigation surfaces.

## Questions To Resolve Before Implementation
1. Scope: should `Shirewood` apply repo-wide, or only to `Runtime Studio` first?
2. Typography: are you comfortable adding web fonts, or do you want a local/system-font-only solution?
3. Art direction bias: should this lean more `ent workshop` or more `hobbit study`?
4. Status tone: should the UI stay darker and more control-room oriented, or should it become warmer and lighter overall?
5. Dendritic flow: do you want actual branch connectors in the binding editor in phase 1, or only after the shell/theme pass is stable?

