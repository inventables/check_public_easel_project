import { withPluginApi } from "discourse/lib/plugin-api";
import { scheduleDebounce } from "discourse/lib/debounce";

function extractEaselLinks(text) {
  const regex = /https:\/\/easel\.com\/projects\/\S+/gi;
  return [...text.matchAll(regex)].map((m) => m[0]);
}

async function checkLinkPublic(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      mode: "cors", // must be allowed by easel.com
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

export default {
  name: "check-easel-project-links",

  initialize(container) {
    withPluginApi("1.15.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "easel-project-check",

        easelWarnings: null,

        init() {
          this._super(...arguments);
          this.set("easelWarnings", []);
          this.addObserver("model.reply", this, this._debouncedCheck);
        },

        _debouncedCheck() {
          scheduleDebounce(
            "check-easel-links",
            this,
            this._checkEaselLinks,
            1000
          );
        },

        async _checkEaselLinks() {
          const raw = this.model.reply || "";
          const urls = extractEaselLinks(raw);
          const warnings = [];

          await Promise.all(
            urls.map(async (url) => {
              const ok = await checkLinkPublic(url);
              if (!ok) {
                warnings.push(
                  `⚠️ The project link <a href="${url}" target="_blank">${url}</a> may not be publicly viewable.`
                );
              }
            })
          );

          this.set("easelWarnings", warnings);
        },
      });

      api.decorateWidget("composer-preview:before", (helper) => {
        const controller = helper.widget.currentController;
        const warnings = controller?.easelWarnings || [];

        if (warnings.length === 0) return;

        return helper.h(
          "div.easel-warning-box",
          warnings.map((w) =>
            helper.h("div.warning-message", {
              innerHTML: w,
            })
          )
        );
      });
    });
  },
};

