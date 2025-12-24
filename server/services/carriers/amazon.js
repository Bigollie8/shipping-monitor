const BaseCarrierScraper = require('./base');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = null;
}

class AmazonScraper extends BaseCarrierScraper {
  constructor() {
    super('amazon');
    this.requiresPuppeteer = true;
  }

  async track(url, trackingNumber) {
    if (!puppeteer) {
      try {
        const html = await this.fetchPage(url);
        return this.parseHTML_Page(html);
      } catch (error) {
        return this.formatResult('Unable to track (Puppeteer not available)', [], { error: 'Puppeteer not installed' });
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

        await page.waitForSelector('.milestone-primaryMessage, .a-size-medium, [data-test-id="delivery-tracker"]', {
          timeout: 10000
        }).catch(() => {});

        const result = await page.evaluate(() => {
          let status = 'Unknown';

          const statusEl = document.querySelector('.milestone-primaryMessage, .a-size-medium.a-text-bold');
          if (statusEl) {
            status = statusEl.textContent.trim();
          }

          const events = [];
          document.querySelectorAll('.milestone-content, .a-spacing-base').forEach(el => {
            const eventStatus = el.querySelector('.milestone-primaryMessage, .a-text-bold')?.textContent?.trim();
            const details = el.querySelector('.milestone-secondaryMessage, .a-color-secondary')?.textContent?.trim();
            const datetime = el.querySelector('.milestone-date, .a-color-tertiary')?.textContent?.trim();

            if (eventStatus) {
              events.push({
                status: eventStatus,
                location: '',
                timestamp: datetime || null,
                details: details || eventStatus
              });
            }
          });

          return { status, events };
        });

        return this.formatResult(result.status, result.events, { url });
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error(`Amazon tracking error: ${error.message}`);

      try {
        const html = await this.fetchPage(url);
        return this.parseHTML_Page(html);
      } catch (fallbackError) {
        return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
      }
    }
  }

  parseHTML_Page(html) {
    try {
      const $ = this.parseHTML(html);

      let status = 'Unknown';
      const statusEl = $('.milestone-primaryMessage, .delivery-box__primary-text').first();
      if (statusEl.length) {
        status = statusEl.text().trim();
      }

      const events = [];
      $('.milestone-content, .tracking-event-carrier-AMZL').each((i, el) => {
        const $el = $(el);
        const eventStatus = $el.find('.milestone-primaryMessage').text().trim();
        const details = $el.find('.milestone-secondaryMessage').text().trim();
        const datetime = $el.find('.milestone-date').text().trim();

        if (eventStatus) {
          events.push({
            status: eventStatus,
            location: '',
            timestamp: datetime || null,
            details: details || eventStatus
          });
        }
      });

      return this.formatResult(status, events);
    } catch (error) {
      return this.formatResult(`Parse error: ${error.message}`, []);
    }
  }
}

module.exports = AmazonScraper;
