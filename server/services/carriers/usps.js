const BaseCarrierScraper = require('./base');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = null;
}

// Common Chrome paths on Windows
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findChrome() {
  const fs = require('fs');
  for (const chromePath of CHROME_PATHS) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return null;
}

class USPSScraper extends BaseCarrierScraper {
  constructor() {
    super('usps');
  }

  async track(url, trackingNumber) {
    try {
      if (!trackingNumber) {
        const match = url.match(/\b(9[0-9]{15,21}|[A-Z]{2}\d{9}US)\b/i);
        trackingNumber = match ? match[0] : null;
      }

      if (!trackingNumber) {
        return this.formatResult('Unable to extract tracking number', []);
      }

      console.log(`[USPS] Tracking ${trackingNumber}`);

      // Try browser-based scraping with retries
      if (puppeteer) {
        const chromePath = findChrome();
        if (chromePath) {
          const maxRetries = 3;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`[USPS] Attempt ${attempt}/${maxRetries} - Browser scraping...`);
              const result = await this.fetchWithBrowser(trackingNumber, chromePath);

              if (result && result.status !== 'Unknown') {
                console.log(`[USPS] ✓ Success on attempt ${attempt}: ${result.status} (${result.events?.length || 0} events)`);
                return result;
              }

              console.log(`[USPS] ✗ Attempt ${attempt} returned Unknown`);

              if (attempt < maxRetries) {
                const waitTime = attempt * 2000; // 2s, 4s between retries
                console.log(`[USPS] Waiting ${waitTime/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            } catch (browserError) {
              console.log(`[USPS] ✗ Attempt ${attempt} failed: ${browserError.message}`);
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
          console.log('[USPS] All browser attempts failed, trying HTML fallback');
        }
      }

      // Fallback to basic HTML request
      console.log('[USPS] Falling back to HTML parsing');
      const trackUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      const html = await this.fetchPage(trackUrl);
      const result = this.parseHTML_Page(html, trackingNumber);
      console.log(`[USPS] HTML result: ${result.status}`);
      return result;
    } catch (error) {
      console.error(`[USPS] Fatal error: ${error.message}`);
      return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
    }
  }

  async fetchWithBrowser(trackingNumber, chromePath) {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080'
      ]
    });

    try {
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Randomize user agent
      await page.setUserAgent(this.getRandomUserAgent());

      // Set extra headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      const trackUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      await page.goto(trackUrl, { waitUntil: 'networkidle2', timeout: 45000 });

      // Wait for tracking content to load with multiple selector options
      const selectors = [
        '.delivery_status',
        '.tb-status',
        '.tracking-progress-bar-status',
        '.track-bar-container',
        '#tracked-numbers',
        '.product-summary'
      ];

      await page.waitForSelector(selectors.join(', '), {
        timeout: 15000
      }).catch(() => {});

      // Give extra time for dynamic content to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await page.evaluate(() => {
        let status = 'Unknown';
        let expectedDelivery = '';
        const events = [];
        const debug = {};

        // Try multiple status selectors
        const statusSelectors = [
          '.delivery_status h2',
          '.tb-status',
          'h2.tb-status-detail',
          '.banner-header h2',
          '.delivery-status-header',
          '.status_feed .status',
          '.tracking-progress-bar-status',
          'h2[class*="status"]',
          '.product-summary h2'
        ];

        for (const selector of statusSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            if (text && text.length < 200 && text.length > 2) {
              status = text.split('\n')[0].trim();
              debug.foundSelector = selector;
              break;
            }
          }
        }

        // Get expected delivery
        const expectedEl = document.querySelector('.expected_delivery, .tb-expected-delivery, .delivery-date');
        if (expectedEl) {
          expectedDelivery = expectedEl.textContent.trim();
        }

        // Get tracking history - try multiple selectors
        const historySelectors = [
          '.tb-step',
          '.track-bar-progress-step',
          '.tracking-step',
          '.status_feed li',
          '.product-status-history li'
        ];

        for (const selector of historySelectors) {
          const historyItems = document.querySelectorAll(selector);
          if (historyItems.length > 0) {
            debug.historySelector = selector;
            debug.historyCount = historyItems.length;
            historyItems.forEach(item => {
              const eventStatus = item.querySelector('.tb-status-detail, .status-detail, .status, strong')?.textContent?.trim();
              const location = item.querySelector('.tb-location, .location, .city-state')?.textContent?.trim();
              const date = item.querySelector('.tb-date, .date, time')?.textContent?.trim();
              const time = item.querySelector('.tb-time, .time')?.textContent?.trim();

              if (eventStatus) {
                events.push({
                  status: eventStatus,
                  location: location || '',
                  timestamp: date ? `${date} ${time || ''}`.trim() : null,
                  details: eventStatus
                });
              }
            });
            if (events.length > 0) break;
          }
        }

        // If no status found, try body text analysis
        if (status === 'Unknown') {
          const bodyText = document.body.innerText.toLowerCase();
          debug.bodyLength = bodyText.length;

          if (bodyText.includes('delivered')) status = 'Delivered';
          else if (bodyText.includes('out for delivery')) status = 'Out for Delivery';
          else if (bodyText.includes('in transit')) status = 'In Transit';
          else if (bodyText.includes('arrived at')) status = 'Arrived at Facility';
          else if (bodyText.includes('accepted at')) status = 'Accepted';
          else if (bodyText.includes('shipping label created')) status = 'Label Created';
          else if (bodyText.includes('picked up')) status = 'Picked Up';

          if (status !== 'Unknown') debug.foundVia = 'bodyText';
        }

        // Check if page has an error message
        const errorEl = document.querySelector('.error-message, .alert-error, .no-results');
        if (errorEl) {
          debug.errorMessage = errorEl.textContent.trim().substring(0, 100);
        }

        debug.pageTitle = document.title;

        return { status, expectedDelivery, events, debug };
      });

      // Log debug info if status is Unknown
      if (result.status === 'Unknown') {
        console.log('[USPS] Debug info:', JSON.stringify(result.debug));
      }

      return this.formatResult(result.status, result.events, {
        trackingNumber,
        expectedDelivery: result.expectedDelivery
      });
    } finally {
      await browser.close();
    }
  }

  parseHTML_Page(html, trackingNumber) {
    try {
      const $ = this.parseHTML(html);
      let status = 'Unknown';
      const events = [];

      // Try to find status in the HTML
      const statusSelectors = [
        '.delivery_status h2',
        '.tb-status',
        '.tb-status-detail',
        'h2[class*="status"]'
      ];

      for (const selector of statusSelectors) {
        const el = $(selector).first();
        if (el.length) {
          const text = el.text().trim();
          if (text && text.length < 200) {
            status = text.split('\n')[0].trim();
            break;
          }
        }
      }

      // Extract from body text as fallback
      if (status === 'Unknown') {
        const bodyText = $('body').text();
        if (/delivered/i.test(bodyText)) status = 'Delivered';
        else if (/out for delivery/i.test(bodyText)) status = 'Out for Delivery';
        else if (/in transit/i.test(bodyText)) status = 'In Transit';
        else if (/arrived at/i.test(bodyText)) status = 'Arrived at Facility';
      }

      return this.formatResult(status, events, { trackingNumber });
    } catch (error) {
      return this.formatResult(`Parse error: ${error.message}`, []);
    }
  }
}

module.exports = USPSScraper;
