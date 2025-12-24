const BaseCarrierScraper = require('./base');

class DHLScraper extends BaseCarrierScraper {
  constructor() {
    super('dhl');
  }

  async track(url, trackingNumber) {
    try {
      if (!trackingNumber) {
        const match = url.match(/\b(\d{10,11}|[A-Z]{3}\d{7})\b/i);
        trackingNumber = match ? match[0] : null;
      }

      if (!trackingNumber) {
        return this.formatResult('Unable to extract tracking number', []);
      }

      const apiUrl = `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`;

      try {
        const response = await this.fetchPage(apiUrl, {
          headers: {
            'DHL-API-Key': 'demo-key',
            'Accept': 'application/json'
          }
        });
        return this.parseAPIResponse(response, trackingNumber);
      } catch (apiError) {
        const trackUrl = `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
        const html = await this.fetchPage(trackUrl);
        return this.parseHTML_Page(html, trackingNumber);
      }
    } catch (error) {
      console.error(`DHL tracking error: ${error.message}`);
      return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
    }
  }

  parseAPIResponse(data, trackingNumber) {
    try {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      const shipment = data?.shipments?.[0];
      if (!shipment) {
        return this.formatResult('No tracking data found', []);
      }

      const status = shipment.status?.statusCode || shipment.status?.status || 'Unknown';
      const events = [];

      if (shipment.events) {
        for (const event of shipment.events) {
          events.push({
            status: event.status || event.description || 'Update',
            location: event.location?.address?.addressLocality || '',
            timestamp: event.timestamp || null,
            details: event.description
          });
        }
      }

      return this.formatResult(status, events, shipment);
    } catch (error) {
      return this.formatResult(`API parse error: ${error.message}`, []);
    }
  }

  parseHTML_Page(html, trackingNumber) {
    try {
      const $ = this.parseHTML(html);

      let status = 'Unknown';
      const statusEl = $('.c-tracking-result--status, .tracking-status, [data-test="tracking-status"]').first();
      if (statusEl.length) {
        status = statusEl.text().trim();
      }

      const events = [];
      $('.c-tracking-result--checkpoint, .tracking-event, [data-test="tracking-checkpoint"]').each((i, el) => {
        const $el = $(el);
        const eventStatus = $el.find('.checkpoint-description, .event-status').text().trim();
        const location = $el.find('.checkpoint-location, .event-location').text().trim();
        const datetime = $el.find('.checkpoint-date, .event-date').text().trim();

        if (eventStatus) {
          events.push({
            status: eventStatus,
            location: location || '',
            timestamp: datetime || null,
            details: eventStatus
          });
        }
      });

      return this.formatResult(status, events, { trackingNumber });
    } catch (error) {
      return this.formatResult(`Parse error: ${error.message}`, []);
    }
  }
}

module.exports = DHLScraper;
