import { Resend } from 'resend';
import nJwt from 'njwt';
import nacl from "tweetnacl";
import * as schema from './schemas';
import * as helpers from "./helpers";
import {
    Path,
    InteractionType,
    InteractionCallbackType,
    ComponentType,
    TextInputStyle,
    CORS_HEADERS,
    DISCORD_HEADERS
} from "./constants";


export let preflightCorsCheck = function (): Response {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

export let bouncedEmail = function (reqBodyRaw: string): Response {
    // parse body
    let bounceData: schema.EmailBounced;
    try {
        bounceData = schema.EmailBounced.parse(JSON.parse(reqBodyRaw));
    } catch (e) {
        return new Response(`Error: Could not parse request; ${e}`, { status: 400 });
    }
    console.error(`Email with ID ${bounceData.data.email_id} to address(es) ${bounceData.data.to} bounced. Error: ${bounceData.data.bounce.message}`);

    return new Response(null, { status: 200 });
}

export let verification = async function(reqBodyRaw: string): Promise<Response> {
    // parse request body for JWT
    let jwtStr: string;
    try {
        const reqBody = schema.Token.parse(JSON.parse(reqBodyRaw));
        jwtStr = reqBody.token;
    } catch (e) {
        console.error(e);
        return new Response(`Error: Could not parse request body; ${e}`, { status: 401, headers: CORS_HEADERS });
    }

    // validate JWT
    let verifiedJwt: nJwt.Jwt | undefined;
    try {
        verifiedJwt = nJwt.verify(jwtStr, process.env.JWT_KEY);
        if (!verifiedJwt)
            throw new Error("Invalid JWT");
    } catch (e) {
        console.error(e);
        return new Response(`Error: ${e}`, { status: 401, headers: CORS_HEADERS });
    }

    // parse JWT payload
    let discordId: string;
    let name: string;
    let interactionToken: string;
    try {
        const jwtPayload = schema.JwtPayload.parse(verifiedJwt.body);
        discordId = jwtPayload.discordId;
        name = jwtPayload.name;
        interactionToken = jwtPayload.interactionToken;
    } catch (e) {
        console.error(e);
        return new Response(`Error: Could not parse JWT payload; ${e}`, { status: 401, headers: CORS_HEADERS });
    }

    // add Discord role
    const addRoleRes = await fetch(
        `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}/roles/${process.env.DISCORD_ROLE_ID}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            ...DISCORD_HEADERS,
        }
    });
    if (!addRoleRes.ok) {
        const resStr = await addRoleRes.text();
        console.error(resStr);
        return new Response(`Error: Could not add role; ${resStr}`, { status: 400, headers: CORS_HEADERS });
    }

    // edit server nickname
    const editNickRes = await fetch(
        `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            ...DISCORD_HEADERS,
        },
        body: JSON.stringify({
            nick: name
        })
    });
    if (!editNickRes.ok)
        console.error(await editNickRes.text());

    // send confirmation message (use comments to send ephemerally using prior interaction token)
    const sendMsgRes = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_LOGS_CHANNEL_ID}/messages`, {
        // `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/${interactionToken}`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            ...DISCORD_HEADERS,
        },
        body: JSON.stringify({
            content: `You're verified, <@${discordId}>!`,
            // flags: (1 << 6)  // ephemeral
        })
    });
    if (!sendMsgRes.ok)
        console.error(await sendMsgRes.text());


    // return success
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export let discordInteraction = async function(reqBodyRaw: string, reqHeaders: Headers): Promise<Response> {
    // get request signature
    const signature = reqHeaders.get("X-Signature-Ed25519");
    const timestamp = reqHeaders.get("X-Signature-Timestamp");
    if (!signature || !timestamp)
        return new Response("Missing request signature", { status: 401 });

    // verify request signature
    const isVerified = nacl.sign.detached.verify(
        Buffer.from(timestamp + reqBodyRaw),
        Buffer.from(signature, "hex"),
        Buffer.from(process.env.DISCORD_PUBLIC_KEY!, "hex")
    );
    if (!isVerified)
        return new Response("Invalid request signature", { status: 401 })

    // get interaction type code
    let interactionType: number;
    try {
        const body = schema.Interaction.parse(JSON.parse(reqBodyRaw));
        interactionType = body.type;
    } catch (e) {
        console.error(e);
        return new Response(`Error: Could not parse interaction for attribute 'type'; ${e}`, { status: 400 });
    }

    // handle ping
    if (interactionType === InteractionType.PING) {
        return new Response(
            JSON.stringify({ type: InteractionCallbackType.PONG }),
            { status: 200, headers: DISCORD_HEADERS }
        );
    }

    // handle message component (button press)
    if (interactionType === InteractionType.MESSAGE_COMPONENT) {
        // TODO: check which button was clicked

        // construct modal (popup)
        const modalData = {
            custom_id: "netIdModal",
            title: "Verify with UW NetID",
            components: [
                {
                    type: ComponentType.LABEL,
                    label: "What is your NetID?",
                    description: "This is the portion before '@uw.edu' in your email address",
                    component: {
                        type: ComponentType.TEXT_INPUT,
                        custom_id: "netId",
                        style: TextInputStyle.SHORT,
                        placeholder: "NetID"
                    }
                }, {
                    type: ComponentType.LABEL,
                    label: "What is your full name?",
                    description: "This will display as your server nickname. Preferred names OK",
                    component: {
                        type: ComponentType.TEXT_INPUT,
                        custom_id: "name",
                        style: TextInputStyle.SHORT,
                        placeholder: "Dubs II"
                    }
                }
            ]
        };

        // return modal
        return new Response(
            JSON.stringify({
                type: InteractionCallbackType.MODAL,
                data: modalData
            }), { status: 200, headers: DISCORD_HEADERS });
    }

    // handle modal (form) submission
    if (interactionType === InteractionType.MODAL_SUBMIT) {
        // TODO: check which modal was submitted

        // parse submission
        let submission: schema.ModalSubmissionInteraction;
        try {
            submission = schema.ModalSubmissionInteraction.parse(JSON.parse(reqBodyRaw));
        } catch (e) {
            console.error(e);
            return new Response(`Error: Could not parse modal submission; ${e}`, { status: 400 });
        }

        // get submitter's Discord id
        const discordId = submission.member.user.id;
        // get token (to identify this interaction and/or respond later)
        const interactionToken = submission.token;

        // get form submission values from components array, and validate their existence
        let netId: string | undefined;
        let name: string | undefined;
        for (let i = 0; i < submission.data.components.length; i++) {
            const component = submission.data.components[i].component;
            if (component.custom_id === "netId") {
                netId = component.value.trim();
            } else if (component.custom_id === "name") {
                name = component.value.trim();
            }
        }
        if (!netId || !name)
            return new Response("Missing modal form values", { status: 400 });
        console.log({ netId, name, discordId });

        // email parameters
        const emailAddress = `${netId}@uw.edu`;
        const verifyUrl = new URL("https://www.huskycyclinguw.com/verify");
        const token = helpers.createJwt({
            name: name,
            discordId: discordId,
            interactionToken: interactionToken
        },
            10,  // 10 min expiration
            process.env.JWT_KEY!  // signing key
        );
        verifyUrl.searchParams.append("token", token);

        // send email
        const resend = new Resend(process.env.RESEND_KEY);
        const { data, error } = await resend.emails.send({
            to: [emailAddress],
            template: {
                id: "5e7f186c-796c-43be-a7e3-dcbe7567a5d4",
                variables: {
                    link: verifyUrl.toString(),
                    name: name,
                }
            }
        });
        if (error) {
            console.log({ data, error });
            // send a message indicating send failure (this does NOT handle bounced emails)
            return new Response(
                JSON.stringify({
                    type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `Failed to send link to **${emailAddress}**. Please try again. If this issue persists, contact us.`,
                        flags: (1 << 6)  // ephemeral
                    }
                }),
                { status: 200, headers: DISCORD_HEADERS }
            );
        }

        return new Response(
            JSON.stringify({
                type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `<@${discordId}>, a verification link has been sent to **${emailAddress}**. It will expire in 10 minutes.`,
                    flags: (1 << 6)  // ephemeral
                }
            }),
            { status: 200, headers: DISCORD_HEADERS }
        );
    }

    // disregard other interaction types
    return new Response("Unhandled", { status: 500, });
}

export let notFound = async function(env: Env): Promise<Response> {
    const staticUrl = new URL(Path.NOT_FOUND);
    const staticRes = await env.ASSETS.fetch(staticUrl);
    return new Response(staticRes.body, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}
