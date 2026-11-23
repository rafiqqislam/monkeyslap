# Setting up Google sign-in

Sign-in goes through Supabase Auth. You need a Supabase project and a Google OAuth
client. Both are free. It takes about 20 minutes.

## The extension's ID

The extension ID is pinned by `apps/extension/extension-key.pub.txt`, so it's the
same on every machine:

```
iedbmepibcfeilbcepbjjoonjjoppkbg
```

That makes the sign-in return address:

```
https://iedbmepibcfeilbcepbjjoonjjoppkbg.chromiumapp.org/
```

The matching private key is in `apps/extension/.keys/private.pem`. It is git-ignored.
**Back it up somewhere safe** (a password manager works). To keep this same ID on the
Chrome Web Store, add it to the zip as `key.pem` on the very first upload. If it's
lost, the Web Store gives the extension a new ID and the URLs below have to be updated.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a project, and pick a region near
   your users.
2. Under **Project Settings → API**, copy the **Project URL** and the **publishable key**.
3. Copy `apps/extension/.env.example` to `apps/extension/.env` and paste both in.

## 2. Create the Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com):

1. Create a project (e.g. "MonkeySlap").
2. **APIs & Services → OAuth consent screen**: choose **External**. Fill in the app
   name, your support email, your domain, and the link to your privacy policy. Add the
   scopes `openid`, `email` and `profile`, and nothing else, so Google's long security
   review doesn't apply.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application** (not "Chrome extension", because Supabase
     does the token exchange).
   - Authorized redirect URI: the **Callback URL** shown in Supabase under
     **Authentication → Sign In / Providers → Google**. It looks like
     `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Copy the **Client ID** and **Client secret**.

## 3. Connect them in Supabase

1. **Authentication → Sign In / Providers → Google**: turn it on and paste the Client ID
   and secret.
2. **Authentication → URL Configuration → Redirect URLs**: add
   `https://iedbmepibcfeilbcepbjjoonjjoppkbg.chromiumapp.org/**`

## 4. Rebuild and try it

```bash
npm run build
```

Reload the extension in `chrome://extensions`, open the popup and click **Sign in with
Google**.

## Adding Apple later

Turn on Apple under **Sign In / Providers** in Supabase (it needs an Apple Developer
account), then add a second button that calls the same flow with `provider: "apple"`
in `apps/extension/src/background/auth.ts`.
