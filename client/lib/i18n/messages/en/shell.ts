/**
 * The English text of the app — the master copy every other language is
 * checked against.
 *
 * Keys are the English sentences themselves. That keeps the call sites
 * readable (`t("Save settings")`), makes a missing translation obvious — the
 * English shows through — and means the wording in the interface and the
 * wording in the dictionary can never drift apart.
 *
 * The file is split by domain so each one can be worked on without the others
 * in the way; `index.ts` merges them into the single map the app reads.
 */

export const shell = {
  /* Navigation */
  "Overview": "Overview",
  "Operations": "Operations",
  "Tools": "Tools",
  "Dashboard": "Dashboard",
  "Reports": "Reports",
  "Sales": "Sales",
  "Expenses": "Expenses",
  "Products": "Products",
  "Calculator": "Calculator",
  "Database": "Database",
  "Server": "Server",
  "Settings": "Settings",
  "Key numbers and trends": "Key numbers and trends",
  "Deeper analytics and charts": "Deeper analytics and charts",
  "Bills and custom orders": "Bills and custom orders",
  "Spending and suppliers": "Spending and suppliers",
  "Catalogue and pricing": "Catalogue and pricing",
  "Price and cost maths": "Price and cost maths",
  "Read-only collection browser": "Read-only collection browser",
  "Backend health and endpoints": "Backend health and endpoints",
  "Shop profile and invoice": "Shop profile and invoice",

  /* Topbar and sidebar */
  "Open navigation": "Open navigation",
  "Close navigation": "Close navigation",
  "Refresh data": "Refresh data",
  "Amare Handmades": "Amare Handmades",
  "Handmade with Love": "Handmade with Love",
  "Syncing…": "Syncing…",
  "Sync now": "Sync now",
  "Synced {time}": "Synced {time}",

  /* Theme */
  "Light": "Light",
  "Dark": "Dark",
  "System": "System",
  "Colour theme": "Colour theme",

  /* Account */
  "Account menu": "Account menu",
  "Signed in to Amare admin": "Signed in to Amare admin",
  "Sign out": "Sign out",
  "owner": "owner",
  "admin": "admin",

  /* Server status */
  "Checking": "Checking",
  "Online": "Online",
  "Offline": "Offline",
  "Server online": "Server online",
  "Server unreachable": "Server unreachable",
  "Checking server…": "Checking server…",

  /* Splash */
  "Preparing your workspace…": "Preparing your workspace…",
  "Checking your session…": "Checking your session…",
  "The server sleeps when idle, so the very first request can take up to a minute. Thanks for waiting.":
    "The server sleeps when idle, so the very first request can take up to a minute. Thanks for waiting.",

  /* Language switcher */
  "App language": "App language",
  "Choose the language the admin reads in.": "Choose the language the admin reads in.",
  "Fully translated": "Fully translated",
  "Translated to English": "Translated to English",
  "These languages are translated into English as you use them.":
    "These languages are translated into English as you use them.",
};
