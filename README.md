# Jellyfin Popups

Show news, text, images or a movie/show card as a popup when people open Jellyfin. It also adds **Asks**, a private inbox where users send problems, requests and opinions. Both follow whatever theme or skin is active (KefinTweaks skins included): they read Jellyfin's palette variables and fall back to the page's own colors.

- Works in: browsers, the desktop app, the Android and iOS apps (they all run the web client).
- Does **not** work in: Android TV, Swiftfin, Roku, Kodi (fully native apps).
- Requires: Jellyfin **12.x**.

## Install

1. Build it (pick one):
   - **GitHub Actions:** push this folder to a GitHub repo, open the **Actions** tab, open the latest run, download the `Jellyfin.Plugin.Popups` artifact and unzip it.
   - **Locally:** install the .NET 10 SDK, then run  
     `dotnet build Jellyfin.Plugin.Popups/Jellyfin.Plugin.Popups.csproj -c Release -o out`  
     and take `out/Jellyfin.Plugin.Popups.dll`.
2. On the server, create the folder `plugins/Popups_1.1.0.0/` inside Jellyfin's data directory and put `Jellyfin.Plugin.Popups.dll` in it. (Docker: it is the `/config/plugins/` folder.)
3. Upgrading from 1.0? Delete the old `Popups_1.0.0.0` folder so only the new one remains. Your settings are kept. Then restart Jellyfin.
4. In the log you should see `Popups: added the popup script to the web client page` the first time someone opens the web client.
5. Open **Dashboard → Plugins → Popups** (also in the dashboard side menu) and click **New popup**.

## Making a popup

Everything is optional, so one popup can be plain text, an image, a library title, or a mix.

| Field | What it does |
|---|---|
| Small tag | The little red word above the title (NEWS, NEW...). |
| Title / Text | Text supports blank-line paragraphs, `**bold**` and `[link text](https://...)`. No HTML. |
| Image address | A picture link (`https://...`). |
| Library title | Search your library. Shows its backdrop, logo, year and summary plus a **More info** button. Each person only sees it if they have access to that title. |
| Button | Optional extra button (`https://...` or an in-app link like `#/home`). |
| Who can see it | Everyone, admins only, everyone except admins, or selected users. |
| How often | **Every time they open Jellyfin** (default) or **only the first time** (remembered per user on the server, so it follows them across devices). |
| Where | Phones and computers, phones only, or computers only. |
| Start / Stop | Optional dates. |
| Order | Higher numbers appear first when several match. |
| Size / Accent | Compact, standard or wide. Accent color of the small tag (default follows the theme red). |

"Every time they open Jellyfin" means every fresh load of the web client or app, right after they are signed in. It does not repeat while they move between pages.

Buttons on each popup: **Preview** (shows the real popup without recording it as seen), **Show again to everyone** (makes a "first time only" popup appear again for people who already saw it), **Duplicate**, **Delete**.

Global settings: a master on/off switch, the most popups per visit, a short delay before the first one, and whether clicking outside closes it.

## Asks (messages from users)

Users open it from a floating button (or a menu tab, below), pick **Problem / Request / Opinion / Other**, optionally attach a movie or show from the library, add up to 3 photos and write a message. For requests they can say what they need: add it, subtitles, dub or something else.

- **Private.** Each message is only returned to the person who sent it and to server administrators. Other users' requests get refused by the server, not just hidden. All admin accounts can read the inbox, not only yours.
- You read and answer them in **Dashboard → Asks**. A reply shows up under the user's **My messages**. Mark as done, reopen or delete from there.
- Settings (button text, position, rate limit, photos on/off, intro text) are in **Dashboard → Plugins → Popups**.
- Photos are shrunk and re-saved as JPEG in the browser, and checked again on the server.
- Data lives in plain files in the plugin data folder (`data/popups/asks.json` and `data/popups/asks/`).

### Add an "Asks" tab with KefinTweaks

Open KefinTweaks' **Custom Menu Links** and add one: Name `Asks`, leave URL empty, Action `JellyfinAsks.open`, pick an icon (for example `forum`). Then turn the floating button off in the Popups settings if you don't want both.

## Good to know

- Popups never appear while a video is playing; they wait until the user leaves the player.
- If the plugin fails, Jellyfin's page is served unchanged. Turning the master switch off stops the script from being added at all.
- The script is added to Jellyfin's page as it is served, nothing is written to the web folder. It works alongside the JavaScript Injector plugin.
- To remove: delete the plugin folder and restart.

## Check these after installing (not tested against a real server yet)

- The popup appears after login on desktop and on your phone app.
- The Asks button shows up, a test message arrives in **Dashboard → Asks**, and a second non-admin account cannot see it.
- **Dashboard → Plugins → Popups** opens and saves.
- If something is off, send the server log lines that contain `Popups`.
