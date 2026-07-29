/**
 * Lets root-level first-run modals (e.g. pilot notice) avoid stacking on top of
 * OnboardingModal — RN Modals do not compose reliably on iOS.
 */

let onboardingModalOpen = false;
const listeners = new Set<() => void>();

export function setOnboardingModalOpen(open: boolean): void {
  if (onboardingModalOpen === open) return;
  onboardingModalOpen = open;
  listeners.forEach((listener) => listener());
}

export function isOnboardingModalOpen(): boolean {
  return onboardingModalOpen;
}

export function subscribeOnboardingModalOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
