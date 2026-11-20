import { extractGmail, gmailEmailOpen } from "./extract-gmail";
import { mountOverlay } from "./overlay";

mountOverlay({ isOpen: gmailEmailOpen, extract: extractGmail });
