/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// environment variable types (.env)
export interface Env {
    // discord
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    // static files
    ASSETS: Fetcher;
}

export default {
    async fetch(request, env, ctx): Promise<Response> {
        // parse incoming URL
        const reqUrl = new URL(request.url);
        const appOrigin = reqUrl.origin;
        console.log(request.url);

        // GET /verify: Redirects to the Discord OAuth2.0 page.
        if (reqUrl.pathname === "/verify" && request.method === "GET") {
            // build redirect URL back to worker
            const redirectUrl = new URL(appOrigin);
            redirectUrl.pathname = "/callback/discord";

            // build Discord auth URL
            const authUrl = new URL("https://discord.com/oauth2/authorize");
            authUrl.searchParams.append("client_id", env.DISCORD_CLIENT_ID);
            authUrl.searchParams.append("response_type", "code");
            authUrl.searchParams.append("redirect_uri", redirectUrl.toString());
            authUrl.searchParams.append("scope", "identify");

            return Response.redirect(
                authUrl.toString(),
                302
            );
        }

        // GET /callback/discord: The callback for Discord OAuth2.0.
        // Verifies Discord identity, then redirects to UW IdP.
        if (reqUrl.pathname === "/callback/discord" && request.method === "GET") {
            const reqUrl = new URL(request.url);
            const discordCode = reqUrl.searchParams.get("code");

            // return with error if authorization code null
            if (!discordCode) {
                return new Response("Authorization code null", {
                    status: 401
                });
            }

            const redirectUrl = new URL(appOrigin);
            redirectUrl.pathname = "/callback/discord";
            console.log(redirectUrl.toString());

            // build query parameter list
            const params = new URLSearchParams({
                client_id: env.DISCORD_CLIENT_ID,
                client_secret: env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: discordCode,  // the OAuth2.0 authorization code
                redirect_uri: redirectUrl.toString()
            });

            // exchange authorization code for token
            const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
                method: "POST",
                body: params.toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            });

            // the token exchange failed
            if (!tokenResponse.ok) {
                // handle authentication error
                if (tokenResponse.status == 400) {
                    return new Response("Error: Could not authenticate with Discord", { status: 400 });
                }

                // a different error occured
                else {
                    const errorData = await tokenResponse.text();
                    console.error(tokenResponse.status)
                    console.error(errorData);
                    return new Response("An unexpected error occured 😔", { status: 500 });
                }
            }

            // TODO: get Discord username, db stuff, & redirect to UW IdP
            return new Response("Successfully proved Discord identity");
        }

        // Invalid path (404)
        // get static html
        const htmlUrl = new URL(appOrigin);
        htmlUrl.pathname = "/404.html";
        const htmlResponse = await env.ASSETS.fetch(htmlUrl);
        // return static html with 404 status
        return new Response(htmlResponse.body, {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });

    },
} satisfies ExportedHandler<Env>;
