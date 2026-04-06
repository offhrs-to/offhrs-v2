import { Platform, Share } from 'react-native';

import { getWebAppOrigin } from '@/lib/web-app-links';

/**
 * Opens the system share sheet with a link to the workshop on the web app.
 * URL uses `/workshops?event=` so the site can deep-link when supported.
 */
export async function shareWorkshopEvent(event: { id: number; title: string }): Promise<void> {
  const url = `${getWebAppOrigin()}/workshops?event=${event.id}`;
  const message = `Check out "${event.title}" on Offhrs\n${url}`;
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { message: `Check out "${event.title}" on Offhrs`, url }
        : { message, title: event.title }
    );
  } catch {
    /* user dismissed */
  }
}
