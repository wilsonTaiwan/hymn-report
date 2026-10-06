#!/usr/bin/env node
/**
 * build_docx.js — 生命詩歌屬靈意涵文件 DOCX 產生器
 *
 * 用法: node build_docx.js content.json output.docx
 * 內容結構見 ../references/content-schema.md
 * 版面權杖見 ../references/design-tokens.md
 */

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType,
} = require("docx");

// ---------- 設計權杖 ----------
const C = {
  pageBg:    "FCFBF9",
  navy:      "1A365D",
  navyBar:   "274C76",
  banner:    "1D3A62",
  bannerSub: "AFC2D8",
  bannerDim: "8FA6C0",
  crimson:   "9B1B1B",
  stanza:    "A02020",
  card:      "FFFFFF",
  cardEdge:  "E4E0D9",
  verseBg:   "F1F3F6",
  verseBar:  "B9C7DA",
  verseTxt:  "444A52",
  revBg:     "FFF0F1",
  revEdge:   "F0D6DA",
  revBar:    "AA183F",
  grpBg:     "F0FDF4",
  grpEdge:   "D6E8DC",
  grpTitle:  "2E6B45",
  prayBg:    "FFFCE8",
  prayEdge:  "EADFA8",
  prayTitle: "8A6D1F",
  tblAlt:    "F4F8FB",
  tblEdge:   "E2E6EB",
  body:      "23272B",
};

const FONT = "Microsoft JhengHei";
const MARGIN = 900;
const PAGE_W = 11906 - MARGIN * 2;

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("用法: node build_docx.js content.json output.docx");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(args[0], "utf8"));

const L = Object.assign({
  lyrics: "一、詩歌歌詞",
  author: "二、作者簡介",
  works: "代表作：",
  background: "三、創作背景",
  music: "四、詩歌簡述與樂感表達指導",
  musicIntro: "屬靈進程：",
  musicGuidance: "逐節樂感表達指導：",
  structureH: "五、詩節結構與屬靈經歷對照表",
  unitCol: "詩節",
  experienceCol: "屬靈經歷",
  versesCol: "核心經文",
  exegesisH: "六、逐節屬靈解經與應用",
  truth: "真理根基：",
  life: "生活實踐：",
  explanation: "屬靈解經：",
  revelationH: "七、啟示的話",
  groupH: "八、小組追求模組",
  questions: "討論題目",
  answer: "參考答案：",
  practice: "本週應用操練",
  practiceItem: "操練項目：",
  practiceSteps: "落實步驟：",
  prayer: "第一人稱禱告",
  summary: "九、屬靈著述家觀點對照總結表",
  closingPrayer: "十、總結回應禱告",
  mood: "情緒標籤：",
  tempo: "速度：",
  dynamics: "力度：",
  musicDetail: "樂感細節：",
}, data.labels || {});

// ---------- 基本元件 ----------
const run = (text, o = {}) => new TextRun({
  text, font: FONT,
  size: o.size ?? 20, bold: o.bold, italics: o.italics,
  color: o.color ?? C.body,
});

const P = (text, o = {}) => new Paragraph({
  alignment: o.align,
  spacing: { before: o.before ?? 50, after: o.after ?? 50, line: o.line ?? 300 },
  indent: o.indent,
  children: Array.isArray(text) ? text : [run(text, o)],
});

const Lab = (label, body, o = {}) => P([
  run(label, { bold: true, size: o.size ?? 20, color: C.navy }),
  run(body, { size: o.size ?? 20 }),
], o);

const spacer = (h = 100) => new Paragraph({
  spacing: { before: 0, after: h },
  children: [new TextRun({ text: "", size: 2 })],
});

const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};

// 章節標題：暗紅左側色條 ＋ 深藍粗體
const SectionH = (text) => new Paragraph({
  spacing: { before: 300, after: 150 },
  indent: { left: 160 },
  border: { left: { style: BorderStyle.SINGLE, size: 20, space: 10, color: C.crimson } },
  children: [run(text, { size: 26, bold: true, color: C.navy })],
});

// 詩節標題：暗紅粗體 ＋ 下方細線
const StanzaH = (text) => new Paragraph({
  spacing: { before: 300, after: 150 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 6, color: "DDD8D0" } },
  children: [run(text, { size: 24, bold: true, color: C.stanza })],
});

// 卡片：單格表格
function card(children, o = {}) {
  const edge = o.edge ?? C.cardEdge;
  const hair = (c) => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
    borders: {
      top: hair(edge), bottom: hair(edge), right: hair(edge),
      left: o.bar ? { style: BorderStyle.SINGLE, size: 22, color: o.bar } : hair(edge),
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: PAGE_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: o.fill ?? C.card, color: "auto" },
        margins: { top: 160, bottom: 160, left: 220, right: 220 },
        children,
      })],
    })],
  });
}

// 資料表：深藍表頭 ＋ 隔列淡底 ＋ 首欄粗體
function dataTable(headers, rows, weights) {
  const n = headers.length;
  rows.forEach((r, i) => {
    if (r.length !== n) throw new Error(`表格第 ${i + 1} 列有 ${r.length} 欄，應為 ${n} 欄`);
  });
  const w = weights ?? Array(n).fill(1);
  const total = w.reduce((a, b) => a + b, 0);
  const cw = w.map((x) => Math.floor((PAGE_W * x) / total));
  cw[n - 1] = PAGE_W - cw.slice(0, n - 1).reduce((a, b) => a + b, 0);

  const cell = (text, i, { head = false, alt = false, bold = false } = {}) => new TableCell({
    width: { size: cw[i], type: WidthType.DXA },
    shading: {
      type: ShadingType.CLEAR,
      fill: head ? C.navy : (alt ? C.tblAlt : "FFFFFF"),
      color: "auto",
    },
    margins: { top: 110, bottom: 110, left: 160, right: 160 },
    children: [new Paragraph({
      spacing: { before: 0, after: 0, line: 260 },
      children: [run(String(text), {
        size: 19, bold: head || bold, color: head ? "FFFFFF" : C.body,
      })],
    })],
  });

  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: cw,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: C.tblEdge },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: C.tblEdge },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: C.tblEdge },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, { head: true })) }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((c, i) => cell(c, i, { alt: ri % 2 === 1, bold: i === 0 })),
      })),
    ],
  });
}

// ---------- 組裝 ----------
const K = [];

// 1. 標題橫幅
K.push(new Table({
  width: { size: PAGE_W, type: WidthType.DXA },
  columnWidths: [PAGE_W],
  borders: noBorders,
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: PAGE_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: C.banner, color: "auto" },
      margins: { top: 460, bottom: 420, left: 300, right: 300 },
      children: [
        P([run(data.title_zh, { size: 34, bold: true, color: "FFFFFF" })],
          { align: AlignmentType.CENTER, before: 0, after: 90 }),
        ...(data.title_en ? [P([run(data.title_en, { size: 20, color: C.bannerSub })],
          { align: AlignmentType.CENTER, before: 0, after: 150 })] : []),
        ...(data.hymnal ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          border: { top: { style: BorderStyle.SINGLE, size: 3, space: 10, color: "3E5C88" } },
          children: [run(data.hymnal, { size: 17, color: C.bannerDim })],
        })] : []),
        ...(data.hymnal_refs ? [P([run(data.hymnal_refs, { size: 16, color: C.bannerDim })],
          { align: AlignmentType.CENTER, before: 60, after: 0 })] : []),
      ],
    })],
  })],
}));
K.push(spacer(140));

// 2. 歌詞（雙欄）
K.push(SectionH(L.lyrics));
const ly = data.lyrics || [];
const twoCol = ly.length >= 3;
const half = twoCol ? Math.ceil(ly.length / 2) : ly.length;
const colOf = (list) => {
  const out = [];
  list.forEach((st, i) => {
    String(st.text).split("\n").filter((l) => l.trim()).forEach((line, j) => {
      out.push(P(
        j === 0 && st.no
          ? [run(`${st.no}、`, { bold: true, size: 19, color: C.stanza }), run(line.trim(), { size: 19 })]
          : [run(line.trim(), { size: 19 })],
        { before: j === 0 && i > 0 ? 190 : 20, after: 20, line: 320 },
      ));
    });
  });
  return out.length ? out : [P("")];
};
const innerW = PAGE_W - 440;
const colW = Math.floor(innerW / 2);
K.push(card([
  new Table({
    width: { size: innerW, type: WidthType.DXA },
    columnWidths: [colW, innerW - colW],
    borders: noBorders,
    rows: [new TableRow({
      children: twoCol ? [
        new TableCell({ width: { size: colW, type: WidthType.DXA }, margins: { right: 220 }, children: colOf(ly.slice(0, half)) }),
        new TableCell({ width: { size: innerW - colW, type: WidthType.DXA }, margins: { left: 220 }, children: colOf(ly.slice(half)) }),
      ] : [
        new TableCell({ width: { size: innerW, type: WidthType.DXA }, columnSpan: 2, children: colOf(ly) }),
      ],
    })],
  }),
  spacer(0),
]));
K.push(spacer(140));

// 3-4. 作者簡介 ＋ 創作背景
if (data.author_bio && data.author_bio.length) {
  K.push(SectionH(data.author_line ? `${L.author}：${data.author_line}` : L.author));
  const inner = data.author_bio.map((p) => P(p));
  if (data.author_works) inner.push(Lab(L.works, data.author_works, { before: 150 }));
  K.push(card(inner));
  K.push(spacer(140));
}
if (data.background && data.background.length) {
  K.push(SectionH(L.background));
  K.push(card(data.background.map((p) => P(p))));
  K.push(spacer(140));
}

// 5. 詩歌簡述與樂感導引
if (data.music) {
  K.push(SectionH(L.music));
  const inner = [];
  if (data.music.intro) inner.push(Lab(L.musicIntro, data.music.intro));
  if (data.music.guidance && data.music.guidance.length) {
    inner.push(P([run(L.musicGuidance, { bold: true, color: C.navy })], { before: 190, after: 80 }));
    data.music.guidance.forEach((g) => {
      inner.push(P([run(`・${g.stanza}`, { bold: true, color: C.stanza })], { before: 120, after: 40 }));
      const sub = { indent: { left: 380 }, before: 20, after: 20 };
      if (g.mood) inner.push(Lab(L.mood, g.mood, sub));
      if (g.tempo) inner.push(Lab(L.tempo, g.tempo, sub));
      if (g.dynamics) inner.push(Lab(L.dynamics, g.dynamics, sub));
      if (g.text) inner.push(Lab(g.mood ? L.musicDetail : "", g.text, sub));
    });
  }
  K.push(card(inner));
  K.push(spacer(140));
}

// 6. 詩節結構對照表
if (data.structure_table && data.structure_table.length) {
  K.push(SectionH(L.structureH));
  K.push(dataTable(
    [L.unitCol, L.experienceCol, L.versesCol],
    data.structure_table.map((r) => [r.stanza, r.experience, r.verses]),
    [2, 4, 5],
  ));
  K.push(spacer(160));
}

const verseBox = (label, verse) => new Paragraph({
  spacing: { before: 90, after: 20, line: 280 },
  indent: { left: 140, right: 120 },
  shading: { type: ShadingType.CLEAR, fill: C.verseBg, color: "auto" },
  border: {
    left: { style: BorderStyle.SINGLE, size: 10, space: 8, color: C.verseBar },
    top: { style: BorderStyle.SINGLE, size: 2, space: 6, color: C.verseBg },
    bottom: { style: BorderStyle.SINGLE, size: 2, space: 6, color: C.verseBg },
    right: { style: BorderStyle.SINGLE, size: 2, space: 6, color: C.verseBg },
  },
  children: [
    run(label, { bold: true, size: 18, color: C.navy }),
    run(verse.text ? `「${verse.text}」（${verse.ref}）` : verse.ref, { size: 18, color: C.verseTxt }),
  ],
});

const stanzas = data.stanzas || [];
const stanzaLabel = (no) => String(no).replace(/^第/, "").replace(/[節节層层段]$/, "");

// 7. 逐節解經
if (stanzas.length) {
  K.push(SectionH(L.exegesisH));
  stanzas.forEach((st) => {
    K.push(StanzaH(`${st.no}：${st.title}`));
    (st.phrases || []).forEach((ph, i) => {
      const inner = [P([run(`${i + 1}.「${ph.phrase}」`, { bold: true, size: 21, color: C.navy })], { before: 0, after: 60 })];
      if (ph.truth) inner.push(verseBox(L.truth, ph.truth));
      if (ph.life) inner.push(verseBox(L.life, ph.life));
      if (ph.verses) inner.push(verseBox("對照經文：", { ref: ph.verses }));
      inner.push(Lab(L.explanation, ph.explanation, { before: 130 }));
      K.push(card(inner, { bar: C.navyBar }));
      K.push(spacer(110));
    });
  });
}

// 8. 啟示的話
if (stanzas.some((st) => st.revelation && st.revelation.length)) {
  K.push(SectionH(L.revelationH));
  stanzas.forEach((st) => {
    if (!st.revelation || !st.revelation.length) return;
    const inner = [P([run(st.no, { bold: true, size: 20, color: C.stanza })], { before: 0, after: 90 })];
    st.revelation.forEach((r) => inner.push(P(
      [run("・", { color: C.revBar }),
       run(r.source ? `${r.text}（${r.source}）` : r.text, { size: 18, color: "3F4348" })],
      { before: 40, after: 40, line: 290, indent: { left: 200, hanging: 200 } },
    )));
    K.push(card(inner, { fill: C.revBg, edge: C.revEdge, bar: C.revBar }));
    K.push(spacer(110));
  });
}

// 9. 小組追求
if (stanzas.some((st) => st.group)) {
  K.push(SectionH(L.groupH));
  stanzas.forEach((st) => {
    if (!st.group) return;
    const inner = [P([run(`【第${stanzaLabel(st.no)}節小組追求】`, { bold: true, size: 22, color: C.grpTitle })],
      { before: 0, after: 130 })];
    const g = st.group;
    if (g.questions && g.questions.length) {
      inner.push(P([run(L.questions, { bold: true, color: C.navy })], { after: 60 }));
      g.questions.forEach((q, i) => {
        inner.push(P(`${i + 1}. ${q.q}`, { indent: { left: 460, hanging: 240 }, before: 60, after: 30 }));
        const answer = q.answer || q.hint;
        if (answer) inner.push(Lab(L.answer, answer, { indent: { left: 460 }, before: 0, after: 60, size: 19 }));
      });
    }
    if (g.practice) {
      inner.push(P([run(L.practice, { bold: true, color: C.navy })], { before: 150, after: 60 }));
      if (typeof g.practice === "string") {
        inner.push(P(g.practice, { indent: { left: 240 } }));
      } else {
        inner.push(Lab(L.practiceItem, g.practice.item, { indent: { left: 240 } }));
        inner.push(Lab(L.practiceSteps, g.practice.steps, { indent: { left: 240 } }));
      }
    }
    if (g.prayer) {
      inner.push(P([run(L.prayer, { bold: true, color: C.navy })], { before: 150, after: 60 }));
      inner.push(P(g.prayer, { indent: { left: 240 } }));
    }
    K.push(card(inner, { fill: C.grpBg, edge: C.grpEdge }));
    K.push(spacer(190));
  });
}

// 10. 對照總結表
if (data.summary_table && data.summary_table.rows && data.summary_table.rows.length) {
  K.push(SectionH(L.summary));
  K.push(dataTable(data.summary_table.headers, data.summary_table.rows, [3, 3, 3, 3]));
  K.push(spacer(190));
}

// 11. 總結回應禱告
if (data.closing_prayer && data.closing_prayer.length) {
  K.push(SectionH(L.closingPrayer));
  K.push(card(data.closing_prayer.map((p) => P(p, { line: 320 })), { fill: C.prayBg, edge: C.prayEdge }));
}

const doc = new Document({
  creator: "hymn-spiritual-commentary",
  title: data.title_zh,
  background: { color: C.pageBg },
  styles: { default: { document: { run: { font: FONT, size: 20, color: C.body } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: MARGIN, right: MARGIN } } },
    children: K,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(args[1], buf);
  console.log(`已輸出：${args[1]}（${(buf.length / 1024).toFixed(1)} KB）`);
}).catch((e) => {
  console.error("產生失敗：", e.message);
  process.exit(1);
});
