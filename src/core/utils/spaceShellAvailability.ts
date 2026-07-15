export type SpaceShellAvailabilityInput = {
  isSupabaseConfigured: boolean;
  spacesLoadedFromSupabase: boolean;
  activeSpaceId: string | null | undefined;
  hasActiveSpace: boolean;
};

/** activeSpaceId はあるが store 上にスペース実体が無い（環境不一致・削除済み等）。 */
export function isActiveSpaceShellUnavailable(
  input: SpaceShellAvailabilityInput,
): boolean {
  return (
    input.isSupabaseConfigured &&
    input.spacesLoadedFromSupabase &&
    !!input.activeSpaceId &&
    !input.hasActiveSpace
  );
}
