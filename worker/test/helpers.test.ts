import { test, expect, describe } from 'vitest'
import { assertEnvComplete } from '../src/helpers'


describe("assertEnvComplete()", () => {
    test("identifies that required keys are defined in mock env", () => {
        const mockEnv: Env = {
            DISCORD_BOT_TOKEN: "t0k3n",
            RESEND_KEY: "k3y",
        } as Env;
        expect(() => assertEnvComplete(["DISCORD_BOT_TOKEN", "RESEND_KEY"], mockEnv)).not.toThrow();
    });

    test("throws on missing key", () => {
        const mockEnv: Env = {
            DISCORD_BOT_TOKEN: "t0k3n",
            RESEND_KEY: "k3y",
        } as Env;
        expect(() => assertEnvComplete(["JWT_KEY"], mockEnv)).toThrow();
    });

    test("throws on empty-string value for required key", () => {
        const mockEnv: Env = {
            DISCORD_BOT_TOKEN: "t0k3n",
            RESEND_KEY: "",
        } as Env;
        expect(() => assertEnvComplete(["DISCORD_BOT_TOKEN", "RESEND_KEY"], mockEnv)).toThrow();
    });
});
