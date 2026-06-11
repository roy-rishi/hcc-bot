/* index.ts: Cloudlfare Worker */

// environment types (.env)
export interface Env {
    // discord
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    DISCORD_ROLE_ID: string;
    DISCORD_CHANNEL_ID: string;
    // static files
    ASSETS: Fetcher;
}

// endpoints
const START_PATH = "/start";
const DISCORD_CALLBACK_PATH = "/discord-callback";

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


        // # GET: Redirects to the Discord OAuth2 page.
        if (reqUrl.pathname === START_PATH && request.method === "GET") {
            // callback URL
            const redirectUrl = new URL(appOrigin);
            redirectUrl.pathname = DISCORD_CALLBACK_PATH;

            // build Discord auth URL
            const authUrl = new URL("https://discord.com/oauth2/authorize");
            authUrl.searchParams.append("client_id", env.DISCORD_CLIENT_ID);
            authUrl.searchParams.append("response_type", "code");
            authUrl.searchParams.append("redirect_uri", redirectUrl.toString());
            authUrl.searchParams.append("scope", "identify");

            // redirect to Discord
            return Response.redirect(authUrl.toString(), 302);
        }


        // # GET: The callback from Discord OAuth2
        if (reqUrl.pathname === DISCORD_CALLBACK_PATH && request.method === "GET") {
            // get Discord OAuth2 auth code
            const discordCode = reqUrl.searchParams.get("code");

            // throw error if auth code null
            if (!discordCode) {
                console.error("Error: Authorization code null");
                return redirectReq(new URL(appOrigin), "/401");
            }

            // exchange authorization code for token
            const redirectUrl = new URL(appOrigin);
            redirectUrl.pathname = DISCORD_CALLBACK_PATH;  // not shown to clients
            const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
                method: "POST",
                body: new URLSearchParams({
                    client_id: env.DISCORD_CLIENT_ID,
                    client_secret: env.DISCORD_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: discordCode,  // the OAuth2 authorization code
                    redirect_uri: redirectUrl.toString()
                }),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            });

            // return if Discord authorization (token exchange) failed
            if (!tokenResponse.ok) {
                // log error
                console.error(await tokenResponse.text());

                // authorization issue
                if (tokenResponse.status == 400) {
                    console.error("Error: The Discord auth code / token exchange failed");
                    return redirectReq(new URL(appOrigin), "/401");
                }

                // a different error occured
                else {
                    return redirectReq(new URL(appOrigin), "/500");
                }
            }

            // parse token response
            const tokenData = await tokenResponse.json() as {
                token_type: string;
                access_token: string;
                expires_in: number;
                refresh_token: string;
                scope: string;
            }

            // handle bad/unauthorized response body
            if (tokenData.token_type != "Bearer" || !tokenData.access_token) {
                return redirectReq(new URL(appOrigin), "/401");
            }

            // Discord bearer token
            const token = tokenData.access_token;

            // get user id using token
            const idResponse = await fetch(
                "https://discord.com/api/v10/users/@me", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`
                }
            });

            // handle id response errors
            if (!idResponse.ok) {
                console.error(await idResponse.text());
                if (idResponse.status == 401) {
                    return redirectReq(new URL(appOrigin), "/401");
                } else {
                    return redirectReq(new URL(appOrigin), "/500");
                }
            }

            // parse id response
            const idData = await idResponse.json() as {
                id: number;
                username: string;
            }
            if (!idData.id) {
                // return with error if null
                console.error("Error: could not get Discord member ID");
                return redirectReq(new URL(appOrigin), "/500");
            }
            const memberId = idData.id;
            console.log(`member id: ${memberId}`);

            // add Discord role
            const roleResponse = await fetch(
                `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${memberId}/roles/${env.DISCORD_ROLE_ID}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
                    "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
                    "Content-Type": "application/json"
                }
            }
            );
            if (roleResponse.status != 204) {
                // an error occurred
                console.error(await roleResponse.text());
                // TODO: error handling
            }

            // send confirmation message into channel
            const messageResponse = await fetch(
                `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${env.DISCORD_BOT_TOKEN}`,
                    "User-Agent": `DiscordBot (${appOrigin}, 1.0.0)`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    content: `You're verified, <@${memberId}>!`
                })
            });

            // handle message response errors
            if (!messageResponse.ok) {
                // an error occurred
                console.error(await roleResponse.text());
                // TODO: error handling
            }

            // TODO: change nickname
            // TODO: set/verify cookie

            // redirect to success page
            return redirectReq(new URL(appOrigin), "/success");
        }


        // # Invalid path (404)
        // return static html with 404 status
        const htmlUrl = new URL(appOrigin);
        htmlUrl.pathname = "/404.html";
        const htmlResponse = await env.ASSETS.fetch(htmlUrl);
        return new Response(htmlResponse.body, {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });

    },
} satisfies ExportedHandler<Env>;
