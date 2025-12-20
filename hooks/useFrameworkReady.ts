import { useEffect } from "react";

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    // Disable framework ready calls that might cause C++ exceptions
    // window.frameworkReady?.();
  });
}
