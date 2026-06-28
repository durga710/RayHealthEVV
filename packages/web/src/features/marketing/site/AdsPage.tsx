import { Link } from 'react-router-dom';
import { SiteLayout } from './SiteLayout.js';

/**
 * /ads — rebuilt on the shared SiteLayout (teal/orange brand). Showcase of
 * the RayHealthEVV™ ad creative in every delivered aspect ratio (square,
 * vertical, landscape) so the team can preview, grab a direct link, or
 * download for a given placement.
 *
 * Videos live in packages/web/public/ads/ and are served at /ads/*.mp4.
 * Note: vercel.json excludes `ads` from the SPA rewrite so these resolve
 * to the real files instead of index.html.
 */

interface AdVariant {
  label: string;
  ratioHint: string;
  src: string;
  /** CSS aspect-ratio value */
  aspect: string;
  /** max width so portrait clips don't dominate the row */
  maxWidth: string;
}

interface AdCampaign {
  name: string;
  blurb: string;
  variants: readonly AdVariant[];
}

const campaigns: readonly AdCampaign[] = [
  {
    name: 'Spot 1 — Care, on the same page',
    blurb: 'The flagship 30-second spot. Square for in-feed (Instagram, Facebook), vertical for Stories / Reels / TikTok.',
    variants: [
      {
        label: 'Square',
        ratioHint: '1:1 · feed',
        src: '/ads/RayHealthEVV_ad_square.mp4',
        aspect: '1 / 1',
        maxWidth: '420px',
      },
      {
        label: 'Vertical',
        ratioHint: '9:16 · stories / reels',
        src: '/ads/RayHealthEVV_ad_vertical.mp4',
        aspect: '9 / 16',
        maxWidth: '300px',
      },
    ],
  },
  {
    name: 'Spot 2 — Built for the field',
    blurb: 'Second campaign cut. Landscape for YouTube / web pre-roll, vertical for mobile-first placements.',
    variants: [
      {
        label: 'Landscape',
        ratioHint: '16:9 · youtube / web',
        src: '/ads/RayHealthEVV_ad2_landscape.mp4',
        aspect: '16 / 9',
        maxWidth: '640px',
      },
      {
        label: 'Vertical',
        ratioHint: '9:16 · stories / reels',
        src: '/ads/RayHealthEVV_ad2_vertical.mp4',
        aspect: '9 / 16',
        maxWidth: '300px',
      },
    ],
  },
] as const;

function VideoCard({ variant }: { variant: AdVariant }) {
  return (
    <div className="mk-card" style={{ width: '100%', maxWidth: variant.maxWidth, padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.6rem',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.95rem' }}>{variant.label}</span>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--mut)',
          }}
        >
          {variant.ratioHint}
        </span>
      </div>
      <video
        controls
        preload="metadata"
        playsInline
        style={{
          width: '100%',
          aspectRatio: variant.aspect,
          borderRadius: '10px',
          background: 'var(--ink-bg)',
          display: 'block',
        }}
      >
        <source src={variant.src} type="video/mp4" />
        Your browser does not support the video tag.{' '}
        <a href={variant.src}>Download the video</a> instead.
      </video>
      <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
        <a
          href={variant.src}
          download
          style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-deep)' }}
        >
          Download ↓
        </a>
      </div>
    </div>
  );
}

export function AdsPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Ad creative</span>
          <h1 className="mk-h1">RayHealthEVV™ ads — every format, ready to ship.</h1>
          <p className="mk-lead">
            Preview the current ad creative in each delivered aspect ratio. Use the square and
            landscape cuts for feeds and web pre-roll, the vertical cuts for Stories, Reels, and
            TikTok. Each clip can be played here or downloaded for upload to an ad platform.
          </p>
          <div className="mk-herocta">
            <Link to="/contact" className="mk-btn mk-pri">Book an agency demo</Link>
            <Link to="/launch" className="mk-btn mk-ghost">What's new</Link>
          </div>
        </div>
      </header>

      {campaigns.map((campaign, i) => (
        <section className={`mk-sec${i % 2 === 1 ? ' tight mk-alt' : ''}`} key={campaign.name}>
          <div className="mk-wrap">
            <p className="mk-eylabel">Campaign</p>
            <h2 className="mk-h2">{campaign.name}</h2>
            <p className="mk-deck">{campaign.blurb}</p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5rem',
                alignItems: 'flex-start',
                marginTop: '32px',
              }}
            >
              {campaign.variants.map((variant) => (
                <VideoCard key={variant.src} variant={variant} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Ready to run these in front of agencies?</h2>
            <p>Book a walkthrough on your own caseload, or see what just shipped.</p>
            <div className="mk-herocta">
              <Link to="/contact" className="mk-btn mk-white">Book an agency demo</Link>
              <Link to="/launch" className="mk-btn mk-outline">What's new</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
