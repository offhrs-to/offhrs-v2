import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchSavedEventIdSet,
  patchSavedEventIds,
  subscribeEventSavesChanged,
  toggleUserEventSave,
} from '@/lib/event-saves';

/**
 * Saved workshop IDs for the signed-in user, kept in sync across screens via
 * `EVENT_SAVES_CHANGED` (carousel ↔ quick view ↔ browse ↔ profile counts).
 */
export function useSavedEventIds() {
  const { user } = useAuth();
  const router = useRouter();
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [savingEventIds, setSavingEventIds] = useState<Set<number>>(new Set());

  const reload = useCallback(async () => {
    if (!user?.id) {
      setSavedEventIds(new Set());
      return;
    }
    const next = await fetchSavedEventIdSet(user.id);
    setSavedEventIds(next);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  useEffect(() => {
    return subscribeEventSavesChanged(({ eventId, saved }) => {
      setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, saved));
    });
  }, []);

  const toggleSave = useCallback(
    async (eventId: number) => {
      if (!user?.id) {
        router.push('/login');
        return;
      }
      if (savingEventIds.has(eventId)) return;
      const currentlySaved = savedEventIds.has(eventId);
      setSavingEventIds((prev) => new Set(prev).add(eventId));
      try {
        const result = await toggleUserEventSave({
          userId: user.id,
          eventId,
          currentlySaved,
        });
        if (!result.ok) {
          Alert.alert(currentlySaved ? "Couldn't update" : "Couldn't save", result.message);
          return;
        }
        // Emitter also updates local state; set optimistically for snappy UI.
        setSavedEventIds((prev) => patchSavedEventIds(prev, eventId, result.saved));
      } finally {
        setSavingEventIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    },
    [user?.id, router, savedEventIds, savingEventIds]
  );

  return {
    savedEventIds,
    toggleSave,
    isSaving: (eventId: number) => savingEventIds.has(eventId),
    reload,
  };
}
