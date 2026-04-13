/**
 * Portal Scanner - Full Playwright Implementation
 */
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { join } from 'path';
import {
  loadPortals,
} from '../config/loader.js';
import {
  getNextApplicationNumber,
  createApplication,
  initializeDatabase,
} from '../database/index.js';
import { evaluateOffer, EvaluationInput } from '../evaluation/evaluator.js';
import { getProjectRoot } from '../utils/path.js';
import { logAudit } from '../utils/logger.js';

const PROJECT_ROOT = getProjectRoot();

interface TrackedCompany {
  name: string;
  careers_url: string;
  enabled: boolean;
  selector: string;
}

interface SearchQuery {
  name: string;
  query: string;
  enabled: boolean;
}

interface TitleFilter {
  positive: string[];
  negative: string[];
  seniority_boost: string[];
}

function passesTitleFilter(title: string, filter: TitleFilter): boolean {
  const lower = title.toLowerCase();
  const hasPositive = filter.positive.some(kw => lower.includes(kw.toLowerCase()));
  const hasNegative = filter.negative.some(kw => lower.includes(kw.toLowerCase()));
  return hasPositive && !hasNegative;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function runScan(params: { company?: string; maxOffers?: number }): Promise<{ found: number; new: number }> {
  const portals = loadPortals() as any;
  const companies: TrackedCompany[] = portals.tracked_companies || [];
  const searchQueries: SearchQuery[] = portals.search_queries || [];
  const titleFilter: TitleFilter = portals.title_filter || { positive: [], negative: [], seniority_boost: [] };

  let enabledCompanies = companies.filter(c => c.enabled);
  let enabledQueries = searchQueries.filter(q => q.enabled);
  
  // If --company flag is used, filter both lists by name match
  if (params.company) {
    const companyLower = params.company.toLowerCase();
    enabledCompanies = enabledCompanies.filter(c => c.name.toLowerCase().includes(companyLower));
    enabledQueries = enabledQueries.filter(q => q.name.toLowerCase().includes(companyLower));
  }
  
  const maxOffers = params.maxOffers || 50;
  let found = 0;
  let inserted = 0;

  console.log(`🔎 Starting scan of ${enabledCompanies.length} direct company(ies) + ${enabledQueries.length} search query(ies)...`);

  const browser = await chromium.launch({ headless: true });
  try {
    // Scan direct company career pages
    for (const company of enabledCompanies) {
      console.log(`\n📍 ${company.name} — ${company.careers_url}`);
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(company.careers_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector(company.selector, { timeout: 15000 });

        const jobElements = await page.$$(company.selector);
        console.log(`  Found ${jobElements.length} raw job element(s).`);

        for (const el of jobElements) {
          if (found >= maxOffers) break;

          // Extract title and link
          const title = await el.evaluate(node => node.textContent?.trim() || '');
          const link = await el.evaluate(node => {
            const a = node.querySelector('a');
            return a ? a.href : null;
          });

          if (!title || !link) continue;

          // Apply title filter
          if (!passesTitleFilter(title, titleFilter)) {
            continue;
          }

          found++;
          console.log(`  [${found}] ${title}`);
          console.log(`      URL: ${link}`);

          // Evaluate the job
          try {
            const evalInput: EvaluationInput = {
              source: 'url',
              content: link,
              generatePdf: false,
              track: false,
            };
            const evalResult = await evaluateOffer(evalInput);
            console.log(`      Score: ${evalResult.score}/5`);

            // Insert into tracker using the number from evaluation (or allocate fresh)
            const reportDate = new Date().toISOString().split('T')[0];
            const number = evalResult.trackerEntry?.number || getNextApplicationNumber();

            const companySlug = slugify(company.name);
            const roleSlug = slugify(title);

            createApplication({
              number,
              date: reportDate,
              company: company.name,
              companySlug,
              role: title,
              roleSlug,
              score: evalResult.score,
              status: 'evaluated',
              reportPath: evalResult.reportPath,
            });
            inserted++;
            console.log(`      ✅ Tracked as #${number}`);
          } catch (err: any) {
            console.error(`      ⚠️  Failed to evaluate: ${err.message}`);
            logAudit('scan_evaluation_error', { url: link, error: err.message });
          }
        }
      } catch (err: any) {
        console.error(`❌ Error scanning ${company.name}: ${err.message}`);
        logAudit('scan_company_error', { company: company.name, error: err.message });
      } finally {
        await context.close();
      }
    }

    // Scan search queries (Bing)
    for (const query of enabledQueries) {
      console.log(`\n🔍 ${query.name} — search query`);
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Use Bing search
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query.query)}`;
        await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Try Bing result selectors
        const selectors = ['li.b_algo', 'li[data-id="result"]', 'div.b_title'];
        let resultElements: any[] = [];
        for (const sel of selectors) {
          try {
            const els = await page.$$(sel);
            if (els.length > 0) {
              resultElements = els;
              console.log(`  Found ${els.length} results using selector: ${sel}`);
              break;
            }
          } catch {}
        }

        if (resultElements.length === 0) {
          console.log(`  ⚠️ No results found (DOM may have changed)`);
          continue;
        }

        for (const el of resultElements) {
          if (found >= maxOffers) break;

          // Extract title and link
          const title = await el.evaluate((node: any) => {
            const titleEl = node.querySelector('h2 a, a[title], .b_title');
            return titleEl ? titleEl.textContent?.trim() || '' : '';
          });
          
          const rawHref = await el.evaluate((node: any) => {
            const a = node.querySelector('h2 a, a[title]');
            return a ? a.href || '' : '';
          });
          
          if (!title || !rawHref) continue;

          // Bing links are direct
          let link = rawHref;
          // Clean any tracking params
          try {
            const url = new URL(link);
            // Keep only path + host
            link = url.origin + url.pathname + url.search;
          } catch {}

          if (!link.startsWith('http')) {
            continue;
          }

          // Apply title filter (same as direct scan)
          if (!passesTitleFilter(title, titleFilter)) {
            continue;
          }

          found++;
          console.log(`  [${found}] ${title}`);
          console.log(`      URL: ${link}`);

          // Evaluate the job
          try {
            const evalInput: EvaluationInput = {
              source: 'url',
              content: link,
              generatePdf: false,
              track: false,
            };
            const evalResult = await evaluateOffer(evalInput);
            console.log(`      Score: ${evalResult.score}/5`);

            const reportDate = new Date().toISOString().split('T')[0];
            const number = evalResult.trackerEntry?.number || getNextApplicationNumber();

            const companyName = query.name.split(' — ')[0]; // Extract company from query name
            const companySlug = slugify(companyName);
            const roleSlug = slugify(title);

            createApplication({
              number,
              date: reportDate,
              company: companyName,
              companySlug,
              role: title,
              roleSlug,
              score: evalResult.score,
              status: 'evaluated',
              reportPath: evalResult.reportPath,
            });
            inserted++;
            console.log(`      ✅ Tracked as #${number}`);
          } catch (err: any) {
            console.error(`      ⚠️  Failed to evaluate: ${err.message}`);
            logAudit('scan_evaluation_error', { url: link, error: err.message });
          }
        }
      } catch (err: any) {
        console.error(`❌ Error searching ${query.name}: ${err.message}`);
        logAudit('scan_query_error', { query: query.name, error: err.message });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n📊 Scan complete: ${found} found, ${inserted} added to tracker.`);
  logAudit('scan_complete', { found, inserted });
  return { found, new: inserted };
}
