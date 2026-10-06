const http = require("node:http");
const { once } = require("node:events");

const lyrics = ["我仰望十字架，主愛永長存。", "我揹負十字架，跟隨主腳蹤。"];
const outline = {
  title_zh: "仰望十字架",
  title_en: "",
  hymnal: "生命詩歌 200 首",
  author_line: "作者不詳，資料待核",
  stanzas: [
    { no: "第一節", title: "仰望", phrases: ["我仰望十字架", "主愛永長存。"] },
    { no: "第二節", title: "跟隨", phrases: ["我揹負十字架", "跟隨主腳蹤。"] },
  ],
};

function makeReport() {
  return {
    title_zh: "仰望十字架",
    title_en: "",
    hymnal: "生命詩歌 200 首",
    author_line: "作者不詳，資料待核",
    lyrics: lyrics.map((text, index) => ({ no: String(index + 1), text })),
    author_bio: ["作者資料待核。"],
    author_works: "資料待核",
    background: ["創作背景資料待核。"],
    music: {
      intro: "從仰望到跟隨。",
      progress: outline.stanzas.map((s) => ({ stanza: s.no, stage: "階段", text: "進程說明。" })),
      guidance: outline.stanzas.map((s) => ({
        stanza: s.no,
        mood: "溫柔呼喚",
        tempo: "中速（♩ = 72），柔和（p）。",
        detail: "安靜敬拜。",
      })),
    },
    structure_table: outline.stanzas.map((s) => ({ stanza: s.no, experience: s.title, verses: "來 12:2" })),
    stanzas: outline.stanzas.map((s) => ({
      no: s.no,
      title: s.title,
      phrases: s.phrases.map((phrase) => ({
        phrase,
        foundation: { ref: "希伯來書 12:2", text: "" },
        application: { ref: "羅馬書 5:8", text: "" },
        explanation: "解經。",
      })),
      revelation: ["甲", "乙", "丙"].map((text, i) => ({
        text,
        source: `精神歸納自${["史百克", "倪柝聲", "李常受"][i]}的相關信息`,
      })),
      group: {
        questions: [{ q: "問題一？", answer: "答案一。" }, { q: "問題二？", answer: "答案二。" }],
        practice: { item: "每日默想", steps: "每天五分鐘。" },
        prayer: "主耶穌，求你帶領我。奉主耶穌基督的名，阿們。",
      },
    })),
    summary_table: {
      headers: ["詩歌主題", "T. A. Sparks（客觀真理）", "倪柝聲（主觀經歷）", "李常受（生命解讀）"],
      rows: outline.stanzas.map((s) => [s.title, "觀點一", "觀點二", "觀點三"]),
    },
    closing_prayer: ["求主帶領我們。阿們。"],
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
