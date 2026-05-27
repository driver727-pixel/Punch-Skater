import { createSeededRandom } from "./prng";

export type BoardPoseSceneKey = "workshop" | "loadout" | "airborne" | "showcase" | "painting" | "wheels" | "cleaning";

export interface BoardPoseScene {
  key: BoardPoseSceneKey;
  characterPrompt: string;
  imagePrompt: string;
}

const CHARACTER_LAYER_ONLY =
  "draw only the courier's body and clothing; keep the reserved compositing area completely empty with no props, no vehicles, no gear, and no background objects";

export const BOARD_POSE_SCENES: BoardPoseScene[] = [
  {
    key: "workshop",
    characterPrompt:
      `crouching or kneeling slightly left of center, both hands working low in the foreground while leaving a long clear empty gap near the feet — adjusting an unseen component just outside the character layer — gaze aimed downward at the empty work area; functional hands-on repair pose; keep the body pulled slightly back from the camera with visible boots and clear negative space for later compositing; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "crouching beside their full electric skateboard and tightening a truck bolt or repairing a component, focused hands-on workshop repair pose, board fully visible in frame",
  },
  {
    key: "loadout",
    characterPrompt:
      `standing slightly left of center in a confident hero stance — arms crossed, fist raised, or one arm extended — with the full right side kept clear from shoulder to boots as an empty reserved compositing zone; gaze forward or slightly to the side; keep the figure zoomed out with comfortable headroom and open space around the legs; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "standing in a confident hero loadout stance with their full electric skateboard upright beside them like essential mission gear, fully visible in frame",
  },
  {
    key: "airborne",
    characterPrompt:
      `fully airborne — launched high with bent knees, arm thrown out for balance, or throwing a punch mid-flight — body elevated well above the lower half of the frame; aggressive athletic air pose with strong upward energy; leave the lower frame open as a clean empty compositing zone beneath or beside the body; keep the subject zoomed out with visible boots and clean negative space; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "launched fully airborne mid-trick, body high in the air above their electric skateboard below, bent knees and arms out for balance, full board clearly visible in frame",
  },
  {
    key: "showcase",
    characterPrompt:
      `standing slightly left of center with a satisfied smile or impressed gaze, one hand gesturing or pointing proudly toward a clean empty display area on the right; weight shifted to one hip, relaxed proud stance directed at the reserved compositing zone; keep that zone completely open beside them; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "standing proudly and gesturing admiringly toward their electric skateboard on display beside them, satisfied smile, one hand pointing at their full board",
  },
  {
    key: "painting",
    characterPrompt:
      `crouching low or kneeling beside a long clear empty zone in the lower foreground, brush or spray can in hand, making careful strokes toward empty air while keeping the reserved area unobstructed; head tilted with concentration, free hand steadying without crossing into the empty compositing zone; creative focused expression; keep the body pulled back from the camera with visible boots; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "crouching beside their full electric skateboard and painting or spray-painting custom artwork onto the visible deck, brush or spray can in hand, focused creative expression",
  },
  {
    key: "wheels",
    characterPrompt:
      `squatting or kneeling with both hands reaching toward a clear empty service area in the lower-center foreground — small hand tool or wrench in one hand — miming precise mechanical work while keeping the reserved compositing area completely unobstructed; gaze down and concentrated on the empty work area; keep the body slightly offset so the open area stays fully inside frame; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "kneeling beside their full electric skateboard and swapping out a wheel, skate tool in hand, focused mechanical work pose, board fully visible in frame",
  },
  {
    key: "cleaning",
    characterPrompt:
      `bent forward or kneeling beside an open long empty space on the right, cloth or soft brush in hand, wiping and polishing empty air while leaving the reserved compositing area clear next to them; deliberate care in every stroke, free hand steadying without covering the empty zone; meticulous detailing pose; keep the figure zoomed out with visible boots; ${CHARACTER_LAYER_ONLY}`,
    imagePrompt:
      "carefully wiping down and polishing their full electric skateboard beside them, cloth in hand, meticulous detailing pose, board fully visible in frame",
  },
];

export function resolveBoardPoseScene(seed: string): BoardPoseScene {
  return createSeededRandom(`${seed}|exact-board-scene`).pick(BOARD_POSE_SCENES);
}
