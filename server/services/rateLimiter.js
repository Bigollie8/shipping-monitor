const TASK_TIMEOUT_MS = 60000; // 60 second timeout per task

class RateLimiter {
  constructor() {
    this.carrierLastCheck = new Map();
    this.carrierFailures = new Map();
    this.queue = [];
    this.isProcessing = false;

    this.defaultMinInterval = 60 * 1000;
    this.carrierIntervals = {
      ups: 30 * 1000,
      fedex: 30 * 1000,
      usps: 30 * 1000,
      dhl: 30 * 1000,
      amazon: 60 * 1000,
      unknown: 30 * 1000
    };

    this.maxBackoff = 4 * 60 * 60 * 1000;
    this.baseBackoff = 5 * 60 * 1000;
  }

  executeWithTimeout(fn, ms) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Task timed out after ${ms / 1000}s`)), ms);
    });
    return Promise.race([fn(), timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  getMinInterval(carrier) {
    return this.carrierIntervals[carrier] || this.defaultMinInterval;
  }

  canCheck(carrier) {
    const lastCheck = this.carrierLastCheck.get(carrier);
    if (!lastCheck) return true;

    const minInterval = this.getMinInterval(carrier);
    const backoffMultiplier = this.getBackoffMultiplier(carrier);
    const effectiveInterval = minInterval * backoffMultiplier;

    return Date.now() - lastCheck >= effectiveInterval;
  }

  getBackoffMultiplier(carrier) {
    const failures = this.carrierFailures.get(carrier) || 0;
    if (failures === 0) return 1;

    const multiplier = Math.pow(2, failures);
    const maxMultiplier = this.maxBackoff / this.getMinInterval(carrier);
    return Math.min(multiplier, maxMultiplier);
  }

  recordCheck(carrier) {
    this.carrierLastCheck.set(carrier, Date.now());
  }

  recordSuccess(carrier) {
    this.carrierFailures.set(carrier, 0);
  }

  recordFailure(carrier) {
    const current = this.carrierFailures.get(carrier) || 0;
    this.carrierFailures.set(carrier, current + 1);
  }

  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue[0];

      if (!this.canCheck(task.carrier)) {
        const waitTime = this.getWaitTime(task.carrier);
        console.log(`Rate limited for ${task.carrier}, waiting ${Math.round(waitTime / 1000)}s`);
        await this.sleep(waitTime);
      }

      try {
        this.recordCheck(task.carrier);
        const result = await this.executeWithTimeout(task.execute, TASK_TIMEOUT_MS);
        this.recordSuccess(task.carrier);
        resolve(result);
      } catch (error) {
        this.recordFailure(task.carrier);
        reject(error);
      }

      this.queue.shift();

      if (this.queue.length > 0) {
        await this.sleep(1000);
      }
    }

    this.isProcessing = false;
  }

  getWaitTime(carrier) {
    const lastCheck = this.carrierLastCheck.get(carrier);
    if (!lastCheck) return 0;

    const minInterval = this.getMinInterval(carrier);
    const backoffMultiplier = this.getBackoffMultiplier(carrier);
    const effectiveInterval = minInterval * backoffMultiplier;

    return Math.max(0, effectiveInterval - (Date.now() - lastCheck));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    const status = {};
    for (const [carrier, lastCheck] of this.carrierLastCheck) {
      status[carrier] = {
        lastCheck: new Date(lastCheck).toISOString(),
        failures: this.carrierFailures.get(carrier) || 0,
        backoffMultiplier: this.getBackoffMultiplier(carrier),
        canCheck: this.canCheck(carrier),
        waitTime: this.getWaitTime(carrier)
      };
    }
    return status;
  }
}

module.exports = new RateLimiter();
