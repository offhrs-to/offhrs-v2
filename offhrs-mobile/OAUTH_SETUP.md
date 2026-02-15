# Mobile OAuth (Apple & Google) Setup

## Supabase Dashboard Configuration

To make Apple and Google sign-in work on the mobile app, add these redirect URLs in **Supabase Dashboard** → **Authentication** → **URL Configuration** → **Redirect URLs**:

### Required Redirect URLs

1. **Mobile app (iOS/Android):**
   ```
   offhrsmobile://auth/callback
   ```
   
2. **Web app (for email confirmation links from mobile sign-up):**
   ```
   https://offhrs.com/auth/callback
   ```
   or for development:
   ```
   http://localhost:3000/auth/callback
   ```

### Troubleshooting Apple Sign-in on Mobile

If Apple sign-in shows "Open this page in offhrs-mobile?" but then routes back to login instead of profile:

1. **Check Supabase redirect URLs:** Ensure `offhrsmobile://auth/callback` is in the allowed list (exactly as shown, case-sensitive).

2. **Check Xcode console logs:** Open Xcode → Window → Devices and Simulators → Select your device → Open Console. Look for `[Auth]` and `[AuthCallback]` logs to see what's happening during the OAuth flow.

3. **Verify app scheme:** In `offhrs-mobile/app.json`, the `scheme` should be `"offhrsmobile"` (no `://`).

4. **Test flow:**
   - Tap "Continue with Apple"
   - Sign in with Apple
   - Tap "Open" on the "Open in offhrs-mobile?" dialog
   - Watch console for `[Auth]` logs - should show "Code exchange successful"

5. **Common issues:**
   - **Invalid redirect URL:** Supabase rejects the OAuth request if `offhrsmobile://auth/callback` isn't in allowed URLs
   - **Code already used:** If you tap "Open" twice, the second attempt fails (code can only be exchanged once)
   - **Session not persisted:** Check that `AsyncStorage` is working (should be automatic with Expo)

### Apple OAuth Provider Setup

In Supabase Dashboard → **Authentication** → **Providers** → **Apple** you fill in two values:

| Supabase field   | What to put there | Where you get it |
|------------------|-------------------|------------------|
| **Client ID**    | Your **Services ID** | Apple Developer → [Identifiers](https://developer.apple.com/account/resources/identifiers/list/serviceId) → **Services IDs** (e.g. `com.offhrs.app.web`). Create one and enable "Sign in with Apple"; link it to your App ID. |
| **Secret Key**   | A **generated JWT** (client secret) | **Not** the raw .p8 file. Generate it using Supabase’s [Apple client secret tool](https://supabase.com/docs/guides/auth/social-login/auth-apple) (in the same doc, “Use this tool to generate a new Apple client secret”). You need: **Team ID**, **Key ID**, **Services ID** (same as Client ID above), and the **contents of your .p8 file**. The tool outputs the JWT; paste that into the Secret Key field. (Use Chrome/Firefox; the tool may not work in Safari.) |

**Getting Team ID, Key ID, and .p8:**

1. **Team ID** – Apple Developer account → top-right menu or [Membership](https://developer.apple.com/account) (10-character alphanumeric).
2. **Key** – [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+** → name it, enable “Sign in with Apple”, configure with your **Primary App ID** and optionally your **Services ID** → Register → **Download** the `.p8` (you can only download once; store it safely).
3. **Key ID** – Shown on the Keys list for that key (e.g. `ABC123XYZ`).

**In Apple Developer for the Services ID:** set **Website URLs** so the **Domain** is your Supabase host (e.g. `xxxx.supabase.co`) and the **Return URL** is:
```
https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
```

**Important:** The **Secret Key** in Supabase must be this **JWT**, not the .p8 file. Apple requires rotating this secret (regenerating the JWT from the same or a new key) every **6 months** for OAuth flows; set a reminder.

### Google OAuth Provider Setup

In Supabase Dashboard → **Authentication** → **Providers** → **Google**:

1. Enable Google provider
2. Add your Google Client ID (from Google Cloud Console)
3. Add your Google Client Secret
4. In Google Cloud Console → Credentials → OAuth 2.0 Client IDs, add authorized redirect URI:
   ```
   https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
   ```

### Mobile-Specific Notes

- **iOS scheme:** The custom scheme `offhrsmobile://` is defined in `app.json` and automatically registered by Expo
- **Android deep links:** Same scheme works on Android automatically
- **Development vs Production:** The redirect URL is the same for both (no need for `exp://` or `exps://`)
