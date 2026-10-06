const http = require("node:http");
const { once } = require("node:events");

const lyrics = ["我仰望十字架，主爱永长存。", "我背负十字架，跟随主脚踪。"];
const outline = {
  title_zh: "仰望十字架",
  title_en: "",
  hymnal: "生命诗歌 200 首",
  author_line: "作者不详，资料待核",
  stanzas: [
    { no: "第一节", title: "仰望", phrases: ["我仰望十字架", "主爱永长存。"] },
    { no: "第二节", title: "跟随", phrases: ["我背负十字架", "跟随主脚踪。"] },
  ],
};

function makeReport() {
  return {
    title_zh: "仰望十字架",
    title_en: "",
    hymnal: "生命诗歌 200 首",
    author_line: "作者不详，资料待核",
    lyrics: lyrics.map((text, index) => ({ no: String(index + 1), text })),
    author_bio: ["作者资料待核。"],
    author_works: "资料待核",
    background: ["创作背景资料待核。"],
    music: {
      intro: "从仰望到跟随。",
      guidance: outline.stanzas.map((s) => ({ stanza: s.no, text: "安静敬拜。" })),
    },
    structure_table: outline.stanzas.map((s) => ({ stanza: s.no, experience: s.title, verses: "来 12:2" })),
    stanzas: outline.stanzas.map((s) => ({
      no: s.no,
      title: s.title,
      phrases: s.phrases.map((phrase) => ({ phrase, explanation: "解释", verses: "来 12:2；罗 5:8" })),
      revelation: ["甲", "乙", "丙"].map((text) => ({ text, source: "精神归纳自相关属灵信息" })),
      group: {
        questions: [{ q: "问题一？", hint: "提示" }, { q: "问题二？", hint: "提示" }],
        practice: "每日默想。",
        prayer: "求主带领。阿们。",
      },
    })),
    summary_table: {
      headers: ["诗歌主题", "T. A. Sparks", "倪柝声", "李常受"],
      rows: outline.stanzas.map((s) => [s.title, "观点一", "观点二", "观点三"]),
    },
    closing_prayer: ["求主带领我们。阿们。"],
  };
}

// Mock Anthropic endpoint. `behavior` decides each reply; it receives the 1-based call number.
async function startMockClaude(behavior) {
  const server = http.createServer(async (request, response) => {
    for await (const _chunk of request);
    server.calls += 1;
    const reply = await behavior(server.calls);
    if (reply.status) {
      response.writeHead(reply.status);
      return response.end("upstream error");
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ content: [{ type: "text", text: reply.text }] }));
  });
  server.calls = 0;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  server.url = `http://127.0.0.1:${server.address().port}`;
  return server;
}

async function startApp(app) {
  const web = app.listen(0, "127.0.0.1");
  await once(web, "listening");
  const baseUrl = `http://127.0.0.1:${web.address().port}`;
  const post = (route, body) => fetch(baseUrl + route, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { web, baseUrl, post };
}

const close = (server) => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));

module.exports = { lyrics, outline, makeReport, startMockClaude, startApp, close };
