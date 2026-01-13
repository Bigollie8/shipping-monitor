const BaseCarrierScraper = require('./base');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = null;
}

// Common Chrome/Chromium paths
const CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

function findChrome() {
  const fs = require('fs');
  for (const chromePath of CHROME_PATHS) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return null;
}

class UPSScraper extends BaseCarrierScraper {
  constructor() {
    super('ups');
  }

  async track(url, trackingNumber) {
    try {
      if (!trackingNumber) {
        const match = url.match(/1Z[A-Z0-9]{16}/i);
        trackingNumber = match ? match[0] : null;
      }

      if (!trackingNumber) {
        return this.formatResult('Unable to extract tracking number', []);
      }

      console.log(`[UPS] Tracking ${trackingNumber}`);

      // Try browser-based scraping with retries
      if (puppeteer) {
        const chromePath = findChrome();
        if (chromePath) {
          const maxRetries = 3;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`[UPS] Attempt ${attempt}/${maxRetries} - Browser scraping...`);
              const result = await this.fetchWithBrowser(trackingNumber, chromePath);

              if (result && result.status !== 'Unknown' && !result.status.includes('Error')) {
                console.log(`[UPS] ✓ Success on attempt ${attempt}: ${result.status} (${result.events?.length || 0} events)`);
                return result;
              }

              console.log(`[UPS] ✗ Attempt ${attempt} returned: ${result?.status}`);

              if (attempt < maxRetries) {
                const waitTime = attempt * 2000;
                console.log(`[UPS] Waiting ${waitTime/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            } catch (browserError) {
              console.log(`[UPS] ✗ Attempt ${attempt} failed: ${browserError.message}`);
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
          console.log('[UPS] All browser attempts failed');
        } else {
          console.log('[UPS] No Chrome/Chromium found');
        }
      } else {
        console.log('[UPS] Puppeteer not available');
      }

      return this.formatResult('Unable to fetch tracking data - UPS requires browser', []);
    } catch (error) {
      console.error(`[UPS] Fatal error: ${error.message}`);
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
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    try {
      const page = await browser.newPage();

      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      // Remove webdriver detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
      });

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      });

      const trackUrl = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
      console.log(`[UPS] Navigating to ${trackUrl}`);

      // Navigate and wait for network to be mostly idle
      await page.goto(trackUrl, { waitUntil: 'networkidle0', timeout: 60000 });

      // Wait for the app to initialize - look for React root or tracking content
      console.log('[UPS] Waiting for tracking content to load...');

      // Wait for any of these selectors that indicate tracking data loaded
      const contentSelectors = [
        '#stApp_trackingNumber',
        '.st_App-statusHeader',
        '[class*="tracking"]',
        '[class*="shipment"]',
        '[class*="delivery"]',
        '.ups-card'
      ];

      await page.waitForSelector(contentSelectors.join(', '), {
        timeout: 20000
      }).catch(() => console.log('[UPS] Primary selectors not found, continuing...'));

      // Wait additional time for React to render
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Check if we need to wait more by checking body length
      let bodyLength = await page.evaluate(() => document.body.innerText.length);
      console.log(`[UPS] Initial body length: ${bodyLength}`);

      // If body is too small, wait more
      if (bodyLength < 5000) {
        console.log('[UPS] Page still loading, waiting longer...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        bodyLength = await page.evaluate(() => document.body.innerText.length);
        console.log(`[UPS] Body length after extra wait: ${bodyLength}`);
      }

      const result = await page.evaluate(() => {
        let status = 'Unknown';
        let expectedDelivery = '';
        const events = [];
        const debug = {};

        // Status selectors for UPS
        const statusSelectors = [
          '.st_Delivery-status .ups-heading',
          '[data-test="shipment-status"]',
          '.st_App-header .ups-heading',
          '.st_DeliveryTimeModule h2',
          '.st_DeliveryTimeModule .ups-txt_size-xl',
          '#st_App_TrackingSummary .ups-heading',
          '.ups-heading--primary',
          'h1.ups-heading',
          '.st_App-statusHeader h1',
          '.st_App-status'
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

        // Get expected delivery date
        const expectedSelectors = [
          '.st_DeliveryTimeModule .ups-txt_size-xl',
          '.st_DeliveryTimeModule time',
          '[data-test="scheduled-delivery"]',
          '.st_DeliveryDateContent'
        ];

        for (const selector of expectedSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            expectedDelivery = el.textContent.trim();
            break;
          }
        }

        // Get tracking history/events
        const historySelectors = [
          '.st_Activity-list li',
          '.st_ProgressBarStep',
          '[data-test="shipment-progress-step"]',
          '.st_App-activityItem'
        ];

        for (const selector of historySelectors) {
          const historyItems = document.querySelectorAll(selector);
          if (historyItems.length > 0) {
            debug.historySelector = selector;
            debug.historyCount = historyItems.length;
            historyItems.forEach(item => {
              const eventStatus = item.querySelector('.st_Activity-status, .ups-txt--bold, strong')?.textContent?.trim();
              const location = item.querySelector('.st_Activity-location, .ups-txt--secondary')?.textContent?.trim();
              const datetime = item.querySelector('.st_Activity-date, time')?.textContent?.trim();

              if (eventStatus) {
                events.push({
                  status: eventStatus,
                  location: location || '',
                  timestamp: datetime || null,
                  details: eventStatus
                });
              }
            });
            if (events.length > 0) break;
          }
        }

        // Fallback: analyze body text
        if (status === 'Unknown') {
          const bodyText = document.body.innerText.toLowerCase();
          debug.bodyLength = bodyText.length;

          if (bodyText.includes('delivered')) status = 'Delivered';
          else if (bodyText.includes('out for delivery')) status = 'Out for Delivery';
          else if (bodyText.includes('in transit')) status = 'In Transit';
          else if (bodyText.includes('on the way')) status = 'In Transit';
          else if (bodyText.includes('shipping label created')) status = 'Label Created';
          else if (bodyText.includes('label created')) status = 'Label Created';
          else if (bodyText.includes('picked up')) status = 'Picked Up';
          else if (bodyText.includes('origin scan')) status = 'Origin Scan';
          else if (bodyText.includes('departed')) status = 'In Transit';
          else if (bodyText.includes('arrived')) status = 'Arrived at Facility';

          if (status !== 'Unknown') debug.foundVia = 'bodyText';
        }

        // Check for error messages
        const errorSelectors = [
          '.st_App-error',
          '.ups-alert--error',
          '[data-test="error-message"]'
        ];

        for (const selector of errorSelectors) {
          const errorEl = document.querySelector(selector);
          if (errorEl) {
            debug.errorMessage = errorEl.textContent.trim().substring(0, 100);
            break;
          }
        }

        debug.pageTitle = document.title;
        debug.url = window.location.href;

        return { status, expectedDelivery, events, debug };
      });

      // Log debug info if status is Unknown
      if (result.status === 'Unknown') {
        console.log('[UPS] Debug info:', JSON.stringify(result.debug));
      }

      return this.formatResult(result.status, result.events, {
        trackingNumber,
        expectedDelivery: result.expectedDelivery
      });
    } finally {
      await browser.close();
    }
  }
}

module.exports = UPSScraper;
