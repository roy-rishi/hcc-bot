import { Path } from '../constants'


export let notFound = async function (reqUrl: string, env: Env): Promise<Response> {
    const staticUrl = new URL(reqUrl);
    staticUrl.pathname = Path.NOT_FOUND;
    const staticRes = await env.ASSETS.fetch(staticUrl);
    return new Response(await staticRes.text(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}
