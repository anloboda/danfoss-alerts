import { SSMHelper } from "../../temperature_check/utils/ssm-helper";

export interface DeviceStatus {
  code: string;
  value: number | string | boolean;
}

export interface Device {
  id: string;
  name: string;
  status: DeviceStatus[];
}

export interface DevicesResponse {
  result: Device[];
  t?: number;
}

export interface DeviceAboveThreshold {
  id: string;
  name: string;
  measured_value: number;
  temperature_celsius: number;
}

interface AccessTokenSecret {
  access_token: string;
  token_expires_at?: number;
}

export class DanfossApi {
  private readonly baseUrl = "https://api.danfoss.com";
  private accessTokenParamName: string;

  constructor(accessTokenParamName: string) {
    this.accessTokenParamName = accessTokenParamName;
  }

  async getAccessToken(): Promise<string> {
    const tokenValue = await SSMHelper.getRequiredParameter(this.accessTokenParamName, true);
    const tokenData: AccessTokenSecret = JSON.parse(tokenValue);
    
    if (!tokenData.access_token) {
      throw new Error("No access_token found in parameter");
    }
    
    return tokenData.access_token;
  }

  async getDevices(excludePattern?: string): Promise<Device[]> {
    const accessToken = await this.getAccessToken();
    const devices = await this.getDevicesWithToken(accessToken);
    
    if (excludePattern) {
      return this.filterDevices(devices, excludePattern);
    }
    
    return devices;
  }

  async getDevicesWithToken(accessToken: string): Promise<Device[]> {
    const url = `${this.baseUrl}/ally/devices`;
    const headers = {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    };

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (response.status === 401) {
      throw new Error(
        "Unauthorized - access token may be expired. Check token rotation."
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get devices: ${response.status} - ${errorText}`
      );
    }

    const data: DevicesResponse = await response.json();
    return data.result || [];
  }

  private filterDevices(devices: Device[], excludeNamePattern: string): Device[] {
    return devices.filter(
      (device) => !device.name?.includes(excludeNamePattern)
    );
  }
}
