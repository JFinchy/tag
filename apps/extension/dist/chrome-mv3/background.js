var background = function() {
  "use strict";
  var _a, _b;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  const browser = (
    // @ts-expect-error
    ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) == null ? globalThis.chrome : (
      // @ts-expect-error
      globalThis.browser
    )
  );
  const definition = defineBackground(() => {
    function getDomain(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch {
        return url;
      }
    }
    async function organizeTabsByDomain() {
      const tabs2 = await browser.tabs.query({});
      const tabsByDomain = /* @__PURE__ */ new Map();
      tabs2.forEach((tab) => {
        var _a2;
        if (tab.url) {
          const domain = getDomain(tab.url);
          if (!tabsByDomain.has(domain)) {
            tabsByDomain.set(domain, []);
          }
          (_a2 = tabsByDomain.get(domain)) == null ? void 0 : _a2.push(tab);
        }
      });
      let index = 0;
      for (const [domain, domainTabs] of tabsByDomain) {
        console.log(`Organizing tabs for domain: ${domain}`);
        for (const tab of domainTabs) {
          await browser.tabs.move(tab.id, { index: index++ });
        }
      }
    }
    async function handleTabCreated(tab) {
      if (!tab.url || !tab.id) return;
      const domain = getDomain(tab.url);
      const existingTabs = await browser.tabs.query({ url: tab.url });
      if (existingTabs.length > 1) {
        const existingTab = existingTabs.find((t) => t.id !== tab.id);
        if (existingTab == null ? void 0 : existingTab.id) {
          await browser.tabs.update(existingTab.id, { active: true });
          await browser.tabs.remove(tab.id);
          return;
        }
      }
      const sameDomainTabs = await browser.tabs.query({});
      const lastSameDomainTab = sameDomainTabs.filter((t) => t.url && getDomain(t.url) === domain && t.id !== tab.id).pop();
      if ((lastSameDomainTab == null ? void 0 : lastSameDomainTab.index) !== void 0) {
        await browser.tabs.move(tab.id, { index: lastSameDomainTab.index + 1 });
      }
    }
    browser.tabs.onCreated.addListener(async (tab) => {
      setTimeout(async () => {
        const updatedTab = await browser.tabs.get(tab.id);
        await handleTabCreated(updatedTab);
      }, 100);
    });
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.url) {
        await handleTabCreated(tab);
      }
    });
    organizeTabsByDomain();
    setInterval(organizeTabsByDomain, 5 * 60 * 1e3);
    async function getUpdatedTabs() {
      var _a2;
      console.log("Getting updated tabs...");
      try {
        const tabs2 = await browser.tabs.query({});
        console.log("Found tabs:", tabs2);
        const tabIds = tabs2.map((tab) => tab.id).filter((id) => id !== void 0);
        const processInfo = await ((_a2 = browser.processes) == null ? void 0 : _a2.getProcessInfo(tabIds)) || [];
        console.log("Process info:", processInfo);
        const bookmarks = await browser.bookmarks.search({});
        const bookmarkedUrls = new Set(bookmarks.map((b) => b.url));
        console.log("Bookmarked URLs:", bookmarkedUrls);
        const mappedTabs = tabs2.map((tab) => {
          const process = processInfo.find((p) => p.id === tab.id);
          return {
            ...tab,
            processId: tab.id,
            bookmarked: tab.url ? bookmarkedUrls.has(tab.url) : false,
            memoryInfo: process ? {
              privateMemory: process.privateMemory,
              jsMemoryUsed: process.jsMemoryUsed
            } : void 0
          };
        });
        console.log("Mapped tabs:", mappedTabs);
        return mappedTabs;
      } catch (error) {
        console.error("Error getting updated tabs:", error);
        return [];
      }
    }
    async function notifyTabsUpdated(tabs2) {
      console.log("Notifying about tab updates:", tabs2);
      try {
        const windows = await browser.tabs.query({});
        for (const window of windows) {
          if (window.id) {
            await browser.tabs.sendMessage(window.id, {
              action: "tabsUpdated",
              tabs: tabs2
            }).catch(() => {
            });
          }
        }
      } catch (error) {
        console.error("Error notifying about tab updates:", error);
      }
    }
    browser.tabs.onCreated.addListener(async () => {
      console.log("Tab created");
      const tabs2 = await getUpdatedTabs();
      await notifyTabsUpdated(tabs2);
    });
    browser.tabs.onRemoved.addListener(async () => {
      console.log("Tab removed");
      const tabs2 = await getUpdatedTabs();
      await notifyTabsUpdated(tabs2);
    });
    browser.tabs.onUpdated.addListener(async () => {
      console.log("Tab updated");
      const tabs2 = await getUpdatedTabs();
      await notifyTabsUpdated(tabs2);
    });
    browser.tabs.onMoved.addListener(() => notifyTabsUpdated(tabs));
    browser.tabs.onActivated.addListener(() => notifyTabsUpdated(tabs));
    browser.bookmarks.onCreated.addListener(async () => {
      console.log("Bookmark created");
      const tabs2 = await getUpdatedTabs();
      await notifyTabsUpdated(tabs2);
    });
    browser.bookmarks.onRemoved.addListener(async () => {
      console.log("Bookmark removed");
      const tabs2 = await getUpdatedTabs();
      await notifyTabsUpdated(tabs2);
    });
    browser.bookmarks.onChanged.addListener(() => notifyTabsUpdated(tabs));
    browser.runtime.onMessage.addListener(async (message) => {
      console.log("Received message:", message);
      try {
        switch (message.action) {
          case "getTabs":
            const tabs2 = await getUpdatedTabs();
            return tabs2;
          case "openDialog":
            await openDialog();
            break;
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
      return true;
    });
    browser.runtime.onInstalled.addListener((details) => {
      console.log("Extension installed/updated:", details.reason);
    });
    async function openDialog() {
      console.log("Opening dialog...");
      try {
        const tab = await browser.tabs.create({
          url: browser.runtime.getURL("tabs-modal.html"),
          active: true
        });
        console.log("Dialog opened in tab:", tab);
      } catch (error) {
        console.error("Error opening dialog:", error);
      }
    }
    browser.commands.onCommand.addListener(async (command) => {
      console.log("Command received:", command);
      if (command === "open-dialog") {
        await openDialog();
      }
    });
    console.log("Background script starting...");
  });
  background;
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = `${"ws:"}//${"localhost"}:${3e3}`;
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws == null ? void 0 : ws.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws == null ? void 0 : ws.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([{ ...contentScript, id }]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([{ ...contentScript, id }]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      var _a2, _b2;
      const hasJs = (_a2 = contentScript.js) == null ? void 0 : _a2.find((js) => {
        var _a3;
        return (_a3 = cs.js) == null ? void 0 : _a3.includes(js);
      });
      const hasCss = (_b2 = contentScript.css) == null ? void 0 : _b2.find((css) => {
        var _a3;
        return (_a3 = cs.css) == null ? void 0 : _a3.includes(css);
      });
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url)
        return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
}();
background;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjE5LjIzX0B0eXBlcytub2RlQDIyLjEwLjJfbGlnaHRuaW5nY3NzQDEuMjkuMl9yb2xsdXBANC4yOS4xL25vZGVfbW9kdWxlcy93eHQvZGlzdC9zYW5kYm94L2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMS4wLjMvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMTkuMjNfQHR5cGVzK25vZGVAMjIuMTAuMl9saWdodG5pbmdjc3NAMS4yOS4yX3JvbGx1cEA0LjI5LjEvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIvY2hyb21lLm1qcyIsIi4uLy4uL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiIsImV4cG9ydCBjb25zdCBicm93c2VyID0gKFxuICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gIGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWQgPT0gbnVsbCA/IGdsb2JhbFRoaXMuY2hyb21lIDogKFxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgKVxuKTtcbiIsImltcG9ydCB0eXBlIHsgTWVzc2FnZSwgUHJvY2Vzc0luZm8sIFRhYiB9IGZyb20gJy4uL3NyYy90eXBlcyc7XG5cbmltcG9ydCB0eXBlIHsgVGFicyB9IGZyb20gJ3dlYmV4dGVuc2lvbi1wb2x5ZmlsbCc7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuXG5pbnRlcmZhY2UgVGFiSW5mbyBleHRlbmRzIFRhYiB7XG4gIGxhc3RBY3RpdmVUaW1lc3RhbXA/OiBudW1iZXI7XG4gIGJvb2ttYXJrZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgLy8gRnVuY3Rpb24gdG8gZ2V0IGRvbWFpbiBmcm9tIFVSTFxuICBmdW5jdGlvbiBnZXREb21haW4odXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHVybCk7XG4gICAgICByZXR1cm4gdXJsT2JqLmhvc3RuYW1lO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbiB0byBvcmdhbml6ZSB0YWJzIGJ5IGRvbWFpblxuICBhc3luYyBmdW5jdGlvbiBvcmdhbml6ZVRhYnNCeURvbWFpbigpIHtcbiAgICBjb25zdCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHt9KTtcbiAgICBjb25zdCB0YWJzQnlEb21haW4gPSBuZXcgTWFwPHN0cmluZywgYnJvd3Nlci50YWJzLlRhYltdPigpO1xuXG4gICAgLy8gR3JvdXAgdGFicyBieSBkb21haW5cbiAgICB0YWJzLmZvckVhY2goKHRhYikgPT4ge1xuICAgICAgaWYgKHRhYi51cmwpIHtcbiAgICAgICAgY29uc3QgZG9tYWluID0gZ2V0RG9tYWluKHRhYi51cmwpO1xuICAgICAgICBpZiAoIXRhYnNCeURvbWFpbi5oYXMoZG9tYWluKSkge1xuICAgICAgICAgIHRhYnNCeURvbWFpbi5zZXQoZG9tYWluLCBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGFic0J5RG9tYWluLmdldChkb21haW4pPy5wdXNoKHRhYik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBSZW9yZGVyIHRhYnMgdG8ga2VlcCBkb21haW5zIHRvZ2V0aGVyXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgKGNvbnN0IFtkb21haW4sIGRvbWFpblRhYnNdIG9mIHRhYnNCeURvbWFpbikge1xuICAgICAgY29uc29sZS5sb2coYE9yZ2FuaXppbmcgdGFicyBmb3IgZG9tYWluOiAke2RvbWFpbn1gKTtcbiAgICAgIGZvciAoY29uc3QgdGFiIG9mIGRvbWFpblRhYnMpIHtcbiAgICAgICAgYXdhaXQgYnJvd3Nlci50YWJzLm1vdmUodGFiLmlkISwgeyBpbmRleDogaW5kZXgrKyB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbiB0byBoYW5kbGUgbmV3IHRhYiBjcmVhdGlvblxuICBhc3luYyBmdW5jdGlvbiBoYW5kbGVUYWJDcmVhdGVkKHRhYjogYnJvd3Nlci50YWJzLlRhYikge1xuICAgIGlmICghdGFiLnVybCB8fCAhdGFiLmlkKSByZXR1cm47XG5cbiAgICBjb25zdCBkb21haW4gPSBnZXREb21haW4odGFiLnVybCk7XG4gICAgY29uc3QgZXhpc3RpbmdUYWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiB0YWIudXJsIH0pO1xuXG4gICAgLy8gSWYgdGhlcmUncyBhbHJlYWR5IGEgdGFiIHdpdGggdGhpcyBVUkxcbiAgICBpZiAoZXhpc3RpbmdUYWJzLmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIEZpbmQgdGhlIGZpcnN0IHRhYiB0aGF0IGlzbid0IHRoZSBuZXdseSBjcmVhdGVkIG9uZVxuICAgICAgY29uc3QgZXhpc3RpbmdUYWIgPSBleGlzdGluZ1RhYnMuZmluZCgodCkgPT4gdC5pZCAhPT0gdGFiLmlkKTtcbiAgICAgIGlmIChleGlzdGluZ1RhYj8uaWQpIHtcbiAgICAgICAgLy8gQWN0aXZhdGUgdGhlIGV4aXN0aW5nIHRhYlxuICAgICAgICBhd2FpdCBicm93c2VyLnRhYnMudXBkYXRlKGV4aXN0aW5nVGFiLmlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICAgICAgLy8gQ2xvc2UgdGhlIG5ldyB0YWJcbiAgICAgICAgYXdhaXQgYnJvd3Nlci50YWJzLnJlbW92ZSh0YWIuaWQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgaXQncyBhIG5ldyB1bmlxdWUgdGFiLCBmaW5kIHRhYnMgd2l0aCB0aGUgc2FtZSBkb21haW5cbiAgICBjb25zdCBzYW1lRG9tYWluVGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7fSk7XG4gICAgY29uc3QgbGFzdFNhbWVEb21haW5UYWIgPSBzYW1lRG9tYWluVGFic1xuICAgICAgLmZpbHRlcigodCkgPT4gdC51cmwgJiYgZ2V0RG9tYWluKHQudXJsKSA9PT0gZG9tYWluICYmIHQuaWQgIT09IHRhYi5pZClcbiAgICAgIC5wb3AoKTtcblxuICAgIC8vIElmIHRoZXJlIGFyZSBvdGhlciB0YWJzIHdpdGggdGhlIHNhbWUgZG9tYWluLCBtb3ZlIHRoZSBuZXcgdGFiIG5leHQgdG8gdGhlbVxuICAgIGlmIChsYXN0U2FtZURvbWFpblRhYj8uaW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXdhaXQgYnJvd3Nlci50YWJzLm1vdmUodGFiLmlkLCB7IGluZGV4OiBsYXN0U2FtZURvbWFpblRhYi5pbmRleCArIDEgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gTGlzdGVuIGZvciB0YWIgY3JlYXRpb25cbiAgYnJvd3Nlci50YWJzLm9uQ3JlYXRlZC5hZGRMaXN0ZW5lcihhc3luYyAodGFiKSA9PiB7XG4gICAgLy8gV2FpdCBhIGJpdCBmb3IgdGhlIFVSTCB0byBiZSBzZXRcbiAgICBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHVwZGF0ZWRUYWIgPSBhd2FpdCBicm93c2VyLnRhYnMuZ2V0KHRhYi5pZCEpO1xuICAgICAgYXdhaXQgaGFuZGxlVGFiQ3JlYXRlZCh1cGRhdGVkVGFiKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICAvLyBMaXN0ZW4gZm9yIHRhYiB1cGRhdGVzIChVUkwgY2hhbmdlcylcbiAgYnJvd3Nlci50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcihhc3luYyAodGFiSWQsIGNoYW5nZUluZm8sIHRhYikgPT4ge1xuICAgIGlmIChjaGFuZ2VJbmZvLnVybCkge1xuICAgICAgYXdhaXQgaGFuZGxlVGFiQ3JlYXRlZCh0YWIpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gSW5pdGlhbCBvcmdhbml6YXRpb25cbiAgb3JnYW5pemVUYWJzQnlEb21haW4oKTtcblxuICAvLyBSZS1vcmdhbml6ZSBwZXJpb2RpY2FsbHkgKGV2ZXJ5IDUgbWludXRlcylcbiAgc2V0SW50ZXJ2YWwob3JnYW5pemVUYWJzQnlEb21haW4sIDUgKiA2MCAqIDEwMDApO1xuXG4gIC8vIEZ1bmN0aW9uIHRvIGdldCB1cGRhdGVkIHRhYnNcbiAgYXN5bmMgZnVuY3Rpb24gZ2V0VXBkYXRlZFRhYnMoKTogUHJvbWlzZTxUYWJbXT4ge1xuICAgIGNvbnNvbGUubG9nKCdHZXR0aW5nIHVwZGF0ZWQgdGFicy4uLicpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHt9KTtcbiAgICAgIGNvbnNvbGUubG9nKCdGb3VuZCB0YWJzOicsIHRhYnMpO1xuICAgICAgXG4gICAgICAvLyBHZXQgcHJvY2VzcyBpbmZvIGZvciB0YWJzXG4gICAgICBjb25zdCB0YWJJZHMgPSB0YWJzLm1hcCh0YWIgPT4gdGFiLmlkKS5maWx0ZXIoKGlkKTogaWQgaXMgbnVtYmVyID0+IGlkICE9PSB1bmRlZmluZWQpO1xuICAgICAgY29uc3QgcHJvY2Vzc0luZm8gPSBhd2FpdCBicm93c2VyLnByb2Nlc3Nlcz8uZ2V0UHJvY2Vzc0luZm8odGFiSWRzKSB8fCBbXTtcbiAgICAgIGNvbnNvbGUubG9nKCdQcm9jZXNzIGluZm86JywgcHJvY2Vzc0luZm8pO1xuXG4gICAgICAvLyBHZXQgYm9va21hcmtzXG4gICAgICBjb25zdCBib29rbWFya3MgPSBhd2FpdCBicm93c2VyLmJvb2ttYXJrcy5zZWFyY2goe30pO1xuICAgICAgY29uc3QgYm9va21hcmtlZFVybHMgPSBuZXcgU2V0KGJvb2ttYXJrcy5tYXAoYiA9PiBiLnVybCkpO1xuICAgICAgY29uc29sZS5sb2coJ0Jvb2ttYXJrZWQgVVJMczonLCBib29rbWFya2VkVXJscyk7XG5cbiAgICAgIC8vIE1hcCB0YWJzIHRvIG91ciBmb3JtYXRcbiAgICAgIGNvbnN0IG1hcHBlZFRhYnMgPSB0YWJzLm1hcCgodGFiOiBUYWJzLlRhYik6IFRhYiA9PiB7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBwcm9jZXNzSW5mby5maW5kKChwOiBQcm9jZXNzSW5mbykgPT4gcC5pZCA9PT0gdGFiLmlkKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi50YWIsXG4gICAgICAgICAgcHJvY2Vzc0lkOiB0YWIuaWQsXG4gICAgICAgICAgYm9va21hcmtlZDogdGFiLnVybCA/IGJvb2ttYXJrZWRVcmxzLmhhcyh0YWIudXJsKSA6IGZhbHNlLFxuICAgICAgICAgIG1lbW9yeUluZm86IHByb2Nlc3MgPyB7XG4gICAgICAgICAgICBwcml2YXRlTWVtb3J5OiBwcm9jZXNzLnByaXZhdGVNZW1vcnksXG4gICAgICAgICAgICBqc01lbW9yeVVzZWQ6IHByb2Nlc3MuanNNZW1vcnlVc2VkXG4gICAgICAgICAgfSA6IHVuZGVmaW5lZFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdNYXBwZWQgdGFiczonLCBtYXBwZWRUYWJzKTtcbiAgICAgIHJldHVybiBtYXBwZWRUYWJzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHVwZGF0ZWQgdGFiczonLCBlcnJvcik7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QWxsQm9va21hcmtVcmxzKG5vZGVzOiBicm93c2VyLmJvb2ttYXJrcy5Cb29rbWFya1RyZWVOb2RlW10pOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgdXJsczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgIGlmIChub2RlLnVybCkge1xuICAgICAgICB1cmxzLnB1c2gobm9kZS51cmwpO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgdXJscy5wdXNoKC4uLmdldEFsbEJvb2ttYXJrVXJscyhub2RlLmNoaWxkcmVuKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1cmxzO1xuICB9XG5cbiAgLy8gRnVuY3Rpb24gdG8gbm90aWZ5IGFsbCBjb250ZW50IHNjcmlwdHMgYWJvdXQgdGFiIHVwZGF0ZXNcbiAgYXN5bmMgZnVuY3Rpb24gbm90aWZ5VGFic1VwZGF0ZWQodGFiczogVGFiW10pIHtcbiAgICBjb25zb2xlLmxvZygnTm90aWZ5aW5nIGFib3V0IHRhYiB1cGRhdGVzOicsIHRhYnMpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB3aW5kb3dzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHt9KTtcbiAgICAgIGZvciAoY29uc3Qgd2luZG93IG9mIHdpbmRvd3MpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5pZCkge1xuICAgICAgICAgIGF3YWl0IGJyb3dzZXIudGFicy5zZW5kTWVzc2FnZSh3aW5kb3cuaWQsIHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3RhYnNVcGRhdGVkJyxcbiAgICAgICAgICAgIHRhYnNcbiAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIGZvciB0YWJzIHRoYXQgZG9uJ3QgaGF2ZSB0aGUgY29udGVudCBzY3JpcHRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBub3RpZnlpbmcgYWJvdXQgdGFiIHVwZGF0ZXM6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8vIExpc3RlbiBmb3IgdGFiIGV2ZW50c1xuICBicm93c2VyLnRhYnMub25DcmVhdGVkLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnVGFiIGNyZWF0ZWQnKTtcbiAgICBjb25zdCB0YWJzID0gYXdhaXQgZ2V0VXBkYXRlZFRhYnMoKTtcbiAgICBhd2FpdCBub3RpZnlUYWJzVXBkYXRlZCh0YWJzKTtcbiAgfSk7XG4gIGJyb3dzZXIudGFicy5vblJlbW92ZWQuYWRkTGlzdGVuZXIoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdUYWIgcmVtb3ZlZCcpO1xuICAgIGNvbnN0IHRhYnMgPSBhd2FpdCBnZXRVcGRhdGVkVGFicygpO1xuICAgIGF3YWl0IG5vdGlmeVRhYnNVcGRhdGVkKHRhYnMpO1xuICB9KTtcbiAgYnJvd3Nlci50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcihhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1RhYiB1cGRhdGVkJyk7XG4gICAgY29uc3QgdGFicyA9IGF3YWl0IGdldFVwZGF0ZWRUYWJzKCk7XG4gICAgYXdhaXQgbm90aWZ5VGFic1VwZGF0ZWQodGFicyk7XG4gIH0pO1xuICBicm93c2VyLnRhYnMub25Nb3ZlZC5hZGRMaXN0ZW5lcigoKSA9PiBub3RpZnlUYWJzVXBkYXRlZCh0YWJzKSk7XG4gIGJyb3dzZXIudGFicy5vbkFjdGl2YXRlZC5hZGRMaXN0ZW5lcigoKSA9PiBub3RpZnlUYWJzVXBkYXRlZCh0YWJzKSk7XG4gIGJyb3dzZXIuYm9va21hcmtzLm9uQ3JlYXRlZC5hZGRMaXN0ZW5lcihhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ0Jvb2ttYXJrIGNyZWF0ZWQnKTtcbiAgICBjb25zdCB0YWJzID0gYXdhaXQgZ2V0VXBkYXRlZFRhYnMoKTtcbiAgICBhd2FpdCBub3RpZnlUYWJzVXBkYXRlZCh0YWJzKTtcbiAgfSk7XG4gIGJyb3dzZXIuYm9va21hcmtzLm9uUmVtb3ZlZC5hZGRMaXN0ZW5lcihhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ0Jvb2ttYXJrIHJlbW92ZWQnKTtcbiAgICBjb25zdCB0YWJzID0gYXdhaXQgZ2V0VXBkYXRlZFRhYnMoKTtcbiAgICBhd2FpdCBub3RpZnlUYWJzVXBkYXRlZCh0YWJzKTtcbiAgfSk7XG4gIGJyb3dzZXIuYm9va21hcmtzLm9uQ2hhbmdlZC5hZGRMaXN0ZW5lcigoKSA9PiBub3RpZnlUYWJzVXBkYXRlZCh0YWJzKSk7XG5cbiAgLy8gTGlzdGVuIGZvciBtZXNzYWdlcyBmcm9tIGNvbnRlbnQgc2NyaXB0c1xuICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGFzeW5jIChtZXNzYWdlOiBNZXNzYWdlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1JlY2VpdmVkIG1lc3NhZ2U6JywgbWVzc2FnZSk7XG4gICAgdHJ5IHtcbiAgICAgIHN3aXRjaCAobWVzc2FnZS5hY3Rpb24pIHtcbiAgICAgICAgY2FzZSAnZ2V0VGFicyc6XG4gICAgICAgICAgY29uc3QgdGFicyA9IGF3YWl0IGdldFVwZGF0ZWRUYWJzKCk7XG4gICAgICAgICAgcmV0dXJuIHRhYnM7XG4gICAgICAgIGNhc2UgJ29wZW5EaWFsb2cnOlxuICAgICAgICAgIGF3YWl0IG9wZW5EaWFsb2coKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgaGFuZGxpbmcgbWVzc2FnZTonLCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9KTtcblxuICAvLyBGb3IgZGVidWdnaW5nOiBsb2cgd2hlbiBleHRlbnNpb24gaXMgaW5zdGFsbGVkIG9yIHVwZGF0ZWRcbiAgYnJvd3Nlci5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKChkZXRhaWxzKSA9PiB7XG4gICAgY29uc29sZS5sb2coXCJFeHRlbnNpb24gaW5zdGFsbGVkL3VwZGF0ZWQ6XCIsIGRldGFpbHMucmVhc29uKTtcbiAgfSk7XG5cbiAgLy8gRnVuY3Rpb24gdG8gb3BlbiB0aGUgZGlhbG9nXG4gIGFzeW5jIGZ1bmN0aW9uIG9wZW5EaWFsb2coKSB7XG4gICAgY29uc29sZS5sb2coJ09wZW5pbmcgZGlhbG9nLi4uJyk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIENyZWF0ZSBhIG5ldyB0YWIgd2l0aCBvdXIgZGlhbG9nXG4gICAgICBjb25zdCB0YWIgPSBhd2FpdCBicm93c2VyLnRhYnMuY3JlYXRlKHtcbiAgICAgICAgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKCd0YWJzLW1vZGFsLmh0bWwnKSxcbiAgICAgICAgYWN0aXZlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCdEaWFsb2cgb3BlbmVkIGluIHRhYjonLCB0YWIpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBvcGVuaW5nIGRpYWxvZzonLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLy8gTGlzdGVuIGZvciBrZXlib2FyZCBzaG9ydGN1dHNcbiAgYnJvd3Nlci5jb21tYW5kcy5vbkNvbW1hbmQuYWRkTGlzdGVuZXIoYXN5bmMgKGNvbW1hbmQpID0+IHtcbiAgICBjb25zb2xlLmxvZygnQ29tbWFuZCByZWNlaXZlZDonLCBjb21tYW5kKTtcbiAgICBpZiAoY29tbWFuZCA9PT0gJ29wZW4tZGlhbG9nJykge1xuICAgICAgYXdhaXQgb3BlbkRpYWxvZygpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gSW5pdGlhbCBzZXR1cFxuICBjb25zb2xlLmxvZygnQmFja2dyb3VuZCBzY3JpcHQgc3RhcnRpbmcuLi4nKTtcbn0pO1xuIl0sIm5hbWVzIjpbInRhYnMiLCJfYSJdLCJtYXBwaW5ncyI6Ijs7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFLO0FBQ2xFLFdBQU87QUFBQSxFQUNUO0FDRkEsTUFBSSxnQkFBZ0IsTUFBTTtBQUFBLElBQ3hCLFlBQVksY0FBYztBQUN4QixVQUFJLGlCQUFpQixjQUFjO0FBQ2pDLGFBQUssWUFBWTtBQUNqQixhQUFLLGtCQUFrQixDQUFDLEdBQUcsY0FBYyxTQUFTO0FBQ2xELGFBQUssZ0JBQWdCO0FBQ3JCLGFBQUssZ0JBQWdCO0FBQUEsTUFDM0IsT0FBVztBQUNMLGNBQU0sU0FBUyx1QkFBdUIsS0FBSyxZQUFZO0FBQ3ZELFlBQUksVUFBVTtBQUNaLGdCQUFNLElBQUksb0JBQW9CLGNBQWMsa0JBQWtCO0FBQ2hFLGNBQU0sQ0FBQyxHQUFHLFVBQVUsVUFBVSxRQUFRLElBQUk7QUFDMUMseUJBQWlCLGNBQWMsUUFBUTtBQUN2Qyx5QkFBaUIsY0FBYyxRQUFRO0FBRXZDLGFBQUssa0JBQWtCLGFBQWEsTUFBTSxDQUFDLFFBQVEsT0FBTyxJQUFJLENBQUMsUUFBUTtBQUN2RSxhQUFLLGdCQUFnQjtBQUNyQixhQUFLLGdCQUFnQjtBQUFBLE1BQzNCO0FBQUEsSUFDQTtBQUFBLElBQ0UsU0FBUyxLQUFLO0FBQ1osVUFBSSxLQUFLO0FBQ1AsZUFBTztBQUNULFlBQU0sSUFBSSxPQUFPLFFBQVEsV0FBVyxJQUFJLElBQUksR0FBRyxJQUFJLGVBQWUsV0FBVyxJQUFJLElBQUksSUFBSSxJQUFJLElBQUk7QUFDakcsYUFB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
