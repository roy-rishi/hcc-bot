import * as schema from '../schemas';
import * as helpers from "../helpers";
import { validateAndParseJwt } from '../jwt';
import { CORS_HEADERS } from '../constants';
import { addRole, editNickname, sendConfirmMessage } from '../discord'


// top-level handler for verification endpoint
export let verification = async function (reqBodyRaw: string): Promise<Response> {
    // parse request body for JWT
    let jwtStr: string;
    try {
        jwtStr = schema.Token.parse(JSON.parse(reqBodyRaw)).token;
    } catch (e) {
        return helpers.errorResponse(401, "Could not parse req body for JWT", { e }, CORS_HEADERS)
    }

    // validate JWT and parse payload
    let payload: schema.JwtPayload;
    try {
        payload = await validateAndParseJwt(jwtStr, process.env.JWT_KEY!);
    } catch (e) {
        return helpers.errorResponse(401, "Invalid JWT", { e }, CORS_HEADERS);
    }
    const discordId = payload.discordId;
    const name = payload.name;

    // add discord role
    try {
        await addRole(discordId);
    } catch (e) {
        return helpers.errorResponse(500, "Could not add role", { e }, CORS_HEADERS);
    }

    // concurrently edit nickname and send confirmation message
    const [nicknameRes, messageRes] = await Promise.allSettled([
        editNickname(discordId, name),
        sendConfirmMessage(discordId)
    ]);
    if (nicknameRes.status === "rejected")
        console.error({ error: "Could not edit nickname", info: nicknameRes.reason });
    if (messageRes.status === "rejected")
        console.error({ error: "Could not send confirmation message", info: messageRes.reason });

    // return success
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}
