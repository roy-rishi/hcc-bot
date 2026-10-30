// This script sends the verification instructions and
// action buttons into DISCORD_ANNOUNCEMENT_CHANNEL_ID

import process from 'node:process'
import { ComponentType, ButtonStyle } from '../src/constants.ts'

process.loadEnvFile("../.dev.vars");

// send message with button
(async () => {
    const res = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "User-Agent": `DiscordBot (rishiroy.com, 1.0.0)`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Welcome to the Husky Cycling Discord server! This community is open to UW students, staff, and alumni. **TO ACCESS THE DISCUSSION CHANNELS**, please complete the following two steps.\n\n` +
                `**Step 1**: Verify your identity using one of the following options:\n` +
                `- **If you have a current UW NetID**, select *Verify with NetID* and enter your NetID and name in the pop-up. You will receive an email with a link to complete your automatic verification.\n` +
                `- If you do not have a current NetID, send an email to \`huskycyclinguw@gmail.com\` so that we can manually verify you.\n\n` +
                `**Step 2**: Please **review our club etiquette and safety policies** at the link below. Then, **complete the quiz**. We require that you understand these policies and pass the quiz prior to riding with us.\n\n` +
                `Only after completing both of these steps will you receive full access to our server. You can verify your completion by tapping on your name and looking for the gold Members role on your server profile.`,
            components: [
                {
                    type: ComponentType.ACTION_ROW,
                    components: [
                        {
                            type: ComponentType.BUTTON,
                            label: "Verify with NetID",
                            custom_id: "startButton",
                            style: ButtonStyle.PRIMARY,
                        },
                        {
                            type: ComponentType.BUTTON,
                            label: "Safety Policies",
                            url: "https://docs.google.com/document/d/1ptiZbPdBs8NGtwCLwLWLTKS7YN4uNZS_2ftDIJTKdV0",
                            style: ButtonStyle.LINK,
                        },
                        {
                            type: ComponentType.BUTTON,
                            label: "Start Quiz",
                            custom_id: "quiz-0",
                            style: ButtonStyle.PRIMARY,
                        },
                    ]
                }
            ],
        })
    });
    if (!res.ok)
        console.error(await res.text());
})();
export { }
