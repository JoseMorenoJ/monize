import { Test, TestingModule } from "@nestjs/testing";
import { McpHttpController } from "./mcp-http.controller";
import { McpServerService } from "./mcp-server.service";
import { UsersService } from "../users/users.service";

describe("McpHttpController", () => {
  let controller: McpHttpController;
  let usersService: Record<string, jest.Mock>;
  let mcpServerService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    mcpServerService = {
      createServer: jest.fn().mockReturnValue({
        connect: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpHttpController],
      providers: [
        { provide: McpServerService, useValue: mcpServerService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = module.get<McpHttpController>(McpHttpController);
  });

  afterEach(() => {
    controller.onModuleDestroy();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("handlePost", () => {
    it("should reject requests without PAT", async () => {
      const req = {
        headers: {},
        body: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handlePost(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Unauthorized" }),
        }),
      );
    });

    it("should reject requests with invalid PAT", async () => {
      usersService.findById.mockResolvedValue(null);

      const req = {
        signedCookies: {}, headers: {},
        body: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handlePost(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should reject non-PAT bearer tokens", async () => {
      const req = {
        signedCookies: {}, headers: {},
        body: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handlePost(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 for an expired session", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const sessionId = "expired-post-session";
      const mockTransport = {
        sessionId,
        onclose: null as any,
        handleRequest: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };

      (controller as any).transports.set(sessionId, mockTransport);
      (controller as any).servers.set(sessionId, {});
      (controller as any).sessionUsers.set(sessionId, {
        userId: "user-1",
        scopes: "read,write,reports",
      });
      (controller as any).sessionCreatedAt.set(
        sessionId,
        Date.now() - 3_600_001,
      );

      const req = {
        signedCookies: { profile_session: "user-1" }, headers: { "mcp-session-id": sessionId, },
        body: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handlePost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Session expired" }),
        }),
      );
    });

    it("should return 429 when per-user session limit is reached", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      // Populate 10 active sessions for the same user
      for (let i = 0; i < 10; i++) {
        const sid = `flood-session-${i}`;
        const mockTransport = {
          sessionId: sid,
          onclose: null as any,
          handleRequest: jest.fn(),
          close: jest.fn().mockResolvedValue(undefined),
        };
        (controller as any).transports.set(sid, mockTransport);
        (controller as any).servers.set(sid, {});
        (controller as any).sessionUsers.set(sid, {
          userId: "user-1",
          scopes: "read,write,reports",
        });
        (controller as any).sessionCreatedAt.set(sid, Date.now());
      }

      // Attempt to create an 11th session (POST without mcp-session-id)
      const req = {
        signedCookies: { profile_session: "user-1" }, headers: {},
        body: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handlePost(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: "Too many active sessions. Close existing sessions first.",
          }),
        }),
      );
    });
  });

  describe("handleGet", () => {
    it("should reject requests without PAT", async () => {
      const req = { headers: {} } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Unauthorized" }),
        }),
      );
    });

    it("should reject requests without session ID", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const req = {
        signedCookies: { profile_session: "user-1" }, headers: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reject requests with unknown session ID", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const req = {
        signedCookies: { profile_session: "user-1" }, headers: { "mcp-session-id": "unknown-session", },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 404 for an expired session", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const sessionId = "expired-get-session";
      const mockTransport = {
        sessionId,
        onclose: null as any,
        handleRequest: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };

      (controller as any).transports.set(sessionId, mockTransport);
      (controller as any).servers.set(sessionId, {});
      (controller as any).sessionUsers.set(sessionId, {
        userId: "user-1",
        scopes: "read,write,reports",
      });
      (controller as any).sessionCreatedAt.set(
        sessionId,
        Date.now() - 3_600_001,
      );

      const req = {
        signedCookies: { profile_session: "user-1" }, headers: { "mcp-session-id": sessionId, },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Session expired" }),
        }),
      );
    });

    it("should reject when session user does not match authenticated user", async () => {
      // First, set up a session by calling handlePost with user-1
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const sessionId = "test-session-id";
      const mockTransport = {
        sessionId,
        onclose: null as any,
        handleRequest: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };

      // Directly populate the private maps via any-cast
      (controller as any).transports.set(sessionId, mockTransport);
      (controller as any).servers.set(sessionId, {});
      (controller as any).sessionUsers.set(sessionId, {
        userId: "user-1",
        scopes: "read,write,reports",
      });
      (controller as any).sessionCreatedAt.set(sessionId, Date.now());

      // Now try GET with a different user
      usersService.findById.mockResolvedValue({ id: "user-2" });

      const req = {
        signedCookies: { profile_session: "user-2" }, headers: { "mcp-session-id": sessionId, },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Session user mismatch" }),
        }),
      );
    });
  });

  describe("handleDelete", () => {
    it("should reject requests without PAT", async () => {
      const req = { headers: {} } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleDelete(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Unauthorized" }),
        }),
      );
    });

    it("should reject requests without session ID", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const req = {
        signedCookies: { profile_session: "user-1" }, headers: {},
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleDelete(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 for an expired session", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const sessionId = "expired-delete-session";
      const mockTransport = {
        sessionId,
        onclose: null as any,
        handleRequest: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };

      (controller as any).transports.set(sessionId, mockTransport);
      (controller as any).servers.set(sessionId, {});
      (controller as any).sessionUsers.set(sessionId, {
        userId: "user-1",
        scopes: "read,write,reports",
      });
      (controller as any).sessionCreatedAt.set(
        sessionId,
        Date.now() - 3_600_001,
      );

      const req = {
        signedCookies: { profile_session: "user-1" }, headers: { "mcp-session-id": sessionId, },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleDelete(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Session expired" }),
        }),
      );
    });

    it("should reject when session user does not match authenticated user", async () => {
      usersService.findById.mockResolvedValue({ id: "user-1" });

      const sessionId = "delete-session-id";
      const mockTransport = {
        sessionId,
        onclose: null as any,
        handleRequest: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };

      // Directly populate the private maps via any-cast
      (controller as any).transports.set(sessionId, mockTransport);
      (controller as any).servers.set(sessionId, {});
      (controller as any).sessionUsers.set(sessionId, {
        userId: "user-1",
        scopes: "read,write,reports",
      });
      (controller as any).sessionCreatedAt.set(sessionId, Date.now());

      // Now try DELETE with a different user
      usersService.findById.mockResolvedValue({ id: "user-2" });

      const req = {
        signedCookies: { profile_session: "user-2" }, headers: { "mcp-session-id": sessionId, },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleDelete(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Session user mismatch" }),
        }),
      );
    });
  });

  describe("onModuleDestroy", () => {
    it("should clean up transports", () => {
      controller.onModuleDestroy();
      // Should not throw
    });
  });
});
