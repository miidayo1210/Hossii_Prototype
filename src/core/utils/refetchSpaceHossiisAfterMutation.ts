import type { Hossii } from '../types';
import { fetchHossiisPage } from './hossiisApi';
import { mergeHossiiListsUnique } from './hossiiFetchPage';
import { getPeriodCutoff, type DisplayPeriod } from './displayPrefsStorage';
import {
  resolveSpaceHossiiPaneFilter,
  type PaneFetchScopeOverride,
} from './spaceHossiiFetchResolve';
import type { PaneContext } from './hossiiPaneMembership';

const REFETCH_PAGE_SIZE = 100;

export type RefetchSpaceHossiisAfterMutationInput = {
  spaceId: string;
  displayPeriod: DisplayPeriod;
  paneContext: PaneContext | null;
  paneFetchScope?: PaneFetchScopeOverride;
  existingHossiis: readonly Hossii[];
};

/** Type B 等の mutation 後に store へ merge する hossii 一覧を取得する */
export async function refetchSpaceHossiisAfterMutation(
  input: RefetchSpaceHossiisAfterMutationInput,
): Promise<Hossii[]> {
  const paneFilter = resolveSpaceHossiiPaneFilter(input.paneContext, input.paneFetchScope);
  const periodCutoff = getPeriodCutoff(input.displayPeriod);

  const page = await fetchHossiisPage({
    spaceId: input.spaceId,
    limit: REFETCH_PAGE_SIZE,
    periodCutoff,
    paneFilter,
  });

  return mergeHossiiListsUnique([...input.existingHossiis], page.items).filter(
    (h) => h.spaceId === input.spaceId,
  );
}
