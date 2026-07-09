import nacl from "tweetnacl";
import { Resend } from "resend";
import * as schema from '../schemas';
import * as helpers from "../helpers";
import { createJwt } from "../jwt";
import {
    ComponentType,
    DISCORD_HEADERS,
    InteractionCallbackType,
    InteractionType,
    TextInputStyle
} from '../constants';


// parse request headers for discord signature
let getDiscordSignature = function (headers: Headers): { signature: string, timestamp: string } {
    const signature = headers.get("X-Signature-Ed25519");
    const timestamp = headers.get("X-Signature-Timestamp");

    if (!signature || !timestamp)
        throw new Error("Missing/incomplete request signature");

    return { signature, timestamp };
}

// use request signature to verify request originated from discord and has not been tampered with
let validateDiscordSignature = function (signature: string, timestamp: string, reqBody: string, publicKey: string) {
    const isVerified = nacl.sign.detached.verify(
        Buffer.from(timestamp + reqBody),
        Buffer.from(signature, "hex"),
        Buffer.from(publicKey, "hex")
    );
    if (!isVerified)
        throw new Error("Failed to verify request origin");
}

let handlePing = function (): Response {
    return new Response(JSON.stringify({
        type: InteractionCallbackType.PONG
    }), {
        status: 200,
        headers: DISCORD_HEADERS
    });
}

// create a response containing a modal (form) to display
let respondWithModal = function (): Response {
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

    const modal = {
        type: InteractionCallbackType.MODAL,
        data: modalData
    }

    return new Response(JSON.stringify(modal), { status: 200, headers: DISCORD_HEADERS });
}

// parse components array for form submission values
export let getSubmmissionValues = function (submission: schema.ModalSubmissionInteraction): { netId: string, name: string } {
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
        throw new Error("Missing modal form value(s)");

    return { netId, name };
}

// send an email with a verification link containing a JWT
let sendVerificationEmail = async function (emailAddress: string, discordId: string, name: string, interactionToken: string) {
    // create JWT with payload and 10 minute expiration
    const payload: schema.JwtPayload = {
        name: name,
        discordId: discordId,
        interactionToken: interactionToken
    }
    const token = await createJwt(payload, 10, process.env.JWT_KEY!);

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

let modalSubmissionHandler = async function (reqBodyRaw: string): Promise<Response> {
    // parse submission
    let submission: schema.ModalSubmissionInteraction;
    try {
        submission = schema.ModalSubmissionInteraction.parse(JSON.parse(reqBodyRaw));
    } catch (e) {
        return helpers.errorResponse(400, "Failed to parse modal submission", { e }, DISCORD_HEADERS);
    }

    const discordId = submission.member.user.id;
    const interactionToken = submission.token;

    // get form submission values from components array
    let netId: string, name: string;
    try {
        ({ netId, name } = getSubmmissionValues(submission));
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

// top-level handler for discord interactions endpoint
export let discordInteraction = async function (reqBodyRaw: string, reqHeaders: Headers): Promise<Response> {
    // verify request originated from discord
    try {
        const { signature, timestamp } = getDiscordSignature(reqHeaders);
        validateDiscordSignature(signature, timestamp, reqBodyRaw, process.env.DISCORD_PUBLIC_KEY!);
    } catch (e) {
        return helpers.errorResponse(401, "Failed to validate request signature", { e }, DISCORD_HEADERS);
    }

    // get data to identify interaction
    let interactionType: number;
    let guildId: string | null;
    try {
        const body = schema.Interaction.parse(JSON.parse(reqBodyRaw));
        interactionType = body.type;
        guildId = body.guild_id;
    } catch (e) {
        return helpers.errorResponse(400, "Failed to parse interaction type", { e }, DISCORD_HEADERS);
    }

    // handle ping
    if (interactionType === InteractionType.PING)
        return handlePing();

    // reject other interaction types if request does not originate from HCC server
    if (guildId !== process.env.DISCORD_GUILD_ID)
        return helpers.errorResponse(401, "Invalid or missing origin guild_id", {}, DISCORD_HEADERS)

    // handle message component
    if (interactionType === InteractionType.MESSAGE_COMPONENT)
        return respondWithModal();

    // handle modal (form) submission
    if (interactionType === InteractionType.MODAL_SUBMIT)
        return await modalSubmissionHandler(reqBodyRaw);

    // disregard other interaction types
    return helpers.errorResponse(400, "Unsupported interaction type", {}, DISCORD_HEADERS);
}
