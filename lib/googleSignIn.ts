// The slice of Google Identity Services' sign-in API (`google.accounts.id`)
// the app uses. It comes from the same script as Drive's token client, loaded
// by loadGoogleGisScript in lib/googleDrive.ts.

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
