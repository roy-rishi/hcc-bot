import nJwt from 'njwt';

export let createJwt = function (payload: {}, expirationMins: number, signingKey: string): string {
    const token = nJwt.create(payload, signingKey);
    token.setExpiration(new Date(Date.now() + (expirationMins * 60 * 1000)));
    return token.compact();
}
