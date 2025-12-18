import {
  SSMClient,
  GetParameterCommand,
} from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({});

export class SSMHelper {
  static async getParameter(paramName: string, withDecryption: boolean = false): Promise<string | undefined> {
    try {
      const response = await ssmClient.send(
        new GetParameterCommand({
          Name: paramName,
          WithDecryption: withDecryption,
        })
      );
      return response.Parameter?.Value;
    } catch (error: any) {
      console.warn(`Failed to get parameter ${paramName}: ${error.message}`);
      return undefined;
    }
  }

  static async getRequiredParameter(paramName: string, withDecryption: boolean = false): Promise<string> {
    const value = await this.getParameter(paramName, withDecryption);
    if (!value) {
      throw new Error(`Required parameter ${paramName} is missing or could not be retrieved`);
    }
    return value;
  }

  static parseCommaSeparatedList(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  }
}

