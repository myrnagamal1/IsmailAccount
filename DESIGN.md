# Design system

## Direction

Scandinavian winter morning in a focused territory office: pure white daylight, cool blue structure, dark ink, and quiet functional color. Product density is compact without feeling cramped.

## Color strategy

Restrained. Neutral surfaces carry the workspace while cobalt blue is reserved for primary actions and selection. Category and pipeline colors are semantic.

```css
--bg: oklch(1 0 0);
--panel: oklch(0.975 0.004 256);
--panel-strong: oklch(0.945 0.008 256);
--border: oklch(0.885 0.012 256);
--fg: oklch(0.205 0.025 256);
--fg-muted: oklch(0.46 0.025 256);
--primary: oklch(0.52 0.17 256);
--primary-hover: oklch(0.46 0.18 256);
--accent: oklch(0.72 0.15 75);
```

Dark mode uses a near-black neutral background, lifted cool-neutral panels, pale ink, and a lighter blue primary.

## Typography

- Interface: Inter with system-ui fallback.
- Page headings: Source Serif 4 with Georgia fallback.
- Fixed product scale from 12px metadata to 32px page titles.

## Components

- 10px panel radius; 8px control radius; pill radius only for chips and compact badges.
- Buttons, inputs, selects, tabs, and row actions share the same 36px control height.
- Data tables use sticky headers, 44–48px rows, clear selected states, and responsive overflow.
- Category markers combine a colored dot with a text label.
- Loading uses skeleton rows. Empty states teach the next action.

## Layout

Desktop uses a 224px sidebar and a flexible content column. Content has a maximum width of 1600px. Tablet collapses navigation to a compact top row. Mobile presents tables as scrollable data surfaces without hiding core fields.

## Motion

Use 160–220ms ease-out transitions only for state change, navigation, menus, and feedback. Respect `prefers-reduced-motion`.
