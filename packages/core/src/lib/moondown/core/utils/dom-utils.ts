
/**
 * Utility functions for DOM manipulation
 */

/**
 * Creates a DOM element with class names and attributes
 * @param tag - HTML tag name
 * @param className - CSS class names (space-separated)
 * @param attributes - Object of attribute key-value pairs
 * @returns Created HTML element
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  
  if (className) {
    element.className = className;
  }
  
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  return element;
}

/**
 * Creates a Lucide icon element
 * @param iconName - Name of the Lucide icon
 * @param className - Optional CSS class
 * @returns Span element containing the icon
 */
export function createIconElement(iconName: string, className?: string): HTMLSpanElement {
  const wrapper = createElement('span', className);
  wrapper.innerHTML = `<i data-lucide="${iconName}"></i>`;
  return wrapper;
}

/**
 * Safely removes an element from the DOM
 * @param element - Element to remove
 */
export function removeElement(element: HTMLElement | null): void {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Checks if an element is visible in the viewport
 * @param element - Element to check
 * @param container - Container element (optional)
 * @returns True if element is visible
 */
export function isElementVisible(
  element: HTMLElement,
  container?: HTMLElement
): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container
    ? container.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  
  return (
    elementRect.top >= containerRect.top &&
    elementRect.bottom <= containerRect.bottom &&
    elementRect.left >= containerRect.left &&
    elementRect.right <= containerRect.right
  );
}

/**
 * Scrolls an element into view within a container
 * @param element - Element to scroll into view
 * @param container - Container element
 */
export function scrollIntoView(element: HTMLElement, container: HTMLElement): void {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  if (elementRect.top < containerRect.top) {
    container.scrollTop = element.offsetTop;
  } else if (elementRect.bottom > containerRect.bottom) {
    container.scrollTop = element.offsetTop + element.offsetHeight - container.clientHeight;
  }
}

/**
 * Gets all data attributes from an element
 * @param element - HTML element
 * @returns Object with data attributes
 */
export function getDataAttributes(element: HTMLElement): Record<string, string> {
  const data: Record<string, string> = {};
  
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-')) {
      const key = attr.name.slice(5); // Remove 'data-' prefix
      data[key] = attr.value;
    }
  });
  
  return data;
}

/**
 * Prevents default event behavior and stops propagation
 * @param event - Event to prevent
 */
export function preventDefault(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Debounces a function call
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}
