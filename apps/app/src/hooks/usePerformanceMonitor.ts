import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  mountTime: number;
  updateCount: number;
}

interface UsePerformanceMonitorOptions {
  componentName: string;
  enabled?: boolean;
  threshold?: number; // Log warnings if render time exceeds this (ms)
}

export function usePerformanceMonitor({
  componentName,
  enabled = process.env.NODE_ENV === 'development',
  threshold = 16, // 16ms = 60fps
}: UsePerformanceMonitorOptions) {
  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);
  const updateCount = useRef<number>(0);
  const isFirstRender = useRef<boolean>(true);

  // Start timing before render
  if (enabled && performance.now) {
    renderStartTime.current = performance.now();
  }

  useEffect(() => {
    if (!enabled || !performance.now) return;

    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;

    if (isFirstRender.current) {
      mountTime.current = renderTime;
      isFirstRender.current = false;
    } else {
      updateCount.current += 1;
    }

    const metrics: PerformanceMetrics = {
      componentName,
      renderTime,
      mountTime: mountTime.current,
      updateCount: updateCount.current,
    };

    // Log performance metrics
    if (renderTime > threshold) {
      console.warn(
        `🐌 Slow render detected in ${componentName}:`,
        `${renderTime.toFixed(2)}ms (threshold: ${threshold}ms)`,
        metrics
      );
    } else if (process.env.NODE_ENV === 'development') {
      console.debug(
        `⚡ ${componentName} rendered in ${renderTime.toFixed(2)}ms`,
        metrics
      );
    }

    // Report to analytics in production (if available)
    if (process.env.NODE_ENV === 'production' && renderTime > threshold * 2) {
      // You can integrate with your analytics service here
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'slow_render', {
          component_name: componentName,
          render_time: Math.round(renderTime),
          custom_parameter_1: 'performance_monitoring',
        });
      }
    }
  });

  // Return metrics for potential use in components
  return {
    componentName,
    renderTime: renderStartTime.current,
    mountTime: mountTime.current,
    updateCount: updateCount.current,
  };
}

// Hook for measuring specific operations
export function useOperationTimer() {
  const timers = useRef<Map<string, number>>(new Map());

  const startTimer = (operationName: string) => {
    if (performance.now) {
      timers.current.set(operationName, performance.now());
    }
  };

  const endTimer = (operationName: string) => {
    if (!performance.now) return 0;

    const startTime = timers.current.get(operationName);
    if (!startTime) return 0;

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    timers.current.delete(operationName);
    
    console.debug(`⏱️ ${operationName} took ${duration.toFixed(2)}ms`);
    return duration;
  };

  return { startTimer, endTimer };
}