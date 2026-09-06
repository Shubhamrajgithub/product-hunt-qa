import { test, expect } from "../support/fixtures";

test.describe("Unknown product URL", () => {
  test("returns HTTP 404 with a recovery path back to the homepage", async ({ page, gotoOnce }) => {
    const response = await gotoOnce("/products/this-product-does-not-exist-qa-98765");
    expect(response.status()).toBe(404);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/lost this page/i);
    const home = page.getByRole("link", { name: /go to the homepage/i });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", /^\/(\?.*)?$/);
  });
});
