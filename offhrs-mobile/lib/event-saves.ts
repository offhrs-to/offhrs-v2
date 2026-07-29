import { DeviceEventEmitter } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Fired after a workshop is saved or unsaved so other screens stay in sync. */
export const EVENT_SAVES_CHANGED = 'offhrs-event-saves-changed';

export type EventSaveChange = {
  eventId: number;
  saved: boolean;
};

export function emitEventSaveChanged(eventId: number, saved: boolean): void {
  DeviceEventEmitter.emit(EVENT_SAVES_CHANGED, { eventId, saved } satisfies EventSaveChange);
}

export function subscribeEventSavesChanged(
  listener: (change: EventSaveChange) => void
): () => void {
  const sub = DeviceEventEmitter.addListener(EVENT_SAVES_CHANGED, listener);
  return () => sub.remove();
}

export function patchSavedEventIds(
  prev: Set<number>,
  eventId: number,
  saved: boolean
): Set<number> {
  const next = new Set(prev);
  if (saved) next.add(eventId);
  else next.delete(eventId);
  return next;
}

/**
 * Insert or delete `user_event_saves` for the given event, then broadcast the change.
 */
export async function toggleUserEventSave(opts: {
  userId: string;
  eventId: number;
  currentlySaved: boolean;
}): Promise<{ ok: true; saved: boolean } | { ok: false; message: string }> {
  const { userId, eventId, currentlySaved } = opts;
  if (currentlySaved) {
    const { error } = await supabase
      .from('user_event_saves')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);
    if (error) return { ok: false, message: error.message ?? 'Please try again.' };
    emitEventSaveChanged(eventId, false);
    return { ok: true, saved: false };
  }
  const { error } = await supabase.from('user_event_saves').insert({
    user_id: userId,
    event_id: eventId,
  });
  if (error) return { ok: false, message: error.message ?? 'Please try again.' };
  emitEventSaveChanged(eventId, true);
  return { ok: true, saved: true };
}

export async function fetchSavedEventIdSet(userId: string): Promise<Set<number>> {
  const { data } = await supabase
    .from('user_event_saves')
    .select('event_id')
    .eq('user_id', userId);
  return new Set((data ?? []).map((r) => Number(r.event_id)).filter((id) => Number.isInteger(id)));
}
