/**
 * server/lib/approvedBoardImages.js
 *
 * Server-side mirror of src/lib/approvedBoardImages.ts for lightweight tests.
 * Keep the asset path/version aligned with the client helper.
 */

export const APPROVED_MOUNTAINBOARD_IMAGE_PATH = '/assets/boards/approved/mountainboard-master.png';
export const APPROVED_MOUNTAINBOARD_IMAGE_URL = `${APPROVED_MOUNTAINBOARD_IMAGE_PATH}?v=2026-04-24`;

export function resolveApprovedBoardImage(config) {
  if (config?.boardType !== 'Mountain') {
    return null;
  }

  return {
    imageUrl: APPROVED_MOUNTAINBOARD_IMAGE_URL,
    backgroundRemovalRequired: false,
  };
}
