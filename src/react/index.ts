import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { MediaKind, MediaSession, MediaSnapshot } from "../core/index.js";

export interface MediaSessionProviderProps {
  readonly session: MediaSession;
  readonly children?: ReactNode;
}

const MediaSessionContext = createContext<MediaSession | null>(null);

export const MediaSessionProvider = ({ session, children }: MediaSessionProviderProps) =>
  createElement(MediaSessionContext.Provider, { value: session }, children);

export interface MediaSessionState {
  readonly session: MediaSession;
  readonly snapshot: MediaSnapshot;
}

export const useMediaSession = (session?: MediaSession): MediaSessionState => {
  const inherited = useContext(MediaSessionContext);
  const current = session ?? inherited;
  if (current === null)
    throw new Error("useMediaSession requires a session or MediaSessionProvider.");
  const snapshot = useSyncExternalStore(
    (listener) => current.subscribe(listener),
    () => current.getSnapshot(),
    () => current.getServerSnapshot(),
  );
  return { session: current, snapshot };
};

export const useMediaOutput = (kind: MediaKind, session?: MediaSession) => {
  const state = useMediaSession(session);
  return { ...state, output: state.session.getOutput(kind) };
};
