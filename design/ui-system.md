# Pi UI System Contract

## Status

This document is the implementation contract for the Pi component library and stylesheet architecture. It turns the visual decisions in `../DESIGN.md` into ownership rules interfaces migration boundaries and acceptance criteria.

`DESIGN.md` is the sole visual source of truth. Existing rules in `app/assets/css/main.css` and visual claims in other product documents do not override it. Product naming and feature copy remain product decisions and are outside this contract.

## Design Direction

The product is a dense local coding agent workspace rather than a marketing site or a generic dashboard.

- Canvas uses the cold neutral background from `tokens.css`
- Surfaces are flat and separated by hairline borders
- Signal blue is reserved for current selection primary submission keyboard focus and running work
- Success warning and danger keep their semantic meaning and always pair color with text
- UI body uses the sans token technical values use the mono token only when users need to copy inspect or compare them
- Buttons and inputs use 6px corners containers use 8px corners Composer and image previews may use 12px corners
- Shadows belong only to transient layers such as dialogs popovers drawers and Composer
- Primary actions remain one per local action surface

The system must not introduce large rounded card grids decorative gradients filler metrics or decorative status chips. It must preserve the three column workspace the message reading width and the overlay behavior at narrow widths defined by `DESIGN.md`.

## Ownership Model

```text
DESIGN.md
  visual rules and product interaction principles

design/tokens.css
  raw semantic values and light dark substitutions

app/assets/css/main.css
  import manifest and layer order only

app/assets/css/foundation
  reset typography focus reduced motion

app/assets/css/layout
  workspace shell three columns drawers and breakpoints

app/components/pi
  reusable Pi primitives with their own visual and accessibility behavior

app/assets/css/features
  cross component workflow styles and DOM generated outside a Vue template

app/components
  domain behavior and domain layout composed from Pi primitives
```

The ownership seam is intentional:

- `Pi*` primitives own repeated control geometry interaction state and accessible behavior
- Domain components own workflow specific layout and wording
- Foundation owns browser wide behavior only
- Layout owns the workspace frame only
- Feature styles own a cross component workflow or DOM generated outside a Vue template
- No domain component may redefine a primitive color radius shadow focus ring or disabled style

## File Layout

```text
app/
  assets/css/
    main.css
    foundation/
      reset.css
      base.css
      accessibility.css
    layout/
      workspace.css
      responsive.css
    features/
      conversation.css
      inspector.css
      capability-center.css
      markdown.css
  components/
    pi/
      PiButton/
        index.vue
        style.css
      PiIconButton/
        index.vue
        style.css
      PiInput/
        index.vue
        style.css
      PiPopover/
        index.vue
        style.css
      PiStatusTag/
        index.vue
        style.css
      PiEmptyState/
        index.vue
        style.css
      PiDialog/
        index.vue
        style.css
```

`main.css` must only declare layer order and import the files above. It must not contain selectors for `ChatComposer` `FileViewer` `CapabilityCenterModal` or any other domain component.

The component directory uses the existing project term `Pi` rather than the generic `ui`. The prefix also prevents names such as `Button` or `Dialog` from obscuring whether a component is native browser markup or a project primitive.

## Component Style Layout

Every Pi primitive uses a directory module. Its `index.vue` owns props emits keyboard behavior and accessibility while its sibling `style.css` owns all visual selectors inside the `primitives` layer.

Domain components remain flat by default. A domain component may become a directory module only when a long local stylesheet or a tightly coupled visual interaction would make the SFC difficult to navigate. This is a maintenance decision not a naming convention. Small components must not gain a directory merely for symmetry.

Cross component workflow styles may stay in `app/assets/css/features` when splitting them into scoped files would duplicate the same selectors or break the surface level relationship. Every selector in such a file must begin with that workflow root.

## Reuse Gate

A `Pi*` module is introduced only when it passes all three checks below:

1. At least two independent domain surfaces need the same interface
2. The module hides shared visual state keyboard behavior or accessibility behavior rather than only shared markup
3. Removing the module would force the same rules to reappear in each consumer

Different controls do not qualify merely because they are both `button` or both `input`. A feature specific row tab tree item or prompt editor remains local when its selection model keyboard behavior or layout differs from the other caller.

No primitive may gain a catch all variant to force unrelated consumers together. When a new caller needs an extra prop that changes layout semantics or interaction ownership it must either use composition slots or remain a domain control.

`PiDialog` does not pass this gate today. `CapabilityCenterModal` is the only independent native dialog surface. The unsaved draft warning is part of that same flow and must not be counted as a second consumer. Keep the dialog lifecycle inside `CapabilityCenterModal` until a second independent modal task exists. The `PiDialog.vue` path is reserved but it is not a first phase deliverable.

## Current Reuse Inventory

The table is the evidence required before extraction. It must be updated whenever a primitive gains or loses a consumer.

| Candidate | Current independent consumers | Extraction decision |
| --- | --- | --- |
| `PiButton` | `NewSessionForm` `WorkspaceSelector` `ModelsPanel` `ExtensionsPanel` `GeneralSettingsPanel` | Extract immediately for text commands with primary secondary ghost and danger intent |
| `PiIconButton` | App shell sidebar toggle Chat header actions Composer send stop and attachment controls File explorer actions Capability center actions | Extract immediately because focus target sizing labels tooltips and disabled behavior repeat across surfaces |
| `PiInput` | `SidebarSearchInput` `ResourceSearchInput` `NewSessionForm` `WorkspaceSelector` session rename and capability settings fields | Extract immediately with optional leading trailing and clear affordances The Composer textarea remains domain owned |
| `PiPopover` | Composer model thinking and quick prompt menus Workspace selector menu Chat usage detail | Extract immediately for trigger relation dismissal Escape focus restoration and floating surface behavior Menu contents remain local slots |
| `PiStatusTag` | Capability model skill extension states Tool call status Chat compacting state | Extract immediately for compact text status treatment The context usage ring remains a domain visualization |
| `PiEmptyState` | Empty chat File explorer empty result Capability model skill and extension empty states Tool result without text | Extract immediately for title description icon and optional recovery action layout |
| `PiDialog` | `CapabilityCenterModal` only | Defer until a second independent dialog surface exists |

`SidebarSearchInput` and `ResourceSearchInput` are especially important migration evidence. They already implement the same searchable field shape with leading icon clear action accessible label and `v-model`. They should become thin domain adapters only if their surrounding layout remains different otherwise they should be deleted in favor of direct `PiInput` use.

## Cascade Rules

The entire application uses one explicit cascade order:

```text
reset -> theme -> base -> layout -> primitives -> features -> utilities
```

- `design/tokens.css` and the Tailwind theme mapping belong to `theme`
- Browser normalization belongs to `reset`
- Typography focus rings and reduced motion belong to `base`
- Workspace geometry and breakpoints belong to `layout`
- `Pi*` component styles belong to `primitives`
- Domain styles belong to `features`
- Tailwind utilities belong to `utilities`

All authored rules must belong to a layer. Unlayered CSS is forbidden because it silently overrides normal layered rules. Tailwind is permitted for one off local layout such as `flex` `gap` and width constraints. It must not carry repeated visual roles or arbitrary palette values in templates.

## Token Rules

`design/tokens.css` is the only source of literal design values. Components consume semantic variables such as `--ds-surface` `--ds-line` and `--ds-primary`.

The following are prohibited outside `tokens.css` and syntax highlight theme definitions:

- Hex RGB HSL and `color-mix` values for ordinary UI surfaces borders and text
- New radius shadow duration or easing values
- Arbitrary Tailwind palette classes and arbitrary color utilities
- `!important` except a documented generated markdown compatibility case

New visual roles require a token change first. A domain component must not create a local substitute such as a different selected blue or a private gray panel.

## Pi Primitive Interfaces

Each primitive is a deep module. Callers choose semantic intent and content while the primitive owns the visual states keyboard behavior and accessibility details.

| Module | Public interface | Owns | Must not own |
| --- | --- | --- | --- |
| `PiButton` | `variant` primary secondary ghost danger `size` compact default `loading` disabled and native button attributes | Text command layout loading disabled focus and button variants | Navigation rows destructive confirmation policy or feature spacing |
| `PiIconButton` | Required accessible `label` optional `tooltip` string or `false` `variant` ghost secondary danger `size` compact default | Square hit area icon alignment tooltip and focus treatment | A text label hidden only by CSS or an icon without an accessible name |
| `PiInput` | `v-model` `type` `invalid` `disabled` `placeholder` `label` `clearable` native input attributes and leading trailing slots | Field geometry focus invalid disabled clear affordance and text selection states | Field label helper copy validation policy search result layout or Composer textarea behavior |
| `PiPopover` | `v-model:open` `placement` `label` `role` and trigger content slots | Trigger relation outside click Escape focus restoration and floating surface treatment | Model selection quick prompt data or menu item business actions |
| `PiDialog` | Reserved until the reuse gate passes | Future native dialog lifecycle focus trap focus restoration Escape backdrop and viewport layer | Dirty state confirmation copy save behavior or dialog page content |
| `PiStatusTag` | `tone` neutral active success warning danger and text slot | Compact status geometry semantic color and mono numeric treatment | A state represented by color alone or a generic category chip |
| `PiEmptyState` | `title` `description` optional action slot and optional icon slot | Empty state hierarchy spacing and action placement | Loading error retry policy or fake instructional content |

All primitives provide default hover focus active disabled and reduced motion states when applicable. Variants are closed literal unions. Callers must not pass free form colors classes or style objects to alter a primitive visual role.

`PiButton` and `PiIconButton` are command controls only. A session row file row tab or selectable list item remains a domain component because its interaction contract is different.

`PiPopover` is not a substitute for `PiDialog`. A popover presents reversible local choices. A dialog blocks the workspace for a task that needs focus confirmation or an isolated management surface.

## Domain Composition Rules

| Existing surface | Primitive migration | Domain ownership retained |
| --- | --- | --- |
| Session sidebar and workspace selector | `PiIconButton` for utility actions `PiInput` for search `PiEmptyState` for no sessions | grouping filtering selection and rename flow |
| Chat header and notices | `PiIconButton` `PiStatusTag` `PiPopover` | title rename usage calculation notice lifecycle |
| Composer | `PiIconButton` `PiPopover` `PiStatusTag` | prompt history attachments model switching completion and sending |
| File explorer and viewer | `PiIconButton` `PiInput` `PiEmptyState` | tree recursion tabs file fetch and preview rendering |
| Capability center | 当前保留原生 dialog `PiButton` `PiIconButton` `PiInput` `PiStatusTag` `PiEmptyState` | tab model drafts save scope and resource API calls |
| Tool calls and thinking blocks | `PiStatusTag` where a compact text status is needed | execution pairing result rendering duration and progressive disclosure |

Migration must preserve native semantics already present in the application. `dialog` `tablist` `tab` `tabpanel` `role=status` `aria-live` and listbox interactions cannot be replaced by visually similar generic markup.

## Global Style Exceptions

Scoped styles are the default for `Pi*` primitives and domain components. Global feature files are allowed only for:

- `.markdown-body` and Highlight.js descendants generated by `v-html`
- The root workspace shell and document level theme attributes
- Scrollbar normalization and reduced motion handling
- Explicitly teleported overlay compatibility that cannot be expressed inside its owner
- A cross component workflow such as the conversation stream Inspector or capability center where one root owns the visual relationship

Each global selector must start with its feature root. Selectors such as `button` `input` `.active` `.selected` and `.panel` are prohibited outside foundation rules because they create cross feature coupling.

## Responsive And Accessibility Contract

- Desktop at 1100px and above keeps the sidebar task canvas and optional Inspector readable
- From 760px through 1099px the Inspector overlays the canvas rather than shrinking the message column
- Below 760px sidebar and Inspector become drawers the primary Composer action stays reachable and icon targets are at least 40px
- Capability center becomes a viewport dialog below 1200px
- Keyboard focus always uses the tokenized 2px focus ring
- Icon only controls require a programmatic name and a tooltip
- Status always includes readable text in addition to color
- Disabled controls remain legible and errors identify the cause and recovery action
- `data-reduce-motion=true` and `prefers-reduced-motion` remove nonessential transitions and looping animation

## Migration Sequence

1. Replace `main.css` with the import manifest and move existing rules without visual changes into foundation layout and feature files
2. Establish explicit CSS layers and remove unlayered overrides before changing any component appearance
3. Implement and test `PiButton` `PiIconButton` `PiInput` `PiStatusTag` and `PiEmptyState`
4. Implement `PiPopover` by extracting behavior from the existing Composer Workspace selector and usage popover flows
5. Migrate domain components one surface at a time using the composition map above
6. Introduce `PiDialog` only when a second independent dialog surface exists and the reuse gate is recorded in this document
7. Delete the legacy selectors only after every caller has moved no compatibility override remains
8. Run the visual and interaction acceptance pass across light dark desktop tablet and mobile layouts

No phase may add a replacement rule to the end of the old stylesheet. A visual deviation must be resolved in the owning token primitive or feature module.

## Acceptance Criteria

- `main.css` is an import manifest with no domain selectors
- Every literal visual value has a token owner or an approved syntax highlighting exception
- Every reusable command control uses `PiButton` or `PiIconButton`
- Every reusable field uses `PiInput` or documents why native input behavior is required
- Every new public primitive has at least two independent documented consumers
- `PiDialog` is absent until it passes the reuse gate then every applicable modal uses it
- Every local selection menu uses `PiPopover`
- No primitive accepts arbitrary visual classes or inline style objects
- Light and dark themes render without undeclared hard coded colors
- Desktop tablet and mobile show no clipping overlap horizontal overflow or inaccessible controls
- The primary flow remains functional from workspace selection through message send tool execution file inspection and capability center close
- Visual QA compares the rendered workspace with the approved local reference screens and `DESIGN.md` for at least typography palette layout density spacing and responsive behavior
