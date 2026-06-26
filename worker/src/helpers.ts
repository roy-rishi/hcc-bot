export let errorResponse = function (status: number, error: string, info: {}, headers?: {}) {
    console.error({ status, error, info });
    return new Response(JSON.stringify({ error, info }), { status, headers });
};
