import { EmailClient } from '@azure/communication-email';

const globalForEmailClient = global as unknown as {
  emailClient: EmailClient | undefined;
};

function getEmailClient() {
  if (!process.env.AZURE_EMAIL_CONNECTION_STRING) {
    throw new Error('AZURE_EMAIL_CONNECTION_STRING is not set');
  }

  if (!globalForEmailClient.emailClient) {
    globalForEmailClient.emailClient = new EmailClient(
      process.env.AZURE_EMAIL_CONNECTION_STRING!
    );
  }

  return globalForEmailClient.emailClient;
}

const senderAddress =
  'DoNotReply@9996352e-b5cf-4ac3-9058-5a8adb2c225e.azurecomm.net';

export async function sendEmail(to: string, subject: string, body: string) {
  const emailMessage = {
    sender: `SerenGPTy <${senderAddress}>`,
    senderAddress,
    content: {
      subject,
      html: body,
    },
    recipients: {
      to: [{ address: to }],
    },
  };

  const poller = await getEmailClient().beginSend(emailMessage);

  await poller.pollUntilDone();
}
