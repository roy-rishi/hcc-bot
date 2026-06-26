import nacl from "tweetnacl";
import nJwt from 'njwt';
import { Resend } from "resend";
import * as schema from '../schemas';
import * as helpers from "../helpers";
import {
    ComponentType,
    DISCORD_HEADERS,
    InteractionCallbackType,
    InteractionType,
    TextInputStyle
} from '../constants';

let createJwt = function (payload: {}, expirationMins: number, signingKey: string): string {
    const token = nJwt.create(payload, signingKey);
    token.setExpiration(new Date(Date.now() + (expirationMins * 60 * 1000)));
    return token.compact();
};

export let discordInteraction = async function (reqBodyRaw: string, reqHeaders: Headers): Promise<Response> {
    // get request signature
    const signature = reqHeaders.get("X-Signature-Ed25519");
    const timestamp = reqHeaders.get("X-Signature-Timestamp");
    if (!signature || !timestamp)
        return helpers.errorResponse(401, "Missing request signature", {}, DISCORD_HEADERS);

    // verify request signature
    const isVerified = nacl.sign.detached.verify(
        Buffer.from(timestamp + reqBodyRaw),
        Buffer.from(signature, "hex"),
        Buffer.from(process.env.DISCORD_PUBLIC_KEY!, "hex")
    );
    if (!isVerified)
        return helpers.errorResponse(401, "Invalid request signature", {}, DISCORD_HEADERS);

    // get interaction type code
    let interactionType: number;
    let guildId: string;
    try {
        const body = schema.Interaction.parse(JSON.parse(reqBodyRaw));
        interactionType = body.type;
        guildId = body.guild_id;
    } catch (e) {
        return helpers.errorResponse(400, "Could not parse interaction type", { e }, DISCORD_HEADERS);
    }

    // handle ping
    if (interactionType === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionCallbackType.PONG }),
            { status: 200, headers: DISCORD_HEADERS }
        );
    }

    // verify request originated from HCC guild
    if (guildId !== process.env.DISCORD_GUILD_ID)
        return helpers.errorResponse(401, "Invalid guild_id", {}, DISCORD_HEADERS)

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
        const token = createJwt({
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
    return helpers.errorResponse(400, "Unsupported interaction type", {}, DISCORD_HEADERS);
}
