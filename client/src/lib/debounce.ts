/**
 * Debounce utility functions for optimizing performance in real-time applications
 */

export type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param immediate - If true, trigger the function on the leading edge instead of trailing
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): DebouncedFunction<T> {
  let timeout: NodeJS.Timeout | null = null;
  let args: Parameters<T> | null = null;
  let result: ReturnType<T>;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  function invokeFunc(time: number): ReturnType<T> {
    const currentArgs = args;
    args = null;
    lastInvokeTime = time;
    result = func.apply(null, currentArgs);
    return result;
  }

  function leadingEdge(time: number): ReturnType<T> {
    lastInvokeTime = time;
    timeout = setTimeout(timerExpired, wait);
    return immediate ? invokeFunc(time) : result;
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;
    return timeWaiting;
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      timeSinceLastInvoke >= wait
    );
  }

  function timerExpired(): void {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(time);
    } else {
      timeout = setTimeout(timerExpired, remainingWait(time));
    }
  }

  function trailingEdge(time: number): ReturnType<T> {
    timeout = null;
    if (args) {
      return invokeFunc(time);
    }
    args = null;
    return result;
  }

  function cancel(): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    lastInvokeTime = 0;
    args = null;
    lastCallTime = 0;
    timeout = null;
  }

  function flush(): ReturnType<T> {
    return timeout === null ? result : trailingEdge(Date.now());
  }

  function pending(): boolean {
    return timeout !== null;
  }

  function debounced(...newArgs: Parameters<T>): void {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastCallTime = time;
    args = newArgs;

    if (isInvoking) {
      if (timeout === null) {
        leadingEdge(lastCallTime);
        return;
      }
    }

    if (timeout === null) {
      timeout = setTimeout(timerExpired, wait);
    }
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced;
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 * 
 * @param func - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @param options - Options object
 * @returns The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
  } = {}
): DebouncedFunction<T> {
  let leading = true;
  let trailing = true;

  if (typeof options === 'object') {
    leading = 'leading' in options ? !!options.leading : leading;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  return debounce(func, wait, leading && !trailing);
}

/**
 * Debounced state updater for React components
 * Useful for search inputs and real-time filters
 */
export class DebouncedStateUpdater<T> {
  private debouncedUpdate: DebouncedFunction<(value: T) => void>;
  private currentValue: T;

  constructor(
    private updateFunction: (value: T) => void,
    private delay: number = 300,
    initialValue: T
  ) {
    this.currentValue = initialValue;
    this.debouncedUpdate = debounce(this.updateFunction, this.delay);
  }

  update(value: T): void {
    this.currentValue = value;
    this.debouncedUpdate(value);
  }

  flush(): void {
    this.debouncedUpdate.flush();
  }

  cancel(): void {
    this.debouncedUpdate.cancel();
  }

  getCurrentValue(): T {
    return this.currentValue;
  }

  isPending(): boolean {
    return this.debouncedUpdate.pending();
  }
}

/**
 * Batch processor for handling multiple updates efficiently
 * Useful for processing WebSocket notifications in batches
 */
export class BatchProcessor<T> {
  private batch: T[] = [];
  private debouncedProcess: DebouncedFunction<() => void>;

  constructor(
    private processBatch: (items: T[]) => void,
    private batchDelay: number = 100,
    private maxBatchSize: number = 50
  ) {
    this.debouncedProcess = debounce(() => {
      if (this.batch.length > 0) {
        const itemsToProcess = [...this.batch];
        this.batch = [];
        this.processBatch(itemsToProcess);
      }
    }, this.batchDelay);
  }

  add(item: T): void {
    this.batch.push(item);
    
    // Process immediately if batch is full
    if (this.batch.length >= this.maxBatchSize) {
      this.flush();
    } else {
      this.debouncedProcess();
    }
  }

  flush(): void {
    this.debouncedProcess.cancel();
    if (this.batch.length > 0) {
      const itemsToProcess = [...this.batch];
      this.batch = [];
      this.processBatch(itemsToProcess);
    }
  }

  cancel(): void {
    this.debouncedProcess.cancel();
    this.batch = [];
  }

  getBatchSize(): number {
    return this.batch.length;
  }

  isPending(): boolean {
    return this.debouncedProcess.pending() || this.batch.length > 0;
  }
}

/**
 * Rate limiter for API calls and WebSocket messages
 * Ensures functions are not called more than maxCalls times per timeWindow
 */
export class RateLimiter {
  private calls: number[] = [];

  constructor(
    private maxCalls: number,
    private timeWindow: number // in milliseconds
  ) {}

  canExecute(): boolean {
    const now = Date.now();
    
    // Remove calls outside the time window
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    
    return this.calls.length < this.maxCalls;
  }

  execute<T extends (...args: any[]) => any>(func: T, ...args: Parameters<T>): ReturnType<T> | null {
    if (this.canExecute()) {
      this.calls.push(Date.now());
      return func(...args);
    }
    return null;
  }

  getRemainingCalls(): number {
    const now = Date.now();
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    return Math.max(0, this.maxCalls - this.calls.length);
  }

  getTimeUntilReset(): number {
    if (this.calls.length === 0) return 0;
    
    const oldestCall = Math.min(...this.calls);
    const timeUntilReset = this.timeWindow - (Date.now() - oldestCall);
    return Math.max(0, timeUntilReset);
  }

  reset(): void {
    this.calls = [];
  }
}

/**
 * Adaptive debouncer that adjusts delay based on frequency of calls
 * Useful for search inputs that should respond faster when user is typing slowly
 */
export class AdaptiveDebouncer<T extends (...args: any[]) => any> {
  private lastCallTime = 0;
  private currentDelay: number;
  private debouncedFunc: DebouncedFunction<T>;

  constructor(
    private func: T,
    private minDelay: number = 100,
    private maxDelay: number = 1000,
    private adaptationFactor: number = 0.1
  ) {
    this.currentDelay = minDelay;
    this.debouncedFunc = debounce(func, this.currentDelay);
  }

  call(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    // Adapt delay based on call frequency
    if (timeSinceLastCall < this.currentDelay) {
      // Calls are frequent, increase delay
      this.currentDelay = Math.min(
        this.maxDelay,
        this.currentDelay * (1 + this.adaptationFactor)
      );
    } else {
      // Calls are infrequent, decrease delay
      this.currentDelay = Math.max(
        this.minDelay,
        this.currentDelay * (1 - this.adaptationFactor)
      );
    }

    this.lastCallTime = now;

    // Cancel current debounced function and create new one with updated delay
    this.debouncedFunc.cancel();
    this.debouncedFunc = debounce(this.func, this.currentDelay);
    this.debouncedFunc(...args);
  }

  cancel(): void {
    this.debouncedFunc.cancel();
  }

  flush(): void {
    this.debouncedFunc.flush();
  }

  getCurrentDelay(): number {
    return this.currentDelay;
  }
}

/**
 * Utility functions for common debouncing scenarios
 */
export const debounceUtils = {
  /**
   * Debounced search function
   */
  createDebouncedSearch: (
    searchFunction: (query: string) => void,
    delay: number = 300
  ) => debounce(searchFunction, delay),

  /**
   * Debounced filter function
   */
  createDebouncedFilter: (
    filterFunction: (filters: any) => void,
    delay: number = 200
  ) => debounce(filterFunction, delay),

  /**
   * Throttled scroll handler
   */
  createThrottledScroll: (
    scrollHandler: (event: Event) => void,
    delay: number = 16 // ~60fps
  ) => throttle(scrollHandler, delay),

  /**
   * Debounced resize handler
   */
  createDebouncedResize: (
    resizeHandler: (event: Event) => void,
    delay: number = 250
  ) => debounce(resizeHandler, delay),

  /**
   * Throttled WebSocket message sender
   */
  createThrottledWebSocketSender: (
    sendFunction: (message: any) => void,
    delay: number = 100
  ) => throttle(sendFunction, delay, { leading: true, trailing: false })
};