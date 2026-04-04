import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { LogListBody } from './LogListBody';
import styles from './CommentsScreen.module.css';

export const CommentsScreen = () => {
  const { state, getActiveSpaceHossiis } = useHossiiStore();
  const { activeSpaceId } = state;
  const hossiis = getActiveSpaceHossiis();
  const activeSpace = state.spaces.find((s) => s.id === activeSpaceId);

  return (
    <div className={styles.container}>
      <TopRightMenu />
      <LogListBody
        hossiis={hossiis}
        spaceId={activeSpaceId}
        presetTags={activeSpace?.presetTags ?? []}
        panelMode={false}
      />
    </div>
  );
};
