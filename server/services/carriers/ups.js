const BaseCarrierScraper = require('./base');

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

      const apiUrl = `https://www.ups.com/track/api/Track/GetStatus?loc=en_US`;

      const response = await this.fetchPage(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://www.ups.com',
          'Referer': 'https://www.ups.com/track?loc=en_US&tracknum=' + trackingNumber
        },
        data: JSON.stringify({
          Locale: 'en_US',
          TrackingNumber: [trackingNumber]
        })
      });

      return this.parseResponse(response, trackingNumber);
    } catch (error) {
      console.error(`UPS tracking error: ${error.message}`);
      return this.formatResult(`Error: ${error.message}`, [], { error: error.message });
    }
  }

  parseResponse(data, trackingNumber) {
    try {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      const trackDetails = data?.trackDetails?.[0];
      if (!trackDetails) {
        return this.formatResult('No tracking data found', []);
      }

      const status = trackDetails.packageStatus || 'Unknown';
      const events = [];

      if (trackDetails.shipmentProgressActivities) {
        for (const activity of trackDetails.shipmentProgressActivities) {
          events.push({
            status: activity.activityScan || 'Update',
            location: activity.location || '',
            timestamp: activity.date && activity.time
              ? `${activity.date} ${activity.time}`
              : null,
            details: activity.activityScan
          });
        }
      }

      return this.formatResult(status, events, trackDetails);
    } catch (error) {
      return this.formatResult(`Parse error: ${error.message}`, []);
    }
  }
}

module.exports = UPSScraper;
