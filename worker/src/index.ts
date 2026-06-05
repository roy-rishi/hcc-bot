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
    DISCORD_AUTH_URL: string;
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
}

export default {
    async fetch(request, env, ctx): Promise<Response> {
        // parse incoming URL
        const url = new URL(request.url);

        // GET /verify: Redirects to the Discord OAuth2.0 page.
        if (url.pathname === "/verify" && request.method === "GET") {
            return new Response(
                `<!doctype html>
                <html lang=en>
                <head>
                    <meta http-equiv="Refresh" content="0; URL=${env.DISCORD_AUTH_URL}" />
                </head>
                </html>`,
                {
                    headers: {
                        "Content-Type": "text/html"
                    }
                }
            );
        }

        // GET /callback/discord: The callback for Discord OAuth2.0.
        // Verifies Discord identity, then redirects to UW IdP.
        if (url.pathname === "/callback/discord" && request.method === "GET") {
            const reqUrl = new URL(request.url);
            const discordCode = reqUrl.searchParams.get("code");

            // return with error if authorization code null
            if (!discordCode) {
                return new Response("Authorization code null", {
                    status: 401
                });
            }

            // build query parameter list
            const params = new URLSearchParams({
                client_id: env.DISCORD_CLIENT_ID,
                client_secret: env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: discordCode,  // the OAuth2.0 authorization code
                redirect_uri: "http://localhost:8787/callback/discord"  // not shown to user
            });

            // exchange authorization code for token
            const credentials = btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`);
            const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
                method: "POST",
                body: params,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Basic ${credentials}`
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

            // TODO: redirect to UW IdP
            return new Response("Successfully proved Discord identity");
        }

        // Invalid path
        return new Response("404 - This page can't be found. Unfortunate indeed, but not as infuriating as a missing bicycle 🙃", { status: 404, }
        )

    },
} satisfies ExportedHandler<Env>;
