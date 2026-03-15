/**
 * Template renderer
 *
 * Provides a lightweight variable-substitution engine for string templates.
 * Templates use `{{variableName}}` placeholders (Handlebars/Mustache style).
 *
 * This renderer is intentionally simple – it performs literal string
 * replacement only and does NOT support conditionals, loops, or partials.
 * Complex HTML rendering is delegated to SendGrid's server-side Handlebars
 * engine via Dynamic Templates.
 *
 * Usage:
 *   renderTemplateString("Hello, {{firstName}}!", { firstName: "Jane" })
 *   // → "Hello, Jane!"
 */

/** Options controlling renderer behaviour. */
export interface RendererOptions {
  /**
   * When true (default), throws if a placeholder is found with no matching
   * variable in the data object.  Set to false to leave unresolved placeholders
   * in place (useful for partial rendering / debugging).
   */
  strictMode?: boolean;

  /**
   * Fallback value to use for missing variables when strictMode is false.
   * Defaults to an empty string.
   */
  fallback?: string;
}

/** Regex matching {{variableName}} placeholders (greedy variable names). */
const PLACEHOLDER_REGEX = /\{\{([^{}]+?)\}\}/g;

/**
 * Renders a template string by substituting `{{variableName}}` placeholders
 * with values from the provided data object.
 *
 * @param template - Template string containing zero or more `{{...}}` placeholders.
 * @param data     - Key-value map of variable substitutions.
 * @param options  - Renderer options.
 * @returns Rendered string with all placeholders replaced.
 * @throws {Error} When strictMode is true and a placeholder has no matching variable.
 *
 * @example
 * renderTemplateString("Hi {{firstName}}, your refund of {{amount}} is approved!", {
 *   firstName: "Jane",
 *   amount: "$1,234.00",
 * });
 * // → "Hi Jane, your refund of $1,234.00 is approved!"
 */
export function renderTemplateString(
  template: string,
  data: Record<string, string | number | boolean | null | undefined>,
  options: RendererOptions = {},
): string {
  const { strictMode = true, fallback = "" } = options;

  return template.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    const trimmedKey = key.trim();

    if (!(trimmedKey in data)) {
      if (strictMode) {
        throw new Error(
          `Template variable "{{${trimmedKey}}}" has no matching value in the data object. ` +
            `Available keys: ${Object.keys(data).join(", ") || "(none)"}`,
        );
      }
      return fallback;
    }

    const value = data[trimmedKey];

    if (value === null || value === undefined) {
      return fallback;
    }

    return String(value);
  });
}

/**
 * Renders a template string with HTML-escaped values to prevent XSS when
 * the output will be embedded in an HTML context.
 *
 * Only the substituted values are escaped; the template skeleton is passed
 * through as-is (it is assumed to be trusted markup).
 *
 * @param template - HTML template string containing `{{...}}` placeholders.
 * @param data     - Key-value map of variable substitutions (values will be escaped).
 * @param options  - Renderer options.
 * @returns Rendered HTML string with escaped variable values.
 */
export function renderHtmlTemplateString(
  template: string,
  data: Record<string, string | number | boolean | null | undefined>,
  options: RendererOptions = {},
): string {
  const escapedData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v != null ? escapeHtml(String(v)) : v]),
  );
  return renderTemplateString(template, escapedData, options);
}

/**
 * Escapes special HTML characters to prevent XSS.
 *
 * @param str - Raw string to escape.
 * @returns HTML-safe string.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Extracts all placeholder variable names from a template string.
 * Useful for validating that all required variables are supplied before rendering.
 *
 * @param template - Template string to inspect.
 * @returns Array of unique variable names found in the template.
 *
 * @example
 * extractPlaceholders("Hi {{firstName}}, your {{taxYear}} refund is ready.")
 * // → ["firstName", "taxYear"]
 */
export function extractPlaceholders(template: string): string[] {
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(PLACEHOLDER_REGEX.source, "g");

  while ((match = regex.exec(template)) !== null) {
    const key = match[1]?.trim();
    if (key) names.add(key);
  }

  return Array.from(names);
}

/**
 * Validates that all placeholders in a template have matching keys in the
 * provided data object.
 *
 * @param template - Template string to validate.
 * @param data     - Data object to check against.
 * @returns Object with `valid` flag and array of any missing variable names.
 */
export function validateTemplateData(
  template: string,
  data: Record<string, unknown>,
): { valid: boolean; missingKeys: string[] } {
  const required = extractPlaceholders(template);
  const missingKeys = required.filter((key) => !(key in data));
  return { valid: missingKeys.length === 0, missingKeys };
}
