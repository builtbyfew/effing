import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import {
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";
import {
  PropertyCard,
  StatusBadge,
  PricingCard,
  TagCloud,
  StatsBar,
  ListingOverlayCard,
  GradientHeroCard,
  JobPostCard,
  MetricsDashboard,
  BannerStrip,
} from "./_fixtures/cards.tsx";
import type {
  PropertyCardProps,
  PricingCardProps,
  TagCloudProps,
  StatsBarProps,
} from "./_fixtures/cards.tsx";

// ---------------------------------------------------------------------------
// Test case data
// ---------------------------------------------------------------------------

const propertyCases: {
  label: string;
  props: Omit<PropertyCardProps, "width" | "height">;
  maxDiff: number;
}[] = [
  {
    label: "new apartment with many features",
    props: {
      address: "1234 NW Evergreen Terrace Boulevard, Springfield, OR 97403",
      price: "$425,000",
      status: "NEW",
      beds: 3,
      baths: 2,
      sqft: "1,850",
      features: [
        "Central AC",
        "Garage",
        "Pool",
        "Hardwood Floors",
        "Updated Kitchen",
        "Fenced Yard",
      ],
    },
    // 1.51% measured.
    maxDiff: 2.3,
  },
  {
    label: "sold house with few features",
    props: {
      address: "42 Oak Lane",
      price: "$289,000",
      status: "SOLD",
      beds: 2,
      baths: 1,
      sqft: "960",
      features: ["Parking", "Balcony"],
    },
    // 0.38% measured.
    maxDiff: 0.6,
  },
];

const pricingCases: {
  label: string;
  props: Omit<PricingCardProps, "width" | "height">;
  maxDiff: number;
}[] = [
  {
    label: "highlighted Pro plan with yearly discount",
    props: {
      planName: "Pro",
      monthlyPrice: 29,
      yearlyPrice: 278,
      features: [
        "Unlimited projects",
        "Priority support",
        "Custom domain",
        "Analytics",
      ],
      highlighted: true,
    },
    // 1.01% measured.
    maxDiff: 1.6,
  },
  {
    label: "plain Starter plan without yearly",
    props: {
      planName: "Starter",
      monthlyPrice: 9,
      features: ["5 projects", "Community support", "Basic analytics"],
      highlighted: false,
    },
    // 0.71% measured.
    maxDiff: 1.1,
  },
];

const tagCloudCases: {
  label: string;
  props: Omit<TagCloudProps, "width" | "height">;
}[] = [
  {
    label: "many short tags wrapping",
    props: {
      tags: [
        "React",
        "Vue",
        "Svelte",
        "Solid",
        "Angular",
        "Ember",
        "Preact",
        "Lit",
        "Alpine",
      ],
    },
  },
  {
    label: "tags with long label truncated",
    props: {
      tags: ["TypeScript", "Internationalization Configuration", "Go", "Rust"],
    },
  },
];

const statsBarCases: {
  label: string;
  props: Omit<StatsBarProps, "width" | "height">;
}[] = [
  {
    label: "3 stats mixed positive and negative",
    props: {
      stats: [
        { label: "Revenue", value: "$12.4k", change: "+12%", positive: true },
        { label: "Users", value: "1,234", change: "-3%", positive: false },
        { label: "Orders", value: "856", change: "+8%", positive: true },
      ],
    },
  },
  {
    label: "4 stats all positive",
    props: {
      stats: [
        { label: "MRR", value: "$8.2k", change: "+5%", positive: true },
        { label: "DAU", value: "942", change: "+18%", positive: true },
        { label: "NPS", value: "72", change: "+4", positive: true },
        { label: "CSAT", value: "94%", change: "+2%", positive: true },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Smoke checks against satori, a loose reference: they catch a card that
// breaks outright, not a regression in its text. Where canvas and satori
// differ, Chrome is authoritative, and the tests that pin Chrome's numbers
// are what catch regressions in layout and text. Mutation experiments showed
// that these can't catch small content changes: canvas and satori already
// differ by 0.25–1.5% here, so most cards stay under their thresholds with a
// word or a chip dropped, and all but MetricsDashboard and BannerStrip with
// any one letter or digit changed. Some changes even bring canvas closer to
// satori.
//
// Each threshold is about 1.5 times what's measured (logged as
// "[comparison]"; macOS arm64 and CI's ubuntu x64 agree within 0.02%). The
// cards set `lineHeight: 1`: satori's `normal` line height leaves out the
// font's line gap, which canvas includes, as Chrome does (#180), and line
// boxes a whole number of pixels tall are placed alike by both.
describe("visual comparison: cards (satori smoke checks)", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it.each(propertyCases)(
    "renders PropertyCard — $label",
    async ({ label, props, maxDiff }) => {
      const element = <PropertyCard width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `property-${label}`,
      );

      // A known difference from Chrome (effing#179) that this can't see:
      // canvas and satori both align the header's baselines by the bottoms
      // of its text boxes (Yoga has no text baselines), where Chrome aligns
      // the text's baselines. With `lineHeight: 1`, Chrome makes the header
      // 24px tall with the badge 9px down; canvas makes it 28px with the
      // badge 11px down.
      expect(percentage).toBeLessThan(maxDiff);
    },
  );

  it("renders StatusBadge — large badge without letter-spacing", async () => {
    const element = (
      <StatusBadge width={WIDTH} height={HEIGHT} label="SOLD" color="#DC2626" />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "status-badge",
    );

    // 0.022% measured.
    expect(percentage).toBeLessThan(0.05);
  });

  it.each(pricingCases)(
    "renders PricingCard — $label",
    async ({ label, props, maxDiff }) => {
      const element = <PricingCard width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `pricing-${label}`,
      );

      expect(percentage).toBeLessThan(maxDiff);
    },
  );

  it.each(tagCloudCases)(
    "renders TagCloud — $label",
    async ({ label, props }) => {
      const element = <TagCloud width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `tags-${label}`,
      );

      // 0.70% and 0.67% measured.
      expect(percentage).toBeLessThan(1.1);
    },
  );

  it.each(statsBarCases)(
    "renders StatsBar — $label",
    async ({ label, props }) => {
      const element = <StatsBar width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `stats-${label}`,
      );

      // 0.40% and 0.35% measured.
      expect(percentage).toBeLessThan(0.6);
    },
  );

  it("renders ListingOverlayCard — absolute positioning with gradients and filter", async () => {
    const element = <ListingOverlayCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "listing-overlay-card",
    );

    // 0.55% measured.
    expect(percentage).toBeLessThan(0.85);
  });

  it("renders GradientHeroCard — angled gradients with flexBasis and transforms", async () => {
    const element = <GradientHeroCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "gradient-hero-card",
    );

    // 0.46% measured.
    expect(percentage).toBeLessThan(0.7);
  });

  it("renders JobPostCard — wordBreak, boxShadow, tight lineHeight", async () => {
    const element = <JobPostCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "job-post-card",
    );

    // 0.66% measured: at its tight line heights, the baselines are Chrome's
    // half-leading, up to about 0.5px above Satori's.
    expect(percentage).toBeLessThan(0.9);
  });

  it("renders MetricsDashboard — negative margins, maxWidth, pre-wrap, underline", async () => {
    const element = <MetricsDashboard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "metrics-dashboard",
    );

    // 0.25% measured.
    expect(percentage).toBeLessThan(0.4);
  });

  it("renders BannerStrip — rotation, gradient with transparent, asymmetric radii", async () => {
    const element = <BannerStrip width={400} height={120} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, 400, 120, fonts),
      renderWithSatori(element, 400, 120, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "banner-strip",
    );

    // 0.24% measured.
    expect(percentage).toBeLessThan(0.4);
  });
});
