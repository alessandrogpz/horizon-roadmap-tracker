import { describe, it, expect } from "vitest";
import { isLocalRequest } from "../server/localRequest";

/** A request carrying exactly the given headers, as the dev server sees it. */
function req(headers: Record<string, string>, method = "POST"): Request {
  return new Request("http://localhost:3000/api/open", { method, headers });
}

describe("isLocalRequest", () => {
  describe("allows", () => {
    it("the app's own fetch", () => {
      expect(
        isLocalRequest(req({ host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))
      ).toBe(true);
    });

    it("a URL typed into the address bar", () => {
      expect(isLocalRequest(req({ host: "localhost:3000", "sec-fetch-site": "none" }, "GET"))).toBe(true);
    });

    it("a same-origin GET, which carries no Origin", () => {
      expect(isLocalRequest(req({ host: "localhost:3000", "sec-fetch-site": "same-origin" }, "GET"))).toBe(true);
    });

    it("a non-browser client on this machine", () => {
      expect(isLocalRequest(req({ host: "localhost:3000" }))).toBe(true);
    });

    it("127.0.0.1 and [::1]", () => {
      expect(isLocalRequest(req({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }))).toBe(true);
      expect(isLocalRequest(req({ host: "[::1]:3000", origin: "http://[::1]:3000" }))).toBe(true);
    });

    it("an Origin that spells out the default port", () => {
      expect(isLocalRequest(req({ host: "localhost", origin: "http://localhost:80" }))).toBe(true);
    });
  });

  describe("refuses", () => {
    it("a cross-site POST from another website (the CSRF case)", () => {
      expect(
        isLocalRequest(req({ host: "localhost:3000", origin: "https://evil.example", "sec-fetch-site": "cross-site" }))
      ).toBe(false);
    });

    it("a cross-site POST from a browser that sends no Sec-Fetch-Site", () => {
      expect(isLocalRequest(req({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(false);
    });

    it("a cross-site GET, e.g. an <img> pointing at the route", () => {
      expect(isLocalRequest(req({ host: "localhost:3000", "sec-fetch-site": "cross-site" }, "GET"))).toBe(false);
    });

    it("another local app on a different port", () => {
      expect(
        isLocalRequest(req({ host: "localhost:3000", origin: "http://localhost:5173", "sec-fetch-site": "same-site" }))
      ).toBe(false);
    });

    it("localhost reached from 127.0.0.1, which is a different origin", () => {
      expect(isLocalRequest(req({ host: "localhost:3000", origin: "http://127.0.0.1:3000" }))).toBe(false);
    });

    it("an opaque 'null' Origin", () => {
      expect(isLocalRequest(req({ host: "localhost:3000", origin: "null" }))).toBe(false);
    });

    it("a request addressed to a LAN IP", () => {
      expect(isLocalRequest(req({ host: "192.168.0.253:3000" }))).toBe(false);
    });

    it("DNS rebinding, where Host is the attacker's name", () => {
      expect(isLocalRequest(req({ host: "evil.example:3000", origin: "http://evil.example:3000" }))).toBe(false);
    });

    it("a Host that only looks local", () => {
      expect(isLocalRequest(req({ host: "localhost@evil.example" }))).toBe(false);
      expect(isLocalRequest(req({ host: "0.0.0.0:3000" }))).toBe(false);
      expect(isLocalRequest(req({ host: "bad host" }))).toBe(false);
    });

    it("a missing Host", () => {
      expect(isLocalRequest(req({}))).toBe(false);
    });
  });
});
