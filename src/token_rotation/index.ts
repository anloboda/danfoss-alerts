import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({});

interface Credentials {
  client_id: string;
  client_secret: string;
  token_url: string;
}

interface AccessTokenSecret {
  access_token: string;
  token_expires_at: number;
}

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

import { getEnvVarOrThrow } from "../temperature_check/utils/env-helper";

export const handler = async (event: any, context: any) => {
  const credentialsParamName = getEnvVarOrThrow("CREDENTIALS_PARAM_NAME");
  const accessTokenParamName = getEnvVarOrThrow("ACCESS_TOKEN_PARAM_NAME");

  try {
    // Get credentials from parameter
    const credentialsResponse = await ssmClient.send(
      new GetParameterCommand({
        Name: credentialsParamName,
        WithDecryption: true,
      })
    );

    const credentials: Credentials = JSON.parse(
      credentialsResponse.Parameter?.Value || "{}"
    );

    // Get new access token from Danfoss API
    const accessToken = await getAccessToken(
      credentials.client_id,
      credentials.client_secret,
      credentials.token_url
    );

    // Calculate expiration time (60 minutes from now)
    const expiresAt = Math.floor(
      (Date.now() + 60 * 60 * 1000) / 1000
    );

    // Update access_token parameter
    const newTokenValue: AccessTokenSecret = {
      access_token: accessToken,
      token_expires_at: expiresAt,
    };

    await ssmClient.send(
      new PutParameterCommand({
        Name: accessTokenParamName,
        Value: JSON.stringify(newTokenValue),
        Type: "SecureString",
        Overwrite: true,
      })
    );

    console.log(`Successfully rotated access token. Expires at: ${expiresAt}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Token rotated successfully",
        expires_at: expiresAt,
      }),
    };
  } catch (error: any) {
    console.error(`Error rotating token: ${error.message}`);
    throw error;
  }
};

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  tokenUrl: string
): Promise<string> {
  // Create Basic Auth header (base64 encoded client_id:client_secret)
  const credentials = `${clientId}:${clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString("base64");

  const response = await fetch(tokenUrl, {
    signal: AbortSignal.timeout(30000), // 30 second timeout
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${encodedCredentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get access token: ${response.status} - ${errorText}`
    );
  }

  const tokenData: TokenResponse = await response.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new Error(`No access_token in response: ${JSON.stringify(tokenData)}`);
  }

  return accessToken;
}

