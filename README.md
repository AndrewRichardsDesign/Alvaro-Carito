# Alvaro & Carito

A one-page wedding website that the couple can edit themselves — every word,
photograph, colour and section — from the live site, with a password.

The editing layer is the one built for the
[portfolio site](https://github.com/Adalithic-LLC/productdesignportfolio),
carried across and extended: the whole page lives in one JSON file, edits are
held as a local draft, and saving commits that file straight back to this
repository with a GitHub token.

---

## Editing the site

1. Scroll to the bottom and press **Edit this site** (or add `#/admin` to the
   URL). The password is `123`.
2. **Text** — click any of it and type. Enter confirms a single line; click away
   to finish.
3. **Photographs** — hover one and press **Edit photo**. You can replace it,
   crop it (drag to reposition, pinch or slide to zoom, rotate, adjust
   brightness / contrast / warmth), set alt text and a caption, and click the
   focal point that must stay in frame when the photo is shown in a different
   shape.
4. **Moving things** — press **Arrange**, then drag any section by its handle.
   The same handles appear on every list on the page — schedule entries, cards,
   questions, photographs — so anything can be reordered by dragging it. Arrow
   keys work on a focused handle if you would rather not drag.
5. **Adding sections** — **Add section** offers sixteen templates (schedule,
   FAQ, registry, wedding party, countdown, map, full-width photo…). They arrive
   already written and are edited exactly like everything else. Each section has
   its own settings button for its colours, width, spacing and alignment.
6. **Colours and type** — **Look** sets the palette and the two typefaces for
   the whole site. Six palettes are provided as starting points and every
   colour stays individually editable.
7. **Saving** — open **Saving**, paste a GitHub token, press **Save to GitHub**.
   Until you save, changes live only in your browser, and survive a refresh.
   **Export** downloads a backup of the whole document; **Import** restores one.

### The GitHub token

Create a [fine-grained personal access token](https://github.com/settings/tokens?type=beta):

- **Repository access:** only `AndrewRichardsDesign/Alvaro-Carito`
- **Permissions:** **Contents → Read and write**

It is kept in your browser's `localStorage` and sent to the GitHub API and
nowhere else. It is never committed.

> The password is a soft gate — it is in the published bundle, like any
> client-side check, so treat it as "keeps the tools out of the way", not as
> security. What actually protects the live site is that publishing a change
> requires that token.

---

## Guest photographs

Guests add photographs without an account, an app, or anything to install.
They appear on the site within a second or two, and anybody can download them —
individually, or the whole album as a single zip.

**By QR code.** The **Share photos** section shows a code pointing at `#/share`.
Print it for the tables. It works on any phone camera.

**By WhatsApp.** A guest sends a photo to your number and it lands on the site.
This needs credentials from one of the two providers — see below. Until you add
them the QR route works on its own, and the WhatsApp button stays hidden.

### Which part of the weekend?

A wedding is rarely one event, so a photograph has to say which one it belongs
to. The hard part isn't asking — it's that people send photos first and read
messages second. Three things handle that, in order of how little they bother
the guest:

1. **The QR code already knows.** Each event has its own code and its own
   pre-filled WhatsApp link. Print the welcome-drinks one for the
   welcome-drinks tables, and everything scanned from it arrives already filed.
   Nobody is asked anything. Get the codes from **Events** in the admin bar —
   each has a **Download PNG** button sized for printing.
2. **Otherwise they are asked, once.** On Meta they get a native list — a
   *Choose an event* button that opens a picker, so they tap rather than type.
   On Twilio they get a numbered list to reply to, because Twilio's interactive
   messages need pre-registered templates that can't track events you edit from
   the website.
3. **Photos that arrive before the answer are held, not lost.** They stay off
   the site until the guest picks, and are filed retroactively the moment they
   do. If somebody never answers, the photos are waiting in **Events → Waiting
   for an answer**, where you can file or delete them by hand.

The choice then sticks for six hours, so a guest sending forty photos is asked
once rather than forty times. Sending **change** reopens the picker, and a
photo's caption can name an event outright (`#party`, or just `The party`).

With **no events defined**, nobody is ever asked and every photograph simply
joins the album — which is the right behaviour for a single-day wedding. With
exactly one, it is used automatically.

Events are edited under **Events** in the admin bar: rename them, drag them
into order, retire one after it has happened, and get its QR code and links.
Keep names to 24 characters and descriptions to 72 — that is all a WhatsApp
list row can show, and the field enforces it. On the site, the album grows
filter tabs for whichever events actually have photographs in them.

Photos live in Supabase rather than in this repository, because they arrive from
strangers at all hours. Row-level security lets anyone *add* a photo and nobody
alter or delete someone else's; hiding and deleting go through an edge function
holding the only credential that can. In admin mode, hovering a guest photo in
the album gives you **hide** and **delete**.

### Supabase project

Project `alvaro-carito-wedding` (`aipmyivogigxjexgnsys`) is already provisioned:

| Piece | What it is |
| --- | --- |
| `public.photos` | One row per photograph, with caption, sender and source |
| `guest-photos` bucket | The files, public to read, writable only under `guest/` |
| `events` | The parts of the weekend, and the order they're offered in |
| `whatsapp_senders` | Who chose what, and when to stop asking. Phone numbers, so service-role only |
| `photo-admin` function | Hide / delete / file photos, and manage events, behind a shared secret |
| `whatsapp-intake` function | Receives WhatsApp photos from Meta or Twilio, and runs the event conversation |

The URL and publishable key are in `src/lib/config.ts` — both are designed to
sit in a browser bundle. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a
`.env` override them if the site is ever pointed at a different project.

**Change the moderation key before the link goes out.** Set `PHOTO_ADMIN_KEY`
in Supabase → Edge Functions → Secrets, then put the same value into **Look →
Guest photos → Moderation key**. Until you do, it falls back to `123`.

### Turning on WhatsApp

The webhook URL for both providers is:

```
https://aipmyivogigxjexgnsys.supabase.co/functions/v1/whatsapp-intake
```

Add the secrets under Supabase → Edge Functions → Secrets, then put the phone
number into **Look → Guest photos → WhatsApp number** (international format,
digits only).

**Meta WhatsApp Cloud API** — free for messages a guest starts, but needs a
Meta Business account, a dedicated number and business verification, which can
take a few days.

| Secret | Where it comes from |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Any string you invent; type the same one into Meta's webhook setup |
| `WHATSAPP_TOKEN` | A permanent access token for the WhatsApp Business account |
| `WHATSAPP_APP_SECRET` | App → Settings → Basic. Enables signature checking |

Subscribe the webhook to the **messages** field. The interactive picker is sent
inside WhatsApp's 24-hour service window, which a guest opens by messaging you
first — so it always works in reply, but you cannot start the conversation days
later without a paid template.

**Twilio** — the sandbox works in minutes with no verification, costs a few
cents a message, and guests must join the sandbox with a code first.

| Secret | Where it comes from |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console. Also verifies request signatures |
| `WHATSAPP_PUBLIC_URL` | The webhook URL above, so signatures match behind the proxy |

Point the sandbox's "when a message comes in" at the webhook URL.

Set up whichever you get first — the function tells the two apart by the shape
of the request, so both can be live at once.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`,
so an admin save is live a minute or two later.

## How it fits together

```
src/
  content/           the editing layer
    site-content.json  every word, photo, colour and section on the site
    types.ts           its shape
    ContentContext.tsx the store: edits, drafts, save-to-GitHub, uploads
    Editable.tsx       a piece of editable copy
    EditableImage.tsx  a photograph, with crop / alt / focal point
    AdminList.tsx      any repeating list, with drag handles and add/delete
    AdminBar.tsx       the floating toolbar
    ThemePanel.tsx     palette and typefaces
    ContentEditorPanel.tsx  a generated form for every field, including links
    sectionTemplates.ts     the section palette
  sections/          one renderer per section type, plus the page canvas
    EventsPanel.tsx    the parts of the weekend, with per-event QR codes
  components/        Sortable (drag and drop), cropper, collage, gallery, QR
  lib/               theme, photos + events (Supabase), zip, qr, admin auth
supabase/
  migrations/        schema and row-level security
  functions/         photo-admin, whatsapp-intake
```

Adding a section type means adding it to `types.ts`, a renderer in
`sections/renderers.tsx`, and a template in `sectionTemplates.ts`. Everything
else — editing, dragging, colours, the generated form — picks it up for free.
