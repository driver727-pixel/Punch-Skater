import { withBoardComponentAssetVersion } from "./boardAssetVersion";
import { enforceCompatibility, normalizeBoardConfig } from "./boardBuilderCompatibility";
import type { BoardConfig } from "./boardBuilderTypes";

export const APPROVED_MOUNTAINBOARD_IMAGE_PATH = "/assets/boards/approved/mountainboard-master.png";
export const APPROVED_MOUNTAINBOARD_IMAGE_URL = withBoardComponentAssetVersion(APPROVED_MOUNTAINBOARD_IMAGE_PATH);

export const APPROVED_CARBON_GTR_IMAGE_PATH = "/assets/boards/approved/carbon-gtr.png";
export const APPROVED_CARBON_GTR_IMAGE_URL = withBoardComponentAssetVersion(APPROVED_CARBON_GTR_IMAGE_PATH);

export interface ApprovedBoardImageOverride {
  imageUrl: string;
  backgroundRemovalRequired: boolean;
}

export function resolveApprovedBoardImage(config: BoardConfig): ApprovedBoardImageOverride | null {
  const normalizedConfig = enforceCompatibility(normalizeBoardConfig(config));

  if (normalizedConfig.boardType === "Mountain") {
    return {
      imageUrl: APPROVED_MOUNTAINBOARD_IMAGE_URL,
      backgroundRemovalRequired: false,
    };
  }

  if (
    normalizedConfig.boardType === "Street" &&
    normalizedConfig.wheels === "Pneumatic" &&
    normalizedConfig.drivetrain === "Belt"
  ) {
    return {
      imageUrl: APPROVED_CARBON_GTR_IMAGE_URL,
      backgroundRemovalRequired: false,
    };
  }

  return null;
}
