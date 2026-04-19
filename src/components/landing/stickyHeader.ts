type HeaderVisibilityInput = {
  previousScrollY: number;
  currentScrollY: number;
  isHidden: boolean;
};

const TOP_VISIBILITY_THRESHOLD = 24;
const SCROLL_HIDE_THRESHOLD = 72;
const MIN_SCROLL_DELTA = 6;

export function getNextHeaderHiddenState({
  previousScrollY,
  currentScrollY,
  isHidden,
}: HeaderVisibilityInput) {
  if (currentScrollY <= TOP_VISIBILITY_THRESHOLD) {
    return false;
  }

  const delta = currentScrollY - previousScrollY;

  if (delta >= MIN_SCROLL_DELTA && currentScrollY > SCROLL_HIDE_THRESHOLD) {
    return true;
  }

  if (delta <= -MIN_SCROLL_DELTA) {
    return false;
  }

  return isHidden;
}
