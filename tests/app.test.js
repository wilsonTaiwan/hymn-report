const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const test = require("node:test");

const lyrics = "我仰望十字架，主爱永长存。";
const outline = {
  title_zh: "仰望十字架",
  title_en: "",
  hymnal: "生命诗歌 200 首",
  author_line: "作者不详，资料待核",
  stanzas: [{
    no: "第一节",
    title: "仰望并领受救恩",
    phrases: ["我仰望十字架", "主爱永长存。"],
  }],
};

function makeReport() {
  return {
    title_zh: "仰望十字架",
    title_en: "",
    hymnal: "生命诗歌 200 首",
    author_line: "作者不详，资料待核",
    lyrics: [{ no: "一", text: lyrics }],
    author_bio: ["作者资料待核；请使用前核实诗集与可靠来源。"],
    author_works: "资料待核",
    background: ["创作背景资料待核。"],
    music: {
      intro: "本诗引导读者仰望十字架，并思想主的爱。",
      guidance: [{ stanza: "第一节", text: "以安静敬拜的情绪唱诵。" }],
    },
    structure_table: [{
      stanza: "第一节",
      experience: "仰望并领受救恩",
      verses: "来 12:2；罗 5:8",
    }],
    stanzas: [{
      no: "第一节",
      title: "仰望并领受救恩",
      phrases: [
        { phrase: "我仰望十字架", explanation: "思想诗句所指向的救恩。", verses: "来 12:2；罗 5:8" },
        { phrase: "主爱永长存。", explanation: "思想主爱的长久与信实。", verses: "约 3:16；罗 8:38-39" },
      ],
      revelation: [
        { text: "从救赎真理认识主的工作。", source: "精神歸納自相關屬靈信息" },
        { text: "从日常经历学习信靠主。", source: "精神歸納自相關屬靈信息" },
        { text: "让福音成为生活见证。", source: "精神歸納自相關屬靈信息" },
      ],
      group: {
        questions: [
          { q: "这节诗歌指向什么？", hint: "留意诗句中的十字架意象。" },
          { q: "如何在生活中回应？", hint: "分享一个具体可行的行动。" },
        ],
        practice: "本周每日默想一处相关经文。",
        prayer: "求主帮助我们真实经历你的爱。阿们。",
      },
    }],
    summary_table: {
      headers: ["詩歌主題", "T. A. Sparks", "倪柝聲", "李常受"],
      rows: [["仰望十字架", "思想救赎", "经历恩典", "活出新生"]],
    },
    closing_prayer: ["求主带领我们遵行所领受的亮光。阿们。"],
  };
}

test("generates an approved outline, complete report, and downloadable DOCX", async () => {
  const report = makeReport();
  let completionCount = 0;
  const mockClaude = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(payload.model, "claude-sonnet-5-5");
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

    const input = { title: "生命诗歌 200 首", lyrics };
    const outlineResponse = await fetch(`${baseUrl}/api/outline`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(outlineResponse.status, 200);
    const returnedOutline = (await outlineResponse.json()).outline;
    assert.equal(returnedOutline.author_line, "作者不詳，資料待核");
    assert.equal(returnedOutline.stanzas[0].title, "仰望並領受救恩");
    assert.deepEqual(returnedOutline.stanzas[0].phrases, outline.stanzas[0].phrases);

    const unconfirmed = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, outline, gate1Confirmed: true, gate2Confirmed: false }),
    });
    assert.equal(unconfirmed.status, 400);

    const alteredOutline = structuredClone(outline);
    alteredOutline.stanzas[0].phrases[0] = "没有出现在歌词里的句子";
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
    assert.deepEqual(result.report.lyrics, [{ no: "一", text: lyrics }]);
    assert.equal(result.report.author_bio[0], "作者資料待核；請使用前核實詩集與可靠來源。");
    assert.equal(result.report.stanzas[0].phrases[1].phrase, "主爱永长存。");
    assert.equal(result.report.stanzas[0].phrases[1].explanation, "思想主愛的長久與信實。");
    assert.equal(result.report.labels.closingPrayer, "總結回應禱告");

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
