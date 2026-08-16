import "server-only";

/**
 * ENABLE_TECH_VERTICAL="true" switches the whole app into Tech-only mode for a
 * client demo (Salto CloudWorks): no vertical selector anywhere, every workspace
 * is created as Tech, and Settings > Workspace locks the vertical to Tech.
 *
 * Off (default, or unset): the original multi-vertical selector (Hospitality /
 * Healthcare / Tech) is shown everywhere, unrestricted — exactly like before
 * this flag existed.
 */
export function techOnlyMode(): boolean {
  return process.env.ENABLE_TECH_VERTICAL === "true";
}
