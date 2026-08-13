import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let currentValue = false;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | null = null;
const listeners = new Set<(value: boolean) => void>();

const publish = (value: boolean) => {
  currentValue = value;
  listeners.forEach((listener) => listener(value));
};

const subscribe = (listener: (value: boolean) => void) => {
  listeners.add(listener);

  if (!subscription) {
    void AccessibilityInfo.isReduceMotionEnabled().then(publish);
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
};

export function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(currentValue);

  useEffect(() => subscribe(setReduceMotion), []);

  return reduceMotion;
}
