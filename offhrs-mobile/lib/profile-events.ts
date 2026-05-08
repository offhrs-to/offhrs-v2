import { DeviceEventEmitter } from 'react-native';

/** Fired after profile-changing flows (e.g. onboarding complete) so tab screens can refetch. */
export const PROFILE_UPDATED_EVENT = 'offhrs-profile-updated';

export function emitProfileUpdated() {
  DeviceEventEmitter.emit(PROFILE_UPDATED_EVENT);
}

