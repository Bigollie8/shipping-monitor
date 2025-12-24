const BaseCarrierScraper = require('./base');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = null;
}

class GenericScraper extends BaseCarrierScraper {
  constructor() {
    super('unknown');
  }

  async track(url, trackingNumber) {
    if (!puppeteer) {
      try {
        const html = await this.fetchPage(url);
        return this.parseHTML_Page(html);
      } catch (error) {
        return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
      }
    }

    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent(this.getRandomUserAgent());
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        await new Promise(resolve => setTimeout(resolve, 2000));

        const result = await page.evaluate(() => {
          const body = document.body.innerText.toLowerCase();

          let status = 'Unknown';
          if (body.includes('delivered')) {
            status = 'Delivered';
          } else if (body.includes('out for delivery')) {
            status = 'Out for Delivery';
          } else if (body.includes('in transit')) {
            status = 'In Transit';
          } else if (body.includes('shipped')) {
            status = 'Shipped';
          } else if (body.includes('label created')) {
            status = 'Label Created';
          }

          const events = [];
          const statusPatterns = [
            '.tracking-event',
            '.shipment-event',
            '.timeline-item',
            '.status-update',
            '[class*="tracking"]',
            '[class*="event"]',
            '[class*="timeline"]'
          ];

          for (const pattern of statusPatterns) {
            document.querySelectorAll(pattern).forEach(el => {
              const text = el.textContent.trim();
              if (text && text.length < 500) {
                events.push({
                  status: text.split('\n')[0].substring(0, 100),
                  location: '',
                  timestamp: null,
                  details: text.substring(0, 200)
                });
              }
            });

            if (events.length > 0) break;
          }

          return { status, events: events.slice(0, 20) };
        });

        return this.formatResult(result.status, result.events, { url });
      } finally {
        await browser.close();
      }
    } catch (puppeteerError) {
      try {
        const html = await this.fetchPage(url);
        return this.parseHTML_Page(html);
      } catch (error) {
        console.error(`Generic tracking error: ${error.message}`);
        return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
      }
    }
  }

  parseHTML_Page(html) {
    try {
      const $ = this.parseHTML(html);
      const body = $('body').text().toLowerCase();

      let status = 'Unknown';
      if (body.includes('delivered')) {
        status = 'Delivered';
      } else if (body.includes('out for delivery')) {
        status = 'Out for Delivery';
      } else if (body.includes('in transit')) {
        status = 'In Transit';
      } else if (body.includes('shipped')) {
        status = 'Shipped';
      }

      return this.formatResult(status, [], { note: 'Limited data available for this carrier' });
    } catch (error) {
      return this.formatResult(`Parse error: ${error.message}`, []);
    }
  }
}

module.exports = GenericScraper;
