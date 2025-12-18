import {
  SESClient,
  SendEmailCommand,
} from "@aws-sdk/client-ses";
import { DeviceAboveThreshold } from "../../../common-lib/danfoss/danfoss-api";
import { SSMHelper } from "../../utils/ssm-helper";
import {
  buildEmailSubject,
  buildEmailBodyText,
  buildEmailBodyHtml,
} from "./email-templates";

export class EmailNotifier {
  private ses: SESClient;
  private emailsParamName: string;

  constructor(emailsParamName: string) {
    this.ses = new SESClient({});
    this.emailsParamName = emailsParamName;
  }

  async getRecipients(): Promise<string[]> {
    const emailsValue = await SSMHelper.getRequiredParameter(this.emailsParamName, true);
    return SSMHelper.parseCommaSeparatedList(emailsValue);
  }

  async sendNotifications(
    devicesAboveThreshold: DeviceAboveThreshold[],
    thresholdCelsius: number,
  ): Promise<void> {
    const emails = await this.getRecipients();
    
    if (emails.length === 0) {
      throw new Error("No notification emails configured");
    }

    const actualSenderEmail = emails[0];

    console.log(`Preparing to send email notifications:`);
    console.log(`  - Sender: ${actualSenderEmail}`);
    console.log(`  - Recipients: ${emails.join(", ")}`);
    console.log(`  - Devices above threshold: ${devicesAboveThreshold.length}`);

    const subject = buildEmailSubject(thresholdCelsius);
    const bodyText = buildEmailBodyText(devicesAboveThreshold, thresholdCelsius);
    const bodyHtml = buildEmailBodyHtml(devicesAboveThreshold, thresholdCelsius);

    // Send email to each recipient
    console.log(`Starting to send emails...`);
    let successCount = 0;
    let failureCount = 0;

    for (const email of emails) {
      try {
        console.log(`Attempting to send email to ${email}...`);
        const response = await this.ses.send(
          new SendEmailCommand({
            Source: actualSenderEmail,
            Destination: {
              ToAddresses: [email],
            },
            ReplyToAddresses: [actualSenderEmail],
            Message: {
              Subject: {
                Data: subject,
                Charset: "UTF-8",
              },
              Body: {
                Text: {
                  Data: bodyText,
                  Charset: "UTF-8",
                },
                Html: {
                  Data: bodyHtml,
                  Charset: "UTF-8",
                },
              },
            },
          })
        );
        console.log(
          `✅ Successfully sent notification to ${email} (MessageId: ${response.MessageId})`
        );
        successCount++;
      } catch (error: any) {
        console.error(
          `❌ Failed to send email to ${email}: ${error.message}`,
          error
        );
        failureCount++;
        // Don't raise - continue sending to other recipients
      }
    }

    console.log(
      `Email sending completed. Success: ${successCount}, Failed: ${failureCount}`
    );
  }
}
