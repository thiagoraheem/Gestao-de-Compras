import { EventEmitter } from 'events';

export interface PollingConfig {
  baseInterval: number;
  maxInterval: number;
  backoffMultiplier: number;
  maxRetries: number;
  activityDetectionInterval: number;
  inactiveMultiplier: number;
  debug: boolean;
}

export interface PollingOptions {
  key: string;
  fetcher: () => Promise<any>;
  interval?: number;
  enabled?: boolean;
  priority?: 'high' | 'medium' | 'low';
  dependencies?: string[];
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  shouldPoll?: () => boolean;
}

export interface PollingTask {
  key: string;
  options: PollingOptions;
  timer: NodeJS.Timeout | null;
  currentInterval: number;
  retryCount: number;
  lastSuccess: number;
  lastError: number;
  isActive: boolean;
  consecutiveErrors: number;
}

export class SmartPollingService extends EventEmitter {
  private config: PollingConfig;
  private tasks = new Map<string, PollingTask>();
  private isUserActive = true;
  private lastActivity = Date.now();
  private activityTimer: NodeJS.Timeout | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private networkStatusHandler: (() => void) | null = null;
  private isOnline = navigator.onLine;

  constructor(config: Partial<PollingConfig> = {}) {
    super();
    
    this.config = {
      baseInterval: config.baseInterval || 5000,
      maxInterval: config.maxInterval || 300000, // 5 minutes
      backoffMultiplier: config.backoffMultiplier || 1.5,
      maxRetries: config.maxRetries || 5,
      activityDetectionInterval: config.activityDetectionInterval || 60000, // 1 minute
      inactiveMultiplier: config.inactiveMultiplier || 3,
      debug: config.debug || false
    };

    this.setupActivityDetection();
    this.setupVisibilityDetection();
    this.setupNetworkDetection();
    
    this.log('Smart Polling Service initialized', this.config);
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[Smart Polling] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    console.error(`[Smart Polling] ${message}`, error || '');
    this.emit('error', { message, error });
  }

  private setupActivityDetection() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      const wasActive = this.isUserActive;
      this.isUserActive = true;
      this.lastActivity = Date.now();
      
      if (!wasActive) {
        this.log('User became active - adjusting polling intervals');
        this.adjustAllIntervals();
        this.emit('activityChanged', { active: true });
      }
    };

    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check for inactivity periodically
    this.activityTimer = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivity;
      const wasActive = this.isUserActive;
      
      this.isUserActive = timeSinceActivity < this.config.activityDetectionInterval;
      
      if (wasActive !== this.isUserActive) {
        this.log(`User became ${this.isUserActive ? 'active' : 'inactive'} - adjusting polling intervals`);
        this.adjustAllIntervals();
        this.emit('activityChanged', { active: this.isUserActive });
      }
    }, this.config.activityDetectionInterval / 2);
  }

  private setupVisibilityDetection() {
    this.visibilityChangeHandler = () => {
      const isVisible = !document.hidden;
      this.log(`Page visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible) {
        // Resume polling when page becomes visible
        this.resumeAll();
      } else {
        // Pause or slow down polling when page is hidden
        this.pauseAll();
      }
      
      this.emit('visibilityChanged', { visible: isVisible });
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  private setupNetworkDetection() {
    this.networkStatusHandler = () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      
      this.log(`Network status changed: ${this.isOnline ? 'online' : 'offline'}`);
      
      if (!wasOnline && this.isOnline) {
        // Network came back - resume polling and reset retry counts
        this.log('Network restored - resuming polling');
        this.resetAllRetries();
        this.resumeAll();
      } else if (wasOnline && !this.isOnline) {
        // Network lost - pause polling
        this.log('Network lost - pausing polling');
        this.pauseAll();
      }
      
      this.emit('networkChanged', { online: this.isOnline });
    };

    window.addEventListener('online', this.networkStatusHandler);
    window.addEventListener('offline', this.networkStatusHandler);
  }

  public addTask(options: PollingOptions): string {
    const task: PollingTask = {
      key: options.key,
      options,
      timer: null,
      currentInterval: options.interval || this.config.baseInterval,
      retryCount: 0,
      lastSuccess: 0,
      lastError: 0,
      isActive: options.enabled !== false,
      consecutiveErrors: 0
    };

    this.tasks.set(options.key, task);
    this.log('Added polling task', { key: options.key, interval: task.currentInterval });

    if (task.isActive && this.isOnline && !document.hidden) {
      this.startTask(task);
    }

    return options.key;
  }

  public removeTask(key: string): boolean {
    const task = this.tasks.get(key);
    
    if (task) {
      this.stopTask(task);
      this.tasks.delete(key);
      this.log('Removed polling task', { key });
      return true;
    }
    
    return false;
  }

  public pauseTask(key: string): boolean {
    const task = this.tasks.get(key);
    
    if (task) {
      task.isActive = false;
      this.stopTask(task);
      this.log('Paused polling task', { key });
      return true;
    }
    
    return false;
  }

  public resumeTask(key: string): boolean {
    const task = this.tasks.get(key);
    
    if (task) {
      task.isActive = true;
      
      if (this.isOnline && !document.hidden) {
        this.startTask(task);
      }
      
      this.log('Resumed polling task', { key });
      return true;
    }
    
    return false;
  }

  public updateTaskInterval(key: string, interval: number): boolean {
    const task = this.tasks.get(key);
    
    if (task) {
      task.options.interval = interval;
      task.currentInterval = interval;
      
      if (task.isActive) {
        this.stopTask(task);
        this.startTask(task);
      }
      
      this.log('Updated task interval', { key, interval });
      return true;
    }
    
    return false;
  }

  private startTask(task: PollingTask) {
    if (task.timer) {
      clearTimeout(task.timer);
    }

    const interval = this.calculateInterval(task);
    
    task.timer = setTimeout(async () => {
      await this.executeTask(task);
    }, interval);

    this.log('Started polling task', { 
      key: task.key, 
      interval, 
      retryCount: task.retryCount 
    });
  }

  private stopTask(task: PollingTask) {
    if (task.timer) {
      clearTimeout(task.timer);
      task.timer = null;
    }
  }

  private async executeTask(task: PollingTask) {
    // Check if task should still poll
    if (!task.isActive || !this.isOnline || document.hidden) {
      return;
    }

    // Check custom shouldPoll condition
    if (task.options.shouldPoll && !task.options.shouldPoll()) {
      this.scheduleNextExecution(task);
      return;
    }

    // Check dependencies
    if (task.options.dependencies && !this.areDependenciesMet(task.options.dependencies)) {
      this.scheduleNextExecution(task);
      return;
    }

    try {
      this.log('Executing polling task', { key: task.key });
      
      const startTime = Date.now();
      const result = await task.options.fetcher();
      const duration = Date.now() - startTime;
      
      // Success
      task.lastSuccess = Date.now();
      task.retryCount = 0;
      task.consecutiveErrors = 0;
      task.currentInterval = task.options.interval || this.config.baseInterval;
      
      this.log('Polling task succeeded', { 
        key: task.key, 
        duration,
        dataSize: JSON.stringify(result).length 
      });
      
      this.emit('taskSuccess', { key: task.key, result, duration });
      
      if (task.options.onSuccess) {
        task.options.onSuccess(result);
      }
      
    } catch (error) {
      // Error
      task.lastError = Date.now();
      task.consecutiveErrors++;
      
      this.error('Polling task failed', { key: task.key, error });
      this.emit('taskError', { key: task.key, error });
      
      if (task.options.onError) {
        task.options.onError(error);
      }
      
      // Apply exponential backoff
      if (task.retryCount < this.config.maxRetries) {
        task.retryCount++;
        task.currentInterval = Math.min(
          task.currentInterval * this.config.backoffMultiplier,
          this.config.maxInterval
        );
      } else {
        this.log('Max retries reached for task', { key: task.key });
        this.emit('taskMaxRetries', { key: task.key, error });
        
        // Optionally pause the task or use a very long interval
        task.currentInterval = this.config.maxInterval;
      }
    }

    this.scheduleNextExecution(task);
  }

  private scheduleNextExecution(task: PollingTask) {
    if (task.isActive && this.isOnline && !document.hidden) {
      this.startTask(task);
    }
  }

  private calculateInterval(task: PollingTask): number {
    let interval = task.currentInterval;
    
    // Apply user activity multiplier
    if (!this.isUserActive) {
      interval *= this.config.inactiveMultiplier;
    }
    
    // Apply priority multiplier
    switch (task.options.priority) {
      case 'high':
        interval *= 0.5;
        break;
      case 'low':
        interval *= 2;
        break;
      // medium priority uses base interval
    }
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * interval;
    interval += jitter;
    
    return Math.max(1000, Math.min(interval, this.config.maxInterval));
  }

  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(dep => {
      const depTask = this.tasks.get(dep);
      return depTask && depTask.lastSuccess > 0 && depTask.consecutiveErrors === 0;
    });
  }

  private adjustAllIntervals() {
    for (const task of this.tasks.values()) {
      if (task.isActive && task.timer) {
        this.stopTask(task);
        this.startTask(task);
      }
    }
  }

  private pauseAll() {
    for (const task of this.tasks.values()) {
      this.stopTask(task);
    }
    this.log('Paused all polling tasks');
  }

  private resumeAll() {
    for (const task of this.tasks.values()) {
      if (task.isActive) {
        this.startTask(task);
      }
    }
    this.log('Resumed all polling tasks');
  }

  private resetAllRetries() {
    for (const task of this.tasks.values()) {
      task.retryCount = 0;
      task.consecutiveErrors = 0;
      task.currentInterval = task.options.interval || this.config.baseInterval;
    }
    this.log('Reset all retry counts');
  }

  public getTaskStatus(key: string) {
    const task = this.tasks.get(key);
    
    if (!task) {
      return null;
    }
    
    return {
      key: task.key,
      isActive: task.isActive,
      currentInterval: task.currentInterval,
      retryCount: task.retryCount,
      consecutiveErrors: task.consecutiveErrors,
      lastSuccess: task.lastSuccess,
      lastError: task.lastError,
      hasTimer: task.timer !== null
    };
  }

  public getAllTasksStatus() {
    const tasks = Array.from(this.tasks.values()).map(task => ({
      key: task.key,
      isActive: task.isActive,
      currentInterval: task.currentInterval,
      retryCount: task.retryCount,
      consecutiveErrors: task.consecutiveErrors,
      lastSuccess: task.lastSuccess,
      lastError: task.lastError,
      hasTimer: task.timer !== null,
      priority: task.options.priority || 'medium'
    }));

    return {
      tasks,
      globalStatus: {
        isUserActive: this.isUserActive,
        isOnline: this.isOnline,
        isVisible: !document.hidden,
        lastActivity: this.lastActivity,
        totalTasks: this.tasks.size,
        activeTasks: tasks.filter(t => t.isActive).length
      }
    };
  }

  public destroy() {
    // Clear all timers
    for (const task of this.tasks.values()) {
      this.stopTask(task);
    }
    
    // Clear activity timer
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
    
    // Remove event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    
    if (this.networkStatusHandler) {
      window.removeEventListener('online', this.networkStatusHandler);
      window.removeEventListener('offline', this.networkStatusHandler);
    }
    
    // Clear tasks
    this.tasks.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    this.log('Smart Polling Service destroyed');
  }
}

// Singleton instance for global use
let globalPollingService: SmartPollingService | null = null;

export function getPollingService(config?: Partial<PollingConfig>): SmartPollingService {
  if (!globalPollingService) {
    globalPollingService = new SmartPollingService(config);
  }
  return globalPollingService;
}

export function destroyPollingService() {
  if (globalPollingService) {
    globalPollingService.destroy();
    globalPollingService = null;
  }
}