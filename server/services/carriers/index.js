const UPSScraper = require('./ups');
const FedExScraper = require('./fedex');
const USPSScraper = require('./usps');
const DHLScraper = require('./dhl');
const AmazonScraper = require('./amazon');
const GenericScraper = require('./generic');

const scrapers = {
  ups: new UPSScraper(),
  fedex: new FedExScraper(),
  usps: new USPSScraper(),
  dhl: new DHLScraper(),
  amazon: new AmazonScraper(),
  unknown: new GenericScraper()
};

function getScraper(carrier) {
  return scrapers[carrier] || scrapers.unknown;
}

module.exports = {
  scrapers,
  getScraper
};
