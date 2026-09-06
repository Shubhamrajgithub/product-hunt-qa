const id = process.env.PH_CLIENT_ID;
const secret = process.env.PH_CLIENT_SECRET;
if (!id || !secret) {
  console.error("PH_CLIENT_ID and PH_CLIENT_SECRET must be set in .env");
  process.exit(1);
}

const res = await fetch("https://api.producthunt.com/v2/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
});
const body = (await res.json()) as { access_token?: string; token_type?: string; scope?: string; error?: string };
if (!res.ok || !body.access_token) {
  console.error(`Token request failed (HTTP ${res.status}):`, body);
  process.exit(1);
}

const envPath = new URL("../.env", import.meta.url);
const current = (await Bun.file(envPath).text().catch(() => "")).split("\n").filter((l) => !l.startsWith("PH_ACCESS_TOKEN="));
current.push(`PH_ACCESS_TOKEN=${body.access_token}`);
await Bun.write(envPath, current.filter((l, i, a) => l !== "" || i !== a.length - 1).join("\n") + "\n");
console.log(`OK: ${body.token_type ?? "bearer"} token (scope: ${body.scope ?? "public"}) written to .env`);
