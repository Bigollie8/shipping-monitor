const CARRIER_PATTERNS = {
  ups: {
    urlPatterns: [/ups\.com/i, /ups\.com\/track/i],
    trackingPatterns: [/\b1Z[A-Z0-9]{16}\b/i]
  },
  fedex: {
    urlPatterns: [/fedex\.com/i],
    trackingPatterns: [/\b\d{12,22}\b/, /\b\d{15}\b/]
  },
  usps: {
    urlPatterns: [/usps\.com/i, /tools\.usps\.com/i],
    trackingPatterns: [
      /\b9[0-9]{15,21}\b/,
      /\b[A-Z]{2}\d{9}US\b/i
    ]
  },
  dhl: {
    urlPatterns: [/dhl\.com/i],
    trackingPatterns: [/\b\d{10,11}\b/, /\b[A-Z]{3}\d{7}\b/i]
  },
  amazon: {
    urlPatterns: [/amazon\.com/i, /amazon\.com.*progress-tracker/i],
    trackingPatterns: [/TBA\d{12,}/i]
  },
  ontrac: {
    urlPatterns: [/ontrac\.com/i],
    trackingPatterns: [/\bC\d{14}\b/i, /\bD\d{14}\b/i]
  },
  lasership: {
    urlPatterns: [/lasership\.com/i],
    trackingPatterns: [/\b1LS\d{12}\b/i, /\bLX\d{10}\b/i]
  }
};

function detectCarrier(url) {
  const normalizedUrl = url.toLowerCase();

  for (const [carrier, patterns] of Object.entries(CARRIER_PATTERNS)) {
    for (const pattern of patterns.urlPatterns) {
      if (pattern.test(normalizedUrl)) {
        return carrier;
      }
    }
  }

  return 'unknown';
}

function extractTrackingNumber(url, carrier) {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const commonParams = ['tracknum', 'tracknumbers', 'tracking', 'trackingNumber', 'trackNums', 'trkNum'];
    for (const param of commonParams) {
      const value = params.get(param);
      if (value) return value;
    }

    const pathMatch = url.match(/track(?:ing)?[\/=]([A-Za-z0-9]+)/i);
    if (pathMatch) return pathMatch[1];

    if (carrier && CARRIER_PATTERNS[carrier]) {
      for (const pattern of CARRIER_PATTERNS[carrier].trackingPatterns) {
        const match = url.match(pattern);
        if (match) return match[0];
      }
    }

    for (const patterns of Object.values(CARRIER_PATTERNS)) {
      for (const pattern of patterns.trackingPatterns) {
        const match = url.match(pattern);
        if (match) return match[0];
      }
    }
  } catch (e) {
    console.error('Error extracting tracking number:', e.message);
  }

  return null;
}

function normalizeStatus(rawStatus) {
  const status = rawStatus.toLowerCase();

  if (status.includes('delivered')) return 'Delivered';
  if (status.includes('out for delivery')) return 'Out for Delivery';
  if (status.includes('in transit') || status.includes('on the way')) return 'In Transit';
  if (status.includes('arrived') || status.includes('at facility')) return 'At Facility';
  if (status.includes('departed') || status.includes('left facility')) return 'Departed Facility';
  if (status.includes('picked up') || status.includes('shipment picked up')) return 'Picked Up';
  if (status.includes('shipping label') || status.includes('label created')) return 'Label Created';
  if (status.includes('exception') || status.includes('delay')) return 'Exception';
  if (status.includes('return')) return 'Returned';

  return rawStatus;
}

module.exports = {
  detectCarrier,
  extractTrackingNumber,
  normalizeStatus,
  CARRIER_PATTERNS
};
