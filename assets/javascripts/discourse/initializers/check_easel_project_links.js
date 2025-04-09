import { withPluginApi } from "discourse/lib/plugin-api";
import { debounce } from "@ember/runloop";

function extractEaselLinks(text) {
  const regex = /(?:https?:\/\/easel\.com\/projects\/|https:\/\/localhost:3005\/projects\/)\S+/gi;
  return [...text.matchAll(regex)].map((m) => m[0]);
}

async function checkLinkPublic(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      mode: "cors",
      redirect: "manual"
    });
    return response.status === 200;
  } catch (e) {
    return false;
  }
}

// Easel warnings cache and URL check timestamps
let easelWarnings = [];
let urlCheckTimes = new Map();

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
          const now = Date.now();
          
          // Keep only warnings for URLs that are still in the text
          easelWarnings = easelWarnings.filter(w => 
            urls.some(url => w.includes(url))
          );

          await Promise.all(
            urls.map(async (url) => {
              const lastCheckTime = urlCheckTimes.get(url) || 0;
              // Check if URL hasn't been checked in the last 3 seconds
              if (now - lastCheckTime >= 3000) {
                const ok = await checkLinkPublic(url);
                urlCheckTimes.set(url, now);
                
                if (!ok) {
                  // Only add warning if it's not already there
                  if (!easelWarnings.some(w => w.includes(url))) {
                    easelWarnings.push(
                      `⚠️ Your Easel project <a href="${url}" target="_blank">${url}</a> is not shared publicly.`
                    );
                  }
                } else {
                  // Remove warning if URL is now accessible
                  easelWarnings = easelWarnings.filter(w => !w.includes(url));
                }
              }
            })
          );

          // Force preview refresh by triggering a re-render
          this.set("model.reply", this.model.reply + " ");
          this.set("model.reply", this.model.reply.trim());

          // Add warnings to preview
          if (easelWarnings.length > 0) {
            const editorContainer = document.querySelector(".d-editor");
            if (editorContainer) {
              const existing = document.querySelector(".easel-warning-box");
              if (existing) {
                existing.remove();
              }

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

              // Add help text with menu path
              const helpText = `
                <div class="warning-help">
                  Share your project in Easel under <span class="menu-path">Project / Share</span>
                </div>
              `;

              box.innerHTML = warningHtml + helpText;
              
              // Insert at the top of the editor container
              editorContainer.insertAdjacentElement('beforebegin', box);
            }
          } else {
            // Remove any existing warnings when there are none
            const existing = document.querySelector(".easel-warning-box");
            if (existing) {
              existing.remove();
            }
          }
        },

        init() {
          this._super(...arguments);
          this.addObserver("model.reply", this, this._checkEaselLinksDebounced);
        },
      });
    });
  },
};

