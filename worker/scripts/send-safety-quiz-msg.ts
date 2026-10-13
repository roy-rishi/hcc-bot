// This script sends the safety quiz instructions and
// submission button into TODO:DISCORD_

import process from 'node:process'
import { ComponentType, ButtonStyle } from '../src/constants.ts'

process.loadEnvFile("../.dev.vars");

// send message with button
(async () => {
    const res = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_TEST_CHANNEL_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "User-Agent": `DiscordBot (rishiroy.com, 2.0.0)`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Please review our club etiquette and safety policies at the link below. Then, **complete the quiz to gain access to our group ride channels**. We require that you understand these policies and pass the quiz pior to riding with us.`,
            "components": [
                {
                    "type": ComponentType.ACTION_ROW,
                    "components": [
                        {
                            "type": ComponentType.BUTTON,
                            "label": "Safety Policies",
                            "url": "https://docs.google.com/document/d/1ptiZbPdBs8NGtwCLwLWLTKS7YN4uNZS_2ftDIJTKdV0",
                            "style": ButtonStyle.LINK
                        },
                        {
                            "type": ComponentType.BUTTON,
                            "label": "Start Quiz",
                            "custom_id": "quizStartButton",
                            "style": ButtonStyle.PRIMARY
                        }
                    ]
                }
            ],
        })
    });
    if (!res.ok)
        console.error(await res.text());
})();
export{}
