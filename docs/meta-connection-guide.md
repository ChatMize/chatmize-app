# Connecting a Facebook Page to ChatMize — step by step

## Before you start
- Log into Facebook in your browser as the person who manages the Page.
- Know which Facebook account that is. If you manage Pages across more than
  one account, use the right one.

## Steps

1. In ChatMize, open **Settings → Channels → Messenger** (or the onboarding
   connect step) and click **Connect with Facebook**.
2. A Facebook popup opens. If it says "You've previously linked ChatMize to
   Facebook", click **Edit settings**. Do NOT click Continue yet — Continue
   reuses your old page selection and any page you didn't pick before stays
   hidden.
3. **Choose the Pages you want ChatMize to access.** Select
   **"Opt in to all current and future Pages"**, then Continue. This covers
   pages you create later too.
4. **Choose the Businesses you want ChatMize to access.** Select
   **"Opt in to all current and future Businesses"**, then Continue. Pages
   owned by a business portfolio only appear if the business is opted in.
5. **Review ChatMize's access request.** Confirm everything is opted in, then
   click **Save**.
6. You're returned to ChatMize. The page picker shows **"Logged in as
   {your Facebook name}"**. Use the search box to find your Page and select
   it.

## The page still isn't listed?

Work through these in order:

1. **Wrong Facebook account?** Check the "Logged in as" name in the picker.
   Reconnect with the account that manages the Page.
2. **Page not opted in?** Reconnect, click **Edit settings** (never Continue),
   and confirm the Page and its Business are both opted in.
3. **Business-owned page?** The business that owns the Page must be opted in
   on the Businesses screen (step 4 above).
4. **No direct page role?** Open the Page on Facebook → Settings → Page access
   and confirm your profile is listed. Business Suite-only access without a
   page role can hide the page from apps.
5. **Brand-new page?** Click the refresh button in the ChatMize picker. If it
   still doesn't appear, reconnect once — the page list is captured at login.

## Notes
- ChatMize requests these Facebook permissions: pages_show_list,
  pages_messaging, pages_manage_metadata, business_management. The last one
  is what surfaces business portfolio pages.
- Instagram messaging setup is separate and comes after the Page is connected.

---

# Connecting Instagram directly (no Facebook Page needed)

For IG-first businesses and creators. Uses Instagram Login through the
ChatMize-IG app. The long-lived Instagram token is stored encrypted and
scoped to the workspace; only the IG id/username/picture ever reach the app.

## Steps

1. In ChatMize, open **Settings → Channels** and click **Connect Instagram**
   on the Instagram Direct & Comments card.
2. Log in with the Instagram professional (business or creator) account you
   want to connect, and approve the requested permissions.
3. You're returned to ChatMize. The card shows the connected `@username`
   with its profile picture.

## Requirements on the Instagram account

- It must be a **professional** account (business or creator), not personal.
- While the Meta app is in development mode, the IG account must be added
  as a tester: Meta app dashboard → Roles → add the account as an
  **Instagram Tester**, and accept the invite from the IG account.
- Turn on **Allow access to messages** in the IG account's privacy settings,
  otherwise DMs can't reach ChatMize.

## Upgrade path

An IG-only workspace can later connect a Facebook Page as its Meta anchor
(Settings → Channels → Connect with Facebook). If the Instagram account is
linked to that Page, both channels merge under the one workspace and
Messenger unlocks too.

## Developer setup (ChatMize team only)

- Instagram app: ChatMize-IG (Meta app dashboard).
- Valid OAuth Redirect URI on the Instagram app:
  `https://app.chatmize.com/metaOAuthCallback` (shared with the Page flow;
  the backend routes by login state).
- App secret stored as `META_INSTAGRAM_APP_SECRET` in Google Secret Manager;
  the IG token per workspace lives in its own `IG_TOKEN_WS_<id>` secret.
