import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import dotenv from "dotenv";

dotenv.config();

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

// Search Google for a keyword and return the rank of the website
export async function rankTracker(keyword, targetDomain) {
  let browser;
  let session;
  try {
    // 1. Initialize Browserbase session & connect Playwright
    session = await bb.sessions.create({ browserSettings: { blockAds: true } });
    browser = await chromium.connectOverCDP(session.connectUrl);
    const page = browser.contexts()[0].pages()[0];

    page.setDefaultNavigationTimeout(30000);

    // 2. Initial Google visit & consent handling
    // Google keeps background connections open, so `networkidle` can time out
    // even after search results have rendered. DOM content is enough for parsing.
    await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });
    try {
      const btn = await page.$('button[id="L2AGLb"], form[action*="consent"] button');
      if (btn) {
        await btn.click();
        await page.waitForTimeout(1500);
      }
    } catch {
      // no consent dialog present, ignore
    }

    let found = null;
    const allResults = [];

    const cleanTarget = targetDomain.replace("www.", "").toLowerCase();

    // 3. Search loop: iterate through up to 5 pages of Google results
    for (let gPage = 0; gPage < 5; gPage++) {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${gPage * 10}&num=10&hl=en&gl=us`,
        { waitUntil: "domcontentloaded" }
      );

      // 4. Page extraction: retry up to 3 times if no results are found
      let pageResults = [];
      for (let retry = 0; retry < 3; retry++) {
        await page.waitForSelector("h3", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1500);

        pageResults = await page.evaluate(() =>
          Array.from(document.querySelectorAll("h3"))
            .map((h3) => {
              let a = h3.closest("a");
              if (!a) {
                let p = h3.parentElement;
                for (let j = 0; j < 5 && p; j++, p = p.parentElement) {
                  if (p.tagName.toLowerCase() === "a") {
                    a = p;
                    break;
                  }
                }
                if (p) {
                  const sub = p.querySelector("a[href]");
                  if (sub && sub.contains(h3)) {
                    a = sub;
                  }
                }
              }

              if (!a || !a.href.startsWith("http")) return null;

              // Browserbase currently receives Google result links as
              // google.com/goto redirects. The actual destination domain is
              // displayed in the result's <cite>, so use that when the link
              // itself is a Google redirect.
              let resultUrl = a.href;
              let resultDomain = "";
              if (!a.href.includes("google.com")) {
                resultDomain = new URL(a.href).hostname.replace("www.", "");
              } else {
                let container = h3.parentElement;
                let visibleUrl = "";
                for (let j = 0; j < 8 && container; j++, container = container.parentElement) {
                  const cite = container.querySelector("cite");
                  if (cite?.textContent) {
                    visibleUrl = cite.textContent.trim();
                    break;
                  }
                }

                const domainMatch = visibleUrl.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
                if (!domainMatch) return null;
                resultDomain = domainMatch[1].toLowerCase();
                resultUrl = `https://${resultDomain}`;
              }

              let s = "";
              let c = a.parentElement;
              for (let j = 0; j < 6 && c; j++, c = c.parentElement) {
                const txt = c.innerText || "";
                if (txt.length > h3.innerText.length + 50) {
                  s = (
                    txt
                      .split("\n")
                      .find((l) => l.length > 30 && !l.includes(h3.innerText.substring(0, 20))) || ""
                  )
                    .trim()
                    .substring(0, 300);
                  if (s) break;
                }
              }

              return {
                url: resultUrl,
                domain: resultDomain,
                title: h3.innerText.trim(),
                snippet: s,
              };
            })
            .filter(Boolean)
        );

        if (pageResults.length > 0) break;
      }

      // 5. Result Synthesis: Update global results and check for target domain presence
      for (const r of pageResults) {
        r.position = allResults.length + 1;
        allResults.push(r);
        if (!found && (r.domain.toLowerCase().includes(cleanTarget) || cleanTarget.includes(r.domain.toLowerCase()))) {
          found = { ...r, page: gPage + 1 };
        }
      }

      if (found) break;
      await page.waitForTimeout(2000 + Math.random() * 2000);
    }

    // 6. Extract competitors
    const competitors = allResults
      .filter(
        (r) =>
          !r.domain.toLowerCase().includes(cleanTarget) &&
          !cleanTarget.includes(r.domain.toLowerCase())
      )
      .slice(0, 10);

    return {
      success: true,
      data: {
        keyword,
        targetDomain,
        position: found?.position || null,
        page: found?.page || null,
        title: found?.title || null,
        snippet: found?.snippet || null,
        competitors,
        totalResultsScanned: allResults.length,
      },
    };
  } catch (err) {
    console.error("Rank Check Error", err.message);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    // Browserbase sessions remain billable/concurrent until explicitly released.
    // Releasing here prevents a few failed checks from exhausting the session limit.
    if (browser) await browser.close().catch(() => {});
    if (session) {
      await bb.sessions
        .update(session.id, { status: "REQUEST_RELEASE" })
        .catch((releaseError) => console.error("Browserbase session release error", releaseError.message));
    }
  }
}
