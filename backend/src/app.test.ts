import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("GET /api/health", () => {
  it("returns service status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("store-listien-api");
  });
});

describe("GET /api/sync/status", () => {
  it("reports that the backend is reachable", async () => {
    const res = await request(app).get("/api/sync/status");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reachable).toBe(true);
    expect(res.body.data.version).toBeTruthy();
  });
});

describe("POST /api/recordings", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).post("/api/recordings");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/recordings/batch", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).post("/api/recordings/batch");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/conversations/:id/translate", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).get("/api/conversations/00000000-0000-0000-0000-000000000000/translate?language=ur");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/conversations/:id/analysis", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).get("/api/conversations/00000000-0000-0000-0000-000000000000/analysis");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/conversations/:id/analyze", () => {
  it("rejects requests without a bearer token", async () => {
    const res = await request(app).post("/api/conversations/00000000-0000-0000-0000-000000000000/analyze");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("salesman and rules routes", () => {
  it("rejects unauthenticated performance, leaderboard, and rules requests", async () => {
    const performance = await request(app).get("/api/salesmen/00000000-0000-0000-0000-000000000000/performance");
    const leaderboard = await request(app).get("/api/salesmen/leaderboard");
    const rules = await request(app).get("/api/rules");
    const conversationRules = await request(app).get(
      "/api/conversations/00000000-0000-0000-0000-000000000000/rules",
    );

    expect(performance.status).toBe(401);
    expect(leaderboard.status).toBe(401);
    expect(rules.status).toBe(401);
    expect(conversationRules.status).toBe(401);
  });
});

describe("follow-up, customer, and notification routes", () => {
  it("rejects unauthenticated CRM requests", async () => {
    const followups = await request(app).get("/api/followups");
    const due = await request(app).get("/api/followups/due-today");
    const customers = await request(app).get("/api/customers");
    const notifications = await request(app).get("/api/notifications");

    expect(followups.status).toBe(401);
    expect(due.status).toBe(401);
    expect(customers.status).toBe(401);
    expect(notifications.status).toBe(401);
  });
});

describe("store, device, and realtime routes", () => {
  it("rejects unauthenticated multi-store requests", async () => {
    const stores = await request(app).get("/api/stores");
    const devices = await request(app).get("/api/devices");
    const activity = await request(app).get("/api/activity");
    const me = await request(app).get("/api/me");
    const realtime = await request(app).get("/api/realtime/conversations");

    expect(stores.status).toBe(401);
    expect(devices.status).toBe(401);
    expect(activity.status).toBe(401);
    expect(me.status).toBe(401);
    expect(realtime.status).toBe(401);
  });
});

describe("whatsapp, sms, and communication routes", () => {
  it("rejects unauthenticated messaging requests", async () => {
    const status = await request(app).get("/api/whatsapp/status");
    const connect = await request(app).post("/api/whatsapp/connect");
    const send = await request(app).post("/api/whatsapp/send");
    const logout = await request(app).post("/api/whatsapp/logout");
    const templates = await request(app).get("/api/whatsapp/templates");
    const sms = await request(app).post("/api/sms/send");
    const smsStatus = await request(app).get("/api/sms/status/00000000-0000-0000-0000-000000000000");
    const comm = await request(app).get("/api/communication/settings");

    expect(status.status).toBe(401);
    expect(connect.status).toBe(401);
    expect(send.status).toBe(401);
    expect(logout.status).toBe(401);
    expect(templates.status).toBe(401);
    expect(sms.status).toBe(401);
    expect(smsStatus.status).toBe(401);
    expect(comm.status).toBe(401);
    expect(status.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("report and export routes", () => {
  it("rejects unauthenticated report and export requests", async () => {
    const reports = await request(app).get("/api/reports");
    const store = await request(app).get("/api/reports/store");
    const csv = await request(app).get("/api/export/conversations");
    const retention = await request(app).get("/api/retention/status");

    expect(reports.status).toBe(401);
    expect(store.status).toBe(401);
    expect(csv.status).toBe(401);
    expect(retention.status).toBe(401);
  });
});
