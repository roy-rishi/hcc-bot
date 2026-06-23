import 'dotenv/config';

// send message with button
(async () => {
    const res = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "User-Agent": `DiscordBot (rishiroy.com, 1.0.0)`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Welcome to Husky Cycling – we're glad you're here! This community is open to UW students, staff, and alumni. **To access the discussion channels, please verify your identity using one of the following options**:\n- **If you have a current UW NetID**, select *Verify with NetID* and enter your NetID and name in the pop-up. You will receive an email with a link to complete your automatic verification.\n- If you do not have a current NetID, select *Contact Us* to send us an email so we can manually verify you.`,
            "components": [
                {
                    "type": 1,  // action row
                    "components": [
                        {
                            "type": 2,  // button
                            "label": "Verify with NetID",
                            "custom_id": "startButton",
                            "style": 1  // primary
                        },
                        {
                            "type": 2,  // button
                            "label": "Contact Us",
                            "url": "https://www.huskycyclinguw.com/contact",
                            "style": 5  // link
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
