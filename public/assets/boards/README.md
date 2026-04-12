# Board Component Assets

Static PNG images used by the board builder.

---

## BoardComposite layers (`public/assets/boards/`)

These are the **assembled-board overlay** images rendered by `BoardComposite`
(visible on the character card).  Each file uses the `<seedKey>.png` naming
convention defined in `BOARD_COMPONENT_CATALOG` inside
`src/lib/boardBuilder.ts`.

### Expected files

| seedKey                           | Component            |
|-----------------------------------|----------------------|
| `deck-carbon-street-drop-through` | Street deck          |
| `deck-bamboo-at-top-mount`        | AT deck              |
| `deck-off-grid-mountain-board`    | Mountain deck        |
| `deck-swallowtail-surf-skate`     | Surf deck            |
| `wheel-100mm-urethane-street`     | Urethane wheels      |
| `wheel-175mm-pneumatic-at`        | Pneumatic wheels     |
| `wheel-120mm-cloud-sliders`       | Cloud / rubber wheels|
| `drivetrain-dual-belt-drive`      | Belt drive trucks    |
| `drivetrain-sealed-gear-drive`    | Gear drive trucks    |
| `drivetrain-stealth-hub-motors`   | Hub motor trucks     |
| `battery-slim-stealth-pack`       | Slim Stealth battery |
| `battery-double-stack-brick`      | Double-Stack battery |
| `battery-top-mounted-peli-case`   | Top-Mounted Peli Case|

### Workflow

1. Open **Card Forge → Asset Generator** (admin only, `/dev/asset-generator`).
2. Click **⚡ Generate All** (or generate individual items).
3. Once images appear, click **⬇ Download** on each card — the browser will
   save the file with the correct `<seedKey>.png` filename automatically.
   Alternatively click **⬇ Download All** at the top to save every completed
   image in one pass.
4. Move the downloaded files to this folder (`public/assets/boards/`).

Until the PNGs are placed here the `BoardComposite` layers are simply invisible
(the component renders `null` when all URLs are absent).

---

## BoardPreviewGrid images (`src/assets/boards/<category>/`)

These are the **component grid preview** images shown in the composition box
above the conveyor belts inside the board builder.

### How images are matched to components

When a rider selects a component on the conveyor belt the app looks through
all PNGs in that category folder and finds the one whose **filename contains
a keyword** associated with the selected component.  The keyword-to-component
mapping is:

#### Deck

| Filename keyword | Board type  |
|-----------------|-------------|
| `street` or `carbon` | Street |
| `at` or `bamboo` | All-Terrain |
| `mountain` or `mt` | Mountain |
| `surf` | Surf |

| `slider` | Slider |

#### Drivetrain

| Filename keyword | Drivetrain |
|-----------------|------------|
| `belt` or `dual` | Belt Drive |
| `hub` | Hub Motor |
| `gear` | Gear Drive |
| `awd` | AWD |

#### Motor

| Filename keyword | Motor |
|-----------------|-------|
| `micro` or `5055` | Micro 5055 |
| `standard` or `6354` | Standard 6354 |
| `torque` or `6374` | Torque 6374 |
| `outrunner` or `6396` | Outrunner 6396 |

#### Wheels

| Filename keyword | Wheel type |
|-----------------|-----------|
| `urethane` or `poly` | Urethane |
| `pneumatic` | Pneumatic |
| `rubber` or `solid` | Solid Rubber |
| `cloud` | Cloud Wheels |

#### Battery

| Filename keyword | Battery |
|-----------------|---------|
| `slim` or `stealth` | Slim Stealth Pack |
| `double`, `stack`, or `brick` | Double-Stack Brick |
| `peli` or `top` | Top-Mounted Peli Case |

### Example filenames

```
src/assets/boards/deck/carbon-fiber.png      → Street deck
src/assets/boards/deck/at-bamboo.png         → AT deck
src/assets/boards/deck/mt-board.png          → Mountain deck
src/assets/boards/deck/surf-skate.png        → Surf deck
src/assets/boards/motor/5055-motor.png       → Micro motor
src/assets/boards/wheels/poly-wheels.png     → Urethane wheels
src/assets/boards/battery/slim-battery.png   → Slim Stealth battery
```

### All category folders

| Folder                              | Shown when…             |
|-------------------------------------|-------------------------|
| `src/assets/boards/deck/`           | A deck type is selected |
| `src/assets/boards/drivetrain/`     | A drivetrain is selected|
| `src/assets/boards/motor/`          | A motor is selected     |
| `src/assets/boards/wheels/`         | A wheel type is selected|
| `src/assets/boards/battery/`        | A battery is selected   |

### Rules

* Include a keyword from the table above in the filename.
* Multiple keywords in one name are fine (e.g. `dual-belt-drive.png`).
* After adding images, **commit and rebuild** the app; Vite picks them up at
  build time.
* Each `.gitkeep` file in these folders exists only to keep the folder tracked
  by Git — you can leave it in place alongside your images.

### Fallback behaviour

If no keyword match is found inside a folder the app picks a random image
from that folder.  If the folder is empty it falls back to
`public/assets/boards/<category>/<OptionValue>.png`
(e.g. `public/assets/boards/motor/Standard.png`).  If that file is also
absent the tile shows an icon placeholder.

