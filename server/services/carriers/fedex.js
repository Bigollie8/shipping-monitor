const BaseCarrierScraper = require('./base');

class FedExScraper extends BaseCarrierScraper {
  constructor() {
    super('fedex');
  }

  async track(url, trackingNumber) {
    try {
      if (!trackingNumber) {
        const match = url.match(/\d{12,22}/);
        trackingNumber = match ? match[0] : null;
      }

      if (!trackingNumber) {
        return this.formatResult('Unable to extract tracking number', []);
      }

      const html = await this.fetchPage(url);
      return this.parseHTML_Page(html, trackingNumber);
    } catch (error) {
      console.error(`FedEx tracking error: ${error.message}`);
      return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
    }
  }

  parseHTML_Page(html, trackingNumber) {
    try {
      const $ = this.parseHTML(html);

      let status = 'Unknown';
      const statusEl = $('[data-test-id="shipment-status"]').first();
      if (statusEl.length) {
        status = statusEl.text().trim();
      } else {
        const altStatus = $('.shipment-status, .travel-history-status, .status-content').first();
        if (altStatus.length) {
          status = altStatus.text().trim();
        }
      }

      const events = [];
      $('.travel-history-item, .scan-event, [data-test-id="travel-history"]').each((i, el) => {
        const $el = $(el);
        const eventStatus = $el.find('.travel-history-status, .scan-event-description, .status').text().trim();
        const location = $el.find('.travel-history-location, .scan-event-location, .location').text().trim();
        const datetime = $el.find('.travel-history-date, .scan-event-time, .date').text().trim();

        if (eventStatus) {
          events.push({
            status: eventStatus,
            location: location || '',
            timestamp: datetime || null,
            details: eventStatus
          });
        }
      });

      return this.formatResult(status, events, { html: html.substring(0, 1000) });
    } catch (error) {
      return this.formatResult(`Parse error: ${error.message}`, []);
    }
  }
}

module.exports = FedExScraper;
