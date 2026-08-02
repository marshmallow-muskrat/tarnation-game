export type BuildIdentity = {
  version: string;
  commit: string;
  buildId: string;
};

declare const __TARNATION_BUILD_INFO__: BuildIdentity | undefined;

/** Build identity is injected by Vite and remains stable for a given commit. */
export const BUILD_INFO: BuildIdentity =
  typeof __TARNATION_BUILD_INFO__ === 'undefined'
    ? { version: 'unknown', commit: 'unknown', buildId: 'development' }
    : __TARNATION_BUILD_INFO__;
