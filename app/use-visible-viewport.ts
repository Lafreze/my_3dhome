'use client';
import { useEffect } from 'react';

// Keep controls inside the visual viewport, including pinch zoom and keyboard resizing.
export function useVisibleViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const style = document.documentElement.style;
    const update = () => {
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      style.setProperty('--ui-width', `${width}px`);
      style.setProperty('--ui-height', `${height}px`);
      style.setProperty('--ui-left', `${viewport?.offsetLeft ?? 0}px`);
      style.setProperty('--ui-top', `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ['width', 'height', 'left', 'top'].forEach((key) =>
        style.removeProperty(`--ui-${key}`),
      );
    };
  }, []);
}
