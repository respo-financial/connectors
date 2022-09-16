import { ConnectorError, ConnectorErrorCodes } from '@logto/connector-kit';
import nock from 'nock';

import createConnector, { getAccessToken } from '.';
import { accessTokenEndpoint, authorizationEndpoint, userInfoEndpoint } from './constant';
import { mockedConfig } from './mock';

const getConfig = jest.fn().mockResolvedValue(mockedConfig);

describe('Discord connector', () => {
  describe('getAuthorizationUri', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should get a valid authorizationUri with redirectUri and state', async () => {
      const connector = await createConnector({ getConfig });
      const authorizationUri = await connector.getAuthorizationUri({
        state: 'some_state',
        redirectUri: 'http://localhost:3000/callback',
      });
      expect(authorizationUri).toEqual(
        `${authorizationEndpoint}?client_id=%3Cclient-id%3E&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&response_type=code&scope=identify+email&state=some_state`
      );
    });
  });

  describe('getAccessToken', () => {
    afterEach(() => {
      nock.cleanAll();
      jest.clearAllMocks();
    });

    it('should get an accessToken by exchanging with code', async () => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: 'access_token',
        scope: 'scope',
        token_type: 'token_type',
        expires_in: 3600,
      });

      const { accessToken } = await getAccessToken(mockedConfig, {
        code: 'code',
        redirectUri: 'dummyRedirectUri',
      });
      expect(accessToken).toEqual('access_token');
    });

    it('throws SocialAuthCodeInvalid error if accessToken not found in response', async () => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: '',
        scope: 'scope',
        token_type: 'token_type',
        expires_in: 3600,
      });

      await expect(
        getAccessToken(mockedConfig, { code: 'code', redirectUri: 'dummyRedirectUri' })
      ).rejects.toMatchError(new ConnectorError(ConnectorErrorCodes.SocialAuthCodeInvalid));
    });
  });

  describe('getUserInfo', () => {
    beforeEach(() => {
      nock(accessTokenEndpoint).post('').reply(200, {
        access_token: 'access_token',
        scope: 'scope',
        token_type: 'token_type',
        expires_in: 3600,
      });
    });

    afterEach(() => {
      nock.cleanAll();
      jest.clearAllMocks();
    });

    it('should get valid SocialUserInfo', async () => {
      nock(userInfoEndpoint).get('').reply(200, {
        id: '1234567890',
        username: 'Whumpus',
        avatar: 'avatar_id',
        email: 'whumpus@discord.com',
        verified: true,
      });
      const connector = await createConnector({ getConfig });
      const socialUserInfo = await connector.getUserInfo({
        code: 'code',
        redirectUri: 'dummyRedirectUri',
      });
      expect(socialUserInfo).toMatchObject({
        id: '1234567890',
        name: 'Whumpus',
        avatar: 'https://cdn.discordapp.com/avatars/1234567890/avatar_id',
        email: 'whumpus@discord.com',
      });
    });

    it('throws SocialAccessTokenInvalid error if remote response code is 401', async () => {
      nock(userInfoEndpoint).get('').reply(401);
      const connector = await createConnector({ getConfig });
      await expect(
        connector.getUserInfo({ code: 'code', redirectUri: 'dummyRedirectUri' })
      ).rejects.toMatchError(new ConnectorError(ConnectorErrorCodes.SocialAccessTokenInvalid));
    });

    it('throws unrecognized error', async () => {
      nock(userInfoEndpoint).get('').reply(500);
      const connector = await createConnector({ getConfig });
      await expect(
        connector.getUserInfo({ code: 'code', redirectUri: 'dummyRedirectUri' })
      ).rejects.toThrow();
    });
  });
});