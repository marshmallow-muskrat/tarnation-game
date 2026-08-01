export type EconomyEnvironment = {
  readonly DEV: boolean;
};

export type EconomyCapability = {
  readonly allowFreePurchases: boolean;
  readonly label: string;
};

/**
 * Free purchases are a development-only capability. The production bundle
 * receives DEV=false from Vite, and no public URL value can enable it.
 */
export function getEconomyCapability(
  environment: EconomyEnvironment = import.meta.env,
): EconomyCapability {
  if (environment.DEV) {
    return {
      allowFreePurchases: true,
      label: 'Development sandbox · purchases are free',
    };
  }
  return {
    allowFreePurchases: false,
    label: 'Production economy · costs are charged',
  };
}
