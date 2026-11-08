/**
 * PharmaPulse 2D Spatial Navigation Engine
 * 
 * Provides frictionless keyboard directional traversal (←, →, ↑, ↓, Enter)
 * across the ERP workstation without interfering with native mouse controls,
 * drag events, or text editing within inputs.
 */

export type SpatialDirection = 'up' | 'down' | 'left' | 'right';

export interface SpatialNavConfig {
  up?: string | (() => HTMLElement | null | void) | null;
  down?: string | (() => HTMLElement | null | void) | null;
  left?: string | (() => HTMLElement | null | void) | null;
  right?: string | (() => HTMLElement | null | void) | null;
  enter?: () => void;
  space?: () => void;
  escape?: () => void;
  allowDefaultEnter?: boolean;
}

/**
 * Checks whether an input caret is at the boundary for directional navigation.
 * Prevents premature navigation while the user is editing text.
 */
export function isAtCaretBoundary(element: HTMLElement, direction: SpatialDirection): boolean {
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    // For buttons, checkboxes, radio, ranges - always allow directional navigation
    if (['button', 'submit', 'checkbox', 'radio', 'range'].includes(type)) {
      return true;
    }

    const val = element.value || '';
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;

    if (direction === 'left') {
      return start === 0 && end === 0;
    }
    if (direction === 'right') {
      return start === val.length;
    }
    // Single-line inputs have no vertical caret movement
    return true;
  }

  if (element instanceof HTMLTextAreaElement) {
    const val = element.value || '';
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;

    if (direction === 'left') return start === 0 && end === 0;
    if (direction === 'right') return start === val.length;
    if (direction === 'up') return start === 0 && end === 0;
    if (direction === 'down') return start === val.length;
    return true;
  }

  // Non-input elements (buttons, cards, table rows) always allow spatial navigation
  return true;
}

/**
 * Safely focuses an element by ID or selector.
 */
export function focusSpatialTarget(target: string | (() => HTMLElement | null | void) | null | undefined): boolean {
  if (!target) return false;

  let el: HTMLElement | null = null;
  if (typeof target === 'function') {
    const res = target();
    if (res instanceof HTMLElement) {
      el = res;
    } else {
      return true; // callback handled its own navigation
    }
  } else if (typeof target === 'string') {
    if (target.startsWith('#') || target.startsWith('.') || target.includes(' ')) {
      el = document.querySelector(target) as HTMLElement | null;
    } else {
      el = document.getElementById(target) || (document.querySelector(target) as HTMLElement | null);
    }
  }

  if (el) {
    el.focus();
    if (el instanceof HTMLInputElement && ['text', 'search', 'number', 'tel'].includes(el.type)) {
      el.select();
    }
    return true;
  }
  return false;
}

/**
 * Geometric 2D Fallback: Finds the closest visible focusable element in a given direction.
 */
export function findGeometricNeighbor(
  currentElement: HTMLElement,
  direction: SpatialDirection,
  containerSelector: string = 'body'
): HTMLElement | null {
  const container = document.querySelector(containerSelector) || document.body;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"], [data-spatial="true"]'
    )
  ).filter((el) => {
    if (el === currentElement) return false;
    // Check visibility
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  });

  const curRect = currentElement.getBoundingClientRect();
  const curCenter = {
    x: curRect.left + curRect.width / 2,
    y: curRect.top + curRect.height / 2,
  };

  let bestCandidate: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const candidate of focusables) {
    const candRect = candidate.getBoundingClientRect();
    const candCenter = {
      x: candRect.left + candRect.width / 2,
      y: candRect.top + candRect.height / 2,
    };

    const dx = candCenter.x - curCenter.x;
    const dy = candCenter.y - curCenter.y;

    let inDirection = false;
    let primaryDist = 0;
    let secondaryDist = 0;

    switch (direction) {
      case 'left':
        inDirection = dx < -5;
        primaryDist = -dx;
        secondaryDist = Math.abs(dy);
        break;
      case 'right':
        inDirection = dx > 5;
        primaryDist = dx;
        secondaryDist = Math.abs(dy);
        break;
      case 'up':
        inDirection = dy < -5;
        primaryDist = -dy;
        secondaryDist = Math.abs(dx);
        break;
      case 'down':
        inDirection = dy > 5;
        primaryDist = dy;
        secondaryDist = Math.abs(dx);
        break;
    }

    if (inDirection) {
      // Prioritize alignment in the primary direction with weight on perpendicular deviation
      const score = primaryDist + secondaryDist * 2.2;
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }
  }

  return bestCandidate;
}

/**
 * Handles keyboard events for spatial navigation.
 * Call this inside `onKeyDown` of any interactive element.
 */
export function handleSpatialKeyDown(
  e: React.KeyboardEvent<HTMLElement>,
  config: SpatialNavConfig,
  enableGeometricFallback: boolean = false
): void {
  const current = e.currentTarget;

  switch (e.key) {
    case 'ArrowLeft': {
      if (isAtCaretBoundary(current, 'left')) {
        if (config.left) {
          e.preventDefault();
          focusSpatialTarget(config.left);
        } else if (enableGeometricFallback) {
          const neighbor = findGeometricNeighbor(current, 'left');
          if (neighbor) {
            e.preventDefault();
            neighbor.focus();
          }
        }
      }
      break;
    }
    case 'ArrowRight': {
      if (isAtCaretBoundary(current, 'right')) {
        if (config.right) {
          e.preventDefault();
          focusSpatialTarget(config.right);
        } else if (enableGeometricFallback) {
          const neighbor = findGeometricNeighbor(current, 'right');
          if (neighbor) {
            e.preventDefault();
            neighbor.focus();
          }
        }
      }
      break;
    }
    case 'ArrowUp': {
      if (isAtCaretBoundary(current, 'up')) {
        if (config.up) {
          e.preventDefault();
          focusSpatialTarget(config.up);
        } else if (enableGeometricFallback) {
          const neighbor = findGeometricNeighbor(current, 'up');
          if (neighbor) {
            e.preventDefault();
            neighbor.focus();
          }
        }
      }
      break;
    }
    case 'ArrowDown': {
      if (isAtCaretBoundary(current, 'down')) {
        if (config.down) {
          e.preventDefault();
          focusSpatialTarget(config.down);
        } else if (enableGeometricFallback) {
          const neighbor = findGeometricNeighbor(current, 'down');
          if (neighbor) {
            e.preventDefault();
            neighbor.focus();
          }
        }
      }
      break;
    }
    case 'Enter': {
      if (config.enter) {
        if (!config.allowDefaultEnter) {
          e.preventDefault();
        }
        config.enter();
      }
      break;
    }
    case ' ': {
      if (config.space && !(current instanceof HTMLInputElement || current instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        config.space();
      }
      break;
    }
    case 'Escape': {
      if (config.escape) {
        e.preventDefault();
        config.escape();
      }
      break;
    }
  }
}

