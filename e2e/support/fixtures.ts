import { test as base, expect, type Page, type Response } from "@playwright/test";

// one goto per test: Cloudflare challenges a headless context after 2-3 navigations
export const SELECTORS = {
  todaySection: '[data-test="homepage-section-today"]',
  productCard: 'section:has([data-test="vote-button"])',
  productLink: 'a[href^="/products/"]',
  voteButton: '[data-test="vote-button"]',
  headerSignIn: '[data-test="header-nav-link-sign-in"]',
  headerSearch: '[data-test="header-search-input"]',
  searchResult: '[data-test^="spotlight-result-product-"]',
  visitWebsite: '[data-test="visit-website-button"]',
  productNav: '[data-test^="product-navigation-item-"]',
} as const;

export class Feed {
  constructor(private readonly page: Page) {}
  get seeAllToday() {
    return this.today.getByRole("button", { name: /see all of today/i });
  }
  get today() {
    return this.page.locator(SELECTORS.todaySection);
  }
  // direct children only, ad cards are <article> wrappers
  get todayCards() {
    return this.today.locator(`:scope > ${SELECTORS.productCard}`);
  }
  async waitForToday() {
    await expect(this.today).toBeVisible();
    await expect(this.todayCards.first()).toBeVisible();
  }
  static async productSlugs(scope: ReturnType<Page["locator"]>) {
    const hrefs = await scope.locator(SELECTORS.productLink).evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? "")
    );
    return hrefs.map((h) => h.split("?")[0]).filter((h) => /^\/products\/[^/]+$/.test(h));
  }
}

type Fixtures = {
  gotoOnce: (path: string) => Promise<Response>;
  feed: Feed;
};

export const test = base.extend<Fixtures>({
  gotoOnce: async ({ page }, use) => {
    let used = false;
    await use(async (path: string) => {
      if (used) {
        throw new Error(
          "gotoOnce called twice in one test - Cloudflare will challenge a second navigation. Navigate client-side instead."
        );
      }
      used = true;
      // clicks before hydration get dropped, so wait for load
      const response = await page.goto(path, { waitUntil: "load" });
      if (!response) throw new Error(`No response for ${path}`);
      if (response.status() === 403 || page.url().includes("__cf_chl")) {
        throw new Error(
          `Cloudflare challenge on ${path} (HTTP ${response.status()}). Infra block, not a product bug. See findings S7.`
        );
      }
      return response;
    });
  },
  feed: async ({ page }, use) => {
    await use(new Feed(page));
  },
});

export { expect };
