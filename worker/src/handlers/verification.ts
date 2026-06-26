import nJwt from 'njwt';
import * as schema from '../schemas';
import * as helpers from "../helpers";
import { CORS_HEADERS, DISCORD_HEADERS } from '../constants';

// validate JWT and parse its payload
let validateAndParseJwt = function (rawJwt: string, signingKey: string): [string, string] {
    // validate JWT
    const verifiedJwt = nJwt.verify(rawJwt, signingKey);
    if (!verifiedJwt)
        throw new Error("Invalid JWT");

    // parse JWT payload
    const payload = schema.JwtPayload.parse(verifiedJwt.body);
    return [payload.discordId, payload.name];
}

// add role to member
let addRole = async function (memberId: string) {
    const res = await fetch(
        `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${memberId}/roles/${process.env.DISCORD_ROLE_ID}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            ...DISCORD_HEADERS,
        }
    });
    if (!res.ok)
        throw new Error(await res.text());
}

// edit member nickname
let editNickname = async function (memberId: string, toName: string) {
    const res = await fetch(
        `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${memberId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            ...DISCORD_HEADERS,
        },
        body: JSON.stringify({
            nick: toName
        })
    });
    if (!res.ok)
        throw new Error(await res.text());
}

// send a confirmation message
let sendConfirmMessage = async function (memberId: string) {
    const res = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_LOGS_CHANNEL_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            ...DISCORD_HEADERS,
        },
        body: JSON.stringify({
            content: `You're verified, <@${memberId}>!`
        })
    });
    if (!res.ok)
        throw new Error(await res.text());
}

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
    let discordId: string, name: string;
    try {
        [discordId, name] = validateAndParseJwt(jwtStr, process.env.JWT_KEY!);
    } catch (e) {
        return helpers.errorResponse(401, "Invalid JWT", { e }, CORS_HEADERS);
    }

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
