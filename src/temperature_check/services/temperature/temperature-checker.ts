import { Device, DeviceAboveThreshold } from "../../../common-lib/danfoss/danfoss-api";

export class TemperatureChecker {
  checkTemperatures(
    devices: Device[],
    threshold: number
  ): DeviceAboveThreshold[] {
    const devicesAboveThreshold: DeviceAboveThreshold[] = [];

    for (const device of devices) {
      const deviceId = device.id;
      const deviceName = device.name || "Unknown";
      const statusList = device.status || [];

      // Find MeasuredValue in status array
      let measuredValue: number | null = null;
      for (const statusItem of statusList) {
        if (statusItem.code === "MeasuredValue") {
          measuredValue =
            typeof statusItem.value === "number"
              ? statusItem.value
              : parseFloat(String(statusItem.value));
          break;
        }
      }

      if (measuredValue !== null && measuredValue > threshold) {
        const temperatureCelsius = measuredValue / 10.0;
        devicesAboveThreshold.push({
          id: deviceId,
          name: deviceName,
          measured_value: measuredValue,
          temperature_celsius: temperatureCelsius,
        });
        console.log(
          `Alert: Device '${deviceName}' (ID: ${deviceId}) ` +
            `has temperature ${temperatureCelsius}°C (value: ${measuredValue})`
        );
      }
    }

    return devicesAboveThreshold;
  }
}
