const markdownIt = require('markdown-it');
const markdownItAdmonition = require('markdown-it-admonition');
const { parse } = require("node-html-parser");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");



module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/static");
  eleventyConfig.addPlugin(eleventyNavigationPlugin);


  let markdownLib = markdownIt({
    breaks: true,
    html: true,
    linkify: true,
  })
    .use(require("markdown-it-mark"))
    .use(require("markdown-it-footnote"))
    .use(function (md) {
      md.renderer.rules.hashtag_open = function (tokens, idx) {
        return '<a class="tag" onclick="toggleTagSearch(this)">';
      };
    })
    .use(require("markdown-it-mathjax3"), {
      tex: {
        inlineMath: [["$", "$"]],
      },
      options: {
        skipHtmlTags: { "[-]": ["pre"] },
      },
    })
    .use(require("markdown-it-attrs"))
    .use(require("markdown-it-task-checkbox"), {
      disabled: true,
      divWrap: false,
      divClass: "checkbox",
      idPrefix: "cbx_",
      ulClass: "task-list",
      liClass: "task-list-item",
    })
    .use(require("markdown-it-plantuml"), {
      openMarker: "```plantuml",
      closeMarker: "```",
    })
    .use(function (md) {
      //https://github.com/DCsunset/markdown-it-mermaid-plugin
      const origFenceRule =
        md.renderer.rules.fence ||
        function (tokens, idx, options, env, self) {
          return self.renderToken(tokens, idx, options, env, self);
        };
      md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
        const token = tokens[idx];
        if (token.info === "mermaid") {
          const code = token.content.trim();
          return `<pre class="mermaid">${code}</pre>`;
        }
        if (token.info === "transclusion") {
          const code = token.content.trim();
          return `<div class="transclusion">${md.render(code)}</div>`;
        }

        // Other languages
        return origFenceRule(tokens, idx, options, env, slf);
      };

      const defaultImageRule =
        md.renderer.rules.image ||
        function (tokens, idx, options, env, self) {
          return self.renderToken(tokens, idx, options, env, self);
        };
      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const imageName = tokens[idx].content;
        //"image.png|metadata?|width"
        const [fileName, ...widthAndMetaData] = imageName.split("|");
        const lastValue = widthAndMetaData[widthAndMetaData.length - 1];
        const lastValueIsNumber = !isNaN(lastValue);
        const width = lastValueIsNumber ? lastValue : null;

        let metaData = "";
        if (widthAndMetaData.length > 1) {
          metaData = widthAndMetaData.slice(0, widthAndMetaData.length - 1).join(" ");
        }

        if (!lastValueIsNumber) {
          metaData += ` ${lastValue}`;
        }

        if (width) {
          const widthIndex = tokens[idx].attrIndex("width");
          const widthAttr = `${width}px`;
          if (widthIndex < 0) {
            tokens[idx].attrPush(["width", widthAttr]);
          } else {
            tokens[idx].attrs[widthIndex][1] = widthAttr;
          }
        }

        return defaultImageRule(tokens, idx, options, env, self);
      };

      const defaultLinkRule =
        md.renderer.rules.link_open ||
        function (tokens, idx, options, env, self) {
          return self.renderToken(tokens, idx, options, env, self);
        };
      /*
      md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const aIndex = tokens[idx].attrIndex("target");
      const classIndex = tokens[idx].attrIndex("class");

      if (aIndex < 0) {
        tokens[idx].attrPush(["target", "_blank"]);
      } else {
        tokens[idx].attrs[aIndex][1] = "_blank";
      }

      if (classIndex < 0) {
        tokens[idx].attrPush(["class", "external-link"]);
      } else {
        tokens[idx].attrs[classIndex][1] = "external-link";
      }

      return defaultLinkRule(tokens, idx, options, env, self);
    };*/
    });

  eleventyConfig.setLibrary('md', markdownLib);
  eleventyConfig.addTransform("callout-block", function (str) {
    const parsed = parse(str);

    const transformCalloutBlocks = (
      blockquotes = parsed.querySelectorAll("blockquote")
    ) => {
      for (const blockquote of blockquotes) {
        transformCalloutBlocks(blockquote.querySelectorAll("blockquote"));

        let content = blockquote.innerHTML;

        let titleDiv = "";
        let calloutType = "";
        let calloutMetaData = "";
        let isCollapsable;
        let isCollapsed;
        const calloutMeta = /\[!([\w-]*)\|?(\s?.*)\](\+|\-){0,1}(\s?.*)/;
        if (!content.match(calloutMeta)) {
          continue;
        }

        content = content.replace(
          calloutMeta,
          function (metaInfoMatch, callout, metaData, collapse, title) {
            isCollapsable = Boolean(collapse);
            isCollapsed = collapse === "-";
            const titleText = title.replace(/(<\/{0,1}\w+>)/, "")
              ? title.trim()
              : `${callout.charAt(0).toUpperCase()}${callout
                .substring(1)
                .toLowerCase()}`;
            const fold = isCollapsable
              ? `<div class="callout-fold"><i icon-name="chevron-down"></i></div>`
              : ``;

            calloutType = callout.trim().toLowerCase();
            calloutMetaData = metaData;

            // Determine style based on calloutType mapping
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

            titleDiv = `<div class="callout-title">${iconHtml}<div class="callout-title-inner">${titleText}</div>${fold}</div>`;
            return "";
          }
        );

        blockquote.tagName = "div";
        blockquote.classList.add("callout");
        blockquote.classList.add(isCollapsable ? "is-collapsible" : "");
        blockquote.classList.add(isCollapsed ? "is-collapsed" : "");
        blockquote.setAttribute("data-callout", calloutType.toLowerCase());
        //add a class "callout-calloutType.toLowerCase()" to style via css
        blockquote.classList.add(calloutType.toLowerCase());
        calloutMetaData && blockquote.setAttribute("data-callout-metadata", calloutMetaData);
        blockquote.innerHTML = `${titleDiv}\n<div class="callout-content">${content}</div>`;
      }
    };

    transformCalloutBlocks();

    return str && parsed.innerHTML;
  });

  eleventyConfig.addTransform("table", function (str) {
    const parsed = parse(str);
    for (const t of parsed.querySelectorAll(".cm-s-obsidian > table")) {
      let inner = t.innerHTML;
      t.tagName = "div";
      t.classList.add("table-wrapper");
      t.innerHTML = `<table>${inner}</table>`;
    }

    for (const t of parsed.querySelectorAll(
      ".cm-s-obsidian > .block-language-dataview > table"
    )) {
      t.classList.add("dataview");
      t.classList.add("table-view-table");
      t.querySelector("thead")?.classList.add("table-view-thead");
      t.querySelector("tbody")?.classList.add("table-view-tbody");
      t.querySelectorAll("thead > tr")?.forEach((tr) => {
        tr.classList.add("table-view-tr-header");
      });
      t.querySelectorAll("thead > tr > th")?.forEach((th) => {
        th.classList.add("table-view-th");
      });
    }
    return str && parsed.innerHTML;
  });
  // Return your Object options:
  return {
    templateFormats: ["njk", "md", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    dir: {
      input: "src",
      output: "_site"
    }
  }
};
