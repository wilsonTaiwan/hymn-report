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
const MAX_PHRASES = 16;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setLoading(visible, title = "正在整理詩歌脈絡", message = "這可能需要一點時間，請稍候。") {
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
  if (!response.ok) throw new Error(result.error || `請求失敗（${response.status}）。`);
  return result;
}

function renderLyrics(lyrics) {
  lyricsReview.replaceChildren();
  lyrics.forEach((text, index) => {
    const stanza = element("article", "lyrics-stanza");
    stanza.append(element("h4", "", `第 ${index + 1} 節`));
    stanza.append(element("p", "", text));
    lyricsReview.append(stanza);
  });
}

function renderOutline(outline) {
  outlineReview.replaceChildren();
  outline.stanzas.forEach((stanza, stanzaIndex) => {
    const card = element("article", "outline-stanza");
    const titleLabel = element("label", "outline-label", `${stanza.no} · 屬靈階梯主題`);
    const titleField = element("input", "outline-title");
    titleField.type = "text";
    titleField.maxLength = 120;
    titleField.value = stanza.title;
    titleField.setAttribute("aria-label", `${stanza.no} 的屬靈階梯主題`);
    titleField.addEventListener("input", () => {
      activeOutline.stanzas[stanzaIndex].title = titleField.value.trim();
      updateGenerateButton();
    });
    card.append(titleLabel, titleField);

    const phrasesLabel = element("div", "outline-label phrase-label", `原文片語（每一行歌詞都需涵蓋，最多 ${MAX_PHRASES} 組，必須逐字摘自本節歌詞）`);
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
        field.setAttribute("aria-label", `${stanza.no} 第 ${phraseIndex + 1} 個片語`);
        field.addEventListener("input", () => {
          activeOutline.stanzas[stanzaIndex].phrases[phraseIndex] = field.value.trim();
          updateGenerateButton();
        });
        row.append(field);
        if (activeOutline.stanzas[stanzaIndex].phrases.length > 1) {
          const remove = element("button", "phrase-remove", "移除");
          remove.type = "button";
          remove.setAttribute("aria-label", `移除第 ${phraseIndex + 1} 個片語`);
          remove.addEventListener("click", () => {
            activeOutline.stanzas[stanzaIndex].phrases.splice(phraseIndex, 1);
            renderPhrases();
            updateGenerateButton();
          });
          row.append(remove);
        }
        phraseList.append(row);
      });
      if (activeOutline.stanzas[stanzaIndex].phrases.length < MAX_PHRASES) {
        const add = element("button", "phrase-add", "+ 添加片語");
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

function uncoveredLines(stanzaText, phrases) {
  return stanzaText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .filter((line) => !phrases.some((phrase) => phrase && (line.includes(phrase) || phrase.includes(line))));
}

function outlineIsValid() {
  if (!activeOutline || activeOutline.stanzas.length !== activeLyrics.length) return false;
  return activeOutline.stanzas.every((stanza, index) =>
    stanza.title.trim() && stanza.phrases.length >= 1 && stanza.phrases.length <= MAX_PHRASES &&
    stanza.phrases.every((phrase) => phrase.trim() && activeLyrics[index].includes(phrase)) &&
    uncoveredLines(activeLyrics[index], stanza.phrases).length === 0);
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

function verseText(label, verse) {
  if (!verse) return "";
  return `${label}${verse.text ? `「${verse.text}」（${verse.ref}）` : verse.ref}`;
}

function renderReport(report) {
  document.querySelector("#report-title").textContent = report.title_zh;
  document.querySelector("#report-subtitle").textContent =
    [report.title_en, report.author_line, report.hymnal, report.hymnal_refs].filter(Boolean).join(" · ");
  const content = document.querySelector("#report-content");
  content.replaceChildren();

  const lyricsCard = addCard(content, "一、詩歌歌詞");
  report.lyrics.forEach((stanza) => {
    const article = element("div", "lyrics-stanza");
    article.append(element("h4", "", `第${stanza.no}節`));
    article.append(element("p", "", stanza.text));
    lyricsCard.append(article);
  });

  const authorCard = addCard(content, `二、作者簡介：${report.author_line || "資料待核"}`);
  report.author_bio.forEach((paragraph) => addParagraph(authorCard, paragraph));
  if (report.author_works) addParagraph(authorCard, `代表作：${report.author_works}`);

  const backgroundCard = addCard(content, "三、創作背景");
  report.background.forEach((paragraph) => addParagraph(backgroundCard, paragraph));

  const musicCard = addCard(content, "四、詩歌簡述與樂感表達指導");
  addParagraph(musicCard, `屬靈進程：${report.music.intro}`);
  report.music.guidance.forEach((item) => {
    musicCard.append(element("h4", "", item.stanza));
    addParagraph(musicCard, `情緒標籤：${item.mood}`);
    addParagraph(musicCard, `速度：${item.tempo}`);
    addParagraph(musicCard, `力度：${item.dynamics}`);
    addParagraph(musicCard, `樂感細節：${item.text}`);
  });

  const structureCard = addCard(content, "五、詩節結構與屬靈經歷對照表");
  addTable(structureCard, ["詩節", "屬靈經歷", "核心經文"], report.structure_table.map((item) => [item.stanza, item.experience, item.verses]));

  const exegesisCard = addCard(content, "六、逐節屬靈解經與應用");
  report.stanzas.forEach((stanza) => {
    exegesisCard.append(element("h4", "", `${stanza.no}：${stanza.title}`));
    stanza.phrases.forEach((phrase, index) => {
      const phraseCard = element("div", "phrase-card");
      phraseCard.append(element("h4", "", `${index + 1}.「${phrase.phrase}」`));
      addParagraph(phraseCard, verseText("真理根基：", phrase.truth), "verse");
      addParagraph(phraseCard, verseText("生活實踐：", phrase.life), "verse");
      addParagraph(phraseCard, `屬靈解經：${phrase.explanation}`);
      exegesisCard.append(phraseCard);
    });
  });

  const revelationCard = addCard(content, "七、啟示的話", "report-card colored-card");
  report.stanzas.forEach((stanza) => {
    revelationCard.append(element("h4", "", stanza.no));
    stanza.revelation.forEach((item) => addParagraph(revelationCard, `• ${item.text}（${item.source}）`));
  });

  const groupSection = addCard(content, "八、小組追求模組", "report-card group-card");
  report.stanzas.forEach((stanza) => {
    groupSection.append(element("h4", "", `【${stanza.no}小組追求】`));
    groupSection.append(element("p", "", "討論題目"));
    const questions = element("ol");
    stanza.group.questions.forEach((item) => {
      const question = element("li");
      question.append(document.createTextNode(item.q));
      question.append(element("p", "", `參考答案：${item.answer}`));
      questions.append(question);
    });
    groupSection.append(questions);
    addParagraph(groupSection, `操練項目：${stanza.group.practice.item}`);
    addParagraph(groupSection, `落實步驟：${stanza.group.practice.steps}`);
    addParagraph(groupSection, `禱告：${stanza.group.prayer}`);
  });

  const summaryCard = addCard(content, "九、屬靈著述家觀點對照總結表");
  addTable(summaryCard, report.summary_table.headers, report.summary_table.rows);

  const prayerCard = addCard(content, "十、總結回應禱告", "report-card prayer-card");
  report.closing_prayer.forEach((paragraph) => addParagraph(prayerCard, paragraph));
}

function updateGenerateButton() {
  const validOutline = outlineIsValid();
  generateButton.disabled = !confirmLyrics.checked || !confirmOutline.checked || !validOutline;
  if (!validOutline && activeOutline) {
    showError(reviewError, "請檢查主題，並確保每節的每一行歌詞都被逐字摘自原文的片語涵蓋。");
  } else if (reviewError.textContent.startsWith("請檢查主題")) {
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
    setLoading(true, "正在整理詩歌脈絡", "系統正在依照詩節拆分片語，並歸納屬靈進程。");
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
    setLoading(true, "正在撰寫深度解析", "逐節經文、屬靈觀察與小組材料正在整理中。");
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
      throw new Error(result.error || "Word 文件產生失敗，請重試。");
    }
    const file = await response.blob();
    const url = URL.createObjectURL(file);
    const anchor = element("a");
    anchor.href = url;
    anchor.download = `${activeReport.title_zh.replace(/[<>:"/\\|?*]/g, "-") || "詩歌深度解析"}.docx`;
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
