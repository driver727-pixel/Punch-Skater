# Board Component Assets

Static board images used by the board builder.

---

## Retired assembled-board overlays

The legacy `BoardComposite` pipeline has been retired and the app no longer
loads assembled overlay PNGs from `public/assets/boards/`.

Keep this directory only for historical reference or future redesign work.
It is not part of the live card-rendering pipeline.

---

## BoardPreviewGrid images (`public/assets/boards/<category>/`)

These are the component images shown on the **assembly canvas**
above the conveyor belts inside the board builder. The app layers the selected
deck, drivetrain, motor, wheels, and battery together on one shared backdrop.

### How images are matched to components

When a rider selects a component on the conveyor belt the app looks through
the known component asset filenames in that category folder and finds the one whose **filename contains
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
| `4wd` | 4WD |

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
public/assets/boards/deck/street.png                      → Street deck
public/assets/boards/deck/at-bamboo.png                   → AT deck
public/assets/boards/deck/mt-board.png                    → Mountain deck
public/assets/boards/deck/surf-skate.png                  → Surf deck
public/assets/boards/motor/5055-motor.png                 → Micro motor
public/assets/boards/wheels/poly-wheels.png               → Urethane wheels
public/assets/boards/battery/slim-battery.png             → Slim Stealth battery
```

### All category folders

| Folder                              | Shown when…             |
|-------------------------------------|-------------------------|
| `public/assets/boards/deck/`        | A deck type is selected |
| `public/assets/boards/drivetrain/`  | A drivetrain is selected|
| `public/assets/boards/motor/`       | A motor is selected     |
| `public/assets/boards/wheels/`      | A wheel type is selected|
| `public/assets/boards/battery/`     | A battery is selected   |

### Rules

* Include a keyword from the table above in the filename.
* Multiple keywords in one name are fine (e.g. `dual-belt-drive.png`).
* After updating images, redeploy the app so browsers can request the refreshed
  public assets.
* If you replace an existing file in place, bump the board asset version so
  browsers bypass stale cached images.
* Each `.gitkeep` file in these folders exists only to keep the folder tracked
  by Git — you can leave it in place alongside your images.

### Fallback behaviour

If no keyword match is found inside a folder the app picks a random image
from that folder. The resolved public asset URLs also include a version query
string so updated PNGs bypass stale browser caches. If no usable image exists,
the canvas shows a floating placeholder for the missing layer.
