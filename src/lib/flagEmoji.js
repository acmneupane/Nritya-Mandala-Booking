// Windows has no country-flag emojis: 🇳🇵 shows up as the letters "NP" there,
// in every browser except Firefox. On those devices only, this loads a small
// flag-only font (Twemoji Country Flags, ~78 KB, served from our own site) and
// registers it under the same names as our text fonts, limited to the flag
// characters — so flags render everywhere Inter/Fraunces are used, without
// touching any styles. Devices that already draw flags (Mac, iPhone, Android)
// skip it entirely and keep their own flag emojis.
//
// Flag artwork: Twemoji by Twitter, CC-BY 4.0 (https://github.com/twitter/twemoji).
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import flagFontUrl from "country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url";

export function installFlagEmojiFont() {
  try {
    polyfillCountryFlagEmojis("Inter", flagFontUrl);
    polyfillCountryFlagEmojis("Fraunces", flagFontUrl);
  } catch {
    // Worst case flags stay as letters, as before.
  }
}
