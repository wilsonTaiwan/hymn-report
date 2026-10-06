const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const test = require("node:test");

const { lyrics: stanzaLyrics, outline, makeReport } = require("./support/fixtures");

const lyrics = stanzaLyrics.join("\n\n");

test("generates an approved outline, complete report, and downloadable DOCX", async () => {
  const report = makeReport();
  let completionCount = 0;
  const mockClaude = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(payload.model, "claude-sonnet-4-20250514");
    completionCount += 1;
    const result = completionCount === 1 ? outline : report;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(result) }] }));
  });
  mockClaude.listen(0, "127.0.0.1");
  await once(mockClaude, "listening");
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_API_URL = `http://127.0.0.1:${mockClaude.address().port}`;
  const { app } = require("../server");
  const web = app.listen(0, "127.0.0.1");
  await once(web, "listening");
  const baseUrl = `http://127.0.0.1:${web.address().port}`;

  try {
    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /hymn-lyrics/);

    const input = { title: "生命詩歌 200 首", lyrics };
    const outlineResponse = await fetch(`${baseUrl}/api/outline`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(outlineResponse.status, 200);
    assert.deepEqual((await outlineResponse.json()).outline, outline);

    const unconfirmed = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, outline, gate1Confirmed: true, gate2Confirmed: false }),
    });
    assert.equal(unconfirmed.status, 400);

    const alteredOutline = structuredClone(outline);
    alteredOutline.stanzas[0].phrases[0] = "沒有出現在歌詞裡的句子";
    const invalidOutline = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, outline: alteredOutline, gate1Confirmed: true, gate2Confirmed: true }),
    });
    assert.equal(invalidOutline.status, 400);

    const generated = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, outline, gate1Confirmed: true, gate2Confirmed: true }),
    });
    assert.equal(generated.status, 200);
    const result = await generated.json();
    assert.deepEqual(result.report.lyrics, stanzaLyrics.map((text, index) => ({ no: ["一", "二"][index], text })));
    assert.equal(result.report.stanzas[0].revelation[0].author, "史百克 T. A. Sparks");

    const download = await fetch(`${baseUrl}/api/download`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report: result.report }),
    });
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type"), /wordprocessingml\.document/);
    const word = Buffer.from(await download.arrayBuffer());
    assert.equal(word.subarray(0, 2).toString("ascii"), "PK");
    assert.ok(word.length > 1000);
  } finally {
    await Promise.all([
      new Promise((resolve, reject) => web.close((error) => error ? reject(error) : resolve())),
      new Promise((resolve, reject) => mockClaude.close((error) => error ? reject(error) : resolve())),
    ]);
  }
});
