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

// create a JWT string with payload, signed by signingKey, and expiring in expirationMins
let createJwt = function (payload: {}, expirationMins: number, signingKey: string): string {
    const token = nJwt.create(payload, signingKey);
    token.setExpiration(new Date(Date.now() + (expirationMins * 60 * 1000)));
    return token.compact();
};

// parse request headers to verify request originated from discord
let validateDiscordSignature = function (reqHeaders: Headers, reqBody: string) {
    // parse headers for request signature
    const signature = reqHeaders.get("X-Signature-Ed25519");
    const timestamp = reqHeaders.get("X-Signature-Timestamp");
    if (!signature || !timestamp)
        throw new Error("Missing request signature");

    // verify request signature
    const isVerified = nacl.sign.detached.verify(
        Buffer.from(timestamp + reqBody),
        Buffer.from(signature, "hex"),
        Buffer.from(process.env.DISCORD_PUBLIC_KEY!, "hex")
    );
    if (!isVerified)
        throw new Error("Invalid request signature");
}

// construct modal (form popup)
let createModal = function (): {} {
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

    return {
        type: InteractionCallbackType.MODAL,
        data: modalData
    }
}

// parse components array for form submission values
let getSubmmissionValues = function (submission: schema.ModalSubmissionInteraction): [string, string] {
    let netId: string | undefined;
    let name: string | undefined;

    // iterate over list of components
    for (let i = 0; i < submission.data.components.length; i++) {
        const component = submission.data.components[i].component;
        // assign values based on component id
        if (component.custom_id === "netId")
            netId = component.value.trim();
        if (component.custom_id === "name")
            name = component.value.trim();
    }

    // verify both values were found
    if (!netId || !name)
        throw new Error("Missing modal form values");
    console.log({ submissionFrom: { netId, name } });

    return [netId, name];
}

// send an email with a verification link containing a JWT
let sendVerificationEmail = async function (emailAddress: string, discordId: string, name: string, interactionToken: string) {
    // create JWT with payload
    const token = createJwt({
        name: name,
        discordId: discordId,
        interactionToken: interactionToken
    },
        10,  // 10 min expiration
        process.env.JWT_KEY!  // signing key
    );

    // create verification URL
    const verifyUrl = new URL("https://www.huskycyclinguw.com/verify");
    verifyUrl.searchParams.append("token", token);

    // send email
    const resend = new Resend(process.env.RESEND_KEY);
    const { data, error } = await resend.emails.send({
        to: emailAddress,
        template: {
            id: "5e7f186c-796c-43be-a7e3-dcbe7567a5d4",
            variables: {
                link: verifyUrl.toString(),
                name: name,
            }
        }
    });
    console.log({ data, error });
    if (error)
        throw new Error(error.message);
}

// top-level handler for discord interactions endpoint
export let discordInteraction = async function (reqBodyRaw: string, reqHeaders: Headers): Promise<Response> {
    // verify request originated from discord
    try {
        validateDiscordSignature(reqHeaders, reqBodyRaw);
    } catch (e) {
        return helpers.errorResponse(401, "Could not validate request signature", { e }, DISCORD_HEADERS);
    }

    // get data to identify interaction
    let interactionType: number;
    let guildId: string | null;
    try {
        const body = schema.Interaction.parse(JSON.parse(reqBodyRaw));
        interactionType = body.type;
        guildId = body.guild_id;
    } catch (e) {
        return helpers.errorResponse(400, "Could not parse interaction type", { e }, DISCORD_HEADERS);
    }

    // handle ping
    if (interactionType === InteractionType.PING) {
        return new Response(JSON.stringify({
            type: InteractionCallbackType.PONG
        }), { status: 200, headers: DISCORD_HEADERS });
    }

    // verify request originated from HCC server
    if (guildId !== process.env.DISCORD_GUILD_ID)
        return helpers.errorResponse(401, "Invalid or missing origin guild_id", {}, DISCORD_HEADERS)

    // handle message component (button press)
    if (interactionType === InteractionType.MESSAGE_COMPONENT) {
        // create and return modal (form) to display in response to button
        const modal = createModal();
        return new Response(JSON.stringify(modal), {
            status: 200,
            headers: DISCORD_HEADERS
        });
    }

    // handle modal (form) submission
    if (interactionType === InteractionType.MODAL_SUBMIT) {
        // parse submission
        let submission: schema.ModalSubmissionInteraction;
        try {
            submission = schema.ModalSubmissionInteraction.parse(JSON.parse(reqBodyRaw));
        } catch (e) {
            return helpers.errorResponse(400, "Could not parse modal submission", { e }, DISCORD_HEADERS);
        }

        // get submitter's discord id and interaction token (to identify this interaction later)
        const discordId = submission.member.user.id;
        const interactionToken = submission.token;

        // get form submission values from components array
        let netId: string, name: string;
        try {
            [netId, name] = getSubmmissionValues(submission);
        } catch (e) {
            return helpers.errorResponse(400, "Invalid or missing submission values", { e }, DISCORD_HEADERS);
        }

        // send email
        const emailAddress = `${netId}@uw.edu`;
        let sendSuccessful = true;
        try {
            await sendVerificationEmail(emailAddress, discordId, name, interactionToken)
        } catch (e) {
            console.error({ e });
            sendSuccessful = false;
        }

        // message to send (success or failure). does NOT handle bounced emails
        const message = sendSuccessful ?
            `<@${discordId}>, a verification link has been sent to **${emailAddress}**. It will expire in 10 minutes.` :
            `<@${discordId}>: Failed to send link to **${emailAddress}**. Please try again. If this issue persists, contact us.`;

        return new Response(JSON.stringify({
            type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: message,
                flags: (1 << 6)  // ephemeral
            }
        }), { status: 200, headers: DISCORD_HEADERS });
    }

    // disregard other interaction types
    return helpers.errorResponse(400, "Unsupported interaction type", {}, DISCORD_HEADERS);
}
