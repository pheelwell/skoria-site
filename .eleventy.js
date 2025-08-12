const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const ancestryPlugin = require("@tigersway/eleventy-plugin-ancestry");
const { parse } = require("node-html-parser");

const markdownIt = require("markdown-it");
const markdownItAttrs = require("markdown-it-attrs");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItTaskCheckbox = require("markdown-it-task-checkbox");
const markdownItMark = require("markdown-it-mark");
const markdownItAdmonition = require("markdown-it-admonition");
const markdownItPlantUML = require("markdown-it-plantuml");
const markdownItMathJax3 = require("markdown-it-mathjax3");

module.exports = function(eleventyConfig) {
  // Passthrough static assets
  eleventyConfig.addPassthroughCopy({ "src/static": "static" });
  // Passthrough the standalone cocktail static site
  eleventyConfig.addPassthroughCopy({ "src/cocktail": "cocktail" });

  // Watch
  eleventyConfig.addWatchTarget("src/static/**/*");
  eleventyConfig.addWatchTarget("src/cocktail/**/*");

  // Plugins
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(ancestryPlugin);

  // Markdown config
  const md = markdownIt({ html: true, linkify: true })
    .use(markdownItAttrs)
    .use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.ariaHidden({ placement: "after", class: "header-anchor", symbol: "#", space: true }),
      slugify: s => encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-")),
    })
    .use(markdownItFootnote)
    .use(markdownItTaskCheckbox, { disabled: true, divWrap: true })
    .use(markdownItMark)
    .use(markdownItAdmonition)
    .use(markdownItPlantUML)
    .use(markdownItMathJax3);
  eleventyConfig.setLibrary("md", md);

  // Filters
  eleventyConfig.addFilter("fallback", function(value, fallbackValue) {
    if (value === undefined || value === null || value === "") return fallbackValue;
    return value;
  });
  eleventyConfig.addFilter("clamp255", function(value) {
    const n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
  });

  // Collections
  eleventyConfig.addCollection("articles", (api) => api.getFilteredByGlob("src/garden/**/*.md"));

  // Transforms
  eleventyConfig.addTransform("callout-block", function (str) {
    if (!str || typeof str !== "string") return str;
    let parsed;
    try { parsed = parse(str); } catch { return str; }

    const transformCalloutBlocks = (blockquoteNodes) => {
      if (!blockquoteNodes) return;
      for (const blockquote of blockquoteNodes) {
        // recurse into nested quotes first
        transformCalloutBlocks(blockquote.querySelectorAll("blockquote"));

        let content = blockquote.innerHTML || "";
        let titleDiv = "";
        let calloutType = "";
        let calloutMetaData = "";
        let isCollapsable = false;
        let isCollapsed = false;
        const calloutMeta = /\[!([\w-]*)\|?(\s?.*)\](\+|\-){0,1}(\s?.*)/;
        if (!content.match(calloutMeta)) continue;

        content = content.replace(
          calloutMeta,
          function (_match, callout, metaData, collapse, title) {
            isCollapsable = Boolean(collapse);
            isCollapsed = collapse === "-";
            const titleText = /(<\/{0,1}\w+>)/.test(title)
              ? title.trim()
              : `${callout.charAt(0).toUpperCase()}${callout.substring(1).toLowerCase()}`;
            const fold = isCollapsable
              ? `<div class="callout-fold"><i icon-name="chevron-down"></i></div>`
              : ``;

            calloutType = (callout || "").trim().toLowerCase();
            calloutMetaData = metaData || "";

            const calloutMap = {
              info:    { color: '#3498db', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/info.svg' },
              tip:     { color: '#008080', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/flame.svg' },
              warning: { color: '#FFA500', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/badge-alert.svg' },
              quote:   { color: '#d3d3d3', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/quote.svg' },
              read:    { color: '#800080', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/book-open.svg' },
              seed:    { color: '#008000', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/sprout.svg' },
              secret:  { color: '#A9A9A9', icon: 'https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/lock.svg' }
            };
            const styleData = calloutMap[calloutType] || { color: '', icon: '' };
            const iconHtml = styleData.icon ? `<img src="${styleData.icon}" alt="${calloutType} icon" class="callout-icon">` : "";

            titleDiv = `<div class=\"callout-title\">${iconHtml}<div class=\"callout-title-inner\">${titleText}</div>${fold}</div>`;
            return "";
          }
        );

        blockquote.tagName = "div";
        blockquote.classList.add("callout");
        if (isCollapsable) blockquote.classList.add("is-collapsible");
        if (isCollapsed) blockquote.classList.add("is-collapsed");
        if (calloutType) blockquote.setAttribute("data-callout", calloutType.toLowerCase());
        if (calloutMetaData) blockquote.setAttribute("data-callout-metadata", calloutMetaData);
        blockquote.innerHTML = `${titleDiv}\n<div class="callout-content">${content}</div>`;
      }
    };

    transformCalloutBlocks(parsed.querySelectorAll("blockquote"));
    return parsed.innerHTML || str;
  });

  eleventyConfig.addTransform("table", function (str) {
    if (!str || typeof str !== "string") return str;
    let parsed;
    try { parsed = parse(str); } catch { return str; }
    for (const t of parsed.querySelectorAll(".cm-s-obsidian > table")) {
      const inner = t.innerHTML; t.tagName = "div"; t.classList.add("table-wrapper"); t.innerHTML = `<table>${inner}</table>`;
    }
    for (const t of parsed.querySelectorAll(".cm-s-obsidian > .block-language-dataview > table")) {
      t.classList.add("dataview", "table-view-table");
      t.querySelector("thead")?.classList.add("table-view-thead");
      t.querySelector("tbody")?.classList.add("table-view-tbody");
      t.querySelectorAll("thead > tr")?.forEach((tr) => tr.classList.add("table-view-tr-header"));
      t.querySelectorAll("thead > tr > th")?.forEach((th) => th.classList.add("table-view-th"));
    }
    return parsed.innerHTML || str;
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};

 