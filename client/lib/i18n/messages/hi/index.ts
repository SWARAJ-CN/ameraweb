import { shell } from "./shell";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { sales } from "./sales";
import { expenses } from "./expenses";
import { products } from "./products";
import { tools } from "./tools";
import { settings } from "./settings";
import type { en } from "../en";

/**
 * The hi translation of every message in the app.
 *
 * Typed against the English master copy: a message that exists in English but
 * not here is a build error, so a language can never quietly lose a line.
 */
export const hi: Record<keyof typeof en, string> = {
  ...shell,
  ...common,
  ...dashboard,
  ...sales,
  ...expenses,
  ...products,
  ...tools,
  ...settings,
};

export { shell };
export { common };
export { dashboard };
export { sales };
export { expenses };
export { products };
export { tools };
export { settings };
