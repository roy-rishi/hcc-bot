/* index.ts: Cloudlfare Worker */
import { Path, CORS_HEADERS } from "./constants";
import { verification } from "./handlers/verification";
import { discordInteraction } from "./handlers/interactions";
import { notFound } from './handlers/not-found'


export default {
    async fetch(request, env, ctx): Promise<Response> {
        // parse request
        const reqPath = (new URL(request.url)).pathname;
        const reqMethod = request.method;
        const reqBodyRaw = await request.text();
        console.log({ reqBody: reqBodyRaw });

        // # validate JWT and grant permissions
        if (reqPath === Path.VERIFY && reqMethod === "POST")
            return await verification(reqBodyRaw);

        // # discord interactions endpoint
        if (reqPath === Path.INTERACTIONS && reqMethod === "POST")
            return await discordInteraction(reqBodyRaw, request.headers);

        // # browser pre-flight CORS check
        if (reqMethod === "OPTIONS")
            return new Response(null, { status: 204, headers: CORS_HEADERS });

        // # invalid path (404)
        return await notFound(request.url, env);
    },
} satisfies ExportedHandler<Env>;
