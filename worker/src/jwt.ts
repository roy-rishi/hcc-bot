import { SignJWT, jwtVerify } from 'jose';
import * as schema from '../src/schemas'


function getKey(signingKey: string) {
  return new TextEncoder().encode(signingKey);
}

// create a JWT string with payload, signed by signingKey, and expiring in expirationMins
export async function createJwt(payload: schema.JwtPayload, expirationMins: number, signingKey: string): Promise<string> {
    return new SignJWT({...payload})
        .setProtectedHeader({alg: "HS256"})
        .setIssuedAt()
        .setExpirationTime(`${expirationMins} minutes`)
        .sign(getKey(signingKey));
};

// validate JWT and parse its payload
export async function validateAndParseJwt(rawJwt: string, signingKey: string): Promise<schema.JwtPayload> {
    // validate JWT
    const { payload } = await jwtVerify(rawJwt, getKey(signingKey));

    // parse JWT payload
    return schema.JwtPayload.parse(payload);
}
