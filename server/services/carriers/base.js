const axios = require('axios');
const cheerio = require('cheerio');

class BaseCarrierScraper {
  constructor(name) {
    this.name = name;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async fetchPage(url, options = {}) {
    const method = options.method || 'GET';
    const response = await axios({
      method,
      url,
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': method === 'POST' ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers
      },
      timeout: 30000,
      ...(options.data && { data: options.data }),
      ...options
    });
    return response.data;
  }

  parseHTML(html) {
    return cheerio.load(html);
  }

  async track(url, trackingNumber) {
    throw new Error('track() must be implemented by carrier scraper');
  }

  formatResult(status, events = [], rawData = null) {
    return {
      carrier: this.name,
      status: status || 'Unknown',
      isDelivered: this.isDeliveredStatus(status),
      events,
      rawData,
      checkedAt: new Date().toISOString()
    };
  }

  isDeliveredStatus(status) {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('delivered') && !s.includes('not delivered');
  }
}

module.exports = BaseCarrierScraper;
