const assert = require("node:assert/strict");
const test = require("node:test");
const { startApp, close } = require("./support/fixtures");

process.env.RATE_LIMIT_MAX = "3";

test("API requests beyond the per-minute limit get 429 with Retry-After", async () => {
  const server = await startApp(require("../server").app);
  try {
    const statuses = [];
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await server.post("/api/outline", { title: "", lyrics: "" });
      statuses.push(last.status);
    }
    assert.deepEqual(statuses, [400, 400, 400, 429, 429]);
    assert.ok(Number(last.headers.get("retry-after")) > 0);
    assert.equal((await fetch(server.baseUrl)).status, 200, "static pages are not rate limited");
  } finally {
    await close(server.web);
  }
});
