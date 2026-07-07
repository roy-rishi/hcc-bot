import { test, expect, vi, describe, beforeEach } from 'vitest'
import { validateAndParseJwt } from '../src/handlers/verification'


// mock dependencies
const mocks = vi.hoisted(() => {
    return {
        mockVerify: vi.fn(),
        mockParse: vi.fn(),
    }
})

vi.mock('njwt', () => {
    return {
        verify: mocks.mockVerify,
        default: {
            verify: mocks.mockVerify
        }
    };
});

vi.mock('../src/schemas', () => {
    return {
        JwtPayload: {
            parse: mocks.mockParse
        }
    }
});

// test suite
describe("validateAndParseJwt", () => {
    const mockRawJwt = "header.payload.signature";
    const mockSigningKey = "testkey";
    const mockJwtBody = {
        discordId: "12",
        name: "tadej focaccia",
        interactionToken: "fake-token",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // default values
        vi.mocked(mocks.mockVerify).mockReturnValue({ body: mockJwtBody } as any);
        vi.mocked(mocks.mockParse).mockReturnValue(mockJwtBody);
    });

    // parse a valid JWT
    test("valid JWT and body", () => {
        expect(validateAndParseJwt(mockRawJwt, mockSigningKey)).toStrictEqual(["12", "tadej focaccia"]);
    });

    // test invalid JWT (expired, poorly formed, bad signature, etc)
    test("JWT verification failure", () => {
        vi.mocked(mocks.mockVerify).mockImplementationOnce(() => {
            throw new Error("JWT verification failed");
        });

        expect(() => validateAndParseJwt(mockRawJwt, mockSigningKey)).toThrow("JWT verification failed");
    });

    // JWT body does not match schema
    test("invalid JWT body", () => {
        vi.mocked(mocks.mockParse).mockImplementationOnce(() => {
            throw new Error("invalid JWT body");
        });

        expect(() => validateAndParseJwt(mockRawJwt, mockSigningKey)).toThrow("invalid JWT body");
    });
});
