const form = document.querySelector("#hymn-form");
const titleInput = document.querySelector("#hymn-title");
const lyricsInput = document.querySelector("#hymn-lyrics");
const outlineButton = document.querySelector("#outline-button");
const reviewSection = document.querySelector("#review-section");
const reportSection = document.querySelector("#report-section");
const lyricsReview = document.querySelector("#lyrics-review");
const outlineReview = document.querySelector("#outline-review");
const confirmLyrics = document.querySelector("#confirm-lyrics");
const confirmOutline = document.querySelector("#confirm-outline");
const confirmOutlineRow = document.querySelector("#confirm-outline-row");
const generateButton = document.querySelector("#generate-button");
const downloadButton = document.querySelector("#download-button");
const loadingOverlay = document.querySelector("#loading-overlay");
const formError = document.querySelector("#form-error");
const reviewError = document.querySelector("#review-error");
const downloadError = document.querySelector("#download-error");

let activeOutline = null;
let activeLyrics = [];
let activeReport = null;
let approvedTitle = "";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setLoading(visible, title = "正在整理诗歌脉络", message = "这可能需要一点时间，请稍候。") {
  loadingOverlay.hidden = !visible;
  document.querySelector("#loading-title").textContent = title;
  document.querySelector("#loading-message").textContent = message;
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = !message;
}

async function requestJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `请求失败（${response.status}）。`);
  return result;
}

function renderLyrics(lyrics) {
  lyricsReview.replaceChildren();
  lyrics.forEach((text, index) => {
    const stanza = element("article", "lyrics-stanza");
    stanza.append(element("h4", "", `第 ${index + 1} 节`));
    stanza.append(element("p", "", text));
    lyricsReview.append(stanza);
  });
}

function renderOutline(outline) {
  outlineReview.replaceChildren();
  outline.stanzas.forEach((stanza, stanzaIndex) => {
    const card = element("article", "outline-stanza");
    const titleLabel = element("label", "outline-label", `${stanza.no} · 属灵阶梯主题`);
    const titleField = element("input", "outline-title");
    titleField.type = "text";
    titleField.maxLength = 120;
    titleField.value = stanza.title;
    titleField.setAttribute("aria-label", `${stanza.no} 的属灵阶梯主题`);
    titleField.addEventListener("input", () => {
      activeOutline.stanzas[stanzaIndex].title = titleField.value.trim();
      updateGenerateButton();
    });
    card.append(titleLabel, titleField);

    const phrasesLabel = element("div", "outline-label phrase-label", "原文片语（2–4 组，必须逐字摘自本节歌词）");
    card.append(phrasesLabel);
    const phraseList = element("div", "phrase-editor");
    const renderPhrases = () => {
      phraseList.replaceChildren();
      activeOutline.stanzas[stanzaIndex].phrases.forEach((phrase, phraseIndex) => {
        const row = element("div", "phrase-edit-row");
        const field = element("input", "outline-phrase");
        field.type = "text";
        field.maxLength = 500;
        field.value = phrase;
        field.setAttribute("aria-label", `${stanza.no} 第 ${phraseIndex + 1} 个片语`);
        field.addEventListener("input", () => {
          activeOutline.stanzas[stanzaIndex].phrases[phraseIndex] = field.value.trim();
          updateGenerateButton();
        });
        row.append(field);
        if (activeOutline.stanzas[stanzaIndex].phrases.length > 2) {
          const remove = element("button", "phrase-remove", "移除");
          remove.type = "button";
          remove.setAttribute("aria-label", `移除第 ${phraseIndex + 1} 个片语`);
          remove.addEventListener("click", () => {
            activeOutline.stanzas[stanzaIndex].phrases.splice(phraseIndex, 1);
            renderPhrases();
            updateGenerateButton();
          });
          row.append(remove);
        }
        phraseList.append(row);
      });
      if (activeOutline.stanzas[stanzaIndex].phrases.length < 4) {
        const add = element("button", "phrase-add", "+ 添加片语");
        add.type = "button";
        add.addEventListener("click", () => {
          activeOutline.stanzas[stanzaIndex].phrases.push("");
          renderPhrases();
          phraseList.lastElementChild?.querySelector("input")?.focus();
          updateGenerateButton();
        });
        phraseList.append(add);
      }
    };
    renderPhrases();
    card.append(phraseList);
    outlineReview.append(card);
  });
  confirmOutlineRow.hidden = false;
}

function outlineIsValid() {
  if (!activeOutline || activeOutline.stanzas.length !== activeLyrics.length) return false;
  return activeOutline.stanzas.every((stanza, index) =>
    stanza.title.trim() && stanza.phrases.length >= 2 && stanza.phrases.length <= 4 &&
    stanza.phrases.every((phrase) => phrase.trim() && activeLyrics[index].includes(phrase)));
}

function addCard(parent, title, className = "report-card") {
  const card = element("section", className);
  if (title) card.append(element("h3", "", title));
  parent.append(card);
  return card;
}

function addParagraph(parent, text, className = "") {
  parent.append(element("p", className, text));
}

function addTable(parent, headers, rows) {
  const table = element("table");
  const head = element("thead");
  const headerRow = element("tr");
  headers.forEach((text) => headerRow.append(element("th", "", text)));
  head.append(headerRow);
  table.append(head);
  const body = element("tbody");
  rows.forEach((row) => {
    const tableRow = element("tr");
    row.forEach((text) => tableRow.append(element("td", "", String(text))));
    body.append(tableRow);
  });
  table.append(body);
  parent.append(table);
}

function renderReport(report) {
  document.querySelector("#report-title").textContent = report.title_zh;
  document.querySelector("#report-subtitle").textContent = [report.author_line, report.hymnal].filter(Boolean).join(" · ");
  const content = document.querySelector("#report-content");
  content.replaceChildren();

  const lyricsCard = addCard(content, "诗歌歌词");
  report.lyrics.forEach((stanza) => {
    const article = element("div", "lyrics-stanza");
    article.append(element("h4", "", `${stanza.no}、`));
    article.append(element("p", "", stanza.text));
    lyricsCard.append(article);
  });

  const authorCard = addCard(content, `作者简介：${report.author_line || "资料待核"}`);
  report.author_bio.forEach((paragraph) => addParagraph(authorCard, paragraph));
  if (report.author_works) addParagraph(authorCard, `代表作：${report.author_works}`);

  const backgroundCard = addCard(content, "创作背景");
  report.background.forEach((paragraph) => addParagraph(backgroundCard, paragraph));

  const musicCard = addCard(content, "诗歌简述与乐感导引");
  addParagraph(musicCard, report.music.intro);
  report.music.guidance.forEach((item) => {
    musicCard.append(element("h4", "", item.stanza));
    addParagraph(musicCard, item.text);
  });

  const structureCard = addCard(content, "诗节结构与属灵经历对照");
  addTable(structureCard, ["诗节", "属灵经历", "核心经文"], report.structure_table.map((item) => [item.stanza, item.experience, item.verses]));

  const exegesisCard = addCard(content, "逐节属灵解经与应用");
  report.stanzas.forEach((stanza) => {
    exegesisCard.append(element("h4", "", `${stanza.no}：${stanza.title}`));
    stanza.phrases.forEach((phrase) => {
      const phraseCard = element("div", "phrase-card");
      phraseCard.append(element("h4", "", phrase.phrase));
      addParagraph(phraseCard, phrase.explanation);
      addParagraph(phraseCard, `对照经文：${phrase.verses}`, "verse");
      exegesisCard.append(phraseCard);
    });

    const revelationCard = addCard(exegesisCard, "启示的話", "report-card colored-card");
    stanza.revelation.forEach((item) => addParagraph(revelationCard, `• ${item.text}（${item.source}）`));

    const groupCard = addCard(exegesisCard, `小组追求（${stanza.no}）`, "report-card group-card");
    groupCard.append(element("h4", "", "讨论题目"));
    const questions = element("ol");
    stanza.group.questions.forEach((item) => {
      const question = element("li");
      question.append(document.createTextNode(item.q));
      question.append(element("p", "", `参考：${item.hint}`));
      questions.append(question);
    });
    groupCard.append(questions);
    addParagraph(groupCard, `应用操练：${stanza.group.practice}`);
    addParagraph(groupCard, `祷告：${stanza.group.prayer}`);
  });

  const summaryCard = addCard(content, "属灵著述家观点对照总结");
  addTable(summaryCard, report.summary_table.headers, report.summary_table.rows);

  const prayerCard = addCard(content, "总结回应祷告", "report-card prayer-card");
  report.closing_prayer.forEach((paragraph) => addParagraph(prayerCard, paragraph));
}

function updateGenerateButton() {
  const validOutline = outlineIsValid();
  generateButton.disabled = !confirmLyrics.checked || !confirmOutline.checked || !validOutline;
  if (!validOutline && activeOutline) {
    showError(reviewError, "请检查主题，并确保每节包含 2 至 4 个逐字摘自歌词原文的片语。");
  } else if (reviewError.textContent.startsWith("请检查主题")) {
    showError(reviewError, "");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  showError(reviewError, "");
  showError(downloadError, "");
  outlineButton.disabled = true;
  const title = titleInput.value.trim();
  const lyrics = lyricsInput.value.trim();
  try {
    setLoading(true, "正在整理诗歌脉络", "系统正在依照诗节拆分片语，并归纳属灵进程。");
    const result = await requestJson("/api/outline", { title, lyrics });
    activeOutline = result.outline;
    activeLyrics = result.lyrics;
    approvedTitle = title;
    activeReport = null;
    reportSection.hidden = true;
    renderLyrics(activeLyrics);
    renderOutline(activeOutline);
    confirmLyrics.checked = false;
    confirmOutline.checked = false;
    updateGenerateButton();
    reviewSection.hidden = false;
    titleInput.disabled = true;
    lyricsInput.disabled = true;
    reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(formError, error.message);
  } finally {
    setLoading(false);
    outlineButton.disabled = false;
  }
});

confirmLyrics.addEventListener("change", updateGenerateButton);
confirmOutline.addEventListener("change", updateGenerateButton);

document.querySelector("#edit-button").addEventListener("click", () => {
  activeOutline = null;
  activeReport = null;
  titleInput.disabled = false;
  lyricsInput.disabled = false;
  reviewSection.hidden = true;
  reportSection.hidden = true;
  showError(reviewError, "");
  titleInput.focus();
});

generateButton.addEventListener("click", async () => {
  if (!activeOutline || !confirmLyrics.checked || !confirmOutline.checked) return;
  generateButton.disabled = true;
  showError(reviewError, "");
  try {
    setLoading(true, "正在撰写深度解析", "逐节经文、属灵观察与小组材料正在整理中。");
    const result = await requestJson("/api/generate", {
      title: approvedTitle,
      lyrics: activeLyrics.join("\n\n"),
      outline: activeOutline,
      gate1Confirmed: confirmLyrics.checked,
      gate2Confirmed: confirmOutline.checked,
    });
    activeReport = result.report;
    renderReport(activeReport);
    reportSection.hidden = false;
    reportSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(reviewError, error.message);
  } finally {
    setLoading(false);
    updateGenerateButton();
  }
});

downloadButton.addEventListener("click", async () => {
  if (!activeReport) return;
  downloadButton.disabled = true;
  showError(downloadError, "");
  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report: activeReport }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Word 文件生成失败，请重试。");
    }
    const file = await response.blob();
    const url = URL.createObjectURL(file);
    const anchor = element("a");
    anchor.href = url;
    anchor.download = `${activeReport.title_zh.replace(/[<>:"/\\|?*]/g, "-") || "诗歌深度解析"}.docx`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    showError(downloadError, error.message);
  } finally {
    downloadButton.disabled = false;
  }
});
