/* index.ts: Cloudlfare Worker */
const nacl = require("tweetnacl");

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
    // static files
    ASSETS: Fetcher;
}

interface Interaction {
    type: number;
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
            {
                component: {
                    custom_id: string;
                    value: string;
                };
            }
        ]
    };
}

// endpoints
const INTERACTIONS_PATH = "/interactions";

let redirectReq = function (originUrl: URL, path: "/401" | "/500" | "/404" | "/success"): Response {
    originUrl.pathname = path;
    return Response.redirect(originUrl.toString(), 302);
};


export default {
    async fetch(request, env, ctx): Promise<Response> {
        // parse request URL
        const reqUrl = new URL(request.url);
        const appOrigin = reqUrl.origin;
        console.log(request.url);

        // # Discord interactions endpoint
        if (reqUrl.pathname === INTERACTIONS_PATH && request.method === "POST") {
            // get request signature
            const signature = request.headers.get("X-Signature-Ed25519");
            const timestamp = request.headers.get("X-Signature-Timestamp");
            if (!signature || !timestamp) {
                return new Response("Missing request signature", { status: 401 });
            }

            // verify signature using public key
            const body = await request.text();
            const isVerified = nacl.sign.detached.verify(
                Buffer.from(timestamp + body),
                Buffer.from(signature, "hex"),
                Buffer.from(env.PUBLIC_KEY, "hex")
            );
            if (!isVerified) {
                return new Response("Invalid request signature", { status: 401 })
            }

            console.log(body);
            const data = JSON.parse(body)

            // handle ping
            if (data.type === 1) {
                return new Response(JSON.stringify({
                    type: 1
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // handle message component (button)
            if (data.type === 3) {
                // TODO: check which button was clicked
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

            // handle modal submission
            if (data.type === 5) {
                // TODO: check which modal was submitted
                // get submission user info
                const userId = data.member.user.id;
                const userName = data.member.user.global_name;

                // get form input

                console.log({ userId, userName });
            }

            return new Response("Unhandled", {
                status: 500,
            });
        }



        // # Invalid path (404)
        const htmlUrl = new URL(appOrigin);
        htmlUrl.pathname = "/404.html";
        const htmlResponse = await env.ASSETS.fetch(htmlUrl);
        return new Response(htmlResponse.body, {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });

    },
} satisfies ExportedHandler<Env>;
