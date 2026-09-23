// The slice of Google Identity Services' sign-in API (`google.accounts.id`)
// the app uses, and the loader for the script it lives in.

export interface GoogleCredentialResponse {
  /** The signed ID token. Only the server can tell whether it's genuine. */
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill";
    }
  ): void;
  /** Stops Google signing the user straight back in after they sign out. */
  disableAutoSelect(): void;
}

export const getGoogleAccountsId = (): GoogleAccountsId | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { google?: { accounts?: { id?: GoogleAccountsId } } }).google?.accounts?.id;

/** Loads Google's Identity Services script, once. It draws the sign-in button
 *  and produces the ID token the server verifies. It used to live in the Drive
 *  module; that module was removed in 0.32.0, when the account became the only
 *  cloud copy. */
export const loadGoogleGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (getGoogleAccountsId()) return resolve();

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google GIS script"));
    document.head.appendChild(script);
  });
};
