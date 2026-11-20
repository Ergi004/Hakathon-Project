import { extractOpenEmail } from "./adapters";

/**
 * Injected on click with chrome.scripting.executeScript (activeTab). It only
 * registers a function; the popup then calls it in the same isolated world.
 * Nothing runs until the user asks, and nothing is read in the background.
 */
(globalThis as unknown as { __mburojaExtract: typeof extractOpenEmail }).__mburojaExtract = extractOpenEmail;
