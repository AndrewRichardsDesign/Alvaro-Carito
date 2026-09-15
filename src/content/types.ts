/**
 * The shape of `site-content.json` — the single source of truth for the whole
 * site. Everything a visitor sees (copy, photos, colours, fonts, the order and
 * even the existence of each section) lives here, so admin mode only ever has
 * to mutate this one document and commit it back to the repo.
 *
 * The one exception is guest photos, which arrive from strangers at any hour
 * and so live in Supabase instead — see `src/lib/photos.ts`.
 */

/** A `#rrggbb` colour. An empty string means "inherit from the theme". */
export type Hex = string;

export interface ThemeContent {
  fonts: {
    /** Google Font family used for headings, e.g. "Cormorant Garamond". */
    display: string;
    /** Google Font family used for body copy and UI, e.g. "Jost". */
    body: string;
  };
  /** Multiplier applied to display type, so headings can be tuned globally. */
  displayScale: number;
  /** Corner rounding in rem for cards and photos. */
  radius: number;
  colors: {
    canvas: Hex;
    surface: Hex;
    ink: Hex;
    display: Hex;
    muted: Hex;
    accent: Hex;
    accentInk: Hex;
    line: Hex;
  };
}

/** Per-section overrides. Empty colour strings fall back to the theme. */
export interface SectionStyle {
  bg: Hex;
  ink: Hex;
  display: Hex;
  accent: Hex;
  padding: 'tight' | 'normal' | 'roomy';
  width: 'narrow' | 'normal' | 'wide' | 'full';
  align: 'left' | 'center';
}

export interface PhotoRef {
  src: string;
  alt: string;
  caption: string;
  /** Focal point as a 0–100 percentage, honoured by object-position. */
  focusX: number;
  focusY: number;
}

interface SectionCommon {
  /** Stable id — used for anchors, reordering and React keys. */
  id: string;
  /** Label shown in the page nav; blank keeps the section out of the nav. */
  navLabel: string;
  hidden: boolean;
  style: SectionStyle;
}

export interface HeroSection extends SectionCommon {
  type: 'hero';
  eyebrow: string;
  names: string;
  tagline: string;
  date: string;
  place: string;
  ctaLabel: string;
  ctaHref: string;
  /** Curated photos placed in the collage before any guest photos. */
  collage: PhotoRef[];
  /** Pull the newest guest uploads into the collage automatically. */
  useGuestPhotos: boolean;
  /** How many collage tiles to fill in total. */
  collageCount: number;
}

export interface CountdownSection extends SectionCommon {
  type: 'countdown';
  eyebrow: string;
  title: string;
  /** ISO date-time the countdown runs to, e.g. "2027-05-15T16:00:00". */
  target: string;
  note: string;
  pastMessage: string;
}

export interface StorySection extends SectionCommon {
  type: 'story';
  eyebrow: string;
  title: string;
  body: string[];
  image: PhotoRef;
  imageSide: 'left' | 'right';
}

export interface ScheduleSection extends SectionCommon {
  type: 'schedule';
  eyebrow: string;
  title: string;
  intro: string;
  items: { time: string; title: string; place: string; desc: string }[];
}

export interface DetailsSection extends SectionCommon {
  type: 'details';
  eyebrow: string;
  title: string;
  intro: string;
  cards: { title: string; body: string; linkLabel: string; linkHref: string }[];
}

export interface GallerySection extends SectionCommon {
  type: 'gallery';
  eyebrow: string;
  title: string;
  intro: string;
  photos: PhotoRef[];
  /** Mix in photos guests sent by QR upload or WhatsApp. */
  useGuestPhotos: boolean;
  allowDownload: boolean;
  columns: 2 | 3 | 4;
}

export interface RsvpSection extends SectionCommon {
  type: 'rsvp';
  eyebrow: string;
  title: string;
  body: string;
  deadline: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface FaqSection extends SectionCommon {
  type: 'faq';
  eyebrow: string;
  title: string;
  intro: string;
  items: { q: string; a: string }[];
}

export interface RegistrySection extends SectionCommon {
  type: 'registry';
  eyebrow: string;
  title: string;
  intro: string;
  items: { name: string; note: string; linkLabel: string; linkHref: string }[];
}

export interface PartySection extends SectionCommon {
  type: 'party';
  eyebrow: string;
  title: string;
  intro: string;
  people: { name: string; role: string; note: string; photo: PhotoRef }[];
}

export interface QuoteSection extends SectionCommon {
  type: 'quote';
  quote: string;
  attribution: string;
}

export interface BannerSection extends SectionCommon {
  type: 'banner';
  image: PhotoRef;
  overline: string;
  title: string;
  height: 'short' | 'tall' | 'full';
}

export interface TextSection extends SectionCommon {
  type: 'text';
  eyebrow: string;
  title: string;
  body: string[];
}

export interface MapSection extends SectionCommon {
  type: 'map';
  eyebrow: string;
  title: string;
  venue: string;
  address: string;
  note: string;
  /** Opened in a new tab by the "Get directions" button. */
  mapHref: string;
  /** Optional Google Maps *embed* URL; blank hides the inline map. */
  embedSrc: string;
}

export interface LinksSection extends SectionCommon {
  type: 'links';
  eyebrow: string;
  title: string;
  intro: string;
  items: { label: string; note: string; href: string }[];
}

export interface ShareSection extends SectionCommon {
  type: 'share';
  eyebrow: string;
  title: string;
  intro: string;
  /** Overrides `guestPhotos.shareUrl` for this section's QR code, if set. */
  qrCaption: string;
  buttonLabel: string;
}

export interface FooterSection extends SectionCommon {
  type: 'footer';
  names: string;
  message: string;
  hashtag: string;
}

export type Section =
  | HeroSection
  | CountdownSection
  | StorySection
  | ScheduleSection
  | DetailsSection
  | GallerySection
  | RsvpSection
  | FaqSection
  | RegistrySection
  | PartySection
  | QuoteSection
  | BannerSection
  | TextSection
  | MapSection
  | LinksSection
  | ShareSection
  | FooterSection;

export type SectionType = Section['type'];

export interface SiteContent {
  meta: {
    title: string;
    description: string;
    coupleNames: string;
  };
  theme: ThemeContent;
  nav: {
    enabled: boolean;
    brand: string;
    ctaLabel: string;
    ctaHref: string;
  };
  guestPhotos: {
    enabled: boolean;
    /** Heading on the guest upload page reached from the QR code. */
    headline: string;
    intro: string;
    thanks: string;
    /**
     * Public URL of the site, used to build the QR code. Left blank, the QR
     * points at wherever the page is currently served from.
     */
    shareUrl: string;
    /** International format, digits only, e.g. "15551234567". Blank hides it. */
    whatsappNumber: string;
    whatsappLabel: string;
    /** Pre-filled first message, so the couple can recognise the sender. */
    whatsappMessage: string;
  };
  sections: Section[];
}
