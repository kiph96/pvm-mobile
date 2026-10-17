# PVM mobile

iOS, Android and web app for **K Tech PVM (Part-time Virtual Management)**, built with Expo (React Native + TypeScript) and Expo Router.

There is one app with two experiences, chosen by your role in the selected business:

| Owner / admin | Employee |
|---|---|
| **Home**: approvals (new hires, shift requests, swaps), today's staffing | **Home**: next shift with clock in / break / clock out, points |
| **Schedule**: week view per store, fill the week from templates, publish, add shifts | **Find shifts**: open shifts at my stores, request or join the waitlist |
| **Team**: staff per store, wages, points, attendance issues, join requests | **My shifts**: upcoming and history, start a swap |
| **Stores**: access keys, store rules (limits, staffing, approvals), shift templates | **Swaps**: accept or decline, track approval |
| **More**: payroll, violations, notifications, plan & billing | **Me**: stores, points, payslips, join another store |

## Run it

```bash
npm install
npm run web        # browser
npm run android    # Android emulator / Expo Go
npm run ios        # iOS simulator (macOS) / Expo Go
npm run typecheck
```

## Full stack with Docker (real integration)

Needs the backend repo next to this one (`../pvm`).

```bash
docker compose up -d --build
```

| Service | Address |
|---|---|
| App (web build) | http://localhost:8088 |
| pvm-backend API | http://localhost:8080 (remote debug on 5005) |
| PostgreSQL | localhost:5432, `pvm_owner` / `pvm_owner` |

On the sign-in screen, open **Developer server** and tap one of the **seeded accounts**: these are the backend's dev demo people. `docker compose down -v` wipes the database.

The API address is baked into the web build. To change it, use `PVM_API_URL=http://<host>:8080 docker compose up -d --build`. The backend must also allow that browser origin in `PVM_CORS_ALLOWED_ORIGINS`.

To test on a phone or emulator against the same backend, run `npm start` and enter the server address on the sign-in screen: `http://10.0.2.2:8080` from the Android emulator, or `http://<your PC's LAN IP>:8080` from a real phone.

## Sign in with Google / Facebook

The app gets a token from Google (ID token) or Facebook (access token) and sends it to `pvm-backend`. The backend verifies it, links the account by provider + account id (never by email), and returns its own tokens:
* an access token that lasts 30 minutes, sent as `Authorization: Bearer …`
* a refresh token that lasts 30 days, rotates on every use, and signs the user out everywhere if an old one is reused

Phones keep these tokens in the keychain/keystore; the web build keeps them in browser storage.

1. Copy `.env.example` to `.env` (git-ignored) and fill it in. Docker Compose and `npm start` both read it.
2. **Google** ([Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)):
   * create OAuth client IDs of type *Web* (for web and Expo), *iOS* (bundle id `com.ktech.pvm`) and *Android* (package `com.ktech.pvm` plus your signing SHA-1)
   * on the web client, add `http://localhost:8088` and `http://localhost:8081` to *Authorized JavaScript origins* and *Authorized redirect URIs*
   * put the IDs in `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`, and all of them, comma separated, in `PVM_GOOGLE_CLIENT_IDS`
3. **Facebook** ([developers.facebook.com](https://developers.facebook.com/apps)):
   * create a *Consumer* app and add *Facebook Login*
   * under *Valid OAuth Redirect URIs*, add `http://localhost:8088/` (Facebook allows `http://localhost` only while the app is in development mode)
   * put the App ID in `EXPO_PUBLIC_FACEBOOK_APP_ID` and `PVM_FACEBOOK_APP_ID`
   * put the App Secret **only** in `PVM_FACEBOOK_APP_SECRET`
4. Run `docker compose up -d --build`. The buttons switch on when both this build and the server are configured (the app checks `GET /api/auth/providers`).

On a phone, Google and Facebook sign-in need a development build (`npx expo run:android` / `run:ios`), because Expo Go cannot use your own OAuth redirect.

On a development server, the **Seeded accounts** list signs in through `POST /api/auth/dev` (`pvm.auth.dev-login`, on in the backend's `dev` profile only). It returns the same kind of tokens, so the token path is exercised without OAuth credentials.

## Daily shift report (push notification to owners)

Every evening, by default at **22:00** in the business's timezone, owners get a notification about tomorrow's shifts. Examples:
* *"⚠️ Ngày mai (CN, 18/10): 3/3 ca thiếu người, cần thêm 4 người"* (3 of 3 shifts understaffed, 4 more people needed), with the short shifts per store in the body
* *"✅ Ngày mai: đủ người cho 6 ca"* when every shift has its minimum staff
* *"📅 Ngày mai chưa có ca nào"* when no shifts exist yet

The body also mentions shifts below the ideal headcount, unpublished shifts and pending requests. Tapping the notification opens **Lịch ca** (Schedule) on that day.

**Settings** (**Thêm → Báo cáo ca hằng ngày** / More → Daily shift report): on/off, send time (hour plus :00/:15/:30/:45, or a preset), language (vi/en), a live preview of tonight's message, and **Gửi thử cho tôi ngay** (send a test now). Settings are per owner, per business. Admins can opt in; employees can't open it.

How it works:
* The backend job `DigestJob` runs every minute. When an owner's time has passed, it writes one message per owner per day to the outbox; a database key prevents duplicates even across restarts.
* `ExpoPushSender` delivers outbox messages to the owner's registered phones through Expo's push service (APNs / FCM). The other alerts (new requests, swaps…) now reach phones the same way. Without a registered phone the report still appears in **Thông báo** (Notifications).
* Phones register their Expo push token after sign-in, and unregister it on sign-out.

To receive real push notifications on a phone:
1. Create an Expo/EAS project (`npx eas init`) and put its id in `EXPO_PUBLIC_EAS_PROJECT_ID` (`.env`).
2. Build a development build: `npx expo run:android` or `npx eas build --profile development`. iOS needs an Apple developer account for push.
3. Sign in as an owner and open the report screen; it asks for notification permission.

The web version can't receive phone notifications; it shows the in-app feed instead.

## Hourly pay and pay rules

Wages can be **per hour** (the default for new stores) or **per shift**, set per employee (Team → person → Wage). The owner decides how worked time becomes pay in **Stores → store → Cách tính lương** (pay rules):

| Setting | Options |
|---|---|
| Hours that count | clocked time · clocked but limited to the shift · scheduled shift |
| Rounding | exact, or to 5/15/30 min (nearest, down, up) |
| Breaks | unpaid (recorded breaks are subtracted) or paid |
| Minimum paid per shift | none, 1–4 h (when someone is sent home early) |
| Overtime | after N hours in one shift, paid 150 / 200 / 300 % |
| Night work | a window such as 22:00–06:00, paid 130 / 150 / 200 % (the Vietnamese labour code minimum is +30 %) |

The screen shows a live example of a shift's pay. Pay rules are saved as a new store policy version: every shift is paid with the rules that applied when it was created, so changes never rewrite old pay.

On payslips, overtime and night pay appear as separate lines (`overtime_premium`, `night_premium` next to `hourly_wage`). Each line keeps a snapshot of the hours, minutes and rules used. Stores without pay rules keep the old behaviour: per-shift wages, with clocked time limited to the shift.

## Two data modes

* **Explore the demo**: in-memory data (`src/api/mock.ts`) seeded like `002-seed-dev.sql`, with shifts generated around today. It needs no backend and resets when the app reloads.
* **Developer server**: calls `pvm-backend` (`src/api/http.ts`) with bearer tokens from `/api/auth`. The default address comes from `EXPO_PUBLIC_API_URL`, then `extra.apiUrl` in `app.json`.

## Languages

Vietnamese is the main language and the default; English is also available. The switch is on the sign-in screen and under More / Me.

* Strings live in `src/i18n/vi.ts` and `src/i18n/en.ts`. TypeScript fails the build if a key is missing from either file.
* Use `const { t } = useI18n()` in components, and `t('section.key', { name })` for placeholders.
* Dates, weekdays and money follow the chosen language (e.g. `T2, 12 thg 10` and `180.000 ₫`).
* Messages coming from the real backend (errors) are still in English.

## Light & dark themes

**Giao diện** (Appearance) on the sign-in screen and under More / Me offers **Theo hệ thống** (follow the device, the default), **Sáng** (light) and **Tối** (dark). The choice is remembered on the device (`pvm.theme`).

* Colours come from the two palettes in `src/theme/index.ts`, read through `useTheme()`.
* `src/theme/ThemeProvider.tsx` applies the choice.
* Navigation chrome and the web page background follow the same palette.
* When adding UI, take colours from `useTheme().colors` rather than hard-coding them; white is fine only on coloured surfaces such as the primary card.

## Structure

```
app/                 screens (Expo Router file-based routes)
  owner/             owner tab bar
  staff/             employee tab bar
  shift/[id] ...     shared detail screens
src/api/             DTO types, HTTP client, demo implementation
src/components/      UI kit (ui.tsx), PVM components, toast + useAction
src/i18n/            translations (vi = default, en) and t()
src/state/           session (user + business), shared queries
src/theme/           colours (light/dark), spacing, typography
```

## Not done yet

* Two-step verification (TOTP) after Google/Facebook sign-in (`mfa_credentials` exists in the schema)
* Push notifications (the notification feed is in-app only)
* Reports screens (daily / weekly / monthly)
