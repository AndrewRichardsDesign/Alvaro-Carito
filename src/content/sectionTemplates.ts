/**
 * The section palette.
 *
 * Every template here is a plain factory returning a fully-populated section
 * object. That matters: a newly-added section arrives with real placeholder
 * copy already in it, so the couple can click straight into the page and type
 * over it rather than staring at an empty box. Nothing a template produces is
 * special — it is the same shape as the sections that ship with the site, so
 * it is just as editable, movable and deletable.
 */
import type { PhotoRef, Section, SectionStyle, SectionType } from './types';

export const DEFAULT_STYLE: SectionStyle = {
  bg: '',
  ink: '',
  display: '',
  accent: '',
  padding: 'normal',
  width: 'normal',
  align: 'center',
};

/** A neutral stand-in so a fresh photo slot is visible rather than broken. */
export const PLACEHOLDER_PHOTO =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80';

export function photo(src = PLACEHOLDER_PHOTO, alt = 'Wedding photograph'): PhotoRef {
  return { src, alt, caption: '', focusX: 50, focusY: 50 };
}

/** Collision-resistant enough for a document edited by two people. */
export function newId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

function base(type: SectionType, navLabel = ''): { id: string; navLabel: string; hidden: boolean; style: SectionStyle } {
  return { id: newId(type), navLabel, hidden: false, style: { ...DEFAULT_STYLE } };
}

export interface SectionTemplate {
  type: SectionType;
  label: string;
  group: 'Essentials' | 'Story' | 'Guests' | 'Photos' | 'Layout';
  description: string;
  create: () => Section;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    type: 'hero',
    label: 'Hero — names & date',
    group: 'Essentials',
    description: 'Full-height opener with a scattered photo collage behind the names.',
    create: () => ({
      ...base('hero'),
      type: 'hero',
      eyebrow: 'We are getting married',
      names: 'Alvaro & Carito',
      tagline: 'Together with our families, we invite you to celebrate with us.',
      date: 'Saturday, 15 May 2027',
      place: 'Cartagena, Colombia',
      ctaLabel: 'RSVP',
      ctaHref: '#rsvp',
      collage: [photo(), photo(), photo(), photo(), photo()],
      useGuestPhotos: true,
      collageCount: 7,
    }),
  },
  {
    type: 'countdown',
    label: 'Countdown',
    group: 'Essentials',
    description: 'Live days / hours / minutes counter to the ceremony.',
    create: () => ({
      ...base('countdown'),
      type: 'countdown',
      eyebrow: 'Counting down',
      title: 'Until we say I do',
      target: '2027-05-15T16:00:00',
      note: 'Cartagena time',
      pastMessage: 'Thank you for celebrating with us.',
    }),
  },
  {
    type: 'story',
    label: 'Story — text & photo',
    group: 'Story',
    description: 'Two-column editorial block: paragraphs beside a portrait.',
    create: () => ({
      ...base('story', 'Our story'),
      type: 'story',
      eyebrow: 'Our story',
      title: 'How we got here',
      body: [
        'Write the story of how you met here. A couple of short paragraphs reads better than one long one.',
        'Click any of this text in admin mode to replace it with your own.',
      ],
      image: photo(),
      imageSide: 'right',
    }),
  },
  {
    type: 'schedule',
    label: 'Schedule / timeline',
    group: 'Essentials',
    description: 'Vertical timeline of the day, hour by hour.',
    create: () => ({
      ...base('schedule', 'Schedule'),
      type: 'schedule',
      eyebrow: 'The day',
      title: 'Schedule',
      intro: 'Everything happens at the same venue unless noted.',
      items: [
        { time: '4:00 pm', title: 'Ceremony', place: 'The garden', desc: 'Please arrive fifteen minutes early.' },
        { time: '5:00 pm', title: 'Cocktails', place: 'The terrace', desc: 'Drinks, canapés and photographs.' },
        { time: '7:00 pm', title: 'Dinner', place: 'The old hall', desc: 'Seated dinner and speeches.' },
        { time: '9:30 pm', title: 'Dancing', place: 'The courtyard', desc: 'Until late.' },
      ],
    }),
  },
  {
    type: 'details',
    label: 'Detail cards',
    group: 'Essentials',
    description: 'A row of cards for travel, dress code, accommodation, anything.',
    create: () => ({
      ...base('details', 'Details'),
      type: 'details',
      eyebrow: 'Good to know',
      title: 'Details',
      intro: '',
      cards: [
        { title: 'Dress code', body: 'Garden formal. The ceremony is on grass, so consider your heels.', linkLabel: '', linkHref: '' },
        { title: 'Getting there', body: 'The venue is forty minutes from the airport. Taxis are easy to find.', linkLabel: 'Open in Maps', linkHref: '' },
        { title: 'Staying over', body: 'We have held rooms at two hotels nearby, at a reduced rate.', linkLabel: 'See hotels', linkHref: '' },
      ],
    }),
  },
  {
    type: 'map',
    label: 'Venue & map',
    group: 'Essentials',
    description: 'Address, directions button and an optional embedded map.',
    create: () => ({
      ...base('map', 'Venue'),
      type: 'map',
      eyebrow: 'Where',
      title: 'The venue',
      venue: 'Hacienda San Miguel',
      address: 'Carrera 4 #36-12, Cartagena, Colombia',
      note: 'Parking is available on site.',
      mapHref: 'https://maps.google.com/?q=Cartagena',
      embedSrc: '',
    }),
  },
  {
    type: 'rsvp',
    label: 'RSVP',
    group: 'Guests',
    description: 'A short invitation to reply, linking to your form.',
    create: () => ({
      ...base('rsvp', 'RSVP'),
      type: 'rsvp',
      eyebrow: 'Join us',
      title: 'RSVP',
      body: 'We would love to know if you can make it. One form per invitation, please.',
      deadline: 'Kindly reply by 1 March 2027',
      buttonLabel: 'Reply now',
      buttonHref: '',
    }),
  },
  {
    type: 'faq',
    label: 'FAQ',
    group: 'Guests',
    description: 'Expandable questions and answers.',
    create: () => ({
      ...base('faq', 'FAQ'),
      type: 'faq',
      eyebrow: 'Questions',
      title: 'Before you ask',
      intro: '',
      items: [
        { q: 'Can I bring a guest?', a: 'Your invitation names everyone we have space for. Do ask us if you are unsure.' },
        { q: 'Are children welcome?', a: 'Very much so. Let us know ages on the RSVP form.' },
        { q: 'What about dietary requirements?', a: 'Tell us on the RSVP form and the kitchen will take care of it.' },
      ],
    }),
  },
  {
    type: 'registry',
    label: 'Gifts / registry',
    group: 'Guests',
    description: 'Linked cards for a registry, a honeymoon fund, or a charity.',
    create: () => ({
      ...base('registry', 'Gifts'),
      type: 'registry',
      eyebrow: 'Gifts',
      title: 'If you would like to give something',
      intro: 'Your presence is the gift. But if you insist, here are a few ideas.',
      items: [
        { name: 'The honeymoon', note: 'A contribution towards two weeks away.', linkLabel: 'Contribute', linkHref: '' },
        { name: 'Registry', note: 'A short list of things for the new house.', linkLabel: 'Open registry', linkHref: '' },
      ],
    }),
  },
  {
    type: 'party',
    label: 'Wedding party',
    group: 'Story',
    description: 'Portraits of the people standing beside you.',
    create: () => ({
      ...base('party', 'The party'),
      type: 'party',
      eyebrow: 'Beside us',
      title: 'The wedding party',
      intro: '',
      people: [
        { name: 'Name', role: 'Maid of honour', note: 'A line about them.', photo: photo() },
        { name: 'Name', role: 'Best man', note: 'A line about them.', photo: photo() },
        { name: 'Name', role: 'Bridesmaid', note: 'A line about them.', photo: photo() },
      ],
    }),
  },
  {
    type: 'gallery',
    label: 'Photo gallery',
    group: 'Photos',
    description: 'A grid of your photos, optionally mixed with guest uploads. Downloadable.',
    create: () => ({
      ...base('gallery', 'Photos'),
      type: 'gallery',
      eyebrow: 'Photographs',
      title: 'The album',
      intro: 'Tap any photograph to see it full size, or download it.',
      photos: [photo(), photo(), photo(), photo(), photo(), photo()],
      useGuestPhotos: true,
      allowDownload: true,
      columns: 3,
    }),
  },
  {
    type: 'share',
    label: 'Guest photo invitation',
    group: 'Photos',
    description: 'QR code and WhatsApp number so guests can send photos straight to the site.',
    create: () => ({
      ...base('share', 'Share photos'),
      type: 'share',
      eyebrow: 'Your photographs',
      title: 'Send us your photos',
      intro: 'Point a camera at the code, or send them on WhatsApp. They appear here within seconds.',
      qrCaption: 'Scan to add your photos',
      buttonLabel: 'Add photos',
    }),
  },
  {
    type: 'banner',
    label: 'Full-width photo',
    group: 'Layout',
    description: 'An edge-to-edge photograph, optionally with a line of type over it.',
    create: () => ({
      ...base('banner'),
      type: 'banner',
      image: photo(),
      overline: '',
      title: '',
      height: 'tall',
    }),
  },
  {
    type: 'quote',
    label: 'Pull quote',
    group: 'Layout',
    description: 'One large line of type, set on its own.',
    create: () => ({
      ...base('quote'),
      type: 'quote',
      quote: 'And so the adventure begins.',
      attribution: '',
    }),
  },
  {
    type: 'text',
    label: 'Plain text block',
    group: 'Layout',
    description: 'A heading and paragraphs. The blank canvas of the set.',
    create: () => ({
      ...base('text'),
      type: 'text',
      eyebrow: '',
      title: 'A heading',
      body: ['Write anything here.'],
    }),
  },
  {
    type: 'links',
    label: 'Link list',
    group: 'Layout',
    description: 'A tidy list of outbound links — playlists, hotels, group chats.',
    create: () => ({
      ...base('links'),
      type: 'links',
      eyebrow: '',
      title: 'Useful links',
      intro: '',
      items: [
        { label: 'The playlist', note: 'Add a song you want to hear', href: '' },
        { label: 'Hotel booking', note: 'Our reduced rate', href: '' },
      ],
    }),
  },
  {
    type: 'footer',
    label: 'Footer',
    group: 'Layout',
    description: 'Closing names, a message and your hashtag.',
    create: () => ({
      ...base('footer'),
      type: 'footer',
      names: 'Alvaro & Carito',
      message: 'We cannot wait to see you.',
      hashtag: '#AlvaroAndCarito',
    }),
  },
];

export function templateFor(type: SectionType): SectionTemplate | undefined {
  return SECTION_TEMPLATES.find((t) => t.type === type);
}

/** Human label for a section, used by the admin outline and drag handles. */
export function sectionLabel(section: Section): string {
  const template = templateFor(section.type);
  const own =
    ('title' in section && section.title) ||
    ('names' in section && section.names) ||
    ('quote' in section && section.quote) ||
    '';
  const trimmed = String(own).trim();
  if (trimmed) return trimmed.length > 34 ? `${trimmed.slice(0, 34)}…` : trimmed;
  return template?.label ?? section.type;
}
