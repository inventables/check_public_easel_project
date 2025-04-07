import { withPluginApi } from "discourse/lib/plugin-api";
import { debounce } from "@ember/runloop";

function extractEaselLinks(text) {
  const regex = /http:\/\/localhost:4200\/projects\/\S+/gi;
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
                console.log("Pushing easel warning");
              }
            })
          );

          // Force preview refresh by triggering a re-render
          this.set("model.reply", this.model.reply + " ");
          this.set("model.reply", this.model.reply.trim());
        },

        init() {
          this._super(...arguments);
          this.addObserver("model.reply", this, this._checkEaselLinksDebounced);
        },
      });

      api.decorateCookedElement(
        (elem, helper) => {
          console.log("In decorateCookedElement...");
          if (!helper || !helper.getModel || !easelWarnings.length) return;

          // Only inject in composer preview (stream = true)
          if (!helper.getModel()?.composer) return;

          const preview = elem;
          const existing = preview.querySelector(".easel-warning-box");
          if (existing) existing.remove();

          const box = document.createElement("div");
          box.className = "easel-warning-box";
          box.innerHTML = easelWarnings
            .map((w) => `<div class="warning-message">${w}</div>`)
            .join("");

          console.log("Prepending element...");
          preview.prepend(box);
        },
        { id: "easel-link-checker", onlyStream: true }
      );
    });
  },
};

