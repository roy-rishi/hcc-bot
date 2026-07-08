import { test, expect, vi, describe, beforeEach } from 'vitest'
import { createJwt, validateAndParseJwt } from '../src/jwt';
import * as schema from "../src/schemas"


describe("integration between jwtCreate and validateAndParseJwt", () => {
    const payload: schema.JwtPayload = {
        name: "tadej focaccia",
        discordId: "12",
        interactionToken: "token",
    };
    const durationMins = 10;
    const signingKey = "super-secret-key";
    const creationDate = new Date("2026-01-01T00:00:00");

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(creationDate);
    });

    test("valid JWT", async () => {
        const jwt = await createJwt(payload, durationMins, signingKey);
        // 1 minute before expiration
        vi.setSystemTime(creationDate.getMilliseconds() + ((durationMins - 1) * 60 * 1000));
        const res = await validateAndParseJwt(jwt, signingKey);
        expect(res).toEqual(payload);
    });

    test("expired JWT", async () => {
        const jwt = await createJwt(payload, durationMins, signingKey);
        // 1 minute after expiration
        vi.setSystemTime(creationDate.getTime() + ((durationMins + 1) * 60 * 1000));
        await expect(validateAndParseJwt(jwt, signingKey)).rejects.toThrow(`"exp" claim timestamp check failed`);
    });
});
