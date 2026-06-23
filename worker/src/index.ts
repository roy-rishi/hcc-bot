/* index.ts: Cloudlfare Worker */
import nacl from "tweetnacl";
import { Resend } from 'resend';
import nJwt from 'njwt';
import * as schema from './schemas';
import { int } from "zod";


// environment types
export interface Env {
    // discord
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    DISCORD_ROLE_ID: string;
    DISCORD_LOGS_CHANNEL_ID: string;
    DISCORD_ANNOUNCEMENT_CHANNEL_ID: string;
    PUBLIC_KEY: string;
    // resend
    RESEND_KEY: string;
    // jwt
    JWT_KEY: string;
    // static files
    ASSETS: Fetcher;
}

// endpoints
const INTERACTIONS_PATH = "/interactions";
const VERIFY_PATH = "/verify";
const EMAIL_BOUNCE_PATH = "/email-bounced";

let createJwt = function (payload: {}, expirationMins: number, signingKey: string): string {
    const token = nJwt.create(payload, signingKey);
    token.setExpiration(new Date(Date.now() + (expirationMins * 60 * 1000)));
    return token.compact();
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "https://www.huskycyclinguw.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
};


export default {
    async fetch(request, env, ctx): Promise<Response> {
        // parse request URL
        const reqUrl = new URL(request.url);
        const appOrigin = reqUrl.origin;
        // get request body
        const reqBodyRaw = await request.text();
        console.log(reqBodyRaw);

        const discordHeaders = {
            "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
            "Content-Type": "application/json"
        };


        // # handle browser pre-flight CORS check
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }


        // # Resend bounced email webhook
        if (reqUrl.pathname === EMAIL_BOUNCE_PATH && request.method === "POST") {
            // parse data
            let bounceData: schema.EmailBounced;
            try {
                bounceData = schema.EmailBounced.parse(JSON.parse(reqBodyRaw));
            } catch (e) {
                return new Response(`Error: Could not parse request; ${e}`, { status: 400 });
            }
            console.error(`Email with ID ${bounceData.data.email_id} to address(es) ${bounceData.data.to} bounced. Error: ${bounceData.data.bounce.message}`);

            return new Response(null, { status: 200 });
        }


        // # receive verification JWT and grant permissions
        if (reqUrl.pathname === VERIFY_PATH && request.method === "POST") {
            // parse request body for JWT
            let jwtStr: string;
            try {
                const reqBody = schema.Token.parse(JSON.parse(reqBodyRaw));
                jwtStr = reqBody.token;
            } catch (e) {
                console.error(e);
                return new Response(`Error: Could not parse request body; ${e}`, { status: 401, headers: corsHeaders });
            }

            // validate JWT
            let verifiedJwt: nJwt.Jwt | undefined;
            try {
                verifiedJwt = nJwt.verify(jwtStr, env.JWT_KEY);
                if (!verifiedJwt)
                    throw new Error("Invalid JWT");
            } catch (e) {
                console.error(e);
                return new Response(`Error: ${e}`, { status: 401, headers: corsHeaders });
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
                return new Response(`Error: Could not parse JWT payload; ${e}`, { status: 401, headers: corsHeaders });
            }

            // add Discord role
            const addRoleRes = await fetch(
                `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${discordId}/roles/${env.DISCORD_ROLE_ID}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
                    ...discordHeaders,
                }
            });
            if (!addRoleRes.ok) {
                const resStr = await addRoleRes.text();
                console.error(resStr);
                return new Response(`Error: Could not add role; ${resStr}`, { status: 400, headers: corsHeaders });
            }

            // edit server nickname
            const editNickRes = await fetch(
                `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${discordId}`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
                    ...discordHeaders,
                },
                body: JSON.stringify({
                    nick: name
                })
            });
            if (!editNickRes.ok)
                console.error(await editNickRes.text());

            // send confirmation message (use comments to send ephemerally using prior interaction token)
            const sendMsgRes = await fetch(
                `https://discord.com/api/v10/channels/${env.DISCORD_LOGS_CHANNEL_ID}/messages`, {
                // `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/${interactionToken}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
                    ...discordHeaders,
                },
                body: JSON.stringify({
                    content: `You're verified, <@${discordId}>!`,
                    // flags: (1 << 6)  // ephemeral TEST TEST
                })
            });
            if (!sendMsgRes.ok)
                console.error(await sendMsgRes.text());


            // return success
            return new Response(null, { status: 204, headers: corsHeaders });
        }


        // # Discord interactions endpoint
        if (reqUrl.pathname === INTERACTIONS_PATH && request.method === "POST") {
            // get request signature
            const signature = request.headers.get("X-Signature-Ed25519");
            const timestamp = request.headers.get("X-Signature-Timestamp");
            if (!signature || !timestamp)
                return new Response("Missing request signature", { status: 401 });

            // verify request signature
            const isVerified = nacl.sign.detached.verify(
                Buffer.from(timestamp + reqBodyRaw),
                Buffer.from(signature, "hex"),
                Buffer.from(env.PUBLIC_KEY, "hex")
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

            // ## handle ping
            if (interactionType === 1) {
                return new Response(
                    JSON.stringify({ type: 1 }),
                    { status: 200, headers: discordHeaders, }
                );
            }

            // ## handle message component (button press)
            if (interactionType === 3) {
                // TODO: check which button was clicked

                // construct modal (popup)
                const modalData = {
                    custom_id: "netIdModal",
                    title: "Verify with UW NetID",
                    components: [
                        {
                            type: 18,  // label
                            label: "What is your NetID?",
                            description: "This is the portion before '@uw.edu' in your email address",
                            component: {
                                type: 4,  // text input
                                custom_id: "netId",
                                style: 1,  // short
                                placeholder: "NetID"
                            }
                        }, {
                            type: 18,  // label
                            label: "What is your full name?",
                            description: "This will display as your server nickname. Preferred names OK",
                            component: {
                                type: 4,  // text input
                                custom_id: "name",
                                style: 1,  // short
                                placeholder: "Dubs II"
                            }
                        }
                    ]
                };

                // return modal
                return new Response(
                    JSON.stringify({
                        type: 9,  // modal
                        data: modalData
                    }), { status: 200, headers: discordHeaders });
            }

            // ## handle modal (form) submission
            if (interactionType === 5) {
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
                // get token (to identify this interaction and respond later)
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
                const token = createJwt({
                    name: name,
                    discordId: discordId,
                    interactionToken: interactionToken
                },
                    10,  // 10 min expiration
                    env.JWT_KEY  // signing key
                );
                verifyUrl.searchParams.append("token", token);

                // send email
                const resend = new Resend(env.RESEND_KEY);
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
                            type: 4,  // channel message
                            data: {
                                content: `Failed to send link to **${emailAddress}**. Please try again. If this issue persists, contact us.`,
                                flags: (1 << 6)  // ephemeral
                            }
                        }),
                        { status: 200, headers: discordHeaders }
                    );
                }

                return new Response(
                    JSON.stringify({
                        type: 4,  // channel message
                        data: {
                            content: `<@${discordId}>, a verification link has been sent to **${emailAddress}**. It will expire in 10 minutes.`,
                            flags: (1 << 6)  // ephemeral
                        }
                    }),
                    { status: 200, headers: discordHeaders }
                );
            }

            // ## disregard other interaction types
            return new Response("Unhandled", { status: 500, });
        }


        // # invalid path (404)
        const htmlUrl = new URL(appOrigin);
        htmlUrl.pathname = "/404.html";
        const htmlResponse = await env.ASSETS.fetch(htmlUrl);
        return new Response(htmlResponse.body, {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    },
} satisfies ExportedHandler<Env>;
