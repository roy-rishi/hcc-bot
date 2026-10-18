import * as schema from '../schemas';
import * as helpers from "../helpers";
import { validateAndParseJwt } from '../jwt';
import { CORS_HEADERS } from '../constants';
import { addRole, editNickname, getMember, sendConfirmMessage } from '../discord'


// top-level handler for verification endpoint
export let verification = async function (reqBodyRaw: string, env: Required<Env>): Promise<Response> {
    // parse request body for JWT
    let jwt: string;
    try {
        jwt = schema.Token.parse(JSON.parse(reqBodyRaw)).token;
    } catch (e) {
        return helpers.errorResponse(401, "Failed to parse request body for JWT", { e }, CORS_HEADERS)
    }

    // rate limit this endpoint based on the token
    const { success } = await env.VERIFY_LIMITER.limit({ key: jwt });
    if (!success)
        return helpers.errorResponse(429, "Exceeded rate limits", {}, CORS_HEADERS);

    // validate JWT and parse payload
    let jwtPayload: schema.JwtPayload;
    try {
        jwtPayload = await validateAndParseJwt(jwt, env.JWT_KEY);
    } catch (e) {
        return helpers.errorResponse(401, "Failed to validate and parse JWT", { e }, CORS_HEADERS);
    }
    const discordId = jwtPayload.discordId;
    const name = jwtPayload.name;

    // add email verified role
    try {
        // TODO: pre-release change
        // await addRole(env.DISCORD_EMAIL_ROLE_ID, discordId, env.DISCORD_GUILD_ID, env.DISCORD_BOT_TOKEN);
        await addRole(env.DISCORD_MEMBER_ROLE_ID, discordId, env.DISCORD_GUILD_ID, env.DISCORD_BOT_TOKEN);
    } catch (e) {
        return helpers.errorResponse(500, "Failed to add Discord role: verified email", { e });
    }

    // TODO: pre-release change
    // // if the member already has the quiz passed role, give them the full member role
    // try {
    //     // get member roles
    //     const roles = (await getMember(discordId, env.DISCORD_GUILD_ID, env.DISCORD_BOT_TOKEN)).roles;
    //     if (roles.includes(env.DISCORD_QUIZ_ROLE_ID)) {
    //         // member already passed quiz, add full member role
    //         addRole(env.DISCORD_MEMBER_ROLE_ID, discordId, env.DISCORD_GUILD_ID, env.DISCORD_BOT_TOKEN);
    //     }
    // } catch (e) {
    //     return helpers.errorResponse(500, "Failed get Discord roles or to add role: full member", { e });
    // }

    // concurrently edit nickname and send confirmation message
    const [nicknameRes, messageRes] = await Promise.allSettled([
        editNickname(name, discordId, env.DISCORD_GUILD_ID, env.DISCORD_BOT_TOKEN),
        sendConfirmMessage(discordId, env.DISCORD_LOGS_CHANNEL_ID, env.DISCORD_BOT_TOKEN)
    ]);
    if (nicknameRes.status === "rejected")
        console.error({ error: "Failed to edit nickname", info: nicknameRes.reason });
    if (messageRes.status === "rejected")
        console.error({ error: "Failed to send confirmation message", info: messageRes.reason });

    // return success
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}
