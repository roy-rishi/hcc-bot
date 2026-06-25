import nJwt from 'njwt';


export let createJwt = function (payload: {}, expirationMins: number, signingKey: string): string {
    const token = nJwt.create(payload, signingKey);
    token.setExpiration(new Date(Date.now() + (expirationMins * 60 * 1000)));
    return token.compact();
};

export let errorResponse = function (status: number, error: string, info: {}, headers?: {}) {
    console.error({status, error, info});
    return new Response(JSON.stringify({error, info}), {status, headers});
};
