import { withPluginApi } from "discourse/lib/plugin-api";
import { debounce } from "@ember/runloop";

function extractEaselLinks(text) {
  const regex = /(?:https?:\/\/easel\.com\/projects\/|http:\/\/localhost:4200\/projects\/)\S+/gi;
  return [...text.matchAll(regex)].map((m) => m[0]);
}

async function checkLinkPublic(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      mode: "cors",
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

// Easel warnings cache (used by decorateCookedElement)
let easelWarnings = [];

export default {
  name: "check-easel-project-links",

  initialize() {
    withPluginApi("1.15.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "easel-project-check",

        _checkEaselLinksDebounced() {
          debounce(this, this._checkEaselLinks, 1000);
        },

        async _checkEaselLinks() {
          const raw = this.model.reply || "";
          const urls = extractEaselLinks(raw);
          easelWarnings = [];

          await Promise.all(
            urls.map(async (url) => {
              const ok = await checkLinkPublic(url);
              if (!ok) {
                easelWarnings.push(
                  `⚠️ The project link <a href="${url}" target="_blank">${url}</a> may not be publicly viewable.`
                );
              }
            })
          );

          // Force preview refresh by triggering a re-render
          this.set("model.reply", this.model.reply + " ");
          this.set("model.reply", this.model.reply.trim());

          // Add warnings to preview
          if (easelWarnings.length > 0) {
            const preview = document.querySelector(".d-editor-preview");
            if (preview) {
              const existing = preview.querySelector(".easel-warning-box");
              if (existing) existing.remove();

              const box = document.createElement("div");
              box.className = "easel-warning-box";

              const warningHtml = easelWarnings
                .map((w) => `
                  <div class="warning-message">
                    <i class="fa fa-exclamation-triangle"></i>
                    ${w}
                  </div>
                `)
                .join("");

              box.innerHTML = warningHtml;
              
              if (preview.firstChild) {
                preview.insertBefore(box, preview.firstChild);
              } else {
                preview.appendChild(box);
              }
            }
          }
        },

        init() {
          this._super(...arguments);
          this.addObserver("model.reply", this, this._checkEaselLinksDebounced);
        },
      });

      api.decorateCookedElement(
        (elem, helper) => {
          console.log("In decorateCookedElement...");
          console.log("Current warnings:", easelWarnings);
          if (!helper || !helper.getModel || !easelWarnings.length) {
            console.log("Skipping warning display - no warnings or missing helper");
            return;
          }

          // Only inject in composer preview
          const model = helper.getModel();
          if (!model?.composer) {
            console.log("Skipping warning display - not in composer");
            return;
          }

          const preview = elem;
          const existing = preview.querySelector(".easel-warning-box");
          if (existing) existing.remove();

          const box = document.createElement("div");
          box.className = "easel-warning-box";

          const warningHtml = easelWarnings
            .map((w) => `
              <div class="warning-message">
                <i class="fa fa-exclamation-triangle"></i>
                ${w}
              </div>
            `)
            .join("");

          box.innerHTML = warningHtml;
          console.log("Created warning box with HTML:", warningHtml);
          
          // Insert at the top of the preview
          if (preview.firstChild) {
            preview.insertBefore(box, preview.firstChild);
          } else {
            preview.appendChild(box);
          }
        },
        { id: "easel-link-checker", onlyStream: false }
      );
    });
  },
};

