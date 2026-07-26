/** Asks the local-only /api/open route to hand a path or URL to the desktop's
 *  default application. Only reachable when the app is served from localhost;
 *  see lib/server/localRequest.ts. */
export const openLinkOnSystem = async (link: string) => {
  const res = await fetch("/api/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link }),
  });
  if (!res.ok) throw new Error("Failed to open link");
  return res.json();
};

/** Opens a material/project link the right way: real URLs in a new tab,
 *  local paths through the desktop handler above. */
export const openLink = async (link: string): Promise<void> => {
  if (!link) return;
  if (link.startsWith("http://") || link.startsWith("https://")) {
    window.open(link, "_blank", "noopener,noreferrer");
    return;
  }
  await openLinkOnSystem(link);
};
