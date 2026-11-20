import { extractOutlook, outlookEmailOpen } from "./extract-outlook";
import { mountOverlay } from "./overlay";

mountOverlay({ isOpen: outlookEmailOpen, extract: extractOutlook });
