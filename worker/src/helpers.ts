export function assertEnvComplete(
    requiredKeys: (keyof Env)[],
    env: Env
): asserts env is Required<Env> {
    const missingKeys = requiredKeys.filter(
        (key) => env[key] === undefined || env[key] === null || env[key] === ""
    );
    if (missingKeys.length > 0)
        throw new Error(`Missing required env var(s): ${missingKeys.join(", ")}`);
}

export function errorResponse(status: number, error: string, info: {}, headers?: {}) {
    console.error({ status, error, info });
    return new Response(JSON.stringify({ error, info }), { status, headers });
};
