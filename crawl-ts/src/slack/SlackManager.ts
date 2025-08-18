import fetch from "node-fetch";

class SlackManager{

    async  sendSlackMessage(message: string) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL!; // .env에 저장 권장
    await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
    });
    }
}

export const slackManager= new SlackManager();