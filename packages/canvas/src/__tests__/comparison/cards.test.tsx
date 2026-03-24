import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../../types.ts";
import {
  HAS_NATIVE_DEPS,
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
    maxDiff: 2.5,
  },
  {
    label: "plain Starter plan without yearly",
    props: {
      planName: "Starter",
      monthlyPrice: 9,
      features: ["5 projects", "Community support", "Basic analytics"],
      highlighted: false,
    },
    maxDiff: 1.3,
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

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: cards", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    const result = await loadFonts();
    fonts = result.fonts;
  }, 30_000);

  it.each(propertyCases)(
    "renders PropertyCard — $label",
    async ({ label, props }) => {
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

      expect(percentage).toBeLessThan(2.5);
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

    expect(percentage).toBeLessThan(1);
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

      const threshold = maxDiff;
      expect(percentage).toBeLessThan(threshold);
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

      expect(percentage).toBeLessThan(1);
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

      expect(percentage).toBeLessThan(1);
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

    expect(percentage).toBeLessThan(1);
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

    expect(percentage).toBeLessThan(1);
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

    expect(percentage).toBeLessThan(0.85);
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

    expect(percentage).toBeLessThan(2.5);
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

    expect(percentage).toBeLessThan(1);
  });
});
