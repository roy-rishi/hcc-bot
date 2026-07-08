import { DISCORD_HEADERS } from './constants';


// add role to member
export let addRole = async function (memberId: string) {
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
export let editNickname = async function (memberId: string, toName: string) {
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
export let sendConfirmMessage = async function (memberId: string) {
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
