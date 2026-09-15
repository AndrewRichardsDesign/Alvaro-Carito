import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, MapPin, MessageCircle, Plus } from 'lucide-react';
import type {
  BannerSection, CountdownSection, DetailsSection, FaqSection, FooterSection, GallerySection,
  HeroSection, LinksSection, MapSection, PartySection, QuoteSection, RegistrySection, RsvpSection,
  ScheduleSection, Section, ShareSection, StorySection, TextSection,
} from '@/content/types';
import { Editable } from '@/content/Editable';
import { EditableImage } from '@/content/EditableImage';
import { AdminList } from '@/content/AdminList';
import { useContent } from '@/content/ContentContext';
import { photo as blankPhoto } from '@/content/sectionTemplates';
import { SectionShell } from './SectionShell';
import { ActionLink, Eyebrow, Flourish, Heading, Intro, SectionHeader } from './parts';
import { HeroCollage } from '@/components/HeroCollage';
import { PhotoGallery } from '@/components/PhotoGallery';
import { QrCode } from '@/components/QrCode';
import { shareUrl, whatsappUrl } from '@/lib/share';
import { cn } from '@/lib/utils';

/** Dispatch a section to its renderer. `base` is its path, e.g. "sections.3". */
export function SectionView({ section, base }: { section: Section; base: string }) {
  switch (section.type) {
    case 'hero': return <Hero section={section} base={base} />;
    case 'countdown': return <Countdown section={section} base={base} />;
    case 'story': return <Story section={section} base={base} />;
    case 'banner': return <Banner section={section} base={base} />;
    case 'schedule': return <Schedule section={section} base={base} />;
    case 'map': return <VenueMap section={section} base={base} />;
    case 'details': return <Details section={section} base={base} />;
    case 'rsvp': return <Rsvp section={section} base={base} />;
    case 'share': return <Share section={section} base={base} />;
    case 'gallery': return <Gallery section={section} base={base} />;
    case 'registry': return <Registry section={section} base={base} />;
    case 'faq': return <Faq section={section} base={base} />;
    case 'party': return <Party section={section} base={base} />;
    case 'quote': return <Quote section={section} base={base} />;
    case 'text': return <TextBlock section={section} base={base} />;
    case 'links': return <Links section={section} base={base} />;
    case 'footer': return <Footer section={section} base={base} />;
    default: return null;
  }
}

/* ── Hero ─────────────────────────────────────────────────────────────── */

function Hero({ section, base }: { section: HeroSection; base: string }) {
  return (
    <SectionShell section={section} bleed className="paper overflow-hidden">
      <div className="relative flex min-h-[92svh] flex-col items-center justify-center px-6 py-24 text-center">
        <HeroCollage
          basePath={base}
          collage={section.collage}
          useGuests={section.useGuestPhotos}
          count={section.collageCount}
        />

        <div className="relative z-10 mx-auto max-w-3xl animate-fade-rise">
          <Editable path={`${base}.eyebrow`} as="p" className="eyebrow" placeholder="Eyebrow" hideWhenEmpty />
          <Editable
            path={`${base}.names`}
            as="h1"
            className="display-xl mt-6 text-balance"
            placeholder="Your names"
          />
          <Flourish className="mt-7" />
          <div className="mt-7 flex flex-col items-center gap-1.5">
            <Editable
              path={`${base}.date`}
              as="p"
              className="text-[0.82rem] uppercase tracking-[0.3em] text-ink"
              placeholder="The date"
            />
            <Editable
              path={`${base}.place`}
              as="p"
              className="text-[0.82rem] uppercase tracking-[0.3em] text-muted"
              placeholder="The place"
              hideWhenEmpty
            />
          </div>
          <Editable
            path={`${base}.tagline`}
            as="p"
            multiline
            hideWhenEmpty
            placeholder="A line of welcome…"
            className="mx-auto mt-8 max-w-lg text-[0.95rem] leading-relaxed text-muted"
          />
          <div className="mt-10">
            <ActionLink labelPath={`${base}.ctaLabel`} href={section.ctaHref} />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ── Countdown ────────────────────────────────────────────────────────── */

function useCountdown(target: string) {
  const targetMs = useMemo(() => {
    const t = new Date(target).getTime();
    return Number.isFinite(t) ? t : null;
  }, [target]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // One tick a second is plenty, and it stops when the date has passed.
    if (targetMs == null || targetMs <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) return null;
  const remaining = targetMs - now;
  if (remaining <= 0) return { past: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const seconds = Math.floor(remaining / 1000);
  return {
    past: false,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function Countdown({ section, base }: { section: CountdownSection; base: string }) {
  const time = useCountdown(section.target);
  const units = time && !time.past
    ? [
        { label: 'Days', value: time.days },
        { label: 'Hours', value: time.hours },
        { label: 'Minutes', value: time.minutes },
        { label: 'Seconds', value: time.seconds },
      ]
    : [];

  return (
    <SectionShell section={section}>
      <Eyebrow path={`${base}.eyebrow`} />
      <Heading path={`${base}.title`} className="display-lg" />
      {time?.past ? (
        <Editable path={`${base}.pastMessage`} as="p" className="mt-7 text-lg text-muted" placeholder="After the day…" />
      ) : (
        <div className="mt-10 flex flex-wrap items-start justify-center gap-x-10 gap-y-6 sm:gap-x-16">
          {units.map((unit) => (
            <div key={unit.label} className="min-w-[4.5rem]">
              <p className="font-display text-5xl tabular-nums text-display sm:text-6xl">
                {String(unit.value).padStart(2, '0')}
              </p>
              <p className="eyebrow mt-2">{unit.label}</p>
            </div>
          ))}
        </div>
      )}
      <Editable path={`${base}.note`} as="p" className="mt-8 text-xs uppercase tracking-[0.22em] text-muted" placeholder="A note" hideWhenEmpty />
    </SectionShell>
  );
}

/* ── Story ────────────────────────────────────────────────────────────── */

function Story({ section, base }: { section: StorySection; base: string }) {
  const { isAdmin } = useContent();
  return (
    <SectionShell section={section} className="overflow-hidden">
      <div
        className={cn(
          'grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16',
          section.imageSide === 'left' && 'lg:[&>*:first-child]:order-2'
        )}
      >
        <div className="text-left">
          <Eyebrow path={`${base}.eyebrow`} />
          <Heading path={`${base}.title`} />
          <div className="group/list mt-7 space-y-5">
            <AdminList
              path={`${base}.body`}
              newItem={() => 'A new paragraph.'}
              addLabel="Add a paragraph"
              className="space-y-5"
              renderItem={(i) => (
                <Editable
                  path={`${base}.body.${i}`}
                  as="p"
                  multiline
                  placeholder="Write a paragraph…"
                  className="text-[1.02rem] leading-[1.85] text-ink/90"
                />
              )}
            />
          </div>
        </div>

        <figure className="relative">
          <EditableImage
            path={`${base}.image`}
            className="h-full w-full rounded-[var(--radius)] object-cover shadow-[0_30px_70px_-40px_rgba(0,0,0,0.55)]"
            wrapperClassName="aspect-[4/5] overflow-hidden rounded-[var(--radius)]"
          />
          <Editable
            path={`${base}.image.caption`}
            as="figcaption"
            hideWhenEmpty
            placeholder="Caption"
            className="mt-3 text-center text-xs italic text-muted"
          />
          {isAdmin && (
            <p className="mt-2 text-center text-[11px] text-muted">
              Photo on the {section.imageSide}. Swap sides in the section settings.
            </p>
          )}
        </figure>
      </div>
    </SectionShell>
  );
}

/* ── Banner ───────────────────────────────────────────────────────────── */

const BANNER_HEIGHTS = { short: 'h-[38vh] min-h-[260px]', tall: 'h-[62vh] min-h-[380px]', full: 'h-[92svh]' };

function Banner({ section, base }: { section: BannerSection; base: string }) {
  return (
    <SectionShell section={section} bleed>
      <div className={cn('relative w-full overflow-hidden', BANNER_HEIGHTS[section.height] ?? BANNER_HEIGHTS.tall)}>
        <EditableImage
          path={`${base}.image`}
          className="h-full w-full object-cover"
          wrapperClassName="absolute inset-0 h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 text-center">
          <Editable path={`${base}.overline`} as="p" hideWhenEmpty placeholder="Overline"
            className="eyebrow text-white/80" />
          <Editable path={`${base}.title`} as="p" hideWhenEmpty placeholder="A word over the photo"
            className="display-lg mt-2 text-white drop-shadow-sm" />
        </div>
      </div>
    </SectionShell>
  );
}

/* ── Schedule ─────────────────────────────────────────────────────────── */

function Schedule({ section, base }: { section: ScheduleSection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="group/list mt-14">
        <AdminList
          path={`${base}.items`}
          newItem={() => ({ time: '0:00 pm', title: 'Something lovely', place: '', desc: '' })}
          addLabel="Add a moment"
          className="relative mx-auto max-w-2xl text-left"
          itemClassName="relative"
          renderItem={(i) => (
            <div className="relative grid grid-cols-[5.5rem_1fr] gap-5 pb-10 sm:grid-cols-[7rem_1fr] sm:gap-8">
              {/* The hairline and dot that make the timeline read as one thread. */}
              <span className="absolute left-[5.5rem] top-2 h-full w-px -translate-x-1/2 bg-line sm:left-[7rem]" aria-hidden />
              <span className="absolute left-[5.5rem] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-accent ring-4 ring-canvas sm:left-[7rem]" aria-hidden />
              <Editable
                path={`${base}.items.${i}.time`}
                as="p"
                placeholder="Time"
                className="pr-5 text-right text-[0.78rem] uppercase tracking-[0.16em] text-muted sm:pr-8"
              />
              <div className="pl-5 sm:pl-8">
                <Editable path={`${base}.items.${i}.title`} as="h3" placeholder="What happens"
                  className="font-display text-2xl text-display" />
                <Editable path={`${base}.items.${i}.place`} as="p" hideWhenEmpty placeholder="Where"
                  className="mt-1 text-[0.72rem] uppercase tracking-[0.18em] text-accent" />
                <Editable path={`${base}.items.${i}.desc`} as="p" multiline hideWhenEmpty placeholder="A detail"
                  className="mt-2 text-sm leading-relaxed text-muted" />
              </div>
            </div>
          )}
        />
      </div>
    </SectionShell>
  );
}

/* ── Venue & map ──────────────────────────────────────────────────────── */

function VenueMap({ section, base }: { section: MapSection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align} />
      <div className="mt-8 flex flex-col items-center gap-2">
        <Editable path={`${base}.venue`} as="p" placeholder="Venue name"
          className="font-display text-2xl text-display" />
        <Editable path={`${base}.address`} as="p" multiline placeholder="Street address"
          className="max-w-sm text-sm leading-relaxed text-muted" />
        <Editable path={`${base}.note`} as="p" multiline hideWhenEmpty placeholder="A practical note"
          className="mt-3 max-w-md text-sm leading-relaxed text-muted" />
      </div>

      {section.embedSrc && (
        <div className="mt-10 overflow-hidden rounded-[var(--radius)] ring-1 ring-line">
          <iframe
            src={section.embedSrc}
            title={`Map of ${section.venue}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[360px] w-full border-0"
          />
        </div>
      )}

      <div className="mt-10">
        <ActionLink labelPath={`${base}.title`} href="" className="hidden" />
        <MapButton href={section.mapHref} />
      </div>
    </SectionShell>
  );
}

function MapButton({ href }: { href: string }) {
  const { isAdmin } = useContent();
  const classes =
    'group/cta inline-flex items-center gap-2 rounded-full border border-accent/40 px-7 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/10';
  const inner = (
    <>
      <MapPin className="h-4 w-4" />
      Get directions
    </>
  );
  if (isAdmin || !href) return <span className={classes}>{inner}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {inner}
    </a>
  );
}

/* ── Detail cards ─────────────────────────────────────────────────────── */

function Details({ section, base }: { section: DetailsSection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="group/list mt-14">
        <AdminList
          path={`${base}.cards`}
          axis="grid"
          newItem={() => ({ title: 'A heading', body: 'Something useful.', linkLabel: '', linkHref: '' })}
          addLabel="Add a card"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          renderItem={(i) => (
            <article className="flex h-full flex-col rounded-[var(--radius)] bg-surface p-7 text-left ring-1 ring-line/80 transition-shadow duration-500 hover:shadow-[0_24px_50px_-34px_rgba(0,0,0,0.5)]">
              <Editable path={`${base}.cards.${i}.title`} as="h3" placeholder="Heading"
                className="font-display text-xl text-display" />
              <span className="mt-3 h-px w-8 bg-accent/50" aria-hidden />
              <Editable path={`${base}.cards.${i}.body`} as="p" multiline placeholder="The detail"
                className="mt-4 flex-1 text-sm leading-relaxed text-muted" />
              <CardLink labelPath={`${base}.cards.${i}.linkLabel`} href={section.cards[i]?.linkHref ?? ''} />
            </article>
          )}
        />
      </div>
    </SectionShell>
  );
}

/** A small "read more" link that hides itself when it has no label. */
function CardLink({ labelPath, href }: { labelPath: string; href: string }) {
  const { content, isAdmin } = useContent();
  const label = String(labelPath.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], content) ?? '');
  if (!label && !isAdmin) return null;

  const classes = 'mt-5 inline-flex items-center gap-1 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-accent';
  const inner = (
    <>
      <Editable path={labelPath} as="span" placeholder="Link label" />
      <ArrowUpRight className="h-3.5 w-3.5" />
    </>
  );
  if (isAdmin || !href) return <span className={classes}>{inner}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(classes, 'hover:underline')}>
      {inner}
    </a>
  );
}

/* ── RSVP ─────────────────────────────────────────────────────────────── */

function Rsvp({ section, base }: { section: RsvpSection; base: string }) {
  return (
    <SectionShell section={section}>
      <div className="rounded-[calc(var(--radius)*1.6)] bg-surface px-8 py-14 ring-1 ring-line/80 sm:px-14">
        <Eyebrow path={`${base}.eyebrow`} />
        <Heading path={`${base}.title`} />
        <Editable path={`${base}.body`} as="p" multiline placeholder="A line about replying"
          className="mx-auto mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted" />
        <div className="mt-9">
          <ActionLink labelPath={`${base}.buttonLabel`} href={section.buttonHref} />
        </div>
        <Editable path={`${base}.deadline`} as="p" hideWhenEmpty placeholder="Reply-by date"
          className="mt-6 text-[0.7rem] uppercase tracking-[0.22em] text-muted" />
      </div>
    </SectionShell>
  );
}

/* ── Share photos ─────────────────────────────────────────────────────── */

function Share({ section, base }: { section: ShareSection; base: string }) {
  const { content } = useContent();
  const config = content.guestPhotos;
  const url = shareUrl(config.shareUrl);
  const wa = whatsappUrl(config.whatsappNumber, config.whatsappMessage);

  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="mt-12 flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:justify-center sm:gap-14">
        <figure className="flex flex-col items-center">
          <div className="rounded-[var(--radius)] bg-white p-4 shadow-[0_24px_54px_-30px_rgba(0,0,0,0.55)] ring-1 ring-line">
            <QrCode value={url} size={200} />
          </div>
          <Editable path={`${base}.qrCaption`} as="figcaption" hideWhenEmpty placeholder="Caption under the code"
            className="mt-4 text-[0.7rem] uppercase tracking-[0.2em] text-muted" />
        </figure>

        <div className="flex flex-col items-center gap-4 sm:items-start sm:text-left">
          <a
            href="#/share"
            className="group/cta inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-accent-ink transition-all hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            <Editable path={`${base}.buttonLabel`} as="span" placeholder="Button label" />
          </a>

          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-7 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/10"
            >
              <MessageCircle className="h-4 w-4" />
              {config.whatsappLabel || 'Send on WhatsApp'}
            </a>
          )}

          <p className="max-w-xs text-xs leading-relaxed text-muted">
            Everything sent in appears in the album below, and anybody can download it afterwards.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

/* ── Gallery ──────────────────────────────────────────────────────────── */

function Gallery({ section, base }: { section: GallerySection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>
      <PhotoGallery
        basePath={base}
        photos={section.photos}
        useGuests={section.useGuestPhotos}
        allowDownload={section.allowDownload}
        columns={section.columns}
      />
    </SectionShell>
  );
}

/* ── Registry ─────────────────────────────────────────────────────────── */

function Registry({ section, base }: { section: RegistrySection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="group/list mt-12">
        <AdminList
          path={`${base}.items`}
          axis="grid"
          newItem={() => ({ name: 'A gift idea', note: '', linkLabel: 'Open', linkHref: '' })}
          addLabel="Add an option"
          className="grid gap-4 sm:grid-cols-3"
          renderItem={(i) => (
            <article className="flex h-full flex-col items-center rounded-[var(--radius)] border border-line/80 px-6 py-8 text-center">
              <Editable path={`${base}.items.${i}.name`} as="h3" placeholder="Name"
                className="font-display text-xl text-display" />
              <Editable path={`${base}.items.${i}.note`} as="p" multiline hideWhenEmpty placeholder="A note"
                className="mt-3 flex-1 text-sm leading-relaxed text-muted" />
              <CardLink labelPath={`${base}.items.${i}.linkLabel`} href={section.items[i]?.linkHref ?? ''} />
            </article>
          )}
        />
      </div>
    </SectionShell>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */

function Faq({ section, base }: { section: FaqSection; base: string }) {
  const { isAdmin } = useContent();
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="group/list mt-12 text-left">
        <AdminList
          path={`${base}.items`}
          newItem={() => ({ q: 'A question?', a: 'The answer.' })}
          addLabel="Add a question"
          className="divide-y divide-line border-y border-line"
          renderItem={(i) => (
            // Native <details> rather than a JS accordion: it works before the
            // bundle loads, it prints open, and Ctrl+F finds closed answers.
            <details className="group/faq py-5" open={isAdmin || undefined}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <Editable path={`${base}.items.${i}.q`} as="span" placeholder="The question"
                  className="font-display text-lg text-display" />
                <span className="flex-none text-accent transition-transform duration-300 group-open/faq:rotate-45" aria-hidden>
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <Editable path={`${base}.items.${i}.a`} as="p" multiline placeholder="The answer"
                className="mt-3 max-w-2xl pr-8 text-sm leading-relaxed text-muted" />
            </details>
          )}
        />
      </div>
    </SectionShell>
  );
}

/* ── Wedding party ────────────────────────────────────────────────────── */

function Party({ section, base }: { section: PartySection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="group/list mt-14">
        <AdminList
          path={`${base}.people`}
          axis="grid"
          newItem={() => ({ name: 'Name', role: 'Their role', note: '', photo: blankPhoto('') })}
          addLabel="Add somebody"
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
          renderItem={(i) => (
            <figure className="text-center">
              <EditableImage
                path={`${base}.people.${i}.photo`}
                className="h-full w-full object-cover"
                wrapperClassName="aspect-[3/4] overflow-hidden rounded-[var(--radius)] bg-surface ring-1 ring-line/70"
              />
              <figcaption className="mt-4">
                <Editable path={`${base}.people.${i}.name`} as="p" placeholder="Name"
                  className="font-display text-xl text-display" />
                <Editable path={`${base}.people.${i}.role`} as="p" placeholder="Role"
                  className="mt-1 text-[0.68rem] uppercase tracking-[0.2em] text-accent" />
                <Editable path={`${base}.people.${i}.note`} as="p" multiline hideWhenEmpty placeholder="A line about them"
                  className="mt-2 text-sm leading-relaxed text-muted" />
              </figcaption>
            </figure>
          )}
        />
      </div>
    </SectionShell>
  );
}

/* ── Quote ────────────────────────────────────────────────────────────── */

function Quote({ section, base }: { section: QuoteSection; base: string }) {
  return (
    <SectionShell section={section}>
      <Editable
        path={`${base}.quote`}
        as="blockquote"
        multiline
        placeholder="A line worth setting large"
        className="font-display text-3xl leading-[1.3] text-balance text-display sm:text-4xl"
      />
      <Editable path={`${base}.attribution`} as="p" hideWhenEmpty placeholder="Who said it"
        className="mt-6 text-[0.7rem] uppercase tracking-[0.24em] text-muted" />
    </SectionShell>
  );
}

/* ── Plain text ───────────────────────────────────────────────────────── */

function TextBlock({ section, base }: { section: TextSection; base: string }) {
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align} />
      <div className="group/list mt-8">
        <AdminList
          path={`${base}.body`}
          newItem={() => 'A new paragraph.'}
          addLabel="Add a paragraph"
          className="mx-auto max-w-2xl space-y-5"
          renderItem={(i) => (
            <Editable path={`${base}.body.${i}`} as="p" multiline placeholder="Write a paragraph…"
              className="text-[1.02rem] leading-[1.85] text-ink/90" />
          )}
        />
      </div>
    </SectionShell>
  );
}

/* ── Links ────────────────────────────────────────────────────────────── */

function Links({ section, base }: { section: LinksSection; base: string }) {
  const { isAdmin } = useContent();
  return (
    <SectionShell section={section}>
      <SectionHeader base={base} align={section.style.align}>
        <Intro path={`${base}.intro`} />
      </SectionHeader>

      <div className="group/list mt-10 text-left">
        <AdminList
          path={`${base}.items`}
          newItem={() => ({ label: 'A link', note: '', href: '' })}
          addLabel="Add a link"
          className="mx-auto max-w-xl divide-y divide-line border-y border-line"
          renderItem={(i) => {
            const item = section.items[i];
            const row = (
              <span className="flex items-center justify-between gap-4 py-4">
                <span className="min-w-0">
                  <Editable path={`${base}.items.${i}.label`} as="span" placeholder="Label"
                    className="block font-display text-lg text-display" />
                  <Editable path={`${base}.items.${i}.note`} as="span" hideWhenEmpty placeholder="A note"
                    className="mt-0.5 block text-xs text-muted" />
                </span>
                <ArrowUpRight className="h-4 w-4 flex-none text-accent" />
              </span>
            );
            if (isAdmin || !item?.href) return <div className="block">{row}</div>;
            return (
              <a href={item.href} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:text-accent">
                {row}
              </a>
            );
          }}
        />
      </div>
    </SectionShell>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────── */

function Footer({ section, base }: { section: FooterSection; base: string }) {
  return (
    <SectionShell section={section}>
      <Editable path={`${base}.names`} as="p" placeholder="Your names"
        className="font-display text-3xl text-display sm:text-4xl" />
      <Flourish className="mt-6" />
      <Editable path={`${base}.message`} as="p" multiline hideWhenEmpty placeholder="A closing line"
        className="mt-6 text-sm text-ink/80" />
      <Editable path={`${base}.hashtag`} as="p" hideWhenEmpty placeholder="#YourHashtag"
        className="mt-8 text-[0.7rem] uppercase tracking-[0.28em] text-accent" />
    </SectionShell>
  );
}
