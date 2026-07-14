import { DISCORD_HEADERS, EMOJIS } from './constants';


// add role to member
export let addRole = async function (roleId: string, memberId: string, guildId: string, botToken: string) {
    const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bot ${botToken}`,
            ...DISCORD_HEADERS,
        }
    });
    if (!res.ok)
        throw new Error(await res.text());
}

// edit member nickname
export let editNickname = async function (newName: string, memberId: string, guildId: string, botToken: string) {
    const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bot ${botToken}`,
            ...DISCORD_HEADERS,
        },
        body: JSON.stringify({
            nick: newName
        })
    });
    if (!res.ok)
        throw new Error(await res.text());
}

// send a confirmation message
export let sendConfirmMessage = async function (memberId: string, logsChannelId: string, botToken: string) {
    // create confirmation message
    const randomEmoji: string = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const message = `You're verified, <@${memberId}>! ${randomEmoji}`;

    // send the message into the logs channel
    const res = await fetch(
        `https://discord.com/api/v10/channels/${logsChannelId}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${botToken}`,
            ...DISCORD_HEADERS,
        },
        body: JSON.stringify({
            content: message
        })
    });
    if (!res.ok)
        throw new Error(await res.text());
}
