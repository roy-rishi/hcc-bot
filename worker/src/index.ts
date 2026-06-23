/* index.ts: Cloudlfare Worker */
import nacl from "tweetnacl";
import { Resend } from 'resend';
import nJwt from 'njwt';
import { JSONObject, required } from 'ts-json-object';


// environment types (.env)
export interface Env {
    // discord
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    DISCORD_ROLE_ID: string;
    DISCORD_CHANNEL_ID: string;
    PUBLIC_KEY: string;
    // resend
    RESEND_KEY: string;
    // jwt
    JWT_KEY: string;
    // static files
    ASSETS: Fetcher;
}

class TokenSchema extends JSONObject {
    @required
    token!: string;
}

class JwtSchema extends JSONObject {
    @required
    discordId!: string;
    @required
    name!: string;
}

interface Interaction {
    type: number;
}

interface Component {
    component: {
        custom_id: string;
        value: string;
    };
}

interface ModalSubmission {
    type: number;
    member: {
        user: {
            id: string;
            global_name: string;
        };
    };
    data: {
        components: [
            Component
        ]
    };
}

// endpoints
const INTERACTIONS_PATH = "/interactions";
const VERIFY_PATH = "/verify";

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
        console.log(request.url);
        // get request body
        const reqBodyStr = await request.text();
        console.log(reqBodyStr);


        // # handle browser pre-flight CORS check
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }


        // # receive verification JWT and grant permissions
        if (reqUrl.pathname === VERIFY_PATH && request.method === "POST") {
            // parse request body for JWT
            let jwtStr: string;
            try {
                const reqBody: TokenSchema = new TokenSchema(JSON.parse(reqBodyStr));
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
            try {
                const jwtBody: JwtSchema = new JwtSchema(verifiedJwt.body);
                discordId = jwtBody.discordId;
                name = jwtBody.name;
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
                    "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
                    "Content-Type": "application/json"
                }
            });
            if (!addRoleRes.ok) {
                const resStr = await addRoleRes.text();
                console.error(resStr);
                return new Response(`Error: Could not add role; ${resStr}`, { status: 400, headers: corsHeaders });
            }

            // send confirmation message
            const sendMsgRes = await fetch(
                `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
                    "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    content: `You're verified, <@${discordId}>!`
                })
            });
            if (!sendMsgRes.ok)
                console.error(await addRoleRes.text());


            // return success
            return new Response(null, { status: 204, headers: corsHeaders });
        }


        // # Discord interactions endpoint
        if (reqUrl.pathname === INTERACTIONS_PATH && request.method === "POST") {
            // verify request signature using public key
            const signature = request.headers.get("X-Signature-Ed25519");
            const timestamp = request.headers.get("X-Signature-Timestamp");
            if (!signature || !timestamp) {
                return new Response("Missing request signature", { status: 401 });
            }
            const bodyText = await request.text();
            const isVerified = nacl.sign.detached.verify(
                Buffer.from(timestamp + bodyText),
                Buffer.from(signature, "hex"),
                Buffer.from(env.PUBLIC_KEY, "hex")
            );
            if (!isVerified)
                return new Response("Invalid request signature", { status: 401 })

            console.log(bodyText);
            const body: Interaction = JSON.parse(bodyText);

            // ## handle ping
            if (body.type === 1) {
                return new Response(JSON.stringify({
                    type: 1
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // ## handle message component (button)
            if (body.type === 3) {
                // TODO: check which button was clicked
                // return modal
                const modalData = {
                    custom_id: "netIdModal",
                    title: "Verify with UW NetID",
                    components: [{
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
                        description: "You may enter a preferred name",
                        component: {
                            type: 4,  // text input
                            custom_id: "name",
                            style: 1,  // short
                            placeholder: "Dubs II"
                        }
                    }]
                };
                return new Response(JSON.stringify({
                    type: 9,  // modal
                    data: modalData
                }), {
                    status: 200, headers: {
                        "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
                        "Content-Type": "application/json"
                    }
                });
            }

            // ## handle modal submission
            if (body.type === 5) {
                // TODO: check which modal was submitted
                const modalRes = body as ModalSubmission;
                // get submission user info
                const userId = modalRes.member.user.id;
                const userName = modalRes.member.user.global_name;

                // get form input
                let netId: string | null = null;
                let name: string | null = null;
                for (let i = 0; i < modalRes.data.components.length; i++) {
                    const comp = modalRes.data.components[i].component;
                    if (comp.custom_id === "netId") {
                        netId = comp.value.trim();
                    } else if (comp.custom_id === "name") {
                        name = comp.value.trim();
                    }
                }
                if (!netId || !name)
                    return new Response("Missing modal form values", { status: 401 });
                console.log({ userId, userName, netId, name });

                // prepare email parameters
                const emailAddress = `${netId}@uw.edu`;
                const verifyUrl = new URL("https://www.huskycyclinguw.com/verify");
                const token = createJwt({
                    name: name,
                    discordId: userId,
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
                console.log({ data, error });

                return new Response(JSON.stringify({
                    type: 4,  // channel message
                    data: {
                        content: `<@${userId}>, a verification link has been sent to **${emailAddress}**. It will expire in 10 minutes.`,
                        flags: (1 << 6)  // ephemeral
                    }
                }), {
                    status: 200, headers: {
                        "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
                        "Content-Type": "application/json"
                    }
                });
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
