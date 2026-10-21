import assert from "node:assert/strict";
import test from "node:test";
import { assertE2ETargetAllowed } from "../e2e/safety.mjs";

test("allows local app and local Supabase without remote opt-in", () => {
  assert.doesNotThrow(() => assertE2ETargetAllowed({
    baseURL: "http://localhost:8080",
    apiURLs: ["http://127.0.0.1:54321"],
    allowRemote: false,
    explicitEmail: false,
  }));
});

test("allows IPv6 loopback targets", () => {
  assert.doesNotThrow(() => assertE2ETargetAllowed({
    baseURL: "http://[::1]:8080",
    apiURLs: ["http://[::1]:54321"],
    allowRemote: false,
    explicitEmail: false,
  }));
});

test("blocks a remote Supabase target by default", () => {
  assert.throws(() => assertE2ETargetAllowed({
    baseURL: "http://localhost:8080",
    apiURLs: ["https://project.supabase.co"],
    allowRemote: false,
    explicitEmail: true,
  }), /E2E bloqueado/);
});

test("blocks a remote app target by default", () => {
  assert.throws(() => assertE2ETargetAllowed({
    baseURL: "https://app.example.com",
    apiURLs: ["http://127.0.0.1:54321"],
    allowRemote: false,
    explicitEmail: true,
  }), /E2E bloqueado/);
});

test("requires an explicit test account for an opted-in remote target", () => {
  assert.throws(() => assertE2ETargetAllowed({
    baseURL: "http://localhost:8080",
    apiURLs: ["https://project.supabase.co"],
    allowRemote: true,
    explicitEmail: false,
  }), /E2E_AUTH_EMAIL explícito/);
});

test("allows a remote target only with explicit opt-in and account", () => {
  assert.doesNotThrow(() => assertE2ETargetAllowed({
    baseURL: "https://staging.example.com",
    apiURLs: ["https://project.supabase.co"],
    allowRemote: true,
    explicitEmail: true,
  }));
});

test("does not let a local URL mask another configured remote Supabase URL", () => {
  assert.throws(() => assertE2ETargetAllowed({
    baseURL: "http://localhost:8080",
    apiURLs: ["http://127.0.0.1:54321", "https://project.supabase.co"],
    allowRemote: false,
    explicitEmail: true,
  }), /E2E bloqueado/);
});
