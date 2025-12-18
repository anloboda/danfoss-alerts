import { DeviceAboveThreshold } from "../danfoss/danfoss-api";

export function buildEmailSubject(thresholdCelsius: number): string {
  return `Danfoss Temperature Warning: ${thresholdCelsius}°C Threshold Exceeded`;
}

export function buildEmailBodyText(
  devicesAboveThreshold: DeviceAboveThreshold[],
  thresholdCelsius: number
): string {
  const deviceList = devicesAboveThreshold
    .map(
      (device) =>
        `  - ${device.name} (ID: ${device.id}): ${device.temperature_celsius}°C`
    )
    .join("\n");

  return `Hello Anna,

This is an automated notification from your Danfoss Floor Heating Monitoring System.

The floor temperature has exceeded the threshold of ${thresholdCelsius}°C.

Devices with elevated temperatures:
${deviceList}

Please check your Danfoss floor heating system when convenient.

Best regards,
Danfoss Temperature Monitoring Service

---
This is an automated message. Please do not reply to this email.`;
}

export function buildEmailBodyHtml(
  devicesAboveThreshold: DeviceAboveThreshold[],
  thresholdCelsius: number
): string {
  const deviceListHtml = devicesAboveThreshold
    .map(
      (device) =>
        `<li><strong>${device.name}</strong>: ${device.temperature_celsius}°C</li>`
    )
    .join("\n");

  return `<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #d9534f;">Danfoss Temperature Warning</h2>
    <p>Hello Anna,</p>
    <p>This is an automated notification from your Danfoss Floor Heating Monitoring System.</p>
    <p>The floor temperature has exceeded the threshold of <strong>${thresholdCelsius}°C</strong>.</p>
    
    <h3>Devices with elevated temperatures:</h3>
    <ul>
${deviceListHtml}
    </ul>
    
    <p>Please check your Danfoss floor heating system when convenient.</p>
    
    <p>Best regards,<br>
    Danfoss Temperature Monitoring Service</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #999;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>`;
}
