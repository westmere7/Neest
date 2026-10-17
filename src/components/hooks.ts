import { useSyncExternalStore } from 'react';

function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener?.('change', cb);
      window.addEventListener('resize', cb);
      return () => {
        mq?.removeEventListener?.('change', cb);
        window.removeEventListener('resize', cb);
      };
    },
    get() {
      return window.matchMedia?.(query).matches ?? false;
    },
  };
}

const mobileStore = mediaStore('(max-width: 820px), (pointer: coarse) and (max-width: 1024px)');

/** True on phones and small touch tablets, where drafting tools are replaced by a view-first UI. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(mobileStore.subscribe, mobileStore.get, () => false);
}

export const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
