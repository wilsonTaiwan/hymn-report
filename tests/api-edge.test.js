const assert = require("node:assert/strict");
const test = require("node:test");
const { lyrics, outline, makeReport, startMockClaude, startApp, close } = require("./support/fixtures");

process.env.ANTHROPIC_API_KEY = "test-key";
process.env.RATE_LIMIT_MAX = "1000";

const input = { title: "生命诗歌 200 首", lyrics: lyrics.join("\n\n") };
let mock;
let current = () => ({ text: JSON.stringify(outline) });
let server;

test.before(async () => {
  mock = await startMockClaude((n) => current(n));
  process.env.ANTHROPIC_API_URL = mock.url;
  server = await startApp(require("../server").app);
});
test.after(async () => {
  await Promise.all([close(server.web), close(mock)]);
});
test.beforeEach(() => {
  current = () => ({ text: JSON.stringify(outline) });
});

test("serves the page and a favicon", async () => {
  assert.equal((await fetch(server.baseUrl)).status, 200);
  assert.equal((await fetch(`${server.baseUrl}/favicon.svg`)).status, 200);
});

test("/api/outline rejects invalid input with 400", async () => {
  const callsBefore = mock.calls;
  const cases = {
    "empty title": { ...input, title: "" },
    "missing lyrics": { title: "t" },
    "whitespace lyrics": { title: "t", lyrics: "  \n\n " },
    "non-string title": { title: 5, lyrics: input.lyrics },
    "21 stanzas": { title: "t", lyrics: Array(21).fill("甲").join("\n\n") },
    "lyrics too long": { title: "t", lyrics: "甲".repeat(30001) },
    "array body": [1],
  };
  for (const [name, body] of Object.entries(cases)) {
    assert.equal((await server.post("/api/outline", body)).status, 400, name);
  }
  assert.equal(mock.calls, callsBefore, "invalid input must not reach Claude");
});

test("malformed or oversized JSON bodies are rejected", async () => {
  assert.equal((await server.post("/api/outline", "{bad")).status, 400);
  assert.equal((await server.post("/api/outline", { title: "t", lyrics: "a".repeat(260000) })).status, 413);
});

test("/api/outline handles bad upstream replies without crashing", async () => {
  current = () => ({ text: "not json" });
  assert.equal((await server.post("/api/outline", input)).status, 500);
  current = () => ({ status: 500 });
  assert.equal((await server.post("/api/outline", input)).status, 500);
  current = () => ({ status: 401 });
  assert.equal((await server.post("/api/outline", input)).status, 502);
  current = () => ({ status: 429 });
  assert.equal((await server.post("/api/outline", input)).status, 429);
});

test("/api/outline accepts JSON wrapped in a code fence", async () => {
  current = () => ({ text: "```json\n" + JSON.stringify(outline) + "\n```" });
  const response = await server.post("/api/outline", input);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).outline, outline);
});

test("/api/outline rejects outlines that do not match the lyrics", async () => {
  const wrongCount = structuredClone(outline);
  wrongCount.stanzas.pop();
  current = () => ({ text: JSON.stringify(wrongCount) });
  assert.equal((await server.post("/api/outline", input)).status, 400);

  const oneSplit = structuredClone(outline);
  oneSplit.stanzas[0].phrases = ["我仰望十字架"];
  current = () => ({ text: JSON.stringify(oneSplit) });
  assert.equal((await server.post("/api/outline", input)).status, 400);

  const fiveSplit = structuredClone(outline);
  fiveSplit.stanzas[0].phrases = ["我", "仰", "望", "十", "字"];
  current = () => ({ text: JSON.stringify(fiveSplit) });
  assert.equal((await server.post("/api/outline", input)).status, 400);

  const crossStanza = structuredClone(outline);
  crossStanza.stanzas[0].phrases[0] = "我背负十字架";
  current = () => ({ text: JSON.stringify(crossStanza) });
  assert.equal((await server.post("/api/outline", input)).status, 400);
});

test("/api/generate requires both confirmations", async () => {
  const callsBefore = mock.calls;
  const base = { ...input, outline };
  for (const gates of [{}, { gate1Confirmed: true }, { gate2Confirmed: true }, { gate1Confirmed: "true", gate2Confirmed: true }]) {
    assert.equal((await server.post("/api/generate", { ...base, ...gates })).status, 400, JSON.stringify(gates));
  }
  assert.equal(mock.calls, callsBefore);
});

test("/api/generate enforces the approved outline and report rules", async () => {
  const request = { ...input, outline, gate1Confirmed: true, gate2Confirmed: true };
  const run = async (mutate) => {
    const report = makeReport();
    mutate(report);
    current = () => ({ text: JSON.stringify(report) });
    return (await server.post("/api/generate", request)).status;
  };
  assert.equal(await run(() => {}), 200);
  assert.equal(await run((r) => { r.stanzas[0].title = "改动的主题"; }), 400, "title changed");
  assert.equal(await run((r) => { r.stanzas[0].phrases[0].phrase = "改动"; }), 400, "phrase changed");
  assert.equal(await run((r) => { r.stanzas.pop(); }), 400, "missing stanza");
  assert.equal(await run((r) => { r.stanzas[0].revelation.pop(); }), 400, "need 3 revelations");
  assert.equal(await run((r) => { r.stanzas[0].revelation[0].source = "T. A. Sparks《某书》"; }), 400, "fabricated source");
  assert.equal(await run((r) => { r.stanzas[0].group.questions.pop(); }), 400, "need 2 questions");
  assert.equal(await run((r) => { r.summary_table.headers[1] = "别人"; }), 400, "wrong author columns");
  assert.equal(await run((r) => { r.summary_table.rows.pop(); }), 400, "summary rows");
  assert.equal(await run((r) => { r.closing_prayer = []; }), 400, "empty closing prayer");
});

test("/api/generate overrides lyrics returned by the model with the confirmed text", async () => {
  const report = makeReport();
  report.lyrics[0].text = "模型擅自改写的歌词";
  current = () => ({ text: JSON.stringify(report) });
  const response = await server.post("/api/generate", { ...input, outline, gate1Confirmed: true, gate2Confirmed: true });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).report.lyrics[0].text, lyrics[0]);
});

test("/api/download validates input and tolerates unusual titles", async () => {
  assert.equal((await server.post("/api/download", {})).status, 400);
  assert.equal((await server.post("/api/download", { report: { title_zh: "x", lyrics: [], stanzas: [] } })).status, 400);
  for (const title of ['a/b:"c"?', "<script>alert(1)</script>", "x".repeat(150)]) {
    const response = await server.post("/api/download", { report: { ...makeReport(), title_zh: title } });
    assert.equal(response.status, 200, title);
    assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString("ascii"), "PK");
    assert.match(response.headers.get("content-disposition"), /^attachment; filename\*=UTF-8''[^\s/\\"]+\.docx$/);
  }
});
