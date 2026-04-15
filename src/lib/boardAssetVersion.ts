export const BOARD_COMPONENT_ASSET_VERSION = "2026-04-15";

export function withBoardComponentAssetVersion(url: string): string {
  return `${url}?v=${BOARD_COMPONENT_ASSET_VERSION}`;
}
